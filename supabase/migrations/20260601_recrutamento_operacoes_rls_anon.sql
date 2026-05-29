-- Migration: Permitir role 'anon' nas policies de recrutamento_operacoes
-- Motivo: App usa Supabase anon key (sem auth session), precisa de INSERT/UPDATE/SELECT/DELETE publicos
-- Causa raiz: policies originais exigiam auth.role()='authenticated', bloqueando anon

-- ========== 1. DIAGNOSTICO (rodar ANTES de aplicar) ==========
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'recrutamento_operacoes';
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_operacoes';

-- ========== 2. DROP policies antigas ==========
DROP POLICY IF EXISTS "recrutamento_operacoes_select" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_insert" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_update" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_delete" ON public.recrutamento_operacoes;

-- ========== 3. Recriar com TO anon, authenticated (explicito) ==========
CREATE POLICY "recrutamento_operacoes_select" ON public.recrutamento_operacoes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "recrutamento_operacoes_insert" ON public.recrutamento_operacoes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "recrutamento_operacoes_update" ON public.recrutamento_operacoes
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "recrutamento_operacoes_delete" ON public.recrutamento_operacoes
  FOR DELETE TO anon, authenticated
  USING (true);

-- ========== 4. VERIFICACAO (rodar DEPOIS de aplicar) ==========
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_operacoes' ORDER BY policyname;
