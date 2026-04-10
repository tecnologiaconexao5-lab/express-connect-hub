-- TABELA: operacoes (Campanhas de Recrutamento Inteligente)
CREATE TABLE IF NOT EXISTS public.operacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome varchar NOT NULL,
  cliente varchar,
  regiao_carregamento varchar,
  veiculo varchar,
  capacidade_kg numeric,
  capacidade_m3 numeric,
  valor_saida numeric DEFAULT 0,
  km_franquia numeric DEFAULT 0,
  valor_km_adicional numeric DEFAULT 0,
  dias_operacao varchar,
  dias_operados_mes integer DEFAULT 22,
  consumo_economico numeric,
  consumo_normal numeric,
  consumo_pesado numeric,
  valor_combustivel numeric,
  manutencao_km numeric,
  pneu_km numeric,
  documentacao_anual numeric,
  custo_dia numeric,
  custo_km numeric,
  qtde_paradas_min integer,
  qtde_paradas_max integer,
  tipo_produto varchar,
  tipo_entrega varchar,
  ajudante varchar,
  horario_carregamento time,
  tipo_operacao varchar,
  tipo_pagamento varchar,
  regra_pagamento varchar,
  observacoes text,
  lucro_estimado numeric,
  status varchar DEFAULT 'Ativo',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABELA: motoristas (profissionais parceiros - manter a linguagem neutra, sem vinculo trabalhista)
CREATE TABLE IF NOT EXISTS public.motoristas_parceiros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome varchar NOT NULL,
  veiculo varchar,
  capacidade numeric,
  telefone varchar,
  regiao varchar,
  status varchar DEFAULT 'Triagem',
  score integer DEFAULT 0,
  historico_aceitacao numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABELA: disparos_whatsapp
CREATE TABLE IF NOT EXISTS public.disparos_whatsapp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operacao_id uuid REFERENCES public.operacoes(id),
  motorista_id uuid REFERENCES public.motoristas_parceiros(id),
  data_envio timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  status varchar,
  canal varchar DEFAULT 'WhatsApp',
  mensagem text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
