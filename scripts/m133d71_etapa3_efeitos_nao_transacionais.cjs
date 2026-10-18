// MISSÃO 133-D.7.1 — ETAPA 3: Buscar efeitos não transacionais (pg_net, http, webhook, NOTIFY, etc.)
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  console.log('=== ETAPA 3 — EFEITOS NÃO TRANSACIONAIS ===\n');

  // 1. Check all extensions
  const r1 = await c.query(`SELECT * FROM pg_extension ORDER BY extname`);
  console.log('3.1 — EXTENSIONS INSTALLED:');
  for (const row of r1.rows) {
    console.log(`  ${row.extname} (${row.extversion})`);
  }
  console.log();

  // 2. Search for pg_net usage
  const r2 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%pg_net%'
       OR prosrc::text ILIKE '%net.http%'
       OR prosrc::text ILIKE '%http_post%'
       OR prosrc::text ILIKE '%http_get%'
       OR prosrc::text ILIKE '%http%'
  `);
  console.log('3.2 — pg_net / http references in functions:');
  if (r2.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r2.rows) console.log(`  ⚠️ ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 3. Search for webhook references
  const r3 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%webhook%'
  `);
  console.log('\n3.3 — webhook references:');
  if (r3.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r3.rows) console.log(`  ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 4. Search for NOTIFY/LISTEN in functions
  const r4 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%notify%'
       OR prosrc::text ILIKE '%listen%'
  `);
  console.log('\n3.4 — NOTIFY/LISTEN references:');
  if (r4.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r4.rows) console.log(`  ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 5. Search for supabase_functions or edge function references
  const r5 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%supabase_functions%'
       OR prosrc::text ILIKE '%edge%function%'
       OR prosrc::text ILIKE '%supabase%'
       OR prosrc::text ILIKE '%functions%'
  `);
  console.log('\n3.5 — Edge Function references:');
  if (r5.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r5.rows) console.log(`  ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 6. Search for storage references in functions/triggers
  const r6 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%storage%'
       OR prosrc::text ILIKE '%bucket%'
       OR prosrc::text ILIKE '%object%'
  `);
  console.log('\n3.6 — Storage references in functions:');
  if (r6.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r6.rows) console.log(`  ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 7. Search for email/whatsapp references
  const r7 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%email%'
       OR prosrc::text ILIKE '%whatsapp%'
       OR prosrc::text ILIKE '%zoho%'
       OR prosrc::text ILIKE '%evolution%'
       OR prosrc::text ILIKE '%smtp%'
  `);
  console.log('\n3.7 — Email/WhatsApp references in functions:');
  if (r7.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r7.rows) console.log(`  ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 8. Search for queue/job/fila references
  const r8 = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE prosrc::text ILIKE '%queue%'
       OR prosrc::text ILIKE '%job%'
       OR prosrc::text ILIKE '%fila%'
       OR prosrc::text ILIKE '%trabalho%'
       OR prosrc::text ILIKE '%worker%'
  `);
  console.log('\n3.8 — Queue/job/fila references:');
  if (r8.rows.length === 0) console.log('  ✅ NONE FOUND');
  else for (const row of r8.rows) console.log(`  ${row.proname}: ${row.prosrc.substring(0,200)}`);

  // 9. Search for extensions that can make external calls
  const r9 = await c.query(`SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_net','pg_cron','pg_tle','pgmq','pg_event','http','plrust')`);
  console.log('\n3.9 — Extensions with network capability:');
  if (r9.rows.length === 0) console.log('  ✅ NONE (pg_net not installed)');
  else for (const row of r9.rows) console.log(`  ⚠️ ${row.extname} v${row.extversion}`);

  // 10. Search in f_avancar_etapa_app_motorista specifically for any non-transactional patterns
  const r10 = await c.query(`
    SELECT prosrc::text FROM pg_proc
    WHERE proname = 'f_avancar_etapa_app_motorista'
  `);
  const rpcSrc = r10.rows[0]?.prosrc || '';
  const patterns = ['pg_net', 'http', 'webhook', 'notify', 'edge', 'function', 'storage', 'bucket', 'email', 'whatsapp', 'queue', 'job', 'worker', 'supabase', 'net.http'];
  console.log('\n3.10 — Specific scan of f_avancar_etapa_app_motorista:');
  for (const pat of patterns) {
    if (rpcSrc.toLowerCase().includes(pat.toLowerCase())) {
      console.log(`  ⚠️ Contains "${pat}"!`);
    }
  }
  // Also check trigger functions
  console.log('  Scanning all trigger functions related to alocacoes_escala...');
  const r10b = await c.query(`
    SELECT proname, prosrc::text FROM pg_proc
    WHERE proname IN ('f_trg_cancelar_financeiro_alocacao','f_trg_propagar_financeiro_alocacao',
                       'trg_evento_operacao_finalizada','trg_evento_prestador_aceitou',
                       'registrar_historico_alocacao')
  `);
  let hasNonTransactional = false;
  for (const row of r10b.rows) {
    const src = row.prosrc.toLowerCase();
    for (const pat of patterns) {
      if (src.includes(pat.toLowerCase())) {
        console.log(`  ⚠️ ${row.proname} contains "${pat}"!`);
        hasNonTransactional = true;
      }
    }
  }
  if (!hasNonTransactional) console.log('  ✅ All trigger functions clear of non-transactional patterns');

  // 11. Realtime / publication check
  const r11 = await c.query(`
    SELECT pubname, schemaname, tablename FROM pg_publication_tables
    WHERE tablename IN ('alocacoes_escala','eventos_oficiais','operation_timeline_events','historico_alocacoes_escala')
  `);
  console.log('\n3.11 — Publications (Realtime):');
  for (const row of r11.rows) {
    console.log(`  ${row.pubname}: ${row.schemaname}.${row.tablename}`);
  }
  if (r11.rows.length === 0) console.log('  (none found — no Realtime publications for these tables)');

  await c.end();
})();
