-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 22
-- Correcoes P1 Pre-Venda: Convite de Usuarios
-- Cria tabela de convites com token seguro e validade
-- Data: 2026-07-28
-- ============================================================

-- ============================================================
-- SECAO 1: TABELA convites
-- ============================================================
CREATE TABLE IF NOT EXISTS convites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'operacional' CHECK (papel IN (
        'super_admin','admin_tenant','gestor','operacional','financeiro','comercial','cliente','prestador','motorista'
    )),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    criado_por UUID NOT NULL,
    usado BOOLEAN DEFAULT false,
    expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_convites_token ON convites(token);
CREATE INDEX IF NOT EXISTS idx_convites_email ON convites(email);
CREATE INDEX IF NOT EXISTS idx_convites_tenant ON convites(tenant_id);

ALTER TABLE convites ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated pode ler seus proprios convites por email
CREATE POLICY "convites_select_self" ON convites
    FOR SELECT TO anon, authenticated
    USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR email = 'anonymous');

-- INSERT: apenas super_admin ou admin_tenant
CREATE POLICY "convites_insert_admin" ON convites
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenant_usuarios
            WHERE user_id = auth.uid()
              AND tenant_id = convites.tenant_id
              AND papel IN ('super_admin', 'admin_tenant')
              AND status = 'ativo'
        )
    );

-- UPDATE (consumir convite): qualquer usuario autenticado pode marcar como usado
CREATE POLICY "convites_update_consume" ON convites
    FOR UPDATE TO authenticated
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    WITH CHECK (usado = true);

-- ============================================================
-- SECAO 2: FUNCAO consumir_convite
-- Segura: verifica token + email + validade
-- ============================================================
CREATE OR REPLACE FUNCTION consumir_convite(p_token TEXT)
RETURNS TABLE (
    convite_id UUID,
    tenant_id UUID,
    tenant_nome TEXT,
    papel TEXT,
    valido BOOLEAN,
    mensagem TEXT
) AS $$
DECLARE
    v_convite_record RECORD;
BEGIN
    -- Buscar convite
    SELECT * INTO v_convite_record
    FROM convites
    WHERE token = p_token
      AND usado = false
      AND expira_em > now();

    IF v_convite_record.id IS NULL THEN
        RETURN QUERY SELECT
            NULL::UUID,
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            false,
            'Convite invalido, ja usado ou expirado';
        RETURN;
    END IF;

    -- Verificar se o email do usuario logado bate
    IF v_convite_record.email != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
        RETURN QUERY SELECT
            v_convite_record.id,
            v_convite_record.tenant_id,
            (SELECT nome FROM tenants WHERE id = v_convite_record.tenant_id),
            v_convite_record.papel,
            false,
            'Este convite e para outro email';
        RETURN;
    END IF;

    -- Verificar se ja existe vinculo
    IF EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE tenant_id = v_convite_record.tenant_id
          AND user_id = auth.uid()
    ) THEN
        -- Ja vinculado: apenas marcar convite como usado
        UPDATE convites SET usado = true, atualizado_em = now()
        WHERE id = v_convite_record.id;

        RETURN QUERY SELECT
            v_convite_record.id,
            v_convite_record.tenant_id,
            (SELECT nome FROM tenants WHERE id = v_convite_record.tenant_id),
            v_convite_record.papel,
            true,
            'Usuario ja vinculado ao tenant. Convite consumido.';
        RETURN;
    END IF;

    -- Criar vinculo
    INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
    VALUES (v_convite_record.tenant_id, auth.uid(), v_convite_record.papel, 'ativo');

    -- Marcar convite como usado
    UPDATE convites SET usado = true, atualizado_em = now()
    WHERE id = v_convite_record.id;

    RETURN QUERY SELECT
        v_convite_record.id,
        v_convite_record.tenant_id,
        (SELECT nome FROM tenants WHERE id = v_convite_record.tenant_id),
        v_convite_record.papel,
        true,
        'Convite consumido com sucesso. Vinculo criado.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public, auth';

-- ============================================================
-- FIM MIGRATION
-- ============================================================
