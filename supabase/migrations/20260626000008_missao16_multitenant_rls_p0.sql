-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 16
-- Multi-Tenant Fase 2: RLS Seguro P0 (7 tabelas core)
-- Data: 2026-06-26
-- 
-- ESTRATEGIA: Politicas "soft" — usam tenant_id quando auth.uid()
-- esta disponivel, mantem comportamento atual quando nao esta.
-- Isolamento total requer Supabase Auth + TenantProvider no frontend.
-- ============================================================

-- ============================================================
-- SECAO 1: FUNCAO SEGURA DE RESOLUCAO DE TENANT
-- ============================================================

CREATE OR REPLACE FUNCTION current_tenant_id_safe()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Tenta current_setting (definido pelo frontend via TenantProvider)
    v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::UUID;
    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;

    -- 2. Se nao tem current_setting, tenta auth.uid()
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        -- Sem auth: retorna tenant padrao (backward compatibility)
        RETURN '00000000-0000-0000-0000-000000000001';
    END IF;

    -- 3. Usuario autenticado: busca seu tenant unico
    SELECT tenant_id INTO v_tenant_id
    FROM tenant_usuarios
    WHERE user_id = v_user_id AND status = 'ativo'
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;

    -- 4. Fallback: tenant padrao
    RETURN '00000000-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ============================================================
-- SECAO 2: POLITICAS RLS P0 — clientes
-- ============================================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select_anon" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_auth" ON clientes;
DROP POLICY IF EXISTS "clientes_update_auth" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_auth" ON clientes;

-- SELECT: tenant atual (com fallback para tenant padrao)
CREATE POLICY "clientes_select_tenant" ON clientes
    FOR SELECT TO anon, authenticated
    USING (tenant_id = current_tenant_id_safe());

-- INSERT: authenticated + tenant atual
CREATE POLICY "clientes_insert_tenant" ON clientes
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = current_tenant_id_safe());

-- UPDATE: authenticated + tenant atual
CREATE POLICY "clientes_update_tenant" ON clientes
    FOR UPDATE TO authenticated
    USING (tenant_id = current_tenant_id_safe());

-- DELETE: authenticated + tenant atual
CREATE POLICY "clientes_delete_tenant" ON clientes
    FOR DELETE TO authenticated
    USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 3: POLITICAS RLS P0 — prestadores
-- ============================================================

ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prestadores_select_anon" ON prestadores;
DROP POLICY IF EXISTS "prestadores_insert_auth" ON prestadores;
DROP POLICY IF EXISTS "prestadores_update_auth" ON prestadores;
DROP POLICY IF EXISTS "prestadores_delete_auth" ON prestadores;

CREATE POLICY "prestadores_select_tenant" ON prestadores FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "prestadores_insert_tenant" ON prestadores FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "prestadores_update_tenant" ON prestadores FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "prestadores_delete_tenant" ON prestadores FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 4: POLITICAS RLS P0 — veiculos
-- ============================================================

ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "veiculos_select_anon" ON veiculos;
DROP POLICY IF EXISTS "veiculos_insert_auth" ON veiculos;
DROP POLICY IF EXISTS "veiculos_update_auth" ON veiculos;
DROP POLICY IF EXISTS "veiculos_delete_auth" ON veiculos;

CREATE POLICY "veiculos_select_tenant" ON veiculos FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "veiculos_insert_tenant" ON veiculos FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "veiculos_update_tenant" ON veiculos FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "veiculos_delete_tenant" ON veiculos FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 5: POLITICAS RLS P0 — ordens_servico
-- ============================================================

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "os_select_anon" ON ordens_servico;
DROP POLICY IF EXISTS "os_insert_auth" ON ordens_servico;
DROP POLICY IF EXISTS "os_update_auth" ON ordens_servico;
DROP POLICY IF EXISTS "os_delete_auth" ON ordens_servico;

CREATE POLICY "os_select_tenant" ON ordens_servico FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "os_insert_tenant" ON ordens_servico FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "os_update_tenant" ON ordens_servico FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "os_delete_tenant" ON ordens_servico FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 6: POLITICAS RLS P0 — financeiro_receber
-- ============================================================

ALTER TABLE financeiro_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fr_select_anon" ON financeiro_receber;
DROP POLICY IF EXISTS "fr_insert_auth" ON financeiro_receber;
DROP POLICY IF EXISTS "fr_update_auth" ON financeiro_receber;
DROP POLICY IF EXISTS "fr_delete_auth" ON financeiro_receber;

CREATE POLICY "fr_select_tenant" ON financeiro_receber FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fr_insert_tenant" ON financeiro_receber FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "fr_update_tenant" ON financeiro_receber FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fr_delete_tenant" ON financeiro_receber FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 7: POLITICAS RLS P0 — financeiro_pagar
-- ============================================================

ALTER TABLE financeiro_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fp_select_anon" ON financeiro_pagar;
DROP POLICY IF EXISTS "fp_insert_auth" ON financeiro_pagar;
DROP POLICY IF EXISTS "fp_update_auth" ON financeiro_pagar;
DROP POLICY IF EXISTS "fp_delete_auth" ON financeiro_pagar;

CREATE POLICY "fp_select_tenant" ON financeiro_pagar FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fp_insert_tenant" ON financeiro_pagar FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "fp_update_tenant" ON financeiro_pagar FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fp_delete_tenant" ON financeiro_pagar FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 8: POLITICAS RLS P0 — pagamentos_prestadores
-- ============================================================

ALTER TABLE pagamentos_prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select_anon" ON pagamentos_prestadores;
DROP POLICY IF EXISTS "pp_insert_auth" ON pagamentos_prestadores;
DROP POLICY IF EXISTS "pp_update_auth" ON pagamentos_prestadores;
DROP POLICY IF EXISTS "pp_delete_auth" ON pagamentos_prestadores;

CREATE POLICY "pp_select_tenant" ON pagamentos_prestadores FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "pp_insert_tenant" ON pagamentos_prestadores FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "pp_update_tenant" ON pagamentos_prestadores FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "pp_delete_tenant" ON pagamentos_prestadores FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 9: VINCULAR USUARIO ADMIN AO TENANT PADRAO
-- ============================================================

-- Script manual (executar com auth.uid() do admin apos login):
-- INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
-- VALUES ('00000000-0000-0000-0000-000000000001', auth.uid(), 'admin_tenant', 'ativo')
-- ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ============================================================
-- FIM MIGRATION MISSAO 16
-- ============================================================
