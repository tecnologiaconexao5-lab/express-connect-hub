-- =====================================================
-- MISSÃO 136-A — FIX 2: Funções de acesso
-- =====================================================
-- 
-- Problema: f_usuario_pode_acessar_cliente verificava
-- raw_user_meta_data->>'papel' que só existe para
-- usuários do Portal (cliente), NÃO para TMS.
-- TMS users (tamiris, financeiro, etc.) têm papel
-- em tenant_usuarios.papel.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CORRIGIR f_usuario_pode_acessar_cliente
--    Admin check via tenant_usuarios (não metadata)
-- =====================================================
CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_cliente(p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Portal: usuário vinculado diretamente via usuarios_cliente
  IF EXISTS (SELECT 1 FROM public.usuarios_cliente
    WHERE auth_user_id = auth.uid() AND cliente_id = p_cliente_id) THEN RETURN true; END IF;
  -- TMS: usuário do mesmo tenant via tenant_usuarios
  IF EXISTS (SELECT 1 FROM public.clientes c
    JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
    WHERE c.id = p_cliente_id AND tu.user_id = auth.uid()) THEN RETURN true; END IF;
  -- TMS admin: super_admin pode acessar qualquer cliente
  IF EXISTS (SELECT 1 FROM public.tenant_usuarios
    WHERE user_id = auth.uid() AND papel IN ('super_admin', 'admin_tenant') AND status = 'ativo')
  THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

-- =====================================================
-- 2. CORRIGIR f_obter_cliente_id_do_usuario
--    Mesma lógica: admin check via tenant
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
  -- TMS: busca via tenant
  SELECT c.id INTO v_cliente_id FROM public.clientes c
  JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
  WHERE tu.user_id = auth.uid() LIMIT 1;
  RETURN v_cliente_id;
END;
$function$;

COMMIT;
