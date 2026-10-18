const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  console.log('=== 1. TABELA operacao_mensagens ===');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='operacao_mensagens'
    ORDER BY ordinal_position`);
  cols.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | null=${r.is_nullable} | default=${r.column_default}`));

  console.log('\n=== 2. CONSTRAINTS/ÍNDICES ===');
  const idx = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='operacao_mensagens'`);
  idx.rows.forEach(r => console.log(`  ${r.indexname}: ${r.indexdef}`));

  console.log('\n=== 3. RLS POLICIES ===');
  const pol = await client.query(`
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies WHERE schemaname='public' AND tablename='operacao_mensagens'`);
  pol.rows.forEach(r => console.log(`  ${r.policyname} [${r.cmd}] roles=${r.roles} qual=${r.qual} wc=${r.with_check}`));

  console.log('\n=== 4. TRIGGERS ===');
  const trg = await client.query(`
    SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='operacao_mensagens' AND NOT t.tgisinternal`);
  trg.rows.forEach(r => console.log(`  ${r.tgname}: ${r.def}`));

  console.log('\n=== 5. RPCs relacionadas a chat/mensagem ===');
  const rpcs = await client.query(`
    SELECT p.proname, p.provolatile, p.prosecdef, pg_get_function_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND (p.proname ILIKE '%mensagem%' OR p.proname ILIKE '%chat%' OR p.proname ILIKE '%lida%'
           OR p.proname ILIKE '%conversa%' OR p.proname ILIKE '%torre%')
    ORDER BY p.proname`);
  rpcs.rows.forEach(r => console.log(`  ${r.proname}(${r.args}) volatile=${r.provolatile} securdef=${r.prosecdef}`));

  console.log('\n=== 6. RLS na tabela (ativa?) ===');
  const rls = await client.query(`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='operacao_mensagens'`);
  console.log('  ', rls.rows[0]);

  console.log('\n=== 7. GRANTS na tabela ===');
  const grants = await client.query(`
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='operacao_mensagens'`);
  grants.rows.forEach(r => console.log(`  ${r.grantee}: ${r.privilege_type}`));

  console.log('\n=== 8. DADOS (contagem + amostra recente) ===');
  const cnt = await client.query(`SELECT count(*)::int AS n, min(created_at) AS min, max(created_at) AS max FROM operacao_mensagens`);
  console.log('  total:', cnt.rows[0]);
  const sample = await client.query(`
    SELECT id, alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
           left(mensagem,60) AS msg, status, read_at, created_at, metadata
    FROM operacao_mensagens ORDER BY created_at DESC LIMIT 5`);
  sample.rows.forEach(r => console.log('  ', JSON.stringify(r)));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });