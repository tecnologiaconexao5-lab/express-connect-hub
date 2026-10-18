-- =====================================================
-- PORTAL CLIENTE — CORREÇÃO RLS / MULTI-TENANT v2
-- Migration v2: RLS seguro via auth.uid() + usuarios_cliente
-- Substitui v1 que usava get_current_cliente_id() (inseguro)
-- =====================================================

-- =====================================================
-- 1. DROP POLICIES DEPENDENTES + FUNÇÃO ANTIGA (V1 insegura)
-- =====================================================
DO $$ BEGIN
    DROP POLICY IF EXISTS "portal_pedidos_select" ON public.portal_pedidos;
    DROP POLICY IF EXISTS "portal_pedidos_insert" ON public.portal_pedidos;
    DROP POLICY IF EXISTS "portal_pedidos_update" ON public.portal_pedidos;
    DROP POLICY IF EXISTS "portal_pedidos_delete" ON public.portal_pedidos;
    DROP POLICY IF EXISTS "portal_faturas_select" ON public.portal_faturas;
    DROP POLICY IF EXISTS "portal_faturas_insert" ON public.portal_faturas;
    DROP POLICY IF EXISTS "portal_faturas_update" ON public.portal_faturas;
    DROP POLICY IF EXISTS "portal_ocorrencias_select" ON public.portal_ocorrencias;
    DROP POLICY IF EXISTS "portal_ocorrencias_insert" ON public.portal_ocorrencias;
    DROP POLICY IF EXISTS "portal_ocorrencias_update" ON public.portal_ocorrencias;
    DROP POLICY IF EXISTS "portal_comprovantes_select" ON public.portal_comprovantes;
    DROP POLICY IF EXISTS "portal_comprovantes_insert" ON public.portal_comprovantes;
    DROP POLICY IF EXISTS "portal_comprovantes_update" ON public.portal_comprovantes;
    DROP POLICY IF EXISTS "portal_avaliacoes_select" ON public.portal_avaliacoes;
    DROP POLICY IF EXISTS "portal_avaliacoes_insert" ON public.portal_avaliacoes;
    DROP POLICY IF EXISTS "portal_avaliacoes_update" ON public.portal_avaliacoes;
    DROP POLICY IF EXISTS "portal_notificacoes_select" ON public.portal_notificacoes;
    DROP POLICY IF EXISTS "portal_notificacoes_insert" ON public.portal_notificacoes;
    DROP POLICY IF EXISTS "portal_notificacoes_update" ON public.portal_notificacoes;
    DROP POLICY IF EXISTS "portal_protocolos_select" ON public.portal_protocolos;
    DROP POLICY IF EXISTS "portal_protocolos_insert" ON public.portal_protocolos;
    DROP POLICY IF EXISTS "portal_protocolos_update" ON public.portal_protocolos;
    DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime;
    DROP POLICY IF EXISTS "portal_tracking_insert" ON public.portal_tracking_realtime;
    DROP POLICY IF EXISTS "portal_tracking_update" ON public.portal_tracking_realtime;
    DROP POLICY IF EXISTS "portal_rotas_select" ON public.portal_rotas;
    DROP POLICY IF EXISTS "portal_rotas_insert" ON public.portal_rotas;
    DROP POLICY IF EXISTS "portal_rotas_update" ON public.portal_rotas;
    DROP POLICY IF EXISTS "portal_relatorios_select" ON public.portal_relatorios;
    DROP POLICY IF EXISTS "portal_relatorios_insert" ON public.portal_relatorios;
    DROP POLICY IF EXISTS "portal_relatorios_update" ON public.portal_relatorios;
    DROP POLICY IF EXISTS "portal_preferencias_select" ON public.portal_preferencias_cliente;
    DROP POLICY IF EXISTS "portal_preferencias_insert" ON public.portal_preferencias_cliente;
    DROP POLICY IF EXISTS "portal_preferencias_update" ON public.portal_preferencias_cliente;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.get_current_cliente_id();

-- =====================================================
-- 2. FUNÇÃO SEGURA: resolve cliente_id via auth.uid()
--    ou current_setting, seguindo padrão current_tenant_id_safe()
-- =====================================================
CREATE OR REPLACE FUNCTION public.current_cliente_id_safe()
RETURNS UUID AS $$
DECLARE
    v_cliente_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Tenta current_setting (definido via backend ou Edge Function)
    v_cliente_id := NULLIF(current_setting('app.current_cliente_id', true), '')::UUID;
    IF v_cliente_id IS NOT NULL THEN
        RETURN v_cliente_id;
    END IF;

    -- 2. Se não tem current_setting, tenta auth.uid()
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        -- Sem auth.uid() = usuário anônimo
        -- Para SELECT: não retorna nada (security by default)
        -- Para INSERT: não permite (WITH CHECK falha)
        RETURN NULL;
    END IF;

    -- 3. Usuário autenticado: busca seu cliente_id via usuarios_cliente
    SELECT cliente_id INTO v_cliente_id
    FROM usuarios_cliente
    WHERE auth_user_id = v_user_id AND ativo = true
    LIMIT 1;

    RETURN v_cliente_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 3. CORREÇÃO RLS - PORTAL_PEDIDOS (SEM OR NULL)
