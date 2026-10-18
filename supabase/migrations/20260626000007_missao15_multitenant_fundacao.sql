-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 15
-- Multi-Tenant Fase 1: Fundacao do Banco
-- Data: 2026-06-26
-- ============================================================

-- ============================================================
-- SECAO 1: TABELA tenants
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    documento TEXT,
    plano TEXT DEFAULT 'starter' CHECK (plano IN ('starter','professional','enterprise')),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','suspenso','trial')),
    email_contato TEXT,
    telefone_contato TEXT,
    logo_url TEXT,
    cor_primaria TEXT DEFAULT '#F97316',
    dominio_customizado TEXT,
    config JSONB DEFAULT '{}',
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

-- RLS basico (SELECT publico por enquanto, escrita authenticated)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_select_anon" ON tenants FOR SELECT TO anon USING (true);
CREATE POLICY "tenants_insert_auth" ON tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tenants_update_auth" ON tenants FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- SECAO 2: TABELA tenant_usuarios (N:N users x tenants)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    papel TEXT NOT NULL DEFAULT 'operacional' CHECK (papel IN (
        'super_admin','admin_tenant','gestor','operacional','financeiro','comercial','cliente','prestador','motorista'
    )),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','convidado')),
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tu_user ON tenant_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_tu_tenant ON tenant_usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tu_papel ON tenant_usuarios(tenant_id, papel);

DROP TRIGGER IF EXISTS trg_tu_updated_at ON tenant_usuarios;
CREATE TRIGGER trg_tu_updated_at BEFORE UPDATE ON tenant_usuarios FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

ALTER TABLE tenant_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tu_select_anon" ON tenant_usuarios FOR SELECT TO anon USING (true);
CREATE POLICY "tu_insert_auth" ON tenant_usuarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tu_update_auth" ON tenant_usuarios FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- SECAO 3: FUNCOES AUXILIARES
-- ============================================================

-- Retorna o tenant_id atual (via parametro de sessao)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- Verifica se usuario tem acesso a um tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE tenant_id = p_tenant_id
          AND user_id = auth.uid()
          AND status = 'ativo'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Retorna o papel do usuario no tenant atual
CREATE OR REPLACE FUNCTION user_tenant_role(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_papel TEXT;
BEGIN
    SELECT papel INTO v_papel FROM tenant_usuarios
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND status = 'ativo';
    RETURN v_papel;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ============================================================
-- SECAO 4: TENANT PADRAO (para dados existentes)
-- ============================================================

-- Inserir tenant padrao apenas se nao existir
INSERT INTO tenants (id, nome, slug, plano, status, email_contato, cor_primaria)
SELECT
    '00000000-0000-0000-0000-000000000001',
    'Conexao Express',
    'conexao-express',
    'enterprise',
    'ativo',
    'contato@conexaoexpress.com.br',
    '#F97316'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'conexao-express');

-- ============================================================
-- SECAO 5: ADICIONAR tenant_id EM 7 TABELAS P0 (NULL primeiro)
-- ============================================================

DO $$
DECLARE
    tbl TEXT;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'clientes','prestadores','veiculos',
            'ordens_servico',
            'financeiro_receber','financeiro_pagar',
            'pagamentos_prestadores'
        ])
    LOOP
        -- Adicionar coluna se nao existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tbl AND column_name = 'tenant_id') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id)', tbl);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON %I(tenant_id)', tbl, tbl);
        END IF;

        -- Popular com tenant padrao (apenas registros sem tenant)
        EXECUTE format('UPDATE %I SET tenant_id = %L WHERE tenant_id IS NULL', tbl, v_tenant_id);
    END LOOP;
END $$;

-- ============================================================
-- SECAO 6: ADICIONAR tenant_id EM TABELAS P1 (suporte)
-- ============================================================

DO $$
DECLARE
    tbl TEXT;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'alocacoes_escala','composicao_financeira_os','orcamentos',
            'crm_leads','crm_historico','crm_followups',
            'portal_pedidos','portal_ocorrencias','portal_faturas',
            'contratos_gerados','fiscal_ctes','fiscal_nfse','fiscal_mdfes',
            'despesas_operacionais','financeiro_baixas','auditoria_operacional',
            'historico_alocacoes_escala','portal_notificacoes'
        ])
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tbl AND column_name = 'tenant_id') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id)', tbl);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON %I(tenant_id)', tbl, tbl);
        END IF;
        EXECUTE format('UPDATE %I SET tenant_id = %L WHERE tenant_id IS NULL', tbl, v_tenant_id);
    END LOOP;
END $$;

-- ============================================================
-- SECAO 7: VIEW — usuarios do tenant atual
-- ============================================================

CREATE OR REPLACE VIEW vw_tenant_usuarios AS
SELECT tu.*, t.nome AS tenant_nome, t.slug AS tenant_slug
FROM tenant_usuarios tu
JOIN tenants t ON t.id = tu.tenant_id;

-- ============================================================
-- FIM MIGRATION MISSAO 15
-- ============================================================
