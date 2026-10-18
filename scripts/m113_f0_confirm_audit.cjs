const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== FASE 0 — CONFIRMAR EVIDÊNCIAS DA AUDITORIA ===\n');

  // 1. Check "liberar tudo" policies
  console.log('--- 1. Policies "liberar tudo" ---');
  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE qual = '(true)' OR qual = 'true'
    ORDER BY tablename, policyname
  `);
  for (const p of policies.rows) {
    console.log(`  ${p.tablename}: ${p.policyname} (${p.cmd}) roles=${p.roles}`);
  }
  console.log(`  Total: ${policies.rows.length} policies with USING(true)\n`);

  // 2. Check RLS enabled status
  console.log('--- 2. RLS habilitada ---');
  const rls = await client.query(`
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN
      ('clientes','ordens_servico','financeiro_receber','portal_pedidos','portal_notificacoes',
       'portal_ocorrencias','portal_avaliacoes','portal_faturas','portal_protocolos',
       'rotas','rota_paradas','alocacoes_escala','entregas_protocolo','portal_tracking_realtime')
    ORDER BY tablename
  `);
  for (const r of rls.rows) {
    console.log(`  ${r.tablename}: RLS=${r.rowsecurity}`);
  }

  // 3. Check pedidos presos
  console.log('\n--- 3. Pedidos presos ---');
  const pedidos = await client.query(`
    SELECT status, count(*) FROM portal_pedidos GROUP BY status ORDER BY status
  `);
  for (const p of pedidos.rows) {
    console.log(`  ${p.status}: ${p.count}`);
  }

  // 4. Check rotas and rota_paradas
  console.log('\n--- 4. Rotas e paradas ---');
  const rotas = await client.query(`SELECT count(*) FROM rotas`);
  const paradas = await client.query(`SELECT count(*) FROM rota_paradas`);
  console.log(`  rotas: ${rotas.rows[0].count}`);
  console.log(`  rota_paradas: ${paradas.rows[0].count}`);

  // 5. Check portal_tracking_realtime
  console.log('\n--- 5. Tracking realtime ---');
  const tracking = await client.query(`SELECT count(*), count(DISTINCT alocacao_id) as alocacoes FROM portal_tracking_realtime`);
  console.log(`  registros: ${tracking.rows[0].count}, alocacoes distintas: ${tracking.rows[0].alocacoes}`);
  const trackingSample = await client.query(`SELECT * FROM portal_tracking_realtime LIMIT 3`);
  for (const t of trackingSample.rows) {
    console.log(`  ${t.id}: alocacao=${t.alocacao_id}, lat=${t.latitude}, lng=${t.longitude}, status=${t.status}, origem=${t.origem}`);
  }

  // 6. Check tables used by portal vs official
  console.log('\n--- 6. Tabelas duplicadas ---');
  const dupTables = await client.query(`
    SELECT table_name, (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as cols
    FROM information_schema.tables WHERE table_schema='public'
    AND table_name IN ('portal_rotas','portal_faturas','portal_comprovantes','portal_protocolos')
    ORDER BY table_name
  `);
  for (const d of dupTables.rows) {
    const cnt = await client.query(`SELECT count(*) as c FROM "${d.table_name}"`);
    console.log(`  ${d.table_name}: ${cnt.rows[0].c} linhas, ${d.cols} colunas`);
  }

  // 7. Check vw_app_motorista views
  console.log('\n--- 7. Views do App ---');
  const views = await client.query(`
    SELECT viewname, definition FROM pg_views
    WHERE schemaname = 'public' AND viewname LIKE 'vw_app_motorista%'
  `);
  for (const v of views.rows) {
    const cnt = await client.query(`SELECT count(*) as c FROM "${v.viewname}"`);
    console.log(`  ${v.viewname}: ${cnt.rows[0].c} linhas`);
  }

  // 8. Check ordens_servico by status
  console.log('\n--- 8. OS por status ---');
  const os = await client.query(`SELECT status, count(*) FROM ordens_servico GROUP BY status ORDER BY count DESC`);
  for (const o of os.rows) {
    console.log(`  ${o.status}: ${o.count}`);
  }

  await client.end();
  console.log('\n✅ FASE 0 completa');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
