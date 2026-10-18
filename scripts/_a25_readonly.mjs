import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA (SELECT) — MISSÃO A25 ============
// 1) Colunas reais de portal_tracking_realtime em produção
const cols = await pool.query(`
  SELECT column_name, udt_name, column_default
  FROM information_schema.columns
  WHERE table_name = 'portal_tracking_realtime'
  ORDER BY ordinal_position
`);
console.log('=== portal_tracking_realtime — COLUNAS ===');
for (const c of cols.rows) console.log(`  ${c.column_name.padEnd(24)} ${c.udt_name}` + (c.column_default ? `  default=${c.column_default}` : ''));

// 2) Prestador TESTE APP
const prest = await pool.query(`
  SELECT id, nome_completo, cpf_cnpj, status, auth_user_id IS NOT NULL AS tem_auth_user, telefone
  FROM public.prestadores
  WHERE nome_completo ILIKE '%TESTE APP%' OR nome_completo ILIKE '%teste%app%' OR cpf_cnpj LIKE '%TESTE%'
  ORDER BY created_at DESC LIMIT 10
`);
console.log('\n=== PRESTADORES (TESTE APP) ===');
for (const p of prest.rows) console.log(JSON.stringify(p));

// 3) Últimas posições em portal_tracking_realtime
const pos = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, latitude, longitude,
         status, origem, captured_at, created_at, updated_at, velocidade
  FROM public.portal_tracking_realtime
  ORDER BY created_at DESC
  LIMIT 25
`);
console.log('\n=== ÚLTIMAS POSIÇÕES (portal_tracking_realtime) ===');
for (const p of pos.rows) console.log(JSON.stringify(p));

// 4) Contagem por status/origem (últimas 24h e total)
const stats = await pool.query(`
  SELECT
    count(*) AS total_geral,
    count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS ultimas_24h,
    count(*) FILTER (WHERE latitude IS NOT NULL AND latitude <> 0 AND longitude IS NOT NULL AND longitude <> 0) AS com_coordenada_valida,
    count(DISTINCT alocacao_id) AS alocacoes_distintas,
    count(DISTINCT prestador_id) AS prestadores_distintos
  FROM public.portal_tracking_realtime
`);
console.log('\n=== ESTATÍSTICAS TRACKING ===');
console.log(JSON.stringify(stats.rows[0]));

await pool.end();
