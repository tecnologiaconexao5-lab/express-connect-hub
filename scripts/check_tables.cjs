require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main() {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  
  // Find tables with 'ocorrencia' in name
  const tables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%ocorrencia%'");
  console.log("Tables with ocorrencia:");
  for (const t of tables.rows) console.log(`  ${t.table_name}`);

  // Find tables with 'entregas' in name
  const etables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%entregas%' OR table_name LIKE '%entrega%'");
  console.log("\nTables with entrega:");
  for (const t of etables.rows) console.log(`  ${t.table_name}`);
  
  await c.end();
}
main().catch(console.error);
