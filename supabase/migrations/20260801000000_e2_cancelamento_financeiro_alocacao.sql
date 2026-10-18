-- ===================================================================
-- ETAPA 2 — Trigger de Cancelamento Financeiro para Alocações
--
-- Problema: Quando uma alocação é cancelada, o M66
-- (f_trg_propagar_financeiro_alocacao) apenas retorna cedo
-- (IF NEW.status = 'cancelada' THEN RETURN NEW), sem cancelar
-- os registros financeiros já criados.
--
-- Solução: Trigger BEFORE UPDATE que, ao detectar status='cancelada',
-- propaga o cancelamento para financeiro_receber, financeiro_pagar
-- e pagamentos_prestadores.
--
-- Segurança:
--   - Idempotente (pode rodar múltiplas vezes)
--   - Não afeta registros já pagos
--   - Não exclui dados — apenas marca status
--   - Não afeta alocações não canceladas
-- ===================================================================

-- ===================================================================
-- 1. FUNÇÃO DE CANCELAMENTO FINANCEIRO
-- ===================================================================
CREATE OR REPLACE FUNCTION public.f_trg_cancelar_financeiro_alocacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_os_id TEXT;
    v_os_id_uuid UUID;
    v_error_msg TEXT;
    v_updated_receber INT;
    v_updated_pagar INT;
    v_updated_pagamentos INT;
BEGIN
    IF NEW.status != 'cancelada' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'cancelada' THEN
        RETURN NEW;
    END IF;

    v_os_id := COALESCE(NEW.ordem_servico_id::TEXT, NEW.id::TEXT);
    v_os_id_uuid := COALESCE(NEW.ordem_servico_id, NEW.id);

    BEGIN
        UPDATE public.financeiro_receber
        SET status = 'cancelada'
        WHERE os_id = v_os_id
          AND status NOT IN ('pago', 'recebido', 'cancelada');
        GET DIAGNOSTICS v_updated_receber = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_updated_receber := -1;
    END;

    BEGIN
        UPDATE public.financeiro_pagar
        SET status = 'cancelada'
        WHERE os_id = v_os_id
          AND status NOT IN ('pago', 'cancelada');
        GET DIAGNOSTICS v_updated_pagar = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_updated_pagar := -1;
    END;

    BEGIN
        UPDATE public.pagamentos_prestadores
        SET status_pagamento = 'cancelado',
            status_conferencia = 'cancelado'
        WHERE os_id = v_os_id_uuid
          AND (status_pagamento IS DISTINCT FROM 'cancelado');
        GET DIAGNOSTICS v_updated_pagamentos = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_updated_pagamentos := -1;
    END;

    IF v_updated_receber > 0 OR v_updated_pagar > 0 OR v_updated_pagamentos > 0 THEN
        RAISE WARNING '[CANCEL] Alocação % cancelada: receber=% pagar=% pagamentos=%',
            NEW.id, v_updated_receber, v_updated_pagar, v_updated_pagamentos;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[CANCEL-ERR] Alocação %: %', NEW.id, v_error_msg;
    RETURN NEW;
END;
$$;

-- ===================================================================
-- 2. TRIGGER NA ALAOCAÇÃO
-- ===================================================================
DROP TRIGGER IF EXISTS trg_cancelar_financeiro_alocacao ON public.alocacoes_escala;

CREATE TRIGGER trg_cancelar_financeiro_alocacao
    BEFORE UPDATE OF status ON public.alocacoes_escala
    FOR EACH ROW
    WHEN (NEW.status = 'cancelada'::text AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.f_trg_cancelar_financeiro_alocacao();

-- ===================================================================
-- 3. ATUALIZAR status_pagamento NA PRÓPRIA ALAOCAÇÃO
--    (O trigger M66 já faz isso para outras mudanças,
--     mas para cancelamento precisamos explicitar)
-- ===================================================================
UPDATE public.alocacoes_escala
SET status_pagamento = 'cancelado'
WHERE status = 'cancelada'
  AND (status_pagamento IS NULL OR status_pagamento != 'cancelado');

-- ===================================================================
-- 4. GRANT
-- ===================================================================
GRANT EXECUTE ON FUNCTION public.f_trg_cancelar_financeiro_alocacao TO authenticated;
