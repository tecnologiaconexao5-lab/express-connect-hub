-- Migration 6: Central Inteligente de Automações

-- 1. automacoes_regras
CREATE TABLE IF NOT EXISTS public.automacoes_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    modulo TEXT,
    evento_trigger TEXT,
    canal TEXT,
    ativa BOOLEAN DEFAULT true,
    prioridade TEXT DEFAULT 'normal',
    condicoes JSONB DEFAULT '{}',
    acoes JSONB DEFAULT '[]',
    ultima_execucao TIMESTAMPTZ,
    proxima_execucao TIMESTAMPTZ,
    total_execucoes INTEGER DEFAULT 0,
    total_erros INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. automacoes_execucoes
CREATE TABLE IF NOT EXISTS public.automacoes_execucoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regra_id UUID REFERENCES public.automacoes_regras(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pendente',
    modulo TEXT,
    evento TEXT,
    payload JSONB,
    resultado JSONB,
    erro TEXT,
    iniciado_em TIMESTAMPTZ,
    finalizado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. automacoes_fila
CREATE TABLE IF NOT EXISTS public.automacoes_fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regra_id UUID REFERENCES public.automacoes_regras(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL,
    canal TEXT NOT NULL,
    destino TEXT NOT NULL,
    assunto TEXT,
    mensagem TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pendente',
    tentativas INTEGER DEFAULT 0,
    max_tentativas INTEGER DEFAULT 3,
    agendado_para TIMESTAMPTZ DEFAULT now(),
    processado_em TIMESTAMPTZ,
    erro TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. webhooks_recebidos
CREATE TABLE IF NOT EXISTS public.webhooks_recebidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origem TEXT NOT NULL,
    evento TEXT NOT NULL,
    payload JSONB NOT NULL,
    processado BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'recebido',
    erro TEXT,
    received_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ia_logs
CREATE TABLE IF NOT EXISTS public.ia_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    modulo TEXT,
    entrada TEXT NOT NULL,
    saida TEXT,
    intencao TEXT,
    confianca NUMERIC,
    precisa_humano BOOLEAN DEFAULT false,
    tokens_estimados INTEGER,
    custo_estimado NUMERIC,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ia_contextos
CREATE TABLE IF NOT EXISTS public.ia_contextos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    modulo TEXT,
    tipo TEXT,
    conteudo TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_automacoes_regras_ativa ON public.automacoes_regras(ativa);
CREATE INDEX IF NOT EXISTS idx_automacoes_execucoes_status ON public.automacoes_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_automacoes_fila_status ON public.automacoes_fila(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_recebidos_processado ON public.webhooks_recebidos(processado);

-- Initial Rules
INSERT INTO public.automacoes_regras (nome, descricao, modulo, evento_trigger, canal, ativa)
VALUES 
('Follow-up Comercial D+1', 'Agendamento de follow-up automático no dia seguinte após envio da proposta', 'comercial', 'proposta_enviada', 'whatsapp', true),
('Aviso Motorista Coleta', 'Envia os dados da OS de coleta para o motorista pelo WhatsApp', 'operacional', 'os_coleta_criada', 'whatsapp', true),
('Atualização Cliente Entrega', 'Envia notificação ao cliente quando pedido sai para entrega', 'operacional', 'pedido_saiu_entrega', 'whatsapp', true),
('IA Atendimento Cliente', 'Classificação de intenção e sugestão de resposta para clientes', 'comunicacao', 'mensagem_recebida', 'ia', true)
ON CONFLICT DO NOTHING;
