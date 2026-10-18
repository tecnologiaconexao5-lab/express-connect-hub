-- Fundacao 02: Tabela regras_fiscais_cte (CFOP e ICMS por UF/cliente/operacao)
-- Idempotente: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS

CREATE TABLE IF NOT EXISTS public.regras_fiscais_cte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  nome text,
  descricao text,

  cliente_id uuid REFERENCES public.clientes(id),
  emitente_id uuid REFERENCES public.configuracoes_fiscais(id),

  uf_origem text NOT NULL,
  uf_destino text NOT NULL,
  tipo_operacao text,

  cfop text NOT NULL,
  natureza_operacao text,
  aliquota_icms numeric,
  cst_icms text DEFAULT '00',
  reducao_base numeric DEFAULT 0,

  ativo boolean DEFAULT true,
  padrao boolean DEFAULT false,
  observacoes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Colunas que podem nao existir em tabelas preexistentes
ALTER TABLE public.regras_fiscais_cte ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.regras_fiscais_cte ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.regras_fiscais_cte ADD COLUMN IF NOT EXISTS emitente_id uuid REFERENCES public.configuracoes_fiscais(id);
ALTER TABLE public.regras_fiscais_cte ADD COLUMN IF NOT EXISTS cst_icms text DEFAULT '00';
ALTER TABLE public.regras_fiscais_cte ADD COLUMN IF NOT EXISTS reducao_base numeric DEFAULT 0;
ALTER TABLE public.regras_fiscais_cte ADD COLUMN IF NOT EXISTS padrao boolean DEFAULT false;

-- Indices
CREATE INDEX IF NOT EXISTS idx_rfc_ufs ON public.regras_fiscais_cte(uf_origem, uf_destino);
CREATE INDEX IF NOT EXISTS idx_rfc_ativo ON public.regras_fiscais_cte(ativo);
CREATE INDEX IF NOT EXISTS idx_rfc_padrao ON public.regras_fiscais_cte(padrao);
CREATE INDEX IF NOT EXISTS idx_rfc_cliente ON public.regras_fiscais_cte(cliente_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_rfc_updated_at ON public.regras_fiscais_cte;
CREATE TRIGGER trg_rfc_updated_at
  BEFORE UPDATE ON public.regras_fiscais_cte
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.regras_fiscais_cte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated" ON public.regras_fiscais_cte;
DROP POLICY IF EXISTS "Enable select for authenticated" ON public.regras_fiscais_cte;
DROP POLICY IF EXISTS "Enable select for authenticated" ON regras_fiscais_cte;
CREATE POLICY "Enable select for authenticated" ON regras_fiscais_cte
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.regras_fiscais_cte;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.regras_fiscais_cte;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON regras_fiscais_cte;
CREATE POLICY "Enable insert for authenticated" ON regras_fiscais_cte
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated" ON public.regras_fiscais_cte;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.regras_fiscais_cte;
DROP POLICY IF EXISTS "Enable update for authenticated" ON regras_fiscais_cte;
CREATE POLICY "Enable update for authenticated" ON regras_fiscais_cte
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Seed: regra padrao SP -> SP, CFOP 5353, ICMS 12%
INSERT INTO public.regras_fiscais_cte (nome, descricao, uf_origem, uf_destino, tipo_operacao, cfop, natureza_operacao, aliquota_icms, cst_icms, ativo, padrao, observacoes)
SELECT
  'Padrão SP-SP',
  'Regra fiscal padrão para operações dentro de São Paulo — prestação de serviço de transporte intermunicipal',
  'SP', 'SP', 'Coleta e Entrega',
  '5353', 'Prestação de serviço de transporte — intermunicipal', 12, '00',
  true, true,
  'Seed inicial — ajustar conforme necessidade'
WHERE NOT EXISTS (
  SELECT 1 FROM public.regras_fiscais_cte WHERE padrao = true AND uf_origem = 'SP' AND uf_destino = 'SP'
);

-- Comentarios
COMMENT ON TABLE public.regras_fiscais_cte IS 'Regras fiscais de CT-e: CFOP, aliquota ICMS, CST por cliente/UF/operacao.';
COMMENT ON COLUMN public.regras_fiscais_cte.cst_icms IS 'Codigo de Situacao Tributaria do ICMS (00=Tributado integralmente)';
COMMENT ON COLUMN public.regras_fiscais_cte.reducao_base IS 'Percentual de reducao da base de calculo do ICMS (0=sem reducao)';


