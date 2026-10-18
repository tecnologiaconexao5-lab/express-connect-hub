require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main() {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  const cols = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'alocacoes_escala' ORDER BY ordinal_position");
  console.log("alocacoes_escala columns:");
  for (const co of cols.rows) console.log(`  ${co.column_name} (${co.data_type}, nullable=${co.is_nullable})`);
  await c.end();
}
main().catch(console.error);
