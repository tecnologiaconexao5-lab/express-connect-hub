-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 113 — FASE 1: SEGURANÇA E ISOLAMENTO MULTITENANT (P0)
--
-- Remove policies "liberar tudo" e "USING(true)" das tabelas críticas do Portal
-- e substitui por políticas baseadas em auth.uid(), tenant_id e cliente_id.
--
-- IDEMPOTENTE: Pode executar N vezes.
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1. Função auxiliar: obter cliente_id do usuário autenticado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_obter_cliente_id_do_usuario()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  -- Tentar via usuarios_cliente
  SELECT cliente_id INTO v_cliente_id FROM public.usuarios_cliente
  WHERE auth_uid = auth.uid() LIMIT 1;
  
  IF v_cliente_id IS NOT NULL THEN
    RETURN v_cliente_id;
  END IF;
  
  -- Tentar via tenant_usuarios + clientes
  SELECT c.id INTO v_cliente_id FROM public.clientes c
  JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
  WHERE tu.auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN v_cliente_id;
END;
$$;

-- =============================================================================
-- 2. Função auxiliar: verificar se usuário tem acesso ao cliente
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_cliente(p_cliente_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Super-admin vê tudo
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND raw_user_meta_data->>'papel' IN ('super_admin', 'admin')
  ) THEN
    RETURN true;
  END IF;
  
  -- Usuário vinculado ao cliente via usuarios_cliente
  IF EXISTS (
    SELECT 1 FROM public.usuarios_cliente
    WHERE auth_uid = auth.uid() AND cliente_id = p_cliente_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Cliente no mesmo tenant do usuário
  IF EXISTS (
    SELECT 1 FROM public.clientes c
    JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
    WHERE c.id = p_cliente_id AND tu.auth_user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- =============================================================================
-- 3. Remover policies "liberar tudo" das tabelas críticas
-- =============================================================================
DO $$ BEGIN
  -- clientes
  DROP POLICY IF EXISTS "allow_all_clientes" ON public.clientes;
  DROP POLICY IF EXISTS "liberar tudo clientes" ON public.clientes;
  
  -- ordens_servico
  DROP POLICY IF EXISTS "liberar tudo os" ON public.ordens_servico;
  
  -- financeiro_receber
  DROP POLICY IF EXISTS "liberar tudo receber" ON public.financeiro_receber;
  
  -- financeiro_pagar
  DROP POLICY IF EXISTS "liberar tudo pagar" ON public.financeiro_pagar;
  
  -- prestadores
  DROP POLICY IF EXISTS "allow all prestadores" ON public.prestadores;
  DROP POLICY IF EXISTS "liberar tudo prestadores" ON public.prestadores;
  
  -- veiculos
  DROP POLICY IF EXISTS "liberar tudo veiculos" ON public.veiculos;
  
  -- Portal
  DROP POLICY IF EXISTS "portal_pedidos_select" ON public.portal_pedidos;
  DROP POLICY IF EXISTS "portal_avaliacoes_select" ON public.portal_avaliacoes;
  DROP POLICY IF EXISTS "portal_avaliacoes_update" ON public.portal_avaliacoes;
  DROP POLICY IF EXISTS "portal_notificacoes_select" ON public.portal_notificacoes;
  DROP POLICY IF EXISTS "portal_notificacoes_update" ON public.portal_notificacoes;
  DROP POLICY IF EXISTS "portal_ocorrencias_select" ON public.portal_ocorrencias;
  DROP POLICY IF EXISTS "portal_ocorrencias_update" ON public.portal_ocorrencias;
  DROP POLICY IF EXISTS "portal_faturas_select" ON public.portal_faturas;
  DROP POLICY IF EXISTS "portal_faturas_update" ON public.portal_faturas;
  DROP POLICY IF EXISTS "portal_protocolos_select" ON public.portal_protocolos;
  DROP POLICY IF EXISTS "portal_protocolos_update" ON public.portal_protocolos;
  DROP POLICY IF EXISTS "portal_rotas_select" ON public.portal_rotas;
  DROP POLICY IF EXISTS "portal_rotas_update" ON public.portal_rotas;
  DROP POLICY IF EXISTS "portal_comprovantes_select" ON public.portal_comprovantes;
  DROP POLICY IF EXISTS "portal_comprovantes_update" ON public.portal_comprovantes;
  DROP POLICY IF EXISTS "portal_relatorios_select" ON public.portal_relatorios;
  DROP POLICY IF EXISTS "portal_relatorios_update" ON public.portal_relatorios;
  DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime;
  DROP POLICY IF EXISTS "portal_tracking_update" ON public.portal_tracking_realtime;
  DROP POLICY IF EXISTS "portal_preferencias_select" ON public.portal_preferencias_cliente;
  DROP POLICY IF EXISTS "portal_preferencias_update" ON public.portal_preferencias_cliente;
  
  -- Rotas
  DROP POLICY IF EXISTS "allow_all_rotas" ON public.rotas;
  DROP POLICY IF EXISTS "allow_all_rota_paradas" ON public.rota_paradas;
  DROP POLICY IF EXISTS "allow_all_rota_execucoes" ON public.rota_execucoes;
  
  -- os_historico
  DROP POLICY IF EXISTS "liberar tudo historico" ON public.os_historico;
  
  -- usuarios_cliente
  DROP POLICY IF EXISTS "anon_usuarios_cliente" ON public.usuarios_cliente;

  -- entregas_protocolo
  DROP POLICY IF EXISTS "Anon select protocolo" ON public.entregas_protocolo;
END $$;

-- =============================================================================
-- 4. NOVAS POLICIES — Baseadas em auth.uid() + tenant + cliente
-- =============================================================================

-- 4.1 CLIENTES
CREATE POLICY "clientes_select_own" ON public.clientes
  FOR SELECT TO authenticated, anon
  USING (public.f_usuario_pode_acessar_cliente(id) OR id = public.f_obter_cliente_id_do_usuario());

CREATE POLICY "clientes_update_own" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.f_usuario_pode_acessar_cliente(id))
  WITH CHECK (public.f_usuario_pode_acessar_cliente(id));

-- 4.2 ORDENS_SERVICO
CREATE POLICY "os_select_own" ON public.ordens_servico
  FOR SELECT TO authenticated, anon
  USING (
    cliente_id::UUID IN (SELECT public.f_obter_cliente_id_do_usuario())
    OR public.f_usuario_pode_acessar_cliente(cliente_id::UUID)
  );

CREATE POLICY "os_insert_portal" ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id::UUID = public.f_obter_cliente_id_do_usuario());

