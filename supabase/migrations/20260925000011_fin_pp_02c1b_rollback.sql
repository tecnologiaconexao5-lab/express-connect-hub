-- =============================================================================
-- TMS-FIN-PP-UX-02C1B — ROLLBACK
-- Remove as 3 RPCs novas e restaura f_confirmar_pagamento_fechamento original.
-- =============================================================================

DROP FUNCTION IF EXISTS public.f_reprovar_pagamento_prestador(uuid, text);
DROP FUNCTION IF EXISTS public.f_cancelar_pagamento_prestador(uuid, text);
DROP FUNCTION IF EXISTS public.f_estornar_pagamento_prestador(uuid, text);

-- Restaura a versao ORIGINAL (pre-02C1B) de f_confirmar_pagamento_fechamento
CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_fechamento(
    p_fechamento_id uuid,
    p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS TABLE(sucesso boolean, mensagem text, fechamento_id uuid, itens_processados integer, itens_ignorados integer, total_baixas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_fechamento       RECORD;
    v_item             RECORD;
    v_res              RECORD;
    v_data             DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_processados      INTEGER := 0;
    v_ignorados        INTEGER := 0;
    v_total_baixas     INTEGER := 0;
    v_total_itens      INTEGER := 0;
    v_total_valor      NUMERIC(18,2) := 0;
BEGIN
    SELECT id, status_pagamento, status_aprovacao, status_conferencia, status, valor_liquido
      INTO v_fechamento
      FROM public.pagamentos_prestadores
     WHERE id = p_fechamento_id
       AND tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Fechamento nao encontrado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_pagamento = 'pago' OR v_fechamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Fechamento ja esta pago.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_aprovacao <> 'aprovado' THEN
        RETURN QUERY SELECT false, 'Fechamento nao esta aprovado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0)
      INTO v_total_itens, v_total_valor
      FROM public.pagamentos_prestadores
     WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
       AND pagamentos_prestadores.id <> p_fechamento_id;

    IF v_total_itens = 0 THEN
        RETURN QUERY SELECT false, 'Fechamento nao possui itens vinculados.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF ROUND(COALESCE(v_fechamento.valor_liquido, 0)::NUMERIC, 2) <> ROUND(v_total_valor, 2) THEN
        RETURN QUERY SELECT false,
                            'Divergencia de valores no fechamento: fechamento=' || COALESCE(v_fechamento.valor_liquido, 0) || ', itens=' || v_total_valor || '.',
                            p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    FOR v_item IN
        SELECT id, status_pagamento, status
          FROM public.pagamentos_prestadores
         WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
           AND pagamentos_prestadores.id <> p_fechamento_id
         ORDER BY id
    LOOP
        IF v_item.status_pagamento = 'pago' OR v_item.status = 'pago' THEN
            v_ignorados := v_ignorados + 1;
            CONTINUE;
        END IF;

        IF v_item.status_pagamento = 'cancelado' OR v_item.status = 'cancelado' THEN
            RAISE EXCEPTION 'Item % do fechamento esta cancelado; pagamento nao pode prosseguir.', v_item.id;
        END IF;

        SELECT r.sucesso, r.mensagem, r.baixa_id
          INTO v_res
          FROM public.f_confirmar_pagamento_prestador(v_item.id, v_data) r;

        IF NOT v_res.sucesso THEN
            RAISE EXCEPTION 'Item % do fechamento falhou: %', v_item.id, COALESCE(v_res.mensagem, 'erro desconhecido');
        END IF;

        v_processados := v_processados + 1;
        IF v_res.baixa_id IS NOT NULL THEN
            v_total_baixas := v_total_baixas + 1;
        END IF;
    END LOOP;

    UPDATE public.pagamentos_prestadores
       SET status = 'pago',
           status_pagamento = 'pago',
           status_conferencia = 'conferido',
           data_pagamento = v_data
     WHERE id = p_fechamento_id;

    RETURN QUERY SELECT true,
                        'Fechamento pago com sucesso. Itens processados: ' || v_processados || ', ignorados: ' || v_ignorados || ', baixas: ' || v_total_baixas || '.',
                        p_fechamento_id,
                        v_processados,
                        v_ignorados,
                        v_total_baixas;
END;
$fn$;
