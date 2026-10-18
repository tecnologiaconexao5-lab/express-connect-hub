const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();

  // ============ FUNCTIONS ============
  console.log('=== FUNCTIONS/RPCs CRITICAS ===\n');

  const funcs = await c.query(`
    SELECT p.proname,
           pg_catalog.pg_get_function_result(p.oid) AS rettype,
           pg_catalog.pg_get_function_arguments(p.oid) AS args,
           p.prokind, p.provolatile, p.prosecdef, p.proacl
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
    console.log(`    acl: ${r.proacl}`);
  });

  // ============ TRIGGERS ============
  console.log('\n\n=== TRIGGERS FINANCEIROS ===\n');

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

  // ============ RLS POLICIES ============
  console.log('\n\n=== RLS POLICIES TABELAS FINANCEIRAS ===\n');

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
    if (r.qual) console.log(`    USING: ${r.qual.substring(0, 150)}`);
    if (r.with_check) console.log(`    CHECK: ${r.with_check.substring(0, 150)}`);
  });

  // ============ MIGRATION HISTORY ============
  console.log('\n\n=== HISTORICO SUPABASE_MIGRATIONS ===\n');

  try {
    const migHist = await c.query(`
      SELECT version, name, hash, created_at
      FROM supabase_migrations.schema_migrations
      ORDER BY version DESC
      LIMIT 60
    `);
    console.log(`Total migrations no historico (ultimas 60): ${migHist.rows.length}`);
    migHist.rows.forEach(r => {
      console.log(`  ${r.version} | ${r.name || '(sem nome)'} | hash=${r.hash ? r.hash.substring(0, 12) : 'null'}`);
    });
  } catch (e) {
    console.log(`Erro: ${e.message}`);
  }

  // ============ DUPLICATE INDEXES ============
  console.log('\n\n=== INDEXES DUPLICADOS ===\n');

  const dupIdx = await c.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (indexname LIKE 'uq_%' OR indexname LIKE '%_os_id%')
    ORDER BY tablename, indexname
  `);
  dupIdx.rows.forEach(r => {
    console.log(`  ${r.tablename}.${r.indexname}`);
  });

  // ============ is_teste COLUMNS ============
  console.log('\n\n=== COLUNAS is_teste ===\n');

  const isTeste = await c.query(`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'is_teste'
    ORDER BY table_name
  `);
  isTeste.rows.forEach(r => {
    console.log(`  ${r.table_name}.${r.column_name}: ${r.data_type} DEFAULT ${r.column_default}`);
  });

  await c.end();
})();
