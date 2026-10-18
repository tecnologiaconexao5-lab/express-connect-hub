// =============================================================================
// A31-H — Inspeção read-only do caminho Escala ↔ App ↔ Financeiro.
// NÃO altera nada. Usa dados existentes (homologação) SOMENTE para leitura.
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();

  // 1. Existem eventos do App? (source='app_motorista') por tipo
  const eventosApp = await c.query(`
    SELECT event_type, count(*) AS n
    FROM public.eventos_oficiais
    WHERE source = 'app_motorista'
    GROUP BY event_type ORDER BY event_type`);
  console.log('[1] Eventos App por tipo:', eventosApp.rows.length === 0 ? 'NENHUM' : '');
  eventosApp.rows.forEach((r) => console.log('    ', r.event_type, '=', r.n));

  // 2. Existem eventos App vinculados a alocações existentes?
  const eventosComAloc = await c.query(`
    SELECT count(*) AS n
    FROM public.eventos_oficiais ev
    JOIN public.alocacoes_escala a ON a.id = ev.entity_id::uuid
    WHERE ev.source = 'app_motorista'`);
  console.log('[2] Eventos App com alocação válida:', eventosComAloc.rows[0].n);

  // 3. Amostra: alocação concluída com eventos App (romaneio / horários)
  const amostra = await c.query(`
    SELECT a.id AS aloc_id,
      a.status, a.finalizada,
      a.horario_inicio_real, a.horario_fim_real, a.data_finalizacao,
      a.metadata->'app_motorista'->>'romaneio' AS romaneio_app,
      a.metadata->'numeroOC' AS numeroOC,
      (SELECT count(*) FROM public.eventos_oficiais e WHERE e.entity_id::text = a.id::text AND e.source='app_motorista') AS n_eventos,
      (SELECT count(*) FROM public.entregas_protocolo ep WHERE ep.alocacao_id = a.id) AS n_pod
    FROM public.alocacoes_escala a
    WHERE a.status = 'concluida' AND a.finalizada = true
    ORDER BY a.data_finalizacao DESC
    LIMIT 8`);
  console.log('[3] Alocação concluída — eventos App/POD:');
  amostra.rows.forEach((r) => console.log('    ', r.aloc_id?.slice(0, 8), '| status', r.status, '| eventos', r.n_eventos, '| POD', r.n_pod, '| romaneioApp:', r.romaneio_app || '—'));

  // 4. Alguma alocação com eventos App tem OS vinculada?
  const comOs = await c.query(`
    SELECT count(DISTINCT a.id) AS n
    FROM public.alocacoes_escala a
    JOIN public.eventos_oficiais ev ON ev.entity_id::text = a.id::text
    WHERE ev.source = 'app_motorista' AND a.ordem_servico_id IS NOT NULL`);
  console.log('[4] Alocações com eventos App E OS vinculada:', comOs.rows[0].n);

  // 5. Financeiro reflete (financeiro_receber/pagar por os_id dessas alocações)?
  const fin = await c.query(`
    SELECT
      (SELECT count(*) FROM public.financeiro_receber fr WHERE fr.os_id IS NOT NULL) AS receber_os,
      (SELECT count(*) FROM public.financeiro_pagar fp WHERE fp.os_id IS NOT NULL) AS pagar_os,
      (SELECT count(*) FROM public.pagamentos_prestadores pp WHERE pp.os_id IS NOT NULL) AS pag_prestador_os`);
  console.log('[5] Financeiro por os_id:', fin.rows[0]);

  // 6. Timestamps reais disponíveis em alocacoes_escala (horario_inicio/fim_real)
  const tempos = await c.query(`
    SELECT count(*) FILTER (WHERE horario_inicio_real IS NOT NULL) AS com_inicio,
           count(*) FILTER (WHERE horario_fim_real IS NOT NULL) AS com_fim,
           count(*) FILTER (WHERE data_finalizacao IS NOT NULL) AS com_finalizacao
    FROM public.alocacoes_escala`);
  console.log('[6] Timestamps reais em alocacoes_escala:', tempos.rows[0]);

  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
