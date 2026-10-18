-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 19
-- Multi-Tenant Fase 5: Administracao de Tenants
-- RLS + Permissoes + Funcoes para gestao de empresas
-- Data: 2026-06-26
-- ============================================================

-- ============================================================
-- SECAO 1: FUNCAO user_can_manage_tenants
-- ============================================================
CREATE OR REPLACE FUNCTION user_can_manage_tenants()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE user_id = auth.uid()
          AND papel IN ('super_admin', 'admin_tenant')
          AND status = 'ativo'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ============================================================
-- SECAO 2: FUNCAO user_is_super_admin
-- ============================================================
CREATE OR REPLACE FUNCTION user_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE user_id = auth.uid()
          AND papel = 'super_admin'
          AND status = 'ativo'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ============================================================
-- SECAO 3: RLS FORTE PARA tenants
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- SELECT: anon + authenticated podem ler (essencial para carregamento)
DROP POLICY IF EXISTS "tenants_select_anon" ON tenants;
CREATE POLICY "tenants_select_anon" ON tenants FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "tenants_select_auth" ON tenants;
CREATE POLICY "tenants_select_auth" ON tenants FOR SELECT TO authenticated USING (true);

-- INSERT: apenas super_admin pode criar novo tenant
DROP POLICY IF EXISTS "tenants_insert_auth" ON tenants;
DROP POLICY IF EXISTS "tenants_insert_admin" ON tenants;
CREATE POLICY "tenants_insert_admin" ON tenants FOR INSERT TO authenticated
  WITH CHECK (user_is_super_admin());

-- UPDATE: super_admin pode atualizar qualquer tenant; admin_tenant apenas o proprio
DROP POLICY IF EXISTS "tenants_update_auth" ON tenants;
DROP POLICY IF EXISTS "tenants_update_admin" ON tenants;
CREATE POLICY "tenants_update_admin" ON tenants FOR UPDATE TO authenticated
  USING (user_is_super_admin() OR user_tenant_role(id) = 'admin_tenant');

-- DELETE: apenas super_admin
DROP POLICY IF EXISTS "tenants_delete_admin" ON tenants;
CREATE POLICY "tenants_delete_admin" ON tenants FOR DELETE TO authenticated
  USING (user_is_super_admin());

-- ============================================================
-- SECAO 4: RLS FORTE PARA tenant_usuarios
-- ============================================================
ALTER TABLE tenant_usuarios ENABLE ROW LEVEL SECURITY;

-- SELECT: anon + authenticated podem ler (essencial para carregamento)
DROP POLICY IF EXISTS "tu_select_anon" ON tenant_usuarios;
CREATE POLICY "tu_select_anon" ON tenant_usuarios FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "tu_select_auth" ON tenant_usuarios;
CREATE POLICY "tu_select_auth" ON tenant_usuarios FOR SELECT TO authenticated USING (true);

-- INSERT: super_admin pode criar em qualquer tenant; admin_tenant apenas no proprio
DROP POLICY IF EXISTS "tu_insert_auth" ON tenant_usuarios;
DROP POLICY IF EXISTS "tu_insert_admin" ON tenant_usuarios;
CREATE POLICY "tu_insert_admin" ON tenant_usuarios FOR INSERT TO authenticated
  WITH CHECK (
    user_is_super_admin()
    OR (
      user_tenant_role(tenant_id) = 'admin_tenant'
      AND papel != 'super_admin'
    )
  );

-- UPDATE: super_admin pode alterar qualquer; admin_tenant apenas no proprio (exceto super_admin)
DROP POLICY IF EXISTS "tu_update_auth" ON tenant_usuarios;
DROP POLICY IF EXISTS "tu_update_admin" ON tenant_usuarios;
CREATE POLICY "tu_update_admin" ON tenant_usuarios FOR UPDATE TO authenticated
  USING (
    user_is_super_admin()
    OR (
      user_tenant_role(tenant_id) = 'admin_tenant'
      AND papel != 'super_admin'
    )
  );

-- DELETE: super_admin; admin_tenant apenas usuarios nao-super_admin do proprio tenant
DROP POLICY IF EXISTS "tu_delete_admin" ON tenant_usuarios;
CREATE POLICY "tu_delete_admin" ON tenant_usuarios FOR DELETE TO authenticated
  USING (
    user_is_super_admin()
    OR (
      user_tenant_role(tenant_id) = 'admin_tenant'
      AND papel != 'super_admin'
    )
  );

-- ============================================================
-- SECAO 5: SEED SUPER_ADMIN PARA TENANT PADRAO
-- (apenas se nao existir — depende de auth.uid() que requer login via Supabase Auth)
-- ============================================================
-- NOTA: O vinculo super_admin deve ser criado manualmente apos configurar
-- Supabase Auth, via SQL console:
-- INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
-- VALUES ('00000000-0000-0000-0000-000000000001', '<auth_uid_do_admin>', 'super_admin', 'ativo')
-- ON CONFLICT (tenant_id, user_id) DO NOTHING;
