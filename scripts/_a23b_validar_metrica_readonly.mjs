import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// SOMENTE LEITURA (SELECT) — MISSÃO A23 FASE B — validação da métrica.
const r = await pool.query(`
  WITH concluidas AS (
    SELECT id, ordem_servico_id, prestador_id, cliente_id, status, finalizada
    FROM public.alocacoes_escala
    WHERE finalizada = true OR status = 'concluida'
  ),
  com_pod AS (
    SELECT DISTINCT alocacao_id FROM public.entregas_protocolo
    WHERE alocacao_id IS NOT NULL
  ),
  pendentes AS (
    SELECT c.id, c.ordem_servico_id, c.status
    FROM concluidas c
    LEFT JOIN com_pod p ON p.alocacao_id = c.id
    WHERE p.alocacao_id IS NULL
  )
  SELECT
    (SELECT count(*) FROM concluidas) AS total_concluidas,
    (SELECT count(*) FROM com_pod) AS total_alocacoes_com_pod,
    (SELECT count(*) FROM pendentes) AS pods_pendentes_nova_metrica,
    (SELECT count(*) FROM alocacoes_escala
       WHERE comprovante_url IS NULL
         AND status IN ('aceita','em_rota','concluida','ocorrencia')) AS kpi_antigo,
    (SELECT count(*) FROM alocacoes_escala
       WHERE comprovante_url IS NULL
         AND status IN ('aceita','em_rota','concluida','ocorrencia')
         AND id IN (SELECT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL)) AS falsos_pendentes,
    (SELECT count(*) FROM alocacoes_escala
       WHERE comprovante_url IS NULL
         AND status = 'aceita') AS kpi_antigo_aceita,
    (SELECT count(*) FROM alocacoes_escala
       WHERE comprovante_url IS NULL
         AND status = 'em_rota') AS kpi_antigo_em_rota,
    (SELECT count(*) FROM alocacoes_escala
       WHERE comprovante_url IS NULL
         AND status = 'concluida') AS kpi_antigo_concluida
`);
console.log(JSON.stringify(r.rows[0], null, 2));
await pool.end();
