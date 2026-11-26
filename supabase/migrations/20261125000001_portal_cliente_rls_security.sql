-- =============================================================================
-- ONDA 1 — PORTAL DO CLIENTE: ISOLAMENTO MULTI-TENANT (RLS) + PROTEÇÃO DE CUSTO
-- Data: 2026-11-25
-- Projeto: express-connect-hub
--
-- Objetivo:
--   1. entregas_protocolo / rotas / rota_paradas / patio_* / os_historico /
--      portal_tracking_realtime: usuário do portal só lê o que pertence ao seu
--      cliente_id; equipe interna (tenant_usuarios) mantém acesso total.
--   2. usuarios_cliente: remove policy aberta que permitia qualquer autenticado
--      ler/alterar vínculos de outros clientes.
--   3. vw_portal_financeiro_cliente: security_invoker + filtro explícito.
--   4. RPC converter_pedido_para_os: wrapper com checagem de ownership (anti-IDOR)
--      preservando o corpo original em _converter_pedido_para_os_base.
--
-- IDEMPOTENTE: pode ser executada N vezes.
-- =============================================================================

BEGIN;

-- =============================================================================
-- HELPERS
-- =============================================================================

-- Staff interno da transportadora (TMS): possui vínculo em tenant_usuarios.
-- SECURITY DEFINER para não sofrer RLS de tenant_usuarios.
CREATE OR REPLACE FUNCTION public.f_portal_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()
  );
$$;

-- cliente_id vinculado ao usuário do portal (usuarios_cliente.auth_user_id).
-- Diferente de f_obter_cliente_id_do_usuario(), NÃO possui fallback de TMS.
CREATE OR REPLACE FUNCTION public.f_portal_cliente_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uc.cliente_id
  FROM public.usuarios_cliente uc
  WHERE uc.auth_user_id = auth.uid()
    AND COALESCE(uc.ativo, true) = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.f_portal_is_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.f_portal_cliente_id() TO authenticated, anon;

-- Limpeza defensiva: remove QUALQUER policy antiga (inclusive permissivas
-- criadas com nomes desconhecidos) nas tabelas do Portal antes de recriar.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'entregas_protocolo',
        'rotas',
        'rota_paradas',
        'patio_checkins',
        'patio_fila',
        'patio_eventos',
        'patio_alertas',
        'patio_unidades',
        'patio_docas',
        'patio_regras_fila',
        'patio_rodizio',
        'os_historico',
        'portal_tracking_realtime',
        'usuarios_cliente'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 1. ENTREGAS_PROTOCOLO (POD)
-- =============================================================================

ALTER TABLE public.entregas_protocolo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entregas_protocolo_select_authenticated" ON public.entregas_protocolo;
DROP POLICY IF EXISTS "entregas_protocolo_insert_authenticated" ON public.entregas_protocolo;
DROP POLICY IF EXISTS "ep_select_own_portal" ON public.entregas_protocolo;
DROP POLICY IF EXISTS "ep_insert_authorized" ON public.entregas_protocolo;
DROP POLICY IF EXISTS "ep_update_authorized" ON public.entregas_protocolo;

