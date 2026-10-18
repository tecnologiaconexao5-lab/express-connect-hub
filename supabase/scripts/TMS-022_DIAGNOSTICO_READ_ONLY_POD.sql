-- ============================================================================
-- TMS-022 — DIAGNÓSTICO READ-ONLY POD
-- Verifica se migration M108C1 foi aplicada e estado atual das tabelas
-- Único conjunto de resultados (UNION ALL)
-- Nenhuma escrita. Nenhuma alteração.
-- ============================================================================

-- 1. FUNÇÃO DE SINCRONIZAÇÃO EXISTE?
SELECT '1. Função f_sync_delivery_proof_to_entregas' AS teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'f_sync_delivery_proof_to_entregas' AND pronamespace = 'public'::regnamespace)
            THEN 'EXISTE' ELSE 'AUSENTE' END AS resultado,
       (SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.proname = 'f_sync_delivery_proof_to_entregas' AND p.pronamespace = 'public'::regnamespace)::text AS detalhes

UNION ALL

-- 2. TRIGGER DE SINCRONIZAÇÃO EXISTE?
SELECT '2. Trigger trg_sync_delivery_proof_to_entregas' AS teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid = cl.oid JOIN pg_namespace ns ON cl.relnamespace = ns.oid WHERE tg.tgname = 'trg_sync_delivery_proof_to_entregas' AND cl.relname = 'delivery_proofs' AND ns.nspname = 'public' AND NOT tg.tgisinternal)
            THEN 'EXISTE' ELSE 'AUSENTE' END AS resultado,
       'Tabela: delivery_proofs | Dispara em: AFTER INSERT' AS detalhes

UNION ALL

-- 3. TABELA delivery_proofs EXISTE?
SELECT '3. Tabela delivery_proofs' AS teste,
       CASE WHEN to_regclass('public.delivery_proofs') IS NOT NULL THEN 'EXISTE' ELSE 'AUSENTE' END AS resultado,
       to_regclass('public.delivery_proofs')::text AS detalhes

UNION ALL

-- 4. TABELA entregas_protocolo EXISTE?
SELECT '4. Tabela entregas_protocolo' AS teste,
       CASE WHEN to_regclass('public.entregas_protocolo') IS NOT NULL THEN 'EXISTE' ELSE 'AUSENTE' END AS resultado,
       to_regclass('public.entregas_protocolo')::text AS detalhes

UNION ALL

-- 5. COLUNAS DE entregas_protocolo
SELECT '5. Colunas entregas_protocolo' AS teste,
       COUNT(*)::text || ' colunas' AS resultado,
       STRING_AGG(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) AS detalhes
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'

UNION ALL

-- 6. COLUNAS DE delivery_proofs
SELECT '6. Colunas delivery_proofs' AS teste,
       COUNT(*)::text || ' colunas' AS resultado,
       STRING_AGG(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) AS detalhes
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'delivery_proofs'

UNION ALL

-- 7. COLUNAS FALTANTES EM entregas_protocolo (que existem em delivery_proofs)
-- (Campos do app que não teriam destino na tabela oficial)
SELECT '7. Colunas delivery_proofs sem par em entregas_protocolo' AS teste,
       COUNT(*)::text AS resultado,
       STRING_AGG(d.column_name, ', ') AS detalhes
FROM information_schema.columns d
LEFT JOIN information_schema.columns e ON e.table_schema = 'public' AND e.table_name = 'entregas_protocolo'
    AND LOWER(REPLACE(REPLACE(d.column_name, '_name', '_recebedor'), 'driver_id', 'prestador_id')) = LOWER(e.column_name)
    OR d.column_name = REPLACE(e.column_name, 'nome_recebedor', 'receiver_name')
    OR d.column_name = REPLACE(e.column_name, 'observacao', 'observation')
    OR d.column_name = REPLACE(e.column_name, 'foto_entrega_url', 'photo_url')
    OR d.column_name = REPLACE(e.column_name, 'assinatura_url', 'signature_url')
    OR d.column_name = REPLACE(e.column_name, 'documento_recebedor', 'receiver_document')
    OR d.column_name = REPLACE(e.column_name, 'data_hora_entrega', 'delivered_at')
WHERE d.table_schema = 'public' AND d.table_name = 'delivery_proofs'
  AND e.column_name IS NULL
  AND d.column_name NOT IN ('id', 'created_at', 'updated_at')

