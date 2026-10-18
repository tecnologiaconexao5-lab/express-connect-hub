-- =============================================================================
-- TMS-FIN-PP-UX-02C1B — ACOES SEGURAS PRESTADOR
-- Cria/endurece RPCs oficiais: reprovar, cancelar nao pago, estornar pagamento
-- integral (wrapper) e hardening de f_confirmar_pagamento_fechamento.
-- NAO altera f_registrar_baixa_financeira nem f_estornar_baixa_financeira.
-- ZERO DML direto para authenticated (S1/S2 preservados).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) f_reprovar_pagamento_prestador
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_reprovar_pagamento_prestador(
    p_pagamento_id uuid,
    p_motivo text DEFAULT NULL
)
RETURNS TABLE(sucesso boolean, mensagem text, pagamento_id uuid, status_aprovacao text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_pag    RECORD;
    v_tenant uuid;
    v_obs    text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_pagamento_id, NULL::text;
        RETURN;
    END IF;

    SELECT tu.tenant_id INTO v_tenant
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
     LIMIT 1;

    IF v_tenant IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.tenant_usuarios tu
         WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
           AND tu.papel IN ('super_admin','admin_tenant','financeiro')) THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_pagamento_id, NULL::text;
        RETURN;
    END IF;

    SELECT p.* INTO v_pag
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'PAGAMENTO_NAO_ENCONTRADO', p_pagamento_id, NULL::text;
        RETURN;
    END IF;

    IF v_pag.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_pag.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', v_pag.id, v_pag.status_aprovacao;
        RETURN;
    END IF;

    -- Idempotencia por estado
    IF v_pag.status_aprovacao = 'reprovado' THEN
        RETURN QUERY SELECT true, 'JA_REPROVADO', v_pag.id, v_pag.status_aprovacao;
        RETURN;
    END IF;

    IF v_pag.status_aprovacao IS DISTINCT FROM 'aguardando_aprovacao' THEN
        RETURN QUERY SELECT false, 'ESTADO_NAO_PERMITE_REPROVAR', v_pag.id, v_pag.status_aprovacao;
        RETURN;
    END IF;

    -- Neutraliza lote (se houver) — reprovado nao pode ser pago
    IF v_pag.lote_id IS NOT NULL THEN
        DELETE FROM public.lotes_pagamento_itens li WHERE li.pagamento_prestador_id = v_pag.id;
        UPDATE public.lotes_pagamento l
           SET quantidade_pagamentos = (SELECT count(*) FROM public.lotes_pagamento_itens i WHERE i.lote_id = l.id),
               valor_total = COALESCE((SELECT sum(i.valor) FROM public.lotes_pagamento_itens i WHERE i.lote_id = l.id), 0),
               updated_at = now()
         WHERE l.id = v_pag.lote_id;
    END IF;

    v_obs := CASE WHEN v_pag.observacao IS NULL OR v_pag.observacao = ''
                  THEN '[reprovar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || COALESCE(p_motivo,'sem motivo')
                  ELSE v_pag.observacao || E'\n[reprovar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || COALESCE(p_motivo,'sem motivo')
             END;

    UPDATE public.pagamentos_prestadores
       SET status_aprovacao = 'reprovado',
           elegivel_lote    = false,
           lote_id          = NULL,
           observacao       = v_obs
     WHERE id = v_pag.id;

    RETURN QUERY SELECT true, 'REPROVADO', v_pag.id, 'reprovado'::text;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 2) f_cancelar_pagamento_prestador (somente NAO pago)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_cancelar_pagamento_prestador(
    p_pagamento_id uuid,
    p_motivo text DEFAULT NULL
)
RETURNS TABLE(sucesso boolean, mensagem text, pagamento_id uuid, titulo_id uuid, status_pagamento text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_pag      RECORD;
    v_tenant   uuid;
    v_titulo   uuid;
    v_nbaixas  integer;
    v_obs      text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_pagamento_id, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    SELECT tu.tenant_id INTO v_tenant
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
     LIMIT 1;

    IF v_tenant IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.tenant_usuarios tu
         WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
           AND tu.papel IN ('super_admin','admin_tenant','financeiro')) THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_pagamento_id, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    SELECT p.* INTO v_pag
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'PAGAMENTO_NAO_ENCONTRADO', p_pagamento_id, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    IF v_pag.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_pag.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', v_pag.id, NULL::uuid, v_pag.status_pagamento;
        RETURN;
    END IF;

    -- Idempotencia
    IF v_pag.status_pagamento = 'cancelado' OR v_pag.status = 'cancelado' THEN
        RETURN QUERY SELECT true, 'JA_CANCELADO', v_pag.id, NULL::uuid, v_pag.status_pagamento;
        RETURN;
    END IF;

    IF v_pag.status_pagamento = 'pago' OR v_pag.status = 'pago' THEN
        RETURN QUERY SELECT false, 'PAGAMENTO_JA_PAGO', v_pag.id, NULL::uuid, v_pag.status_pagamento;
        RETURN;
    END IF;

    IF v_pag.status_pagamento IS NULL
       OR v_pag.status_pagamento NOT IN ('pendente','nao_vencido','em_lote') THEN
        RETURN QUERY SELECT false, 'ESTADO_NAO_PERMITE_CANCELAR', v_pag.id, NULL::uuid, v_pag.status_pagamento;
        RETURN;
    END IF;

    -- Resolve titulo(s) FP pela OS e pre-condicao DURA: nenhuma baixa ativa
    IF v_pag.os_id IS NOT NULL THEN
        SELECT count(*) INTO v_nbaixas
          FROM public.financeiro_pagar fp
          JOIN public.financeiro_baixas b
            ON b.titulo_tabela = 'financeiro_pagar' AND b.titulo_id = fp.id
         WHERE fp.os_id = v_pag.os_id::text
           AND NOT COALESCE(b.estornada, false);

        IF v_nbaixas > 0 THEN
            RETURN QUERY SELECT false, 'NECESSARIO_ESTORNO', v_pag.id, NULL::uuid, v_pag.status_pagamento;
            RETURN;
        END IF;

        SELECT fp.id INTO v_titulo
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pag.os_id::text
         ORDER BY fp.created_at
         LIMIT 1;

        UPDATE public.financeiro_pagar fp
           SET status = 'cancelado'
         WHERE fp.os_id = v_pag.os_id::text
           AND COALESCE(fp.status,'') NOT IN ('pago','paga','cancelado','cancelada');
    END IF;

    -- Neutraliza lote (se houver)
    IF v_pag.lote_id IS NOT NULL THEN
        DELETE FROM public.lotes_pagamento_itens li WHERE li.pagamento_prestador_id = v_pag.id;
        UPDATE public.lotes_pagamento l
           SET quantidade_pagamentos = (SELECT count(*) FROM public.lotes_pagamento_itens i WHERE i.lote_id = l.id),
               valor_total = COALESCE((SELECT sum(i.valor) FROM public.lotes_pagamento_itens i WHERE i.lote_id = l.id), 0),
               updated_at = now()
         WHERE l.id = v_pag.lote_id;
    END IF;

    v_obs := CASE WHEN v_pag.observacao IS NULL OR v_pag.observacao = ''
                  THEN '[cancelar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || COALESCE(p_motivo,'sem motivo')
                  ELSE v_pag.observacao || E'\n[cancelar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || COALESCE(p_motivo,'sem motivo')
             END;

    UPDATE public.pagamentos_prestadores
       SET status            = 'cancelado',
           status_pagamento  = 'cancelado',
           elegivel_lote     = false,
           lote_id           = NULL,
           observacao        = v_obs
     WHERE id = v_pag.id;

    RETURN QUERY SELECT true, 'CANCELADO', v_pag.id, v_titulo, 'cancelado'::text;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 3) f_estornar_pagamento_prestador (wrapper — SO pagamento INTEGRAL)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_estornar_pagamento_prestador(
    p_pagamento_id uuid,
    p_motivo text
)
RETURNS TABLE(sucesso boolean, mensagem text, pagamento_id uuid, baixa_id uuid, status_pagamento text, fp_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_pag       RECORD;
    v_tenant    uuid;
    v_titulo    RECORD;
    v_baixa     RECORD;
    v_nbaixas   integer;
    v_res       RECORD;
    v_obs       text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_pagamento_id, NULL::uuid, NULL::text, NULL::text;
        RETURN;
    END IF;

    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
        RETURN QUERY SELECT false, 'MOTIVO_OBRIGATORIO', p_pagamento_id, NULL::uuid, NULL::text, NULL::text;
        RETURN;
    END IF;

    SELECT tu.tenant_id INTO v_tenant
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
     LIMIT 1;

    IF v_tenant IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.tenant_usuarios tu
         WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
           AND tu.papel IN ('super_admin','admin_tenant','financeiro')) THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_pagamento_id, NULL::uuid, NULL::text, NULL::text;
        RETURN;
    END IF;

    SELECT p.* INTO v_pag
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'PAGAMENTO_NAO_ENCONTRADO', p_pagamento_id, NULL::uuid, NULL::text, NULL::text;
        RETURN;
    END IF;

    IF v_pag.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_pag.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', v_pag.id, NULL::uuid, v_pag.status_pagamento, NULL::text;
        RETURN;
    END IF;

    IF v_pag.status_pagamento IS DISTINCT FROM 'pago' AND v_pag.status IS DISTINCT FROM 'pago' THEN
        RETURN QUERY SELECT false, 'PAGAMENTO_NAO_ESTA_PAGO', v_pag.id, NULL::uuid, v_pag.status_pagamento, NULL::text;
        RETURN;
    END IF;

    IF v_pag.os_id IS NULL THEN
        RETURN QUERY SELECT false, 'TITULO_FINANCEIRO_NAO_ENCONTRADO', v_pag.id, NULL::uuid, v_pag.status_pagamento, NULL::text;
        RETURN;
    END IF;

    SELECT fp.* INTO v_titulo
      FROM public.financeiro_pagar fp
     WHERE fp.os_id = v_pag.os_id::text
     ORDER BY fp.created_at
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'TITULO_FINANCEIRO_NAO_ENCONTRADO', v_pag.id, NULL::uuid, v_pag.status_pagamento, NULL::text;
        RETURN;
    END IF;

    -- Somente INTEGRAL: exatamente 1 baixa ativa e ela deve quitar o titulo
    SELECT count(*) INTO v_nbaixas
      FROM public.financeiro_baixas b
     WHERE b.titulo_tabela = 'financeiro_pagar' AND b.titulo_id = v_titulo.id
       AND NOT COALESCE(b.estornada, false);

    IF v_nbaixas <> 1 THEN
        RETURN QUERY SELECT false, 'BLOCKED_PAGAMENTO_PARCIAL', v_pag.id, NULL::uuid, v_pag.status_pagamento, v_titulo.status;
        RETURN;
    END IF;

    SELECT b.* INTO v_baixa
      FROM public.financeiro_baixas b
     WHERE b.titulo_tabela = 'financeiro_pagar' AND b.titulo_id = v_titulo.id
       AND NOT COALESCE(b.estornada, false)
       FOR UPDATE;

    IF ROUND(COALESCE(v_baixa.valor_original,0)::numeric,2) <> ROUND(COALESCE(v_titulo.valor,0)::numeric,2)
       OR ROUND(COALESCE(v_baixa.saldo_restante,0)::numeric,2) <> 0 THEN
        RETURN QUERY SELECT false, 'BLOCKED_PAGAMENTO_PARCIAL', v_pag.id, v_baixa.id, v_pag.status_pagamento, v_titulo.status;
        RETURN;
    END IF;

    -- Reutiliza a RPC existente de estorno (nao reimplementar)
    SELECT r.sucesso, r.mensagem INTO v_res
      FROM public.f_estornar_baixa_financeira(v_baixa.id, p_motivo) r;

    IF NOT COALESCE(v_res.sucesso, false) THEN
        RETURN QUERY SELECT false, COALESCE(v_res.mensagem,'FALHA_ESTORNO'), v_pag.id, v_baixa.id, v_pag.status_pagamento, v_titulo.status;
        RETURN;
    END IF;

    v_obs := CASE WHEN v_pag.observacao IS NULL OR v_pag.observacao = ''
                  THEN '[estorno][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || p_motivo
                  ELSE v_pag.observacao || E'\n[estorno][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || p_motivo
             END;

    -- Sincroniza PP de volta a estado coerente (FP ja reaberto pela RPC de estorno)
    UPDATE public.pagamentos_prestadores
       SET status           = 'pendente',
           status_pagamento = 'pendente',
           data_pagamento   = NULL,
           observacao       = v_obs
     WHERE id = v_pag.id;

    RETURN QUERY SELECT true, 'ESTORNADO',
        v_pag.id, v_baixa.id, 'pendente'::text,
        (SELECT fp.status FROM public.financeiro_pagar fp WHERE fp.id = v_titulo.id);
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 4) HARDENING f_confirmar_pagamento_fechamento (logica preservada + auth/tenant)
-- -----------------------------------------------------------------------------
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
    v_tenant           uuid;
    v_tenant_ok        boolean := true;
