-- =====================================================
-- MISSÃO 136-A — CORREÇÃO REAL: CADASTRO DE CLIENTES
-- Data: 2026-07-22
-- =====================================================
-- 
-- PROBLEMAS CORRIGIDOS:
--   P1: f_usuario_pode_acessar_cliente() referencia
--       tenant_usuarios.auth_user_id (coluna INEXISTENTE).
--       Correto: tenant_usuarios.user_id
--   P2: f_obter_cliente_id_do_usuario() mesmo erro.
--   P3: NENHUMA policy INSERT ou DELETE em clientes.
--       TMS não conseguia criar ou excluir clientes.
--   P4: obter_cliente_id_do_usuario() SECURITY DEFINER
--       search_path inseguro.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CORRIGIR f_usuario_pode_acessar_cliente
--    Antes: tu.auth_user_id (NÃO EXISTE)
--    Depois: tu.user_id (EXISTE em tenant_usuarios)
-- =====================================================
CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_cliente(p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- TMS: super_admin ou admin (via metadata)
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND raw_user_meta_data->>'papel' IN ('super_admin', 'admin')) THEN RETURN true; END IF;
  -- Portal: usuário vinculado diretamente
  IF EXISTS (SELECT 1 FROM public.usuarios_cliente
    WHERE auth_user_id = auth.uid() AND cliente_id = p_cliente_id) THEN RETURN true; END IF;
  -- TMS: usuário do mesmo tenant (CORRIGIDO: user_id, não auth_user_id)
  IF EXISTS (SELECT 1 FROM public.clientes c
    JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
    WHERE c.id = p_cliente_id AND tu.user_id = auth.uid()) THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

-- =====================================================
-- 2. CORRIGIR f_obter_cliente_id_do_usuario
--    Mesma correção: tu.auth_user_id → tu.user_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.f_obter_cliente_id_do_usuario()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id UUID;
BEGIN
  -- Portal: busca direta em usuarios_cliente
  SELECT cliente_id INTO v_cliente_id FROM public.usuarios_cliente
  WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_cliente_id IS NOT NULL THEN RETURN v_cliente_id; END IF;
  -- TMS: busca via tenant (CORRIGIDO: user_id, não auth_user_id)
  SELECT c.id INTO v_cliente_id FROM public.clientes c
  JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
  WHERE tu.user_id = auth.uid() LIMIT 1;
  RETURN v_cliente_id;
END;
$function$;

-- =====================================================
-- 3. ADICIONAR POLICIES INSERT e DELETE em clientes
--    Antes: NENHUMA — TMS não conseguia criar/excluir
-- =====================================================

-- INSERT: authenticated com acesso via tenant
DROP POLICY IF EXISTS "clientes_insert_own" ON public.clientes;
CREATE POLICY "clientes_insert_own" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (f_usuario_pode_acessar_cliente(id));

-- DELETE: authenticated com acesso via tenant
DROP POLICY IF EXISTS "clientes_delete_own" ON public.clientes;
CREATE POLICY "clientes_delete_own" ON public.clientes
  FOR DELETE TO authenticated
  USING (f_usuario_pode_acessar_cliente(id));

-- =====================================================
-- 4. VERIFICAÇÃO — Listar policies resultantes
-- =====================================================
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    left(qual::text, 80) as qual_resumo,
    left(with_check::text, 80) as wc_resumo
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'clientes'
ORDER BY policyname;

COMMIT;
