require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main() {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  const r = await c.query("SELECT status, COUNT(*) FROM ordens_servico WHERE cliente_id = $1 GROUP BY status", ["cd463c93-5190-408e-b5e6-ee639b688402"]);
  console.log("Current OS statuses for client:");
  for (const x of r.rows) console.log(`  ${x.status}: ${x.count}`);
  await c.end();
}
main().catch(console.error);
