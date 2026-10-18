/* ORC-PDF-01-QA — SELECT read-only: dump bruto de `enderecos` de 2 rascunhos
   + do registro ORC-202609-8659. NENHUMA escrita. */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

(async () => {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`
      SELECT numero, status, enderecos, veiculo, distancia_rota
      FROM public.orcamentos
      WHERE numero IN ('ORC-202607-3557','ORC-202609-8659')`);
    for (const row of r.rows) {
      console.log("=====", row.numero, row.status);
      console.log("enderecos:", JSON.stringify(row.enderecos, null, 1));
      console.log("veiculo:", JSON.stringify(row.veiculo));
      console.log("distancia_rota:", JSON.stringify(row.distancia_rota));
    }
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
    console.log("ROLLBACK — nenhuma escrita.");
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
