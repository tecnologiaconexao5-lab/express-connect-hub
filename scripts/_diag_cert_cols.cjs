const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* opcional */
}
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='certificados_fiscais'
        ORDER BY ordinal_position`
    );
    console.log("colunas certificados_fiscais:");
    for (const c of cols.rows) console.log(`  ${c.column_name} ${c.data_type} null=${c.is_nullable}`);
    const r = await client.query(
      `SELECT * FROM public.certificados_fiscais ORDER BY created_at DESC LIMIT 3`
    );
    console.log(`linhas: ${r.rowCount}`);
    for (const row of r.rows) {
      const resumo = {};
      for (const [k, v] of Object.entries(row)) {
        if (v == null) resumo[k] = null;
        else if (typeof v === "string" && v.length > 80) resumo[k] = `<${v.length} chars>`;
        else resumo[k] = v;
      }
      console.log(JSON.stringify(resumo));
    }
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error("FALHA", e.message);
  process.exitCode = 1;
});
