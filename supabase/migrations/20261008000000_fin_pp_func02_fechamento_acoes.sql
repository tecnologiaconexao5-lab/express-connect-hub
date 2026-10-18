-- =============================================================================
-- TMS-FIN-PP-FUNC-02 — AÇÕES SEGURAS DE FECHAMENTO DO PRESTADOR
-- Cria as RPCs oficiais que faltavam para o ciclo de vida do fechamento:
--   f_conferir_fechamento   (em_conferencia -> conferido)
--   f_aprovar_fechamento    (conferido      -> aprovado)
--   f_cancelar_fechamento   (qualquer exceto pago -> cancelado)
-- Todas SECURITY DEFINER com guards de auth/tenant/perfil (S1 lock preservado).
-- NÃO altera f_confirmar_pagamento_fechamento (pagamento continua via RPC própria).
-- ZERO DML direto para authenticated.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) f_conferir_fechamento
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_conferir_fechamento(
    p_fechamento_id uuid,
    p_conferido_por text DEFAULT NULL
)
RETURNS TABLE(sucesso boolean, mensagem text, fechamento_id uuid, status_conferencia text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_fech RECORD;
    v_tenant uuid;
    v_obs text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_fechamento_id, NULL::text;
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
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    SELECT p.* INTO v_fech
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_fechamento_id
       AND p.tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_NAO_ENCONTRADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    IF v_fech.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_fech.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', v_fech.id, v_fech.status_conferencia;
        RETURN;
    END IF;

    -- Idempotência por estado
    IF v_fech.status_conferencia = 'conferido' THEN
        RETURN QUERY SELECT true, 'JA_CONFERIDO', v_fech.id, v_fech.status_conferencia;
        RETURN;
    END IF;

    IF v_fech.status = 'pago' OR v_fech.status_pagamento = 'pago' THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_JA_PAGO', v_fech.id, v_fech.status_conferencia;
        RETURN;
    END IF;

    IF v_fech.status = 'cancelado' OR v_fech.status_conferencia = 'cancelado' THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_CANCELADO', v_fech.id, v_fech.status_conferencia;
        RETURN;
    END IF;

    IF COALESCE(v_fech.status_conferencia, 'em_aberto') <> 'em_aberto' THEN
        RETURN QUERY SELECT false, 'ESTADO_NAO_PERMITE_CONFERIR', v_fech.id, v_fech.status_conferencia;
        RETURN;
    END IF;

    v_obs := CASE WHEN v_fech.observacao IS NULL OR v_fech.observacao = ''
                  THEN '[conferir][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || ']' || COALESCE(' ' || p_conferido_por, '')
                  ELSE v_fech.observacao || E'\n[conferir][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || ']' || COALESCE(' ' || p_conferido_por, '')
             END;

    UPDATE public.pagamentos_prestadores
       SET status_conferencia = 'conferido',
           data_conferencia   = now(),
           observacao         = v_obs
     WHERE id = v_fech.id;

    -- Conferir também todos os itens vinculados
    UPDATE public.pagamentos_prestadores
       SET status_conferencia = 'conferido'
     WHERE fechamento_id = v_fech.id
       AND id <> v_fech.id;

    RETURN QUERY SELECT true, 'CONFERIDO', v_fech.id, 'conferido'::text;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 2) f_aprovar_fechamento
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_aprovar_fechamento(
    p_fechamento_id uuid,
    p_aprovado_por text DEFAULT NULL
)
RETURNS TABLE(sucesso boolean, mensagem text, fechamento_id uuid, status_aprovacao text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_fech RECORD;
    v_tenant uuid;
    v_obs text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_fechamento_id, NULL::text;
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
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    SELECT p.* INTO v_fech
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_fechamento_id
       AND p.tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_NAO_ENCONTRADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    IF v_fech.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_fech.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', v_fech.id, v_fech.status_aprovacao;
        RETURN;
    END IF;

    -- Idempotência por estado
    IF v_fech.status_aprovacao = 'aprovado' THEN
        RETURN QUERY SELECT true, 'JA_APROVADO', v_fech.id, v_fech.status_aprovacao;
        RETURN;
    END IF;

    IF v_fech.status = 'pago' OR v_fech.status_pagamento = 'pago' THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_JA_PAGO', v_fech.id, v_fech.status_aprovacao;
        RETURN;
    END IF;

    IF v_fech.status = 'cancelado' OR v_fech.status_conferencia = 'cancelado' THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_CANCELADO', v_fech.id, v_fech.status_aprovacao;
        RETURN;
    END IF;

    IF v_fech.status_conferencia <> 'conferido' THEN
        RETURN QUERY SELECT false, 'ESTADO_NAO_PERMITE_APROVAR', v_fech.id, v_fech.status_aprovacao;
        RETURN;
    END IF;

    v_obs := CASE WHEN v_fech.observacao IS NULL OR v_fech.observacao = ''
                  THEN '[aprovar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || ']' || COALESCE(' ' || p_aprovado_por, '')
                  ELSE v_fech.observacao || E'\n[aprovar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || ']' || COALESCE(' ' || p_aprovado_por, '')
             END;

    UPDATE public.pagamentos_prestadores
       SET status_aprovacao = 'aprovado',
           data_aprovacao   = now(),
           observacao       = v_obs
     WHERE id = v_fech.id;

    -- Aprovar também todos os itens vinculados
    UPDATE public.pagamentos_prestadores
       SET status_aprovacao = 'aprovado'
     WHERE fechamento_id = v_fech.id
       AND id <> v_fech.id;

    RETURN QUERY SELECT true, 'APROVADO', v_fech.id, 'aprovado'::text;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 3) f_cancelar_fechamento
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_cancelar_fechamento(
    p_fechamento_id uuid,
    p_motivo text
)
RETURNS TABLE(sucesso boolean, mensagem text, fechamento_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
    v_fech RECORD;
    v_tenant uuid;
    v_obs text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
        RETURN QUERY SELECT false, 'MOTIVO_OBRIGATORIO', p_fechamento_id, NULL::text;
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
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    SELECT p.* INTO v_fech
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_fechamento_id
       AND p.tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_NAO_ENCONTRADO', p_fechamento_id, NULL::text;
        RETURN;
    END IF;

    IF v_fech.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_fech.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', v_fech.id, v_fech.status;
        RETURN;
    END IF;

    -- Idempotência por estado
    IF v_fech.status = 'cancelado' OR v_fech.status_pagamento = 'cancelado' THEN
        RETURN QUERY SELECT true, 'JA_CANCELADO', v_fech.id, v_fech.status;
        RETURN;
    END IF;

    IF v_fech.status = 'pago' OR v_fech.status_pagamento = 'pago' THEN
        RETURN QUERY SELECT false, 'FECHAMENTO_JA_PAGO', v_fech.id, v_fech.status;
        RETURN;
    END IF;

    v_obs := CASE WHEN v_fech.observacao IS NULL OR v_fech.observacao = ''
                  THEN '[cancelar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || btrim(p_motivo)
                  ELSE v_fech.observacao || E'\n[cancelar][' || to_char(now(),'YYYY-MM-DD HH24:MI') || '][' || left(auth.uid()::text,8) || '] ' || btrim(p_motivo)
             END;

    UPDATE public.pagamentos_prestadores
       SET status             = 'cancelado',
           status_conferencia = 'cancelado',
           status_pagamento   = 'cancelado',
           elegivel_lote      = false,
           lote_id            = NULL,
           observacao         = v_obs
     WHERE id = v_fech.id;

    -- Desvincular e cancelar os itens vinculados
    UPDATE public.pagamentos_prestadores
       SET fechamento_id       = NULL,
           status_conferencia  = 'cancelado'
     WHERE fechamento_id = v_fech.id
       AND id <> v_fech.id;

    RETURN QUERY SELECT true, 'CANCELADO', v_fech.id, 'cancelado'::text;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- GRANTS (revogar PUBLIC/anon; conceder authenticated/service_role)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.f_conferir_fechamento(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_aprovar_fechamento(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_cancelar_fechamento(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_conferir_fechamento(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_aprovar_fechamento(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_cancelar_fechamento(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.f_conferir_fechamento(uuid, text) IS 'TMS-FIN-PP-FUNC-02: confere fechamento (em_aberto -> conferido) e seus itens. Auth/tenant/perfil.';
COMMENT ON FUNCTION public.f_aprovar_fechamento(uuid, text) IS 'TMS-FIN-PP-FUNC-02: aprova fechamento (conferido -> aprovado) e seus itens. Auth/tenant/perfil.';
COMMENT ON FUNCTION public.f_cancelar_fechamento(uuid, text) IS 'TMS-FIN-PP-FUNC-02: cancela fechamento não pago, desvincula/cancela itens. Auth/tenant/perfil.';
