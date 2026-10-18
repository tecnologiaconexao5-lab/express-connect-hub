-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 50.2
-- Hotfix Idempotente para missao50_auth_real
-- Data: 2026-07-28
-- ============================================================
-- Esta migration e um SAFENET para garantir que o que a
-- missao50_auth_real.sql deveria criar foi criado, mesmo
-- se ela foi aplicada parcialmente.
--
-- Aplicar APOS:
--   1. 20260728000051_missao50_fundacao_auth_tenant.sql
--   2. 20260728000050_missao50_auth_real.sql
--
-- Pode ser aplicada quantas vezes quiser (totalmente idempotente).
-- NAO faz DROP, TRUNCATE, DELETE, ou ALTER PUBLICATION.
-- ============================================================

-- ============================================================
-- 1. Garantir funcao update_tenants_updated_at (caso nao exista)
-- ============================================================
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. TABELA agentes_ia_internos (caso nao tenha sido criada)
-- ============================================================
CREATE TABLE IF NOT EXISTS agentes_ia_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  setor TEXT NOT NULL,
  funcao TEXT NOT NULL,
  email_institucional TEXT,
  assinatura_execucao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentes_ia_setor ON agentes_ia_internos(setor);
CREATE INDEX IF NOT EXISTS idx_agentes_ia_ativo ON agentes_ia_internos(ativo);
CREATE INDEX IF NOT EXISTS idx_agentes_ia_codigo ON agentes_ia_internos(codigo);

DROP TRIGGER IF EXISTS trg_agentes_ia_updated_at ON agentes_ia_internos;
CREATE TRIGGER trg_agentes_ia_updated_at
  BEFORE UPDATE ON agentes_ia_internos
  FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

ALTER TABLE agentes_ia_internos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentes_ia_select_anon ON agentes_ia_internos;
CREATE POLICY agentes_ia_select_anon ON agentes_ia_internos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS agentes_ia_admin_all ON agentes_ia_internos;
CREATE POLICY agentes_ia_admin_all ON agentes_ia_internos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. TABELA auth_eventos_auditoria (caso nao tenha sido criada)
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_eventos_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT,
  tipo_evento TEXT NOT NULL,
  perfil TEXT,
  ip_origem TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_eventos_user ON auth_eventos_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_email ON auth_eventos_auditoria(email);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_tipo ON auth_eventos_auditoria(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_criado ON auth_eventos_auditoria(criado_em DESC);

ALTER TABLE auth_eventos_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_eventos_select_auth ON auth_eventos_auditoria;
CREATE POLICY auth_eventos_select_auth ON auth_eventos_auditoria
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_eventos_insert_anon ON auth_eventos_auditoria;
CREATE POLICY auth_eventos_insert_anon ON auth_eventos_auditoria
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- 4. TABELA perfis_permissoes (caso nao tenha sido criada)
-- ============================================================
CREATE TABLE IF NOT EXISTS perfis_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  papel TEXT NOT NULL,
  modulo TEXT NOT NULL,
  pode_ver BOOLEAN DEFAULT false,
  pode_editar BOOLEAN DEFAULT false,
  pode_excluir BOOLEAN DEFAULT false,
  descricao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(papel, modulo)
);

CREATE INDEX IF NOT EXISTS idx_perfis_papel ON perfis_permissoes(papel);

ALTER TABLE perfis_permissoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perfis_select_all ON perfis_permissoes;
CREATE POLICY perfis_select_all ON perfis_permissoes
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 5. Colunas em automacoes_robos (caso nao existam)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'is_agente_interno'
  ) THEN
    ALTER TABLE public.automacoes_robos
      ADD COLUMN is_agente_interno BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'agente_interno_id'
  ) THEN
    ALTER TABLE public.automacoes_robos
      ADD COLUMN agente_interno_id UUID REFERENCES agentes_ia_internos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automacoes_robos_agente_interno
  ON public.automacoes_robos(is_agente_interno) WHERE is_agente_interno = true;

-- ============================================================
-- 6. Garantir que o CHECK de tenant_usuarios tem 'atendimento'
-- ============================================================
DO $$
DECLARE
    v_constraint_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO v_constraint_def
    FROM pg_constraint
    WHERE conname = 'tenant_usuarios_papel_check'
      AND conrelid = 'public.tenant_usuarios'::regclass;

    IF v_constraint_def IS NOT NULL AND v_constraint_def NOT LIKE '%atendimento%' THEN
        ALTER TABLE tenant_usuarios DROP CONSTRAINT tenant_usuarios_papel_check;
        ALTER TABLE tenant_usuarios
          ADD CONSTRAINT tenant_usuarios_papel_check
          CHECK (papel IN (
            'super_admin','admin_tenant','gestor','operacional','financeiro',
            'comercial','atendimento','cliente','prestador','motorista'
          ));
    END IF;
