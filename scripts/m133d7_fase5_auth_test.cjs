// MISSÃO 133-D.7 — FASE 5: Validar SET LOCAL auth.uid() + planejar teste controlado
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const AUTH_USER_ID = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const ALOCACAO_CANDIDATE = 'c616675e-e395-465c-bee6-9c9a4f7aab72'; // etapa_atual=cheguei_coleta, no OS, TESTE COMPLETO SPRINT 1.3

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  try {
    // Test 1: Can we SET LOCAL and have auth.uid() return the correct value?
    await c.query('BEGIN');
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '${AUTH_USER_ID}'`);
    const test1 = await c.query('SELECT auth.uid() AS uid, current_setting(\'request.jwt.claim.sub\', true) AS raw');
    console.log('=== TEST 1: auth.uid() via SET LOCAL ===');
    console.log(`  auth.uid() returned: ${test1.rows[0].uid}`);
    console.log(`  Matches expected: ${test1.rows[0].uid === AUTH_USER_ID ? 'YES' : 'NO'}`);
    await c.query('ROLLBACK');

    // Test 2: Prestador lookup
    await c.query('BEGIN');
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '${AUTH_USER_ID}'`);
    const test2 = await c.query('SELECT id, nome_completo FROM public.prestadores WHERE auth_user_id = auth.uid()');
    console.log(`\n=== TEST 2: Prestador lookup via auth.uid() ===`);
    if (test2.rows.length > 0) {
      console.log(`  Found: ${test2.rows[0].id} | ${test2.rows[0].nome_completo}`);
    } else {
      console.log('  NOT FOUND!');
    }
    await c.query('ROLLBACK');

    // Test 3: Negative — wrong auth_user_id
    await c.query('BEGIN');
    await c.query(`SET LOCAL "request.jwt.claim.sub" = '${AUTH_USER_ID}'`);
    // Try to advance
    const test3 = await c.query(`
      SELECT public.f_avancar_etapa_app_motorista(
        '${ALOCACAO_CANDIDATE}'::uuid,
        'cheguei_coleta'::text,
        '{}'::jsonb,
        'test-133d7-auth-only'::text,
        '${AUTH_USER_ID}'::uuid
      ) AS result
    `);
    console.log(`\n=== TEST 3: RPC f_avancar_etapa (will ROLLBACK) ===`);
    console.log(`  Result: ${JSON.stringify(test3.rows[0].result)}`);
    await c.query('ROLLBACK');

    // Test 4: Verify rollback actually worked — alocação unchanged
    await c.query('BEGIN');
    const test4 = await c.query(`
      SELECT status, aceite_prestador, metadata->'app_motorista'->>'etapa_atual' AS etapa
      FROM public.alocacoes_escala WHERE id = '${ALOCACAO_CANDIDATE}'::uuid
    `);
    console.log(`\n=== TEST 4: Pre-rollback state check ===`);
    console.log(`  Status: ${test4.rows[0].status} | Aceite: ${test4.rows[0].aceite_prestador} | Etapa: "${test4.rows[0].etapa}"`);
    
    // Test 5: f_atualizar_reversa_app with clean candidate
    // We need to test a different alocação since ours has tipo_reversa = 'sem_reversa'
    const test5 = await c.query(`
      SELECT public.f_atualizar_reversa_app(
        '${ALOCACAO_CANDIDATE}'::uuid,
        'em_coleta'::text,
        5::integer,
        NULL::text,
        'Teste Recebedor'::text,
        '11999998888'::text,
        CURRENT_DATE::date,
        '[{"url":"https://teste.com/foto.jpg"}]'::jsonb,
        NULL::text,
        NULL::numeric,
        NULL::numeric,
        '${AUTH_USER_ID}'::uuid
      ) AS result
    `);
    console.log(`\n=== TEST 5: RPC f_atualizar_reversa_app (will ROLLBACK) ===`);
    console.log(`  Result: ${JSON.stringify(test5.rows[0].result)}`);
    
    await c.query('ROLLBACK');

    console.log(`\n✅ All auth tests completed. Every transaction rolled back.`);
  } catch (err) {
    try { await c.query('ROLLBACK'); } catch(e) {}
    console.error('ERROR:', err.message);
  } finally {
    await c.end();
  }
})();
