const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
(async () => {
  await c.connect();
  const r1 = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='financeiro_pagar' AND column_name='os_id'");
  console.log('FP os_id:', r1.rows[0]);
  const r2 = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pagamentos_prestadores' AND column_name='os_id'");
  console.log('PP os_id:', r2.rows[0]);
  await c.end();
})();
