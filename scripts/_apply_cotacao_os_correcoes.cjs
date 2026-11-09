// ============================================================
// LOTE 1 — aplica supabase/migrations/20261109000000_cotacao_os_correcoes_base.sql
// (fuso SP, cliente herdado, endereços desmembrados e status em_analise)
// no banco remoto via `pg` (psql ausente no Windows).
//
// Uso:
//   node scripts/_apply_cotacao_os_correcoes.cjs            (dry-run: prova + ROLLBACK)
//   node scripts/_apply_cotacao_os_correcoes.cjs --apply    (COMMIT)
//   node scripts/_apply_cotacao_os_correcoes.cjs --check    (read-only, só relatório)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261109000000_cotacao_os_correcoes_base.sql",
);
const APPLY = process.argv.includes("--apply");
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

async function corpoDaFuncao(client, nome, args = "") {
  const { rows } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname=$1
      ORDER BY p.oid DESC
      LIMIT 1`,
    [nome],
  );
  return rows[0] ? rows[0].def : null;
}

async function provar(client) {
  const defOs = await corpoDaFuncao(client, "f_cotacao_detalhes_para_os");
  const defStatus = await corpoDaFuncao(client, "f_cotacao_status_cliente");
  const defParse = await corpoDaFuncao(client, "f_parse_endereco_cotacao");
  const defEnd = await corpoDaFuncao(client, "f_endereco_cotacao_os");

  registrar(Boolean(defOs), "funcao f_cotacao_detalhes_para_os existe");
  registrar(Boolean(defStatus), "funcao f_cotacao_status_cliente existe");
  registrar(Boolean(defParse), "funcao f_parse_endereco_cotacao existe");
  registrar(Boolean(defEnd), "funcao f_endereco_cotacao_os existe");

  if (defOs) {
    registrar(
      defOs.includes("America/Sao_Paulo"),
      "created_at/updated_at/histórico da OS no fuso America/Sao_Paulo",
    );
    registrar(
      defOs.includes("f_endereco_cotacao_os") &&
        Boolean(defEnd) &&
        defEnd.includes("'logradouro'") &&
        defEnd.includes("'numero'") &&
        defEnd.includes("'bairro'") &&
        defEnd.includes("'cidade'") &&
        defEnd.includes("'uf'") &&
        defEnd.includes("'cep'") &&
        defEnd.includes("'estado'"),
      "endereços desmembrados (logradouro/numero/bairro/cidade/uf/estado/cep)",
    );
    registrar(
      defOs.includes("SET nome_fantasia = v_cliente_nome") &&
        defOs.includes("regexp_replace(COALESCE(telefone"),
      "cliente herdado: renomeia por telefone e sincroniza telefone",
    );
    registrar(
      defOs.includes("'em_analise'") && !defOs.includes("'São Paulo - Matriz', 'pendente'"),
      "OS nasce com status 'em_analise' (não 'pendente')",
    );
    registrar(
      defOs.includes("SECURITY DEFINER") && defOs.includes("pg_temp"),
      "SECURITY DEFINER + search_path preservados",
    );
  }

  if (defStatus) {
    registrar(
      defStatus.includes("SET status = 'em_analise'") &&
        !defStatus.includes("SET status = 'rascunho'"),
      "blindagem 'aguardando' mantém a OS em 'em_analise'",
    );
  }

  // Prova funcional do parser de fallback (legado).
  if (defParse) {
    const { rows } = await client.query(
      `SELECT public.f_parse_endereco_cotacao(
         'Rua das Flores, 100 - Centro, São Paulo - SP, 05016-000'
       ) AS d`,
    );
    const d = rows[0].d || {};
    registrar(
      d.cep === "05016-000" && d.uf === "SP" && d.cidade === "São Paulo",
      "parser legado separa CEP/UF/Cidade",
      JSON.stringify(d),
    );
  }

  // Grants das funções expostas à página pública.
  const { rows: grantsOs } = await client.query(
    `SELECT DISTINCT grantee FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND routine_name='f_cotacao_detalhes_para_os'`,
  );
  const gOs = grantsOs.map((g) => g.grantee);
  registrar(
    gOs.includes("anon") && gOs.includes("authenticated") && !gOs.includes("PUBLIC"),
    "grants f_cotacao_detalhes_para_os: anon + authenticated, PUBLIC revogado",
    gOs.join(", "),
  );

  const { rows: grantsSt } = await client.query(
    `SELECT DISTINCT grantee FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND routine_name='f_cotacao_status_cliente'`,
  );
  const gSt = grantsSt.map((g) => g.grantee);
  registrar(
    gSt.includes("anon") && gSt.includes("authenticated") && !gSt.includes("PUBLIC"),
    "grants f_cotacao_status_cliente: anon + authenticated, PUBLIC revogado",
    gSt.join(", "),
  );
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
    const { rows: tipo } = await client.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ordens_servico' AND column_name='created_at'`,
    );
    console.log(`ordens_servico.created_at: ${tipo[0]?.data_type || "?"}`);

    if (CHECK_ONLY) {
      console.log("\n[--check] relatório do estado atual (nada será alterado):");
      await provar(client);
      const falhas = checks.filter((c) => !c.ok);
      await client.end();
      process.exit(falhas.length ? 1 : 0);
    }

    await client.query("BEGIN");
    console.log("SQL executado dentro da transação (ainda não commitado).");
    await client.query(sql);

    console.log("\n[provas]");
    await provar(client);

    const falhas = checks.filter((c) => !c.ok);
    if (falhas.length) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} verificações — ROLLBACK.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificações OK.`);
    if (APPLY) {
      await client.query("COMMIT");
      console.log("COMMIT realizado — migration aplicada no banco remoto.");
    } else {
      await client.query("ROLLBACK");
      console.log("(dry-run) ROLLBACK executado — nada foi persistido. Use --apply.");
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    console.error("ROLLBACK (se havia transação aberta).");
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
