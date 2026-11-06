/* READ-ONLY: qual versão de f_cotacao_detalhes_para_os está viva? (assina 29/10 vs 31/10) */
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_cotacao_detalhes_para_os'`,
  );
  const def = r.rows[0].def;
  const markers = {
    "v_janela_inicio (31/10)": def.includes("v_janela_inicio"),
    "janelaInicio (31/10)": def.includes("janelaInicio"),
    "regexp_match janela (31/10)": def.includes("regexp_match"),
    "metadata orcamento (ambas)": def.includes("orcamento"),
    "linhas totais da def": def.split("\n").length,
  };
  Object.entries(markers).forEach(([k, v]) => console.log(`${v ? "[31/10?]" : "[só 29/10]"} ${k}: ${v}`));
  console.log("\nsha256 da função viva:", crypto.createHash("sha256").update(def).digest("hex").slice(0, 16));
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
