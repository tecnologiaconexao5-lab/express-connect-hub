-- ESCALA-E2E-03 — ROLLBACK
-- ============================================================================
-- Restaura f_trg_cancelar_financeiro_alocacao ao estado anterior à missão
-- (SEM o cancelamento da OS vinculada). Financeiro permanece sendo cancelado.
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
$function$;
