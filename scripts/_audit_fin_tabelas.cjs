const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const r = await client.query(`
    SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','v') AND (
      c.relname ILIKE '%concili%' OR c.relname ILIKE '%cnab%' OR c.relname ILIKE '%banco%'
      OR c.relname ILIKE '%conta%' OR c.relname ILIKE '%auditoria%' OR c.relname ILIKE '%caixa%'
      OR c.relname ILIKE '%fatura%' OR c.relname ILIKE '%parcela%' OR c.relname ILIKE '%titulo%'
      OR c.relname ILIKE '%romaneio%' OR c.relname ILIKE '%carregamento%' OR c.relname ILIKE '%fechamento%'
      OR c.relname ILIKE '%lote%' OR c.relname ILIKE '%boleto%' OR c.relname ILIKE '%contrato%'
      OR c.relname ILIKE '%pagamento%' OR c.relname ILIKE '%financeiro%' OR c.relname ILIKE '%cobranc%'
    ) ORDER BY c.relname`);
  console.log(r.rows.map(x => `  ${x.relkind==='v'?'[v]':'   '} ${x.relname}`).join('\n'));
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });