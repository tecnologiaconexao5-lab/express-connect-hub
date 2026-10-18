const { Client } = require("pg");
async function main() {
  const c = new Client({ connectionString: "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres", ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log("=== COLUNAS REAIS operacoes ===");
  const cols = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='operacoes' ORDER BY ordinal_position`);
  cols.rows.forEach(r => console.log(`  ${r.column_name} ${r.data_type} null=${r.is_nullable}`));

  console.log("\n=== DADOS REAIS operacoes (primeiras 5) ===");
  const rows = await c.query(`SELECT * FROM operacoes LIMIT 5`);
  console.log(`  Total: ${rows.rowCount}`);
  rows.rows.forEach(r => console.log(`  ${JSON.stringify(r).substring(0, 400)}`));

  console.log("\n=== COUNT por status ===");
  const counts = await c.query(`SELECT status, count(*) AS c FROM operacoes GROUP BY status ORDER BY c DESC`);
  counts.rows.forEach(r => console.log(`  ${r.status}: ${r.c}`));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
