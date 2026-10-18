require("dotenv").config({path:".env"});
const {Client} = require("pg");
async function main() {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  // Check alocacoes linked to client OS
  const r = await c.query(`
    SELECT a.id, a.status, a.cliente_id, a.ordem_servico_id, a.aceite_prestador, a.finalizada, o.numero, o.status as os_status
    FROM alocacoes_escala a 
    JOIN ordens_servico o ON o.id = a.ordem_servico_id
    WHERE o.cliente_id = $1
    LIMIT 15
  `, ["cd463c93-5190-408e-b5e6-ee639b688402"]);
  console.log("Alocacoes linked to client OS:");
  for (const x of r.rows) console.log(`  ${x.numero} | aloc_status=${x.status} | cliente_id=${x.cliente_id} | aceite=${x.aceite_prestador} | finalizada=${x.finalizada}`);
  await c.end();
}
main().catch(console.error);
