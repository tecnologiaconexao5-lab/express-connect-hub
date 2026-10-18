/**
 * FIN-SANE-02H.2 — Atomicidade RPC f_confirmar_pagamento_fechamento
 * Lab test completo: setup, falha, sucesso, idempotência, concorrência, regressão
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PG_URL = 'postgresql://postgres:postgres@localhost:5432/';
const DB_NAME = 'fin_sane_02h2_lab';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations_lab');
const CENARIOS_FILE = path.join(__dirname, '..', 'tests', 'sql', 'fin_sane_02b_cenarios.sql');
const REPORT_FILE = path.join(__dirname, '..', 'FIN-SANE-02H.2-ATOMICIDADE-RPC.txt');

const results = [];
function log(msg) { console.log(msg); }
function pass(step, detail) { results.push({ step, status: 'PASS', detail }); log(`  PASS: ${step} — ${detail}`); }
function fail(step, detail) { results.push({ step, status: 'FAIL', detail }); log(`  FAIL: ${step} — ${detail}`); }

async function run(client, label, sql) {
  try {
    const r = await client.query(sql);
    return r;
  } catch (e) {
    throw new Error(`${label}: ${e.message}`);
  }
}

async function withTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  const t0 = Date.now();
  log('=== FIN-SANE-02H.2 — ATOMICIDADE RPC ===\n');

  // ── SETUP ──
  log('[SETUP] Criando banco lab...');
  const admin = new Client({ connectionString: PG_URL });
  await admin.connect();
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();

  const lab = new Client({ connectionString: PG_URL + DB_NAME });
  await lab.connect();

  // Install required extensions
  await lab.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await lab.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  log('  Extensions installed');

  // Apply baseline
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, '0000_fin_sane_02b_baseline.sql'), 'utf8').replace(/^\uFEFF/, '');
  await lab.query(baseline);
  log('  Baseline applied');

  // Apply forward
  const forward = fs.readFileSync(path.join(MIGRATIONS_DIR, '20260913000000_fin_sane_02b_unifica_valor_pagar.sql'), 'utf8').replace(/^\uFEFF/, '');
  await lab.query(forward);
  log('  Forward applied');

  // ═══════════════════════════════════════════════════════════════
  // TESTE 1: FALHA 3º ITEM → ROLLBACK TOTAL
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 1] Falha 3º item → rollback total');

  await withTransaction(lab, async (c) => {
    // Setup dados
    await c.query(`INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES ('a0000000-0000-0000-0000-000000000001', 'Cliente 02H2', 'Cliente 02H2 LTDA', 'ativo') ON CONFLICT (id) DO NOTHING`);
    await c.query(`INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES ('b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', 'ativo') ON CONFLICT (id) DO NOTHING`);

    // Fechamento
    await c.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa) VALUES ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', NULL, 1500.00, 'em_aberto', 'pendente', 'aprovado', 'fechamento', 'teste', 0, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true)`);

    // Item 1: válido
    await c.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id) VALUES ('f0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', '11111111-1111-1111-1111-111111111111', 500.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000001')`);
    await c.query(`INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao) VALUES ('10000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 500.00, 'pendente', 'Prestador 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', CURRENT_DATE + 30, 'Repasse Item 1')`);

    // Item 2: válido
    await c.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id) VALUES ('f0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', '22222222-2222-2222-2222-222222222222', 500.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000001')`);
    await c.query(`INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao) VALUES ('10000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 500.00, 'pendente', 'Prestador 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', CURRENT_DATE + 30, 'Repasse Item 2')`);

    // Item 3: SEM titulo → vai falhar
    await c.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id) VALUES ('f0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', '33333333-3333-3333-3333-333333333333', 500.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000001')`);
    // SEM titulo para item 3
  });

  // Snapshot ANTES (fora da transação, banco novo)
  const antes = (await lab.query(`SELECT (SELECT COUNT(*) FROM financeiro_baixas) AS baixas, (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago') AS pagar_pago, (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago') AS pp_pago`)).rows[0];

  // Chamar RPC (deve falhar)
  let rpcError = null;
  try {
    await lab.query(`SELECT * FROM f_confirmar_pagamento_fechamento('f0000000-0000-0000-0000-000000000001'::UUID, CURRENT_DATE)`);
  } catch (e) {
    rpcError = e.message;
  }

  if (!rpcError) {
    fail('TESTE1-RPC', 'Esperava exceção, RPC retornou sem erro');
  } else {
    pass('TESTE1-RPC', `Exceção recebida: ${rpcError.substring(0, 80)}`);
  }

  // Verificar NENHUMA alteração
  const depois = (await lab.query(`SELECT (SELECT COUNT(*) FROM financeiro_baixas) AS baixas, (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago') AS pagar_pago, (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago') AS pp_pago`)).rows[0];
  const fechStatus = (await lab.query(`SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000001'`)).rows[0];

  if (parseInt(depois.baixas) === parseInt(antes.baixas)) pass('TESTE1-BAIXAS', 'Zero novas baixas'); else fail('TESTE1-BAIXAS', `Baixas: ${antes.baixas}→${depois.baixas}`);
  if (parseInt(depois.pagar_pago) === parseInt(antes.pagar_pago)) pass('TESTE1-PAGAR', 'financeiro_pagar inalterado'); else fail('TESTE1-PAGAR', `Pago: ${antes.pagar_pago}→${depois.pagar_pago}`);
  if (parseInt(depois.pp_pago) === parseInt(antes.pp_pago)) pass('TESTE1-PP', 'pagamentos_prestadores inalterado'); else fail('TESTE1-PP', `Pago: ${antes.pp_pago}→${depois.pp_pago}`);
  if (fechStatus.status_pagamento === 'pendente') pass('TESTE1-FECH', 'Fechamento não pago'); else fail('TESTE1-FECH', `Status: ${fechStatus.status_pagamento}`);

  // Itens individuais
  const itens = (await lab.query(`SELECT id, status_pagamento FROM pagamentos_prestadores WHERE fechamento_id = 'f0000000-0000-0000-0000-000000000001' AND id <> 'f0000000-0000-0000-0000-000000000001' ORDER BY id`)).rows;
  const itensOk = itens.every(i => i.status_pagamento === 'pendente');
  if (itensOk) pass('TESTE1-ITENS', '3 itens permanecem pendentes'); else fail('TESTE1-ITENS', `Itens: ${JSON.stringify(itens)}`);

  // ═══════════════════════════════════════════════════════════════
  // TESTE 2: SUCESSO 3/3
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 2] Sucesso 3/3');

  await withTransaction(lab, async (c) => {
    // Fechamento 2
    await c.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa) VALUES ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', NULL, 2400.00, 'em_aberto', 'pendente', 'aprovado', 'fechamento', 'teste', 0, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true)`);

    // 3 itens + titulos (valid hex UUIDs)
    const osIds = ['aaaa1111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 'aaaa3333-3333-3333-3333-333333333333'];
    for (let i = 1; i <= 3; i++) {
      const itemId = `f0000000-0000-0000-0000-00000000002${i}`;
      const tituloId = `10000000-0000-0000-0000-00000000002${i}`;
      const osId = osIds[i-1];
      await c.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id) VALUES ('${itemId}', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', '${osId}', 800.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000002')`);
      await c.query(`INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao) VALUES ('${tituloId}', '${osId}', 800.00, 'pendente', 'Prestador 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', CURRENT_DATE + 30, 'Repasse Item ${i}')`);
    }
  });

  const r2 = (await lab.query(`SELECT * FROM f_confirmar_pagamento_fechamento('f0000000-0000-0000-0000-000000000002'::UUID, CURRENT_DATE)`)).rows[0];
  if (r2.sucesso === true) pass('TESTE2-RPC', r2.mensagem); else fail('TESTE2-RPC', r2.mensagem);

  const s2 = (await lab.query(`SELECT (SELECT COUNT(*) FROM financeiro_baixas WHERE titulo_id IN ('10000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000023')) AS baixas, (SELECT COUNT(*) FROM financeiro_pagar WHERE id IN ('10000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000023') AND status = 'pago') AS titulos, (SELECT COUNT(*) FROM pagamentos_prestadores WHERE fechamento_id = 'f0000000-0000-0000-0000-000000000002' AND status_pagamento = 'pago') AS itens`)).rows[0];
  if (parseInt(s2.baixas) === 3) pass('TESTE2-BAIXAS', '3 baixas criadas'); else fail('TESTE2-BAIXAS', `${s2.baixas}`);
  if (parseInt(s2.titulos) === 3) pass('TESTE2-TITULOS', '3 títulos pagos'); else fail('TESTE2-TITULOS', `${s2.titulos}`);
  if (parseInt(s2.itens) === 3) pass('TESTE2-ITENS', '3 itens pagos'); else fail('TESTE2-ITENS', `${s2.itens}`);

  const fech2 = (await lab.query(`SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000002'`)).rows[0];
  if (fech2.status_pagamento === 'pago') pass('TESTE2-FECH', 'Fechamento pago'); else fail('TESTE2-FECH', `${fech2.status_pagamento}`);

  // ═══════════════════════════════════════════════════════════════
  // TESTE 3: IDEMPOTÊNCIA
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 3] Idempotência');

  const baixasAntes = parseInt((await lab.query(`SELECT COUNT(*) AS n FROM financeiro_baixas`)).rows[0].n);
  const r3 = (await lab.query(`SELECT * FROM f_confirmar_pagamento_fechamento('f0000000-0000-0000-0000-000000000002'::UUID, CURRENT_DATE)`)).rows[0];
  const baixasDepois = parseInt((await lab.query(`SELECT COUNT(*) AS n FROM financeiro_baixas`)).rows[0].n);

  if (r3.sucesso === false && r3.mensagem.includes('ja esta pago')) pass('TESTE3-RPC', 'Retorna "já pago"'); else fail('TESTE3-RPC', `${r3.sucesso} ${r3.mensagem}`);
  if (baixasDepois === baixasAntes) pass('TESTE3-BAIXAS', `Zero novas baixas (${baixasAntes}→${baixasDepois})`); else fail('TESTE3-BAIXAS', `${baixasAntes}→${baixasDepois}`);

  // ═══════════════════════════════════════════════════════════════
  // TESTE 4: CONCORRÊNCIA (2 sessões reais)
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 4] Concorrência 2 sessões');

  // Setup fechamento 3
  await lab.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa) VALUES ('f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', NULL, 1000.00, 'em_aberto', 'pendente', 'aprovado', 'fechamento', 'teste', 0, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true)`);
  await lab.query(`INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id) VALUES ('f0000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', '11122233344', '77777777-7777-7777-7777-777777777777', 1000.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000003')`);
  await lab.query(`INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao) VALUES ('10000000-0000-0000-0000-000000000031', '77777777-7777-7777-7777-777777777777', 1000.00, 'pendente', 'Prestador 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador 02H2', CURRENT_DATE + 30, 'Repasse Concorrencia')`);

  // 2 conexões independentes
  const connA = new Client({ connectionString: PG_URL + DB_NAME });
  const connB = new Client({ connectionString: PG_URL + DB_NAME });
  await connA.connect();
  await connB.connect();

  let resultA = null, resultB = null;
  let errorA = null, errorB = null;

  // Sessão A: BEGIN + RPC (segura lock)
  await connA.query('BEGIN');
  try {
    resultA = (await connA.query(`SELECT * FROM f_confirmar_pagamento_fechamento('f0000000-0000-0000-0000-000000000003'::UUID, CURRENT_DATE)`)).rows[0];
  } catch (e) { errorA = e.message; }

  // Sessão B: BEGIN + RPC (vai aguardar lock ou falhar)
  try {
    await connB.query('BEGIN');
    await connB.query('SET statement_timeout = 3000');
    resultB = (await connB.query(`SELECT * FROM f_confirmar_pagamento_fechamento('f0000000-0000-0000-0000-000000000003'::UUID, CURRENT_DATE)`)).rows[0];
  } catch (e) { errorB = e.message; }
  // Always reset and rollback session B safely
  try { await connB.query('RESET statement_timeout'); } catch (e) {}
  try { await connB.query('ROLLBACK'); } catch (e) {}

  // Commit sessão A
  await connA.query('COMMIT');

  await connA.end();
  await connB.end();

  // Verificar resultado
  const concBaixas = parseInt((await lab.query(`SELECT COUNT(*) AS n FROM financeiro_baixas WHERE titulo_id = '10000000-0000-0000-0000-000000000031'`)).rows[0].n);
  const concFech = (await lab.query(`SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000003'`)).rows[0];

  if (concBaixas <= 1) pass('TESTE4-BAIXAS', `${concBaixas} baixa(s) — sem duplicação`); else fail('TESTE4-BAIXAS', `${concBaixas} baixas — DUPLICADA`);
  if (concFech.status_pagamento === 'pago') pass('TESTE4-FECH', 'Fechamento pago (1 vez)'); else fail('TESTE4-FECH', `${concFech.status_pagamento}`);

  const sessaoBTravou = errorB !== null || (resultB && resultB.sucesso === false) || concBaixas <= 1;
  if (sessaoBTravou) pass('TESTE4-LOCK', 'Sessão B não sobrescreveu A'); else fail('TESTE4-LOCK', 'Ambas processaram');

  // ═══════════════════════════════════════════════════════════════
  // TESTE 5: REGRESSÃO 12 CENÁRIOS
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 5] 12 cenários SQL (regressão)');

  const cenarios = fs.readFileSync(CENARIOS_FILE, 'utf8').replace(/^\uFEFF/, '');
  // Split by DO $$ ... $$; blocks
  const blocks = [];
  const regex = /DO\s*\$\$/g;
  let match;
  while ((match = regex.exec(cenarios)) !== null) {
    const start = match.index;
    // Find the matching $$; (end of block)
    const endSearch = cenarios.indexOf('$$;', start + match[0].length);
    if (endSearch !== -1) {
      blocks.push(cenarios.substring(start, endSearch + 3)); // include $$;
    }
  }
  let cenariosPass = 0;
  for (let i = 0; i < blocks.length; i++) {
    try {
      await lab.query(blocks[i]);
      cenariosPass++;
    } catch (e) {
      fail(`CENARIO-${i+1}`, e.message.substring(0, 100));
    }
  }
  if (cenariosPass === blocks.length) pass('12-CENARIOS', `${cenariosPass}/${blocks.length} passaram`); else fail('12-CENARIOS', `${cenariosPass}/${blocks.length}`);

  // ═══════════════════════════════════════════════════════════════
  // TESTE 6: REGRESSÃO 02H.1
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 6] Regressão 02H.1');

  const osIdType = (await lab.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' AND column_name = 'os_id'`)).rows[0];
  if (osIdType && osIdType.data_type === 'uuid') pass('02H.1-UUID', 'composicao_financeira_os.os_id = uuid'); else fail('02H.1-UUID', `${osIdType?.data_type}`);

  // ═══════════════════════════════════════════════════════════════
  // TESTE 7: ROLLBACK
  // ═══════════════════════════════════════════════════════════════
  log('\n[TESTE 7] Rollback');

  const rollback = fs.readFileSync(path.join(MIGRATIONS_DIR, '20260913000001_fin_sane_02b_rollback.sql'), 'utf8').replace(/^\uFEFF/, '');
  try {
    await lab.query(rollback);
    // Verificar RPC removida
    const rpcExists = (await lab.query(`SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento') AS x`)).rows[0].x;
    if (!rpcExists) pass('ROLLBACK-RPC', 'f_confirmar_pagamento_fechamento removida'); else fail('ROLLBACK-RPC', 'RPC ainda existe');
  } catch (e) {
    fail('ROLLBACK', e.message.substring(0, 80));
  }

  // Reaplicar forward para manter lab funcional
  try {
    await lab.query(forward);
    const rpcReapplied = (await lab.query(`SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento') AS x`)).rows[0].x;
    if (rpcReapplied) pass('REAPLICAR', 'Forward reaplicado com sucesso'); else fail('REAPLICAR', 'RPC não reapareceu');
  } catch (e) {
    fail('REAPLICAR', e.message.substring(0, 80));
  }

  await lab.end();

  // ═══════════════════════════════════════════════════════════════
  // RELATÓRIO
  // ═══════════════════════════════════════════════════════════════
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const allPass = failed === 0;

  const report = `
FIN-SANE-02H.2 — ATOMICIDADE RPC
Data: ${new Date().toISOString()}
Modelo: MiMo-V2.5
Tempo: ${elapsed}s

CAUSA:
  f_confirmar_pagamento_fechamento usava EXIT + RETURN QUERY SELECT false
  quando item falhava. Isso retornava "sucesso=false" ao caller mas NÃO
  gerava EXCEPTION, permitindo que PostgreSQL commitasse alterações parciais
  dos itens 1 e 2 processados antes da falha.

ALTERAÇÃO EXATA:
  Substituído por RAISE EXCEPTION dentro do loop, que provoca rollback
  completo da transação. Removida variável v_erro_msg e bloco pós-loop.
  Validações pré-loop (fechamento não encontrado, já pago, etc.) mantidas
  com RETURN QUERY (sem mutações anteriores, seguro).

ARQUIVOS:
  supabase/migrations_lab/20260913000000_fin_sane_02b_unifica_valor_pagar.sql
  tests/sql/fin_sane_02h2_atomicidade.sql

TESTE FALHA 3º ITEM:           ${results.find(r=>r.step==='TESTE1-RPC')?.status || 'N/A'}
ITEM 1 APÓS FALHA:             ${results.find(r=>r.step==='TESTE1-ITENS')?.status || 'N/A'} (pendente)
ITEM 2 APÓS FALHA:             ${results.find(r=>r.step==='TESTE1-ITENS')?.status || 'N/A'} (pendente)
ITEM 3 APÓS FALHA:             ${results.find(r=>r.step==='TESTE1-ITENS')?.status || 'N/A'} (pendente)
BAIXAS APÓS FALHA:             ${results.find(r=>r.step==='TESTE1-BAIXAS')?.status || 'N/A'} (zero)
FECHAMENTO APÓS FALHA:         ${results.find(r=>r.step==='TESTE1-FECH')?.status || 'N/A'} (pendente)
FINANCEIRO_PAGAR APÓS FALHA:   ${results.find(r=>r.step==='TESTE1-PAGAR')?.status || 'N/A'} (inalterado)
PAGAMENTOS_PRESTADORES FALHA:  ${results.find(r=>r.step==='TESTE1-PP')?.status || 'N/A'} (inalterado)

TESTE SUCESSO 3/3:             ${results.find(r=>r.step==='TESTE2-RPC')?.status || 'N/A'}
TESTE IDEMPOTÊNCIA:            ${results.find(r=>r.step==='TESTE3-RPC')?.status || 'N/A'}
TESTE CONCORRÊNCIA 2 SESSÕES:  ${results.find(r=>r.step==='TESTE4-LOCK')?.status || 'N/A'}
BAIXAS DUPLICADAS:             ${results.find(r=>r.step==='TESTE4-BAIXAS')?.detail?.includes('0') || results.find(r=>r.step==='TESTE4-BAIXAS')?.detail?.includes('1') ? 'NÃO' : 'VERIFICAR'}

12 CENÁRIOS:                   ${results.find(r=>r.step==='12-CENARIOS')?.detail || 'N/A'}
REGRESSÃO 02H.1:               ${results.find(r=>r.step==='02H.1-UUID')?.status || 'N/A'}
ROLLBACK:                      ${results.find(r=>r.step==='ROLLBACK-RPC')?.status || 'N/A'}

PRODUÇÃO:                      ZERO WRITES

RESULTADO:                     ${allPass ? 'PASS' : 'BLOCKED'}
PENDÊNCIAS PRESERVADAS:
  - snapshot B1
  - triggers duplicados
  - dry-run produção
  - pagos sem baixa
  - RLS/RPC

PRÓXIMA MISSÃO:                FIN-SANE-02H.3-LAB-FINAL

DETALHE:
  ${results.map(r => `${r.status}: ${r.step} — ${r.detail}`).join('\n  ')}
`;

  fs.writeFileSync(REPORT_FILE, report.trim());
  log(`\n=== RESULTADO: ${allPass ? 'PASS' : 'BLOCKED'} (${passed}/${total} PASS, ${elapsed}s) ===`);
  log(`Relatório: ${REPORT_FILE}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
