CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_prestador(
    p_pagamento_id uuid,
    p_data_pagamento date DEFAULT CURRENT_DATE,
    p_valor_pago numeric DEFAULT NULL
)
RETURNS TABLE(
    sucesso boolean,
    mensagem text,
    pagamento_id uuid,
    titulo_id uuid,
    baixa_id uuid,
    valor_pagamento numeric,
    valor_liquidado numeric,
    saldo_restante numeric,
    conta_financeira_id uuid,
    conta_financeira text,
    status_pagamento text
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_pagamento    RECORD;
    v_titulo       RECORD;
    v_conta        RECORD;
    v_total_baixado NUMERIC(18,2);
    v_saldo        NUMERIC(18,2);
    v_titulos      INTEGER;
    v_baixa_id     UUID;
    v_valor        NUMERIC(18,2);
    v_data         DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_eh_parcial   BOOLEAN := FALSE;
BEGIN
    SELECT p.* INTO v_pagamento
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Pagamento de prestador nao encontrado.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF p_valor_pago IS NOT NULL AND p_valor_pago > 0 THEN
        v_valor := ROUND(p_valor_pago::NUMERIC, 2);
        v_eh_parcial := TRUE;
    ELSIF p_valor_pago IS NOT NULL AND p_valor_pago <= 0 THEN
        RETURN QUERY SELECT false, 'Valor do pagamento parcial deve ser maior que zero.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    ELSE
        v_valor := ROUND(COALESCE(v_pagamento.valor_liquido, 0)::NUMERIC, 2);
        v_eh_parcial := FALSE;
    END IF;

    IF v_pagamento.status_pagamento = 'pago' OR v_pagamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Pagamento ja esta marcado como pago.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_pagamento.status_pagamento = 'cancelado' OR v_pagamento.status = 'cancelado' THEN
        RETURN QUERY SELECT false, 'Pagamento cancelado nao pode ser confirmado.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_valor <= 0 THEN
        RETURN QUERY SELECT false, 'Valor do pagamento deve ser maior que zero.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    SELECT c.id, c.nome INTO v_conta
      FROM public.contas_financeiras c
     WHERE c.ativa = true
     ORDER BY c.principal DESC, c.nome ASC LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Nenhuma conta financeira ativa esta configurada.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    -- [Match logic: COM OS and SEM OS branches with saldo fallback — 130 lines]
    -- [Baixa creation, FP update, PP update — 80 lines]
    -- [Full implementation in migration file]
END;
$function$;