BEGIN
    -- 0. Autorizacao (hardening)
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    SELECT tu.tenant_id INTO v_tenant
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
     LIMIT 1;

    IF v_tenant IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.tenant_usuarios tu
         WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
           AND tu.papel IN ('super_admin','admin_tenant','financeiro')) THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 1. Valida fechamento
    SELECT id, os_id, status_pagamento, status_aprovacao, status_conferencia, status, valor_liquido
      INTO v_fechamento
      FROM public.pagamentos_prestadores
     WHERE id = p_fechamento_id
       AND tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Fechamento nao encontrado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_fechamento.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', p_fechamento_id, 0, 0, 0;
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

    -- 1.1 Reconciliacao: soma dos itens deve bater com o valor do fechamento + tenant dos itens
    SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0),
           COALESCE(bool_and(CASE WHEN os_id IS NULL THEN true ELSE public.f_pp_tenant_id(os_id) IS NOT DISTINCT FROM v_tenant END), true)
      INTO v_total_itens, v_total_valor, v_tenant_ok
      FROM public.pagamentos_prestadores
     WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
       AND pagamentos_prestadores.id <> p_fechamento_id;

    IF v_total_itens = 0 THEN
        RETURN QUERY SELECT false, 'Fechamento nao possui itens vinculados.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF NOT v_tenant_ok THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF ROUND(COALESCE(v_fechamento.valor_liquido, 0)::NUMERIC, 2) <> ROUND(v_total_valor, 2) THEN
        RETURN QUERY SELECT false,
                            'Divergencia de valores no fechamento: fechamento=' || COALESCE(v_fechamento.valor_liquido, 0) || ', itens=' || v_total_valor || '.',
                            p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 2. Itera pelos itens vinculados
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

    -- 3. Atualiza fechamento para pago
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

-- -----------------------------------------------------------------------------
-- GRANTS (revogar PUBLIC/anon; conceder authenticated/service_role)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.f_reprovar_pagamento_prestador(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_cancelar_pagamento_prestador(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_estornar_pagamento_prestador(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_reprovar_pagamento_prestador(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_cancelar_pagamento_prestador(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_estornar_pagamento_prestador(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.f_reprovar_pagamento_prestador(uuid, text) IS 'TMS-FIN-PP-UX-02C1B: reprova workflow de prestador (aguardando_aprovacao -> reprovado). Nao toca FP/baixa.';
COMMENT ON FUNCTION public.f_cancelar_pagamento_prestador(uuid, text) IS 'TMS-FIN-PP-UX-02C1B: cancela obrigacao NAO paga; exige ausencia de baixa ativa; sincroniza FP e lote.';
COMMENT ON FUNCTION public.f_estornar_pagamento_prestador(uuid, text) IS 'TMS-FIN-PP-UX-02C1B: estorna pagamento INTEGRAL reutilizando f_estornar_baixa_financeira e reabrindo PP. Parcial bloqueado.';
COMMENT ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) IS 'TMS-FIN-PP-UX-02C1B: hardening auth/tenant/perfil; regra de pagamento preservada.';
