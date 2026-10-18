require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const c = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await c.connect();
  console.log('=== CORE-E2E-OS-APP-POD-02 — CLASSIFICACAO DAS 56 ALOCACOES SEM DELIVERY_PROOF ===\n');

  // ============================================================
  // STEP 1: Get all 56 finalized allocations without delivery_proof
  // ============================================================
  const q1 = await c.query(`
    SELECT 
      ae.id, ae.status, ae.data_escala, ae.data_finalizacao,
      ae.prestador_id, ae.cliente_id,
      ae.ordem_servico_id, ae.fotos_entrega,
      ae.comprovante_url, ae.assinatura_url, ae.km_realizados,
      ae.aceite_prestador, ae.data_aceite,
      ae.finalizada, ae.origem, ae.metadata,
      os.numero as numero_os, os.cliente as os_cliente, os.status as os_status,
      p.nome_completo as prestador_real_nome
    FROM alocacoes_escala ae
    LEFT JOIN ordens_servico os ON os.id = ae.ordem_servico_id
    LEFT JOIN prestadores p ON p.id = ae.prestador_id
    WHERE ae.status = 'concluida'
      AND ae.finalizada = true
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp 
        WHERE dp.operation_id = ae.id::text OR dp.stop_id = ae.id::text
      )
    ORDER BY ae.data_finalizacao ASC
  `);
  const allocs = q1.rows;
  console.log(`Total alocacoes finalizadas SEM delivery_proof: ${allocs.length}\n`);

  // ============================================================
  // STEP 2: Get ALL delivery_proofs for comparison
  // ============================================================
  const q2 = await c.query(`
    SELECT id, stop_id, operation_id, driver_id, status, 
           receiver_name, photo_url, signature_url, delivered_at, created_at
    FROM delivery_proofs ORDER BY created_at
  `);
  const dps = q2.rows;
  console.log(`Total delivery_proofs existentes: ${dps.length}`);
  console.log(`Delivery proofs por operation_id: ${JSON.stringify([...new Set(dps.map(d => d.operation_id))])}`);
  console.log(`Delivery proofs por driver_id: ${JSON.stringify([...new Set(dps.map(d => d.driver_id))])}\n`);

  // ============================================================
  // STEP 3: Classify each allocation
  // ============================================================
  const classifications = allocs.map(a => {
    const meta = a.metadata || {};
    const metaKeys = Object.keys(meta);
    const fotosEntrega = a.fotos_entrega;
    const hasFotos = Array.isArray(fotosEntrega) && fotosEntrega.length > 0;
    
    // Check for test/mission prefixes
    const prestadorDisplay = a.prestador_real_nome || a.prestador_id || '';
    const isTest = 
      (prestadorDisplay && (prestadorDisplay.includes('M43') || prestadorDisplay.includes('M48') || prestadorDisplay.includes('Teste') || prestadorDisplay.includes('TESTE'))) ||
      (a.numero_os && (a.numero_os.includes('M43') || a.numero_os.includes('M48'))) ||
      (meta.missao43 || meta.missao48 || meta.central_financeira_manual);
    
    // Check acceptance
    const acceptedByDriver = a.aceite_prestador === true && a.data_aceite !== null;
    
    // Check if has OS
    const hasOS = a.ordem_servico_id !== null;
    
    // Check entregas_protocolo
    const hasEP = false; // will check below
    
    // Check if prestador is null
    const hasPrestador = a.prestador_id !== null;
    
    // Check metadata for POD-related fields
    const hasPODinMeta = meta.pod || meta.comprovante || meta.entrega || meta.fotos;
    
    // Finalization path
    const hasComprovante = a.comprovante_url !== null;
    const hasAssinatura = a.assinatura_url !== null;
    
    // Classify
    let category;
    let detail;
    
    if (!hasPrestador) {
      category = 'A_TEST_SEED';
      detail = 'No prestador_id — test/seed data';
    } else if (!acceptedByDriver) {
      category = 'B_NOT_ACCEPTED';
      detail = `Driver never accepted (aceite=${a.aceite_prestador}, data_aceite=${a.data_aceite})`;
    } else if (isTest) {
      category = 'C_TEST_MISSION';
      detail = 'Test mission data (M43/M48/missao)';
    } else if (!hasOS) {
      category = 'D_NO_OS';
      detail = 'No ordem_servico_id — standalone allocation';
    } else if (hasComprovante || hasAssinatura || hasFotos || hasPODinMeta) {
      category = 'E_TMS_FINALIZED_WITH_EVIDENCE';
      detail = `TMS finalized with evidence (comprovante=${hasComprovante}, assinatura=${hasAssinatura}, fotos=${hasFotos})`;
    } else {
      category = 'F_FINALIZED_NO_EVIDENCE';
      detail = 'Finalized with zero evidence — root cause candidate';
    }
    
    return {
      id: a.id,
      data_finalizacao: a.data_finalizacao,
      data_escala: a.data_escala,
      prestador_id: a.prestador_id,
      prestador_nome: a.prestador_real_nome,
      cliente_id: a.cliente_id,
      os_id: a.ordem_servico_id,
      numero_os: a.numero_os,
      aceite_prestador: a.aceite_prestador,
      data_aceite: a.data_aceite,
      comprovante_url: a.comprovante_url,
      assinatura_url: a.assinatura_url,
      fotos_entrega: hasFotos ? fotosEntrega.length : 0,
      km_realizados: a.km_realizados,
      origem: a.origem,
      metadata_keys: metaKeys.join(', '),
      category,
      detail,
    };
  });

  // ============================================================
  // STEP 4: Check entregas_protocolo for the 56
  // ============================================================
  const ids = allocs.map(a => a.id);
  const q3 = await c.query(`
    SELECT alocacao_id, id as ep_id, prestador_id, nome_recebedor, status, 
           foto_entrega_url, foto_canhoto_url, assinatura_url, data_hora_entrega
    FROM entregas_protocolo 
    WHERE alocacao_id = ANY($1)
  `, [ids]);
  const epMap = {};
  q3.rows.forEach(ep => { epMap[ep.alocacao_id] = ep; });

  // Enrich classifications with EP data
  classifications.forEach(c => {
    const ep = epMap[c.id];
    c.has_ep = !!ep;
    c.ep_id = ep ? ep.ep_id : null;
    c.ep_status = ep ? ep.status : null;
    c.ep_has_foto = ep ? !!(ep.foto_entrega_url) : false;
    c.ep_has_assinatura = ep ? !!(ep.assinatura_url) : false;
  });

  // ============================================================
  // STEP 5: Summary by category
  // ============================================================
  const cats = {};
  classifications.forEach(c => {
    if (!cats[c.category]) cats[c.category] = [];
    cats[c.category].push(c);
  });

  console.log('=== CLASSIFICACAO ===\n');
  Object.entries(cats).forEach(([cat, items]) => {
    console.log(`${cat} (${items.length}):`);
    items.forEach(i => {
      console.log(`  ${i.id.substring(0,8)} | ${i.data_finalizacao ? i.data_finalizacao.toISOString().substring(0,10) : 'null'} | prestador=${i.prestador_id ? i.prestador_id.substring(0,8) : 'NULL'} | os=${i.numero_os || 'null'} | aceite=${i.aceite_prestador} | ep=${i.has_ep} | ${i.detail}`);
    });
    console.log('');
  });

  // ============================================================
  // STEP 6: RPC analysis — what RPC does the App actually call?
  // ============================================================
  console.log('=== RPC ANALYSIS ===\n');
  
  // Check f_atualizar_etapa_app (the one App actually calls)
  const rpcCheck = await c.query(`
    SELECT routine_name, security_type, prosec_definer,
           (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = routine_name) as definition
    FROM information_schema.routines 
    WHERE routine_name IN ('f_atualizar_etapa_app', 'f_avancar_etapa_app_motorista')
  `);
  rpcCheck.rows.forEach(r => {
    console.log(`RPC: ${r.routine_name}`);
    console.log(`  Security: ${r.security_type}, Definer: ${r.prosec_definer}`);
    if (r.definition) {
      // Check if it writes to delivery_proofs
      const writesDP = r.definition.includes('delivery_proofs');
      console.log(`  Writes to delivery_proofs: ${writesDP}`);
      // Check if it sets status
      const setsConcluida = r.definition.includes('concluida');
      console.log(`  Sets status concluida: ${setsConcluida}`);
      // Show first 500 chars
      console.log(`  Definition preview: ${r.definition.substring(0, 500)}...`);
    }
    console.log('');
  });

  // ============================================================
  // STEP 7: Check who can finalize (TMS paths)
  // ============================================================
  console.log('=== TMS FINALIZATION PATHS ===\n');
  
  // Check if any of the 56 were finalized by TMS (not App)
  const tmsFinalized = classifications.filter(c => 
    c.origem === 'central_financeira_manual' || 
    (c.origem && c.origem.includes('missao'))
  );
  console.log(`Alocacoes with TMS/manual origin: ${tmsFinalized.length}`);
  tmsFinalized.forEach(t => {
    console.log(`  ${t.id.substring(0,8)} | origem=${t.origem} | ${t.detail}`);
  });

  // ============================================================
  // STEP 8: Timeline analysis
  // ============================================================
  console.log('\n=== TIMELINE ===\n');
  const withDates = classifications.filter(c => c.data_finalizacao);
  if (withDates.length > 0) {
    const earliest = withDates[0].data_finalizacao;
    const latest = withDates[withDates.length - 1].data_finalizacao;
    console.log(`Earliest finalization: ${earliest.toISOString()}`);
    console.log(`Latest finalization: ${latest.toISOString()}`);
    
    // Group by month
    const byMonth = {};
    withDates.forEach(c => {
      const month = c.data_finalizacao.toISOString().substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    });
    console.log('By month:');
    Object.entries(byMonth).forEach(([m, n]) => console.log(`  ${m}: ${n}`));
  }

  // ============================================================
  // STEP 9: Check historico_alocacoes for finalization events
  // ============================================================
  console.log('\n=== HISTORICO ANALYSIS ===\n');
  const q4 = await c.query(`
    SELECT alocacao_id, evento, descricao, created_at
    FROM historico_alocacoes_escala
    WHERE alocacao_id = ANY($1)
      AND (evento ILIKE '%finali%' OR evento ILIKE '%conclu%' OR evento ILIKE '%pod%' OR evento ILIKE '%entrega%')
    ORDER BY created_at
  `, [ids]);
  console.log(`Historico events for 56 allocs: ${q4.rows.length}`);
  q4.rows.forEach(h => {
    console.log(`  ${h.alocacao_id.substring(0,8)} | ${h.evento} | ${h.descricao ? h.descricao.substring(0, 80) : ''} | ${h.created_at.toISOString()}`);
  });

  // ============================================================
  // STEP 10: Check historico for ALL events on these allocs
  // ============================================================
  console.log('\n=== ALL HISTORICO EVENTS ===\n');
  const q5 = await c.query(`
    SELECT alocacao_id, evento, descricao, created_at
    FROM historico_alocacoes_escala
    WHERE alocacao_id = ANY($1)
    ORDER BY alocacao_id, created_at
  `, [ids]);
  
  // Group by allocation
  const histByAlloc = {};
  q5.rows.forEach(h => {
    if (!histByAlloc[h.alocacao_id]) histByAlloc[h.alocacao_id] = [];
    histByAlloc[h.alocacao_id].push(h);
  });
  
  // Show allocations with most events
  const sorted = Object.entries(histByAlloc).sort((a, b) => b[1].length - a[1].length);
  sorted.slice(0, 10).forEach(([id, events]) => {
    console.log(`${id.substring(0,8)} (${events.length} events):`);
    events.forEach(e => {
      console.log(`  ${e.evento} | ${e.descricao ? e.descricao.substring(0, 60) : ''} | ${e.created_at.toISOString()}`);
    });
  });

  // Save full results
  const results = {
    timestamp: new Date().toISOString(),
    total_no_delivery_proof: classifications.length,
    total_delivery_proofs: dps.length,
    classifications_summary: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v.length])),
    classifications,
    entregas_protocolo: q3.rows,
    historico_sample: q5.rows.slice(0, 50),
    rpc_analysis: rpcCheck.rows.map(r => ({ name: r.routine_name, security: r.security_type })),
  };
  
  const outPath = path.join(__dirname, '..', '_core_e2e_pod02_classificacao.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outPath}`);

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
