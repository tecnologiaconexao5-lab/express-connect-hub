-- ==============================================================================
-- 1. CENTRAL DE COMUNICAÇÃO EM LOTE E ENGAJAMENTO
-- ==============================================================================

-- Tabela principal para as comunicações em lote
CREATE TABLE public.comunicacoes_lote (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  titulo text NOT NULL,
  tipo text NOT NULL, -- rotas_disponiveis, avisos_operacionais, etc.
  conteudo text NOT NULL,
  canal_whatsapp boolean DEFAULT false,
  canal_push boolean DEFAULT false,
  canal_interno boolean DEFAULT false,
  titulo_push text,
  corpo_push text,
  icone_push text,
  agendado_para timestamp with time zone,
  enviado boolean DEFAULT false,
  data_envio timestamp with time zone,
  recurrente boolean DEFAULT false,
  recurrencia_tipo text, -- diario, semanal, mensal
  filtros jsonb, -- Guarda o público alvo segmentado
  reenviar_nao_visualizado boolean DEFAULT false,
  horas_para_reenvio1 integer DEFAULT 2,
  horas_para_reenvio2 integer DEFAULT 6,
  max_tentativas integer DEFAULT 1,
  hora_limite integer DEFAULT 22,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela para rastrear cada destinatário daquela comunicação
CREATE TABLE public.comunicacao_destinatarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  comunicacao_id uuid NOT NULL REFERENCES public.comunicacoes_lote(id) ON DELETE CASCADE,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  candidato_id uuid, -- Caso use para candidatos tmb
  canal text NOT NULL, -- whatsapp, push, interno
  status text NOT NULL DEFAULT 'pendente', -- pendente, enviado, entregue, visualizado, respondido, erro
  enviado_em timestamp with time zone,
  visualizado_em timestamp with time zone,
  respondido_em timestamp with time zone,
  resposta text, -- Caso o usuário respondeu à mensagem no whatsapp
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela para templates de mensagem salvos
CREATE TABLE public.comunicacao_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  tipo text NOT NULL,
  categoria text NOT NULL, -- OPERACIONAIS, FINANCEIROS, DOCUMENTAIS, etc
  conteudo text NOT NULL,
  variaveis_suportadas jsonb, -- ["{{nome}}", "{{primeiro_nome}}"]
  titulo_push text,
  corpo_push text,
  ativo boolean DEFAULT true,
  uso_count integer DEFAULT 0,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela para registrar envios automáticos de aniversário
CREATE TABLE public.aniversarios_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  candidato_id uuid,
  data_aniversario date NOT NULL,
  canal text,
  mensagem text,
  status text DEFAULT 'enviado',
  respondido boolean DEFAULT false,
  resposta text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela Inbox Unificado (Mensagens Reais)
CREATE TABLE public.inbox_mensagens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
  canal text NOT NULL, -- whatsapp
  tipo text NOT NULL, -- txt, imagem, audio
  direcao text NOT NULL, -- enviada, recebida
  mensagem text,
  midia_url text,
  lida boolean DEFAULT false,
  operador_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Enable Realtime para inbox!
alter publication supabase_realtime add table public.inbox_mensagens;

-- Habilitar RLS e Politicas básicas (Apenas admin pode ler)
-- Para uso de demonstração simplificado, ou se já tiver policies no projeto
-- ALTER TABLE public.comunicacoes_lote ENABLE ROW LEVEL SECURITY;
-- etc...
