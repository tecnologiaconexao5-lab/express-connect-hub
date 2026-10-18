/* FIN-PP-FUNC-01 — runner de migração (validate = transpaction+rollback; apply = commit). */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const txt = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const mode = process.argv[2] || "validate";
const file = process.argv[3] || "supabase/migrations/20260926000001_fin_pp_func01_novo_lancamento.sql";

(async () => {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sql = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    const fn = await client.query(`SELECT proname FROM pg_proc WHERE proname IN
      ('f_criar_lancamento_manual_prestador','f_aprovar_pagamento_prestadores','f_gerar_lote_pagamentos')
      AND pronamespace='public'::regnamespace ORDER BY proname`);
    console.log("Funções presentes:", fn.rows.map(r => r.proname).join(", "));
    if (mode === "apply") {
      await client.query("COMMIT");
      console.log("COMMIT OK — migração aplicada.");
    } else {
      await client.query("ROLLBACK");
      console.log("ROLLBACK OK — SQL válido (nada persistido).");
    }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
