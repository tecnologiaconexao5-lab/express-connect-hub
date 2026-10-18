-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 20
-- Multi-Tenant Fase 6: Auth Real — Helper para lookup de users
-- RPC segura para admin buscar user_id por email em auth.users
-- Data: 2026-06-26
-- ============================================================

-- ============================================================
-- Funcao buscar_usuario_por_email
-- Uso: SELECT * FROM buscar_usuario_por_email('usuario@email.com')
-- Retorna: id (UUID), email (TEXT) se encontrado
-- Seguranca: apenas super_admin pode chamar
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_usuario_por_email(p_email TEXT)
RETURNS TABLE (id UUID, email TEXT) AS $$
BEGIN
    -- Verificar se o usuario que chamou e super_admin
    IF NOT EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE user_id = auth.uid()
          AND papel = 'super_admin'
          AND status = 'ativo'
    ) THEN
        RAISE EXCEPTION 'Apenas super_admin pode buscar usuarios';
    END IF;

    -- Buscar na view de auth.users (disponivel em Supabase via auth schema)
    RETURN QUERY
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE au.email = p_email
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'auth, public';

-- ============================================================
-- Funcao listar_usuarios_tenant
-- Lista usuarios de um tenant com email (via join auth.users)
-- Acesso: super_admin ou admin_tenant do proprio tenant
-- ============================================================
CREATE OR REPLACE FUNCTION listar_usuarios_tenant(p_tenant_id UUID)
RETURNS TABLE (
    vinculo_id UUID,
    user_id UUID,
    email TEXT,
    papel TEXT,
    status TEXT
) AS $$
BEGIN
    -- Verificar permissao
    IF NOT (
        EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid() AND papel = 'super_admin' AND status = 'ativo')
        OR EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND papel = 'admin_tenant' AND status = 'ativo')
    ) THEN
        RAISE EXCEPTION 'Sem permissao para listar usuarios deste tenant';
    END IF;

    RETURN QUERY
    SELECT tu.id, tu.user_id, au.email::TEXT, tu.papel, tu.status
    FROM tenant_usuarios tu
    LEFT JOIN auth.users au ON au.id = tu.user_id
    WHERE tu.tenant_id = p_tenant_id
    ORDER BY tu.criado_em DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'auth, public';
