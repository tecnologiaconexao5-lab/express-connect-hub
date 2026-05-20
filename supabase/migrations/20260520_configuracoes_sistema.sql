-- Cria tabela de configurações gerais do sistema para persistência do módulo Configurações
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracoes_sistema_select" ON public.configuracoes_sistema;
CREATE POLICY "configuracoes_sistema_select" ON public.configuracoes_sistema
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "configuracoes_sistema_insert" ON public.configuracoes_sistema;
CREATE POLICY "configuracoes_sistema_insert" ON public.configuracoes_sistema
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "configuracoes_sistema_update" ON public.configuracoes_sistema;
CREATE POLICY "configuracoes_sistema_update" ON public.configuracoes_sistema
  FOR UPDATE WITH CHECK (true);

ALTER TABLE public.configuracoes_sistema REPLICA IDENTITY FULL;
