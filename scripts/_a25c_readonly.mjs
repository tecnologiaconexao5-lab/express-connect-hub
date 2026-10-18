import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-C ============
// 1) Achar a OS OS-HML-MULTI-001
const os = await pool.query(`
  SELECT id, numero, status, cliente, origem, destino, created_at, updated_at,
         localizacao_entrega_json, enderecos
  FROM public.ordens_servico
  WHERE numero ILIKE '%HML-MULTI%' OR numero ILIKE '%MULTI-001%'
  ORDER BY created_at DESC LIMIT 10
`);
console.log('=== ORDENS OS-HML-MULTI-001 ===');
for (const o of os.rows) console.log(JSON.stringify(o, null, 2));

// 2) Alocações vinculadas a essas OS
const osIds = os.rows.map(o => o.id).filter(Boolean);
if (osIds.length) {
  const alocs = await pool.query(`
    SELECT ae.id, ae.status, ae.finalizada, ae.data_escala, ae.ordem_servico_id,
           ae.prestador_id, ae.cliente_id, ae.tenant_id, ae.placa, ae.tipo_veiculo,
           ae.updated_at,
           ae.metadata->'app_motorista'->>'etapa_atual' AS app_etapa,
           ae.metadata->'app_motorista'->>'ultima_acao' AS app_ultima_acao
    FROM public.alocacoes_escala ae
    WHERE ae.ordem_servico_id = ANY($1::uuid[])
    ORDER BY ae.updated_at DESC
  `, [osIds]);
  console.log('\n=== ALOCAÇÕES DA OS-HML-MULTI-001 ===');
  for (const a of alocs.rows) console.log(JSON.stringify(a, null, 2));

  const alocIds = alocs.rows.map(a => a.id).filter(Boolean);

  // 3) Posições de tracking para essas alocações
  if (alocIds.length) {
    const pos = await pool.query(`
      SELECT id, alocacao_id, os_id, prestador_id, veiculo_id, cliente_id,
             latitude, longitude, status, origem, captured_at, created_at, updated_at,
             velocidade, precisao, direcao, bateria, metadata
      FROM public.portal_tracking_realtime
      WHERE alocacao_id = ANY($1::uuid[])
      ORDER BY captured_at DESC NULLS LAST, created_at DESC
    `, [alocIds]);
    console.log('\n=== POSIÇÕES TRACKING DAS ALOCAÇÕES HML-MULTI-001 ===');
    console.log('Total:', pos.rows.length);
    for (const p of pos.rows) console.log(JSON.stringify(p));
  }
}

// 4) Últimas posições GERAIS (24h) — ver se o Redmi gravou algo recente em qualquer lugar
const geral = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, latitude, longitude, status, origem,
         captured_at, created_at
  FROM public.portal_tracking_realtime
  WHERE created_at > now() - interval '48 hours'
  ORDER BY created_at DESC
  LIMIT 30
`);
console.log('\n=== POSIÇÕES GERAIS (últimas 48h) ===');
console.log('Total:', geral.rows.length);
for (const p of geral.rows) console.log(JSON.stringify(p));

// 5) PRESTADOR TESTE APP auth status
const prest = await pool.query(`
  SELECT id, nome_completo, status, liberado_app, auth_user_id, tenant_id, updated_at
  FROM public.prestadores
  WHERE nome_completo ILIKE '%TESTE APP%'
`);
console.log('\n=== PRESTADOR TESTE APP ===');
for (const p of prest.rows) console.log(JSON.stringify(p));

await pool.end();
