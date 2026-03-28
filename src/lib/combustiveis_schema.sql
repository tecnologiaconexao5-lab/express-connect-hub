-- ==============================================================================
-- MONITORAMENTO DE COMBUSTÍVEIS E IMPACTO
-- ==============================================================================

CREATE TABLE public.combustivel_precos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  combustivel text NOT NULL, -- Diesel S10, Gasolina, etc
  preco numeric(10,4) NOT NULL,
  data_referencia timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  uf text,
  municipio text,
  fonte text NOT NULL, -- combustivelapi, ANP, Petrobras, Manual
  tipo_atualizacao text, -- automatica, manual
  variacao_dia numeric(10,4),
  variacao_7d numeric(10,4),
  variacao_30d numeric(10,4),
  previsao_7d numeric(10,4),
  previsao_30d numeric(10,4),
  usuario_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE public.combustivel_config_veiculos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tipo_veiculo text NOT NULL UNIQUE, -- VUC, Van, 3/4
  tipo_combustivel text NOT NULL,
  km_por_litro numeric(10,2) NOT NULL,
  km_medio_saida_urbana numeric(10,2),
  km_medio_rota numeric(10,2),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE public.combustivel_alertas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tipo_alerta text NOT NULL, -- variacao_alta, falha_sync
  combustivel text,
  valor_gatilho numeric(10,2),
  mensagem text NOT NULL,
  enviado_para jsonb,
  visualizado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE public.combustivel_sync_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  fonte text NOT NULL,
  status text NOT NULL, -- success, error
  preco_obtido numeric(10,4),
  erro_mensagem text,
  duracao_ms integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Note: abastecimentos might already be defined, but here is the requested extension
CREATE TABLE IF NOT EXISTS public.abastecimentos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  veiculo_id uuid,
  prestador_id uuid,
  os_id uuid REFERENCES public.ordens_servico(id),
  data timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  litros numeric(10,2) NOT NULL,
  preco_litro numeric(10,4) NOT NULL,
  valor_total numeric(10,2) NOT NULL,
  posto text,
  cidade text,
  uf text,
  preco_referencia_dia numeric(10,4),
  variacao_referencia numeric(10,2),
  tipo_combustivel text,
  comprovante_url text,
  status_reembolso text DEFAULT 'pendente',
  aprovado_por uuid REFERENCES auth.users(id),
  PRIMARY KEY (id)
);
