-- ============================================================
-- EXPRESS CONNECT HUB / TMS
-- Script de Ativacao de Super Admin (Multi-Tenant)
-- 
-- INSTRUCOES:
-- 1. Substituir ADMIN_EMAIL_AQUI pelo email real do admin
-- 2. Executar no SQL Editor do Supabase Dashboard
-- 3. Nao expor este script com email real em repositorios
-- 4. O usuario DEVE ter feito login ao menos 1 vez
--
-- SEGURANCA:
-- - NUNCA colocar senha neste script
-- - NUNCA usar service_role_key no frontend
-- - Apenas super_admin pode criar outros super_admins
-- ============================================================

-- ============================================================
-- PASSO 1: Buscar usuario por email em auth.users
-- Se retornar vazio, o usuario nunca fez login.
-- ============================================================
-- Substitua 'ADMIN_EMAIL_AQUI' pelo email real:
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'ADMIN_EMAIL_AQUI';

/*
  RESULTADO ESPERADO:
  id         | um UUID valido (ex: a1b2c3d4-...)
  email      | o email informado
  created_at | data de criacao
*/

-- ============================================================
-- PASSO 2: Vincular usuario ao tenant padrao como super_admin
-- (somente se o usuario existe em auth.users)
-- ============================================================
-- Substitua 'ADMIN_EMAIL_AQUI' pelo email real:
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
SELECT 
  t.id,
  au.id,
  'super_admin',
  'ativo'
FROM tenants t
CROSS JOIN auth.users au
WHERE t.slug = 'conexao-express'
  AND au.email = 'ADMIN_EMAIL_AQUI'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_usuarios tu
    WHERE tu.tenant_id = t.id AND tu.user_id = au.id
  );

-- ============================================================
-- PASSO 3: Verificar o vinculo criado
-- ============================================================
-- Substitua 'ADMIN_EMAIL_AQUI' pelo email real:
SELECT 
  tu.id AS vinculo_id,
  tu.user_id,
  au.email,
  t.nome AS tenant_nome,
  tu.papel,
  tu.status,
  tu.criado_em
FROM tenant_usuarios tu
JOIN tenants t ON t.id = tu.tenant_id
JOIN auth.users au ON au.id = tu.user_id
WHERE au.email = 'ADMIN_EMAIL_AQUI';

-- ============================================================
-- PASSO 4: Validacao final
-- ============================================================
-- Listar todos os super_admins ativos:
SELECT 
  tu.id AS vinculo_id,
  au.email,
  t.nome AS tenant_nome,
  tu.papel,
  tu.status,
  tu.criado_em
FROM tenant_usuarios tu
JOIN tenants t ON t.id = tu.tenant_id
JOIN auth.users au ON au.id = tu.user_id
WHERE tu.papel = 'super_admin' AND tu.status = 'ativo'
ORDER BY tu.criado_em;

-- ============================================================
-- PASSO 5 (opcional): Vincular a outros tenants
-- ============================================================
-- Se o super_admin precisar acessar outros tenants:
/*
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
SELECT 
  t.id,
  au.id,
  'super_admin',
  'ativo'
FROM tenants t
CROSS JOIN auth.users au
WHERE t.slug = 'outro-tenant-slug'
  AND au.email = 'ADMIN_EMAIL_AQUI'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_usuarios tu
    WHERE tu.tenant_id = t.id AND tu.user_id = au.id
  );
*/

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

-- NOTAS:
-- 1. ADMIN_EMAIL_AQUI deve ser substituido antes de executar
-- 2. Se o usuario NAO existir em auth.users, va para /login
--    e faca login 1 vez. Depois repita este script.
-- 3. Se o vinculo ja existir, o INSERT ignora (ON CONFLICT
--    tratado via NOT EXISTS na subquery).
-- 4. Para revogar acesso: UPDATE tenant_usuarios SET status = 'inativo'
