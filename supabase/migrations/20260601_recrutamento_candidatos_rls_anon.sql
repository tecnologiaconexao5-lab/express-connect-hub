-- Migration: Permitir role 'anon' nas policies de recrutamento_candidatos
-- Motivo: App usa Supabase anon key (sem auth session), precisa de INSERT/UPDATE/SELECT/DELETE publicos
-- Causa raiz: policies originais exigiam auth.role()='authenticated', bloqueando anon

-- ========== 1. DIAGNOSTICO (rodar ANTES de aplicar) ==========
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'recrutamento_candidatos';
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_candidatos';

-- ========== 2. DROP policies antigas ==========
DROP POLICY IF EXISTS "recrutamento_candidatos_select" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_insert" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_update" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_delete" ON public.recrutamento_candidatos;

-- ========== 3. Recriar com TO anon, authenticated (explicito) ==========
CREATE POLICY "recrutamento_candidatos_select" ON public.recrutamento_candidatos
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "recrutamento_candidatos_insert" ON public.recrutamento_candidatos
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "recrutamento_candidatos_update" ON public.recrutamento_candidatos
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "recrutamento_candidatos_delete" ON public.recrutamento_candidatos
  FOR DELETE TO anon, authenticated
  USING (true);

-- ========== 4. VERIFICACAO (rodar DEPOIS de aplicar) ==========
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_candidatos' ORDER BY policyname;
