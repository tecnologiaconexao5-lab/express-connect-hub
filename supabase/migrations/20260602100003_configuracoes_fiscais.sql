-- Fundacao 01: Tabela configuracoes_fiscais (emitentes fiscais)
-- Idempotente: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS

-- Trigger updated_at generica (se ainda nao existir no projeto)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABELA PRINCIPAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configuracoes_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificacao
  apelido text,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text NOT NULL UNIQUE,
  ie text,
  inscricao_municipal text,
  rntrc text,

  -- Endereco
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  codigo_ibge text,

  -- Contato
  telefone text,
  email text,

  -- Fiscal
  ambiente_fiscal text DEFAULT 'homologacao',
  crt text,
  regime_tributario text,
  cnae_principal text,

  -- Plano
  limite_plano integer,

  -- Focus
  focus_empresa_id text,
  focus_token_configurado boolean DEFAULT false,
  focus_status text DEFAULT 'pendente',

  -- Certificado
  certificado_configurado boolean DEFAULT false,
  certificado_nome text,
  certificado_validade date,
  certificado_status text DEFAULT 'pendente',

  -- Controle
  ativo boolean DEFAULT true,
  padrao boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ALTER TABLE: garantir colunas novas em tabelas preexistentes
-- ============================================================
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS inscricao_municipal text;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS codigo_ibge text;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS crt text;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS regime_tributario text;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS cnae_principal text;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS focus_status text DEFAULT 'pendente';
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS certificado_nome text;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS certificado_validade date;
ALTER TABLE public.configuracoes_fiscais ADD COLUMN IF NOT EXISTS certificado_status text DEFAULT 'pendente';

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cf_cnpj ON public.configuracoes_fiscais(cnpj);
CREATE INDEX IF NOT EXISTS idx_cf_ativo ON public.configuracoes_fiscais(ativo);
CREATE INDEX IF NOT EXISTS idx_cf_padrao ON public.configuracoes_fiscais(padrao);
CREATE INDEX IF NOT EXISTS idx_cf_ambiente ON public.configuracoes_fiscais(ambiente_fiscal);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_cf_updated_at ON public.configuracoes_fiscais;
CREATE TRIGGER trg_cf_updated_at
  BEFORE UPDATE ON public.configuracoes_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated" ON public.configuracoes_fiscais;
CREATE POLICY "Enable select for authenticated" ON public.configuracoes_fiscais
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.configuracoes_fiscais;
CREATE POLICY "Enable insert for authenticated" ON public.configuracoes_fiscais
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated" ON public.configuracoes_fiscais;
CREATE POLICY "Enable update for authenticated" ON public.configuracoes_fiscais
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================
-- COMENTARIOS
-- ============================================================
COMMENT ON TABLE public.configuracoes_fiscais IS 'Emitentes fiscais multiempresa. Dados de configuracao para emissao de CT-e, NFS-e e MDF-e via Focus NFe.';
COMMENT ON COLUMN public.configuracoes_fiscais.crt IS 'Codigo de Regime Tributario: 1=Simples Nacional, 2=Simples-excesso, 3=Normal';
COMMENT ON COLUMN public.configuracoes_fiscais.ambiente_fiscal IS 'homologacao ou producao';
COMMENT ON COLUMN public.configuracoes_fiscais.focus_status IS 'pendente/conectado/erro — monitoramento da integracao Focus';
COMMENT ON COLUMN public.configuracoes_fiscais.certificado_status IS 'pendente/ativo/expirado/revogado';
