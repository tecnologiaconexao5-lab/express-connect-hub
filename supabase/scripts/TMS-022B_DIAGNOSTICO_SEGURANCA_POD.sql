-- ============================================================================
-- TMS-022B — DIAGNÓSTICO DE SEGURANÇA DO POD (CORRIGIDO)
-- Policies, grants e privilégios — único resultset
-- Nenhuma escrita. Nenhuma alteração.
-- ============================================================================

-- 1. POLICIES DE entregas_protocolo
SELECT '1. Policies entregas_protocolo'::text AS secao,
       policyname::text, cmd::text, roles::text,
       COALESCE(qual::text, '') AS using_expr,
       COALESCE(with_check::text, '') AS with_check_expr,
       '', '', '', ''
FROM pg_policies WHERE tablename = 'entregas_protocolo' AND schemaname = 'public'

UNION ALL

-- 2. POLICIES DE delivery_proofs
SELECT '2. Policies delivery_proofs', policyname::text, cmd::text, roles::text,
       COALESCE(qual::text, ''), COALESCE(with_check::text, ''), '', '', '', ''
FROM pg_policies WHERE tablename = 'delivery_proofs' AND schemaname = 'public'

UNION ALL

-- 3. GRANTS DE entregas_protocolo
SELECT '3. Grants entregas_protocolo',
       grantee::text, privilege_type::text, table_name::text,
       is_grantable::text, '', '', '', '', ''
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'

UNION ALL

-- 4. GRANTS DE delivery_proofs
SELECT '4. Grants delivery_proofs',
       grantee::text, privilege_type::text, table_name::text,
       is_grantable::text, '', '', '', '', ''
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'delivery_proofs'

UNION ALL

-- 5. PRIVILÉGIOS EFETIVOS (todas as 4 roles × 2 tabelas)
SELECT '5. Privilegios efetivos',
       r.role_name::text,
       t.tabela::text,
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'SELECT') THEN 'SELECT OK' ELSE 'SELECT BLOQUEADO' END,
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'INSERT') THEN 'INSERT OK' ELSE 'INSERT BLOQUEADO' END,
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'UPDATE') THEN 'UPDATE OK' ELSE 'UPDATE BLOQUEADO' END,
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'DELETE') THEN 'DELETE OK' ELSE 'DELETE BLOQUEADO' END,
       '', '', ''
FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) AS r(role_name)
CROSS JOIN (VALUES ('entregas_protocolo'), ('delivery_proofs')) AS t(tabela)

UNION ALL

-- 6. RLS STATUS
SELECT '6. RLS',
       relname::text,
       CASE WHEN relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO' END,
       '', '', '', '', '', '', ''
FROM pg_class WHERE relname IN ('entregas_protocolo', 'delivery_proofs') AND relnamespace = 'public'::regnamespace

UNION ALL

-- 7. RESUMO
SELECT '7. Resumo',
       COUNT(*)::text || ' policies em entregas_protocolo',
       '', '', '', '', '', '', '', ''
FROM pg_policies WHERE tablename = 'entregas_protocolo' AND schemaname = 'public'
UNION ALL
SELECT '7. Resumo',
       COUNT(*)::text || ' policies em delivery_proofs',
       '', '', '', '', '', '', '', ''
FROM pg_policies WHERE tablename = 'delivery_proofs' AND schemaname = 'public'
UNION ALL
SELECT '7. Resumo',
       COUNT(*)::text || ' grants em entregas_protocolo',
       '', '', '', '', '', '', '', ''
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'
UNION ALL
SELECT '7. Resumo',
       COUNT(*)::text || ' grants em delivery_proofs',
       '', '', '', '', '', '', '', ''
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'delivery_proofs';
