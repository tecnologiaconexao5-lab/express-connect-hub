const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  for (const t of ['contas_financeiras','financeiro_prestador_auditoria','composicao_financeira_os','delivery_proofs','os_pod','operation_km','historico_alocacoes_escala','os_historico','eventos_oficiais','fiscal_events','fiscal_logs','fiscal_historico_status','vw_noc_operacional']) {
    const r = await client.query(`SELECT to_regclass('public.'||$1) AS cls`, [t]);
    console.log(`  ${t}: ${r.rows[0].cls || 'NAO EXISTE'}`);
  }
  // RLS policies em financeiro_receber/pagar/pagamentos_prestadores
  console.log('\n=== RLS POLICIES financeiro ===');
  const p = await client.query(`
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('financeiro_receber','financeiro_pagar','pagamentos_prestadores','alocacoes_escala','ordens_servico','composicao_financeira_os')
    ORDER BY tablename, policyname`);
  p.rows.forEach(r => console.log(`  ${r.tablename}: ${r.policyname} [${r.cmd}]`));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });