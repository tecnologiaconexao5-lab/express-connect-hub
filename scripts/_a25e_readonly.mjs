import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-E ============
const agora = new Date().toISOString();
console.log('# HORÁRIO DA CONSULTA:', agora, '\n');

// 1) Últimas posições da alocação da prova
const pos = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, latitude, longitude, precisao, velocidade,
         status, origem, captured_at, created_at, updated_at, metadata
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC NULLS LAST, captured_at DESC NULLS LAST
  LIMIT 20
`);
console.log('=== POSIÇÕES DA ALOCAÇÃO ca5fe225 (prova) ===');
console.log('Total:', pos.rows.length);
for (const p of pos.rows) console.log(JSON.stringify(p));

// 2) Últimas posições gerais
const geral = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, latitude, longitude, precisao, velocidade,
         status, origem, captured_at, created_at
  FROM public.portal_tracking_realtime
  ORDER BY created_at DESC NULLS LAST, captured_at DESC NULLS LAST
  LIMIT 30
`);
console.log('\n=== ÚLTIMAS POSIÇÕES GERAIS (top 30) ===');
console.log('Total:', geral.rows.length);
for (const p of geral.rows) console.log(JSON.stringify(p));

// 3) Janela temporal — alguma posição nas últimas 48h? 24h?
const jan = await pool.query(`
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE created_at > now() - interval '48 hours') AS ultimas_48h,
    count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS ultimas_24h,
    count(*) FILTER (WHERE created_at > now() - interval '1 hour') AS ultimas_1h,
    max(created_at) AS mais_recente_created,
    max(captured_at) AS mais_recente_captured
  FROM public.portal_tracking_realtime
`);
console.log('\n=== JANELA TEMPORAL ===');
console.log(JSON.stringify(jan.rows[0]));

// 4) Posições do PRESTADOR TESTE APP
const prest = await pool.query(`
  SELECT id, alocacao_id, os_id, latitude, longitude, status, origem, captured_at, created_at
  FROM public.portal_tracking_realtime
  WHERE prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 20
`);
console.log('\n=== POSIÇÕES DO PRESTADOR TESTE APP ===');
console.log('Total:', prest.rows.length);
for (const p of prest.rows) console.log(JSON.stringify(p));

await pool.end();