CREATE POLICY "ep_select_own_portal" ON public.entregas_protocolo
  FOR SELECT TO authenticated
  USING (
    public.f_portal_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = entregas_protocolo.ordem_servico_id
        AND os.cliente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND os.cliente_id::uuid = public.f_portal_cliente_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.alocacoes_escala ae
      WHERE ae.id = entregas_protocolo.alocacao_id
        AND ae.cliente_id = public.f_portal_cliente_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.id = entregas_protocolo.prestador_id
        AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "ep_insert_authorized" ON public.entregas_protocolo
  FOR INSERT TO authenticated
  WITH CHECK (
    public.f_portal_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.id = entregas_protocolo.prestador_id
        AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "ep_update_authorized" ON public.entregas_protocolo
  FOR UPDATE TO authenticated
  USING (
    public.f_portal_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.id = entregas_protocolo.prestador_id
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.f_portal_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.id = entregas_protocolo.prestador_id
        AND p.auth_user_id = auth.uid()
    )
  );

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.entregas_protocolo FROM anon;

-- =============================================================================
-- 2. ROTAS E ROTA_PARADAS
-- =============================================================================

ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_paradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rotas_select_authenticated" ON public.rotas;
DROP POLICY IF EXISTS "rotas_insert_authenticated" ON public.rotas;
DROP POLICY IF EXISTS "rotas_update_authenticated" ON public.rotas;
DROP POLICY IF EXISTS "rotas_select_own_portal" ON public.rotas;
DROP POLICY IF EXISTS "rotas_insert_staff" ON public.rotas;
DROP POLICY IF EXISTS "rotas_update_staff" ON public.rotas;
DROP POLICY IF EXISTS "rotas_delete_staff" ON public.rotas;

CREATE POLICY "rotas_select_own_portal" ON public.rotas
  FOR SELECT TO authenticated
  USING (
    public.f_portal_is_staff()
    OR rotas.cliente_id = public.f_portal_cliente_id()
    OR EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.id = rotas.prestador_id
        AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "rotas_insert_staff" ON public.rotas
  FOR INSERT TO authenticated
  WITH CHECK (public.f_portal_is_staff());

CREATE POLICY "rotas_update_staff" ON public.rotas
  FOR UPDATE TO authenticated
  USING (public.f_portal_is_staff())
  WITH CHECK (public.f_portal_is_staff());

CREATE POLICY "rotas_delete_staff" ON public.rotas
  FOR DELETE TO authenticated
  USING (public.f_portal_is_staff());

DROP POLICY IF EXISTS "rota_paradas_select_authenticated" ON public.rota_paradas;
DROP POLICY IF EXISTS "rota_paradas_insert_authenticated" ON public.rota_paradas;
DROP POLICY IF EXISTS "rota_paradas_update_authenticated" ON public.rota_paradas;
DROP POLICY IF EXISTS "rp_select_own_portal" ON public.rota_paradas;
DROP POLICY IF EXISTS "rp_insert_staff" ON public.rota_paradas;
DROP POLICY IF EXISTS "rp_update_staff" ON public.rota_paradas;
DROP POLICY IF EXISTS "rp_delete_staff" ON public.rota_paradas;

CREATE POLICY "rp_select_own_portal" ON public.rota_paradas
  FOR SELECT TO authenticated
  USING (
    public.f_portal_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.rotas r
      WHERE r.id = rota_paradas.rota_id
        AND (
          r.cliente_id = public.f_portal_cliente_id()
          OR EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = r.prestador_id AND p.auth_user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "rp_insert_staff" ON public.rota_paradas
  FOR INSERT TO authenticated
  WITH CHECK (public.f_portal_is_staff());

CREATE POLICY "rp_update_staff" ON public.rota_paradas
  FOR UPDATE TO authenticated
  USING (public.f_portal_is_staff())
  WITH CHECK (public.f_portal_is_staff());

CREATE POLICY "rp_delete_staff" ON public.rota_paradas
  FOR DELETE TO authenticated
  USING (public.f_portal_is_staff());

-- =============================================================================
-- 3. PATIO_* (CHECKINS / FILA / EVENTOS / ALERTAS + CONFIG)
-- =============================================================================

DO $$
BEGIN
  -- 3.1 patio_checkins (cliente_id direto)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_checkins') THEN
    EXECUTE 'ALTER TABLE public.patio_checkins ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_checkins_select" ON public.patio_checkins';
    EXECUTE 'DROP POLICY IF EXISTS "patio_checkins_all" ON public.patio_checkins';
    EXECUTE 'DROP POLICY IF EXISTS "patio_checkins_select_own_portal" ON public.patio_checkins';
    EXECUTE 'DROP POLICY IF EXISTS "patio_checkins_write_staff" ON public.patio_checkins';
    EXECUTE $p$
      CREATE POLICY "patio_checkins_select_own_portal" ON public.patio_checkins
        FOR SELECT TO authenticated
        USING (
          public.f_portal_is_staff()
          OR cliente_id = public.f_portal_cliente_id()
          OR EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = patio_checkins.prestador_id
              AND p.auth_user_id = auth.uid()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "patio_checkins_write_staff" ON public.patio_checkins
        FOR ALL TO authenticated
        USING (public.f_portal_is_staff())
        WITH CHECK (public.f_portal_is_staff())
    $p$;
    EXECUTE $p$
      CREATE POLICY "patio_checkins_insert_prestador" ON public.patio_checkins
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = patio_checkins.prestador_id
              AND p.auth_user_id = auth.uid()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "patio_checkins_update_prestador" ON public.patio_checkins
        FOR UPDATE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = patio_checkins.prestador_id
              AND p.auth_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = patio_checkins.prestador_id
              AND p.auth_user_id = auth.uid()
          )
        )
    $p$;
  END IF;

  -- 3.2 patio_fila (via checkin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_fila') THEN
    EXECUTE 'ALTER TABLE public.patio_fila ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_fila_select" ON public.patio_fila';
    EXECUTE 'DROP POLICY IF EXISTS "patio_fila_all" ON public.patio_fila';
    EXECUTE 'DROP POLICY IF EXISTS "patio_fila_select_own_portal" ON public.patio_fila';
    EXECUTE 'DROP POLICY IF EXISTS "patio_fila_write_staff" ON public.patio_fila';
    EXECUTE $p$
      CREATE POLICY "patio_fila_select_own_portal" ON public.patio_fila
        FOR SELECT TO authenticated
        USING (
          public.f_portal_is_staff()
          OR EXISTS (
            SELECT 1 FROM public.patio_checkins pc
            WHERE pc.id = patio_fila.checkin_id
              AND pc.cliente_id = public.f_portal_cliente_id()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "patio_fila_write_staff" ON public.patio_fila
        FOR ALL TO authenticated
        USING (public.f_portal_is_staff())
        WITH CHECK (public.f_portal_is_staff())
    $p$;
  END IF;

  -- 3.3 patio_eventos (via checkin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_eventos') THEN
    EXECUTE 'ALTER TABLE public.patio_eventos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_eventos_select" ON public.patio_eventos';
    EXECUTE 'DROP POLICY IF EXISTS "patio_eventos_all" ON public.patio_eventos';
    EXECUTE 'DROP POLICY IF EXISTS "patio_eventos_select_own_portal" ON public.patio_eventos';
    EXECUTE 'DROP POLICY IF EXISTS "patio_eventos_write_staff" ON public.patio_eventos';
    EXECUTE $p$
      CREATE POLICY "patio_eventos_select_own_portal" ON public.patio_eventos
        FOR SELECT TO authenticated
        USING (
          public.f_portal_is_staff()
          OR EXISTS (
            SELECT 1 FROM public.patio_checkins pc
            WHERE pc.id = patio_eventos.checkin_id
              AND pc.cliente_id = public.f_portal_cliente_id()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "patio_eventos_write_staff" ON public.patio_eventos
        FOR ALL TO authenticated
        USING (public.f_portal_is_staff())
        WITH CHECK (public.f_portal_is_staff())
    $p$;
  END IF;

  -- 3.4 patio_alertas (via checkin)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_alertas') THEN
    EXECUTE 'ALTER TABLE public.patio_alertas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_alertas_select" ON public.patio_alertas';
    EXECUTE 'DROP POLICY IF EXISTS "patio_alertas_all" ON public.patio_alertas';
    EXECUTE 'DROP POLICY IF EXISTS "patio_alertas_select_own_portal" ON public.patio_alertas';
    EXECUTE 'DROP POLICY IF EXISTS "patio_alertas_write_staff" ON public.patio_alertas';
    EXECUTE $p$
      CREATE POLICY "patio_alertas_select_own_portal" ON public.patio_alertas
        FOR SELECT TO authenticated
        USING (
          public.f_portal_is_staff()
          OR EXISTS (
            SELECT 1 FROM public.patio_checkins pc
            WHERE pc.id = patio_alertas.checkin_id
              AND pc.cliente_id = public.f_portal_cliente_id()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "patio_alertas_write_staff" ON public.patio_alertas
        FOR ALL TO authenticated
        USING (public.f_portal_is_staff())
        WITH CHECK (public.f_portal_is_staff())
    $p$;
  END IF;

  -- 3.5 Tabelas de configuração sem cliente_id: somente staff interno.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_unidades') THEN
    EXECUTE 'ALTER TABLE public.patio_unidades ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_unidades_select" ON public.patio_unidades';
    EXECUTE 'DROP POLICY IF EXISTS "patio_unidades_all" ON public.patio_unidades';
    EXECUTE 'DROP POLICY IF EXISTS "patio_unidades_staff_only" ON public.patio_unidades';
    EXECUTE $p$ CREATE POLICY "patio_unidades_staff_only" ON public.patio_unidades FOR ALL TO authenticated USING (public.f_portal_is_staff()) WITH CHECK (public.f_portal_is_staff()) $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_docas') THEN
    EXECUTE 'ALTER TABLE public.patio_docas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_docas_select" ON public.patio_docas';
    EXECUTE 'DROP POLICY IF EXISTS "patio_docas_all" ON public.patio_docas';
    EXECUTE 'DROP POLICY IF EXISTS "patio_docas_staff_only" ON public.patio_docas';
    EXECUTE $p$ CREATE POLICY "patio_docas_staff_only" ON public.patio_docas FOR ALL TO authenticated USING (public.f_portal_is_staff()) WITH CHECK (public.f_portal_is_staff()) $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_regras_fila') THEN
    EXECUTE 'ALTER TABLE public.patio_regras_fila ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_regras_select" ON public.patio_regras_fila';
    EXECUTE 'DROP POLICY IF EXISTS "patio_regras_all" ON public.patio_regras_fila';
    EXECUTE 'DROP POLICY IF EXISTS "patio_regras_staff_only" ON public.patio_regras_fila';
    EXECUTE $p$ CREATE POLICY "patio_regras_staff_only" ON public.patio_regras_fila FOR ALL TO authenticated USING (public.f_portal_is_staff()) WITH CHECK (public.f_portal_is_staff()) $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patio_rodizio') THEN
    EXECUTE 'ALTER TABLE public.patio_rodizio ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patio_rodizio_select" ON public.patio_rodizio';
    EXECUTE 'DROP POLICY IF EXISTS "patio_rodizio_all" ON public.patio_rodizio';
    EXECUTE 'DROP POLICY IF EXISTS "patio_rodizio_staff_only" ON public.patio_rodizio';
    EXECUTE $p$ CREATE POLICY "patio_rodizio_staff_only" ON public.patio_rodizio FOR ALL TO authenticated USING (public.f_portal_is_staff()) WITH CHECK (public.f_portal_is_staff()) $p$;
  END IF;
END $$;

-- =============================================================================
-- 4. OS_HISTORICO
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='os_historico') THEN
    EXECUTE 'ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "oh_select_own" ON public.os_historico';
    EXECUTE 'DROP POLICY IF EXISTS "oh_select_auth" ON public.os_historico';
    EXECUTE 'DROP POLICY IF EXISTS "oh_insert_auth" ON public.os_historico';
    EXECUTE 'DROP POLICY IF EXISTS "os_historico_select_own_portal" ON public.os_historico';
    EXECUTE 'DROP POLICY IF EXISTS "os_historico_write_staff" ON public.os_historico';
    EXECUTE $p$
      CREATE POLICY "os_historico_select_own_portal" ON public.os_historico
        FOR SELECT TO authenticated
        USING (
          public.f_portal_is_staff()
          OR EXISTS (
            SELECT 1 FROM public.ordens_servico os
            WHERE os.id = os_historico.ordem_servico_id
              AND os.cliente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              AND os.cliente_id::uuid = public.f_portal_cliente_id()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "os_historico_write_staff" ON public.os_historico
        FOR ALL TO authenticated
        USING (public.f_portal_is_staff())
        WITH CHECK (public.f_portal_is_staff())
    $p$;
  END IF;
END $$;

-- =============================================================================
-- 5. PORTAL_TRACKING_REALTIME
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='portal_tracking_realtime') THEN
    EXECUTE 'ALTER TABLE public.portal_tracking_realtime ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ptr_select_auth" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "ptr_insert_auth" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_select_tenant" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_select_prestador" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_prestador_select" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_insert_prestador" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "ptr_select_cliente_portal" ON public.portal_tracking_realtime';
    EXECUTE 'DROP POLICY IF EXISTS "ptr_insert_authorized" ON public.portal_tracking_realtime';

    EXECUTE $p$
      CREATE POLICY "ptr_select_cliente_portal" ON public.portal_tracking_realtime
        FOR SELECT TO authenticated
        USING (
          public.f_portal_is_staff()
          OR cliente_id = public.f_portal_cliente_id()
          OR EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = portal_tracking_realtime.prestador_id
              AND p.auth_user_id = auth.uid()
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "ptr_insert_authorized" ON public.portal_tracking_realtime
        FOR INSERT TO authenticated
        WITH CHECK (
          public.f_portal_is_staff()
          OR EXISTS (
            SELECT 1 FROM public.prestadores p
            WHERE p.id = portal_tracking_realtime.prestador_id
              AND p.auth_user_id = auth.uid()
          )
        )
    $p$;
  END IF;
END $$;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.portal_tracking_realtime FROM anon;

-- =============================================================================
-- 6. USUARIOS_CLIENTE
-- =============================================================================

ALTER TABLE public.usuarios_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "anon_usuarios_cliente" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "uc_select_own" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "usuarios_cliente_select_own" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "usuarios_cliente_write_staff" ON public.usuarios_cliente;

CREATE POLICY "usuarios_cliente_select_own" ON public.usuarios_cliente
  FOR SELECT TO authenticated
  USING (public.f_portal_is_staff() OR auth_user_id = auth.uid());

CREATE POLICY "usuarios_cliente_write_staff" ON public.usuarios_cliente
  FOR ALL TO authenticated
  USING (public.f_portal_is_staff())
  WITH CHECK (public.f_portal_is_staff());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.usuarios_cliente FROM anon;

-- =============================================================================
-- 7. VIEW FINANCEIRA DO PORTAL (SEM LEITURA CRUZADA)
-- =============================================================================

DROP VIEW IF EXISTS public.vw_portal_financeiro_cliente;

CREATE VIEW public.vw_portal_financeiro_cliente
WITH (security_invoker = true)
AS
SELECT
  fr.id,
  fr.os_id,
  fr.descricao,
  fr.valor,
  CASE WHEN fr.status IN ('pago', 'recebido') THEN COALESCE(fr.valor, 0) ELSE 0 END::numeric AS valor_pago,
  fr.data_vencimento,
  fr.data_pagamento,
  fr.status,
  fr.cliente,
  fr.cliente_nome,
  fr.cliente_id,
  fr.created_at,
  fr.updated_at
FROM public.financeiro_receber fr
WHERE public.f_portal_is_staff()
   OR fr.cliente_id = public.f_portal_cliente_id();

COMMENT ON VIEW public.vw_portal_financeiro_cliente IS
  'ONDA1 — Financeiro do cliente (apenas receber), security_invoker + filtro por cliente. NÃO EXPÕE custo/prestador/margem.';

GRANT SELECT ON public.vw_portal_financeiro_cliente TO authenticated;
REVOKE SELECT ON public.vw_portal_financeiro_cliente FROM anon;

-- =============================================================================
-- 8. RPC CONVERTER_PEDIDO_PARA_OS — ANTI-IDOR (WRAPPER)
-- =============================================================================

-- Renomeia o corpo original para _base (apenas uma vez).
DO $$
BEGIN
  IF to_regprocedure('public.converter_pedido_para_os(uuid,uuid)') IS NOT NULL
     AND to_regprocedure('public._converter_pedido_para_os_base(uuid,uuid)') IS NULL THEN
    ALTER FUNCTION public.converter_pedido_para_os(uuid, uuid)
      RENAME TO _converter_pedido_para_os_base;
  END IF;
END $$;

-- Bloqueia execução direta do corpo base por usuários finais.
DO $$
BEGIN
  IF to_regprocedure('public._converter_pedido_para_os_base(uuid,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public._converter_pedido_para_os_base(uuid, uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public._converter_pedido_para_os_base(uuid, uuid) TO service_role';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.converter_pedido_para_os(
  p_pedido_id UUID,
  p_operador_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autorizado BOOLEAN := false;
  v_staff BOOLEAN := public.f_portal_is_staff() OR auth.role() = 'service_role';
BEGIN
  -- Staff interno, service_role e prestador do próprio pedido (quando aplicável)
  IF v_staff THEN
    v_autorizado := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.portal_pedidos pp
      WHERE pp.id = p_pedido_id
        AND pp.cliente_id = public.f_portal_cliente_id()
    ) INTO v_autorizado;
  END IF;

  IF NOT v_autorizado THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACESSO_NEGADO',
      'message', 'Pedido não pertence ao cliente autenticado'
    );
  END IF;

  IF to_regprocedure('public._converter_pedido_para_os_base(uuid,uuid)') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CONVERSAO_INDISPONIVEL',
      'message', 'Função base de conversão não encontrada'
    );
  END IF;

  RETURN public._converter_pedido_para_os_base(p_pedido_id, CASE WHEN v_staff THEN p_operador_id ELSE NULL END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.converter_pedido_para_os(UUID, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.converter_pedido_para_os(UUID, UUID) FROM PUBLIC, anon;

COMMIT;
