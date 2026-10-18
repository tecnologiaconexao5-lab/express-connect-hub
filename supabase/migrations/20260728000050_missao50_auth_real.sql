-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 50
-- Autenticacao Real com Usuarios Corporativos Existentes
-- Data: 2026-07-28
-- ============================================================
-- Esta migration:
-- 1. Adiciona role 'atendimento' ao CHECK de tenant_usuarios.papel
-- 2. Cria tabela agentes_ia_internos para os funcionarios IA
-- 3. Adiciona coluna is_agente_interno em automacoes_robos
-- 4. Cria tabela auth_eventos_auditoria para logs de login/logout
-- 5. Define perfis de permissao por papel
-- ============================================================

-- ============================================================
-- SECAO 1: ATUALIZAR CHECK DE tenant_usuarios.papel
-- Adiciona 'atendimento' para o perfil de Atendimento/Suporte
-- ============================================================

ALTER TABLE tenant_usuarios DROP CONSTRAINT IF EXISTS tenant_usuarios_papel_check;
ALTER TABLE tenant_usuarios
  ADD CONSTRAINT tenant_usuarios_papel_check
  CHECK (papel IN (
    'super_admin','admin_tenant','gestor','operacional','financeiro',
    'comercial','atendimento','cliente','prestador','motorista'
  ));

-- ============================================================
-- SECAO 2: TABELA DE AGENTES IA INTERNOS
-- Funcionarios digitais que NAO fazem login (sem auth.user)
-- Apenas assinatura de auditoria em logs/transacoes
-- ============================================================

CREATE TABLE IF NOT EXISTS agentes_ia_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,            -- ex: 'ia_financeira'
  nome TEXT NOT NULL,                     -- ex: 'IA Financeira'
  descricao TEXT,
  setor TEXT NOT NULL,                    -- financeiro, operacional, comercial, fiscal, atendimento
  funcao TEXT NOT NULL,                   -- papel funcional (auditoria, alertas, calculos, etc.)
  email_institucional TEXT,               -- exibido em logs (nao autenticavel)
  assinatura_execucao TEXT NOT NULL,      -- texto fixo para logs (ex: 'IA-FINANCEIRA')
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
-- SECAO 3: COLUNA is_agente_inerno em automacoes_robos
-- Para distinguir robos operacionais (F21) dos agentes
-- digitais internos que NAO logam como humanos
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
-- SECAO 4: AUDITORIA DE EVENTOS DE AUTENTICACAO
-- Logs centralizados de login, logout, recuperacao de senha,
-- tentativas falhas, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_eventos_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                            -- auth.users.id (pode ser null em falhas)
  email TEXT,                              -- email usado (mesmo em falhas)
  tipo_evento TEXT NOT NULL,               -- login_sucesso, login_falha, logout, reset_senha, sessao_expirada, acesso_negado
  perfil TEXT,                             -- papel (super_admin, financeiro, etc.) - null em falhas
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
-- SECAO 5: TABELA DE PERFIS DE PERMISSAO
-- Define quais modulos cada papel pode acessar
-- (espelho da permissoes.ts no front - permite auditoria no banco)
-- ============================================================

CREATE TABLE IF NOT EXISTS perfis_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  papel TEXT NOT NULL,                     -- super_admin, admin, financeiro, comercial, operacional, atendimento
  modulo TEXT NOT NULL,                    -- dashboard, clientes, financeiro, etc.
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

