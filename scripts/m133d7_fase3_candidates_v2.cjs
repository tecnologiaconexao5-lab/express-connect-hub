// MISSÃO 133-D.7 — FASES 3+4: Find correct candidate IDs
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  // List all alocações for this prestador with full IDs and metadata snippet
  const r = await c.query(`
    SELECT id, ordem_servico_id, status, aceite_prestador, data_aceite,
           metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
           tipo_reversa, reversa_status,
           LEFT(observacoes,60) AS obs, LEFT(rota,60) AS rota
    FROM public.alocacoes_escala
    WHERE prestador_id = $1
    ORDER BY data_escala DESC NULLS LAST
    LIMIT 50
  `, [PRESTADOR_ID]);

  console.log('=== ALL ALOCAÇÕES FOR TEST PRESTADOR ===\n');
  for (const row of r.rows) {
    const metaEtapa = row.etapa_atual || '(empty)';
    const os = row.ordem_servico_id ? row.ordem_servico_id.substring(0,8) : 'NULL';
    console.log(`ID: ${row.id}`);
    console.log(`  OS:${os} | ${row.status} | aceite:${row.aceite_prestador?'Y':'N'} | etapa_atual: ${metaEtapa}`);
    console.log(`  reversa: ${row.tipo_reversa||'sem_reversa'} / ${row.reversa_status||'null'}`);
    if (row.rota || row.obs) console.log(`  ${row.rota||''} | ${row.obs||''}`);
    console.log('');
  }

  // Also check which IDs are in operation_timeline_events
  const r2 = await c.query(`
    SELECT DISTINCT operation_id, type, title, event_time
    FROM public.operation_timeline_events
    WHERE operation_id IN (SELECT id::text FROM public.alocacoes_escala WHERE prestador_id = $1)
    ORDER BY event_time DESC
    LIMIT 30
  `, [PRESTADOR_ID]);
  console.log(`\n=== operation_timeline_events for candidate alocações (${r2.rows.length}) ===`);
  for (const row of r2.rows) {
    console.log(`  ${row.operation_id.substring(0,8)}... | ${row.type} | ${row.title} | ${row.event_time || ''}`);
  }

  // And check eventos_oficiais
  const r3 = await c.query(`
    SELECT entity_id, event_type, source, created_at
    FROM public.eventos_oficiais
    WHERE entity_id IN (SELECT id::text FROM public.alocacoes_escala WHERE prestador_id = $1)
    ORDER BY created_at DESC
    LIMIT 30
  `, [PRESTADOR_ID]);
  console.log(`\n=== eventos_oficiais for candidate alocações (${r3.rows.length}) ===`);
  for (const row of r3.rows) {
    console.log(`  ${row.entity_id.substring(0,8)}... | ${row.event_type} | ${row.source||'null'} | ${row.created_at || ''}`);
  }

  await c.end();
})();
