/**
 * CORE-OS-LINK-01 — Step 0 supplemental: verify trigger + find latest allocations
 * READ-ONLY. Zero writes.
 */
const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // 1. Confirm fix present in trigger body
  const t = await c.query("SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao'");
  const body = t.rows[0]?.prosrc || '';
  const hasUpdate = body.includes('UPDATE alocacoes_escala') && body.includes('ordem_servico_id') && body.includes('v_os_id');
  console.log('FIX_PRESENT_IN_TRIGGER:', hasUpdate ? 'YES' : 'NO');

  // 2. Latest allocations (any date)
  const latest = await c.query('SELECT id, created_at, status, ordem_servico_id, prestador_id, origem FROM alocacoes_escala ORDER BY created_at DESC LIMIT 5');
  console.log('\nLATEST_ALLOCATIONS (any date):');
  for (const r of latest.rows) {
    console.log('  id=' + r.id);
    console.log('    created_at=' + r.created_at);
    console.log('    status=' + r.status);
    console.log('    ordem_servico_id=' + r.ordem_servico_id);
    console.log('    prestador_id=' + r.prestador_id);
    console.log('    origem=' + r.origem);
  }

  // 3. Total counts
  const counts = await c.query('SELECT COUNT(*) AS total, COUNT(ordem_servico_id) AS with_os FROM alocacoes_escala');
  console.log('\nTOTAL_ALLOCATIONS: ' + counts.rows[0].total);
  console.log('WITH_OS: ' + counts.rows[0].with_os);
  console.log('WITHOUT_OS: ' + (counts.rows[0].total - counts.rows[0].with_os));

  // 4. Latest allocations with ordem_servico_id filled
  const linked = await c.query('SELECT id, created_at, status, ordem_servico_id, prestador_id FROM alocacoes_escala WHERE ordem_servico_id IS NOT NULL ORDER BY created_at DESC LIMIT 5');
  console.log('\nLATEST_LINKED (ordem_servico_id IS NOT NULL):');
  for (const r of linked.rows) {
    console.log('  id=' + r.id + ' | created=' + r.created_at + ' | os_id=' + r.ordem_servico_id);
  }

  // 5. Deploy date check - any allocations in September 2026?
  const sept = await c.query("SELECT COUNT(*) AS cnt FROM alocacoes_escala WHERE created_at >= '2026-09-01'");
  console.log('\nALLOCATIONS_SINCE_2026-09-01: ' + sept.rows[0].cnt);

  // 6. Any allocations in last 7 days?
  const recent = await c.query("SELECT COUNT(*) AS cnt FROM alocacoes_escala WHERE created_at >= NOW() - INTERVAL '7 days'");
  console.log('ALLOCATIONS_LAST_7_DAYS: ' + recent.rows[0].cnt);

  // 7. Most recent allocation overall
  const mostRecent = await c.query('SELECT id, created_at, status, ordem_servico_id FROM alocacoes_escala ORDER BY created_at DESC LIMIT 1');
  if (mostRecent.rows.length > 0) {
    const mr = mostRecent.rows[0];
    console.log('\nMOST_RECENT_ALLOCATION:');
    console.log('  id=' + mr.id);
    console.log('  created_at=' + mr.created_at);
    console.log('  status=' + mr.status);
    console.log('  ordem_servico_id=' + mr.ordem_servico_id);
  }

  // 8. Deploy verification - check the trigger body for the fix line
  const fixLine = body.split('\n').find(l => l.includes('UPDATE alocacoes_escala') && l.includes('ordem_servico_id'));
  console.log('\nFIX_LINE_IN_TRIGGER: ' + (fixLine || 'NOT FOUND').trim());

  await c.end();
})();
