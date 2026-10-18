const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='portal_notificacoes'
    ORDER BY ordinal_position`);
  console.log('Colunas de portal_notificacoes:');
  cols.rows.forEach(r => process.stdout.write(` ${r.column_name}`));
  console.log('\n');
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });