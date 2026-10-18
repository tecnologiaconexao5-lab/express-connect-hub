import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-C (parte 2) ============
// 1) Colunas reais de prestadores
const prestCols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'prestadores' ORDER BY ordinal_position
`);
console.log('=== prestadores — COLUNAS ===');
console.log(prestCols.rows.map(c => c.column_name).join(', '));

// 2) Busca ampla de OS com HML / MULTI / 001
const os = await pool.query(`
  SELECT id, numero, status, cliente, created_at, updated_at
  FROM public.ordens_servico
  WHERE numero ILIKE '%HML%' OR numero ILIKE '%MULTI%' OR numero ILIKE '%HML-MULTI%'
  ORDER BY created_at DESC LIMIT 20
`);
console.log('\n=== ORDENS (HML/MULTI) ===');
for (const o of os.rows) console.log(JSON.stringify(o));

// 3) Busca por qualquer OS criada recentemente (últimos 7 dias)
const osRecent = await pool.query(`
  SELECT id, numero, status, created_at
  FROM public.ordens_servico
  WHERE created_at > now() - interval '7 days'
  ORDER BY created_at DESC LIMIT 30
`);
console.log('\n=== ORDENS RECENTES (7d) ===');
for (const o of osRecent.rows) console.log(JSON.stringify(o));

// 4) Alocações recentes (7d) do PRESTADOR TESTE APP
const aloc = await pool.query(`
  SELECT ae.id, ae.status, ae.finalizada, ae.data_escala, ae.ordem_servico_id,
         ae.prestador_id, ae.placa, ae.tipo_veiculo, ae.updated_at,
         ae.metadata->'app_motorista'->>'etapa_atual' AS app_etapa,
         ae.metadata->'app_motorista'->>'ultima_acao' AS app_ultima_acao,
         ae.metadata->'app_motorista'->>'ultima_idempotency' AS app_idemp,
         ae.metadata->'app_motorista'->>'atualizado_por_app' AS app_updated
  FROM public.alocacoes_escala ae
  WHERE ae.prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
    AND ae.updated_at > now() - interval '7 days'
  ORDER BY ae.updated_at DESC
  LIMIT 20
`);
console.log('\n=== ALOCAÇÕES RECENTES (7d) DO PRESTADOR TESTE ===');
for (const a of aloc.rows) console.log(JSON.stringify(a));

// 5) Posições tracking do prestador (qualquer período)
const pos = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, latitude, longitude, status, origem,
         captured_at, created_at
  FROM public.portal_tracking_realtime
  WHERE prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
  ORDER BY created_at DESC LIMIT 20
`);
console.log('\n=== POSIÇÕES TRACKING DO PRESTADOR TESTE (todas) ===');
for (const p of pos.rows) console.log(JSON.stringify(p));

await pool.end();
