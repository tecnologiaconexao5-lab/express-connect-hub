const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = (await c.query("select id, ordem_servico_id, tenant_id from alocacoes_escala where ordem_servico_id is not null and id <> ordem_servico_id limit 1")).rows[0];
  console.log(JSON.stringify(r));
  const os = r ? (await c.query("select id, numero, tenant_id from ordens_servico where id=$1", [r.ordem_servico_id])).rows[0] : null;
  console.log(JSON.stringify(os));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
