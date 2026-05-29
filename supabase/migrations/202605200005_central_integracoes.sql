-- Cria tabela de configurações da Central de Integrações caso não exista.
CREATE TABLE IF NOT EXISTS public.central_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL UNIQUE,
  ambiente text NOT NULL,
  status text NOT NULL,
  url_publica text,
  webhook_url text,
  observacoes text,
  ultimo_teste_em timestamptz,
  ultimo_erro text,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.central_integracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_integracoes_select" ON public.central_integracoes;
CREATE POLICY "central_integracoes_select" ON public.central_integracoes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "central_integracoes_insert" ON public.central_integracoes;
CREATE POLICY "central_integracoes_insert" ON public.central_integracoes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "central_integracoes_update" ON public.central_integracoes;
CREATE POLICY "central_integracoes_update" ON public.central_integracoes
  FOR UPDATE WITH CHECK (true);

ALTER TABLE public.central_integracoes REPLICA IDENTITY FULL;
