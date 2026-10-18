require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main() {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  
  // Check constraints
  const chk = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint WHERE conrelid = 'alocacoes_escala'::regclass
  `);
  console.log("Constraints:");
  for (const r of chk.rows) console.log(`  ${r.conname}: ${r.def}`);
  
  await c.end();
}
main().catch(console.error);