UNION ALL

-- 8. REGISTROS EM delivery_proofs
SELECT '8. Registros em delivery_proofs' AS teste,
       COUNT(*)::text AS resultado,
       'Total de registros na tabela' AS detalhes
FROM public.delivery_proofs

UNION ALL

-- 9. REGISTROS EM entregas_protocolo
SELECT '9. Registros em entregas_protocolo' AS teste,
       COUNT(*)::text AS resultado,
       'Total de registros na tabela' AS detalhes
FROM public.entregas_protocolo

UNION ALL

-- 10. REGISTROS COM ALOCACAO_ID CORRESPONDENTE (POD já sincronizados)
SELECT '10. Registros com alocacao_id correspondente' AS teste,
       COUNT(*)::text AS resultado,
       'Registros em entregas_protocolo vinculados a alocacoes_escala existentes' AS detalhes
FROM public.entregas_protocolo ep
WHERE EXISTS (SELECT 1 FROM public.alocacoes_escala ae WHERE ae.id = ep.alocacao_id)

UNION ALL

-- 11. DELIVERY_PROOFS SEM CORRESPONDÊNCIA EM entregas_protocolO
SELECT '11. delivery_proofs sem correspondência' AS teste,
       COUNT(*)::text AS resultado,
       'Registros em delivery_proofs sem alocacao_id correspondente em entregas_protocolo' AS detalhes
FROM public.delivery_proofs dp
WHERE NOT EXISTS (SELECT 1 FROM public.entregas_protocolo ep WHERE ep.alocacao_id = dp.operation_id::uuid AND dp.operation_id IS NOT NULL)

UNION ALL

-- 12. POSSÍVEIS DUPLICATAS EM entregas_protocolo (mesmo alocacao_id)
SELECT '12. Possíveis duplicatas em entregas_protocolo' AS teste,
       COUNT(*)::text AS resultado,
       'Registros com alocacao_id duplicado (potencial duplicidade)' AS detalhes
FROM (SELECT alocacao_id, COUNT(*) as cnt FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL GROUP BY alocacao_id HAVING COUNT(*) > 1) dup

UNION ALL

-- 13. IDEMPOTÊNCIA — Existe unique constraint em (alocacao_id)?
SELECT '13. Unique constraint alocacao_id' AS teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.entregas_protocolo'::regclass AND contype = 'u' AND conkey::text LIKE '%' || (SELECT a.attnum::text FROM pg_attribute a WHERE a.attrelid = 'public.entregas_protocolo'::regclass AND a.attname = 'alocacao_id') || '%')
            THEN 'EXISTE' ELSE 'AUSENTE (ON CONFLICT no trigger)' END AS resultado,
       'Chave de idempotência do trigger: alocacao_id' AS detalhes

UNION ALL

-- 14. POLICIES DE RLS — entregas_protocolo
SELECT '14. RLS policies entregas_protocolo' AS teste,
       COUNT(*)::text AS resultado,
       STRING_AGG(policyname || ' (' || cmd || ')', ', ') AS detalhes
FROM pg_policies WHERE tablename = 'entregas_protocolo' AND schemaname = 'public'

UNION ALL

-- 15. GRANTS — entregas_protocolo
SELECT '15. Grants entregas_protocolo' AS teste,
       COUNT(*)::text AS resultado,
       STRING_AGG(grantee || ':' || privilege_type, ', ' ORDER BY grantee) AS detalhes
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'

UNION ALL

-- 16. COLUNA receiver_relationship (M108C1) — indicador se migration foi aplicada
SELECT '16. Coluna receiver_relationship (M108C1)' AS teste,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entregas_protocolo' AND column_name = 'receiver_relationship')
            THEN 'EXISTE' ELSE 'AUSENTE' END AS resultado,
       'Marcador: se existir, M108C1 foi parcialmente aplicada' AS detalhes

UNION ALL

-- 17. COLUNA gps_accuracy (M108C1)
SELECT '17. Coluna gps_accuracy (M108C1)' AS teste,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entregas_protocolo' AND column_name = 'gps_accuracy')
            THEN 'EXISTE' ELSE 'AUSENTE' END AS resultado,
       'Marcador: se existir, M108C1 foi parcialmente aplicada' AS detalhes

ORDER BY teste;
