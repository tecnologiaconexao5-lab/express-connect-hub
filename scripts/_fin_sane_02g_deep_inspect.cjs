const { Client } = require('pg');
const c = new Client({host:'aws-1-sa-east-1.pooler.supabase.com',port:5432,database:'postgres',user:'postgres.uwrvzsjtpgaifkktpepn',password:'ConexaoExpress_DB_2026!#',ssl:{rejectUnauthorized:false},statement_timeout:30000});
(async()=>{
  await c.connect();

  // Get FULL M66 function
  const r66 = await c.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace");
  console.log('=== M66 FULL ===');
  console.log(r66.rows[0]?.def);
  console.log('=== END M66 ===');

  // Get FULL M80 function
  const r80 = await c.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_os' AND pronamespace = 'public'::regnamespace");
  console.log('=== M80 FULL ===');
  console.log(r80.rows[0]?.def);
  console.log('=== END M80 ===');

  // Check all ordens_servico columns
  const osCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ordens_servico' ORDER BY ordinal_position");
  console.log('ordens_servico columns:');
  for (const r of osCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Check financeiro_baixas columns
  const baixCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financeiro_baixas' ORDER BY ordinal_position");
  console.log('financeiro_baixas columns:');
  for (const r of baixCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Check pagamentos_prestadores columns
  const ppCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pagamentos_prestadores' ORDER BY ordinal_position");
  console.log('pagamentos_prestadores columns:');
  for (const r of ppCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Check financeiro_pagar columns
  const fpCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financeiro_pagar' ORDER BY ordinal_position");
  console.log('financeiro_pagar columns:');
  for (const r of fpCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Check financeiro_receber columns
  const frCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financeiro_receber' ORDER BY ordinal_position");
  console.log('financeiro_receber columns:');
  for (const r of frCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Check composicao_financeira_os columns
  const cfoCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' ORDER BY ordinal_position");
  console.log('composicao_financeira_os columns:');
  for (const r of cfoCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Snapshot
  const snap = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'fin_sane_02b_snapshot') as e");
  console.log('fin_sane_02b_snapshot exists:', snap.rows[0].e);

  // RPC
  const rpc = await c.query("SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento') as e");
  console.log('f_confirmar_pagamento_fechamento exists:', rpc.rows[0].e);

  // Check trigger definitions on tables
  const triggers = await c.query("SELECT event_object_table, trigger_name, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table IN ('alocacoes_escala','ordens_servico') ORDER BY event_object_table, trigger_name");
  console.log('Triggers:');
  for (const r of triggers.rows) console.log('  ' + r.event_object_table + '.' + r.trigger_name + ': ' + r.action_statement?.substring(0, 100));

  // Pagos sem baixa - check baixas table structure first
  const psb = await c.query("SELECT fp.id, fp.os_id, fp.valor, fp.status, fp.fornecedor_id, fp.descricao FROM financeiro_pagar fp WHERE COALESCE(fp.status, '') IN ('pago','paga') AND NOT EXISTS (SELECT 1 FROM financeiro_baixas fb WHERE fb.os_id = fp.os_id) ORDER BY fp.created_at DESC LIMIT 20");
  console.log('Pagos sem baixa (sample):', psb.rows.length);
  for (const r of psb.rows) console.log('  ' + (r.id||'').substring(0,8) + ' | os=' + (r.os_id||'').substring(0,8) + ' | R$' + r.valor + ' | ' + r.status);

  // Count
  const cnt = await c.query("SELECT COUNT(*) as total FROM financeiro_pagar WHERE COALESCE(status,'') IN ('pago','paga')");
  const cnt2 = await c.query("SELECT COUNT(*) as total FROM financeiro_pagar fp WHERE COALESCE(fp.status,'') IN ('pago','paga') AND NOT EXISTS (SELECT 1 FROM financeiro_baixas fb WHERE fb.os_id = fp.os_id)");
  console.log('Total pago:', cnt.rows[0].total, '| sem baixa:', cnt2.rows[0].total);

  // Sample alocacao with prestador_id type
  const alocSample = await c.query("SELECT id::TEXT, prestador_id::TEXT, cliente_id::TEXT, ordem_servico_id::TEXT FROM alocacoes_escala WHERE prestador_id IS NOT NULL LIMIT 2");
  console.log('Alocacao samples:');
  for (const r of alocSample.rows) console.log('  id=' + r.id?.substring(0,8) + ' prestador_id=' + r.prestador_id?.substring(0,40) + ' cliente_id=' + r.cliente_id?.substring(0,40) + ' os_id=' + r.ordem_servico_id?.substring(0,40));

  // Check if prestador_id is UUID or TEXT in alocacoes_escala
  const alocCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'alocacoes_escala' AND column_name IN ('prestador_id','cliente_id','ordem_servico_id')");
  console.log('Alocacao key columns:');
  for (const r of alocCols.rows) console.log('  ' + r.column_name + ': ' + r.data_type);

  // Check RLS on key tables
  const rls = await c.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('financeiro_pagar','financeiro_receber','pagamentos_prestadores','composicao_financeira_os','ordens_servico','alocacoes_escala')");
  console.log('RLS:');
  for (const r of rls.rows) console.log('  ' + r.tablename + ': ' + (r.rowsecurity ? 'ON' : 'OFF'));

  // RPC grants
  const grants = await c.query("SELECT p.proname, r.rolname FROM pg_proc p CROSS JOIN pg_roles r WHERE p.proname = 'f_confirmar_pagamento_fechamento' AND r.rolname IN ('anon','authenticated','service_role')");
  console.log('RPC grants:', grants.rows.length > 0 ? JSON.stringify(grants.rows) : 'RPC not found');

  await c.end();
})().catch(e=>{console.error(e);process.exit(1)});
