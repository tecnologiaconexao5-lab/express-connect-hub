// M133-D.7.2 — Validação pós-rollback: SELECT-only confirmar que nada persistiu
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ALOCACAO_HML_ID = '76af8e4a-a3bc-492a-897d-4556574cc5d1';
const IDS_PRE = { eventos_oficiais: 1, timeline: 0, historico: 1 };
const IDP_KEY = 'MISSAO133D7-';  // prefix to search

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();
  console.log('=== VALIDAÇÃO PÓS-ROLLBACK (SELECT-ONLY) ===\n');

  // 1. Alocação
  const a = await c.query(`SELECT id, status, aceite_prestador, data_aceite, finalizada,
    metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
    metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency,
    updated_at FROM public.alocacoes_escala WHERE id = $1::uuid`, [ALOCACAO_HML_ID]);
  const aloc = a.rows[0];
  console.log('1. Alocação HML:');
  console.log('   status:', aloc.status, aloc.status === 'aguardando_aceite' ? '✅' : '❌');
  console.log('   etapa:', aloc.etapa_atual || 'NULL', !aloc.etapa_atual ? '✅' : '❌');
  console.log('   aceite:', aloc.aceite_prestador, aloc.aceite_prestador === false ? '✅' : '❌');
  console.log('   data_aceite:', aloc.data_aceite || 'NULL', !aloc.data_aceite ? '✅' : '❌');
  console.log('   finalizada:', aloc.finalizada, aloc.finalizada === false ? '✅' : '❌');
  console.log('   idempotency:', aloc.ultima_idempotency || 'NULL', !aloc.ultima_idempotency ? '✅' : '❌');

  // 2. Contagens de eventos
  const e = await c.query(`SELECT 'eventos_oficiais' AS tabela, COUNT(*)::int AS qtd FROM public.eventos_oficiais
    WHERE entity_id = $1::uuid AND entity_type = 'alocacao'
    UNION ALL SELECT 'operation_timeline_events', COUNT(*)::int FROM public.operation_timeline_events
    WHERE operation_id = $1::text
    UNION ALL SELECT 'historico_alocacoes_escala', COUNT(*)::int FROM public.historico_alocacoes_escala
    WHERE alocacao_id = $1::uuid`, [ALOCACAO_HML_ID]);
  const contagens = {};
  e.rows.forEach(r => contagens[r.tabela] = r.qtd);
  console.log('\n2. Contagens:');
  console.log('   eventos_oficiais:', contagens.eventos_oficiais, contagens.eventos_oficiais === IDS_PRE.eventos_oficiais ? '✅' : '❌');
  console.log('   timeline:', contagens.operation_timeline_events, contagens.operation_timeline_events === IDS_PRE.timeline ? '✅' : '❌');
  console.log('   historico:', contagens.historico_alocacoes_escala, contagens.historico_alocacoes_escala === IDS_PRE.historico ? '✅' : '❌');

  // 3. Nenhum resíduo de idempotency
  const idem = await c.query(`SELECT COUNT(*)::int AS qtd FROM public.alocacoes_escala
    WHERE metadata->'app_motorista'->>'ultima_idempotency' LIKE $1`, [IDP_KEY + '%']);
  console.log('\n3. Resíduo idempotency key:', idem.rows[0].qtd === 0 ? '✅ NENHUM' : '❌ ENCONTRADO:', idem.rows[0].qtd);

  // 4. Nenhum evento novo (além dos pré-existentes)
  const novosEventos = await c.query(`SELECT COUNT(*)::int AS qtd FROM public.eventos_oficiais
    WHERE entity_id = $1::uuid AND entity_type = 'alocacao'
    AND created_at > '2026-07-27T17:44:00Z'`, [ALOCACAO_HML_ID]);
  console.log('4. Eventos novos pós-teste:', novosEventos.rows[0].qtd === 0 ? '✅ NENHUM' : '❌ ENCONTRADO:', novosEventos.rows[0].qtd);

  // 5. Nenhuma timeline nova
  const novosTimeline = await c.query(`SELECT COUNT(*)::int AS qtd FROM public.operation_timeline_events
    WHERE operation_id = $1::text AND created_at > '2026-07-27T17:44:00Z'`, [ALOCACAO_HML_ID]);
  console.log('5. Timeline nova pós-teste:', novosTimeline.rows[0].qtd === 0 ? '✅ NENHUMA' : '❌ ENCONTRADA:', novosTimeline.rows[0].qtd);

  // 6. Financeiro não afetado
  const fin = await c.query(`SELECT COUNT(*)::int AS qtd FROM public.financeiro_receber
    WHERE os_id = $1::text`, [ALOCACAO_HML_ID]);
  console.log('6. Financeiro_receber afetado:', fin.rows[0].qtd === 0 ? '✅ NENHUM (s/ OS)' : '⚠️ ENCONTRADO:', fin.rows[0].qtd);
  // financeiro_receber não tem alocacao_id — apenas os_id (text). Alocação sem OS, logo sem financeiro.

  console.log('\n=== VALIDAÇÃO PÓS-ROLLBACK CONCLUÍDA ===');
  if (aloc.status === 'aguardando_aceite' && !aloc.etapa_atual && !aloc.ultima_idempotency &&
      contagens.eventos_oficiais === IDS_PRE.eventos_oficiais && idem.rows[0].qtd === 0 && novosEventos.rows[0].qtd === 0) {
    console.log('✅✅✅ ESTADO DO BANCO TOTALMENTE PRESERVADO');
  } else {
    console.log('❌❌❌ RESÍDUO ENCONTRADO — INVESTIGAR');
  }
  await c.end();
})();