-- =====================================================
DROP POLICY IF EXISTS "portal_pedidos_select" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_insert" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_update" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_delete" ON public.portal_pedidos;

-- SELECT: apenas dados do cliente logado
CREATE POLICY "portal_pedidos_select" ON public.portal_pedidos
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- INSERT: cliente_id deve bater com o cliente logado
CREATE POLICY "portal_pedidos_insert" ON public.portal_pedidos
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

-- UPDATE: apenas dados do próprio cliente
CREATE POLICY "portal_pedidos_update" ON public.portal_pedidos
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- DELETE: apenas dados do próprio cliente
CREATE POLICY "portal_pedidos_delete" ON public.portal_pedidos
  FOR DELETE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 4. CORREÇÃO RLS - PORTAL_FATURAS
-- =====================================================
DROP POLICY IF EXISTS "portal_faturas_select" ON public.portal_faturas;
DROP POLICY IF EXISTS "portal_faturas_insert" ON public.portal_faturas;
DROP POLICY IF EXISTS "portal_faturas_update" ON public.portal_faturas;

CREATE POLICY "portal_faturas_select" ON public.portal_faturas
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_faturas_insert" ON public.portal_faturas
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_faturas_update" ON public.portal_faturas
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 5. CORREÇÃO RLS - PORTAL_OCORRENCIAS
-- =====================================================
DROP POLICY IF EXISTS "portal_ocorrencias_select" ON public.portal_ocorrencias;
DROP POLICY IF EXISTS "portal_ocorrencias_insert" ON public.portal_ocorrencias;
DROP POLICY IF EXISTS "portal_ocorrencias_update" ON public.portal_ocorrencias;

CREATE POLICY "portal_ocorrencias_select" ON public.portal_ocorrencias
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_ocorrencias_insert" ON public.portal_ocorrencias
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_ocorrencias_update" ON public.portal_ocorrencias
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 6. CORREÇÃO RLS - PORTAL_COMPROVANTES
-- =====================================================
DROP POLICY IF EXISTS "portal_comprovantes_select" ON public.portal_comprovantes;
DROP POLICY IF EXISTS "portal_comprovantes_insert" ON public.portal_comprovantes;
DROP POLICY IF EXISTS "portal_comprovantes_update" ON public.portal_comprovantes;

CREATE POLICY "portal_comprovantes_select" ON public.portal_comprovantes
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_comprovantes_insert" ON public.portal_comprovantes
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_comprovantes_update" ON public.portal_comprovantes
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 7. CORREÇÃO RLS - PORTAL_AVALIACOES
-- =====================================================
DROP POLICY IF EXISTS "portal_avaliacoes_select" ON public.portal_avaliacoes;
DROP POLICY IF EXISTS "portal_avaliacoes_insert" ON public.portal_avaliacoes;
DROP POLICY IF EXISTS "portal_avaliacoes_update" ON public.portal_avaliacoes;

CREATE POLICY "portal_avaliacoes_select" ON public.portal_avaliacoes
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_avaliacoes_insert" ON public.portal_avaliacoes
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_avaliacoes_update" ON public.portal_avaliacoes
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 8. CORREÇÃO RLS - PORTAL_NOTIFICACOES
-- =====================================================
DROP POLICY IF EXISTS "portal_notificacoes_select" ON public.portal_notificacoes;
DROP POLICY IF EXISTS "portal_notificacoes_insert" ON public.portal_notificacoes;
DROP POLICY IF EXISTS "portal_notificacoes_update" ON public.portal_notificacoes;

CREATE POLICY "portal_notificacoes_select" ON public.portal_notificacoes
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_notificacoes_insert" ON public.portal_notificacoes
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_notificacoes_update" ON public.portal_notificacoes
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 9. CORREÇÃO RLS - PORTAL_PROTOCOLOS
-- =====================================================
DROP POLICY IF EXISTS "portal_protocolos_select" ON public.portal_protocolos;
DROP POLICY IF EXISTS "portal_protocolos_insert" ON public.portal_protocolos;
DROP POLICY IF EXISTS "portal_protocolos_update" ON public.portal_protocolos;

