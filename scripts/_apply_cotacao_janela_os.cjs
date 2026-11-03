// ============================================================
// FASE 8 (b) — aplica supabase/migrations/20261031000000_
// cotacao_janela_horario_os.sql no banco remoto via `pg`
// (psql ausente no Windows) e FAZ A PROVA de cada item do
// contrato antes do COMMIT.
// Uso: node scripts/_apply_cotacao_janela_os.cjs [--check]
//   --check  → somente verifica (read-only), não altera nada
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261031000000_cotacao_janela_horario_os.sql",
);
const CHECK_ONLY = process.argv.includes("--check");

function carregarDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(env)) return null;
  const linha = fs
    .readFileSync(env, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!linha) return null;
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const checks = [];
const registrar = (ok, rotulo, detalhe = "") => {
  checks.push({ ok, rotulo, detalhe });
  console.log(`${ok ? "  OK " : "FAIL "} ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`);
};

async function corpoDaFuncao(client) {
  const { rows } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='f_cotacao_detalhes_para_os'`,
  );
  return rows[0] ? rows[0].def : null;
}

async function provarVersaoAntiga(client) {
  // Estado ANTES: versão de 29/10 (sem v_janela_inicio) — capturado fora da transacao
  const def = await corpoDaFuncao(client);
  return def && def.includes("v_janela_inicio");
}

async function main() {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL ausente (env ou .env). Abortado.");
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // ---------- ESTADO ATUAL (read-only) ----------
    const defAntes = await corpoDaFuncao(client);
    if (!defAntes) {
      console.error("Funcao f_cotacao_detalhes_para_os nao existe — migration depende dela.");
      await client.end();
      process.exit(1);
    }
    const versaoAntiga = !defAntes.includes("v_janela_inicio");
    console.log(
      versaoAntiga
        ? "Funcao na VERSAO ANTIGA (29/10, sem janela) -> aplicando migration 31/10."
        : "Funcao ja na VERSAO 31/10 (com v_janela_inicio) -> apenas verificacao.",
    );

    if (!versaoAntiga && CHECK_ONLY) {
      console.log("Ja aplicada e modo --check -> nada a alterar.");
      await client.end();
      process.exit(0);
    }

    await client.query("BEGIN");
    if (versaoAntiga && !CHECK_ONLY) {
      await client.query(sql);
      console.log("SQL executado dentro da transacao (ainda nao commitado).");
    }

    // ---------- PROVA (dentro da transacao) ----------
    const defDepois = await corpoDaFuncao(client);
    registrar(Boolean(defDepois), "funcao f_cotacao_detalhes_para_os existe");
    registrar(
      defDepois.includes("v_janela_inicio") && defDepois.includes("v_janela_fim"),
      "versao 31/10 (declara v_janela_inicio/v_janela_fim)",
    );
    registrar(
      defDepois.includes("regexp_match") && defDepois.includes("janela_horario"),
      "parse da janela \"09:00 às 11:00\" + carga.janela_horario",
      defDepois.includes("regexp_match") ? "" : "regexp_match ausente",
    );
    registrar(
      defDepois.includes("'janelaInicio', v_janela_inicio") &&
        defDepois.includes("'janelaFim', v_janela_fim"),
      "enderecos[].janelaInicio/janelaFim propagados",
    );
    registrar(
      defDepois.includes("'agendamento', v_tem_agendamento") &&
        defDepois.includes("'agendado', v_tem_agendamento"),
      "flags agendamento/agendado derivadas de data+janela",
    );
    registrar(
      defDepois.includes("'Horário: ' || v_janela"),
      "observacoes com \"Horário: ...\"",
    );
    registrar(
      defDepois.includes("SECURITY DEFINER") && defDepois.includes("pg_temp"),
      "SECURITY DEFINER + search_path = public, pg_temp preservados",
    );

    const { rows: grants } = await client.query(
      `SELECT DISTINCT grantee, privilege_type
         FROM information_schema.routine_privileges
        WHERE routine_schema='public' AND routine_name='f_cotacao_detalhes_para_os'`,
    );
    const grantees = grants.map((g) => g.grantee);
    registrar(
      grantees.includes("anon") && grantees.includes("authenticated") && !grantees.includes("PUBLIC"),
      "grants: anon + authenticated, PUBLIC revogado",
      grantees.join(", "),
    );

    const falhas = checks.filter((c) => !c.ok);
    if (falhas.length) {
      await client.query("ROLLBACK").catch(() => {});
      console.log(CHECK_ONLY ? "" : "\nROLLBACK executado — nada foi persistido.");
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} verificacoes.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificacoes OK.`);
    if (CHECK_ONLY || !versaoAntiga) {
      await client.query("ROLLBACK");
      console.log("(nenhuma alteracao — transacao de prova revertida)");
    } else {
      await client.query("COMMIT");
      console.log("COMMIT realizado — migration aplicada no banco remoto.");
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    console.error("ROLLBACK (se havia transacao aberta).");
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
