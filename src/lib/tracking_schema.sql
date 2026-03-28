-- ==============================================================================
-- 2. ENDEREÇOS FAVORITOS
-- ==============================================================================

CREATE TABLE public.enderecos_favoritos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid REFERENCES public.cadastro_clientes(id), -- Opcional: Se salvo pelo cliente logado no portal
  usuario_id uuid REFERENCES auth.users(id), -- Quem criou
  nome text NOT NULL, -- "CD São Paulo", "Cliente Nuty Açaí - Matriz"
  tipo text NOT NULL, -- coleta, entrega, ambos
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  contato text,
  telefone text,
  instrucoes text,
  janela_inicio text,
  janela_fim text,
  qtd_usos integer DEFAULT 0,
  ultimo_uso timestamp with time zone,
  is_padrao boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);


-- ==============================================================================
-- 3. TRACKING DE ENTREGA E NOTIFICAÇÕES (PÚBLICO)
-- ==============================================================================

-- Tabela para rastrear cada código de rastreio gerado (Atrelado a OS)
CREATE TABLE public.tracking_links (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  codigo_rastreio text NOT NULL UNIQUE, -- ex: CEX-202503-041234
  senha_acesso text, -- Caso queira proteger
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela para os eventos reais do tracking
CREATE TABLE public.tracking_eventos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  codigo_rastreio text NOT NULL,
  tipo_evento text NOT NULL, -- pedido_recebido, pedido_confirmado, prestador_alocado, saiu_para_coleta, coletado, em_transito, saiu_para_entrega, entregue, ocorrencia
  titulo text NOT NULL,
  descricao text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  origem text, -- torre, app_motorista, sistema
  dados_adicionais jsonb,
  PRIMARY KEY (id)
);

-- Habilitar Realtime para os eventos do tracking!
alter publication supabase_realtime add table public.tracking_eventos;

-- Opt-in de notificações multi-canal que o usuário escolhe na tela de tracking ou via OS
CREATE TABLE public.tracking_notificacoes_destinatario (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  codigo_rastreio text NOT NULL,
  destinatario_nome text,
  destinatario_whatsapp text,
  destinatario_email text,
  canal_preferido text, -- whatsapp, email, sms
  notificar_em jsonb, -- ["coletado", "saiu_para_entrega", "entregue", "ocorrencia"]
  ultimo_evento_notificado text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);