CREATE POLICY "portal_protocolos_select" ON public.portal_protocolos
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_protocolos_insert" ON public.portal_protocolos
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_protocolos_update" ON public.portal_protocolos
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 10. CORREÇÃO RLS - PORTAL_TRACKING_REALTIME
-- =====================================================
DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS "portal_tracking_insert" ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS "portal_tracking_update" ON public.portal_tracking_realtime;

CREATE POLICY "portal_tracking_select" ON public.portal_tracking_realtime
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_tracking_insert" ON public.portal_tracking_realtime
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_tracking_update" ON public.portal_tracking_realtime
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 11. CORREÇÃO RLS - PORTAL_ROTAS
-- =====================================================
DROP POLICY IF EXISTS "portal_rotas_select" ON public.portal_rotas;
DROP POLICY IF EXISTS "portal_rotas_insert" ON public.portal_rotas;
DROP POLICY IF EXISTS "portal_rotas_update" ON public.portal_rotas;

CREATE POLICY "portal_rotas_select" ON public.portal_rotas
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_rotas_insert" ON public.portal_rotas
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_rotas_update" ON public.portal_rotas
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 12. CORREÇÃO RLS - PORTAL_RELATORIOS
-- =====================================================
DROP POLICY IF EXISTS "portal_relatorios_select" ON public.portal_relatorios;
DROP POLICY IF EXISTS "portal_relatorios_insert" ON public.portal_relatorios;
DROP POLICY IF EXISTS "portal_relatorios_update" ON public.portal_relatorios;

CREATE POLICY "portal_relatorios_select" ON public.portal_relatorios
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_relatorios_insert" ON public.portal_relatorios
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_relatorios_update" ON public.portal_relatorios
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 13. CORREÇÃO RLS - PORTAL_PREFERENCIAS_CLIENTE
-- =====================================================
DROP POLICY IF EXISTS "portal_preferencias_select" ON public.portal_preferencias_cliente;
DROP POLICY IF EXISTS "portal_preferencias_insert" ON public.portal_preferencias_cliente;
DROP POLICY IF EXISTS "portal_preferencias_update" ON public.portal_preferencias_cliente;

CREATE POLICY "portal_preferencias_select" ON public.portal_preferencias_cliente
  FOR SELECT
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_preferencias_insert" ON public.portal_preferencias_cliente
  FOR INSERT
  WITH CHECK (
    cliente_id = public.current_cliente_id_safe()
  );

CREATE POLICY "portal_preferencias_update" ON public.portal_preferencias_cliente
  FOR UPDATE
  USING (
    cliente_id = public.current_cliente_id_safe()
  );

-- =====================================================
-- 14. POLITICA PARA ADMIN/SUPER_ADMIN
--     Permite acesso irrestrito para administradores
-- =====================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'portal_%'
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "portal_admin_full_access" ON public.%I;
            CREATE POLICY "portal_admin_full_access" ON public.%I
              FOR ALL
              TO authenticated
              USING (
                EXISTS (
                  SELECT 1 FROM tenant_usuarios
                  WHERE user_id = auth.uid()
                    AND papel IN (''super_admin'', ''admin_tenant'', ''financeiro'', ''comercial'', ''operacional'', ''atendimento'')
                    AND status = ''ativo''
                  LIMIT 1
                )
              );
        ', r.tablename, r.tablename);
    END LOOP;
END $$;

-- =====================================================
-- 15. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================================
COMMENT ON FUNCTION public.current_cliente_id_safe() IS
'Resolve cliente_id do usuario autenticado:
 1. current_setting(''app.current_cliente_id'') (via backend/Edge Function)
 2. auth.uid() → usuarios_cliente (via JWT Supabase)
 3. NULL: sem autenticacao → bloqueia acesso (security by default)

Admin/super_admin tem politica separada com acesso total.';

-- =====================================================
-- 16. INSTRUÇÕES DE VERIFICAÇÃO
-- =====================================================
-- Para validar isolamento manualmente no SQL Editor do Supabase:
-- 
-- -- Simular cliente 1:
-- SET ROLE authenticated;
-- SET request.jwt.claim.sub TO 'auth-user-id-do-cliente-1';
-- -- A query deve retornar apenas dados do cliente 1:
-- SELECT * FROM portal_pedidos;
--
-- -- Tentar ver dados de cliente 2 deve retornar 0 registros:
-- SELECT * FROM portal_pedidos WHERE cliente_id = 'uuid-do-cliente-2';
-- -- (se cliente_id diferente do logado, policy bloqueia)