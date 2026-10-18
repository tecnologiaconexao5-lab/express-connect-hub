// =============================================================================
// A31-H — Inspeção 2 read-only: alocações com eventos App + OS vinculada.
// NÃO altera nada.
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();

  const aloc = await c.query(`
    SELECT a.id AS aloc_id, a.ordem_servico_id, a.status, a.finalizada,
      a.horario_inicio_real, a.horario_fim_real, a.data_finalizacao,
      a.metadata->'app_motorista'->>'romaneio' AS romaneio_app,
      a.metadata->'numeroOC' AS numeroOC,
      os.numero AS os_numero, os.romaneio AS os_romaneio,
      (SELECT count(*) FROM public.eventos_oficiais e WHERE e.entity_id = a.id) AS n_eventos,
      (SELECT count(*) FROM public.entregas_protocolo ep WHERE ep.alocacao_id = a.id) AS n_pod,
      (SELECT count(*) FROM public.financeiro_receber fr WHERE fr.os_id = a.ordem_servico_id::text) AS n_receber,
      (SELECT count(*) FROM public.financeiro_pagar fp WHERE fp.os_id = a.ordem_servico_id::text) AS n_pagar
    FROM public.alocacoes_escala a
    LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    WHERE EXISTS (
      SELECT 1 FROM public.eventos_oficiais ev
      WHERE ev.entity_id = a.id AND ev.source = 'app_motorista'
    ) AND a.ordem_servico_id IS NOT NULL
    LIMIT 5`);
  console.log('Alocações App + OS vinculada:');
  aloc.rows.forEach((r) => console.log(JSON.stringify(r, null, 1)));

  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
