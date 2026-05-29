-- Migration: Permitir role 'anon' nas policies de recrutamento_prestadores
-- Motivo: App usa Supabase anon key (sem auth session), precisa de INSERT/UPDATE/SELECT/DELETE publicos
-- Causa raiz: policies originais exigiam auth.role()='authenticated', bloqueando anon

-- ========== 1. DIAGNOSTICO (rodar ANTES de aplicar) ==========
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'recrutamento_prestadores';
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_prestadores';

-- ========== 2. DROP policies antigas ==========
DROP POLICY IF EXISTS "recrutamento_prestadores_select" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_insert" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_update" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_delete" ON public.recrutamento_prestadores;

-- ========== 3. Recriar com TO anon, authenticated (explicito) ==========
CREATE POLICY "recrutamento_prestadores_select" ON public.recrutamento_prestadores
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "recrutamento_prestadores_insert" ON public.recrutamento_prestadores
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "recrutamento_prestadores_update" ON public.recrutamento_prestadores
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "recrutamento_prestadores_delete" ON public.recrutamento_prestadores
  FOR DELETE TO anon, authenticated
  USING (true);

-- ========== 4. VERIFICACAO (rodar DEPOIS de aplicar) ==========
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_prestadores' ORDER BY policyname;
