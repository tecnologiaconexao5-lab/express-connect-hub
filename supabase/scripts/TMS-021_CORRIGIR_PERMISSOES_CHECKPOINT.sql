-- =============================================================================
-- TMS-021 — CORRIGIR PERMISSÕES DO CHECKPOINT
-- Remove acesso direto de anon/authenticated à tabela _hml_seed_checkpoint
-- Causa: DEFAULT PRIVILEGES do Supabase concedem SELECT automaticamente
--        a anon/authenticated para toda tabela criada no schema public.
--        REVOKE FROM PUBLIC não remove privilégios concedidos diretamente.
--
-- Idempotente: Pode executar N vezes no SQL Editor.
-- Seguro:     Apenas REVOKE, sem DROP, sem ALTER, sem DELETE.
-- Impacto:    Apenas na tabela _hml_seed_checkpoint.
--             Nenhuma tabela de negócio é alterada.
-- =============================================================================

-- =============================================================================
-- PRÉ-VALIDAÇÃO
-- =============================================================================
SELECT '=== PRÉ-VALIDAÇÃO ===' as info;

SELECT '1. Tabela existe' as teste,
       CASE WHEN to_regclass('public._hml_seed_checkpoint') IS NOT NULL
            THEN 'OK' ELSE 'FALHA' END as resultado;

SELECT '2. Privilégio anon (antes)' as teste,
       has_table_privilege('anon', 'public._hml_seed_checkpoint', 'SELECT') as tem_acesso;

SELECT '3. Privilégio authenticated (antes)' as teste,
       has_table_privilege('authenticated', 'public._hml_seed_checkpoint', 'SELECT') as tem_acesso;

SELECT '4. Privilégio service_role (antes)' as teste,
       has_table_privilege('service_role', 'public._hml_seed_checkpoint', 'SELECT') as tem_acesso;

SELECT '5. Privilégio postgres (antes)' as teste,
       has_table_privilege('postgres', 'public._hml_seed_checkpoint', 'SELECT') as tem_acesso;

-- =============================================================================
-- CORREÇÃO — REVOKE explícito de anon e authenticated
-- =============================================================================
-- Nota técnica:
-- No Supabase, DEFAULT PRIVILEGES para o role postgres no schema public
-- concedem SELECT em toda nova tabela para anon e authenticated.
-- Estes privilégios são DIRETOS (não via PUBLIC).
-- Portanto, REVOKE FROM PUBLIC não os remove — é necessário REVOKE explícito
-- de anon e authenticated individualmente.
--
-- Esta correção NÃO altera DEFAULT PRIVILEGES (ficam intactos).
-- Apenas remove privilégios já concedidos à tabela específica.
-- Próximas tabelas criadas no schema public ainda herdarão os defaults.
-- =============================================================================

REVOKE ALL PRIVILEGES ON TABLE public._hml_seed_checkpoint FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public._hml_seed_checkpoint FROM authenticated;

-- =============================================================================
-- VALIDAÇÃO PÓS-CORREÇÃO
-- =============================================================================
SELECT '=== PÓS-VALIDAÇÃO ===' as info;

SELECT '6. Privilégio anon (depois)' as teste,
       CASE WHEN has_table_privilege('anon', 'public._hml_seed_checkpoint', 'SELECT') = false
            THEN 'OK (bloqueado)' ELSE 'FALHA (ainda tem acesso)' END as resultado;

SELECT '7. Privilégio authenticated (depois)' as teste,
       CASE WHEN has_table_privilege('authenticated', 'public._hml_seed_checkpoint', 'SELECT') = false
            THEN 'OK (bloqueado)' ELSE 'FALHA (ainda tem acesso)' END as resultado;

SELECT '8. Privilégio service_role (depois)' as teste,
       CASE WHEN has_table_privilege('service_role', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE') = true
            THEN 'OK (autorizado)' ELSE 'FALHA (sem acesso)' END as resultado;

SELECT '9. Privilégio postgres (depois)' as teste,
       CASE WHEN has_table_privilege('postgres', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE') = true
            THEN 'OK (autorizado)' ELSE 'FALHA (sem acesso)' END as resultado;

-- =============================================================================
-- RESUMO
-- =============================================================================
SELECT '=== RESUMO ===' as info;
SELECT 'anon'          as role, has_table_privilege('anon',          'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE') as acesso_dml
UNION ALL
SELECT 'authenticated' as role, has_table_privilege('authenticated', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE')
UNION ALL
SELECT 'service_role'  as role, has_table_privilege('service_role',  'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE')
UNION ALL
SELECT 'postgres'      as role, has_table_privilege('postgres',      'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE');
