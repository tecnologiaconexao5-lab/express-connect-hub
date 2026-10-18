require("dotenv").config({ path: ".env" });
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'os_historico' ORDER BY ordinal_position
  `);
  console.log("os_historico columns:");
  for (const c of cols.rows) console.log(`  ${c.column_name} (${c.data_type})`);

  await client.end();
}
main().catch(console.error);
