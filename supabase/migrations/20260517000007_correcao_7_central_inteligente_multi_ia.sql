-- Correção 7 (Complemento): Central Inteligente + Multi IA + Automações

-- Alterar a tabela ia_logs para adicionar as colunas faltantes, se não existirem
ALTER TABLE public.ia_logs 
  ADD COLUMN IF NOT EXISTS modulo varchar(100),
  ADD COLUMN IF NOT EXISTS entrada text,
  ADD COLUMN IF NOT EXISTS saida text,
  ADD COLUMN IF NOT EXISTS intencao varchar(100),
  ADD COLUMN IF NOT EXISTS confianca numeric,
  ADD COLUMN IF NOT EXISTS precisa_humano boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status varchar(50) DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS erro text;

-- 1. Contextos da IA
CREATE TABLE IF NOT EXISTS public.ia_contextos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    modulo varchar(100) NOT NULL,
    prompt_sistema text NOT NULL,
    parametros jsonb DEFAULT '{}'::jsonb,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Regras de Automação
CREATE TABLE IF NOT EXISTS public.automacoes_regras (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome varchar(100) NOT NULL,
    modulo varchar(100) NOT NULL,
    evento_trigger varchar(100) NOT NULL,
    canal varchar(50) DEFAULT 'whatsapp',
    ativa boolean DEFAULT true,
    prioridade integer DEFAULT 99,
    condicoes jsonb DEFAULT '[]'::jsonb,
    acoes jsonb DEFAULT '[]'::jsonb,
    ultima_execucao timestamp with time zone,
    proxima_execucao timestamp with time zone,
    total_execucoes integer DEFAULT 0,
    total_erros integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Inserir regras base
INSERT INTO public.automacoes_regras (nome, modulo, evento_trigger, canal, ativa)
VALUES
('Follow-up comercial D+1', 'comercial', 'orcamento_enviado_1d', 'whatsapp', true),
('Follow-up comercial D+3', 'comercial', 'orcamento_enviado_3d', 'whatsapp', true),
('Aviso motorista coleta', 'operacional', 'os_criada', 'whatsapp', true),
('Aviso motorista entrega', 'operacional', 'os_em_rota', 'whatsapp', true),
('Lembrete comprovante', 'operacional', 'os_entregue_sem_doc', 'whatsapp', true),
('Atualização cliente', 'cliente', 'status_os_alterado', 'whatsapp', true),
('Cobrança amigável', 'financeiro', 'fatura_vencendo', 'whatsapp', true),
('IA atendimento cliente', 'comunicacao', 'mensagem_cliente_recebida', 'ia', true),
('IA operacional', 'comunicacao', 'mensagem_operacional_recebida', 'ia', true)
ON CONFLICT DO NOTHING;

-- 3. Execuções de Automação
CREATE TABLE IF NOT EXISTS public.automacoes_execucoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    regra_id uuid REFERENCES public.automacoes_regras(id) ON DELETE CASCADE,
    referencia_id varchar(100), -- ID da OS, Cliente, etc.
    status varchar(50) DEFAULT 'sucesso',
    log text,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Fila de Automações
CREATE TABLE IF NOT EXISTS public.automacoes_fila (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    regra_id uuid REFERENCES public.automacoes_regras(id) ON DELETE SET NULL,
    tipo varchar(50) NOT NULL,
    canal varchar(50) NOT NULL,
    destino varchar(150),
    assunto varchar(200),
    mensagem text,
    payload jsonb DEFAULT '{}'::jsonb,
    status varchar(50) DEFAULT 'pendente', -- pendente, processando, concluido, erro
    tentativas integer DEFAULT 0,
    max_tentativas integer DEFAULT 3,
    agendado_para timestamp with time zone DEFAULT now(),
    processado_em timestamp with time zone,
    erro text,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Webhooks Recebidos
CREATE TABLE IF NOT EXISTS public.webhooks_recebidos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    origem varchar(100) NOT NULL, -- evolution, n8n, etc
    evento varchar(100),
    payload jsonb DEFAULT '{}'::jsonb,
    status varchar(50) DEFAULT 'recebido',
    processado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Configurações permissivas de MVP
DROP POLICY IF EXISTS "Permitir tudo em ia_contextos" ON public.ia_contextos;
CREATE POLICY "Permitir tudo em ia_contextos" ON public.ia_contextos FOR ALL USING (true);
ALTER TABLE public.ia_contextos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em automacoes_regras" ON public.automacoes_regras;
CREATE POLICY "Permitir tudo em automacoes_regras" ON public.automacoes_regras FOR ALL USING (true);
ALTER TABLE public.automacoes_regras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em automacoes_execucoes" ON public.automacoes_execucoes;
CREATE POLICY "Permitir tudo em automacoes_execucoes" ON public.automacoes_execucoes FOR ALL USING (true);
ALTER TABLE public.automacoes_execucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em automacoes_fila" ON public.automacoes_fila;
CREATE POLICY "Permitir tudo em automacoes_fila" ON public.automacoes_fila FOR ALL USING (true);
ALTER TABLE public.automacoes_fila ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em webhooks_recebidos" ON public.webhooks_recebidos;
CREATE POLICY "Permitir tudo em webhooks_recebidos" ON public.webhooks_recebidos FOR ALL USING (true);
ALTER TABLE public.webhooks_recebidos ENABLE ROW LEVEL SECURITY;
