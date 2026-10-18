-- ============================================================================
-- MIGRATION: 20260920_02mf_fix_rpc_pagamento_prestador_parcial.sql
-- CORRECAO: f_confirmar_pagamento_prestador agora suporta pagamento parcial
-- MANTER: compatibilidade total com chamadas existentes (p_valor_pago = NULL)
-- NOTA: DROP necessario porque CREATE OR REPLACE nao muda aridade
-- ============================================================================

-- PASSO 1: Dropar funcao antiga (3 argumentos)
DROP FUNCTION IF EXISTS public.f_confirmar_pagamento_prestador(uuid, date);

-- PASSO 2: Criar versao AFTER da RPC (3 argumentos, com p_valor_pago)
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

    IF p_valor_pago IS NOT NULL AND p_valor_pago > 0 THEN
        v_valor := ROUND(p_valor_pago::NUMERIC, 2);
        v_eh_parcial := TRUE;
    ELSIF p_valor_pago IS NOT NULL AND p_valor_pago <= 0 THEN
        -- Valor parcial informado mas invalido → rejeitar explicitamente
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

    -- Localizar titulo financeiro
    IF v_pagamento.os_id IS NOT NULL THEN
        -- COM OS: tenta por valor exato primeiro, depois por saldo
        SELECT count(*)::INTEGER INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos = 1 THEN
            SELECT fp.* INTO v_titulo
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
            SELECT count(*)::INTEGER INTO v_titulos
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               );

            IF v_titulos <> 1 THEN
                RETURN QUERY SELECT false,
                    CASE WHEN v_titulos = 0
                         THEN 'Nao existe titulo financeiro aberto para esta OS e prestador.'
                         ELSE 'Existe mais de um titulo candidato para a mesma OS; conciliacao ambigua.'
                    END,
                    v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                    NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
                RETURN;
            END IF;

            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        END IF;
    ELSE
        -- SEM OS: tenta por valor exato primeiro, depois por saldo
        SELECT count(*)::INTEGER INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos = 1 THEN
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        ELSE
            SELECT count(*)::INTEGER INTO v_titulos
              FROM public.financeiro_pagar fp
             WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               );

            IF v_titulos <> 1 THEN
                RETURN QUERY SELECT false,
                    CASE WHEN v_titulos = 0
                         THEN 'Nao existe titulo financeiro aberto de mesma origem e prestador.'
                         ELSE 'Existem varios titulos de mesmo prestador; vinculo explicito e obrigatorio.'
                    END,
                    v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                    NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
                RETURN;
            END IF;

            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        END IF;
    END IF;

    SELECT COALESCE(SUM(fb.valor_baixado), 0)::NUMERIC(18,2)
      INTO v_total_baixado
      FROM public.financeiro_baixas fb
     WHERE fb.titulo_tabela = 'financeiro_pagar'
       AND fb.titulo_id = v_titulo.id
       AND NOT COALESCE(fb.estornada, false);

    v_saldo := ROUND(COALESCE(v_titulo.valor, 0)::NUMERIC, 2) - v_total_baixado;

    IF v_valor > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor do pagamento (R$ ' || v_valor || ') excede o saldo restante (R$ ' || v_saldo || ').',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false,
            'Titulo ja esta integralmente quitado.',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        observacao, estornada
    ) VALUES (
        'financeiro_pagar', v_titulo.id, v_titulo.valor, v_valor,
        v_saldo - v_valor,
        v_data, 'Pagamento Prestador', v_conta.nome, v_conta.id,
        CASE WHEN v_eh_parcial
             THEN 'Baixa parcial - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8)
             ELSE 'Baixa atomica - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8)
        END,
        false
    ) RETURNING id INTO v_baixa_id;

    IF (v_saldo - v_valor) > 0 THEN
        UPDATE public.financeiro_pagar
           SET status = 'parcial',
               data_pagamento = v_data,
               data_efetiva_pgto = v_data,
               conta_pagadora = v_conta.nome,
               observacoes = CASE
                   WHEN observacoes IS NULL OR observacoes = ''
                   THEN 'Baixa parcial R$ ' || v_valor || ' de R$ ' || v_titulo.valor
                   ELSE observacoes || E'\nBaixa parcial R$ ' || v_valor || ' de R$ ' || v_titulo.valor
               END
         WHERE id = v_titulo.id;
    ELSE
        UPDATE public.financeiro_pagar
           SET status = 'pago',
               data_pagamento = v_data,
               data_efetiva_pgto = v_data,
               conta_pagadora = v_conta.nome,
               observacoes = CASE
                   WHEN observacoes IS NULL OR observacoes = ''
                   THEN 'Baixa integral de pagamento de prestador.'
                   ELSE observacoes || E'\nBaixa integral de pagamento de prestador.'
               END
         WHERE id = v_titulo.id;
    END IF;

    IF (v_saldo - v_valor) > 0 THEN
        UPDATE public.pagamentos_prestadores
           SET status_conferencia = 'conferido',
               data_pagamento = v_data
         WHERE id = v_pagamento.id;
    ELSE
        UPDATE public.pagamentos_prestadores
           SET status = 'pago',
               status_pagamento = 'pago',
               status_conferencia = 'conferido',
               data_pagamento = v_data
         WHERE id = v_pagamento.id;
    END IF;

    RETURN QUERY SELECT
        true,
        CASE WHEN v_eh_parcial
             THEN 'Pagamento parcial registrado. Saldo restante: R$ ' || (v_saldo - v_valor) || '.'
             ELSE 'Pagamento confirmado com baixa integral.'
        END,
        v_pagamento.id,
        v_titulo.id,
        v_baixa_id,
        v_valor,
        v_valor,
        v_saldo - v_valor,
        v_conta.id,
        v_conta.nome,
        CASE WHEN (v_saldo - v_valor) > 0 THEN 'pendente' ELSE 'pago' END;
END;
$function$;
