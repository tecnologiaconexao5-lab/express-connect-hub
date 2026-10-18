-- ============================================================================
-- TMS-019D — AUDITORIA DE PERMISSÕES DO CHECKPOINT
-- Diagnóstico: por que anon/authenticated = TRUE mesmo com REVOKE?
-- Nenhuma escrita. Nenhuma alteração.
-- Data: 2026-07-29
-- ============================================================================

-- 1. ACL CRUA (pg_class.relacl)
-- Mostra exatamente quem tem o quê na tabela, sem interpretação.
SELECT
    '1. ACL bruta (relacl)' AS teste,
    relacl::text AS acl
FROM pg_class
WHERE relname = '_hml_seed_checkpoint'
  AND relnamespace = 'public'::regnamespace;

-- 2. ACL DECOMPOSTA POR LINHA
-- Desempacota cada entrada ACE (Access Control Entry) individualmente.
SELECT
    '2. ACL decomposta' AS teste,
    acl.grantee::text AS grantee,
    acl.privilege_type,
    acl.is_grantable
FROM pg_class c
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
WHERE c.relname = '_hml_seed_checkpoint'
  AND c.relnamespace = 'public'::regnamespace;

-- 3. PRIVILÉGIOS DEFAULT DO SCHEMA public
-- Em Supabase, DEFAULT PRIVILEGES para postgres no schema public
-- costumam conceder SELECT para anon e authenticated automaticamente.
SELECT
    '3. Default privileges' AS teste,
    d.defaclobjtype::text AS objeto,
    d.defaclacl::text AS acl
FROM pg_default_acl d
JOIN pg_namespace n ON d.defaclnamespace = n.oid
WHERE n.nspname = 'public';

-- 4. Verificar se o REVOKE FROM PUBLIC realmente funcionou
-- Compara o ACE de PUBLIC antes/depois (pela ACL atual).
SELECT
    '4. PUBLIC na ACL' AS teste,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_class c
            CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
            WHERE c.relname = '_hml_seed_checkpoint'
              AND c.relnamespace = 'public'::regnamespace
              AND acl.grantee = 0  -- 0 = PUBLIC
        )
        THEN 'PUBLIC tem acesso (REVOKE não funcionou)'
        ELSE 'PUBLIC não tem acesso (REVOKE funcionou)'
    END AS resultado;

-- 5. CADEIA DE HERANÇA
-- anon e authenticated podem herdar privilégios de outras roles?
SELECT
    '5. Herança de roles' AS teste,
    r.rolname AS role,
    r.rolinherit,
    m.roleid::regrole AS member_of
FROM pg_roles r
LEFT JOIN pg_auth_members m ON m.member = r.oid
WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres');

-- 6. PRIVILÉGIO DETALHADO POR OPERAÇÃO
-- has_table_privilege com cada operação separadamente.
SELECT
    '6. Privilégio detalhado' AS teste,
    r.role_name,
    has_table_privilege(r.role_name, 'public._hml_seed_checkpoint', 'SELECT') AS sel,
    has_table_privilege(r.role_name, 'public._hml_seed_checkpoint', 'INSERT') AS ins,
    has_table_privilege(r.role_name, 'public._hml_seed_checkpoint', 'UPDATE') AS upd,
    has_table_privilege(r.role_name, 'public._hml_seed_checkpoint', 'DELETE') AS del
FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres'), ('public')) AS r(role_name);

-- 7. DIAGNÓSTICO
-- Se a ACL mostrar que anon/authenticated têm acesso DIRETO (não via PUBLIC),
-- a causa são DEFAULT PRIVILEGES do Supabase.
-- Se a ACL mostrar que PUBLIC ainda tem acesso, o REVOKE não foi aplicado.
SELECT
    '7. Diagnóstico final' AS teste,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_class c
            CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
            WHERE c.relname = '_hml_seed_checkpoint'
              AND c.relnamespace = 'public'::regnamespace
              AND acl.grantee::text IN ('anon', 'authenticated')
        )
        THEN 'anon/authenticated têm acesso DIRETO (causa: DEFAULT PRIVILEGES do Supabase). '
             'REVOKE FROM PUBLIC não remove privilégios concedidos diretamente.'
        WHEN EXISTS (
            SELECT 1 FROM pg_class c
            CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
            WHERE c.relname = '_hml_seed_checkpoint'
              AND c.relnamespace = 'public'::regnamespace
              AND acl.grantee = 0
        )
        THEN 'PUBLIC ainda tem acesso. REVOKE não foi aplicado ou foi sobrescrito.'
        ELSE 'Sem acesso direto e sem PUBLIC. has_table_privilege() pode ser falso positivo '
             'por herança de schema ou por otimização de cache.'
    END AS conclusao;
