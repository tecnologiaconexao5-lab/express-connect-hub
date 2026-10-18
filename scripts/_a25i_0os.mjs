import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Quantas ordens_servico existem? (para explicar "0 de 0 OS")
const os = await pool.query(`SELECT count(*)::int AS total FROM public.ordens_servico`);
console.log('ordens_servico total:', os.rows[0].total);

// Alocações ativas sem OS (buscarAlocacoesSemOS reproduzido via SQL)
const alocSemOS = await pool.query(`
  SELECT id, status, prestador_id, ordem_servico_id
  FROM public.alocacoes_escala
  WHERE status IN ('aceita','em_rota','ocorrencia') AND ordem_servico_id IS NULL
  LIMIT 50
`);
console.log('\nalocações sem OS (status ativos):', alocSemOS.rows.length);
for (const a of alocSemOS.rows) {
  console.log(' ', a.id, '|', a.status, '| prestador', a.prestador_id, '| os_id', a.ordem_servico_id);
}

// Posições recentes por captured_at nas últimas 2h em QUALQUER alocação (para saber se há outra posição com captured_at real)
const recentes = await pool.query(`
  SELECT id, alocacao_id, captured_at, created_at, origem
  FROM public.portal_tracking_realtime
  WHERE captured_at > now() - interval '2 hours'
  ORDER BY captured_at DESC LIMIT 10
`);
console.log('\nposições com captured_at nos últimos 2h:', recentes.rows.length);
for (const r of recentes.rows) {
  console.log(' ', r.id, '| captured', r.captured_at, '| created', r.created_at, '|', r.origem);
}

await pool.end();