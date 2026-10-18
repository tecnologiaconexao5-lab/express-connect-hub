-- =============================================================================
-- TMS-022H — CORRIGIR INSERT AUTH EM entregas_protocolo
-- Causa: TMS-022F revogou UPDATE/DELETE de authenticated mas não revogou INSERT
--        GRANT INSERT original (M108C1) permaneceu ativo
--
-- Correção: REVOKE INSERT + remover policy INSERT obsoleta
-- =============================================================================

-- ============================================================================
-- PRECHECK
-- ============================================================================
DO $$ BEGIN
    IF to_regclass('public.entregas_protocolo') IS NULL THEN
        RAISE EXCEPTION 'ABORTANDO: entregas_protocolo nao existe.';
    END IF;
END $$;

-- ============================================================================
-- 1. REVOKE INSERT de authenticated (nivel de tabela)
-- ============================================================================
-- O GRANT original de M108C1 concedeu INSERT a authenticated.
-- TMS-022F revogou UPDATE/DELETE mas nao revogou INSERT.
-- Correcao: revogar INSERT explicitamente.
REVOKE INSERT ON TABLE public.entregas_protocolo FROM authenticated;

-- ============================================================================
-- 2. REMOVER policy INSERT (defense-in-depth)
-- ============================================================================
-- A policy "entregas_protocolo_insert_authenticated" (M108C1) permite INSERT.
-- Mesmo com REVOKE no nivel de tabela, remove-la evita confusao futura.
DROP POLICY IF EXISTS "entregas_protocolo_insert_authenticated" ON public.entregas_protocolo;

-- ============================================================================
-- PÓS-VALIDAÇÃO
-- ============================================================================
SELECT '=== POS-VALIDACAO ==='::text AS etapa;

SELECT 'auth INSERT'::text AS item,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','INSERT') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: OK (INSERT bloqueado)' AS resultado_esperado
UNION ALL
SELECT 'auth SELECT',
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','SELECT') THEN 'OK' ELSE 'FALHA' END,
       'Esperado: OK (SELECT preservado)'
UNION ALL
SELECT 'auth UPDATE',
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','UPDATE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: OK (UPDATE bloqueado)'
UNION ALL
SELECT 'auth DELETE',
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','DELETE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: OK (DELETE bloqueado)'
UNION ALL
SELECT 'policy entregas_protocolo_insert_authenticated',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='entregas_protocolo' AND policyname='entregas_protocolo_insert_authenticated')
            THEN 'FALHA: AINDA EXISTE' ELSE 'OK: REMOVIDA' END,
       'Esperado: OK: REMOVIDA';
