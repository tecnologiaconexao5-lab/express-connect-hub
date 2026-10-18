// MISSÃO 133-D.7.1 — ETAPA 2: Validar contexto JWT + auth functions
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  console.log('=== ETAPA 2 — CONTEXTO JWT ===\n');

  // 1. auth.uid() definition
  const r1 = await c.query(`
    SELECT proname, prosrc FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  `);
  console.log('2.1 — auth.uid() definition:');
  console.log(r1.rows[0]?.prosrc || 'NOT FOUND');
  console.log();

  // 2. auth.role() definition
  const r2 = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'role' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  `);
  console.log('2.2 — auth.role() definition:');
  console.log(r2.rows[0]?.prosrc || 'NOT FOUND');
  console.log();

  // 3. auth.jwt() definition
  const r3 = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'jwt' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  `);
  console.log('2.3 — auth.jwt() definition:');
  console.log(r3.rows[0]?.prosrc || 'NOT FOUND');
  console.log();

  // 4. All auth functions for reference
  const r4 = await c.query(`
    SELECT proname, prosrc FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth') ORDER BY proname
  `);
  console.log('2.4 — ALL auth functions:');
  for (const row of r4.rows) {
    console.log(`  ${row.proname}: ${row.prosrc.substring(0, 200)}`);
  }
  console.log();

  // 5. Check what current_setting keys exist for request.jwt
  // We can't list them, but we can test which ones auth.uid/role/jwt use
  console.log('2.5 — auth.uid() raw mechanism: testing SET LOCAL');
  await c.query('BEGIN');
  await c.query(`SET LOCAL "request.jwt.claim.sub" = 'a5e51631-5ed8-430d-9041-4b185c03d821'`);
  const test5 = await c.query(`
    SELECT auth.uid() AS uid,
           auth.role() AS role,
           auth.jwt() AS jwt
  `);
  console.log(`  auth.uid(): ${test5.rows[0].uid}`);
  console.log(`  auth.role(): "${test5.rows[0].role}"`);
  console.log(`  auth.jwt():  ${JSON.stringify(test5.rows[0].jwt)}`);
  await c.query('ROLLBACK');

  // 6. Same test WITHOUT SET LOCAL
  await c.query('BEGIN');
  const test6 = await c.query(`
    SELECT auth.uid() AS uid,
           auth.role() AS role,
           auth.jwt() AS jwt
  `);
  console.log('\n2.6 — Without SET LOCAL:');
  console.log(`  auth.uid(): ${test6.rows[0].uid}`);
  console.log(`  auth.role(): "${test6.rows[0].role}"`);
  console.log(`  auth.jwt():  ${JSON.stringify(test6.rows[0].jwt)}`);
  await c.query('ROLLBACK');

  // 7. Test SET LOCAL for role + claims
  await c.query('BEGIN');
  await c.query(`SET LOCAL "request.jwt.claim.sub" = 'a5e51631-5ed8-430d-9041-4b185c03d821'`);
  await c.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated'`);
  await c.query(`SET LOCAL "request.jwt.claims" = '{"sub":"a5e51631-5ed8-430d-9041-4b185c03d821","role":"authenticated"}'`);
  const test7 = await c.query(`
    SELECT auth.uid() AS uid, auth.role() AS role,
           current_setting('request.jwt.claim.sub', true) AS raw_sub,
           current_setting('request.jwt.claim.role', true) AS raw_role
  `);
  console.log('\n2.7 — With sub + role SET:');
  console.log(`  auth.uid():  ${test7.rows[0].uid}`);
  console.log(`  auth.role(): "${test7.rows[0].role}"`);
  console.log(`  raw_sub:     ${test7.rows[0].raw_sub}`);
  console.log(`  raw_role:    ${test7.rows[0].raw_role}`);
  await c.query('ROLLBACK');

  // 8. Check if triggers or functions inside alocacoes_escala reference auth functions
  const r8 = await c.query(`
    SELECT trigger_name, action_statement::text AS stmt
    FROM information_schema.triggers
    WHERE event_object_table IN ('alocacoes_escala','ordens_servico')
  `);
  console.log('\n2.8 — Triggers that might reference auth functions:');
  for (const row of r8.rows) {
    const stmt = row.stmt.toLowerCase();
    if (stmt.includes('auth.uid') || stmt.includes('auth.role') || stmt.includes('auth.jwt') || stmt.includes('request.jwt')) {
      console.log(`  ⚠️ ${row.trigger_name}: references auth!`);
      console.log(`     ${row.stmt.substring(0, 300)}`);
    } else {
      console.log(`  ✅ ${row.trigger_name} — no auth ref`);
    }
  }

  // 9. Check policies on alocacoes_escala that reference auth
  const r9 = await c.query(`
    SELECT schemaname, tablename, policyname, permissive, roles,qual::text
    FROM pg_policies
    WHERE tablename IN ('alocacoes_escala','ordens_servico')
      AND (qual::text ILIKE '%auth.%' OR qual::text ILIKE '%request.jwt%')
  `);
  console.log('\n2.9 — Policies referencing auth functions:');
  for (const row of r9.rows) {
    console.log(`  ${row.policyname} on ${row.tablename}: ${row.qual?.substring(0, 200)}`);
  }
  if (r9.rows.length === 0) console.log('  (none reference auth functions directly)');

  // 10. Check SECURITY DEFINER — the RPC runs as owner, bypasses RLS
  console.log('\n2.10 — SECURITY DEFINER implications:');
  console.log('  f_avancar_etapa_app_motorista: SECURITY DEFINER (confirmed in M133-D.6)');
  console.log('  RLS policies: BYPASSED when called via superuser connection');
  console.log('  Grants: BYPASSED (superuser has all grants)');
  console.log('');
  console.log('  ⚠️ CALLING VIA DATABASE_URL (SUPERUSER):');
  console.log('     - Tests SQL logic and auth.uid() validation');
  console.log('     - Does NOT test RLS policies');
  console.log('     - Does NOT test grants/permissions');
  console.log('     - Does NOT test PostgREST behavior');
  console.log('');
  console.log('  ⚠️ CALLING VIA anon key + PostgREST:');
  console.log('     - Tests grants (authenticated EXECUTE)');
  console.log('     - Tests RLS policies');
  console.log('     - Tests PostgREST header/JSON parsing');
  console.log('     - Requires real JWT token');

  await c.end();
})();
