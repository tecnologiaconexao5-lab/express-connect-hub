-- ============================================================================
-- TMS-022B — VALIDAR SINCRONIZAÇÃO POD (CORRIGIDO)
-- Lado a lado: delivery_proofs × entregas_protocolo
-- Único resultset. Read-only.
-- ============================================================================

-- 1. LADO A LADO: delivery_proofs + entregas_protocolo
SELECT
    '1. Origem x Destino'::text AS secao,
    dp.id::text AS delivery_proof_id,
    COALESCE(ep.id::text, '(sem destino)') AS entregas_protocolo_id,
    dp.operation_id::text,
    COALESCE(ep.alocacao_id::text, '') AS alocacao_id,
    COALESCE(dp.receiver_name, '')::text AS rec_nome_origem,
    COALESCE(ep.nome_recebedor, '')::text AS rec_nome_destino,
    COALESCE(dp.receiver_document, '')::text AS rec_doc_origem,
    COALESCE(ep.documento_recebedor, '')::text AS rec_doc_destino,
    dp.status::text AS status_origem,
    COALESCE(ep.status, '')::text AS status_destino,
    COALESCE(dp.photo_url, '')::text AS foto_origem,
    COALESCE(ep.foto_entrega_url, '')::text AS foto_destino,
    COALESCE(dp.signature_url, '')::text AS assinatura_origem,
    COALESCE(ep.assinatura_url, '')::text AS assinatura_destino,
    COALESCE(dp.latitude::text, '')::text AS lat_origem,
    COALESCE(ep.latitude::text, '')::text AS lat_destino,
    COALESCE(dp.longitude::text, '')::text AS lng_origem,
    COALESCE(ep.longitude::text, '')::text AS lng_destino,
    dp.created_at::text AS criado_origem,
    COALESCE(ep.created_at::text, '') AS criado_destino,
    CASE WHEN ep.created_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (ep.created_at - dp.created_at))::numeric(10,3) || 's'
         ELSE 'N/A' END AS tempo_sincronizacao,
    CASE WHEN COALESCE(dp.receiver_name,'') = COALESCE(ep.nome_recebedor,'')
              AND COALESCE(dp.receiver_document,'') = COALESCE(ep.documento_recebedor,'')
              AND COALESCE(dp.photo_url,'') = COALESCE(ep.foto_entrega_url,'')
              AND COALESCE(dp.signature_url,'') = COALESCE(ep.assinatura_url,'')
         THEN 'IGUAIS' ELSE 'DIFERENTES' END AS campos_iguais
FROM public.delivery_proofs dp
LEFT JOIN public.entregas_protocolo ep ON ep.alocacao_id = dp.operation_id::uuid
    AND dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ORDER BY dp.created_at DESC

UNION ALL

-- 2. CONTAGEM: DESTINOS POR ORIGEM
SELECT
    '2. Destinos por origem'::text,
    dp.id::text,
    COUNT(ep.id)::text || ' destino(s)',
    dp.operation_id, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.delivery_proofs dp
LEFT JOIN public.entregas_protocolo ep ON ep.alocacao_id = dp.operation_id::uuid
    AND dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
GROUP BY dp.id, dp.operation_id

UNION ALL

-- 3. CONTAGEM: ORIGENS POR OPERAÇÃO
SELECT
    '3. Origens por operacao'::text,
    dp.operation_id::text,
    COUNT(dp.id)::text || ' origem(ns)',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.delivery_proofs dp
GROUP BY dp.operation_id
ORDER BY COUNT(dp.id) DESC

UNION ALL

-- 4. REGISTROS SEM DESTINO
SELECT
    '4. Sem destino'::text,
    dp.id::text,
    'Sem correspondencia em entregas_protocolo',
    dp.operation_id, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.delivery_proofs dp
WHERE NOT EXISTS (
    SELECT 1 FROM public.entregas_protocolo ep
    WHERE ep.alocacao_id = dp.operation_id::uuid
)
   OR dp.operation_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

UNION ALL

-- 5. RESUMO DA SINCRONIZAÇÃO
SELECT
    '5. Resumo'::text,
    COUNT(DISTINCT dp.id)::text || ' delivery_proofs'::text,
    COUNT(DISTINCT ep.id)::text || ' entregas_protocolo vinculados'::text,
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.delivery_proofs dp
LEFT JOIN public.entregas_protocolo ep ON ep.alocacao_id = dp.operation_id::uuid
    AND dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