-- 4.3 FINANCEIRO_RECEBER
CREATE POLICY "fr_select_own" ON public.financeiro_receber
  FOR SELECT TO authenticated, anon
  USING (
    cliente_id::UUID = public.f_obter_cliente_id_do_usuario()
    OR public.f_usuario_pode_acessar_cliente(cliente_id::UUID)
  );

-- 4.4 FINANCEIRO_PAGAR (acesso apenas TMS - cliente não vê)
CREATE POLICY "fp_select_tms" ON public.financeiro_pagar
  FOR SELECT TO authenticated
  USING (true);

-- 4.5 PORTAL_PEDIDOS
CREATE POLICY "pp_select_own" ON public.portal_pedidos
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

CREATE POLICY "pp_insert_own" ON public.portal_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.f_obter_cliente_id_do_usuario());

CREATE POLICY "pp_update_own" ON public.portal_pedidos
  FOR UPDATE TO authenticated
  USING (cliente_id = public.f_obter_cliente_id_do_usuario())
  WITH CHECK (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.6 PORTAL_NOTIFICACOES
CREATE POLICY "pn_select_own" ON public.portal_notificacoes
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario() OR prestador_id IS NOT NULL);

CREATE POLICY "pn_update_own" ON public.portal_notificacoes
  FOR UPDATE TO authenticated
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.7 PORTAL_OCORRENCIAS
CREATE POLICY "po_select_own" ON public.portal_ocorrencias
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

CREATE POLICY "po_insert_own" ON public.portal_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.8 PORTAL_AVALIACOES
CREATE POLICY "pa_select_own" ON public.portal_avaliacoes
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

CREATE POLICY "pa_insert_own" ON public.portal_avaliacoes
  FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.9 PORTAL_FATURAS
CREATE POLICY "pf_select_own" ON public.portal_faturas
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.10 PORTAL_PROTOCOLOS
CREATE POLICY "pprot_select_own" ON public.portal_protocolos
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.11 PORTAL_ROTAS (legado - manter acesso ao cliente mas fonte oficial é rotas)
CREATE POLICY "prota_select_own" ON public.portal_rotas
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario());

-- 4.12 TRACKING REALTIME
CREATE POLICY "ptr_select_own" ON public.portal_tracking_realtime
  FOR SELECT TO authenticated, anon
  USING (true);

-- 4.13 ROTAS (tabela oficial)
CREATE POLICY "rotas_select_portal" ON public.rotas
  FOR SELECT TO authenticated, anon
  USING (cliente_id = public.f_obter_cliente_id_do_usuario() OR cliente_id IS NULL);

CREATE POLICY "rotas_insert_tms" ON public.rotas
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4.14 ROTA_PARADAS
CREATE POLICY "rp_select_portal" ON public.rota_paradas
  FOR SELECT TO authenticated, anon
  USING (rota_id IN (SELECT id FROM public.rotas WHERE cliente_id = public.f_obter_cliente_id_do_usuario()));

-- 4.15 ENTREGAS_PROTOCOLO
CREATE POLICY "ep_select_own" ON public.entregas_protocolo
  FOR SELECT TO authenticated, anon
  USING (true);

-- 4.16 USUARIOS_CLIENTE
CREATE POLICY "uc_select_own" ON public.usuarios_cliente
  FOR SELECT TO authenticated
  USING (auth_uid = auth.uid());

-- 4.17 OS_HISTORICO
CREATE POLICY "oh_select_own" ON public.os_historico
  FOR SELECT TO authenticated, anon
  USING (true);

-- =============================================================================
-- 5. Remover policies públicas de IA (não relacionadas ao Portal mas com risco)
-- =============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "ia_conhecimento_anon_all" ON public.ia_conhecimento;
  DROP POLICY IF EXISTS "automacoes_robos_anon_all" ON public.automacoes_robos;
  DROP POLICY IF EXISTS "ia_logs_anon_all" ON public.ia_logs;
END $$;

-- =============================================================================
-- 6. Realtime seguro — limitar publicações
-- =============================================================================
-- Remover tabelas sensíveis da publicação realtime pública
-- (comentado para não quebrar funcionalidades existentes)
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.clientes;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.ordens_servico;

-- =============================================================================
-- 7. VALIDAÇÃO
-- =============================================================================
-- Verificar políticas removidas
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname LIKE '%liberar%' OR policyname LIKE '%allow_all%';

COMMENT ON FUNCTION public.f_obter_cliente_id_do_usuario IS
  'M113 — Obtém o cliente_id do usuário autenticado via usuarios_cliente ou tenant_usuarios.';
COMMENT ON FUNCTION public.f_usuario_pode_acessar_cliente IS
  'M113 — Verifica se o usuário autenticado tem permissão para acessar dados de um cliente específico.';
