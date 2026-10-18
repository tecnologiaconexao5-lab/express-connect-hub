-- ============================================================================
-- TMS-019 GATE 1 — VALIDAÇÃO CONSOLIDADA
-- Único conjunto de resultados (UNION ALL)
-- Nenhuma escrita. Nenhuma alteração.
-- Data: 2026-07-29
-- ============================================================================

SELECT
    '1. Tabela existe' AS teste,
    CASE WHEN to_regclass('public._hml_seed_checkpoint') IS NOT NULL
         THEN 'OK' ELSE 'FALHA' END AS resultado,
    to_regclass('public._hml_seed_checkpoint')::text AS detalhes

UNION ALL

SELECT
    '2. Função existe',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'update_hml_seed_checkpoint_updated_at'
          AND pronamespace = 'public'::regnamespace
    ) THEN 'OK' ELSE 'FALHA' END,
    (SELECT proname FROM pg_proc
     WHERE proname = 'update_hml_seed_checkpoint_updated_at'
       AND pronamespace = 'public'::regnamespace)::text

UNION ALL

SELECT
    '3. Trigger existe',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class cl ON tg.tgrelid = cl.oid
        JOIN pg_namespace ns ON cl.relnamespace = ns.oid
        WHERE tg.tgname = 'trg_hml_cp_updated_at'
          AND cl.relname = '_hml_seed_checkpoint'
          AND ns.nspname = 'public'
          AND NOT tg.tgisinternal
    ) THEN 'OK' ELSE 'FALHA' END,
    (SELECT tg.tgname || ' ON ' || cl.relname
     FROM pg_trigger tg
     JOIN pg_class cl ON tg.tgrelid = cl.oid
     JOIN pg_namespace ns ON cl.relnamespace = ns.oid
     WHERE tg.tgname = 'trg_hml_cp_updated_at'
       AND cl.relname = '_hml_seed_checkpoint'
       AND ns.nspname = 'public'
       AND NOT tg.tgisinternal)::text

UNION ALL

SELECT
    '4. Índices',
    CASE WHEN COUNT(*) = 2 THEN 'OK' ELSE 'Parcial' END,
    'Encontrados: ' || COUNT(*) || ' de 2 (' ||
    STRING_AGG(COALESCE(pi.indexname, esperado.indice || ' (AUSENTE)'), ', ' ORDER BY esperado.indice) || ')'
FROM (VALUES ('idx_hml_cp_marcador'), ('idx_hml_cp_status')) AS esperado(indice)
LEFT JOIN pg_indexes pi
    ON pi.schemaname = 'public'
   AND pi.tablename = '_hml_seed_checkpoint'
   AND pi.indexname = esperado.indice

UNION ALL

SELECT
    '5. RLS',
    CASE WHEN NOT relrowsecurity THEN 'OK (desabilitado)' ELSE 'ATENÇÃO (habilitado)' END,
    'Row Level Security: ' || CASE WHEN relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO' END
FROM pg_class
WHERE relname = '_hml_seed_checkpoint'
  AND relnamespace = 'public'::regnamespace

UNION ALL

SELECT
    '6. Registros checkpoint',
    CASE WHEN COUNT(*) = 0 THEN 'OK (vazia)' ELSE 'ATENÇÃO' END,
    COUNT(*) || ' registro(s) encontrado(s) antes do seed'
FROM public._hml_seed_checkpoint

UNION ALL

SELECT
    '7. Privilégio anon',
    CASE WHEN NOT has_table_privilege('anon', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE')
         THEN 'OK (bloqueado)' ELSE 'FALHA (acesso liberado)' END,
    'anon SELECT/INSERT/UPDATE/DELETE: ' ||
    has_table_privilege('anon', 'public._hml_seed_checkpoint', 'SELECT')::text

UNION ALL

SELECT
    '8. Privilégio authenticated',
    CASE WHEN NOT has_table_privilege('authenticated', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE')
         THEN 'OK (bloqueado)' ELSE 'FALHA (acesso liberado)' END,
    'authenticated SELECT/INSERT/UPDATE/DELETE: ' ||
    has_table_privilege('authenticated', 'public._hml_seed_checkpoint', 'SELECT')::text

UNION ALL

SELECT
    '9. Privilégio service_role',
    CASE WHEN has_table_privilege('service_role', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE')
         THEN 'OK (autorizado)' ELSE 'FALHA (sem acesso)' END,
    'service_role SELECT/INSERT/UPDATE/DELETE: ' ||
    has_table_privilege('service_role', 'public._hml_seed_checkpoint', 'SELECT')::text

UNION ALL

SELECT
    '10. Privilégio postgres',
    CASE WHEN has_table_privilege('postgres', 'public._hml_seed_checkpoint', 'SELECT,INSERT,UPDATE,DELETE')
         THEN 'OK (autorizado)' ELSE 'FALHA (sem acesso)' END,
    'postgres SELECT/INSERT/UPDATE/DELETE: ' ||
    has_table_privilege('postgres', 'public._hml_seed_checkpoint', 'SELECT')::text

UNION ALL

SELECT
    '11. Prestador teste',
    CASE WHEN p.id IS NOT NULL THEN 'OK' ELSE 'FALHA' END,
    'ID: ' || p.id::text || ' | Nome: ' || p.nome_completo
FROM public.prestadores p
WHERE p.id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'::uuid

UNION ALL

SELECT
    '12. E-mail vinculado',
    CASE WHEN u.email IS NOT NULL THEN 'OK' ELSE 'FALHA (sem auth vinculado)' END,
    'Email: ' || COALESCE(u.email, 'NENHUM') || ' | auth_user_id: ' || COALESCE(p.auth_user_id::text, 'NULO')
FROM public.prestadores p
LEFT JOIN auth.users u ON u.id = p.auth_user_id
WHERE p.id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'::uuid

ORDER BY teste;
