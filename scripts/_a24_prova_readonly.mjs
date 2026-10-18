import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// SOMENTE LEITURA (SELECT) — MISSÃO A24 — prova A23 + chat A22.
const r = await pool.query(`
  SELECT
    (SELECT count(*) FROM operacao_mensagens) AS total_mensagens,
    (SELECT count(DISTINCT alocacao_id) FROM operacao_mensagens WHERE alocacao_id IS NOT NULL) AS conversas,
    (SELECT count(*) FROM operacao_mensagens WHERE sender_type='prestador' AND status='enviada') AS nao_lidas_torre,
    (SELECT count(*) FROM operacao_mensagens WHERE sender_type='torre') AS mensagens_torre,
    (SELECT count(*) FROM alocacoes_escala WHERE finalizada=true OR status='concluida') AS concluidas,
    (SELECT count(DISTINCT alocacao_id) FROM entregas_protocolo) AS alocacoes_com_pod,
    (SELECT count(*) FROM entregas_protocolo) AS total_pods
`);
console.log(JSON.stringify(r.rows[0], null, 2));
await pool.end();
