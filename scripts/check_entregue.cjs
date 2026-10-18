require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main() {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  // Check all "entregue" OS
  const r = await c.query("SELECT numero, status, created_at FROM ordens_servico WHERE cliente_id = $1 AND status = 'entregue'", ["cd463c93-5190-408e-b5e6-ee639b688402"]);
  console.log("Entregue OS:");
  for (const x of r.rows) console.log(`  ${x.numero} | status=${x.status} | created_at=${x.created_at}`);
  
  // Check first day of current month (Brazil TZ)
  console.log("\nCurrent date on server:", new Date().toISOString());
  console.log("First day of month:", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  console.log("Month:", new Date().getMonth()+1, "Year:", new Date().getFullYear());
  
  await c.end();
}
main().catch(console.error);
