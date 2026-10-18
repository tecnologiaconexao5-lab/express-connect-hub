const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  const r = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_buscar_operacoes_motorista'
  `);
  const def = r.rows[0].def;
  console.log('USA auth.uid():', def.includes('auth.uid()'));
  console.log(def.slice(0, 1200));
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });