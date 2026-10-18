const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const r = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='faturas'
    ORDER BY ordinal_position`);
  console.log('Colunas de faturas:', r.rows.map(c=>c.column_name).join(', '));
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });