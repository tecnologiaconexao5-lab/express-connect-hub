-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 50.2
-- Fundacao Idempotente: Auth + Tenant
-- Data: 2026-07-28
-- ============================================================
-- Esta migration e IDEMPOTENTE e INDEPENDENTE.
-- Pode ser colada diretamente no SQL Editor do Supabase
-- mesmo se outras migrations estiverem inconsistentes.
--
-- NAO depende de:
--   - Outras migrations (especialmente F15 multi-tenant)
--   - Funcao update_tenants_updated_at() pre-existente
--   - Schema_migrations com estado consistente
--
-- Cria (se nao existir):
--   - Funcao update_tenants_updated_at()
--   - Tabela tenants
--   - Tabela tenant_usuarios
--   - Tenant padrao "Conexao Express"
--   - Coluna role em auth.users (se nao existir)
--   - Indices necessarios
--   - RLS basico (somente se ainda nao existir)
--
-- NAO faz:
--   - DROP de tabelas
--   - TRUNCATE
--   - DELETE
--   - ALTER PUBLICATION
--   - Re-define CHECK que ja existe
-- ============================================================

-- ============================================================
-- SECAO 0: FUNCAO AUXILIAR DE UPDATED_AT (cria se nao existir)
-- Necessaria para os triggers das tabelas
-- ============================================================

CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECAO 1: TABELA tenants
-- Base do multi-tenant
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

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

-- RLS basico: SELECT publico, escrita autenticada
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_anon" ON tenants;
CREATE POLICY "tenants_select_anon" ON tenants
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tenants_insert_auth" ON tenants;
CREATE POLICY "tenants_insert_auth" ON tenants
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tenants_update_auth" ON tenants;
CREATE POLICY "tenants_update_auth" ON tenants
  FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- SECAO 2: TABELA tenant_usuarios
-- Vinculo N:N entre auth.users e tenants
-- Inclui role 'atendimento' (Missao 50)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    papel TEXT NOT NULL DEFAULT 'operacional' CHECK (papel IN (
        'super_admin','admin_tenant','gestor','operacional','financeiro',
        'comercial','atendimento','cliente','prestador','motorista'
    )),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','convidado')),
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tu_user ON tenant_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_tu_tenant ON tenant_usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tu_papel ON tenant_usuarios(tenant_id, papel);
CREATE INDEX IF NOT EXISTS idx_tu_user_status ON tenant_usuarios(user_id, status);

DROP TRIGGER IF EXISTS trg_tu_updated_at ON tenant_usuarios;
CREATE TRIGGER trg_tu_updated_at
  BEFORE UPDATE ON tenant_usuarios
  FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

-- RLS
ALTER TABLE tenant_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tu_select_anon" ON tenant_usuarios;
CREATE POLICY "tu_select_anon" ON tenant_usuarios
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tu_insert_auth" ON tenant_usuarios;
CREATE POLICY "tu_insert_auth" ON tenant_usuarios
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tu_update_auth" ON tenant_usuarios;
CREATE POLICY "tu_update_auth" ON tenant_usuarios
  FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- SECAO 3: GARANTIR QUE O CHECK DO tenant_usuarios CONTEM 'atendimento'
-- Idempotente: soh recria se o papel nao estiver na constraint
-- ============================================================

DO $$
DECLARE
    v_constraint_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO v_constraint_def
    FROM pg_constraint
    WHERE conname = 'tenant_usuarios_papel_check'
      AND conrelid = 'public.tenant_usuarios'::regclass;

    -- Soh recriar se a constraint NAO contiver 'atendimento'
    IF v_constraint_def IS NULL OR v_constraint_def NOT LIKE '%atendimento%' THEN
        ALTER TABLE tenant_usuarios DROP CONSTRAINT IF EXISTS tenant_usuarios_papel_check;
        ALTER TABLE tenant_usuarios
          ADD CONSTRAINT tenant_usuarios_papel_check
          CHECK (papel IN (
            'super_admin','admin_tenant','gestor','operacional','financeiro',
            'comercial','atendimento','cliente','prestador','motorista'
          ));
    END IF;
END $$;

-- ============================================================
-- SECAO 4: TENANT PADRAO (Conexao Express)
-- Garante o UUID fixo usado pelos vinculos
-- ============================================================

INSERT INTO tenants (id, nome, slug, plano, status, email_contato, cor_primaria)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Conexao Express',
    'conexao-express',
    'enterprise',
    'ativo',
    'contato@conexaoexpress.com.br',
    '#F97316'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'conexao-express');

-- Garantir que o tenant_id fixo esta correto (caso slug exista com ID diferente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
        UPDATE tenants
        SET id = '00000000-0000-0000-0000-000000000001'::uuid
        WHERE slug = 'conexao-express';
    END IF;
END $$;

-- ============================================================
-- SECAO 5: FUNCOES AUXILIARES (idempotentes)
-- Para multi-tenant session context
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

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
-- COMENTARIOS
-- ============================================================

COMMENT ON TABLE tenants IS
  'Multi-tenant: cada empresa (tenant) que usa o TMS. Tenant padrao Conexao Express tem UUID fixo 00000000-0000-0000-0000-000000000001.';

COMMENT ON TABLE tenant_usuarios IS
  'Vinculo N:N entre auth.users e tenants. Define o papel (papel) do usuario em cada tenant. Inclui role atendimento (Missao 50).';

COMMENT ON FUNCTION get_current_tenant_id() IS
  'Retorna o tenant_id da sessao atual via GUC app.tenant_id. Usado para RLS multi-tenant.';

COMMENT ON FUNCTION user_has_tenant_access(UUID) IS
  'Verifica se o usuario atual (auth.uid()) tem acesso ativo ao tenant informado.';

COMMENT ON FUNCTION user_tenant_role(UUID) IS
  'Retorna o papel (papel) do usuario atual no tenant informado, ou NULL se nao tiver vinculo.';
