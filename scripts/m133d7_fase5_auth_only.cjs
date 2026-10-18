// MISSÃO 133-D.7 — FASE 5: Validar SET LOCAL auth.uid() (SELECT-only) + planejar
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const AUTH_USER_ID = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const ALOCACAO_TEST = '76af8e4a-a3bc-492a-897d-4556574cc5d1'; // aguardando_aceite, etapa_atual=empty, no OS, ROTA TESTE
const ALOCACAO_ADVANCED = 'c616675e-e395-465c-bee6-9c9a4f7aab72'; // etapa_atual=cheguei_coleta, no OS
const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  try {
    // Test 1: Can we SET LOCAL auth.uid()?
    await c.query('BEGIN');
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '${AUTH_USER_ID}'`);
    const test1 = await c.query('SELECT auth.uid() AS uid, current_setting(\'request.jwt.claim.sub\', true) AS raw');
    console.log('=== TEST 1: auth.uid() via SET LOCAL ===');
    console.log(`  auth.uid() returned: ${test1.rows[0].uid}`);
    console.log(`  Matches expected (${AUTH_USER_ID}): ${test1.rows[0].uid === AUTH_USER_ID ? 'YES ✅' : 'NO ❌'}`);
    await c.query('ROLLBACK');

    // Test 2: Prestador lookup via auth.uid()
    await c.query('BEGIN');
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '${AUTH_USER_ID}'`);
    const test2 = await c.query('SELECT id, nome_completo, status FROM public.prestadores WHERE auth_user_id = auth.uid()');
    console.log(`\n=== TEST 2: Prestador lookup via auth.uid() ===`);
    if (test2.rows.length > 0) {
      console.log(`  Found: ${test2.rows[0].id} | ${test2.rows[0].nome_completo} | ${test2.rows[0].status} ✅`);
    } else {
      console.log(`  NOT FOUND ❌ (auth.uid()=${test1.rows[0].uid})`);
    }
    await c.query('ROLLBACK');

    // Test 3: Negative — SET LOCAL to a non-existent user
    await c.query('BEGIN');
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000000'`);
    const test3 = await c.query('SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()');
    console.log(`\n=== TEST 3: Negative — non-existent auth_user_id ===`);
    console.log(`  Prestadores found: ${test3.rows.length} (expected 0) ${test3.rows.length === 0 ? '✅' : '❌'}`);
    await c.query('ROLLBACK');

    // Test 4: Details of the clean candidate
    const test4 = await c.query(`
      SELECT id, status, aceite_prestador, data_aceite, ordem_servico_id,
             metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
             LEFT(rota,60) AS rota, LEFT(observacoes,60) AS obs,
             tipo_reversa, reversa_status
      FROM public.alocacoes_escala
      WHERE id = '${ALOCACAO_TEST}'::uuid
    `);
    console.log(`\n=== TEST 4: CANDIDATE DETAILS (${ALOCACAO_TEST.substring(0,8)}...) ===`);
    console.log(JSON.stringify(test4.rows[0], null, 2));

    // Test 5: Advanced candidate
    const test5 = await c.query(`
      SELECT id, status, ordem_servico_id,
             metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
             tipo_reversa, reversa_status
      FROM public.alocacoes_escala
      WHERE id = '${ALOCACAO_ADVANCED}'::uuid
    `);
    console.log(`\n=== TEST 5: ADVANCED CANDIDATE (${ALOCACAO_ADVANCED.substring(0,8)}...) ===`);
    console.log(JSON.stringify(test5.rows[0], null, 2));

    // Test 6: Verify auth.uid() with no SET LOCAL (should be NULL)
    await c.query('BEGIN');
    const test6 = await c.query('SELECT auth.uid() AS uid');
    console.log(`\n=== TEST 6: auth.uid() without SET LOCAL ===`);
    console.log(`  auth.uid() is: ${test6.rows[0].uid} (expected NULL) ${test6.rows[0].uid === null ? '✅' : '❌'}`);
    await c.query('ROLLBACK');

    console.log(`\n✅ All auth validation tests completed (SELECT only, no DML).`);

  } catch (err) {
    try { await c.query('ROLLBACK'); } catch(e) {}
    console.error('ERROR:', err.message);
  } finally {
    await c.end();
  }
})();
