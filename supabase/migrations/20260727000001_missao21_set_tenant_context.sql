-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 21
-- GO LIVE Multi-Tenant: Fix P0 — TenantContext RPC
-- Cria RPC para frontend definir app.tenant_id via set_config
-- Permite que RLS current_tenant_id_safe() funcione corretamente
-- quando usuario alterna entre multiplos tenants.
-- Data: 2026-07-27
-- ============================================================

-- ============================================================
-- SECAO 1: RPC set_tenant_context
-- Chamado pelo TenantProvider apos selecionar tenant
-- Uso: SELECT set_tenant_context('uuid-do-tenant')
-- ============================================================
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- Validar que o usuario tem acesso a este tenant
    IF NOT EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE tenant_id = p_tenant_id
          AND user_id = auth.uid()
          AND status = 'ativo'
    ) THEN
        RAISE EXCEPTION 'Acesso negado a este tenant';
    END IF;

    -- Definir a configuracao de sessao
    PERFORM set_config('app.tenant_id', p_tenant_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================================
-- FIM MIGRATION
-- ============================================================
