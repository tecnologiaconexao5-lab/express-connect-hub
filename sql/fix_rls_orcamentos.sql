-- ================================================================
-- CORREÇÃO RLS - ORCAMENTOS
-- Executar no Supabase SQL Editor
-- ================================================================

-- 1. Verificar policies existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'orcamentos';

-- 2. Dropar policies restritivas existentes (se houver)
DROP POLICY IF EXISTS "Restrict insert orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Restrict all orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Allow insert anon orcamentos" ON public.orcamentos;

-- 3. Criar policy permissiva para INSERT (testes/automacao)
CREATE POLICY "Allow insert orcamentos for anon"
ON public.orcamentos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 4. Criar policy permissiva para SELECT
CREATE POLICY "Allow select orcamentos for anon"
ON public.orcamentos
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Criar policy permissiva para UPDATE
CREATE POLICY "Allow update orcamentos for anon"
ON public.orcamentos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 6. Verificar se RLS está habilitado
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- 7. Verificar resultado
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'orcamentos';