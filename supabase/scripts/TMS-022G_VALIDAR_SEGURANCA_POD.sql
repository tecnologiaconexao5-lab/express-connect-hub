-- ============================================================================
-- TMS-022G — VALIDAÇÃO READ-ONLY PÓS-SEGURANÇA POD
-- Executar APÓS TMS-022F_SEGURANCA_POD_INCREMENTAL.sql
-- Um único resultset. Read-only.
-- ============================================================================
SELECT 'anon delivery_proofs'::text AS item,
    has_table_privilege('anon','public.delivery_proofs','SELECT')::text AS sel,
    has_table_privilege('anon','public.delivery_proofs','INSERT')::text AS ins,
    has_table_privilege('anon','public.delivery_proofs','UPDATE')::text AS upd,
    has_table_privilege('anon','public.delivery_proofs','DELETE')::text AS del,
    'Esperado: false false false false' AS esperado
UNION ALL
SELECT 'anon entregas_protocolo',
    has_table_privilege('anon','public.entregas_protocolo','SELECT')::text,
    has_table_privilege('anon','public.entregas_protocolo','INSERT')::text,
    has_table_privilege('anon','public.entregas_protocolo','UPDATE')::text,
    has_table_privilege('anon','public.entregas_protocolo','DELETE')::text,
    'Esperado: false false false false'
UNION ALL
SELECT 'auth delivery_proofs',
    has_table_privilege('authenticated','public.delivery_proofs','SELECT')::text,
    has_table_privilege('authenticated','public.delivery_proofs','INSERT')::text,
    has_table_privilege('authenticated','public.delivery_proofs','UPDATE')::text,
    has_table_privilege('authenticated','public.delivery_proofs','DELETE')::text,
    'Esperado: true true false false (SELECT+INSERT OK, UPDATE+DELETE bloqueado)'
UNION ALL
SELECT 'auth entregas_protocolo',
    has_table_privilege('authenticated','public.entregas_protocolo','SELECT')::text,
    has_table_privilege('authenticated','public.entregas_protocolo','INSERT')::text,
    has_table_privilege('authenticated','public.entregas_protocolo','UPDATE')::text,
    has_table_privilege('authenticated','public.entregas_protocolo','DELETE')::text,
    'Esperado: true false false false (SELECT OK, INSERT+UPDATE+DELETE bloqueado)'
UNION ALL
SELECT 'service_role entregas_protocolo',
    has_table_privilege('service_role','public.entregas_protocolo','SELECT')::text,
    has_table_privilege('service_role','public.entregas_protocolo','INSERT')::text,
    has_table_privilege('service_role','public.entregas_protocolo','UPDATE')::text,
    has_table_privilege('service_role','public.entregas_protocolo','DELETE')::text,
    'Esperado: true true true true (service_role ALL)'
UNION ALL
SELECT 'postgres entregas_protocolo',
    has_table_privilege('postgres','public.entregas_protocolo','SELECT')::text,
    has_table_privilege('postgres','public.entregas_protocolo','INSERT')::text,
    has_table_privilege('postgres','public.entregas_protocolo','UPDATE')::text,
    has_table_privilege('postgres','public.entregas_protocolo','DELETE')::text,
    'Esperado: true true true true (postgres ALL)'
UNION ALL
SELECT 'RLS delivery_proofs',
    CASE WHEN relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO' END, '', '', '',
    'Esperado: HABILITADO'
FROM pg_class WHERE relname='delivery_proofs' AND relnamespace='public'::regnamespace
UNION ALL
SELECT 'RLS entregas_protocolo',
    CASE WHEN relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO' END, '', '', '',
    'Esperado: HABILITADO'
FROM pg_class WHERE relname='entregas_protocolo' AND relnamespace='public'::regnamespace
UNION ALL
SELECT 'policy dp_insert_authenticated',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='delivery_proofs' AND policyname='dp_insert_authenticated')
         THEN 'EXISTE' ELSE 'AUSENTE' END, '', '', '',
    'Esperado: EXISTE (INSERT TO authenticated)'
UNION ALL
SELECT 'policy dp_select_own',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='delivery_proofs' AND policyname='dp_select_own')
         THEN 'EXISTE' ELSE 'AUSENTE' END, '', '', '',
    'Esperado: EXISTE (SELECT TO authenticated, driver_id = auth.uid()::text)'
UNION ALL
SELECT 'policy "Anon insert protocolo" (deve estar ausente)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='entregas_protocolo' AND policyname='Anon insert protocolo')
         THEN 'AINDA EXISTE' ELSE 'AUSENTE (OK)' END, '', '', '',
    'Esperado: AUSENTE (OK)'
UNION ALL
SELECT 'trigger trg_sync_delivery_proof_to_entregas',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid
         WHERE tg.tgname='trg_sync_delivery_proof_to_entregas' AND cl.relname='delivery_proofs')
         THEN 'EXISTE' ELSE 'AUSENTE' END, '', '', '',
    'Esperado: EXISTE (preservado)'
UNION ALL
SELECT 'funcao f_sync_delivery_proof_to_entregas',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas' AND pronamespace='public'::regnamespace)
         THEN 'EXISTE' ELSE 'AUSENTE' END, '', '', '',
    'Esperado: EXISTE (preservada)'
ORDER BY item;
