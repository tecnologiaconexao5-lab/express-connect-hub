const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const r = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clientes'
    ORDER BY ordinal_position`);
  console.log('clientes:', r.rows.map(c=>c.column_name).join(', '));
  const tab = await client.query(`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('contas_financeiras','financeiro_prestador_auditoria','tabelas_valores','clientes_contratos')`);
  console.log('\nexistência:', tab.rows.map(t=>t.relname).join(', '));
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });