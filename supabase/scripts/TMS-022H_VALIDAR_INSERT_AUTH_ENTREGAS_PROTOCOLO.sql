-- ============================================================================
-- TMS-022H — VALIDAÇÃO INSERT AUTH EM entregas_protocolo
-- Confirmar que authenticated não tem INSERT. Único resultset. Read-only.
-- ============================================================================
SELECT 'auth INSERT entregas_protocolo'::text AS item,
       has_table_privilege('authenticated','public.entregas_protocolo','INSERT')::text AS permitido,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','INSERT') THEN 'FALHA' ELSE 'OK' END AS resultado,
       'Esperado: false' AS esperado
UNION ALL
SELECT 'auth SELECT entregas_protocolo',
       has_table_privilege('authenticated','public.entregas_protocolo','SELECT')::text,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','SELECT') THEN 'OK' ELSE 'FALHA' END,
       'Esperado: true'
UNION ALL
SELECT 'auth UPDATE entregas_protocolo',
       has_table_privilege('authenticated','public.entregas_protocolo','UPDATE')::text,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','UPDATE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: false'
UNION ALL
SELECT 'auth DELETE entregas_protocolo',
       has_table_privilege('authenticated','public.entregas_protocolo','DELETE')::text,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','DELETE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: false'
UNION ALL
SELECT 'anon all entregas_protocolo',
       CASE WHEN has_table_privilege('anon','public.entregas_protocolo','SELECT') OR
                 has_table_privilege('anon','public.entregas_protocolo','INSERT') THEN 'TEM ACESSO' ELSE 'BLOQUEADO' END,
       'OK',
       'Esperado: BLOQUEADO'
UNION ALL
SELECT 'service_role entregas_protocolo',
       CASE WHEN has_table_privilege('service_role','public.entregas_protocolo','SELECT') AND
                 has_table_privilege('service_role','public.entregas_protocolo','INSERT') THEN 'ALL OK' ELSE 'FALHA' END,
       'OK',
       'Esperado: ALL OK'
UNION ALL
SELECT 'postgres entregas_protocolo',
       CASE WHEN has_table_privilege('postgres','public.entregas_protocolo','SELECT') AND
                 has_table_privilege('postgres','public.entregas_protocolo','INSERT') THEN 'ALL OK' ELSE 'FALHA' END,
       'OK',
       'Esperado: ALL OK'
UNION ALL
SELECT 'trigger trg_sync_delivery_proof_to_entregas',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid
            WHERE tg.tgname='trg_sync_delivery_proof_to_entregas' AND cl.relname='delivery_proofs')
            THEN 'EXISTE' ELSE 'AUSENTE' END,
       'OK',
       'Esperado: EXISTE'
UNION ALL
SELECT 'funcao f_sync_delivery_proof_to_entregas',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas' AND pronamespace='public'::regnamespace)
            THEN 'EXISTE' ELSE 'AUSENTE' END,
       'OK',
       'Esperado: EXISTE';
