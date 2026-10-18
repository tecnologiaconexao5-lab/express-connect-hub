const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const r = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes' AND column_name='metadata'`);
  console.log('clientes.metadata:', r.rows.length ? 'EXISTE' : 'NAO EXISTE');
  const r2 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes'
    AND column_name IN ('config_financeira','regras_financeiras','preferencias_faturamento')`);
  console.log('clientes JSON financeiro:', r2.rows.length ? r2.rows.map(c=>c.column_name).join(',') : 'nenhum');
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });