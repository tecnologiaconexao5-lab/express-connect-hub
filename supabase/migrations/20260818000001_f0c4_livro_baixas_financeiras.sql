-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO F0-C4 — Livro de Baixas Financeiras (financeiro_baixas)
-- Data: 2026-08-18
-- Projeto: TMS / Torre (Supabase Produção: uwrvzsjtpgaifkktpepn)
--
-- ADITIVA. NÃO aplicar a migration antiga 20260626_missao021_fechamento_financeiro.sql.
-- Este arquivo reaproveita APENAS o contrato de colunas de financeiro_baixas,
-- com as seguintes diferenças exigidas pela missão F0-C4:
--   * coluna adicional `conta_financeira` (conta utilizada, textual);
--   * tipos monetários NUMERIC(18,2) (nunca float);
--   * RLS SOMENTE para usuários autenticados do TMS via guard tenant_usuarios
--     (NENHUMA policy para anon/public);
--   * NENHUMA policy DELETE (estorno é UPDATE; nunca DELETE);
--   * sem FK fixa — vínculo polimórfico titulo_tabela + titulo_id
--     (futuramente atende financeiro_receber também);
--   * RPC transacional f_registrar_baixa_financeira (baixa + status do título
--     na mesma transação, com FOR UPDATE contra baixas concorrentes);
--   * RPC f_estornar_baixa_financeira (estorno preserva o registro).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. TABELA
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_baixas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Vínculo polimórfico com o título (sem FK fixa)
    titulo_tabela     TEXT NOT NULL,              -- 'financeiro_pagar' | 'financeiro_receber'
    titulo_id         UUID NOT NULL,

    -- Dados da baixa
    valor_original    NUMERIC(18,2) NOT NULL,     -- valor base do título no momento da baixa
    valor_baixado     NUMERIC(18,2) NOT NULL,     -- valor pago nesta baixa
    saldo_restante    NUMERIC(18,2) NOT NULL,     -- saldo APÓS esta baixa (nunca negativo)

    -- Metadados
    data_baixa        DATE NOT NULL DEFAULT CURRENT_DATE,
    forma_pagamento   TEXT,                       -- 'pix','boleto','ted','dinheiro','cartao','compensacao',...
    conta_financeira  TEXT,                       -- conta/caixa utilizada (textual por ora; futura FK)
    referencia_bancaria TEXT,                     -- ID transação / comprovante
    observacao        TEXT,

    -- Usuário que efetuou a baixa
    usuario_id        UUID,
    usuario_nome      TEXT,

    -- Estorno
    estornada         BOOLEAN NOT NULL DEFAULT false,
    data_estorno      TIMESTAMPTZ,
    motivo_estorno    TEXT,

    -- Auditoria
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_financeiro_baixas_tabela
      CHECK (titulo_tabela IN ('financeiro_pagar','financeiro_receber')),
    CONSTRAINT ck_financeiro_baixas_valor_baixado
      CHECK (valor_baixado > 0),
    CONSTRAINT ck_financeiro_baixas_saldo
      CHECK (valor_original >= 0 AND saldo_restante >= 0)
);

COMMENT ON TABLE public.financeiro_baixas IS
  'Livro de baixas financeiras (F0-C4). Vínculo polimórfico titulo_tabela + titulo_id. Sem FK fixa.';

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES (chave lógica polimórfica + filtros comuns)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fb_titulo ON public.financeiro_baixas (titulo_tabela, titulo_id);
CREATE INDEX IF NOT EXISTS idx_fb_titulo_id ON public.financeiro_baixas (titulo_id);
CREATE INDEX IF NOT EXISTS idx_fb_data ON public.financeiro_baixas (data_baixa);
CREATE INDEX IF NOT EXISTS idx_fb_estorno ON public.financeiro_baixas (estornada) WHERE estornada = true;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER updated_at (reusa função compartilhada já existente em produção)
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_financeiro_baixas_updated_at ON public.financeiro_baixas;
CREATE TRIGGER trg_financeiro_baixas_updated_at
    BEFORE UPDATE ON public.financeiro_baixas
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. RLS — somente usuários autenticados do TMS (guard tenant_usuarios)
--    NENHUMA policy anon/public. NENHUMA policy DELETE (imutabilidade via estorno).
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.financeiro_baixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb_select_tms" ON public.financeiro_baixas;
CREATE POLICY "fb_select_tms" ON public.financeiro_baixas FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "fb_insert_tms" ON public.financeiro_baixas;
CREATE POLICY "fb_insert_tms" ON public.financeiro_baixas FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "fb_update_tms" ON public.financeiro_baixas;
CREATE POLICY "fb_update_tms" ON public.financeiro_baixas FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. RPC TRANSACIONAL — f_registrar_baixa_financeira
--    Fluxo: trava título (FOR UPDATE) → total já baixado (não estornadas) →
--           validações → INSERT da baixa → recalcula saldo → atualiza status.
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
    -- Escopo da missão: somente Contas a Pagar (Contas a Receber em missão futura)
    IF p_titulo_tabela <> 'financeiro_pagar' THEN
        RETURN QUERY SELECT false, 'Somente financeiro_pagar habilitado nesta missão.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    -- Validações básicas
    IF p_valor_baixado IS NULL OR p_valor_baixado <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da baixa deve ser maior que zero.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    -- Trava o título para evitar corrida entre baixas concorrentes
    SELECT valor, status
      INTO v_valor_original, v_status_atual
      FROM public.financeiro_pagar
     WHERE id = p_titulo_id
       FOR UPDATE;

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

    -- Atualiza o título (mesma transação): status, datas de pagamento e conta usada
    v_linha_historico := 'Baixa R$ ' || p_valor_baixado || ' em ' || p_data_baixa
                         || '. Saldo restante: R$ ' || v_novo_saldo || '.';

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

    RETURN QUERY SELECT true, 'Baixa registrada com sucesso.', v_baixa_id, v_novo_saldo, v_novo_status;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6. RPC — f_estornar_baixa_financeira
--    Estorno NUNCA apaga: marca estornada=true, recalcula total/saldo e devolve
--    o título para 'aberto' (sem baixas) ou 'parcial'/'pago' (conforme restante).
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

    IF v_baixa.titulo_tabela <> 'financeiro_pagar' THEN
        RETURN QUERY SELECT false, 'Estorno habilitado somente para financeiro_pagar nesta missão.', NULL::NUMERIC, NULL::TEXT;
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

    SELECT valor
      INTO v_valor_original
      FROM public.financeiro_pagar
     WHERE id = v_baixa.titulo_id;

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
        UPDATE public.financeiro_pagar
           SET status            = v_novo_status,
               data_pagamento    = NULL,
               data_efetiva_pgto = NULL
         WHERE id = v_baixa.titulo_id;
    ELSIF v_saldo > 0 THEN
        v_novo_status := 'parcial';
        UPDATE public.financeiro_pagar
           SET status = v_novo_status
         WHERE id = v_baixa.titulo_id;
    ELSE
        v_novo_status := 'pago';
        UPDATE public.financeiro_pagar
           SET status = v_novo_status
         WHERE id = v_baixa.titulo_id;
    END IF;

    RETURN QUERY SELECT true, 'Baixa estornada. Registro preservado.', v_saldo, v_novo_status;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7. GRANTS — sem acesso anônimo/público; somente autenticado e service_role
-- ───────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) TO service_role;

-- Tabela: grants base para authenticated/service_role (nada para anon/public)
REVOKE ALL ON TABLE public.financeiro_baixas FROM anon;
REVOKE ALL ON TABLE public.financeiro_baixas FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financeiro_baixas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financeiro_baixas TO service_role;