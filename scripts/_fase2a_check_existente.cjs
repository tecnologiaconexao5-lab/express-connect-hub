const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  for (const t of ['faturas', 'fatura_itens', 'financeiro_receber']) {
    const r = await client.query(`SELECT to_regclass('public.'||$1) AS cls`, [t]);
    console.log(`${t}: ${r.rows[0].cls || 'NAO EXISTE'}`);
  }
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='financeiro_receber' AND column_name IN ('fatura_id','tenant_id')`);
  console.log('financeiro_receber fatura_id/tenant_id:', cols.rows.map(c=>c.column_name).join(',') || 'nenhuma');
  const rpcs = await client.query(`
    SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND proname IN ('f_emitir_fatura','f_cancelar_fatura','f_gerar_numero_fatura')`);
  console.log('RPCs já existentes:', rpcs.rows.map(r=>r.proname).join(',') || 'nenhuma');
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });