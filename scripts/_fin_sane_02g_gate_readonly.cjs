// FIN-SANE-02G — GATE FINAL READ-ONLY contra schema REAL de produção
// ZERO WRITES — apenas SELECT e metadados
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRODConnection = {
  host: 'aws-1-sa-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.uwrvzsjtpgaifkktpepn',
  password: 'ConexaoExpress_DB_2026!#',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30000,
};

const results = {};
const report = [];

function log(msg) { report.push(msg); console.log(msg); }

async function q(client, sql, label) {
  try {
    const r = await client.query(sql);
    results[label] = r.rows;
    return r.rows;
  } catch (e) {
    results[label] = [{ error: e.message }];
    log(`  [ERROR] ${label}: ${e.message}`);
    return [{ error: e.message }];
  }
}

async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log('FIN-SANE-02G — GATE FINAL READ-ONLY');
  log(`Data: ${new Date().toISOString()}`);
  log('═══════════════════════════════════════════════════════════════');

  // SHA256
  log('\n═══ 2. SHA256 ═══');
  const fwdPath = path.join(__dirname, '..', 'supabase', 'migrations_lab', '20260913000000_fin_sane_02b_unifica_valor_pagar.sql');
  const rblPath = path.join(__dirname, '..', 'supabase', 'migrations_lab', '20260913000001_fin_sane_02b_rollback.sql');
  const fwdContent = fs.readFileSync(fwdPath);
  const rblContent = fs.readFileSync(rblPath);
  const fwdSha = crypto.createHash('sha256').update(fwdContent).digest('hex');
  const rblSha = crypto.createHash('sha256').update(rblContent).digest('hex');
  log(`FORWARD SHA256: ${fwdSha}`);
  log(`ROLLBACK SHA256: ${rblSha}`);

  const client = new Client(PRODConnection);
  await client.connect();
  log('\n═══ Conexão OK ═══');

  // 1. Migration history
  log('\n═══ 1. MIGRATION HISTORY ═══');
  await q(client, `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 30`, 'migration_history');
  const mh = results['migration_history'];
  const has02B = mh.some(r => r.version === '20260913000000' || (r.name && r.name.includes('fin_sane_02b')));
  const has02F = mh.some(r => r.version === '20260913000001' || (r.name && r.name.includes('fin_sane_02f')));
  log(`02B aplicada produção: ${has02B ? 'SIM ⚠️ BLOCKED' : 'NÃO ✓'}`);
  log(`02F aplicada produção: ${has02F ? 'SIM ⚠️ BLOCKED' : 'NÃO ✓'}`);
  // Also check for any fin_sane related migrations
  const finSanMigs = mh.filter(r => r.version && r.version.includes('20260913'));
  log(`Migrations 20260913: ${finSanMigs.length > 0 ? JSON.stringify(finSanMigs) : 'nenhuma'}`);

  // 3. M66 — Production function
  log('\n═══ 3. M66 — FUNÇÃO REAL DE PRODUÇÃO ═══');
  await q(client, `SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace`, 'm66_real');
  const m66def = results['m66_real'][0]?.def || 'NOT FOUND';
  log(`M66 encontrada: ${m66def !== 'NOT FOUND' ? 'SIM' : 'NÃO'}`);
  if (m66def !== 'NOT FOUND') {
    // Check key behaviors
    const m66has = {
      'criacao_os': m66def.includes('INSERT INTO ordens_servico'),
      'financeiro_receber': m66def.includes('financeiro_receber'),
      'financeiro_pagar': m66def.includes('financeiro_pagar'),
      'pagamentos_prestadores': m66def.includes('pagamentos_prestadores'),
      'composicao_financeira_os': m66def.includes('composicao_financeira_os'),
      'valor_liquido_no_pagar': m66def.includes('v_valor_liquido'),
      'v_valor_prestador_no_pagar': m66def.includes('v_valor_prestador') && m66def.includes('financeiro_pagar'),
      'cliente_lookup': m66def.includes('nome_fantasia'),
      'prestador_lookup': m66def.includes('nome_completo'),
      'reversa': m66def.includes('reversa_valor_cliente'),
      'on_conflict_os': m66def.includes('ON CONFLICT'),
      'to_jsonb': m66def.includes('to_jsonb'),
      'os_id_text_cast': m66def.includes('v_os_id::TEXT') || m66def.includes('v_os_id :: TEXT'),
    };
    for (const [k, v] of Object.entries(m66has)) {
      log(`  ${v ? '✓' : '✗'} ${k}`);
    }
  }

  // 4. M80 — Production function
  log('\n═══ 4. M80 — FUNÇÃO REAL DE PRODUÇÃO ═══');
  await q(client, `SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_os' AND pronamespace = 'public'::regnamespace`, 'm80_real');
  const m80def = results['m80_real'][0]?.def || 'NOT FOUND';
  log(`M80 encontrada: ${m80def !== 'NOT FOUND' ? 'SIM' : 'NÃO'}`);
  if (m80def !== 'NOT FOUND') {
    const m80has = {
      'financeiro_receber': m80def.includes('financeiro_receber'),
      'financeiro_pagar': m80def.includes('financeiro_pagar'),
      'pagamentos_prestadores': m80def.includes('pagamentos_prestadores'),
      'composicao_financeira_os': m80def.includes('composicao_financeira_os'),
      'valor_liquido_no_pagar': m80def.includes('v_valor_liquido'),
      'new_id_text': m80def.includes('NEW.id::TEXT') || m80def.includes('NEW.id :: TEXT'),
      'new_cliente': m80def.includes('NEW.cliente'),
      'new_prestador': m80def.includes('NEW.prestador'),
      'jsonb_typeof': m80def.includes('jsonb_typeof'),
      'security_definer': m80def.includes('SECURITY DEFINER'),
    };
    for (const [k, v] of Object.entries(m80has)) {
      log(`  ${v ? '✓' : '✗'} ${k}`);
    }
  }

  // 5. CLIENTE/PRESTADOR — Schema checks
  log('\n═══ 5. CLIENTE/PRESTADOR — SCHEMA REAL ═══');
  await q(client, `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'ordens_servico' AND column_name IN ('cliente', 'cliente_id', 'prestador', 'prestador_id') ORDER BY ordinal_position`, 'os_cols');
  for (const row of results['os_cols']) {
    log(`  ${row.column_name}: ${row.data_type} (nullable=${row.is_nullable})`);
  }

  // Sample to distinguish UUID vs TEXT
  await q(client, `SELECT cliente::TEXT as cliente_val, cliente_id::TEXT as cliente_id_val, prestador::TEXT as prestador_val, prestador_id::TEXT as prestador_id_val FROM ordens_servico WHERE cliente IS NOT NULL LIMIT 3`, 'os_sample');
  for (const row of results['os_sample']) {
    const clienteIsUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.cliente_val);
    const prestadorIsUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.prestador_val);
    log(`  cliente="${row.cliente_val?.substring(0,30)}" (UUID? ${clienteIsUUID})`);
    log(`  cliente_id="${row.cliente_id_val?.substring(0,30)}"`);
    log(`  prestador="${row.prestador_val?.substring(0,30)}" (UUID? ${prestadorIsUUID})`);
    log(`  prestador_id="${row.prestador_id_val?.substring(0,30)}"`);
    break; // just one sample
  }

  // 6. JSONB check
  log('\n═══ 6. JSONB — ordens_servico ═══');
  await q(client, `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ordens_servico' AND column_name IN ('adicionais', 'ajudante')`, 'os_jsonb');
  for (const row of results['os_jsonb']) {
    log(`  ${row.column_name}: ${row.data_type}`);
  }

  // 7. composicao_financeira_os
  log('\n═══ 7. COMPOSICAO_FINANCEIRA_OS — SCHEMA ═══');
  await q(client, `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' ORDER BY ordinal_position`, 'cfo_cols');
  for (const row of results['cfo_cols']) {
    log(`  ${row.column_name}: ${row.data_type} (nullable=${row.is_nullable})`);
  }
  await q(client, `SELECT conname, contype, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'composicao_financeira_os'::regclass`, 'cfo_constraints');
  for (const row of results['cfo_constraints']) {
    log(`  ${row.contype === 'u' ? 'UNIQUE' : row.contype === 'p' ? 'PK' : 'other'}: ${row.conname} — ${row.def?.substring(0, 120)}`);
  }

  // 8. Duplicação M66→OS→M80 analysis
  log('\n═══ 8. DUPLA PROPAGAÇÃO — ANÁLISE ═══');
  await q(client, `SELECT conname, contype, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid IN ('financeiro_receber'::regclass, 'financeiro_pagar'::regclass, 'pagamentos_prestadores'::regclass) AND contype IN ('u', 'p')`, 'unique_constraints');
  for (const row of results['unique_constraints']) {
    log(`  ${row.conname}: ${row.def?.substring(0, 150)}`);
  }

  // 9. RPC f_confirmar_pagamento_fechamento
  log('\n═══ 9. ATOMICIDADE — RPC ═══');
  await q(client, `SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento' AND pronamespace = 'public'::regnamespace`, 'rpc_def');
  const rpcDef = results['rpc_def'][0]?.def || 'NOT FOUND';
  log(`RPC encontrada: ${rpcDef !== 'NOT FOUND' ? 'SIM' : 'NÃO'}`);
  if (rpcDef !== 'NOT FOUND') {
    const rpcHas = {
      'BEGIN/COMMIT': rpcDef.includes('BEGIN') || rpcDef.includes('DECLARE'),
      'FOR UPDATE': rpcDef.includes('FOR UPDATE'),
      'RAISE EXCEPTION': rpcDef.includes('RAISE EXCEPTION'),
      'ROLLBACK implicito': true, // PL/pgSQL always rolls back on exception
      'REVOKE PUBLIC': false, // check below
      'GRANT authenticated': false,
    };
    // Check grants
    await q(client, `SELECT aclexplode(privileges) as priv FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento'`, 'rpc_grants');
    log(`  Grants: ${JSON.stringify(results['rpc_grants'])}`);
    log(`  RAISE EXCEPTION on cancelado: ${rpcDef.includes("cancelado") ? 'SIM' : 'NÃO'}`);
    log(`  Retornosucesso=false on error: ${rpcDef.includes('sucesso') ? 'SIM' : 'NÃO'}`);
    // Check atomicity
    log(`  Análise de atomicidade:`);
    log(`    Se item cancelado → RAISE EXCEPTION → rollback transacional completo`);
    log(`    Se f_confirmar_pagamento_prestador retorna sucesso=false → EXIT + retorna false (SEM rollback explícito)`);
    log(`    ⚠️ ATENÇÃO: EXIT no loop não provoca RAISE, apenas retorna erro`);
  } else {
    log(`  ⚠️ RPC NÃO EXISTE EM PRODUÇÃO`);
  }

  // 10. Snapshot table
  log('\n═══ 10. SNAPSHOT B1 ═══');
  await q(client, `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'fin_sane_02b_snapshot') as exists_`, 'snap_exists');
  log(`Tabela existe: ${results['snap_exists'][0]?.exists_ ? 'SIM' : 'NÃO'}`);
  if (results['snap_exists'][0]?.exists_) {
    await q(client, `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fin_sane_02b_snapshot' ORDER BY ordinal_position`, 'snap_cols');
    await q(client, `SELECT COUNT(*) as total FROM fin_sane_02b_snapshot`, 'snap_count');
    log(`Registros: ${results['snap_count'][0]?.total}`);
    // DISTINCT ON / ORDER BY analysis
    await q(client, `SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'fin_sane_02b_snapshot'::regclass`, 'snap_constraints');
    for (const row of results['snap_constraints']) {
      log(`  Constraint: ${row.conname} — ${row.def}`);
    }
  }

  // 11. DRY-RUN — pagos sem baixa
  log('\n═══ 11. DRY-RUN — PAGOS SEM BAIXA ═══');
  await q(client, `
    SELECT fp.id, fp.os_id, fp.valor, fp.status, fp.fornecedor_id,
           fp.descricao, fp.data_vencimento
    FROM financeiro_pagar fp
    WHERE COALESCE(fp.status, '') IN ('pago', 'paga')
      AND NOT EXISTS (
        SELECT 1 FROM financeiro_baixas fb
        WHERE fb.financeiro_pagar_id = fp.id
           OR fb.os_id = fp.os_id
      )
    ORDER BY fp.created_at DESC
    LIMIT 20
  `, 'pagos_sem_baixa');
  const psb = results['pagos_sem_baixa'];
  log(`Total pagos sem baixa (amostra): ${psb.length}`);
  for (const row of psb) {
    log(`  ${row.id?.substring(0,8)} | os=${row.os_id?.substring(0,8)} | R$${row.valor} | ${row.status} | ${row.descricao?.substring(0,40)}`);
  }

  // Broader check
  await q(client, `
    SELECT
      COUNT(*) as total_pago,
      COUNT(CASE WHEN NOT EXISTS (
        SELECT 1 FROM financeiro_baixas fb
        WHERE fb.financeiro_pagar_id = fp.id OR fb.os_id = fp.os_id
      ) THEN 1 END) as sem_baixa
    FROM financeiro_pagar fp
    WHERE COALESCE(fp.status, '') IN ('pago', 'paga')
  `, 'pagos_sem_baixa_count');
  const psc = results['pagos_sem_baixa_count'][0];
  log(`TOTAL pago: ${psc?.total_pago}`);
  log(`SEM baixa: ${psc?.sem_baixa}`);

  // Also check: baixas existentes
  await q(client, `SELECT COUNT(*) as total FROM financeiro_baixas`, 'baixas_count');
  log(`Total financeiro_baixas: ${results['baixas_count'][0]?.total}`);

  // 13. RLS / RPC metadata
  log('\n═══ 13. RLS / RPC — METADADOS ═══');
  // Check SECURITY DEFINER on both triggers
  await q(client, `
    SELECT proname, provolatile, prosecdef, proconfig
    FROM pg_proc
    WHERE proname IN ('f_trg_propagar_financeiro_alocacao', 'f_trg_propagar_financeiro_os', 'f_confirmar_pagamento_fechamento')
    ORDER BY proname
  `, 'rpc_security');
  for (const row of results['rpc_security']) {
    log(`  ${row.proname}: SECURITY ${row.prosecdef ? 'DEFINER' : 'INVOKER'}, provolatile=${row.provolatile}`);
  }

  // RLS on key tables
  await q(client, `
    SELECT tablename, rowsecurity, forcerowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('financeiro_pagar', 'financeiro_receber', 'pagamentos_prestadores', 'composicao_financeira_os', 'ordens_servico', 'alocacoes_escala', 'fin_sane_02b_snapshot')
    ORDER BY tablename
  `, 'rls_tables');
  for (const row of results['rls_tables']) {
    log(`  ${row.tablename}: RLS=${row.rowsecurity}, forced=${row.forcerowsecurity}`);
  }

  // Grants on RPC
  await q(client, `
    SELECT p.proname, r.rolname as grantee,
           has_function_privilege(r.oid, p.oid::regproc, 'EXECUTE') as can_execute
    FROM pg_proc p
    CROSS JOIN pg_roles r
    WHERE p.proname = 'f_confirmar_pagamento_fechamento'
      AND r.rolname IN ('anon', 'authenticated', 'service_role')
    ORDER BY r.rolname
  `, 'rpc_grants_detail');
  for (const row of results['rpc_grants_detail']) {
    log(`  ${row.grantee}: EXECUTE=${row.can_execute}`);
  }

  // 14. Rollback comparison — check production M66/M80 differences
  log('\n═══ 14. ROLLBACK — COMPARAÇÃO COM PRODUÇÃO ═══');
  // Compare M66 production vs rollback: check for to_jsonb usage
  const m66_prod_has_jsonb = m66def.includes('to_jsonb');
  const m66_rollback_has_jsonb = rblContent.toString().includes('to_jsonb');
  log(`  M66 produção usa to_jsonb: ${m66_prod_has_jsonb ? 'SIM' : 'NÃO'}`);
  log(`  M66 rollback usa to_jsonb: ${m66_rollback_has_jsonb ? 'SIM' : 'NÃO'}`);

  // Check M80 NEW.cliente vs NEW.cliente_id
  const m80_prod_uses_new_cliente = m80def.includes('NEW.cliente') && !m80def.includes('NEW.cliente_id');
  log(`  M80 produção usa NEW.cliente (não NEW.cliente_id): ${m80_prod_uses_new_cliente ? 'SIM' : 'NÃO'}`);

  // Check financeiro_pagar column types
  await q(client, `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financeiro_pagar' AND column_name IN ('os_id', 'fornecedor_id')`, 'fp_cols');
  for (const row of results['fp_cols']) {
    log(`  financeiro_pagar.${row.column_name}: ${row.data_type}`);
  }

  // Check financeiro_receber column types
  await q(client, `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financeiro_receber' AND column_name IN ('os_id', 'cliente_id')`, 'fr_cols');
  for (const row of results['fr_cols']) {
    log(`  financeiro_receber.${row.column_name}: ${row.data_type}`);
  }

  // Final summary
  log('\n═══════════════════════════════════════════════════════════════');
  log('RESULTADOS EXTRAÍDOS — para análise manual');
  log('═══════════════════════════════════════════════════════════════');

  // Write full results to JSON
  const outPath = path.join(__dirname, '..', '_fin_sane_02g_raw_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  log(`Results JSON: ${outPath}`);

  // Write report
  const reportPath = path.join(__dirname, '..', 'FIN-SANE-02G-FINAL-REAL-SCHEMA-GATE.txt');
  fs.writeFileSync(reportPath, report.join('\n'));
  log(`Report: ${reportPath}`);

  await client.end();
  log('\n═══ Conexão encerrada ═══');
}

main().catch(e => { console.error(e); process.exit(1); });
