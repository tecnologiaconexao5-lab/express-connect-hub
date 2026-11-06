/* DIAGNOSTICO: identity args reais das funcoes app_s6 (dentro de transacao, ROLLBACK) */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIG_DIR = "C:\\src\\conexao_prestador\\supabase\\migrations\\tms";
const FILES = [
  "20261031000003_app_s6_pipeline_cadastro_concluido.sql",
  "20261031000004_app_s6_preferencias_operacionais.sql",
  "20261031000005_app_s6_avaliacao_situacional.sql",
];

(async () => {
  const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  await c.query("BEGIN");
  for (const f of FILES) await c.query(fs.readFileSync(path.join(MIG_DIR, f), "utf8"));

  const r = await c.query(
    `SELECT p.proname,
            pg_get_function_identity_arguments(p.oid) AS ident,
            p.prosecdef,
            p.proconfig
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname LIKE 'app_s6%'
     ORDER BY p.proname`
  );
  console.log("== funcoes app_s6 ==");
  for (const row of r.rows) {
    console.log(`  proname = ${row.proname}`);
    console.log(`    ident  = [${row.ident}]`);
    console.log(`    secdef = ${row.secdef}  proconfig = ${row.proconfig ? JSON.stringify(row.proconfig) : "null"}`);
  }

  await c.query("ROLLBACK");
  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
