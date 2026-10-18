/* ORC-PDF-01-QA — apenas SELECT (read-only) para escolher orcamento rascunho
   com rota calculada e conferir o registro ORC-202609-8659. NENHUMA escrita. */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  const env = {};
  if (!fs.existsSync(p)) return env;
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
    const r1 = await client.query(`
      SELECT numero, status, cliente, created_at,
             distancia_rota->>'distancia_texto' AS dist_txt,
             distancia_rota->>'duracao_texto'   AS dur_txt,
             (SELECT count(*) FROM jsonb_array_elements(COALESCE(enderecos,'[]'::jsonb)) e
               WHERE COALESCE(e->>'endereco','') <> '') AS pts,
             (SELECT count(*) FROM jsonb_array_elements(COALESCE(enderecos,'[]'::jsonb)) e
               WHERE e->>'tipo' = 'coleta') AS cols,
             (SELECT count(*) FROM jsonb_array_elements(COALESCE(enderecos,'[]'::jsonb)) e
               WHERE e->>'tipo' = 'entrega') AS ents
      FROM public.orcamentos
      WHERE status = 'rascunho'
      ORDER BY created_at DESC
      LIMIT 15`);
    console.log("== RASCUNHOS (candidates) ==");
    console.log(JSON.stringify(r1.rows, null, 1));

    const r2 = await client.query(`
      SELECT numero, status, cliente, valor_base, valor_final,
             valores->>'valorBase' AS v_base, valores->>'valorFinal' AS v_final,
             distancia_rota->>'distancia_texto' AS dist_txt,
             distancia_rota->>'duracao_texto'   AS dur_txt,
             (SELECT count(*) FROM jsonb_array_elements(COALESCE(enderecos,'[]'::jsonb)) e) AS pts
      FROM public.orcamentos
      WHERE numero = 'ORC-202609-8659' OR id = 'd577539b-1865-477c-b079-af94152fc3e9'`);
    console.log("== ORC-202609-8659 ==");
    console.log(JSON.stringify(r2.rows, null, 1));

    const r3 = await client.query(`
      SELECT status, count(*) FROM public.orcamentos GROUP BY status ORDER BY 2 DESC`);
    console.log("== STATUS ==");
    console.log(JSON.stringify(r3.rows));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
    console.log("ROLLBACK — nenhuma escrita.");
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