END $$;

-- ============================================================
-- 7. Tenant padrao (idempotente)
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

-- ============================================================
-- 8. SEED: 5 agentes IA (idempotente via ON CONFLICT)
-- ============================================================
INSERT INTO agentes_ia_internos (codigo, nome, descricao, setor, funcao, email_institucional, assinatura_execucao, ativo) VALUES
  ('ia_financeira', 'IA Financeira',
   'Calculo de margens, alertas de inadimplencia, conciliacao bancaria automatica e geracao de relatorios',
   'financeiro', 'auditoria_calculos',
   'ia.financeira@conexaoexpress.com.br',
   'IA-FINANCEIRA', true),
  ('ia_operacional', 'IA Operacional',
   'Monitoramento de OS, otimizacao de rotas, gestao de escalas e alertas operacionais',
   'operacional', 'monitoramento_execucao',
   'ia.operacional@conexaoexpress.com.br',
   'IA-OPERACIONAL', true),
  ('ia_comercial', 'IA Comercial',
   'Qualificacao de leads, follow-up automatico, geracao de propostas e analise de CRM',
   'comercial', 'analise_prospecção',
   'ia.comercial@conexaoexpress.com.br',
   'IA-COMERCIAL', true),
  ('ia_auditoria', 'IA Auditoria',
   'Auditoria continua de logs, deteccao de anomalias, validacao de concistencia e compliance',
   'ti', 'auditoria_logs',
   'ia.auditoria@conexaoexpress.com.br',
   'IA-AUDITORIA', true),
  ('ia_atendimento', 'IA Atendimento',
   'Triagem inicial, respostas automaticas, rastreamento de ocorrencias e suporte de primeiro nivel',
   'atendimento', 'triagem_suporte',
   'ia.atendimento@conexaoexpress.com.br',
   'IA-ATENDIMENTO', true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  setor = EXCLUDED.setor,
  funcao = EXCLUDED.funcao,
  email_institucional = EXCLUDED.email_institucional,
  assinatura_execucao = EXCLUDED.assinatura_execucao,
  ativo = EXCLUDED.ativo;

-- ============================================================
-- 9. SEED: 75 permissoes por papel (idempotente via ON CONFLICT)
-- ============================================================
INSERT INTO perfis_permissoes (papel, modulo, pode_ver, pode_editar, pode_excluir, descricao) VALUES
  -- SUPER_ADMIN
  ('super_admin', 'dashboard', true, true, true, 'Acesso total'),
  ('super_admin', 'clientes', true, true, true, 'Acesso total'),
  ('super_admin', 'prestadores', true, true, true, 'Acesso total'),
  ('super_admin', 'ordens_servico', true, true, true, 'Acesso total'),
  ('super_admin', 'financeiro', true, true, true, 'Acesso total'),
  ('super_admin', 'frota', true, true, true, 'Acesso total'),
  ('super_admin', 'cadastros_auxiliares', true, true, true, 'Acesso total'),
  ('super_admin', 'relatorios', true, true, true, 'Acesso total'),
  ('super_admin', 'configuracoes', true, true, true, 'Acesso total'),
  ('super_admin', 'admin_tenants', true, true, true, 'Acesso total'),
  -- ADMIN_TENANT
  ('admin_tenant', 'dashboard', true, true, true, 'Acesso total'),
  ('admin_tenant', 'clientes', true, true, true, 'Acesso total'),
  ('admin_tenant', 'prestadores', true, true, true, 'Acesso total'),
  ('admin_tenant', 'ordens_servico', true, true, true, 'Acesso total'),
  ('admin_tenant', 'financeiro', true, true, true, 'Acesso total'),
  ('admin_tenant', 'frota', true, true, true, 'Acesso total'),
  ('admin_tenant', 'cadastros_auxiliares', true, true, true, 'Acesso total'),
  ('admin_tenant', 'relatorios', true, true, true, 'Acesso total'),
  ('admin_tenant', 'configuracoes', true, true, true, 'Acesso total'),
  ('admin_tenant', 'admin_tenants', false, false, false, 'Bloqueado'),
  -- FINANCEIRO
  ('financeiro', 'dashboard', true, false, false, 'Visao geral'),
  ('financeiro', 'clientes', true, false, false, 'Consulta'),
  ('financeiro', 'prestadores', true, false, false, 'Consulta'),
  ('financeiro', 'ordens_servico', true, false, false, 'Consulta'),
  ('financeiro', 'financeiro', true, true, true, 'Acesso completo'),
  ('financeiro', 'frota', false, false, false, 'Sem acesso'),
  ('financeiro', 'cadastros_auxiliares', false, false, false, 'Sem acesso'),
  ('financeiro', 'relatorios', true, true, false, 'Relatorios editaveis'),
  ('financeiro', 'configuracoes', false, false, false, 'Sem acesso'),
  -- COMERCIAL
  ('comercial', 'dashboard', true, false, false, 'Visao geral'),
  ('comercial', 'clientes', true, true, false, 'Gestao clientes/propostas'),
  ('comercial', 'prestadores', true, false, false, 'Consulta'),
  ('comercial', 'ordens_servico', true, false, false, 'Consulta OS'),
  ('comercial', 'financeiro', true, false, false, 'Consulta (sem edicao)'),
  ('comercial', 'frota', false, false, false, 'Sem acesso'),
  ('comercial', 'cadastros_auxiliares', true, false, false, 'Consulta'),
  ('comercial', 'relatorios', true, false, false, 'Consulta relatorios'),
  ('comercial', 'configuracoes', false, false, false, 'Sem acesso'),
  -- OPERACIONAL
  ('operacional', 'dashboard', true, true, false, 'Visao geral editavel'),
  ('operacional', 'clientes', true, true, false, 'Edicao clientes'),
  ('operacional', 'prestadores', true, true, false, 'Gestao prestadores'),
  ('operacional', 'ordens_servico', true, true, false, 'Gestao OS, escalas, ocorrencias'),
  ('operacional', 'financeiro', true, false, false, 'Consulta (sem edicao)'),
  ('operacional', 'frota', true, true, false, 'Gestao frota/veiculos'),
  ('operacional', 'cadastros_auxiliares', true, false, false, 'Consulta'),
  ('operacional', 'relatorios', true, false, false, 'Consulta'),
  ('operacional', 'configuracoes', false, false, false, 'Sem acesso'),
  -- ATENDIMENTO
  ('atendimento', 'dashboard', true, false, false, 'Visao geral somente leitura'),
  ('atendimento', 'clientes', true, false, false, 'Consulta clientes'),
  ('atendimento', 'prestadores', true, false, false, 'Consulta prestadores'),
  ('atendimento', 'ordens_servico', true, false, false, 'Consulta OS, ocorrencias, tracking'),
  ('atendimento', 'financeiro', false, false, false, 'SEM ACESSO FINANCEIRO SENSIVEL'),
  ('atendimento', 'frota', true, false, false, 'Consulta veiculos'),
  ('atendimento', 'cadastros_auxiliares', false, false, false, 'Sem acesso'),
  ('atendimento', 'relatorios', false, false, false, 'Sem acesso'),
  ('atendimento', 'configuracoes', false, false, false, 'Sem acesso'),
  ('atendimento', 'admin_tenants', false, false, false, 'Sem acesso'),
  -- CLIENTE
  ('cliente', 'dashboard', true, false, false, 'Portal cliente'),
  ('cliente', 'ordens_servico', true, false, false, 'Consulta OS'),
  ('cliente', 'financeiro', true, false, false, 'Consulta financas'),
  ('cliente', 'clientes', false, false, false, 'Sem acesso'),
  ('cliente', 'prestadores', false, false, false, 'Sem acesso'),
  ('cliente', 'frota', false, false, false, 'Sem acesso'),
  ('cliente', 'cadastros_auxiliares', false, false, false, 'Sem acesso'),
  ('cliente', 'relatorios', false, false, false, 'Sem acesso'),
  ('cliente', 'configuracoes', false, false, false, 'Sem acesso'),
  -- PRESTADOR
  ('prestador', 'dashboard', true, false, false, 'App prestador'),
  ('prestador', 'ordens_servico', true, false, false, 'Consulta alocacoes'),
  ('prestador', 'financeiro', true, false, false, 'Consulta pagamentos'),
  ('prestador', 'clientes', false, false, false, 'Sem acesso'),
  ('prestador', 'prestadores', false, false, false, 'Sem acesso'),
  ('prestador', 'frota', false, false, false, 'Sem acesso'),
  ('prestador', 'cadastros_auxiliares', false, false, false, 'Sem acesso'),
  ('prestador', 'relatorios', false, false, false, 'Sem acesso'),
  ('prestador', 'configuracoes', false, false, false, 'Sem acesso')
ON CONFLICT (papel, modulo) DO UPDATE SET
  pode_ver = EXCLUDED.pode_ver,
  pode_editar = EXCLUDED.pode_editar,
  pode_excluir = EXCLUDED.pode_excluir,
  descricao = EXCLUDED.descricao;

-- ============================================================
-- 10. Comentarios (idempotente)
-- ============================================================
COMMENT ON TABLE agentes_ia_internos IS
  'Funcionarios IA internos. NAO fazem login. Apenas assinam execucoes em logs.';

COMMENT ON TABLE auth_eventos_auditoria IS
  'Auditoria de eventos de autenticacao: login, logout, reset, falhas, acessos negados.';

COMMENT ON TABLE perfis_permissoes IS
  'Matriz de permissoes por papel (papel x modulo). Espelho do permissoes.ts no front.';
