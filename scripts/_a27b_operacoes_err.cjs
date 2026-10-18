const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const AUTH_ID = 'a5e51631-5ed8-430d-9041-4b185c03d821';

(async () => {
  await client.connect();
  const r = await client.query(
    'SELECT public.f_buscar_operacoes_motorista($1::uuid) AS resp',
    [AUTH_ID]
  );
  console.log(JSON.stringify(r.rows[0].resp, null, 1));
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });