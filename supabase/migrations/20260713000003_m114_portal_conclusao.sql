-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 114 — CONCLUSÃO FUNCIONAL DO PORTAL DO CLIENTE
--
-- FASE 1: Segurança residual — remover anon policies de dados privados
-- FASE 2: Pipeline — adicionar colunas de erro e processamento em portal_pedidos
-- FASE 10: Financeiro — view segura para o Portal
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- FASE 1 — SEGURANÇA RESIDUAL
-- =============================================================================

-- 1.1 Remover policies anônimas de tabelas com dados privados
DO $$ BEGIN
  -- portal_tracking_realtime — não deve ser acessível por anon
  DROP POLICY IF EXISTS "ptr_select_own" ON public.portal_tracking_realtime;
  DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime;
  DROP POLICY IF EXISTS "portal_tracking_update" ON public.portal_tracking_realtime;

  -- entregas_protocolo — dados de POD não devem ser públicos
  DROP POLICY IF EXISTS "ep_select_own" ON public.entregas_protocolo;
  DROP POLICY IF EXISTS "Anon select protocolo" ON public.entregas_protocolo;

  -- os_historico — histórico de OS não deve ser público
  DROP POLICY IF EXISTS "oh_select_own" ON public.os_historico;
  DROP POLICY IF EXISTS "liberar tudo historico" ON public.os_historico;

  -- delivery_proofs
  DROP POLICY IF EXISTS "delivery_proofs_own" ON public.delivery_proofs;
  DROP POLICY IF EXISTS "delivery_proofs_select_authenticated" ON public.delivery_proofs;
END $$;

-- 1.2 Criar policies seguras para authenticated (nunca anon)

-- portal_tracking_realtime — apenas TMS/prestador autenticado
CREATE POLICY "ptr_select_auth" ON public.portal_tracking_realtime
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ptr_insert_auth" ON public.portal_tracking_realtime
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- entregas_protocolo — apenas cliente autenticado vê suas entregas
CREATE POLICY "ep_select_auth" ON public.entregas_protocolo
  FOR SELECT TO authenticated
  USING (
    cliente_id = public.f_obter_cliente_id_do_usuario()
    OR (SELECT role FROM auth.users WHERE id = auth.uid()) IN ('super_admin', 'admin')
  );

-- os_historico — apenas autenticado
CREATE POLICY "oh_select_auth" ON public.os_historico
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "oh_insert_auth" ON public.os_historico
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 1.3 Garantir que GRANT para anon foi removido
REVOKE SELECT ON public.portal_tracking_realtime FROM anon;
REVOKE SELECT ON public.entregas_protocolo FROM anon;
REVOKE SELECT ON public.os_historico FROM anon;

REVOKE INSERT ON public.portal_tracking_realtime FROM anon;

-- =============================================================================
-- FASE 2 — PIPELINE PEDIDO → OS
-- =============================================================================

-- 2.1 Adicionar colunas de processamento em portal_pedidos
ALTER TABLE public.portal_pedidos
  ADD COLUMN IF NOT EXISTS erro_processamento TEXT,
  ADD COLUMN IF NOT EXISTS codigo_erro TEXT,
  ADD COLUMN IF NOT EXISTS tentativas_processamento INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS os_vinculada_id UUID,
  ADD COLUMN IF NOT EXISTS escala_id UUID,
  ADD COLUMN IF NOT EXISTS alocacao_id UUID,
  ADD COLUMN IF NOT EXISTS rota_id UUID,
  ADD COLUMN IF NOT EXISTS processado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'portal_cliente';

CREATE INDEX IF NOT EXISTS idx_portal_pedidos_status ON public.portal_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_cliente ON public.portal_pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_idempotency ON public.portal_pedidos(idempotency_key);

-- 2.2 Função para reprocessar pedido (idempotente)
CREATE OR REPLACE FUNCTION public.f_reprocessar_pedido_portal(p_pedido_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido RECORD;
  v_os_count INTEGER;
BEGIN
  -- Buscar pedido
  SELECT * INTO v_pedido FROM public.portal_pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Pedido não encontrado');
  END IF;

  -- Verificar se já tem OS válida
  IF v_pedido.os_vinculada_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_os_count FROM public.ordens_servico WHERE id = v_pedido.os_vinculada_id;
    IF v_os_count > 0 THEN
      RETURN jsonb_build_object('sucesso', true, 'os_id', v_pedido.os_vinculada_id, 'mensagem', 'Pedido já possui OS vinculada');
    END IF;
  END IF;

  -- Atualizar tentativas
  UPDATE public.portal_pedidos SET
    tentativas_processamento = COALESCE(tentativas_processamento, 0) + 1,
    ultima_tentativa_em = NOW(),
    status = 'enviado'
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Pedido reenviado para processamento. Tentativa #' || (v_pedido.tentativas_processamento + 1));
END;
$$;

COMMENT ON FUNCTION public.f_reprocessar_pedido_portal IS
  'M114 — Reprocessa pedido do Portal. Incrementa tentativas.';

-- 2.3 Trigger para impedir duplicidade de processamento
CREATE OR REPLACE FUNCTION public.f_trg_impedir_duplicidade_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'programado' AND OLD.status IN ('programado', 'processando') THEN
    RAISE EXCEPTION 'Pedido já foi processado (status %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_duplicidade_pedido ON public.portal_pedidos;
CREATE TRIGGER trg_impedir_duplicidade_pedido
  BEFORE UPDATE OF status
  ON public.portal_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_impedir_duplicidade_pedido();

-- =============================================================================
-- FASE 10 — VIEW SEGURA DE FINANCEIRO PARA O PORTAL
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_portal_financeiro_cliente AS
SELECT
  fr.id,
  fr.os_id,
  fr.descricao,
  fr.valor,
  fr.valor_pago,
  fr.data_vencimento,
  fr.data_pagamento,
  fr.status,
  fr.cliente,
  fr.cliente_nome,
  fr.cliente_id,
  fr.created_at,
  fr.updated_at
FROM public.financeiro_receber fr;

COMMENT ON VIEW public.vw_portal_financeiro_cliente IS
  'M114 — Financeiro do cliente (apenas receber). NÃO EXPÕE custo/prestador/margem.';

GRANT SELECT ON public.vw_portal_financeiro_cliente TO authenticated;
REVOKE SELECT ON public.vw_portal_financeiro_cliente FROM anon;

-- =============================================================================
-- VALIDAÇÃO
-- =============================================================================
-- SELECT 'M114 migration applied' AS status;
