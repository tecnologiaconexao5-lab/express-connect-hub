const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = (await c.query("select id, os_id, prestador, valor, comprovante_url, tenant_id from reembolsos_prestador order by created_at desc limit 10")).rows;
  console.log(JSON.stringify(r, null, 2));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
