-- ============================================================================
-- COTACAO-EXPRESS — Blindagem operacional do pedido do cliente
-- Data: 2026-11-01
-- Alvo: Supabase do TMS (uwrvzsjtpgaifkktpepn)
--
-- 1) O CHECK de `cotacoes_publicas.status` ganha o valor
--    'Cancelada pelo Cliente' (usa o mesmo DO idempotente da missão V2).
-- 2) RPC `f_cotacao_status_cliente(p_cotacao_id, p_acao)`:
--      • 'aguardando' → a OS vinculada fica em 'rascunho' (status do TMS:
--        "Rascunho — OS criada, aguardando preenchimento") + entrada no
--        histórico/observações: "Aguardando confirmação do cliente via
--        WhatsApp". Assim a operação sabe que o cliente ainda não clicou.
--      • 'cancelada'  → cotação 'Cancelada pelo Cliente' (+ metadata
--        cancelado_pelo_cliente) e OS vinculada 'cancelada', desde que
--        ainda não esteja finalizada/entregue.
--
-- Não altera `f_cotacao_detalhes_para_os` (a OS nasce como 'pendente' e a
-- marcação 'rascunho' é aplicada logo depois da conversão).
-- Segurança: SECURITY DEFINER, search_path fixo, EXECUTE só anon/authenticated.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CHECK de status — re-varre e recria com o novo valor (idempotente)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.cotacoes_publicas'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.cotacoes_publicas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.cotacoes_publicas
  ADD CONSTRAINT cotacoes_publicas_status_check
  CHECK (
    status IN (
      'Pendente',
      'Pendente de Aprovação pelo Cliente',
      'Aguardando Detalhes',
      'Pronto para OS',
      'Cancelada pelo Cliente'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. RPC de status do cliente (aguardando confirmação | cancelada)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_cotacao_status_cliente(
  p_cotacao_id uuid,
  p_acao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cot        public.cotacoes_publicas%ROWTYPE;
  v_acao       text;
  v_orc_id     uuid;
  v_os_id      uuid;
  v_os_status  text;
  v_now_text   text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  v_acao := lower(btrim(COALESCE(p_acao, '')));

  IF v_acao NOT IN ('aguardando', 'cancelada') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACAO_INVALIDA',
      'message', 'Ação inválida.'
    );
  END IF;

  IF p_cotacao_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_INVALIDA',
      'message', 'Cotação não informada.'
    );
  END IF;

  SELECT * INTO v_cot FROM public.cotacoes_publicas WHERE id = p_cotacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_NAO_ENCONTRADA',
      'message', 'Cotação não encontrada.'
    );
  END IF;

  -- Orçamento/OS vinculados (a cotação pode ainda não ter OS gerada).
  v_orc_id := v_cot.orcamento_id;
  IF v_orc_id IS NULL THEN
    SELECT o.id
      INTO v_orc_id
      FROM public.orcamentos o
     WHERE o.pedido_interno = v_cot.id::text
     ORDER BY o.created_at
     LIMIT 1;
  END IF;

  IF v_orc_id IS NOT NULL THEN
    SELECT os.id, os.status
      INTO v_os_id, v_os_status
      FROM public.ordens_servico os
     WHERE os.orcamento_id = v_orc_id
     ORDER BY os.created_at
     LIMIT 1;

    IF v_os_id IS NULL THEN
      SELECT o.os_vinculada_id
        INTO v_os_id
        FROM public.orcamentos o
       WHERE o.id = v_orc_id;

      IF v_os_id IS NOT NULL THEN
        SELECT os.status INTO v_os_status
          FROM public.ordens_servico os
         WHERE os.id = v_os_id;
      END IF;
    END IF;
  END IF;

  -- ----------------------------------------------------------
  -- 'aguardando' — cliente chegou na tela final e ainda NÃO
  -- confirmou no WhatsApp → OS em 'rascunho' com marca explícita.
  -- ----------------------------------------------------------
  IF v_acao = 'aguardando' THEN
    IF v_os_id IS NOT NULL
       AND COALESCE(v_os_status, '') IN ('rascunho', 'em_analise', 'pendente')
    THEN
      UPDATE public.ordens_servico
         SET status = 'rascunho',
             historico = COALESCE(historico, '[]'::jsonb) || jsonb_build_array(
               jsonb_build_object(
                 'tipo', 'status',
                 'status_anterior', v_os_status,
                 'status_novo', 'rascunho',
                 'descricao', 'Aguardando confirmação do cliente via WhatsApp',
                 'data', v_now_text
               )
             ),
             observacoes_gerais = CASE
               WHEN COALESCE(observacoes_gerais, '') ILIKE '%aguardando confirma%'
                 THEN observacoes_gerais
               ELSE btrim(
                 COALESCE(observacoes_gerais, '') ||
                 ' | Aguardando confirmação do cliente via WhatsApp'
               )
             END,
             updated_at = now()
       WHERE id = v_os_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'acao', 'aguardando',
      'cotacao_id', p_cotacao_id,
      'os_id', v_os_id,
      'os_status', 'rascunho'
    );
  END IF;

  -- ----------------------------------------------------------
  -- 'cancelada' — cliente clicou em "Cancelar / Não preciso mais".
  -- ----------------------------------------------------------
  UPDATE public.cotacoes_publicas
     SET status = 'Cancelada pelo Cliente',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'cancelado_pelo_cliente', true,
           'cancelado_em', v_now_text
         ),
         updated_at = now()
   WHERE id = p_cotacao_id;

  IF v_os_id IS NOT NULL
     AND COALESCE(v_os_status, '') IN ('rascunho', 'em_analise', 'pendente', 'agendada')
  THEN
    UPDATE public.ordens_servico
       SET status = 'cancelada',
           historico = COALESCE(historico, '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object(
               'tipo', 'cancelamento',
               'status_anterior', v_os_status,
               'status_novo', 'cancelada',
               'descricao', 'Cancelada pelo Cliente (não confirmou via WhatsApp)',
               'data', v_now_text
             )
           ),
           observacoes_gerais = CASE
             WHEN COALESCE(observacoes_gerais, '') ILIKE '%cancelada pelo cliente%'
               THEN observacoes_gerais
             ELSE btrim(
               COALESCE(observacoes_gerais, '') ||
               ' | Cancelada pelo Cliente (não confirmou via WhatsApp)'
             )
           END,
           updated_at = now()
     WHERE id = v_os_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'acao', 'cancelada',
    'cotacao_id', p_cotacao_id,
    'status', 'Cancelada pelo Cliente',
    'os_id', v_os_id,
    'os_status_anterior', v_os_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_cotacao_status_cliente(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_cotacao_status_cliente(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