-- Seed: perfis de permissao por papel
INSERT INTO perfis_permissoes (papel, modulo, pode_ver, pode_editar, pode_excluir, descricao) VALUES
  -- SUPER_ADMIN: acesso total
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

  -- ADMIN_TENANT: acesso total exceto admin_tenants
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

  -- FINANCEIRO: financeiro completo, relatorios
  ('financeiro', 'dashboard', true, false, false, 'Visao geral'),
  ('financeiro', 'clientes', true, false, false, 'Consulta de clientes'),
  ('financeiro', 'prestadores', true, false, false, 'Consulta de prestadores'),
  ('financeiro', 'ordens_servico', true, false, false, 'Consulta de OS'),
  ('financeiro', 'financeiro', true, true, true, 'Acesso completo ao financeiro'),
  ('financeiro', 'frota', false, false, false, 'Sem acesso a frota'),
  ('financeiro', 'cadastros_auxiliares', false, false, false, 'Sem acesso a cadastros auxiliares'),
  ('financeiro', 'relatorios', true, true, false, 'Relatorios editaveis'),
  ('financeiro', 'configuracoes', false, false, false, 'Sem acesso a configuracoes'),

  -- COMERCIAL: clientes, propostas, contratos, CRM
  ('comercial', 'dashboard', true, false, false, 'Visao geral'),
  ('comercial', 'clientes', true, true, false, 'Gestao de clientes e propostas'),
  ('comercial', 'prestadores', true, false, false, 'Consulta de prestadores'),
  ('comercial', 'ordens_servico', true, false, false, 'Consulta de OS'),
  ('comercial', 'financeiro', true, false, false, 'Consulta financeira (sem edicao)'),
  ('comercial', 'frota', false, false, false, 'Sem acesso a frota'),
  ('comercial', 'cadastros_auxiliares', true, false, false, 'Consulta de cadastros auxiliares'),
  ('comercial', 'relatorios', true, false, false, 'Consulta de relatorios'),
  ('comercial', 'configuracoes', false, false, false, 'Sem acesso a configuracoes'),

  -- OPERACIONAL: OS, escalas, prestadores, veiculos, ocorrencias
  ('operacional', 'dashboard', true, true, false, 'Visao geral editavel'),
  ('operacional', 'clientes', true, true, false, 'Edicao de clientes'),
  ('operacional', 'prestadores', true, true, false, 'Gestao de prestadores'),
  ('operacional', 'ordens_servico', true, true, false, 'Gestao de OS, escalas, ocorrencias'),
  ('operacional', 'financeiro', true, false, false, 'Consulta financeira (sem edicao)'),
  ('operacional', 'frota', true, true, false, 'Gestao de frota e veiculos'),
  ('operacional', 'cadastros_auxiliares', true, false, false, 'Consulta de cadastros auxiliares'),
  ('operacional', 'relatorios', true, false, false, 'Consulta de relatorios'),
  ('operacional', 'configuracoes', false, false, false, 'Sem acesso a configuracoes'),

  -- ATENDIMENTO: consulta de operacoes, rastreamento, comunicacao, ocorrencias
  ('atendimento', 'dashboard', true, false, false, 'Visao geral somente leitura'),
  ('atendimento', 'clientes', true, false, false, 'Consulta de clientes'),
  ('atendimento', 'prestadores', true, false, false, 'Consulta de prestadores'),
  ('atendimento', 'ordens_servico', true, false, false, 'Consulta de OS, ocorrencias, tracking'),
  ('atendimento', 'financeiro', false, false, false, 'SEM ACESSO FINANCEIRO SENSIVEL'),
  ('atendimento', 'frota', true, false, false, 'Consulta de veiculos'),
  ('atendimento', 'cadastros_auxiliares', false, false, false, 'Sem acesso a cadastros auxiliares'),
  ('atendimento', 'relatorios', false, false, false, 'Sem acesso a relatorios'),
  ('atendimento', 'configuracoes', false, false, false, 'Sem acesso a configuracoes'),

  -- CLIENTE: portal do cliente
  ('cliente', 'dashboard', true, false, false, 'Portal do cliente'),
  ('cliente', 'ordens_servico', true, false, false, 'Consulta de OS do cliente'),
  ('cliente', 'financeiro', true, false, false, 'Consulta de financas do cliente'),
  ('cliente', 'clientes', false, false, false, 'Sem acesso a cadastro de clientes'),
  ('cliente', 'prestadores', false, false, false, 'Sem acesso a prestadores'),
  ('cliente', 'frota', false, false, false, 'Sem acesso a frota'),
  ('cliente', 'cadastros_auxiliares', false, false, false, 'Sem acesso a cadastros'),
  ('cliente', 'relatorios', false, false, false, 'Sem acesso a relatorios'),
  ('cliente', 'configuracoes', false, false, false, 'Sem acesso a configuracoes'),

  -- PRESTADOR: app prestador
  ('prestador', 'dashboard', true, false, false, 'App prestador'),
  ('prestador', 'ordens_servico', true, false, false, 'Consulta de alocacoes'),
  ('prestador', 'financeiro', true, false, false, 'Consulta de pagamentos'),
  ('prestador', 'clientes', false, false, false, 'Sem acesso a clientes'),
  ('prestador', 'prestadores', false, false, false, 'Sem acesso a prestadores'),
  ('prestador', 'frota', false, false, false, 'Sem acesso a frota'),
  ('prestador', 'cadastros_auxiliares', false, false, false, 'Sem acesso a cadastros'),
  ('prestador', 'relatorios', false, false, false, 'Sem acesso a relatorios'),
  ('prestador', 'configuracoes', false, false, false, 'Sem acesso a configuracoes')
ON CONFLICT (papel, modulo) DO UPDATE SET
  pode_ver = EXCLUDED.pode_ver,
  pode_editar = EXCLUDED.pode_editar,
  pode_excluir = EXCLUDED.pode_excluir,
  descricao = EXCLUDED.descricao;

-- ============================================================
-- SECAO 6: SEED DOS 5 AGENTES IA INTERNOS
-- Estes NAO fazem login. Apenas assinam acoes automatizadas.
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
-- SECAO 7: CONFIGURACAO DO TENANT PRINCIPAL (CONEXAO EXPRESS)
-- Garante tenant_id para vinculos
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'conexao-express') THEN
    INSERT INTO tenants (id, nome, slug, plano, status, email_contato, cor_primaria)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'Conexao Express',
      'conexao-express',
      'enterprise',
      'ativo',
      'contato@conexaoexpress.com.br',
      '#F97316'
    );
  END IF;
END $$;

-- ============================================================
-- COMENTARIOS
-- ============================================================
COMMENT ON TABLE agentes_ia_internos IS
  'Funcionarios IA internos. NAO fazem login. Apenas assinam execucoes em logs.';

COMMENT ON TABLE auth_eventos_auditoria IS
  'Auditoria de eventos de autenticacao: login, logout, reset, falhas, acessos negados.';

COMMENT ON TABLE perfis_permissoes IS
  'Matriz de permissoes por papel (papel x modulo). Espelho do permissoes.ts no front.';
