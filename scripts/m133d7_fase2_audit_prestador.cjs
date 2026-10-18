// MISSÃO 133-D.7 — FASE 2: Auditar prestador com auth_user_id (v2 - colunas corrigidas)
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await c.connect();

  // 2a. Prestador
  const r1 = await c.query(`SELECT id, nome_completo, status, auth_user_id, cpf_cnpj, email, telefone, created_at FROM public.prestadores WHERE id = $1`, [PRESTADOR_ID]);
  console.log('=== FASE 2a — PRESTADOR ===');
  console.log(JSON.stringify(r1.rows[0], null, 2));

  // 2b. Auth user confirmed
  const r1b = await c.query(`SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = $1`, [r1.rows[0].auth_user_id]);
  console.log('\n=== Auth User ===');
  console.log(JSON.stringify(r1b.rows[0], null, 2));

  // 2c. All alocações (note: column is ordem_servico_id, NOT os_id)
  const r2 = await c.query(`
    SELECT id, ordem_servico_id, status, data_escala, origem, destino,
           aceite_prestador, data_aceite, status_pagamento,
           horario_inicio_real, horario_fim_real, created_at,
           LEFT(observacoes,100) AS obs, LEFT(rota,80) AS rota
    FROM public.alocacoes_escala
    WHERE prestador_id = $1
    ORDER BY data_escala DESC NULLS LAST, created_at DESC
    LIMIT 50
  `, [PRESTADOR_ID]);
  console.log(`\n=== FASE 2c — ALOCAÇÕES (${r2.rows.length}) ===`);
  for (const r of r2.rows) {
    const osId = (r.ordem_servico_id||'').substring(0,8);
    console.log(`  ${r.id.substring(0,8)}... OS:${osId} | ${r.status.padEnd(20)} | ${r.data_escala||'NODATE'} | aceite:${r.aceite_prestador?'Y':'N'}/${r.data_aceite?r.data_aceite.toISOString().substring(0,10):'-'}`);
  }

  // 2d. Candidates: aguardando_aceite or aceita (can advance without touching real ops)
  const r3 = await c.query(`
    SELECT id, ordem_servico_id, status, data_escala, aceite_prestador, horario_inicio_real, horario_fim_real
    FROM public.alocacoes_escala
    WHERE prestador_id = $1 AND status IN ('aguardando_aceite','aceita','pendente')
    ORDER BY data_escala DESC NULLS LAST
  `, [PRESTADOR_ID]);
  console.log(`\n=== FASE 2d — CANDIDATOS AVANÇO (${r3.rows.length}) ===`);
  for (const r of r3.rows) {
    const osId = (r.ordem_servico_id||'').substring(0,8);
    console.log(`  ${r.id.substring(0,8)}... OS:${osId} | ${r.status.padEnd(20)} | ${r.data_escala||'NODATE'} | aceite:${r.aceite_prestador?'Y':'N'}`);
  }

  // 2e. OS linked
  const osIds = r2.rows.filter(r => r.ordem_servico_id).map(r => r.ordem_servico_id).filter((v,i,a)=>a.indexOf(v)===i);
  if (osIds.length > 0) {
    const r4 = await c.query(`
      SELECT id, numero, status, cliente_id::text AS cliente, data_servico, LEFT(observacoes_gerais,120) AS obs
      FROM public.ordens_servico WHERE id = ANY($1::uuid[])
    `, [osIds]);
    console.log(`\n=== FASE 2e — OS VINCULADAS (${r4.rows.length}) ===`);
    for (const r of r4.rows) {
      console.log(`  ${r.id.substring(0,8)}... ${r.numero.substring(0,30).padEnd(32)} ${r.status.padEnd(15)} | ${r.obs||''}`);
    }
  }

  // 2f. Reversa data availability
  const r5 = await c.query(`
    SELECT id, ordem_servico_id, status, tipo_reversa, reversa_status, reversa_realizada_em,
           reversa_fotos IS NOT NULL AS has_fotos
    FROM public.alocacoes_escala
    WHERE prestador_id = $1 AND tipo_reversa IS NOT NULL AND tipo_reversa != 'sem_reversa'
    ORDER BY data_escala DESC NULLS LAST
  `, [PRESTADOR_ID]);
  console.log(`\n=== FASE 2f — REVERSA CANDIDATES (${r5.rows.length}) ===`);
  for (const r of r5.rows) {
    const osId = (r.ordem_servico_id||'').substring(0,8);
    console.log(`  ${r.id.substring(0,8)}... OS:${osId} | ${r.status} | tipo:${r.tipo_reversa} | rev_status:${r.reversa_status||'null'} | fotos:${r.has_fotos?'Y':'N'}`);
  }

  await c.end();
})();
