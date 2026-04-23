-- ============================================
-- BLOCO 1: ALTER TABLE (JÁ EXISTENTES)
-- Tabelas que já existem no schema
-- Apenas adicionar campos FALTANTES
-- ============================================
-- IMPORTANTE: Execute APENAS se os campos não existirem
-- ============================================

-- -------------------------------------------------------
-- 1.1: os_enderecos - Campos para tracking de tempo
-- -------------------------------------------------------
-- STATUS: JÁ EXISTE - Adicionar campos apenas se não existirem

-- ALTER TABLE IF EXISTS public.os_enderecos
-- ADD COLUMN IF NOT EXISTS latitude numeric,
-- ADD COLUMN IF NOT EXISTS longitude numeric,
-- ADD COLUMN IF NOT EXISTS hora_chegada timestamptz,
-- ADD COLUMN IF NOT EXISTS hora_inicio timestamptz,
-- ADD COLUMN IF NOT EXISTS hora_fim timestamptz,
-- ADD COLUMN IF NOT EXISTS observacao text,
-- ADD COLUMN IF NOT EXISTS status_chegada text DEFAULT 'pendente';

-- CREATE INDEX IF NOT EXISTS idx_os_enderecos_coords 
--   ON public.os_enderecos(latitude, longitude) 
--   WHERE latitude IS NOT NULL;

-- -------------------------------------------------------
-- 1.2: ocorrencias - Campos para prestador/veículo
-- -------------------------------------------------------
-- STATUS: JÁ EXISTE - Adicionar campos apenas se não existirem

-- ALTER TABLE IF EXISTS public.ocorrencias
-- ADD COLUMN IF NOT EXISTS prestador_id uuid REFERENCES public.prestadores(id),
-- ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id),
-- ADD COLUMN IF NOT EXISTS fotos jsonb,
-- ADD COLUMN IF NOT EXISTS resolvida_por uuid REFERENCES public.usuarios(id),
-- ADD COLUMN IF NOT EXISTS nota_fiscal text,
-- ADD COLUMN IF NOT EXISTS impacto_valor numeric;

-- CREATE INDEX IF NOT EXISTS idx_ocorrencias_prestador 
--   ON public.ocorrencias(prestador_id) 
--   WHERE prestador_id IS NOT NULL;

-- ============================================
-- BLOCO 2: TABELAS CENTRAIS DO APP
-- Estruturas fundamentais para o app funcionar
-- ============================================

-- -------------------------------------------------------
-- 2.1: prestador_acesso - Controle de aprovação
-- -------------------------------------------------------
-- Controle de aprovação e acesso do prestador ao app
-- status_cadastro: pendente, em_analise, aprovado, rejeitado, inativo

