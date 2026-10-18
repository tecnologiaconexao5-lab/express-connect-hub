require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main(){
  const c = new Client({connectionString:process.env.DATABASE_URL});
  await c.connect();
  const r = await c.query("SELECT status, COUNT(*) FROM ordens_servico WHERE cliente_id = $1 GROUP BY status", ["cd463c93-5190-408e-b5e6-ee639b688402"]);
  console.log("OS by status:"); r.rows.forEach(x => console.log(" ", x.status, x.count));
  
  const h = await c.query("SELECT o.numero, h.descricao, h.created_at FROM os_historico h JOIN ordens_servico o ON o.id = h.ordem_servico_id WHERE o.cliente_id = $1 ORDER BY h.created_at DESC LIMIT 15", ["cd463c93-5190-408e-b5e6-ee639b688402"]);
  console.log("\nRecent historico:"); h.rows.forEach(x => console.log(" ", x.numero, "|", (x.descricao||"").substring(0,50), "|", x.created_at));
  
  await c.end();
}
main().catch(e=>console.error(e.message));
