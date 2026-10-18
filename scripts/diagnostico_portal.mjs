import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run(label, query) {
  try {
    const res = await pool.query(query);
    console.log('\n==================== ' + label + ' ====================');
    if (res.rows.length === 0) {
      console.log('(0 rows)');
    } else {
      console.table(res.rows);
    }
  } catch (err) {
    console.log('\n==================== ' + label + ' ====================');
    console.log('ERROR: ' + err.message);
  }
}

async function main() {
  await run('1. TABELAS DO PORTAL', [
    "SELECT table_name FROM information_schema.tables",
    "WHERE table_schema='public'",
    "  AND (table_name LIKE 'portal_%'",
    "    OR table_name IN ('clientes','ordens_servico','alocacoes_escala','rotas','rota_paradas','entregas_protocolo','financeiro_receber','vw_app_motorista_operacoes','vw_app_motorista_paradas'))",
    "ORDER BY table_name;"
  ].join('\n'));

  await run('2. CONTAGEM DE LINHAS', [
    "SELECT 'clientes' as tbl, count(*) FROM clientes",
    "UNION ALL SELECT 'ordens_servico', count(*) FROM ordens_servico",
    "UNION ALL SELECT 'alocacoes_escala', count(*) FROM alocacoes_escala",
    "UNION ALL SELECT 'rotas', count(*) FROM rotas",
    "UNION ALL SELECT 'rota_paradas', count(*) FROM rota_paradas",
    "UNION ALL SELECT 'entregas_protocolo', count(*) FROM entregas_protocolo",
    "UNION ALL SELECT 'financeiro_receber', count(*) FROM financeiro_receber",
    "UNION ALL SELECT 'portal_pedidos', count(*) FROM portal_pedidos",
    "UNION ALL SELECT 'portal_notificacoes', count(*) FROM portal_notificacoes",
    "UNION ALL SELECT 'portal_ocorrencias', count(*) FROM portal_ocorrencias",
    "UNION ALL SELECT 'portal_tracking_realtime', count(*) FROM portal_tracking_realtime",
    "UNION ALL SELECT 'rede_oportunidades', count(*) FROM rede_oportunidades",
    "UNION ALL SELECT 'vw_app_motorista_operacoes', count(*) FROM vw_app_motorista_operacoes;"
  ].join('\n'));

  await run('3. POLITICAS RLS', [
    "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual",
    "FROM pg_policies",
    "WHERE tablename IN ('portal_pedidos','portal_ocorrencias','portal_notificacoes','portal_tracking_realtime','portal_avaliacoes','portal_faturas','portal_protocolos','portal_rotas','clientes','ordens_servico','alocacoes_escala','rotas','rota_paradas','entregas_protocolo','financeiro_receber')",
    "ORDER BY tablename, policyname;"
  ].join('\n'));

  await run('4. ROLE ATUAL', "SELECT current_setting('role') as current_role;");

  await run('5A. PORTAL_TRACKING_REALTIME - RESUMO', [
    "SELECT count(*), count(DISTINCT alocacao_id) FROM portal_tracking_realtime;"
  ].join('\n'));

  await run('5B. PORTAL_TRACKING_REALTIME - AMOSTRA', [
    "SELECT * FROM portal_tracking_realtime LIMIT 5;"
  ].join('\n'));

  await run('6A. ROTAS - OS_ID', [
    "SELECT count(*) as total_rotas, count(os_id) as with_os_id FROM rotas;"
  ].join('\n'));

  await run('6B. ROTAS - AMOSTRA', [
    "SELECT * FROM rotas LIMIT 5;"
  ].join('\n'));

  await run('7A. ROTA_PARADAS - RESUMO', [
    "SELECT count(*), count(DISTINCT rota_id) FROM rota_paradas;"
  ].join('\n'));

  await run('7B. ROTA_PARADAS - AMOSTRA', [
    "SELECT * FROM rota_paradas LIMIT 5;"
  ].join('\n'));

  await run('8. VW_APP_MOTORISTA_OPERACOES - AMOSTRA', [
    "SELECT * FROM vw_app_motorista_operacoes LIMIT 5;"
  ].join('\n'));

  await run('9. PORTAL_PEDIDOS - STATUS', [
    "SELECT status, count(*) FROM portal_pedidos GROUP BY status ORDER BY status;"
  ].join('\n'));

  await run('10. ROTAS - CLIENTE_ID', [
    "SELECT count(*) as total, count(cliente_id) as with_cliente FROM rotas;"
  ].join('\n'));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
