-- =============================================================================
-- TMS-022F — ROLLBACK SEGURANÇA POD
-- Reverte APENAS grants e policies alterados por TMS-022F_SEGURANCA_POD_INCREMENTAL.sql
-- Não toca dados, triggers, funções ou tabelas.
-- =============================================================================

-- 1. DELIVERY_PROOFS — Restaurar grants e policies ao estado original (M108C1)
GRANT ALL ON TABLE public.delivery_proofs TO anon;
GRANT ALL ON TABLE public.delivery_proofs TO authenticated;

DROP POLICY IF EXISTS "dp_insert_authenticated" ON public.delivery_proofs;
DROP POLICY IF EXISTS "dp_select_own" ON public.delivery_proofs;

-- 2. ENTREGAS_PROTOCOLO — Restaurar grants e policies ao estado original (M108C1)
GRANT ALL ON TABLE public.entregas_protocolo TO anon;
GRANT ALL ON TABLE public.entregas_protocolo TO authenticated;

-- Policy "Anon insert protocolo" — recriar se necessário
DROP POLICY IF EXISTS "Anon insert protocolo" ON public.entregas_protocolo;
CREATE POLICY "Anon insert protocolo" ON public.entregas_protocolo
    FOR INSERT TO public
    WITH CHECK (true);

-- ============================================================================
-- PÓS-VALIDAÇÃO
-- ============================================================================
SELECT '=== POS-ROLLBACK ===' as info;
SELECT 'anon delivery_proofs INSERT' as item,
       CASE WHEN has_table_privilege('anon','public.delivery_proofs','INSERT') THEN 'OK' ELSE 'FALHA' END as status;
SELECT 'anon entregas_protocolo INSERT' as item,
       CASE WHEN has_table_privilege('anon','public.entregas_protocolo','INSERT') THEN 'OK' ELSE 'FALHA' END as status;
SELECT 'policy "Anon insert protocolo"' as item,
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='entregas_protocolo' AND policyname='Anon insert protocolo')
            THEN 'OK' ELSE 'FALHA' END as status;
