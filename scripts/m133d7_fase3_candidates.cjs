// MISSÃO 133-D.7 — FASES 3+4: Mapear candidatos e metadata das alocações
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  // 1. Metadata of the aceita candidate
  const r1 = await c.query(`
    SELECT id, ordem_servico_id, status, aceite_prestador, data_aceite,
           metadata, tipo_reversa, reversa_status
    FROM public.alocacoes_escala
    WHERE id = '4473d537-85c1-4913-8b63-02210464612a'
  `);
  console.log('=== CANDIDATE aceita ===');
  console.log(JSON.stringify(r1.rows[0], null, 2));
  if (r1.rows[0].metadata) {
    const etapa = r1.rows[0].metadata?.app_motorista?.etapa_atual;
    console.log(`\netapa_atual: "${etapa}"`);
  }

  // 2. Metadata of a few aguardando_aceite with no OS (clean candidates)
  const r2 = await c.query(`
    SELECT id, ordem_servico_id, status, aceite_prestador,
           LEFT(observacoes,80) AS obs, LEFT(rota,60) AS rota,
           metadata
    FROM public.alocacoes_escala
    WHERE prestador_id = $1 AND status = 'aguardando_aceite'
      AND ordem_servico_id IS NULL
    ORDER BY data_escala DESC NULLS LAST
    LIMIT 10
  `, [PRESTADOR_ID]);
  console.log(`\n=== aguardando_aceite SEM OS (${r2.rows.length}) ===`);
  for (const r of r2.rows) {
    const etapa = r.metadata?.app_motorista?.etapa_atual;
    console.log(`  ${r.id.substring(0,8)}... | ${r.rota||''} | ${r.obs||''} | etapa_atual: "${etapa||''}"`);
  }

  // 3. Check ALL alocações with reversa data (any prestador, any status)
  const r3 = await c.query(`
    SELECT id, prestador_id::text, ordem_servico_id, status, tipo_reversa, reversa_status,
           reversa_qtd_coletada, reversa_data_realizada, reversa_fotos IS NOT NULL AS has_fotos
    FROM public.alocacoes_escala
    WHERE tipo_reversa IS NOT NULL AND tipo_reversa != 'sem_reversa'
      AND reversa_status IS NOT NULL AND reversa_status != ''
    ORDER BY reversa_data_realizada DESC NULLS LAST
    LIMIT 20
  `);
  console.log(`\n=== REVERSA CANDIDATES (all prestadores, ${r3.rows.length}) ===`);
  for (const r of r3.rows) {
    console.log(`  ${r.id.substring(0,8)}... Prest:${(r.prestador_id||'').substring(0,8)}... | ${r.status} | ${r.tipo_reversa} | rev_st:${r.reversa_status} | qtd:${r.reversa_qtd_coletada} | fotos:${r.has_fotos?'Y':'N'}`);
  }

  // 4. The RPC also writes to financeiro_receber and financeiro_pagar when os_id exists.
  //    Check if our candidate OS has financeiro records
  const r4 = await c.query(`
    SELECT os_id, COUNT(*) AS qtd, SUM(valor) AS total
    FROM public.financeiro_receber
    WHERE os_id = ANY(ARRAY['405fe001-42f8-4cdc-b97b-a573b4d2ef3c'::text])
    GROUP BY os_id
  `);
  console.log(`\n=== FINANCEIRO for OS 405fe001 ===`);
  console.log(JSON.stringify(r4.rows));

  // 5. Check operation_timeline_events for patterns
  const r5 = await c.query(`
    SELECT DISTINCT type FROM public.operation_timeline_events WHERE source = 'app_motorista' OR driver_id IS NOT NULL LIMIT 20
  `);
  console.log(`\n=== operation_timeline_events DISTINCT types ===`);
  for (const r of r5.rows) console.log(`  ${r.type}`);

  await c.end();
})();
