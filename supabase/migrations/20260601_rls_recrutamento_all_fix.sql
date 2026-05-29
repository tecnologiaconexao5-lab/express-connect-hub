-- ============================================================
-- SCRIPT UNICO: Corrigir RLS para as 3 tabelas de recrutamento
-- Projeto: uwrvzsjtpgaifkktpepn.supabase.co
-- Motivo: App usa anon key, policies originais exigiam authenticated
-- Rodar: Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ========== DIAGNOSTICO ANTES ==========
SELECT '=== ANTES: recrutamento_candidatos ===' AS info;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_candidatos' ORDER BY policyname;

SELECT '=== ANTES: recrutamento_operacoes ===' AS info;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_operacoes' ORDER BY policyname;

SELECT '=== ANTES: recrutamento_prestadores ===' AS info;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_prestadores' ORDER BY policyname;

-- ============================================================
-- recrutamento_candidatos
-- ============================================================
ALTER TABLE public.recrutamento_candidatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recrutamento_candidatos_select" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_insert" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_update" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_delete" ON public.recrutamento_candidatos;

CREATE POLICY "recrutamento_candidatos_select" ON public.recrutamento_candidatos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "recrutamento_candidatos_insert" ON public.recrutamento_candidatos
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "recrutamento_candidatos_update" ON public.recrutamento_candidatos
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "recrutamento_candidatos_delete" ON public.recrutamento_candidatos
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- recrutamento_operacoes
-- ============================================================
ALTER TABLE public.recrutamento_operacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recrutamento_operacoes_select" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_insert" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_update" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_delete" ON public.recrutamento_operacoes;

CREATE POLICY "recrutamento_operacoes_select" ON public.recrutamento_operacoes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "recrutamento_operacoes_insert" ON public.recrutamento_operacoes
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "recrutamento_operacoes_update" ON public.recrutamento_operacoes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "recrutamento_operacoes_delete" ON public.recrutamento_operacoes
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- recrutamento_prestadores
-- ============================================================
ALTER TABLE public.recrutamento_prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recrutamento_prestadores_select" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_insert" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_update" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_delete" ON public.recrutamento_prestadores;

CREATE POLICY "recrutamento_prestadores_select" ON public.recrutamento_prestadores
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "recrutamento_prestadores_insert" ON public.recrutamento_prestadores
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "recrutamento_prestadores_update" ON public.recrutamento_prestadores
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "recrutamento_prestadores_delete" ON public.recrutamento_prestadores
  FOR DELETE TO anon, authenticated USING (true);

-- ========== DIAGNOSTICO DEPOIS ==========
SELECT '=== DEPOIS: recrutamento_candidatos ===' AS info;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_candidatos' ORDER BY policyname;

SELECT '=== DEPOIS: recrutamento_operacoes ===' AS info;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_operacoes' ORDER BY policyname;

SELECT '=== DEPOIS: recrutamento_prestadores ===' AS info;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'recrutamento_prestadores' ORDER BY policyname;

-- ========== TESTE INSERCAO DIRETA ==========
-- Descomente para testar insercao anon:
-- INSERT INTO recrutamento_operacoes (nome, cliente, regiao, status) VALUES ('TESTE_RLS', 'TESTE', 'TESTE', 'aberta');
-- SELECT * FROM recrutamento_operacoes WHERE nome = 'TESTE_RLS';
-- DELETE FROM recrutamento_operacoes WHERE nome = 'TESTE_RLS';