/* READ-ONLY: definicao da RPC f_cotacao_detalhes_para_os (status da OS criada) */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosrc
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'f_cotacao_detalhes_para_os'`
  );
  for (const row of r.rows) {
    console.log(`== ${row.proname}(${row.args}) ==`);
    const lines = row.prosrc.split("\n");
    lines.forEach((l, i) => {
      if (/status|cancelad|ordens_servico|os_id|INSERT INTO/i.test(l) && l.trim()) {
        console.log(`  ${i + 1}: ${l.trim().slice(0, 160)}`);
      }
    });
  }
  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
