-- FIN-362.3E - Confirmacao atomica e conciliada de pagamento de prestador.
-- Um pagamento so fica pago quando existe um titulo financeiro identificavel,
-- com valor integralmente conciliado e baixa persistida na mesma transacao.

CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_prestador(
    p_pagamento_id UUID,
    p_data_pagamento DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    sucesso BOOLEAN,
    mensagem TEXT,
    pagamento_id UUID,
    titulo_id UUID,
    baixa_id UUID,
    valor_pagamento NUMERIC,
    valor_liquidado NUMERIC,
    saldo_restante NUMERIC,
    conta_financeira_id UUID,
    conta_financeira TEXT,
    status_pagamento TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pagamento RECORD;
    v_titulo RECORD;
    v_conta RECORD;
    v_total_baixado NUMERIC(18,2);
    v_saldo NUMERIC(18,2);
    v_titulos INTEGER;
    v_baixa_id UUID;
    v_valor NUMERIC(18,2);
    v_data DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
BEGIN
    SELECT p.*
      INTO v_pagamento
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Pagamento de prestador nao encontrado.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    v_valor := ROUND(COALESCE(v_pagamento.valor_liquido, 0)::NUMERIC, 2);

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
        RETURN QUERY SELECT false, 'Pagamento possui valor liquido invalido.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    SELECT c.id, c.nome
      INTO v_conta
      FROM public.contas_financeiras c
     WHERE c.ativa = true
     ORDER BY c.principal DESC, c.nome ASC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Nenhuma conta financeira ativa esta configurada.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    -- OS vinculada: a conciliacao deve apontar para o titulo da mesma OS.
    -- Sem OS: somente um titulo de mesmo prestador E mesmo valor e aceito.
    IF v_pagamento.os_id IS NOT NULL THEN
        SELECT count(*)::INTEGER
          INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos <> 1 THEN
            RETURN QUERY SELECT false,
                CASE WHEN v_titulos = 0
                     THEN 'Nao existe titulo financeiro aberto, da mesma OS e com o mesmo valor do pagamento.'
                     ELSE 'Existe mais de um titulo candidato para a mesma OS; conciliacao ambigua.'
                END,
                v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
            RETURN;
        END IF;

        SELECT fp.*
          INTO v_titulo
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           )
         FOR UPDATE;
    ELSE
        SELECT count(*)::INTEGER
          INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos <> 1 THEN
            RETURN QUERY SELECT false,
                CASE WHEN v_titulos = 0
                     THEN 'Nao existe titulo financeiro aberto de mesma origem e mesmo valor.'
                     ELSE 'Existem varios titulos de mesmo prestador e valor; vinculo explicito e obrigatorio.'
                END,
                v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
            RETURN;
        END IF;

        SELECT fp.*
          INTO v_titulo
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           )
         FOR UPDATE;
    END IF;

    SELECT COALESCE(SUM(fb.valor_baixado), 0)::NUMERIC(18,2)
      INTO v_total_baixado
      FROM public.financeiro_baixas fb
     WHERE fb.titulo_tabela = 'financeiro_pagar'
       AND fb.titulo_id = v_titulo.id
       AND NOT COALESCE(fb.estornada, false);

    v_saldo := ROUND(COALESCE(v_titulo.valor, 0)::NUMERIC, 2) - v_total_baixado;

    IF v_saldo <> v_valor THEN
        RETURN QUERY SELECT false,
            'Saldo do titulo nao reconcilia integralmente com o pagamento; pagamento parcial nao e permitido neste fluxo.',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        observacao, estornada
    ) VALUES (
        'financeiro_pagar', v_titulo.id, v_valor, v_valor, 0,
        v_data, 'Pagamento Prestador', v_conta.nome, v_conta.id,
        'Baixa atomica - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8), false
    ) RETURNING id INTO v_baixa_id;

    UPDATE public.financeiro_pagar
       SET status = 'pago',
           data_pagamento = v_data,
           data_efetiva_pgto = v_data,
           conta_pagadora = v_conta.nome,
           observacoes = CASE
               WHEN observacoes IS NULL OR observacoes = '' THEN 'Baixa integral de pagamento de prestador.'
               ELSE observacoes || E'\nBaixa integral de pagamento de prestador.'
           END
     WHERE id = v_titulo.id;

    UPDATE public.pagamentos_prestadores
       SET status = 'pago',
           status_pagamento = 'pago',
           status_conferencia = 'conferido',
           data_pagamento = v_data
     WHERE id = v_pagamento.id;

    RETURN QUERY SELECT true, 'Pagamento confirmado com baixa integral.',
        v_pagamento.id, v_titulo.id, v_baixa_id, v_valor, v_valor,
        0::NUMERIC, v_conta.id, v_conta.nome, 'pago'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) TO service_role;
