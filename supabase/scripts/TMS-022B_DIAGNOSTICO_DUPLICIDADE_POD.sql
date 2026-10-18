-- ============================================================================
-- TMS-022B — DIAGNÓSTICO DE DUPLICIDADE EM entregas_protocolo
-- CORRIGIDO: todas as colunas como TEXT para UNION ALL
-- Único resultset. Read-only.
-- ============================================================================

-- 1. REGISTROS DUPLICADOS (DETALHADO)
SELECT
    '1. Registros duplicados'::text AS secao,
    d.alocacao_id::text,
    e.id::text,
    e.prestador_id::text,
    e.nome_recebedor::text,
    COALESCE(e.documento_recebedor, '')::text,
    COALESCE(e.foto_entrega_url, '')::text,
    COALESCE(e.foto_canhoto_url, '')::text,
    COALESCE(e.assinatura_url, '')::text,
    COALESCE(e.latitude::text, '')::text,
    COALESCE(e.longitude::text, '')::text,
    e.status::text,
    e.created_at::text,
    COALESCE(e.updated_at::text, '')::text,
    COALESCE(e.observacao, '')::text,
    COALESCE(e.receiver_relationship, '')::text
FROM public.entregas_protocolo e
JOIN (SELECT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL
      GROUP BY alocacao_id HAVING COUNT(*) > 1) d ON e.alocacao_id = d.alocacao_id
ORDER BY d.alocacao_id::text, e.created_at

UNION ALL

-- 2. CONTAGEM POR alocacao_id
SELECT
    '2. Contagem'::text,
    alocacao_id::text,
    COUNT(*)::text,
    '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.entregas_protocolo
WHERE alocacao_id IN (SELECT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL GROUP BY alocacao_id HAVING COUNT(*) > 1)
GROUP BY alocacao_id
ORDER BY COUNT(*) DESC

UNION ALL

-- 3. REGISTROS IDÊNTICOS?
SELECT
    '3. Identicos'::text,
    d.alocacao_id::text,
    CASE WHEN COUNT(DISTINCT COALESCE(e.nome_recebedor,'')) = 1
              AND COUNT(DISTINCT COALESCE(e.foto_entrega_url,'')) = 1
              AND COUNT(DISTINCT COALESCE(e.foto_canhoto_url,'')) = 1
              AND COUNT(DISTINCT COALESCE(e.assinatura_url,'')) = 1
              AND COUNT(DISTINCT COALESCE(e.status,'')) = 1
         THEN 'SIM' ELSE 'NAO' END,
    '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.entregas_protocolo e
JOIN (SELECT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL GROUP BY alocacao_id HAVING COUNT(*) > 1) d
    ON e.alocacao_id = d.alocacao_id
GROUP BY d.alocacao_id

UNION ALL

-- 4. ORIGEM VEIO DE delivery_proofs?
SELECT
    '4. Origem'::text,
    e.alocacao_id::text,
    CASE WHEN COUNT(dp.id) > 0 THEN 'SIM (' || COUNT(dp.id)::text || ' registro(s))' ELSE 'NAO' END,
    '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.entregas_protocolo e
LEFT JOIN public.delivery_proofs dp ON dp.operation_id = e.alocacao_id::text
WHERE e.alocacao_id IN (SELECT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL GROUP BY alocacao_id HAVING COUNT(*) > 1)
GROUP BY e.alocacao_id

UNION ALL

-- 5. REGISTROS SEM alocacao_id
SELECT
    '5. Sem alocacao_id'::text,
    COUNT(*)::text,
    'registros com alocacao_id NULL (nao contam como duplicata)',
    '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.entregas_protocolo WHERE alocacao_id IS NULL

UNION ALL

-- 6. RESUMO
SELECT
    '6. Resumo'::text,
    'Total: ' || COUNT(*)::text,
    'Alocacoes unicas: ' || COUNT(DISTINCT alocacao_id)::text ||
    ' | Duplicatas: ' || SUM(CASE WHEN alocacao_id IN (SELECT alocacao_id FROM public.entregas_protocolo WHERE alocacao_id IS NOT NULL GROUP BY alocacao_id HAVING COUNT(*) > 1) THEN 1 ELSE 0 END)::text ||
    ' | NULLs: ' || SUM(CASE WHEN alocacao_id IS NULL THEN 1 ELSE 0 END)::text,
    '', '', '', '', '', '', '', '', '', '', '', '', ''
FROM public.entregas_protocolo;
