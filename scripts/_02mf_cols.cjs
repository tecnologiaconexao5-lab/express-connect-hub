const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
(async () => {
  await c.connect();
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pagamentos_prestadores' ORDER BY ordinal_position");
  console.log('PP COLUMNS:', r.rows.map(x => x.column_name).join(', '));
  
  const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'prestadores' ORDER BY ordinal_position");
  console.log('PREST COLUMNS:', r2.rows.map(x => x.column_name).join(', '));
  
  const r3 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'financeiro_pagar' ORDER BY ordinal_position");
  console.log('FP COLUMNS:', r3.rows.map(x => x.column_name).join(', '));
  
  await c.end();
})();
