-- ============================================================================
-- TMS-019 — VALIDAÇÃO READ-ONLY DO GATE 1
-- Nenhuma escrita. Nenhuma alteração.
-- Data: 2026-07-29
-- ============================================================================

-- 1. TABELA EXISTE?
SELECT
    '1. Tabela existe' AS teste,
    CASE
        WHEN to_regclass('public._hml_seed_checkpoint') IS NOT NULL
        THEN 'OK'
        ELSE 'FALHA'
    END AS resultado;

-- 2. FUNÇÃO EXISTE?
SELECT
    '2. Função existe' AS teste,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc
            WHERE proname = 'update_hml_seed_checkpoint_updated_at'
              AND pronamespace = 'public'::regnamespace
        )
        THEN 'OK'
        ELSE 'FALHA'
    END AS resultado;

-- 3. TRIGGER EXISTE NA TABELA CORRETA (ignorando triggers internos)?
SELECT
    '3. Trigger existe' AS teste,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_trigger tg
            JOIN pg_class cl ON tg.tgrelid = cl.oid
            JOIN pg_namespace ns ON cl.relnamespace = ns.oid
            WHERE tg.tgname = 'trg_hml_cp_updated_at'
              AND cl.relname = '_hml_seed_checkpoint'
              AND ns.nspname = 'public'
              AND NOT tg.tgisinternal
        )
        THEN 'OK'
        ELSE 'FALHA'
    END AS resultado;

-- 4. ÍNDICES EXISTEM?
SELECT
    '4. Índices' AS teste,
    esperado.indice,
    CASE
        WHEN pi.indexname IS NOT NULL THEN 'OK'
        ELSE 'FALHA'
    END AS resultado
FROM (
    VALUES
        ('idx_hml_cp_marcador'),
        ('idx_hml_cp_status')
) AS esperado(indice)
LEFT JOIN pg_indexes pi
    ON pi.schemaname = 'public'
   AND pi.tablename = '_hml_seed_checkpoint'
   AND pi.indexname = esperado.indice
ORDER BY esperado.indice;

-- 5. COLUNAS + TIPOS + CONSTRAINTS + PK
SELECT
    '5. Schema da tabela' AS teste,
    column_name,
    data_type,
    is_nullable,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '_hml_seed_checkpoint'
ORDER BY ordinal_position;

-- 6. CHECKS DA TABELA
SELECT
    '6. Constraints CHECK' AS teste,
    conname,
    pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public._hml_seed_checkpoint'::regclass
  AND contype = 'c';

-- 7. PRIMARY KEY
SELECT
    '7. Primary Key' AS teste,
    conname,
    pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public._hml_seed_checkpoint'::regclass
  AND contype = 'p';

-- 8A. GRANTS (information_schema)
SELECT
    '8A. Grants (information_schema)' AS teste,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = '_hml_seed_checkpoint'
ORDER BY grantee, privilege_type;

-- 8B. PRIVILÉGIOS EFETIVOS (has_table_privilege)
SELECT
    '8B. Privilégios efetivos' AS teste,
    role_name,
    has_table_privilege(
        role_name,
        'public._hml_seed_checkpoint',
        'SELECT,INSERT,UPDATE,DELETE'
    ) AS possui_privilegios_dml
FROM (
    VALUES
        ('anon'),
        ('authenticated'),
        ('service_role'),
        ('postgres')
) AS roles(role_name);

-- 9. RLS STATUS
SELECT
    '9. RLS' AS teste,
    CASE
        WHEN relrowsecurity THEN 'HABILITADO'
        ELSE 'DESABILITADO'
    END AS rls_status
FROM pg_class
WHERE relname = '_hml_seed_checkpoint'
  AND relnamespace = 'public'::regnamespace;

-- 10. TABELA VAZIA (PRÉ-SEED)?
SELECT
    '10. Tabela vazia (pré-seed)' AS teste,
    COUNT(*) AS registros
FROM public._hml_seed_checkpoint;

-- 11. INVENTÁRIO ATUAL DE TABELAS
-- Esta consulta é apenas informativa e NÃO comprova, isoladamente,
-- que nenhuma tabela de negócio foi alterada.
SELECT
    '11. Inventário atual de tabelas public' AS teste,
    COUNT(*) AS total
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- 12. PRESTADOR TESTE APP — ID E VÍNCULO COM AUTH
SELECT
    '12. Prestador + auth' AS teste,
    p.id AS prestador_id,
    p.nome_completo,
    p.auth_user_id,
    u.email
FROM public.prestadores p
LEFT JOIN auth.users u ON u.id = p.auth_user_id
WHERE p.id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'::uuid;
