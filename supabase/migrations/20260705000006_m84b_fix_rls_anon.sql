-- M84b: Fix RLS policies for anon access (consistente com outras tabelas)
-- As tabelas já existem (criadas na M84), mas as policies de anon não

DO $$ BEGIN
  -- Drop existing policies to recreate
  DROP POLICY IF EXISTS "rede_oportunidades_all_authenticated" ON public.rede_oportunidades;
  DROP POLICY IF EXISTS "rede_oportunidades_select_anon" ON public.rede_oportunidades;
  DROP POLICY IF EXISTS "rede_visualizacoes_all_authenticated" ON public.rede_visualizacoes;
  DROP POLICY IF EXISTS "rede_visualizacoes_select_anon" ON public.rede_visualizacoes;
END $$;

-- Authenticated: full access
CREATE POLICY "rede_oportunidades_all_authenticated" ON public.rede_oportunidades
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "rede_visualizacoes_all_authenticated" ON public.rede_visualizacoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon: full access (consistente com ordens_servico, prestadores e demais tabelas)
CREATE POLICY "rede_oportunidades_all_anon" ON public.rede_oportunidades
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "rede_visualizacoes_all_anon" ON public.rede_visualizacoes
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
