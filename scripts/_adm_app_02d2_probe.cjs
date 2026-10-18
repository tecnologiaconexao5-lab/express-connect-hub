// READ-ONLY probe: prestadores + documentos_prestadores (ADM-APP-02D.2)
const { Client } = require("pg");
const fs = require("fs");

function loadEnv() {
  const raw = fs.readFileSync(".env", "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

(async () => {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  const docs = await client.query(`
    SELECT d.id, d.prestador_id, d.tipo, d.url, p.nome_completo, p.status, p.foto
    FROM documentos_prestadores d
    LEFT JOIN prestadores p ON p.id::text = d.prestador_id::text
    ORDER BY d.created_at DESC NULLS LAST
    LIMIT 40
  `);
  console.log("=== documentos_prestadores (up to 40) ===");
  for (const r of docs.rows) {
    console.log(
      [r.id, r.prestador_id, r.tipo, r.nome_completo || "(sem prestador)", r.status, String(r.url || "").slice(0, 120)].join(" | ")
    );
  }

  const foto = await client.query(`
    SELECT id, nome_completo, status, foto FROM prestadores
    WHERE foto IS NOT NULL AND foto <> '' ORDER BY updated_at DESC NULLS LAST LIMIT 15
  `);
  console.log("=== prestadores com foto ===");
  for (const r of foto.rows) {
    console.log([r.id, r.nome_completo, r.status, String(r.foto).slice(0, 140)].join(" | "));
  }

  const fix = await client.query(`
    SELECT id, nome_completo, status, foto FROM prestadores
    WHERE nome_completo ILIKE '%02D2%' ORDER BY created_at DESC
  `);
  console.log("=== fixture 02D2 ===");
  for (const r of fix.rows) {
    console.log([r.id, r.nome_completo, r.status, String(r.foto || "").slice(0, 140)].join(" | "));
  }

  const cnt = await client.query(`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE url IS NOT NULL AND url <> '') AS com_url
    FROM documentos_prestadores
  `);
  console.log("=== contagem documentos ===", cnt.rows[0]);

  await client.end();
})().catch((e) => {
  console.error("PROBE ERRO:", e.message);
  process.exit(1);
});
