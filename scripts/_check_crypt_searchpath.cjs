/* Verificacao READ-ONLY: schema do pgcrypto (crypt/gen_salt) vs search_path da funcao app_s6 */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r = await c.query(
    `SELECT n.nspname, count(*) AS n
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname IN ('crypt', 'gen_salt')
     GROUP BY n.nspname ORDER BY 1`
  );
  console.log("schemas com crypt/gen_salt:", JSON.stringify(r.rows));

  const s = await c.query(`SELECT current_setting('search_path', false) AS sp`);
  console.log("search_path do role connect:", s.rows[0].sp);

  // simula exatamente o search_path declarado na funcao
  await c.query(`SET search_path = public, auth, pg_temp`);
  const t = await c
    .query(`SELECT crypt('x', gen_salt('bf', 4)) IS NOT NULL AS ok`)
    .catch((e) => ({ rows: [{ ok: "ERRO: " + e.message }] }));
  console.log("crypt() com search_path public,auth,pg_temp:", JSON.stringify(t.rows));

  // funcoes pgcrypto visiveis nesse search_path
  const vis = await c.query(
    `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname IN ('crypt','gen_salt') AND pg_function_is_visible(p.oid)`
  );
  console.log("visiveis nesse search_path:", JSON.stringify(vis.rows));

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
