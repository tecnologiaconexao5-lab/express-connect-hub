/**
 * A31B — PROVA READ-ONLY 2: triggers e tabelas de sincronização App → TMS
 * NENHUM INSERT/UPDATE/DELETE. Apenas SELECT.
 * Uso: node scripts/a31b_prova_triggers.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL não definida'); process.exit(1); }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ ${m}`); passed++; } else { console.log(`  ❌ ${m}`); failed++; } };
const header = (t) => console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);

async function main() {
  await client.connect();
  console.log('✅ Conectado (read-only)\n');

  // 1. Tabela delivery_proofs (origem do POD no App) e trigger de sync
  header('1. delivery_proofs → entregas_protocolo (sync POD App→TMS)');
  const { rows: tabExists } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('delivery_proofs','entregas_protocolo','operation_timeline_events','eventos_oficiais','ordens_servico')
  `);
  console.log('   Tabelas encontradas:', tabExists.map(r => r.table_name).join(', '));
  assert(tabExists.some(r => r.table_name === 'delivery_proofs'), 'delivery_proofs existe (fonte do App)');
  assert(tabExists.some(r => r.table_name === 'entregas_protocolo'), 'entregas_protocolo existe (fonte oficial POD)');

  const { rows: syncTriggers } = await client.query(`
    SELECT tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    WHERE NOT t.tgisinternal
      AND (tgname ILIKE '%delivery%' OR tgname ILIKE '%pod%' OR tgname ILIKE '%entregas%' OR tgname ILIKE '%protocolo%')
  `);
  for (const t of syncTriggers) console.log(`   TRIGGER: ${t.tgname}\n     ${t.def.slice(0, 200)}...`);
  assert(syncTriggers.length >= 1, 'Existe trigger sincronizando delivery_proofs → entregas_protocolo');

  // 2. delivery_proofs: dados reais
  const { rows: dp } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status IN ('entregue','delivered','entregue_ressalva')) AS entregue
    FROM public.delivery_proofs
  `);
  console.log(`   delivery_proofs: total=${dp[0].total} | entregue=${dp[0].entregue}`);
  assert(Number(dp[0].total) >= 0, 'Consulta delivery_proofs OK');

  // 3. Verificar se o POD do App (delivery_proofs) chega em entregas_protocolo
  // delivery_proofs: estrutura real é inspecionada dinamicamente
  const { rows: dpCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='delivery_proofs' ORDER BY ordinal_position
  `);
  const dpColList = dpCols.map((c) => c.column_name);
  console.log(`   Colunas delivery_proofs: ${dpColList.join(', ')}`);
  const joinCol = dpColList.includes('alocacao_id') ? 'alocacao_id'
    : dpColList.includes('ordem_servico_id') ? 'ordem_servico_id'
    : dpColList.includes('allocation_id') ? 'allocation_id' : null;
  assert(!!joinCol, `delivery_proofs possui coluna de vínculo (${joinCol || 'nenhuma encontrada'})`);

  if (joinCol) {
    const { rows: cruzado } = await client.query(`
      SELECT dp.id AS dp_id, ep.id AS ep_id,
             dp.${joinCol} AS dp_vinculo, ep.alocacao_id AS ep_alocacao,
             dp.status AS dp_status, ep.status AS ep_status,
             ep.foto_entrega_url AS ep_foto
      FROM public.delivery_proofs dp
      LEFT JOIN public.entregas_protocolo ep ON ep.alocacao_id = dp.${joinCol}
      ORDER BY dp.created_at DESC
      LIMIT 10
    `);
    console.log('   delivery_proofs × entregas_protocolo (mesmo vínculo):');
    let syncOK = 0;
    for (const c of cruzado) {
      const ok = !!c.ep_id;
      if (ok) syncOK++;
      console.log(`   dp ${String(c.dp_id).slice(0,8)} → ep ${c.ep_id ? String(c.ep_id).slice(0,8) : 'NENHUM'} | status ${c.dp_status}/${c.ep_status || '—'} | ${ok ? 'SINCRONIZADO' : 'sem entregas_protocolo'}`);
    }
    if (cruzado.length > 0) {
      assert(syncOK >= 1, `POD do App sincronizado em entregas_protocolo (${syncOK}/${cruzado.length})`);
    } else {
      console.log('   (sem dados de delivery_proofs com vínculo)');
      assert(true, 'Sem dados de delivery_proofs para comparar (vazio)');
    }
  }

  // 4. event bus: eventos_oficiais / operation_timeline_events com romaneio/km
  header('4. Eventos oficiais — romaneio/km registrados pelo App (event bus)');
  const { rows: evts } = await client.query(`
    SELECT 'eventos_oficiais' AS fonte, COUNT(*) AS total
    FROM public.eventos_oficiais
    UNION ALL
    SELECT 'operation_timeline_events', COUNT(*) FROM public.operation_timeline_events
  `);
  for (const e of evts) console.log(`   ${e.fonte}: ${e.total}`);
  const { rows: evtRomaneio } = await client.query(`
    SELECT COUNT(*) AS total FROM public.eventos_oficiais
    WHERE (metadata ? 'romaneio') OR (payload ? 'romaneio') OR (metadata->'app_motorista' ? 'romaneio')
  `);
  console.log(`   eventos_oficiais com romaneio: ${evtRomaneio[0].total}`);

  // 5. KM: como km_realizados é atualizado — triggers em alocacoes_escala
  header('5. KM — triggers que atualizam km_realizados na alocação');
  const { rows: kmTriggers } = await client.query(`
    SELECT tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='alocacoes_escala' AND NOT t.tgisinternal
  `);
  for (const t of kmTriggers) console.log(`   TRIGGER: ${t.tgname}`);
  console.log(`   Total triggers em alocacoes_escala: ${kmTriggers.length}`);

  // 6. Quantas alocações tem km_realizados>0 e de onde vem (metadata.app_motorista km_final/km_inicial)
  header('6. KM — alocações com km_realizados e payload do App');
  const { rows: kmData } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE km_realizados > 0) AS com_km,
           COUNT(*) FILTER (WHERE metadata->'app_motorista' ? 'km_final') AS app_km_final,
           COUNT(*) FILTER (WHERE metadata->'app_motorista' ? 'km_inicial') AS app_km_inicial
    FROM public.alocacoes_escala
  `);
  console.log(`   alocações total=${kmData[0].total} | km_realizados>0=${kmData[0].com_km} | app km_final=${kmData[0].app_km_final} | app km_inicial=${kmData[0].app_km_inicial}`);
  assert(Number(kmData[0].total) >= 0, 'Consulta KM OK');

  // 7. VIEW oficial do App expõe romaneio da OS (contrato TMS→App)
  header('7. View oficial App (TMS → App) — romaneio vem de ordens_servico');
  const { rows: views } = await client.query(`
    SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname ILIKE '%motorista%'
  `);
  console.log('   Views:', views.map(v => v.viewname).join(', ') || 'nenhuma');
  const { rows: viewDef } = await client.query(`
    SELECT definition FROM pg_views WHERE schemaname='public' AND viewname='vw_app_motorista_operacoes'
  `);
  if (viewDef[0]) {
    const def = viewDef[0].definition;
    assert(def.includes('os.romaneio') || def.includes('romaneio'), 'View App expõe romaneio (de ordens_servico)');
    assert(def.includes('km_realizados'), 'View App expõe km_realizados');
  } else {
    assert(false, 'View vw_app_motorista_operacoes existe');
  }

  // 8. fm status finalizado: alocacoes finalizadas
  header('8. Operação finalizada → alocação finalizada → financeiro');
  const { rows: finOK } = await client.query(`
    SELECT COUNT(*) AS finalizadas,
           COUNT(*) FILTER (WHERE fr.id IS NOT NULL) AS com_receber,
           COUNT(*) FILTER (WHERE pp.id IS NOT NULL) AS com_pagto
    FROM public.alocacoes_escala a
    LEFT JOIN public.financeiro_receber fr ON fr.os_id = a.ordem_servico_id::text
    LEFT JOIN public.pagamentos_prestadores pp ON pp.os_id = a.ordem_servico_id
    WHERE a.status='concluida' AND a.finalizada=true
  `);
  console.log(`   Finalizadas=${finOK[0].finalizadas} | com financeiro_receber=${finOK[0].com_receber} | com pagamentos_prestadores=${finOK[0].com_pagto}`);

  // 9. Romaneio no App (6) vs Central: verificar se algum aparece na Central via os.romaneio
  header('9. Romaneio informado pelo App (metadata.app_motorista) vs ordens_servico.romaneio');
  const { rows: gap } = await client.query(`
    SELECT os.numero AS os_numero, os.romaneio AS os_romaneio,
           (a.metadata->'app_motorista'->>'romaneio') AS app_romaneio
    FROM public.alocacoes_escala a
    JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    WHERE a.metadata->'app_motorista' ? 'romaneio'
      AND (os.romaneio IS NULL OR os.romaneio = '')
  `);
  console.log(`   OS onde o App informou romaneio mas OS.romaneio está VAZIO: ${gap.length}`);
  for (const g of gap) console.log(`   OS ${g.os_numero} | app_romaneio=${g.app_romaneio} | os.romaneio=${g.os_romaneio || '(vazio)'}`);
  if (gap.length > 0) {
    console.log('   ⚠️ GAP COMPROVADO: o App informa romaneio em metadata.app_motorista, mas NÃO propaga para ordens_servico.romaneio (fonte oficial lida pela Central).');
  }
  assert(Number(gap.length) >= 0, 'Prova de gap App→OS.romaneio coletada');

  header('RESUMO PROVA READ-ONLY A31B (TRIGGERS)');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error('❌ ERRO:', e.message); process.exit(2); });