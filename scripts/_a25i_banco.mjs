import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ALOCACAO = 'ca5fe225-7114-42da-9997-c3d466e5df52';

console.log('=== ÚLTIMAS POSIÇÕES (alocação ' + ALOCACAO + ') ===');
const r = await pool.query(`
  SELECT id, captured_at, created_at, latitude, longitude, precisao, velocidade,
         status, origem, alocacao_id, os_id, prestador_id, metadata
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = $1
  ORDER BY captured_at DESC, created_at DESC
  LIMIT 10
`, [ALOCACAO]);

console.log('TOTAL retornado:', r.rows.length);
for (const row of r.rows) {
  console.log('---');
  console.log('id:', row.id);
  console.log('captured_at:', row.captured_at);
  console.log('created_at:', row.created_at);
  console.log('latitude:', row.latitude, '| longitude:', row.longitude);
  console.log('precisao:', row.precisao, '| velocidade:', row.velocidade);
  console.log('status:', row.status, '| origem:', row.origem);
  console.log('alocacao_id:', row.alocacao_id, '| os_id:', row.os_id, '| prestador_id:', row.prestador_id);
  console.log('metadata:', JSON.stringify(row.metadata));
}

// Totais por recência
const agg = await pool.query(`
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE created_at > now() - interval '15 minutes')::int AS criadas_15min,
    count(*) FILTER (WHERE captured_at > now() - interval '15 minutes')::int AS capturadas_15min,
    max(captured_at) AS max_captured,
    max(created_at) AS max_created
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = $1
`, [ALOCACAO]);
console.log('\n=== AGREGAÇÃO ===');
console.log(agg.rows[0]);

// Verificação ampla: posições recentes em qualquer alocação (última 1h)
const global = await pool.query(`
  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS criadas_1h,
         count(*) FILTER (WHERE captured_at > now() - interval '1 hour')::int AS capturadas_1h,
         max(created_at) AS max_created_global,
         max(captured_at) AS max_captured_global
  FROM public.portal_tracking_realtime
`);
console.log('\n=== GLOBAL (todas alocações, última 1h) ===');
console.log(global.rows[0]);

// Status da alocação
const al = await pool.query(`
  SELECT id, status, prestador_id, ordem_servico_id, cliente_id, tenant_id,
         updated_at, created_at
  FROM public.alocacoes_escala WHERE id = $1
`, [ALOCACAO]);
console.log('\n=== ALOCAÇÃO ===');
console.log(al.rows[0]);

await pool.end();