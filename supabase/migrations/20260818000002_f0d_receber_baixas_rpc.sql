-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO F0-D — Contas a Receber: baixa/estorno via RPC (financeiro_receber)
-- Data: 2026-08-18
-- Projeto: TMS (Supabase Produção: uwrvzsjtpgaifkktpepn)
--
-- ADITIVA. Estende os RPCs criados em F0-C4 (financeiro_baixas) para atender
-- financeiro_receber com o MESMO contrato de baixa/estorno:
--   * f_registrar_baixa_financeira — branch por p_titulo_tabela;
--   * f_estornar_baixa_financeira  — branch por titulo_tabela da baixa;
--   * financeiro_receber NÃO possui data_efetiva_pgto/conta_pagadora:
--     na baixa grava-se status + data_pagamento + conta_entrada + observacoes;
--     no estorno sem baixas válidas → status='aberto' e data_pagamento=NULL.
-- Assinatura dos RPCs NÃO muda (contrato App/Supabase preservado).
-- Nenhum dado é alterado por esta migration (apenas funções).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. RPC TRANSACIONAL — f_registrar_baixa_financeira (financeiro_pagar + receber)
--    Mesmo fluxo F0-C4, com ramificação por p_titulo_tabela.
--    SECURITY INVOKER (default): respeita as policies RLS do usuário chamador.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.f_registrar_baixa_financeira(
    p_titulo_tabela      TEXT,
    p_titulo_id          UUID,
    p_valor_baixado      NUMERIC,
    p_data_baixa         DATE DEFAULT CURRENT_DATE,
    p_forma_pagamento    TEXT DEFAULT NULL,
    p_conta_financeira   TEXT DEFAULT NULL,
    p_referencia_bancaria TEXT DEFAULT NULL,
    p_observacao         TEXT DEFAULT NULL,
    p_usuario_id         UUID DEFAULT NULL,
    p_usuario_nome       TEXT DEFAULT NULL
)
RETURNS TABLE(sucesso BOOLEAN, mensagem TEXT, baixa_id UUID, saldo_restante NUMERIC, status_titulo TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_valor_original   NUMERIC(18,2);
    v_status_atual     TEXT;
    v_total_baixado    NUMERIC(18,2);
    v_saldo            NUMERIC(18,2);
    v_novo_saldo       NUMERIC(18,2);
    v_novo_status      TEXT;
    v_baixa_id         UUID;
    v_linha_historico  TEXT;
BEGIN
    -- Validações básicas
    IF p_valor_baixado IS NULL OR p_valor_baixado <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da baixa deve ser maior que zero.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    -- Trava o título (FOR UPDATE) conforme a tabela de origem
    IF p_titulo_tabela = 'financeiro_pagar' THEN
        SELECT valor, status
          INTO v_valor_original, v_status_atual
          FROM public.financeiro_pagar
         WHERE id = p_titulo_id
           FOR UPDATE;
    ELSIF p_titulo_tabela = 'financeiro_receber' THEN
        SELECT valor, status
          INTO v_valor_original, v_status_atual
          FROM public.financeiro_receber
         WHERE id = p_titulo_id
           FOR UPDATE;
    ELSE
        RETURN QUERY SELECT false, 'Tabela de título não suportada.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Título não encontrado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('cancelado','cancelada') THEN
        RETURN QUERY SELECT false, 'Não é permitido baixar título cancelado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('pago','paga') THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    -- Total já baixado (somente baixas não estornadas)
    SELECT COALESCE(SUM(valor_baixado), 0)
      INTO v_total_baixado
      FROM public.financeiro_baixas
     WHERE titulo_tabela = p_titulo_tabela
       AND titulo_id = p_titulo_id
       AND NOT estornada;

    v_saldo := v_valor_original - v_total_baixado;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_valor_baixado > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor da baixa excede o saldo restante (' || v_saldo || ').',
            NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    v_novo_saldo := v_saldo - p_valor_baixado;

    IF v_novo_saldo < 0 THEN
        RETURN QUERY SELECT false, 'Saldo não pode ficar negativo.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_novo_saldo > 0 THEN
        v_novo_status := 'parcial';
    ELSE
        v_novo_status := 'pago';
    END IF;

    -- INSERT da baixa (mesma transação)
    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, referencia_bancaria, observacao,
        usuario_id, usuario_nome
    ) VALUES (
        p_titulo_tabela, p_titulo_id, v_valor_original, p_valor_baixado, v_novo_saldo,
        p_data_baixa, p_forma_pagamento, p_conta_financeira, p_referencia_bancaria, p_observacao,
        p_usuario_id, p_usuario_nome
    )
    RETURNING id INTO v_baixa_id;

    -- Atualiza o título (mesma transação)
    v_linha_historico := 'Baixa R$ ' || p_valor_baixado || ' em ' || p_data_baixa
                         || '. Saldo restante: R$ ' || v_novo_saldo || '.';

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        UPDATE public.financeiro_pagar
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               data_efetiva_pgto = p_data_baixa,
               conta_pagadora    = COALESCE(p_conta_financeira, conta_pagadora),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    ELSE
        -- financeiro_receber: não possui data_efetiva_pgto / conta_pagadora
        UPDATE public.financeiro_receber
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               conta_entrada     = COALESCE(p_conta_financeira, conta_entrada),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    END IF;

    RETURN QUERY SELECT true, 'Baixa registrada com sucesso.', v_baixa_id, v_novo_saldo, v_novo_status;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. RPC — f_estornar_baixa_financeira (financeiro_pagar + receber)
