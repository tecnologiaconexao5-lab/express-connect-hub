const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 15000 });
  await c.connect();
  const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pagamentos_prestadores' ORDER BY ordinal_position");
  for (const row of r.rows) console.log(row.column_name, ':', row.data_type);
  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
