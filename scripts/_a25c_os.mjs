import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-C (parte 5) ============
// 1) Total de ordens_servico em Produção
const os = await pool.query(`
  SELECT count(*) AS total_os, count(*) FILTER (WHERE status IN ('finalizada','entregue','concluida','cancelada')) AS concluidas,
         count(*) FILTER (WHERE status NOT IN ('finalizada','entregue','concluida','cancelada')) AS ativas
  FROM public.ordens_servico
`);
console.log('=== ordens_servico ===');
console.log(JSON.stringify(os.rows[0]));

// 2) Status distintos das OS
const status = await pool.query(`
  SELECT status, count(*) FROM public.ordens_servico GROUP BY status ORDER BY count(*) DESC
`);
console.log('\n=== ordens_servico por status ===');
for (const s of status.rows) console.log(`  ${s.status}: ${s.count}`);

// 3) Existe ALGUMA OS vinculada à alocação ca5fe225? (ordem_servico_id null)
// 4) Quantas alocações em_rota/aceita têm ordem_servico_id null (sem OS)?
const alocNull = await pool.query(`
  SELECT count(*) AS sem_os
  FROM public.alocacoes_escala
  WHERE ordem_servico_id IS NULL AND status IN ('aceita','em_rota','ocorrencia')
`);
console.log('\n=== alocações ativas SEM OS (ordem_servico_id null) ===');
console.log(JSON.stringify(alocNull.rows[0]));

// 5) Alocações ativas com status em_rota/aceita
const alocAtivas = await pool.query(`
  SELECT status, count(*) FROM public.alocacoes_escala
  WHERE status IN ('aceita','em_rota','ocorrencia')
  GROUP BY status ORDER BY count(*) DESC
`);
console.log('\n=== alocações ativas por status ===');
for (const a of alocAtivas.rows) console.log(`  ${a.status}: ${a.count}`);

// 6) Confirmar que OS-HML-MULTI-001 não existe como OS, só no metadata da alocação
const conf = await pool.query(`
  SELECT count(*) AS os_com_numero_hml
  FROM public.ordens_servico WHERE numero ILIKE '%HML-MULTI%' OR numero = 'OS-HML-MULTI-001'
`);
console.log('\n=== OS com numero OS-HML-MULTI-001 ===', conf.rows[0].os_com_numero_hml);

await pool.end();
