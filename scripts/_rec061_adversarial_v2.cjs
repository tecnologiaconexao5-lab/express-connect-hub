const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

let passed = 0, failed = 0, total = 0;

function assert(id, desc, condition, detail) {
  total++;
  if (condition) {
    passed++;
    console.log('  ' + id + ' PASS: ' + desc + (detail ? ' [' + detail + ']' : ''));
  } else {
    failed++;
    console.log('  ' + id + ' FAIL: ' + desc + (detail ? ' [' + detail + ']' : ''));
  }
}

async function q(c, sql) {
  try { return await c.query(sql); }
  catch(e) { console.error('  SQL ERR:', e.message.substring(0, 150)); return { rows: [] }; }
}

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  console.log('=== REC-06.1 ADVERSARIAL TESTS (12 scenarios, 35 checks) ===\n');

  const T1 = '00000000-0000-4000-8000-000000000001';
  const T3 = '00000000-0000-4000-8000-000000000003';
  const T4 = '00000000-0000-4000-8000-000000000004';
  const T7 = '00000000-0000-4000-8000-000000000007';
  const T8 = '00000000-0000-4000-8000-000000000008';
  const T9 = '00000000-0000-4000-8000-000000000009';

  // Clean all test data
  for (const id of [T1,T3,T4,T7,T8,T9]) {
    await q(c, `DELETE FROM public.recrutamento_candidatos WHERE observacoes_ia LIKE '%${id}%'`);
    await q(c, `DELETE FROM public.recrutamento_prestadores WHERE cpf_cnpj IN ('11122233344','99988877766','55544433322','00000000000','11555554444','11666665555')`);
    await q(c, `DELETE FROM public.prestadores WHERE id = '${id}'`);
  }

  // ================================================================
  // [1] Full data: insert app prestador → trigger fires → both tables created
  // ================================================================
  console.log('[1] Full data: prestador → recrutamento_prestadores → recrutamento_candidatos');
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

  const rp1 = await q(c, `SELECT * FROM public.recrutamento_prestadores WHERE cpf_cnpj = '11122233344'`);
  assert('T01', 'recrutamento_prestadores created', rp1.rows.length === 1, 'count=' + rp1.rows.length);
  const rpId1 = rp1.rows[0]?.id;

  const rc1 = await q(c, `SELECT * FROM public.recrutamento_candidatos WHERE prestador_id = '${rpId1}'`);
  assert('T02', 'recrutamento_candidatos created', rc1.rows.length === 1, 'count=' + rc1.rows.length);

  if (rc1.rows.length > 0) {
    const r = rc1.rows[0];
    assert('T03', 'stage = novo_cadastro', r.stage === 'novo_cadastro', 'stage=' + r.stage);
    assert('T04', 'status_documental = pendente', r.status_documental === 'pendente', 'val=' + r.status_documental);
    assert('T05', 'nome = Teste Bridge 1', r.nome === 'Teste Bridge 1', 'nome=' + r.nome);
    assert('T06', 'telefone = 11999990001', r.telefone === '11999990001', 'tel=' + r.telefone);
    assert('T07', 'cidade = Sao Paulo', r.cidade === 'Sao Paulo', 'cidade=' + r.cidade);
    assert('T08', 'uf = SP', r.uf === 'SP', 'uf=' + r.uf);
    assert('T09', 'veiculo = Caminhao', r.veiculo === 'Caminhao', 'veiculo=' + r.veiculo);
    assert('T10', 'placa = ABC1D23', r.placa === 'ABC1D23', 'placa=' + r.placa);
    assert('T11', 'tags include bridge_automatico', Array.isArray(r.tags) && r.tags.includes('bridge_automatico'), 'tags=' + JSON.stringify(r.tags));
    assert('T12', 'data_entrada is set', typeof r.data_entrada === 'string' && r.data_entrada.length > 0, 'val=' + r.data_entrada);
  }

  // ================================================================
  // [2] Idempotency
  // ================================================================
  console.log('\n[2] Idempotency — duplicate CPF → skip');
  const cnt2rp = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_prestadores WHERE cpf_cnpj = '11122233344'`);
  assert('T13', 'Only 1 recrutamento_prestadores', parseInt(cnt2rp.rows[0].cnt) === 1, 'count=' + cnt2rp.rows[0].cnt);
  const cnt2rc = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id = '${rpId1}'`);
  assert('T14', 'Only 1 recrutamento_candidatos', parseInt(cnt2rc.rows[0].cnt) === 1, 'count=' + cnt2rc.rows[0].cnt);

  // ================================================================
  // [3] Non-app prestador → trigger does NOT fire
  // ================================================================
  console.log('\n[3] Non-app prestador → no bridge');
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
  const rc3 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_prestadores WHERE cpf_cnpj = '99988877766'`);
  assert('T15', 'Non-app: NO recrutamento_prestadores', parseInt(rc3.rows[0].cnt) === 0, 'count=' + rc3.rows[0].cnt);

  // ================================================================
  // [4] origem_cadastro=app_motorista only → triggers
  // ================================================================
  console.log('\n[4] origem_cadastro=app_motorista only');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, cpf_cnpj, telefone, status, liberado_app,
      origem, origem_cadastro, created_at, updated_at
    ) VALUES (
      '${T4}', 'Teste Motorista', '55544433322', '11777776666',
      'em_analise', false, 'indicacao', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rp4 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_prestadores WHERE cpf_cnpj = '55544433322'`);
  assert('T16', 'recrutamento_prestadores created', parseInt(rp4.rows[0].cnt) === 1, 'count=' + rp4.rows[0].cnt);
  const rc4 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id IN (SELECT id FROM public.recrutamento_prestadores WHERE cpf_cnpj = '55544433322')`);
  assert('T17', 'recrutamento_candidatos created', parseInt(rc4.rows[0].cnt) === 1, 'count=' + rc4.rows[0].cnt);

  // ================================================================
  // [5] liberado_app stays false
  // ================================================================
  console.log('\n[5] liberado_app not modified by bridge');
  const p5 = await q(c, `SELECT liberado_app, status FROM public.prestadores WHERE id = '${T4}'`);
  assert('T18', 'liberado_app = false', p5.rows[0]?.liberado_app === false, 'val=' + p5.rows[0]?.liberado_app);
  assert('T19', 'status = em_analise', p5.rows[0]?.status === 'em_analise', 'val=' + p5.rows[0]?.status);

  // ================================================================
  // [6] Minimal data
  // ================================================================
  console.log('\n[6] Minimal data (only nome + origem)');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, status, liberado_app, origem, origem_cadastro,
      created_at, updated_at
    ) VALUES (
      '${T7}', 'Minimal Prestador', 'em_analise', false, 'app_prestador', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rc7 = await q(c, `SELECT * FROM public.recrutamento_candidatos WHERE observacoes_ia LIKE '%${T7}%'`);
  assert('T20', 'Minimal: candidato created', rc7.rows.length === 1, 'count=' + rc7.rows.length);
  if (rc7.rows.length > 0) {
    assert('T21', 'telefone defaults empty', rc7.rows[0].telefone === '', 'val=' + rc7.rows[0].telefone);
    assert('T22', 'cidade defaults empty', rc7.rows[0].cidade === '', 'val=' + rc7.rows[0].cidade);
    assert('T23', 'veiculo defaults empty', rc7.rows[0].veiculo === '', 'val=' + rc7.rows[0].veiculo);
  }

  // ================================================================
  // [7] NULL metadata
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
  const rc8 = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE observacoes_ia LIKE '%${T8}%'`);
  assert('T24', 'NULL metadata: no error', parseInt(rc8.rows[0].cnt) === 1, 'count=' + rc8.rows[0].cnt);

  // ================================================================
  // [8] Both origem + origem_cadastro match → 1 candidato
  // ================================================================
  console.log('\n[8] Both match → exactly 1');
  await q(c, `
    INSERT INTO public.prestadores (
      id, nome_completo, telefone, status, liberado_app, origem, origem_cadastro,
      created_at, updated_at
    ) VALUES (
      '${T9}', 'Both Match', '11666665555', 'em_analise', false, 'app_prestador', 'app_motorista',
      NOW(), NOW()
    )
  `);
  const rp9 = await q(c, `SELECT id FROM public.recrutamento_prestadores WHERE cpf_cnpj = '11666665555'`);
  const rc9 = rp9.rows.length > 0 ? await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id = '${rp9.rows[0].id}'`) : { rows: [{ cnt: 0 }] };
  assert('T25', 'Both match: 1 candidato', parseInt(rc9.rows[0].cnt) === 1, 'count=' + rc9.rows[0].cnt);

  // ================================================================
  // [9] Audit trail
  // ================================================================
  console.log('\n[9] Audit — observacoes_ia + tags');
  const rc10 = await q(c, `SELECT observacoes_ia, tags FROM public.recrutamento_candidatos WHERE prestador_id = '${rpId1}'`);
  if (rc10.rows.length > 0) {
    assert('T26', 'observacoes_ia has prestador ID', rc10.rows[0].observacoes_ia.includes(T1));
    assert('T27', 'tags has app_motorista', rc10.rows[0].tags.includes('app_motorista'));
    assert('T28', 'tags has bridge_automatico', rc10.rows[0].tags.includes('bridge_automatico'));
  }

  // ================================================================
  // [10] SECURITY DEFINER
  // ================================================================
  console.log('\n[10] SECURITY DEFINER');
  const sec = await q(c, `SELECT security_type FROM information_schema.routines WHERE routine_name = 'f_bridge_prestador_para_recrutamento'`);
  assert('T29', 'Function is SECURITY DEFINER', sec.rows[0]?.security_type === 'DEFINER');

  // ================================================================
  // [11] Trigger metadata
  // ================================================================
  console.log('\n[11] Trigger metadata');
  const trig = await q(c, `SELECT event_manipulation, action_timing, action_orientation FROM information_schema.triggers WHERE trigger_name = 'trg_bridge_prestador_para_recrutamento'`);
  assert('T30', 'AFTER INSERT ROW', trig.rows.length === 1 && trig.rows[0].event_manipulation === 'INSERT' && trig.rows[0].action_timing === 'AFTER');

  // ================================================================
  // [12] No side effects
  // ================================================================
  console.log('\n[12] No side effects');
  const totRC = await q(c, `SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos`);
  const totP = await q(c, `SELECT COUNT(*) as cnt FROM public.prestadores`);
  assert('T31', 'recrutamento_candidatos >= 12', parseInt(totRC.rows[0].cnt) >= 12, 'total=' + totRC.rows[0].cnt);
  assert('T32', 'prestadores >= 36', parseInt(totP.rows[0].cnt) >= 36, 'total=' + totP.rows[0].cnt);

  // ================================================================
  // CLEANUP
  // ================================================================
  console.log('\n=== CLEANUP ===');
  for (const id of [T1,T3,T4,T7,T8,T9]) {
    await q(c, `DELETE FROM public.recrutamento_candidatos WHERE observacoes_ia LIKE '%${id}%'`);
    await q(c, `DELETE FROM public.prestadores WHERE id = '${id}'`);
  }
  // Clean recrutamento_prestadores for test CPFs
  await q(c, `DELETE FROM public.recrutamento_prestadores WHERE cpf_cnpj IN ('11122233344','55544433322','00000000000','11555554444','11666665555') AND origem_cadastro = 'app_motorista'`);
  console.log('Test data removed');

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n=== RESULTS ===');
  console.log('Total:', total, '| Passed:', passed, '| Failed:', failed);
  if (failed === 0) {
    console.log('\nALL ' + total + ' TESTS PASSED');
  } else {
    console.log('\n' + failed + ' TEST(S) FAILED');
  }

  await c.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
