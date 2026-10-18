const {Client} = require('pg');
const c = new Client({connectionString:'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',ssl:{rejectUnauthorized:false}});
(async () => {
  await c.connect();
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='pagamentos_prestadores' ORDER BY ordinal_position`);
  console.log('pagamentos_prestadores columns:', r.rows.map(x=>x.column_name).join(', '));
  const r2 = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores WHERE upper(coalesce(obs, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML|SEED' OR upper(coalesce(prestador_nome, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML'`);
  console.log('Test candidates:', r2.rows[0].n);
  await c.end();
})();
