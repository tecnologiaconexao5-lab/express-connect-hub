import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// SOMENTE LEITURA — mesma regra da buscaPodsPendentes (KPI da Torre)
const r = await pool.query(`
  WITH concluidas AS (
    SELECT id, ordem_servico_id FROM public.alocacoes_escala
    WHERE finalizada = true OR status = 'concluida'
  ),
  com_pod AS (SELECT DISTINCT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL)
  SELECT count(*) AS kpi_pods_pendentes_atual
  FROM concluidas c LEFT JOIN com_pod p ON p.alocacao_id = c.id
  WHERE p.alocacao_id IS NULL
`);
console.log(JSON.stringify(r.rows[0], null, 2));
await pool.end();
