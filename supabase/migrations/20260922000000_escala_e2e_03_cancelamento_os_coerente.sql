-- ESCALA-E2E-03 — Cancelamento OS coerente com Alocação e Financeiro
-- ============================================================================
-- ROOT CAUSE: ao cancelar uma alocação, o financeiro é cancelado
-- (f_trg_cancelar_financeiro_alocacao), mas a ordens_servico vinculada
-- (alocacoes_escala.ordem_servico_id) NÃO era cancelada → incoerência.
--
-- FIX (mínimo, idempotente, sem recursão, sem DELETE):
--   Quando NEW.status = 'cancelada' e NEW.ordem_servico_id IS NOT NULL,
--   atualizar a MESMA OS vinculada para status = 'cancelada'.
--   • Não cria nova OS.
--   • Não duplica financeiro (UNIQUE os_id preservado).
--   • Cancela a OS ANTES do disparo de M66 (que já retorna cedo em 'cancelada')
--     e não dispara M80 (WHEN status <> 'cancelada').
--   • Proteção de títulos pagos/recebidos inalterada.
--   • Repetir não faz nada (OLD.status='cancelada' → return; e AND status<>'cancelada').
--
-- Não altera M66/M80 além do estritamente necessário (nenhuma alteração neles).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_trg_cancelar_financeiro_alocacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_os_id TEXT;
    v_os_id_uuid UUID;
    v_error_msg TEXT;
    v_updated_receber INT;
    v_updated_pagar INT;
    v_updated_pagamentos INT;
    v_updated_os INT;
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

    -- ESCALA-E2E-03: manter ALOCACAO + OS + FINANCEIRO coerentes.
    -- Cancela a MESMA OS vinculada (sem criar nova OS / sem duplicar financeiro).
    IF NEW.ordem_servico_id IS NOT NULL THEN
        BEGIN
            UPDATE public.ordens_servico
            SET status = 'cancelada',
                updated_at = NOW()
            WHERE id = NEW.ordem_servico_id
              AND status IS DISTINCT FROM 'cancelada';
            GET DIAGNOSTICS v_updated_os = ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN
            v_updated_os := -1;
        END;
    ELSE
        v_updated_os := 0;
    END IF;

    IF v_updated_receber > 0 OR v_updated_pagar > 0 OR v_updated_pagamentos > 0 OR v_updated_os > 0 THEN
        RAISE WARNING '[CANCEL] Alocação % cancelada: receber=% pagar=% pagamentos=% os=%',
            NEW.id, v_updated_receber, v_updated_pagar, v_updated_pagamentos, v_updated_os;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[CANCEL-ERR] Alocação %: %', NEW.id, v_error_msg;
    RETURN NEW;
END;
$function$;
