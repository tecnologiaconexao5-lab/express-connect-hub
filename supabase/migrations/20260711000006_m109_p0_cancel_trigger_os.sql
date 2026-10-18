-- ============================================================
-- MISSÃO 109 — P0: Trigger de Cancelamento Financeiro para OS Direta
-- GAP-1: Nao havia trigger de cancelamento para ordens_servico
-- Analogous to trg_cancelar_financeiro_escala for alocacoes_escala
-- ============================================================

CREATE OR REPLACE FUNCTION f_trg_cancelar_financeiro_os()
RETURNS TRIGGER AS $$
BEGIN
    -- Only acts when status changes to 'cancelada'
    IF (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada') THEN
        -- Cancel financeiro_receber
        UPDATE financeiro_receber SET
            status = 'cancelado', valor = 0,
            observacao = COALESCE(observacao, '') || ' | Cancelado via OS ' || NEW.id
        WHERE os_id = NEW.id AND status != 'cancelado';

        -- Cancel financeiro_pagar
        UPDATE financeiro_pagar SET
            status = 'cancelado', valor = 0,
            observacao = COALESCE(observacao, '') || ' | Cancelado via OS ' || NEW.id
        WHERE os_id = NEW.id AND status != 'cancelado';

        -- Cancel pagamentos_prestadores
        UPDATE pagamentos_prestadores SET
            status_pagamento = 'cancelado', valor = 0, valor_liquido = 0,
            observacao = COALESCE(observacao, '') || ' | Cancelado via OS ' || NEW.id
        WHERE os_id = NEW.id AND status_pagamento != 'cancelado';

        -- Zero out composicao_financeira_os
        UPDATE composicao_financeira_os SET
            valor_cliente = 0, valor_prestador = 0,
            pedagio_valor = 0, outros_custos = 0,
            combustivel_valor = 0, ajudante_valor = 0,
            adicional_valor = 0, desconto_valor = 0,
            imposto_valor = 0, seguro_valor = 0
        WHERE os_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_cancelar_financeiro_os ON ordens_servico;
CREATE TRIGGER trg_cancelar_financeiro_os
    AFTER UPDATE OF status ON ordens_servico
    FOR EACH ROW
    WHEN (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada')
    EXECUTE FUNCTION f_trg_cancelar_financeiro_os();
