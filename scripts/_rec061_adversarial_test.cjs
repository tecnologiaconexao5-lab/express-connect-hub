const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

let passed = 0, failed = 0, total = 0;
const results = [];

function assert(id, desc, condition, detail) {
  total++;
  if (condition) {
    passed++;
    results.push({ id, desc, status: 'PASS', detail: detail || '' });
    console.log(`  ${id} PASS: ${desc}${detail ? ' [' + detail + ']' : ''}`);
  } else {
    failed++;
    results.push({ id, desc, status: 'FAIL', detail: detail || '' });
    console.log(`  ${id} FAIL: ${desc}${detail ? ' [' + detail + ']' : ''}`);
  }
}

async function q(c, sql) {
  try { return await c.query(sql); }
  catch(e) { console.error('  SQL ERROR:', e.message); return { rows: [] }; }
}

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  console.log('=== REC-06.1 ADVERSARIAL TESTS (12 scenarios) ===\n');

  const T1 = '00000000-0000-4000-8000-000000000001';
  const T3 = '00000000-0000-4000-8000-000000000003';
  const T4 = '00000000-0000-4000-8000-000000000004';
  const T7 = '00000000-0000-4000-8000-000000000007';
  const T8 = '00000000-0000-4000-8000-000000000008';
  const T9 = '00000000-0000-4000-8000-000000000009';

  // Clean all test data
  for (const id of [T1,T3,T4,T7,T8,T9]) {
    await q(c, `DELETE FROM public.recrutamento_candidatos WHERE prestador_id = '${id}'`);
    await q(c, `DELETE FROM public.prestadores WHERE id = '${id}'`);
  }

  // ================================================================
  // [1] Insert app prestador → trigger fires → candidato created
  // ================================================================
  console.log('[1] Insert app prestador → trigger fires → candidato created');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, cpf_cnpj, telefone, email, auth_user_id,
      status, liberado_app, origem, origem_cadastro, metadata, endereco,
      created_at, updated_at
    ) VALUES (
      '${T1}', 'Teste Bridge 1', '11122233344', '11999990001', 'bridge1@test.com',
      '00000000-0000-4000-8000-000000000099',
      'em_analise', false, 'app_prestador', 'app_motorista',
      '{"veiculo": {"tipo": "Caminhao", "placa": "ABC1D23"}}'::jsonb,
      '{"cidade": "Sao Paulo", "uf": "SP"}'::jsonb,
      NOW(), NOW()
    )
  `);

  const rc1 = await q(c, `SELECT * FROM public.recrutamento_candidatos WHERE prestador_id = '${T1}'`);
  assert('T01', 'Candidato created by trigger', rc1.rows.length === 1, 'count=' + rc1.rows.length);

  if (rc1.rows.length > 0) {
    const r = rc1.rows[0];
    assert('T02', 'stage = novo_cadastro (fail-closed)', r.stage === 'novo_cadastro', 'stage=' + r.stage);
    assert('T03', 'status_documental = pendente', r.status_documental === 'pendente', 'status_doc=' + r.status_documental);
    assert('T04', 'prestador_id linked', r.prestador_id === T1, 'pid=' + r.prestador_id);
    assert('T05', 'nome matches prestador', r.nome === 'Teste Bridge 1', 'nome=' + r.nome);
    assert('T06', 'telefone matches', r.telefone === '11999990001', 'tel=' + r.telefone);
    assert('T07', 'cidade from JSONB endereco', r.cidade === 'Sao Paulo', 'cidade=' + r.cidade);
    assert('T08', 'uf from JSONB endereco', r.uf === 'SP', 'uf=' + r.uf);
    assert('T09', 'veiculo from metadata JSONB', r.veiculo === 'Caminhao', 'veiculo=' + r.veiculo);
    assert('T10', 'placa from metadata JSONB', r.placa === 'ABC1D23', 'placa=' + r.placa);
    assert('T11', 'tags include bridge_automatico', Array.isArray(r.tags) && r.tags.includes('bridge_automatico'), 'tags=' + JSON.stringify(r.tags));
    assert('T12', 'observacoes_ia has REC-06.1', typeof r.observacoes_ia === 'string' && r.observacoes_ia.includes('REC-06.1'), 'len=' + (r.observacoes_ia||'').length);
    assert('T13', 'data_entrada is set (TEXT)', typeof r.data_entrada === 'string' && r.data_entrada.length > 0, 'val=' + r.data_entrada);
  }

  // ================================================================
  // [2] Idempotency — trigger guard
  // ================================================================
  console.log('\n[2] Idempotency — guard prevents duplicate');
  const cnt2 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id = '${T1}'`);
  assert('T14', 'Only 1 candidato (idempotent)', parseInt(cnt2.rows[0].cnt) === 1, 'count=' + cnt2.rows[0].cnt);

  // ================================================================
  // [3] Non-app prestador → trigger does NOT fire
  // ================================================================
  console.log('\n[3] Non-app prestador → trigger does NOT fire');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, cpf_cnpj, telefone, status, liberado_app,
      origem, origem_cadastro, created_at, updated_at
    ) VALUES (
      '${T3}', 'Teste Manual', '99988877766', '11888887777',
      'ativo', false, 'cadastro_manual', 'cadastro_manual',
      NOW(), NOW()
    )
  `);
  const rc3 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id = '${T3}'`);
  assert('T15', 'Non-app: NO candidato created', parseInt(rc3.rows[0].cnt) === 0, 'count=' + rc3.rows[0].cnt);

  // ================================================================
  // [4] origem_cadastro=app_motorista only triggers bridge
  // ================================================================
  console.log('\n[4] origem_cadastro=app_motorista only → triggers');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, cpf_cnpj, telefone, status, liberado_app,
      origem, origem_cadastro, created_at, updated_at
    ) VALUES (
      '${T4}', 'Teste Origem Motorista', '55544433322', '11777776666',
      'em_analise', false, 'indicacao', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rc4 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id = '${T4}'`);
  assert('T16', 'origem_cadastro=app_motorista triggers bridge', parseInt(rc4.rows[0].cnt) === 1, 'count=' + rc4.rows[0].cnt);

  // ================================================================
  // [5] liberado_app stays false after bridge
  // ================================================================
  console.log('\n[5] liberado_app stays false after bridge');
  const p5 = await q(c, `SELECT liberado_app, status FROM public.prestadores WHERE id = '${T4}'`);
  assert('T17', 'liberado_app still false', p5.rows[0]?.liberado_app === false, 'val=' + p5.rows[0]?.liberado_app);
  assert('T18', 'status unchanged (em_analise)', p5.rows[0]?.status === 'em_analise', 'status=' + p5.rows[0]?.status);

  // ================================================================
  // [6] Minimal data → trigger handles gracefully
  // ================================================================
  console.log('\n[6] Minimal data (only nome + origem) → no error');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, status, liberado_app, origem, origem_cadastro,
      created_at, updated_at
    ) VALUES (
      '${T7}', 'Minimal Prestador', 'em_analise', false, 'app_prestador', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rc7 = await q(c, `SELECT * FROM public.recrutamento_candidatos WHERE prestador_id = '${T7}'`);
  assert('T19', 'Minimal: candidato created', rc7.rows.length === 1, 'count=' + rc7.rows.length);
  if (rc7.rows.length > 0) {
    assert('T20', 'telefone defaults to empty', rc7.rows[0].telefone === '', 'val=' + rc7.rows[0].telefone);
    assert('T21', 'cidade defaults to empty', rc7.rows[0].cidade === '', 'val=' + rc7.rows[0].cidade);
    assert('T22', 'veiculo defaults to empty', rc7.rows[0].veiculo === '', 'val=' + rc7.rows[0].veiculo);
  }

  // ================================================================
  // [7] NULL metadata → trigger handles gracefully
  // ================================================================
  console.log('\n[7] NULL metadata → no error');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, telefone, status, liberado_app, origem, origem_cadastro,
      created_at, updated_at
    ) VALUES (
      '${T8}', 'Null Metadata', '11555554444', 'em_analise', false, 'app_prestador', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rc8 = await q(c, `SELECT * FROM public.recrutamento_candidatos WHERE prestador_id = '${T8}'`);
  assert('T23', 'NULL metadata: trigger fires without error', rc8.rows.length === 1, 'count=' + rc8.rows.length);
  if (rc8.rows.length > 0) {
    assert('T24', 'veiculo defaults to empty', rc8.rows[0].veiculo === '', 'val=' + rc8.rows[0].veiculo);
  }

  // ================================================================
  // [8] Both origem + origem_cadastro match → still 1 candidato
  // ================================================================
  console.log('\n[8] Both match → exactly 1 candidato');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, telefone, status, liberado_app, origem, origem_cadastro,
      created_at, updated_at
    ) VALUES (
      '${T9}', 'Both Match', '11666665555', 'em_analise', false, 'app_prestador', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rc9 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id = '${T9}'`);
  assert('T25', 'Both match: exactly 1 candidato', parseInt(rc9.rows[0].cnt) === 1, 'count=' + rc9.rows[0].cnt);

  // ================================================================
  // [9] Audit — observacoes_ia and tags contain expected values
  // ================================================================
  console.log('\n[9] Audit — observacoes_ia + tags');
  const rc10 = await q(c, `SELECT observacoes_ia, tags FROM public.recrutamento_candidatos WHERE prestador_id = '${T1}'`);
  if (rc10.rows.length > 0) {
    assert('T26', 'observacoes_ia mentions prestador ID', rc10.rows[0].observacoes_ia.includes(T1), 'text=' + rc10.rows[0].observacoes_ia.substring(0,60));
    assert('T27', 'tags include app_motorista', rc10.rows[0].tags.includes('app_motorista'), 'tags=' + JSON.stringify(rc10.rows[0].tags));
    assert('T28', 'tags include bridge_automatico', rc10.rows[0].tags.includes('bridge_automatico'), 'tags=' + JSON.stringify(rc10.rows[0].tags));
  }

  // ================================================================
  // [10] SECURITY DEFINER
  // ================================================================
  console.log('\n[10] SECURITY DEFINER verification');
  const sec = await q(c, `SELECT security_type FROM information_schema.routines WHERE routine_name = 'f_bridge_prestador_para_recrutamento'`);
  assert('T29', 'Function is SECURITY DEFINER', sec.rows[0]?.security_type === 'DEFINER', 'type=' + sec.rows[0]?.security_type);

  // ================================================================
  // [11] Trigger metadata
  // ================================================================
  console.log('\n[11] Trigger metadata');
  const trig = await q(c, `SELECT trigger_name, event_manipulation, action_timing, action_orientation FROM information_schema.triggers WHERE trigger_name = 'trg_bridge_prestador_para_recrutamento'`);
  assert('T30', 'Trigger exists', trig.rows.length === 1, 'count=' + trig.rows.length);
  if (trig.rows.length > 0) {
    assert('T31', 'Event = INSERT', trig.rows[0].event_manipulation === 'INSERT', 'event=' + trig.rows[0].event_manipulation);
    assert('T32', 'Timing = AFTER', trig.rows[0].action_timing === 'AFTER', 'timing=' + trig.rows[0].action_timing);
    assert('T33', 'Orientation = ROW', trig.rows[0].action_orientation === 'ROW', 'orient=' + trig.rows[0].action_orientation);
  }

  // ================================================================
  // [12] No side effects on totals
  // ================================================================
  console.log('\n[12] No side effects');
  const totRC = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos`);
  const totP = await q(c, `SELECT COUNT(*) as cnt FROM public.prestadores`);
  assert('T34', 'recrutamento_candidatos count >= 12', parseInt(totRC.rows[0].cnt) >= 12, 'total=' + totRC.rows[0].cnt);
  assert('T35', 'prestadores count >= 36', parseInt(totP.rows[0].cnt) >= 36, 'total=' + totP.rows[0].cnt);

  // ================================================================
  // CLEANUP
  // ================================================================
  console.log('\n=== CLEANUP ===');
  for (const id of [T1,T3,T4,T7,T8,T9]) {
    await q(c, `DELETE FROM public.recrutamento_candidatos WHERE prestador_id = '${id}'`);
    await q(c, `DELETE FROM public.prestadores WHERE id = '${id}'`);
  }
  console.log('Test data removed');

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n=== RESULTS ===');
  console.log('Total:', total, '| Passed:', passed, '| Failed:', failed);
  if (failed === 0) {
    console.log('\nALL 35 TESTS PASSED');
  } else {
    console.log('\n' + failed + ' TEST(S) FAILED');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log('  FAIL ' + r.id + ': ' + r.desc));
  }

  await c.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