CREATE TABLE IF NOT EXISTS public.prestador_acesso (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE UNIQUE,
  status_cadastro text DEFAULT 'pendente',
  data_analise timestamptz,
  analisado_por uuid REFERENCES public.usuarios(id),
  motivo_bloqueio text,
  app_instalado boolean DEFAULT false,
  ultimo_acesso timestamptz,
  token_acesso text,
  token_expira timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestador_acesso_prestador 
  ON public.prestador_acesso(prestador_id);

CREATE INDEX IF NOT EXISTS idx_prestador_acesso_status 
  ON public.prestador_acesso(status_cadastro);

-- -------------------------------------------------------
-- 2.2: prestador_disponibilidade - Controle diário
-- -------------------------------------------------------
-- Controle de disponibilidade diária do prestador
-- periodo: manha, tarde, noite, integral

CREATE TABLE IF NOT EXISTS public.prestador_disponibilidade (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  data date NOT NULL,
  periodo text NOT NULL,
  disponivel boolean DEFAULT true,
  justificativa text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(prestador_id, data)
);

CREATE INDEX IF NOT EXISTS idx_prestador_disp_prestador 
  ON public.prestador_disponibilidade(prestador_id);

CREATE INDEX IF NOT EXISTS idx_prestador_disp_data 
  ON public.prestador_disponibilidade(data);

-- -------------------------------------------------------
-- 2.3: prestador_candidaturas - Redes de serviço
-- -------------------------------------------------------
-- Candidaturas do prestador em redes de serviço
-- status: disponivel, em_proposta, ocupado, recusado

CREATE TABLE IF NOT EXISTS public.prestador_candidaturas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES public.veiculos(id),
  regiao text NOT NULL,
  tipo_veiculo text NOT NULL,
  valor_minimo numeric,
  distancia_maxima numeric,
  status text DEFAULT 'disponivel',
  total_propostas integer DEFAULT 0,
  aceitas integer DEFAULT 0,
  rejeitadas integer DEFAULT 0,
  ultima_proposta timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestador_cand_prestador 
  ON public.prestador_candidaturas(prestador_id);

CREATE INDEX IF NOT EXISTS idx_prestador_cand_status 
  ON public.prestador_candidaturas(status);

CREATE INDEX IF NOT EXISTS idx_prestador_cand_regiao 
  ON public.prestador_candidaturas(regiao);

-- -------------------------------------------------------
-- 2.4: os_pod - Comprovante de entrega
-- -------------------------------------------------------
-- Prova de entrega / Recibo
-- tipo: coleta, entrega

CREATE TABLE IF NOT EXISTS public.os_pod (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  parada_id uuid REFERENCES public.os_enderecos(id),
  tipo text NOT NULL,
  url_comprovante text,
  assinatura_url text,
  foto_url text,
  nome_recebedor text,
  documento_recebedor text,
  observacao text,
  latitude numeric,
  longitude numeric,
  timestamp_capture timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_pod_os 
  ON public.os_pod(os_id);

CREATE INDEX IF NOT EXISTS idx_os_pod_parada 
  ON public.os_pod(parada_id);

-- ============================================
-- BLOCO 3: FINANCEIROS E COMPLEMENTARES
-- Estruturas financeiras e operacionais
-- ============================================

-- -------------------------------------------------------
-- 3.1: prestador_reembolsos - Pedidos de reembolso
-- -------------------------------------------------------
-- Despesas e reembolsos do prestador
-- tipo: pedagio, ajudante, estadia, diaria, outros
-- status: pendente, aprovado, rejeitado, pago

CREATE TABLE IF NOT EXISTS public.prestador_reembolsos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  os_id uuid REFERENCES public.ordens_servico(id),
  tipo text NOT NULL,
  descricao text,
  valor numeric NOT NULL,
  data_despesa date NOT NULL,
  comprovante_url text,
  status text DEFAULT 'pendente',
  aprovado_por uuid REFERENCES public.usuarios(id),
  data_aprovacao timestamptz,
  obs_rejeicao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestador_reemb_prestador 
  ON public.prestador_reembolsos(prestador_id);

CREATE INDEX IF NOT EXISTS idx_prestador_reemb_status 
  ON public.prestador_reembolsos(status);

CREATE INDEX IF NOT EXISTS idx_prestador_reemb_os 
  ON public.prestador_reembolsos(os_id);

-- -------------------------------------------------------
-- 3.2: REAPROVEITAMENTO DE ABASTECIMENTOS
-- -------------------------------------------------------
-- STATUS: ⚠️ JÁ EXISTE em combustiveis_schema.sql
-- Tabela: public.abastecimentos
-- REAPROVEITAR - não criar nova tabela
-- -------------------------------------------------------
-- Se necessário adicionar campos específicos do app:

-- ALTER TABLE IF EXISTS public.abastecimentos
-- ADD COLUMN IF NOT EXISTS km_atual integer,
-- ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente';

-- -------------------------------------------------------
-- 3.3: prestador_notificacoes - Notificações app
-- -------------------------------------------------------
-- Notificações específicas do prestador
-- tipo: os, financeiro, sistema, documento, ocorrencia
-- prioridade: baixa, normal, alta, urgente

CREATE TABLE IF NOT EXISTS public.prestador_notificacoes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  visualizada boolean DEFAULT false,
  data_visualizacao timestamptz,
  link_acao text,
  prioridade text DEFAULT 'normal',
  acao_required boolean DEFAULT false,
  acao_concluida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestador_notif_prestador 
  ON public.prestador_notificacoes(prestador_id);

CREATE INDEX IF NOT EXISTS idx_prestador_notif_visualizada 
  ON public.prestador_notificacoes(visualizada);

-- ============================================
-- BLOCO 4: CONFIG E INTELIGÊNCIA
-- Configurações e analytics
-- ============================================

-- -------------------------------------------------------
-- 4.1: prestador_engajamento - Score e bonificação
-- -------------------------------------------------------
-- Score e métricas do prestador para bonificação

CREATE TABLE IF NOT EXISTS public.prestador_engajamento (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE UNIQUE,
  score_geral numeric DEFAULT 0,
  score_pontualidade numeric DEFAULT 0,
  score_qualidade numeric DEFAULT 0,
  score_comunicacao numeric DEFAULT 0,
  total_entregas integer DEFAULT 0,
  total_entregas_mes integer DEFAULT 0,
  taxa_ocorrencias numeric DEFAULT 0,
  dias_ativos_mes integer DEFAULT 0,
  bonificacao_ativa boolean DEFAULT false,
  valor_bonificacao numeric DEFAULT 0,
  ultimo_calculo timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestador_engaj_prestador 
  ON public.prestador_engajamento(prestador_id);

CREATE INDEX IF NOT EXISTS idx_prestador_engaj_score 
  ON public.prestador_engajamento(score_geral DESC);

-- -------------------------------------------------------
-- 4.2: app_config - Configurações do app
-- -------------------------------------------------------
-- Configurações gerais do app (toggle de funcionalidades)

CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  chave text UNIQUE NOT NULL,
  valor jsonb NOT NULL,
  descricao text,
  modulo text DEFAULT 'app',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert padrão de configurações
INSERT INTO public.app_config (chave, valor, descricao, modulo) VALUES
  ('engajamento_ativo', '{"enabled": true, "tipos": ["Fixo", "Agregado"]}', 'Ativa módulo de bonificação/engajamento', 'engajamento')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.app_config (chave, valor, descricao, modulo) VALUES
  ('app_version_minima', '{"ios": "1.0.0", "android": "1.0.0"}', 'Versão mínima do app', 'app')
ON CONFLICT (chave) DO NOTHING;

-- -------------------------------------------------------
-- 4.3: dreamflow_eventos - Analytics do app
-- -------------------------------------------------------
-- Analytics de eventos do app do prestador
-- OBS: tracking_eventos (tracking_schema.sql) pode suprir parte desses dados
--      Use dreamflow_eventos para eventos específicos do app mobile

CREATE TABLE IF NOT EXISTS public.dreamflow_eventos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  evento_type text NOT NULL,
  os_id uuid REFERENCES public.ordens_servico(id),
  metadata jsonb,
  app_version text,
  device_id text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dreamflow_eventos_prestador 
  ON public.dreamflow_eventos(prestador_id);

CREATE INDEX IF NOT EXISTS idx_dreamflow_eventos_tipo 
  ON public.dreamflow_eventos(evento_type);

CREATE INDEX IF NOT EXISTS idx_dreamflow_eventos_os 
  ON public.dreamflow_eventos(os_id);

-- ============================================
-- BLOCO 5: REALTIME (OPICIONAL)
-- Habilitar realtime nas tabelas críticas
-- ============================================
-- ⚠️ Execute APENAS se quiser realtime

-- ALTER PUBLICATION supabase_realtime ADD TABLE public.prestador_notificacoes;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.dreamflow_eventos;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.prestador_acesso;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Roteiro de execução no Supabase:
-- 1. Execute Bloco 1 (ALTER TABLE) - linhas comentadas
-- 2. Execute Bloco 2 (Centrais) - linhas ativas
-- 3. Execute Bloco 3 (Financeiros) - linhas ativas
-- 4. Execute Bloco 4 (Config) - linhas ativas
-- 5. Execute Bloco 5 (Realtime) - opcional
-- ============================================