--    Estorno NUNCA apaga: marca estornada=true, recalcula total/saldo e devolve
--    o título para 'aberto' (sem baixas válidas) ou 'parcial'/'pago'.
--    Para financeiro_receber: sem baixas válidas → data_pagamento=NULL.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.f_estornar_baixa_financeira(
    p_baixa_id        UUID,
    p_motivo_estorno  TEXT DEFAULT NULL
)
RETURNS TABLE(sucesso BOOLEAN, mensagem TEXT, saldo_restante NUMERIC, status_titulo TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_baixa            RECORD;
    v_valor_original   NUMERIC(18,2);
    v_total_baixado    NUMERIC(18,2);
    v_saldo            NUMERIC(18,2);
    v_novo_status      TEXT;
BEGIN
    SELECT id, titulo_tabela, titulo_id, estornada
      INTO v_baixa
      FROM public.financeiro_baixas
     WHERE id = p_baixa_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Baixa não encontrada.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_baixa.estornada THEN
        RETURN QUERY SELECT false, 'Baixa já estornada.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_baixa.titulo_tabela NOT IN ('financeiro_pagar','financeiro_receber') THEN
        RETURN QUERY SELECT false, 'Tabela de título não suportada.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    -- Marca como estornada — nunca apaga o registro
    UPDATE public.financeiro_baixas
       SET estornada      = true,
           data_estorno   = now(),
           motivo_estorno = p_motivo_estorno
     WHERE id = p_baixa_id;

    -- Recalcula total baixado (excluindo a baixa estornada) e saldo
    SELECT COALESCE(SUM(valor_baixado), 0)
      INTO v_total_baixado
      FROM public.financeiro_baixas
     WHERE titulo_tabela = v_baixa.titulo_tabela
       AND titulo_id = v_baixa.titulo_id
       AND NOT estornada;

    IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
        SELECT valor
          INTO v_valor_original
          FROM public.financeiro_pagar
         WHERE id = v_baixa.titulo_id;
    ELSE
        SELECT valor
          INTO v_valor_original
          FROM public.financeiro_receber
         WHERE id = v_baixa.titulo_id;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Título de origem não encontrado.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    v_saldo := v_valor_original - v_total_baixado;
    IF v_saldo < 0 THEN
        v_saldo := 0;
    END IF;

    IF v_total_baixado <= 0 THEN
        -- Nenhuma baixa válida restante → título volta a aberto
        v_novo_status := 'aberto';
        IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
            UPDATE public.financeiro_pagar
               SET status            = v_novo_status,
                   data_pagamento    = NULL,
                   data_efetiva_pgto = NULL
             WHERE id = v_baixa.titulo_id;
        ELSE
            UPDATE public.financeiro_receber
               SET status         = v_novo_status,
                   data_pagamento = NULL
             WHERE id = v_baixa.titulo_id;
        END IF;
    ELSIF v_saldo > 0 THEN
        v_novo_status := 'parcial';
        IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
            UPDATE public.financeiro_pagar SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        ELSE
            UPDATE public.financeiro_receber SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        END IF;
    ELSE
        v_novo_status := 'pago';
        IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
            UPDATE public.financeiro_pagar SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        ELSE
            UPDATE public.financeiro_receber SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        END IF;
    END IF;

    RETURN QUERY SELECT true, 'Baixa estornada. Registro preservado.', v_saldo, v_novo_status;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. GRANTS — sem acesso anônimo/público; somente autenticado e service_role
--    (assinaturas inalteradas — idênticas às do F0-C4)
-- ───────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) TO service_role;