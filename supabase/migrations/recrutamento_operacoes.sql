-- Tabela de Operações de Recrutamento
CREATE TABLE IF NOT EXISTS public.operacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cliente VARCHAR(255) NOT NULL,
  regiao VARCHAR(255) NOT NULL,
  rota VARCHAR(255),
  veiculo VARCHAR(100),
  tipo_carga VARCHAR(50),
  tipo_produto VARCHAR(255),
  peso_carga VARCHAR(100),
  dimensoes VARCHAR(100),
  horario_carregamento VARCHAR(100),
  local_carregamento VARCHAR(255),
  forma_pagamento VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Aberta',
  prioridade VARCHAR(50) DEFAULT 'media',
  vagas INTEGER DEFAULT 1,
  diaria INTEGER DEFAULT 1,
  data_inicio DATE,
  recurrencia VARCHAR(50) DEFAULT 'unica',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Financeira das Operações (Restrita)
CREATE TABLE IF NOT EXISTS public.operacoes_financeiro (
  operacao_id UUID PRIMARY KEY REFERENCES public.operacoes(id) ON DELETE CASCADE,
  valor_saida NUMERIC(10, 2) DEFAULT 0, -- Valor pago pelo cliente
  valor_prestador NUMERIC(10, 2) DEFAULT 0,
  imposto NUMERIC(10, 2) DEFAULT 0,
  custo_seguro NUMERIC(10, 2) DEFAULT 0,
  km_incluso INTEGER DEFAULT 0,
  km_excedente INTEGER DEFAULT 0,
  valor_km_excedente NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) para Proteger Financeiro
ALTER TABLE public.operacoes_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro visível apenas para admin/financeiro"
ON public.operacoes_financeiro
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' IN ('admin', 'financeiro')
  )
);

-- Tabela de Match (Prestadores x Operações)
CREATE TABLE IF NOT EXISTS public.match_operacoes_prestadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operacao_id UUID REFERENCES public.operacoes(id) ON DELETE CASCADE,
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
  score_match NUMERIC(5, 2) DEFAULT 0,
  motivos TEXT,
  status VARCHAR(50) DEFAULT 'sugerido', -- sugerido, contatado, interessado, aprovado, recusado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operacao_id, prestador_id)
);
