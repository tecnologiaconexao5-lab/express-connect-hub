-- =============================================================================
-- EVIDÊNCIA — Consulta SELECT-only em Produção (2026-08-07)
-- Host: aws-1-sa-east-1.pooler.supabase.com
-- Database: postgres (projeto uwrvzsjtpgaifkktpepn)
-- Contexto: Auditoria RLS alocacoes_escala — Alternativa 0
-- =============================================================================

-- 1. POLICIES ATIVAS
SELECT policyname, roles, cmd,
  left(qual::text, 160) as qual,
  left(with_check::text, 80) as wc
FROM pg_policies
WHERE tablename = 'alocacoes_escala'
ORDER BY policyname;

-- Resultado (6 policies):
--   "Prestador can update own alocacoes"   {authenticated} UPDATE (prestador check)
--   "Prestador can view own alocacoes"     {authenticated} SELECT (prestador check)
--   "alocacoes_escala_insert_anon"         {public}        INSERT qual:null wc:true
--   "alocacoes_escala_select_anon"         {public}        SELECT qual:true
--   "alocacoes_escala_update_anon"         {public}        UPDATE qual:true wc:true
--   "alocacoes_escala_update_authenticated"{public}        UPDATE qual:auth.role() check


-- 2. GRANTS POR ROLE
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'alocacoes_escala'
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- Resultado chave:
--   anon → SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   authenticated → INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   postgres → (all)
--   service_role → (all)


-- 3. FUNÇÃO f_obter_cliente_id_do_usuario
SELECT pg_get_functiondef(oid) as def
FROM pg_proc
WHERE proname = 'f_obter_cliente_id_do_usuario'
  AND pronamespace = 'public'::regnamespace;

-- Resultado: SECURITY DEFINER, sem search_path explícito
--   Primeiro tenta usuarios_cliente.auth_user_id = auth.uid()
--   Depois fallback via clientes.tenant_id + tenant_usuarios.user_id


-- 4. GRANTS DA FUNÇÃO
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'f_obter_cliente_id_do_usuario'
  AND routine_schema = 'public';

-- Resultado: PUBLIC, anon, authenticated, service_role, postgres — todos EXECUTE


-- 5. DISTRIBUIÇÃO tenant_id EM alocacoes_escala
SELECT COUNT(*) as total,
       COUNT(tenant_id) as with_tenant,
       COUNT(*) - COUNT(tenant_id) as null_tenant
FROM public.alocacoes_escala;

-- Resultado: 176 total, 176 com tenant_id, 0 null


-- 6. POLICIES PRESTADOR — EXISTEM?
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'alocacoes_escala'
  AND policyname LIKE '%Prestador%';

-- Resultado: 2 encontradas
