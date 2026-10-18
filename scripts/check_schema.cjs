require("dotenv").config({ path: ".env" });
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected");

  // Show columns of ordens_servico
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'ordens_servico'
    ORDER BY ordinal_position
  `);
  console.log("ordens_servico columns:");
  for (const c of cols.rows) {
    console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`);
  }

  // Also check if data_previsao exists in alocacoes_escala or other tables
  const allTables = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns 
    WHERE column_name LIKE '%previsao%' OR column_name LIKE '%previs%'
    ORDER BY table_name, column_name
  `);
  console.log("\nColumns with 'previs':");
  for (const c of allTables.rows) {
    console.log(`  ${c.table_name}.${c.column_name}`);
  }

  await client.end();
}
main().catch(e => console.error(e));
