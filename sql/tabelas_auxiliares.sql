-- =====================================================
-- TMS CONEXAO EXPRESS - TABELAS AUXILIARES
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. TABELA UNIDADES
CREATE TABLE IF NOT EXISTS unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  filial_id UUID,
  descricao TEXT,
  endereco TEXT,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA REGIOES
CREATE TABLE IF NOT EXISTS regioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  uf TEXT,
  cidades TEXT,
  faixa_cep TEXT,
  tipo_operacao TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA FILIAIS
CREATE TABLE IF NOT EXISTS filiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  razao_social TEXT,
  endereco TEXT,
  responsavel TEXT,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA CENTROS CUSTO
CREATE TABLE IF NOT EXISTS centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA ROLES_PERMISSOES
CREATE TABLE IF NOT EXISTS roles_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  modulo TEXT NOT NULL,
  pode_ver BOOLEAN DEFAULT true,
  pode_criar BOOLEAN DEFAULT false,
  pode_editar BOOLEAN DEFAULT false,
  pode_excluir BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, modulo)
);

-- =====================================================
-- DADOS INICIAIS - PERMISSÕES PADRÃO
-- =====================================================

INSERT INTO roles_permissoes (role, modulo, pode_ver, pode_criar, pode_editar, pode_excluir) VALUES
-- ADMIN
('admin', 'dashboard', true, true, true, true),
('admin', 'clientes', true, true, true, true),
('admin', 'prestadores', true, true, true, true),
('admin', 'ordens_servico', true, true, true, true),
('admin', 'financeiro', true, true, true, true),
('admin', 'cadastros_auxiliares', true, true, true, true),
('admin', 'relatorios', true, true, true, true),
('admin', 'configuracoes', true, true, true, true),
-- OPERADOR
('operador', 'dashboard', true, false, false, false),
('operador', 'clientes', true, true, true, false),
('operador', 'prestadores', true, true, true, false),
('operador', 'ordens_servico', true, true, true, false),
('operador', 'financeiro', true, false, false, false),
('operador', 'cadastros_auxiliares', true, false, false, false),
('operador', 'relatorios', true, false, false, false),
('operador', 'configuracoes', false, false, false, false),
-- CLIENTE
('cliente', 'dashboard', true, false, false, false),
('cliente', 'clientes', false, false, false, false),
('cliente', 'prestadores', false, false, false, false),
('cliente', 'ordens_servico', true, false, false, false),
('cliente', 'financeiro', true, false, false, false),
('cliente', 'cadastros_auxiliares', false, false, false, false),
('cliente', 'relatorios', false, false, false, false),
('cliente', 'configuracoes', false, false, false, false),
-- PRESTADOR
('prestador', 'dashboard', true, false, false, false),
('prestador', 'clientes', false, false, false, false),
('prestador', 'prestadores', false, false, false, false),
('prestador', 'ordens_servico', true, false, false, false),
('prestador', 'financeiro', true, false, false, false),
('prestador', 'cadastros_auxiliares', false, false, false, false),
('prestador', 'relatorios', false, false, false, false),
('prestador', 'configuracoes', false, false, false, false)
ON CONFLICT (role, modulo) DO NOTHING;

-- =====================================================
-- ENABLE RLS (Opcional - comentar se nÃo quiserpolÃ­tica ativa)
-- =====================================================

-- ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE regioes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE roles_permissoes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT 'Tabelas criadas com sucesso!' AS resultado;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('unidades', 'regioes', 'filiais', 'centros_custo', 'roles_permissoes')
ORDER BY table_name;