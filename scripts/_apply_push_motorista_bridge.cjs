// ============================================================
// Aplica supabase/migrations/20261109030000_push_motorista_bridge.sql
// (tokens FCM + fila de push + títulos "Novo chamado em aberto").
//
// Uso:
//   node scripts/_apply_push_motorista_bridge.cjs            (dry-run: prova + ROLLBACK)
//   node scripts/_apply_push_motorista_bridge.cjs --apply    (COMMIT)
//   node scripts/_apply_push_motorista_bridge.cjs --check    (read-only)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261109030000_push_motorista_bridge.sql",
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

async function defFuncao(client, nome) {
  const { rows } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname=$1
      ORDER BY p.oid DESC LIMIT 1`,
    [nome],
  );
  return rows[0] ? rows[0].def : null;
}

async function provar(client) {
  const { rows: tabelas } = await client.query(
    `SELECT c.relname, c.relrowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('motorista_push_tokens','push_notificacoes_fila')`,
  );
  const porNome = Object.fromEntries(tabelas.map((t) => [t.relname, t]));
  registrar(Boolean(porNome.motorista_push_tokens), "tabela motorista_push_tokens existe");
  registrar(Boolean(porNome.push_notificacoes_fila), "tabela push_notificacoes_fila existe");
  registrar(
    porNome.motorista_push_tokens?.relrowsecurity === true &&
      porNome.push_notificacoes_fila?.relrowsecurity === true,
    "RLS ativa nas duas tabelas",
  );

  const { rows: policies } = await client.query(
    `SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='motorista_push_tokens'`,
  );
  const nomes = policies.map((p) => p.policyname);
  registrar(
    ["push_tokens_select_own", "push_tokens_insert_own", "push_tokens_update_own", "push_tokens_delete_own"].every(
      (n) => nomes.includes(n),
    ),
    "policies do prestador (own) presentes",
    nomes.join(", "),
  );

  const defReg = await defFuncao(client, "f_registrar_push_token");
  registrar(Boolean(defReg), "RPC f_registrar_push_token existe");
  if (defReg) {
    registrar(
      defReg.includes("SECURITY DEFINER") && defReg.includes("auth.uid()") && defReg.includes("ON CONFLICT (token)"),
      "registo de token resolve o prestador por auth.uid() e faz upsert",
    );
  }

  const defFila = await defFuncao(client, "f_trg_enfileirar_push_notificacao");
  registrar(Boolean(defFila), "trigger de fila de push existe");

  const { rows: trg } = await client.query(
    `SELECT tgname FROM pg_trigger
      WHERE tgrelid='public.portal_notificacoes'::regclass AND tgname='trg_enfileirar_push_notificacao'`,
  );
  registrar(trg.length > 0, "trigger trg_enfileirar_push_notificacao em portal_notificacoes");

  const defOs = await defFuncao(client, "f_trg_notificar_os_para_app");
  registrar(
    Boolean(defOs) && defOs.includes("Novo chamado em aberto") && defOs.includes("os_id"),
    "notificação de alocação com título 'Novo chamado em aberto' + os_id",
  );

  const defRede = await defFuncao(client, "f_trg_notificar_oportunidade_rede");
  registrar(
    Boolean(defRede) && defRede.includes("Nova OS disponível"),
    "notificação da Rede com título 'Nova OS disponível'",
  );

  // Prova funcional: INSERT em portal_notificacoes cria 1 linha na fila.
  const { rows: prestador } = await client.query(
    `SELECT id FROM public.prestadores LIMIT 1`,
  );
  if (prestador[0]?.id) {
    const { rows: antes } = await client.query(`SELECT count(*)::int AS n FROM public.push_notificacoes_fila`);
    const { rows: notif } = await client.query(
      `INSERT INTO public.portal_notificacoes (prestador_id, titulo, mensagem, tipo, os_id, origem_tipo, lida)
       VALUES ($1, 'Prova push', 'Teste de enfileiramento', 'nova_os', NULL, 'ordens_servico', false)
       RETURNING id`,
      [prestador[0].id],
    );
    const { rows: depois } = await client.query(`SELECT count(*)::int AS n FROM public.push_notificacoes_fila`);
    registrar(
      depois[0].n === antes[0].n + 1,
      "INSERT em portal_notificacoes enfileira 1 push",
      `${antes[0].n} → ${depois[0].n}`,
    );
    // limpa a linha de prova (na transação/rollback também seria removida).
    await client.query(`DELETE FROM public.push_notificacoes_fila WHERE notificacao_id = $1`, [notif[0].id]);
    await client.query(`DELETE FROM public.portal_notificacoes WHERE id = $1`, [notif[0].id]);
  }
}

async function main() {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL ausente (env ou .env). Abortado.");
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    if (CHECK_ONLY) {
      console.log("[--check] estado atual (nada será alterado):");
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
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} — ROLLBACK.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificações OK.`);
    if (APPLY) {
      await client.query("COMMIT");
      console.log("COMMIT realizado — ponte de push aplicada no banco.");
    } else {
      await client.query("ROLLBACK");
      console.log("(dry-run) ROLLBACK — nada persistido. Use --apply.");
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
