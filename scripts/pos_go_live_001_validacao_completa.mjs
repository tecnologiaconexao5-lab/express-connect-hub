/**
 * PÓS GO-LIVE 001 — Validação completa do fluxo operacional
 * 
 * Verifica triggers, RPCs, tabelas, políticas RLS e dados reais
 * para cada etapa do fluxo: Pedido → OS → Escala → Prestador → Tracking → POD → Financeiro
 * 
 * Uso: node scripts/pos_go_live_001_validacao_completa.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL não definida'); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

let passed = 0, failed = 0, warnings = 0;

function ok(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }

async function checkTriggers(table, expectedTriggers) {
  const { rows } = await pool.query(`
    SELECT tgname, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
    WHERE tgrelid = $1::regclass AND NOT tgisinternal
  `, [table]);
  const names = rows.map(r => r.tgname);
  for (const exp of expectedTriggers) {
    if (names.includes(exp)) ok(`Trigger ${exp} em ${table}`);
    else fail(`Trigger ${exp} em ${table} — AUSENTE`);
  }
  return rows;
}

async function checkRPC(rpcName, params) {
  const { rows } = await pool.query(`
    SELECT proname, pronargs, proargtypes::text
    FROM pg_proc WHERE proname = $1
  `, [rpcName]);
  if (rows.length > 0) ok(`RPC ${rpcName} existe`);
  else fail(`RPC ${rpcName} — AUSENTE`);
}

async function main() {
  await pool.connect();
  console.log('✅ Conectado ao Supabase\n');

  // ======================================================================
  // SEÇÃO 1: TABELAS EXISTEM
  // ======================================================================
  console.log('═'.repeat(60));
  console.log('SEÇÃO 1: Tabelas do fluxo operacional');
  console.log('═'.repeat(60));

  const tables = [
    'portal_pedidos', 'ordens_servico', 'alocacoes_escala',
    'entregas_protocolo', 'portal_tracking_realtime', 'eventos_oficiais',
    'financeiro_receber', 'financeiro_pagar', 'pagamentos_prestadores',
    'composicao_financeira_os', 'clientes', 'prestadores'
  ];

  const { rows: existingTables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1)
  `, [tables]);

  const existingNames = existingTables.map(r => r.table_name);
  for (const t of tables) {
    if (existingNames.includes(t)) ok(`Tabela ${t} existe`);
    else fail(`Tabela ${t} — AUSENTE`);
  }

  // ======================================================================
  // SEÇÃO 2: CONTAGEM DE REGISTROS
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 2: Registros nas tabelas');
  console.log('═'.repeat(60));

  const countQueries = tables.filter(t => existingNames.includes(t)).map(t => {
    return pool.query(`SELECT '${t}' AS tbl, COUNT(*)::INT AS qtd FROM ${t}`);
  });
  const countResults = await Promise.all(countQueries);
  for (const res of countResults) {
    const { tbl, qtd } = res.rows[0];
    console.log(`  ${tbl}: ${qtd} registros`);
    if (tbl === 'portal_pedidos' && qtd === 0) warn('Nenhum portal_pedidos — fluxo de pedido não testável');
    if (tbl === 'ordens_servico' && qtd === 0) warn('Nenhuma OS — fluxo operacional não testável');
    if (tbl === 'alocacoes_escala' && qtd === 0) warn('Nenhuma alocação — fluxo de escala não testável');
    if (tbl === 'portal_tracking_realtime' && qtd === 0) warn('Nenhum tracking — GPS não testável');
    if (tbl === 'entregas_protocolo' && qtd === 0) warn('Nenhum POD — finalização não testável');
    if (tbl === 'eventos_oficiais' && qtd === 0) warn('Nenhum evento — Event Bus vazio');
  }

  // ======================================================================
  // SEÇÃO 3: TRIGGERS
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 3: Triggers do fluxo');
  console.log('═'.repeat(60));

  console.log('\n--- alocacoes_escala ---');
  await checkTriggers('alocacoes_escala', [
    'trg_propagar_financeiro_alocacao',
    'trg_evento_prestador_aceitou',
    'trg_evento_operacao_finalizada',
    'trg_cancelar_financeiro_escala'
  ]);

  console.log('\n--- ordens_servico ---');
  await checkTriggers('ordens_servico', [
    'trg_evento_os_criada',
    'trg_evento_os_finalizada',
    'trg_propagar_financeiro_os'
  ]);

  console.log('\n--- portal_pedidos ---');
  await checkTriggers('portal_pedidos', ['trg_evento_portal_pedido_criado']);

  console.log('\n--- portal_tracking_realtime ---');
  await checkTriggers('portal_tracking_realtime', [
    'trg_tracking_iniciado',
    'trg_atualizar_status_alocacao_tracking'
  ]);

  console.log('\n--- eventos_oficiais ---');
  await checkTriggers('eventos_oficiais', ['trg_eventos_oficiais_updated_at']);

  // ======================================================================
  // SEÇÃO 4: RPCs
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 4: RPCs');
  console.log('═'.repeat(60));

  await checkRPC('converter_pedido_para_os');
  await checkRPC('registrar_posicao_motorista');
  await checkRPC('current_tenant_id_safe');
  await checkRPC('gerar_numero_pedido');

  // ======================================================================
  // SEÇÃO 5: RLS POLICIES
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 5: RLS Policies (resumo)');
  console.log('═'.repeat(60));

  const { rows: policies } = await pool.query(`
    SELECT tablename, policyname, cmd, qual IS NULL AS qual_null
    FROM pg_policies
    WHERE tablename = ANY($1)
    ORDER BY tablename, policyname
  `, [tables]);

  const policyByTable = {};
  for (const p of policies) {
    if (!policyByTable[p.tablename]) policyByTable[p.tablename] = [];
    policyByTable[p.tablename].push(p);
  }

  for (const t of tables) {
    const tPolicies = policyByTable[t] || [];
    const anonPolicies = tPolicies.filter(p => p.qual_null);
    console.log(`  ${t}: ${tPolicies.length} policies` +
      (anonPolicies.length > 0 ? ` (${anonPolicies.length} com qual NULL — 🔴 RISCO)` : ''));
    for (const p of tPolicies) {
      if (p.qual_null) warn(`  Policy ${p.policyname} em ${t} tem qual=NULL (acesso irrestrito)`);
    }
  }

  // ======================================================================
  // SEÇÃO 6: ESTRUTURA DAS TABELAS CHAVE
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 6: Colunas críticas');
  console.log('═'.repeat(60));

  // 6a. portal_pedidos
  const { rows: ppCols } = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_pedidos'
    ORDER BY ordinal_position
  `);
  const ppNames = ppCols.map(c => c.column_name);
  const ppExpected = ['os_vinculada_id', 'numero_pedido', 'status', 'cliente_id',
    'coleta_cidade', 'entrega_cidade', 'converted_at', 'erro_processamento',
    'tentativas_processamento'];
  for (const col of ppExpected) {
    if (ppNames.includes(col)) ok(`portal_pedidos.${col}`);
    else fail(`portal_pedidos.${col} — AUSENTE`);
  }

  // 6b. alocacoes_escala
  const { rows: aeCols } = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'alocacoes_escala'
    ORDER BY ordinal_position
  `);
  const aeNames = aeCols.map(c => c.column_name);
  const aeExpected = ['aceite_prestador', 'data_aceite', 'status', 'finalizada',
    'horario_inicio_real', 'horario_fim_real', 'ordem_servico_id',
    'prestador_id', 'cliente_id', 'km_realizados', 'comprovante_url',
    'status_pagamento', 'valor_frete', 'valor_repasse', 'valor_pedagio',
    'valor_adicional', 'valor_ajudante', 'valor_desconto', 'metadata',
    'tipo_reversa', 'reversa_valor_cliente', 'reversa_valor_prestador'];
  for (const col of aeExpected) {
    if (aeNames.includes(col)) ok(`alocacoes_escala.${col}`);
    else fail(`alocacoes_escala.${col} — AUSENTE`);
  }

  // 6c. portal_tracking_realtime
  const { rows: ptrCols } = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
    ORDER BY ordinal_position
  `);
  const ptrNames = ptrCols.map(c => c.column_name);
  const ptrExpected = ['alocacao_id', 'prestador_id', 'latitude', 'longitude',
    'velocidade', 'precisao', 'captured_at', 'created_at', 'tenant_id', 'origem'];
  for (const col of ptrExpected) {
    if (ptrNames.includes(col)) ok(`portal_tracking_realtime.${col}`);
    else fail(`portal_tracking_realtime.${col} — AUSENTE`);
  }

  // 6d. entregas_protocolo
  const { rows: epCols } = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'
    ORDER BY ordinal_position
  `);
  const epNames = epCols.map(c => c.column_name);
  const epExpected = ['alocacao_id', 'nome_recebedor', 'documento_recebedor',
    'foto_entrega_url', 'foto_canhoto_url', 'assinatura_url',
    'data_hora_entrega', 'latitude', 'longitude', 'observacao'];
  for (const col of epExpected) {
    if (epNames.includes(col)) ok(`entregas_protocolo.${col}`);
    else fail(`entregas_protocolo.${col} — AUSENTE`);
  }

  // 6e. eventos_oficiais
  if (existingNames.includes('eventos_oficiais')) {
    const { rows: eoCols } = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'eventos_oficiais'
      ORDER BY ordinal_position
    `);
    const eoNames = eoCols.map(c => c.column_name);
    const eoExpected = ['event_type', 'entity_type', 'entity_id', 'entity_number',
      'payload', 'metadata', 'created_at'];
    for (const col of eoExpected) {
      if (eoNames.includes(col)) ok(`eventos_oficiais.${col}`);
      else fail(`eventos_oficiais.${col} — AUSENTE`);
    }
  }

  // ======================================================================
  // SEÇÃO 7: FUNÇÃO DO TRIGGER DE PROPAGAÇÃO FINANCEIRA
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 7: Verificação da função de propagação financeira');
  console.log('═'.repeat(60));

  const { rows: funcDef } = await pool.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao'
  `);
  if (funcDef.length > 0) {
    const body = funcDef[0].prosrc;
    ok('f_trg_propagar_financeiro_alocacao existe');
    if (body.includes('EXCEPTION')) ok('  Tem EXCEPTION handler (não quebra alocação)');
    else fail('  SEM EXCEPTION handler — 🔴 RISCO de quebrar INSERT da alocação');
    if (body.includes('ON CONFLICT')) ok('  Usa ON CONFLICT (idempotente)');
    else fail('  SEM ON CONFLICT — 🔴 RISCO de duplicidade');
    if (body.includes('outros_custos')) ok('  Fórmula unificada de custos');
    if (body.includes('reversa')) ok('  Inclui reversa nos totais');
    if (body.includes('margem_bruta')) ok('  Calcula margens');
  } else {
    fail('f_trg_propagar_financeiro_alocacao — AUSENTE');
  }

  // ======================================================================
  // SEÇÃO 8: AMOSTRA DE DADOS REAIS
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 8: Amostras de dados para verificação');
  console.log('═'.repeat(60));

  // Alocações recentes com status
  if (existingNames.includes('alocacoes_escala')) {
    const { rows: aloc } = await pool.query(`
      SELECT id, status, finalizada, aceite_prestador, prestador_id IS NOT NULL AS tem_prestador,
             cliente_id IS NOT NULL AS tem_cliente, ordem_servico_id IS NOT NULL AS tem_os,
             valor_frete, valor_repasse, created_at
      FROM alocacoes_escala ORDER BY created_at DESC LIMIT 5
    `);
    console.log(`  Últimas 5 alocações:`);
    for (const a of aloc) {
      console.log(`    ${a.id.slice(0,8)}... | status=${a.status} | finalizada=${a.finalizada} | aceite=${a.aceite_prestador} | prest=${a.tem_prestador} | cli=${a.tem_cliente} | os=${a.tem_os} | frete=${a.valor_frete} | repasse=${a.valor_repasse}`);
    }
  }

  // Financeiro gerado por trigger
  if (existingNames.includes('financeiro_receber')) {
    const { rows: fin } = await pool.query(`
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'aberto') AS abertos,
             COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
             COUNT(*) FILTER (WHERE status = 'pago') AS pagos
      FROM financeiro_receber
    `);
    console.log(`  Financeiro Receber: ${fin[0].total} total (${fin[0].abertos} abertos, ${fin[0].pendentes} pendentes, ${fin[0].pagos} pagos)`);
  }

  if (existingNames.includes('financeiro_pagar')) {
    const { rows: finPag } = await pool.query(`
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'aberto') AS abertos
      FROM financeiro_pagar
    `);
    console.log(`  Financeiro Pagar: ${finPag[0].total} total (${finPag[0].abertos} abertos)`);
  }

  // Eventos do Event Bus
  if (existingNames.includes('eventos_oficiais')) {
    const { rows: ev } = await pool.query(`
      SELECT event_type, COUNT(*) FROM eventos_oficiais
      GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 10
    `);
    console.log(`  Eventos (top 10 tipos):`);
    for (const e of ev) {
      console.log(`    ${e.event_type}: ${e.count}`);
    }
  }

  // ======================================================================
  // SEÇÃO 9: VERIFICAÇÃO DE UNIQUE CONSTRAINTS
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log('SEÇÃO 9: Constraints únicas (proteção contra duplicidade)');
  console.log('═'.repeat(60));

  const { rows: constraints } = await pool.query(`
    SELECT conrelid::regclass::text AS tbl, conname, contype
    FROM pg_constraint
    WHERE conrelid::regclass::text = ANY($1)
      AND contype IN ('u', 'p')
    ORDER BY tbl, conname
  `, [tables.filter(t => existingNames.includes(t))]);

  const constraintByTable = {};
  for (const c of constraints) {
    if (!constraintByTable[c.tbl]) constraintByTable[c.tbl] = [];
    constraintByTable[c.tbl].push(c.conname);
  }

  const uniqueChecks = [
    ['financeiro_pagar', 'uq_fp_os_id'],
    ['composicao_financeira_os', 'composicao_financeira_os_os_id_key'],
    ['portal_pedidos', 'idx_portal_pedidos_os_vinculada_unique']
  ];

  for (const [table, constraint] of uniqueChecks) {
    const tblConstraints = constraintByTable[table] || [];
    if (tblConstraints.some(c => c.includes(constraint.replace(/^.*_/, '')) || c.includes(constraint))) {
      ok(`UNIQUE em ${table} — proteção contra duplicidade`);
    } else {
      // Check more broadly
      const osIdKeys = tblConstraints.filter(c => c.includes('os_id'));
      if (osIdKeys.length > 0) {
        ok(`UNIQUE em ${table} via ${osIdKeys[0]}`);
      } else {
        warn(`${table}: verificar constraint UNIQUE(os_id) — pode permitir duplicatas`);
      }
    }
  }

  // ======================================================================
  // RESUMO
  // ======================================================================
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed} ✅ | ${failed} ❌ | ${warnings} ⚠️`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log(`\n🔴 ${failed} falhas críticas — fluxo operacional comprometido`);
  } else if (warnings > 0) {
    console.log(`\n🟡 ${warnings} warnings — verificar antes de homologar`);
  } else {
    console.log(`\n🟢 Todas as verificações passaram`);
  }

  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
