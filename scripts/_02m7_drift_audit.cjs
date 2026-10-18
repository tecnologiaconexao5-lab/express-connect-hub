const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();

  // ============ FASE 1: CRITICAL TABLES SCHEMA ============
  console.log('=== FASE 1 — SCHEMA DAS TABELAS CRITICAS ===\n');

  const criticalTables = [
    'financeiro_pagar', 'financeiro_receber', 'financeiro_baixas',
    'pagamentos_prestadores', 'composicao_financeira_os',
    'ordens_servico', 'alocacoes_escala'
  ];

  for (const t of criticalTables) {
    const cols = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\nTABELA: ${t} (${cols.rows.length} colunas)`);
    cols.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${r.column_default ? 'DEFAULT ' + r.column_default.substring(0, 60) : ''}`);
    });
  }

  // ============ FASE 2: CONSTRAINTS ============
  console.log('\n\n=== FASE 2 — CONSTRAINTS CRITICAS ===\n');

  const constraints = await c.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           kcu.column_name, cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN ('financeiro_pagar','financeiro_receber','financeiro_baixas',
        'pagamentos_prestadores','composicao_financeira_os','ordens_servico','alocacoes_escala')
    ORDER BY tc.table_name, tc.constraint_type
  `);
  constraints.rows.forEach(r => {
    const extra = r.check_clause ? ` (${r.check_clause.substring(0, 100)})` : (r.column_name ? ` (${r.column_name})` : '');
    console.log(`  ${r.table_name}.${r.constraint_name}: ${r.constraint_type}${extra}`);
  });

  // ============ FASE 3: INDEXES ============
  console.log('\n\n=== FASE 3 — INDEXES CRITICOS ===\n');

  const indexes = await c.query(`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('financeiro_pagar','financeiro_receber','financeiro_baixas',
        'pagamentos_prestadores','composicao_financeira_os')
    ORDER BY tablename
  `);
  indexes.rows.forEach(r => {
    console.log(`  ${r.tablename}.${r.indexname}`);
    console.log(`    ${r.indexdef}`);
  });

  // ============ FASE 4: FUNCTIONS (RPCs) ============
  console.log('\n\n=== FASE 4 — FUNCOES/RPCs CRITICAS ===\n');

  const funcs = await c.query(`
    SELECT p.proname, pg_catalog.pg_get_function_result(oid) AS rettype,
           pg_catalog.pg_get_function_arguments(oid) AS args,
           p.prokind, p.provolatile, p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'f_confirmar_pagamento_prestador',
        'f_confirmar_pagamento_fechamento',
        'f_registrar_baixa_financeira',
        'f_estornar_baixa_financeira',
        'f_avancar_etapa_app_motorista',
        'f_buscar_operacoes_motorista',
        'f_atualizar_reversa_app',
        'current_tenant_id_safe',
        'f_trg_propagar_financeiro_escala',
        'f_trg_propagar_financeiro_os',
        'f_trg_cancelar_financeiro_escala'
      )
    ORDER BY p.proname
  `);
  funcs.rows.forEach(r => {
    console.log(`  ${r.proname}`);
    console.log(`    args: ${r.args}`);
    console.log(`    ret: ${r.rettype}`);
    console.log(`    volatile: ${r.provolatile}, secdef: ${r.prosecdef}`);
  });

  // ============ FASE 5: TRIGGERS ============
  console.log('\n\n=== FASE 5 — TRIGGERS FINANCEIROS ===\n');

  const triggers = await c.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND (event_object_table IN ('financeiro_pagar','financeiro_receber','financeiro_baixas',
            'pagamentos_prestadores','composicao_financeira_os','ordens_servico','alocacoes_escala')
           OR trigger_name LIKE '%financeiro%' OR trigger_name LIKE '%propagar%'
           OR trigger_name LIKE '%cancelar%' OR trigger_name LIKE '%pagamento%')
    ORDER BY event_object_table, trigger_name
  `);
  triggers.rows.forEach(r => {
    console.log(`  ${r.event_object_table}.${r.trigger_name}: ${r.action_timing} ${r.event_manipulation}`);
  });

  // ============ FASE 6: RLS POLICIES ============
  console.log('\n\n=== FASE 6 — RLS POLICIES TABELAS FINANCEIRAS ===\n');

  const policies = await c.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('financeiro_pagar','financeiro_receber','financeiro_baixas',
        'pagamentos_prestadores','composicao_financeira_os')
    ORDER BY tablename, policyname
  `);
  policies.rows.forEach(r => {
    console.log(`  ${r.tablename}.${r.policyname}: ${r.cmd} (${r.permissive}) roles=${r.roles}`);
    if (r.qual) console.log(`    USING: ${r.qual.substring(0, 120)}`);
    if (r.with_check) console.log(`    CHECK: ${r.with_check.substring(0, 120)}`);
  });

  // ============ FASE 7: MIGRATION HISTORY ============
  console.log('\n\n=== FASE 7 — HISTORICO SUPABASE_MIGRATIONS ===\n');

  try {
    const migHist = await c.query(`
      SELECT version, name, statements, hash, created_at
      FROM supabase_migrations.schema_migrations
      ORDER BY version DESC
      LIMIT 50
    `);
    console.log(`Total migrations no historico: ${migHist.rows.length}`);
    migHist.rows.forEach(r => {
      console.log(`  ${r.version} | ${r.name || '(sem nome)'} | hash=${r.hash ? r.hash.substring(0, 12) : 'null'}`);
    });
  } catch (e) {
    console.log(`Erro ao consultar historico: ${e.message}`);
  }

  // ============ FASE 8: FINANCEIRO_PAGAR CHECK + UNIQUE ============
  console.log('\n\n=== FASE 8 — CHECKS E UNIQUES FINANCEIRO_PAGAR ===\n');

  const fpChecks = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'financeiro_pagar'::regclass
      AND contype IN ('c', 'u')
    ORDER BY contype, conname
  `);
  fpChecks.rows.forEach(r => {
    console.log(`  ${r.conname}: ${r.def}`);
  });

  // ============ FASE 9: OS UNIQUE ON financeiro_pagar ============
  console.log('\n\n=== FASE 9 — UNIQUE OS_ID EM TODAS TABELAS ===\n');

  for (const t of ['financeiro_pagar', 'financeiro_receber', 'pagamentos_prestadores', 'composicao_financeira_os']) {
    const uq = await c.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'u'
    `, [t]);
    if (uq.rows.length > 0) {
      uq.rows.forEach(r => console.log(`  ${t}.${r.conname}: ${r.def}`));
    } else {
      console.log(`  ${t}: SEM UNIQUE`);
    }
  }

  // ============ FASE 10: RPC SIGNATURES DETALHADAS ============
  console.log('\n\n=== FASE 10 — RPC SIGNATURES DETALHADAS ===\n');

  const rpcDetail = await c.query(`
    SELECT p.proname,
           pg_get_function_arguments(oid) AS args,
           pg_get_function_result(oid) AS ret,
           p.provolatile,
           p.prosecdef,
           p.proacl AS grants,
           obj_description(oid, 'pg_proc') AS comment
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'f_confirmar_pagamento_prestador',
        'f_registrar_baixa_financeira',
        'f_estornar_baixa_financeira'
      )
    ORDER BY p.proname
  `);
  rpcDetail.rows.forEach(r => {
    console.log(`\n  ${r.proname}:`);
    console.log(`    args: ${r.args}`);
    console.log(`    ret: ${r.ret}`);
    console.log(`    volatile: ${r.provolatile}`);
    console.log(`    secdef: ${r.prosecdef}`);
    console.log(`    grants: ${r.grants}`);
    console.log(`    comment: ${r.comment || '(sem)'}`);
  });

  await c.end();
})();
