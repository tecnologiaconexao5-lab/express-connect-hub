const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  for (const t of ['pagamento_prestadores', 'pagamentos_prestadores']) {
    const r = await c.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    );
    console.log('=== ' + t + ' (' + r.rows.length + ' cols) ===');
    if (!r.rows.length) console.log('  SEM COLUNAS');
    r.rows.forEach((x) =>
      console.log('  ' + x.column_name + ': ' + x.data_type + (x.is_nullable === 'NO' ? ' NOT NULL' : '') + (x.column_default ? ' DEFAULT ' + x.column_default : ''))
    );
    console.log('');
  }
  await c.end();
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });