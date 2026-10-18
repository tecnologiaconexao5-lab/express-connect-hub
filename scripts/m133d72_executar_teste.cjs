// M133-D.7.2 — Execução controlada do teste transacional de avanço
// Adaptação do script_final.sql para execução via node-pg (psql não disponível)
const { Client } = require('pg');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ALOCACAO_HML_ID = '76af8e4a-a3bc-492a-897d-4556574cc5d1';
const AUTH_USER_PRESTADOR_TESTE = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const PRESTADOR_TESTE_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';
const AUTH_USER_OUTRO = '00000000-0000-0000-0000-000000000000';

const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const IDEMPOTENCY_KEY = `MISSAO133D7-${TS}-${crypto.randomUUID()}`;

const results = { pre: {}, durante: {}, pos: {}, rpc: null, assertivas: [], negativos: [], idempotencia: {} };
const errors = [];

function log(label, data) {
  const s = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
  console.log(`\n=== ${label} ===\n${s}`);
}

async function snapshots(client, label) {
  const a = await client.query(`SELECT id, ordem_servico_id, status, aceite_prestador, data_aceite,
    finalizada, data_finalizacao, horario_inicio_real, horario_fim_real,
    metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
    metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency,
    updated_at FROM public.alocacoes_escala WHERE id = $1::uuid`, [ALOCACAO_HML_ID]);
  const e = await client.query(`SELECT 'eventos_oficiais' AS tabela, COUNT(*)::int AS qtd FROM public.eventos_oficiais
    WHERE entity_id = $1::uuid AND entity_type = 'alocacao'
    UNION ALL SELECT 'operation_timeline_events', COUNT(*)::int FROM public.operation_timeline_events
    WHERE operation_id = $1::text
    UNION ALL SELECT 'historico_alocacoes_escala', COUNT(*)::int FROM public.historico_alocacoes_escala
    WHERE alocacao_id = $1::uuid`, [ALOCACAO_HML_ID]);
  results[label] = { alocacao: a.rows[0], contagens: e.rows };
  log(`SNAPSHOT ${label}`, { alocacao: a.rows[0], contagens: e.rows });
  return { alocacao: a.rows[0], contagens: e.rows };
}

(async () => {
  console.log('='.repeat(70));
  console.log('MISSÃO 133-D.7.2 — EXECUÇÃO CONTROLADA DO TESTE TRANSACIONAL');
  console.log('Início:', new Date().toISOString());
  console.log('Alocação:', ALOCACAO_HML_ID);
  console.log('Prestador auth_user_id:', AUTH_USER_PRESTADOR_TESTE);
  console.log('Idempotency key:', IDEMPOTENCY_KEY);
  console.log('='.repeat(70));

  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000
  });
  await c.connect();
  console.log('\n✅ Conectado ao banco');

  try {
    // === ETAPA 4.1 — SNAPSHOT ANTES ===
    const antes = await snapshots(c, 'pre');

    // === ETAPA 4.2 — TRANSAÇÃO DE TESTE ===
    console.log('\n🔷 INICIANDO TRANSAÇÃO (BEGIN)...');
    await c.query('BEGIN');

    // Configurar contexto JWT (SET LOCAL não aceita parâmetros $N)
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '${AUTH_USER_PRESTADOR_TESTE}'`);
    await c.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated'`);
    await c.query(`SET LOCAL "request.jwt.claims" = '{"sub":"${AUTH_USER_PRESTADOR_TESTE}","role":"authenticated"}'`);

    console.log('✅ JWT configurado via SET LOCAL');

    // Executar RPC
    console.log('\n🔷 Chamando f_avancar_etapa_app_motorista...');
    const rpc = await c.query(`SELECT public.f_avancar_etapa_app_motorista(
      $1::uuid, 'viagem_aceita', '{}'::jsonb, $2, $3::uuid) AS resultado`,
      [ALOCACAO_HML_ID, IDEMPOTENCY_KEY, AUTH_USER_PRESTADOR_TESTE]);
    results.rpc = rpc.rows[0].resultado;
    log('RESULTADO RPC', results.rpc);

    // === SNAPSHOT DURANTE ===
    const durante = await snapshots(c, 'durante');

    // === ASSERTIVAS DENTRO DA TRANSAÇÃO ===
    console.log('\n🔷 EXECUTANDO ASSERTIVAS...');
    const assertivas = [];
    const aloc = durante.alocacao;

    // 1. Status deve ser 'aceita'
    const a1 = aloc.status === 'aceita';
    assertivas.push({ id: 1, desc: 'status = aceita', esperado: 'aceita', obtido: aloc.status, ok: a1 });
    if (!a1) errors.push('ASSERTIVA 1: status != aceita');

    // 2. aceite_prestador deve ser true
    const a2 = aloc.aceite_prestador === true;
    assertivas.push({ id: 2, desc: 'aceite_prestador = true', esperado: true, obtido: aloc.aceite_prestador, ok: a2 });
    if (!a2) errors.push('ASSERTIVA 2: aceite_prestador != true');

    // 3. data_aceite deve ser preenchida
    const a3 = aloc.data_aceite !== null;
    assertivas.push({ id: 3, desc: 'data_aceite preenchida', esperado: 'NOT NULL', obtido: aloc.data_aceite || 'NULL', ok: a3 });
    if (!a3) errors.push('ASSERTIVA 3: data_aceite NULL');

    // 4. etapa_atual deve ser 'viagem_aceita'
    const a4 = aloc.etapa_atual === 'viagem_aceita';
    assertivas.push({ id: 4, desc: 'etapa_atual = viagem_aceita', esperado: 'viagem_aceita', obtido: aloc.etapa_atual, ok: a4 });
    if (!a4) errors.push('ASSERTIVA 4: etapa_atual != viagem_aceita');

    // 5. finalizada deve continuar false
    const a5 = aloc.finalizada === false;
    assertivas.push({ id: 5, desc: 'finalizada = false', esperado: false, obtido: aloc.finalizada, ok: a5 });
    if (!a5) errors.push('ASSERTIVA 5: finalizada != false');

    // 6. Eventos foram criados
    const contDurante = durante.contagens;
    const contAntes = antes.contagens;
    const e6_eventos = contDurante.find(r => r.tabela === 'eventos_oficiais').qtd > contAntes.find(r => r.tabela === 'eventos_oficiais').qtd;
    const e6_timeline = contDurante.find(r => r.tabela === 'operation_timeline_events').qtd > contAntes.find(r => r.tabela === 'operation_timeline_events').qtd;
    const e6_historico = contDurante.find(r => r.tabela === 'historico_alocacoes_escala').qtd > contAntes.find(r => r.tabela === 'historico_alocacoes_escala').qtd;
    assertivas.push({ id: 6, desc: 'eventos_oficiais criado', esperado: contAntes.find(r=>r.tabela==='eventos_oficiais').qtd + 1, obtido: contDurante.find(r=>r.tabela==='eventos_oficiais').qtd, ok: e6_eventos });
    assertivas.push({ id: 7, desc: 'operation_timeline criado', esperado: contAntes.find(r=>r.tabela==='operation_timeline_events').qtd + 1, obtido: contDurante.find(r=>r.tabela==='operation_timeline_events').qtd, ok: e6_timeline });
    assertivas.push({ id: 8, desc: 'historico criado (trigger)', esperado: contAntes.find(r=>r.tabela==='historico_alocacoes_escala').qtd + 1, obtido: contDurante.find(r=>r.tabela==='historico_alocacoes_escala').qtd, ok: e6_historico });

    results.assertivas = assertivas;
    log('ASSERTIVAS', assertivas);

    const todasOk = assertivas.every(a => a.ok);

    // === ETAPA 6 — TESTE DE IDEMPOTÊNCIA ===
    console.log('\n🔷 TESTANDO IDEMPOTÊNCIA (segunda chamada com mesma key)...');
    const idem = await c.query(`SELECT public.f_avancar_etapa_app_motorista(
      $1::uuid, 'viagem_aceita', '{}'::jsonb, $2, $3::uuid) AS resultado`,
      [ALOCACAO_HML_ID, IDEMPOTENCY_KEY, AUTH_USER_PRESTADOR_TESTE]);
    const idemResult = idem.rows[0].resultado;
    const idemOk = idemResult.idempotent === true;
    results.idempotencia = { key: IDEMPOTENCY_KEY, resultado: idemResult, ok: idemOk };
    log('IDEMPOTÊNCIA', { key: IDEMPOTENCY_KEY, resultado: idemResult, ok: idemOk });
    if (!idemOk) errors.push('IDEMPOTÊNCIA: segunda chamada não foi idempotente');

    // === ETAPA 5 — TESTES NEGATIVOS ===
    console.log('\n🔷 TESTANDO CENÁRIOS NEGATIVOS...');

    // 5.1 — AUTH_USER_ID_INVALIDO
    const neg1 = await c.query(`SELECT public.f_avancar_etapa_app_motorista(
      $1::uuid, 'viagem_aceita', '{}'::jsonb, $2, $3::uuid) AS resultado`,
      [ALOCACAO_HML_ID, crypto.randomUUID(), AUTH_USER_OUTRO]);
    const n1Ok = neg1.rows[0].resultado.error === 'AUTH_USER_ID_INVALIDO';
    results.negativos.push({ id: '5.1', desc: 'AUTH_USER_ID_INVALIDO', resultado: neg1.rows[0].resultado, ok: n1Ok });
    if (!n1Ok) errors.push('NEGATIVO 5.1: não rejeitou AUTH_USER_ID_INVALIDO');

    // 5.3 — TRANSICAO_INVALIDA
    const neg2 = await c.query(`SELECT public.f_avancar_etapa_app_motorista(
      $1::uuid, 'servico_finalizado', '{}'::jsonb, $2, $3::uuid) AS resultado`,
      [ALOCACAO_HML_ID, crypto.randomUUID(), AUTH_USER_PRESTADOR_TESTE]);
    const n2Ok = neg2.rows[0].resultado.error === 'TRANSICAO_INVALIDA';
    results.negativos.push({ id: '5.3', desc: 'TRANSICAO_INVALIDA', resultado: neg2.rows[0].resultado, ok: n2Ok });
    if (!n2Ok) errors.push('NEGATIVO 5.3: não rejeitou TRANSICAO_INVALIDA');

    log('CENÁRIOS NEGATIVOS', results.negativos);

    // === ROLLBACK ===
    if (errors.length > 0 && !todasOk) {
      console.log(`\n⚠️  ${errors.length} erro(s) encontrado(s). Rollback será executado de qualquer forma para preservar estado.`);
    }
    console.log('\n🔷 EXECUTANDO ROLLBACK...');
    await c.query('ROLLBACK');
    console.log('✅ ROLLBACK executado');

    // === SNAPSHOT DEPOIS ===
    const depois = await snapshots(c, 'pos');

    // === VALIDAÇÃO PÓS-ROLLBACK ===
    console.log('\n🔷 VALIDANDO ESTADO PÓS-ROLLBACK...');
    const posAloc = depois.alocacao;

    const v1 = posAloc.etapa_atual === null;
    const v2 = posAloc.aceite_prestador === false;
    const v3 = posAloc.status === 'aguardando_aceite';
    const v4 = posAloc.data_aceite === null;
    const v5 = posAloc.finalizada === false;
    const v6 = posAloc.ultima_idempotency === null;

    const cPos = depois.contagens;
    const cPre = antes.contagens;
    const v7 = cPos.find(r => r.tabela === 'eventos_oficiais').qtd === cPre.find(r => r.tabela === 'eventos_oficiais').qtd;
    const v8 = cPos.find(r => r.tabela === 'operation_timeline_events').qtd === cPre.find(r => r.tabela === 'operation_timeline_events').qtd;
    const v9 = cPos.find(r => r.tabela === 'historico_alocacoes_escala').qtd === cPre.find(r => r.tabela === 'historico_alocacoes_escala').qtd;

    const posValidacoes = [
      { id: 'V1', desc: 'etapa voltou a NULL', ok: v1 },
      { id: 'V2', desc: 'aceite_prestador voltou a false', ok: v2 },
      { id: 'V3', desc: 'status voltou a aguardando_aceite', ok: v3 },
      { id: 'V4', desc: 'data_aceite voltou a NULL', ok: v4 },
      { id: 'V5', desc: 'finalizada continuou false', ok: v5 },
      { id: 'V6', desc: 'idempotency key removida', ok: v6 },
      { id: 'V7', desc: 'eventos_oficiais sem resíduo', ok: v7 },
      { id: 'V8', desc: 'operation_timeline sem resíduo', ok: v8 },
      { id: 'V9', desc: 'historico sem resíduo', ok: v9 },
    ];
    results.pos_validacao = posValidacoes;
    log('VALIDAÇÃO PÓS-ROLLBACK', posValidacoes);

    const rollbackOk = posValidacoes.every(v => v.ok);
    if (!rollbackOk) {
      errors.push('ROLLBACK: nem todas as verificações pós-rollback passaram');
    }

    // === TABELA RESUMO ===
    console.log('\n' + '='.repeat(70));
    console.log('TABELA RESUMO — ANTES vs DURANTE vs DEPOIS');
    console.log('='.repeat(70));
    console.log('| Evidência | Antes | Durante | Depois do rollback | Resultado |');
    console.log('|---|---|---|---|---|');
    console.log(`| status alocação | ${antes.alocacao.status} | ${durante.alocacao.status} | ${depois.alocacao.status} | ${antes.alocacao.status === depois.alocacao.status ? '✅' : '❌'} |`);
    console.log(`| etapa | ${antes.alocacao.etapa_atual || 'NULL'} | ${durante.alocacao.etapa_atual} | ${depois.alocacao.etapa_atual || 'NULL'} | ${antes.alocacao.etapa_atual === depois.alocacao.etapa_atual ? '✅' : '❌'} |`);
    console.log(`| aceite_prestador | ${antes.alocacao.aceite_prestador} | ${durante.alocacao.aceite_prestador} | ${depois.alocacao.aceite_prestador} | ${antes.alocacao.aceite_prestador === depois.alocacao.aceite_prestador ? '✅' : '❌'} |`);
    console.log(`| eventos_oficiais | ${cPre.find(r=>r.tabela==='eventos_oficiais').qtd} | ${cPos.find(r=>r.tabela==='eventos_oficiais').qtd} | ${cPos.find(r=>r.tabela==='eventos_oficiais').qtd} | ${cPre.find(r=>r.tabela==='eventos_oficiais').qtd === cPos.find(r=>r.tabela==='eventos_oficiais').qtd ? '✅' : '❌'} |`);
    console.log(`| timeline | ${cPre.find(r=>r.tabela==='operation_timeline_events').qtd} | ${cPos.find(r=>r.tabela==='operation_timeline_events').qtd} | ${cPos.find(r=>r.tabela==='operation_timeline_events').qtd} | ${cPre.find(r=>r.tabela==='operation_timeline_events').qtd === cPos.find(r=>r.tabela==='operation_timeline_events').qtd ? '✅' : '❌'} |`);
    console.log(`| historico | ${cPre.find(r=>r.tabela==='historico_alocacoes_escala').qtd} | ${cPos.find(r=>r.tabela==='historico_alocacoes_escala').qtd} | ${cPos.find(r=>r.tabela==='historico_alocacoes_escala').qtd} | ${cPre.find(r=>r.tabela==='historico_alocacoes_escala').qtd === cPos.find(r=>r.tabela==='historico_alocacoes_escala').qtd ? '✅' : '❌'} |`);
    console.log(`| idempotency key | ${antes.alocacao.ultima_idempotency || 'NULL'} | ${durante.alocacao.ultima_idempotency || 'NULL'} | ${depois.alocacao.ultima_idempotency || 'NULL'} | ${antes.alocacao.ultima_idempotency === depois.alocacao.ultima_idempotency ? '✅' : '❌'} |`);

    // === RESUMO FINAL ===
    console.log('\n' + '='.repeat(70));
    console.log('RESUMO FINAL');
    console.log('='.repeat(70));

    const todasAssertivasOk = results.assertivas.every(a => a.ok);
    const todosNegativosOk = results.negativos.every(n => n.ok);
    const idempotenciaOk = results.idempotencia.ok;

    if (errors.length === 0 && todasAssertivasOk && todosNegativosOk && idempotenciaOk && rollbackOk) {
      console.log('\n✅✅✅ TODOS OS TESTES PASSARAM ✅✅✅');
      console.log('');
      console.log('LÓGICA SQL DE AVANÇO VALIDADA COM ROLLBACK —');
      console.log('POSTGREST E FLUTTER AINDA NÃO HOMOLOGADOS');
    } else {
      console.log(`\n⚠️  ${errors.length} erro(s) de ${assertivas.length + results.negativos.length + 1 + posValidacoes.length} testes:`);
      errors.forEach(e => console.log(`  ❌ ${e}`));
      console.log('\nTESTE TRANSACIONAL FALHOU — ESTADO DO BANCO PRESERVADO');
    }

    console.log('');
    console.log('Assertivas dentro da transação:', todasAssertivasOk ? '✅ TODAS OK' : '❌ FALHAS');
    console.log('Idempotência:', idempotenciaOk ? '✅ OK' : '❌ FALHOU');
    console.log('Negativos (AUTH_USER_ID, TRANSICAO):', todosNegativosOk ? '✅ TODOS OK' : '❌ FALHAS');
    console.log('Rollback:', rollbackOk ? '✅ COMPLETO' : '❌ FALHOU');

    console.log('\nFim:', new Date().toISOString());

  } catch (err) {
    console.error('\n❌ ERRO NÃO ESPERADO:', err.message);
    try { await c.query('ROLLBACK'); console.log('✅ Rollback de emergência executado'); } catch (_) {}
    errors.push('ERRO GLOBAL: ' + err.message);
  } finally {
    await c.end();
    console.log('✅ Conexão encerrada');
  }

  // Salvar resultados para relatório
  const fs = require('fs');
  const output = {
    timestamp: new Date().toISOString(),
    alocacao_id: ALOCACAO_HML_ID,
    prestador_auth: AUTH_USER_PRESTADOR_TESTE,
    idempotency_key: IDEMPOTENCY_KEY,
    hash_script: '5784A82C5063B352D7A245A0B0B90AFD2DA1E5CB83838CA0A57883E44AFC59FF',
    errors: errors,
    results: results
  };
  fs.writeFileSync(path.join(__dirname, '..', 'scripts', 'm133d72_resultado.json'), JSON.stringify(output, null, 2));
  console.log('\n✅ Resultado salvo em scripts/m133d72_resultado.json');
})();
