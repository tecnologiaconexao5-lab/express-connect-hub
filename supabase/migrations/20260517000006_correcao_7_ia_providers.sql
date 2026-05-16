-- Correção 7: Provedores de IA
CREATE TABLE IF NOT EXISTS public.ia_providers_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    provider varchar(50) NOT NULL, -- 'groq', 'gemini', 'openrouter', 'openai'
    model varchar(100) NOT NULL,
    ativo boolean DEFAULT false,
    prioridade integer DEFAULT 99,
    setor varchar(50) DEFAULT 'Geral',
    temperatura numeric DEFAULT 0.7,
    max_tokens integer DEFAULT 1024,
    is_default boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Inserir provedores iniciais
INSERT INTO public.ia_providers_config (provider, model, ativo, prioridade, is_default)
VALUES
('groq', 'llama3-8b-8192', true, 1, true),
('gemini', 'gemini-1.5-pro', true, 2, false),
('openrouter', 'openrouter/auto', true, 3, false),
('openai', 'gpt-4o', true, 4, false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ia_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    provider varchar(50),
    model varchar(100),
    action varchar(100), -- 'test', 'generate', 'summarize', 'classify'
    prompt text,
    response text,
    tokens_used integer DEFAULT 0,
    success boolean DEFAULT true,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Políticas RLS (desativado por padrão para operações do backend/banco, mas se estiver ativado:)
ALTER TABLE public.ia_providers_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_logs ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas temporárias (MVP)
DROP POLICY IF EXISTS "Permitir leitura total provedores" ON public.ia_providers_config;
CREATE POLICY "Permitir leitura total provedores" ON public.ia_providers_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita total provedores" ON public.ia_providers_config;
CREATE POLICY "Permitir escrita total provedores" ON public.ia_providers_config FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura total logs" ON public.ia_logs;
CREATE POLICY "Permitir leitura total logs" ON public.ia_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita total logs" ON public.ia_logs;
CREATE POLICY "Permitir escrita total logs" ON public.ia_logs FOR ALL USING (true);
