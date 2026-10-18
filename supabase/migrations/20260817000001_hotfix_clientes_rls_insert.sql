-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTFIX CLIENTES RLS — CORREÇÃO MÍNIMA (INSERT)
-- TMS: express-connect-hub | Supabase: uwrvzsjtpgaifkktpepn
-- Base: HOTFIX_CLIENTES_RLS_DIAGNOSTICO.txt
--
-- Causa: `clientes_insert_own` usava WITH CHECK f_usuario_pode_acessar_cliente(id)
-- que, para não-admin, faz EXISTS em clientes.id = NEW.id (linha invisível no
-- próprio INSERT → sempre false → violação de RLS).
--
-- Correção mínima (autorizada):
--   1. Criar f_usuario_pode_acessar_tenant(uuid) — valida pelo NEW.tenant_id,
--      sem subquery na própria `clientes`. super_admin/admin liberados; demais
--      usuários apenas no próprio tenant (tenant_usuarios).
--   2. Trocar SOMENTE a policy INSERT clientes_insert_own.
--   3. NÃO toca SELECT/UPDATE/DELETE, frontend ou outras tabelas.
-- Backup textual pré-alteração: scripts/backup_hotfix_clientes_rls_*.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_tenant(
  p_tenant_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_papel text;
BEGIN
  SELECT tu.tenant_id, COALESCE(tu.papel, '') INTO v_tenant_id, v_papel
  FROM public.tenant_usuarios tu
  WHERE tu.user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  -- super_admin/admin liberados (padrão atual do projeto)
  IF v_papel IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;

  -- demais usuários: somente no próprio tenant; tenant nulo vira o próprio
  RETURN COALESCE(p_tenant_id, v_tenant_id) = v_tenant_id;
END;
$function$;

COMMENT ON FUNCTION public.f_usuario_pode_acessar_tenant(uuid) IS
  'HOTFIX CLIENTES RLS — valida acesso por tenant (NEW.tenant_id) via tenant_usuarios. SECURITY DEFINER, search_path vazio. super_admin/admin liberados; demais apenas no próprio tenant. Grants: authenticated + service_role.';

-- Grants seguros (sem PUBLIC/anon)
REVOKE ALL ON FUNCTION public.f_usuario_pode_acessar_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_usuario_pode_acessar_tenant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_usuario_pode_acessar_tenant(uuid) TO authenticated, service_role;

-- Policy INSERT: avaliar NEW.tenant_id em vez da chave id
DROP POLICY IF EXISTS clientes_insert_own ON public.clientes;
CREATE POLICY clientes_insert_own ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (f_usuario_pode_acessar_tenant(tenant_id));

COMMIT;
