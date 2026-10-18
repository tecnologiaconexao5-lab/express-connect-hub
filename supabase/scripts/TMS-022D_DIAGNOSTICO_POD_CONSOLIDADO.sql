-- ============================================================================
-- TMS-022D — DIAGNÓSTICO CONSOLIDADO DO POD
-- Seções: duplicidade, delivery_proofs, comparação, segurança, resumo
-- 5 colunas: ordem, secao, item, resultado, detalhes (jsonb)
-- Read-only. Nenhuma escrita.
-- ============================================================================
WITH

-- ============================================================================
-- SEÇÃO 1 — DUPLICIDADE EM entregas_protocolo
-- ============================================================================
dup_aloc AS (
    SELECT alocacao_id
    FROM public.entregas_protocolo
    WHERE alocacao_id IS NOT NULL
    GROUP BY alocacao_id
    HAVING COUNT(*) > 1
),
dup_detalhes AS (
    SELECT
        e.alocacao_id,
        jsonb_build_object(
            'id', e.id::text,
            'alocacao_id', e.alocacao_id::text,
            'prestador_id', e.prestador_id::text,
            'nome_recebedor', e.nome_recebedor,
            'documento_recebedor', e.documento_recebedor,
            'status', e.status,
            'foto_entrega_url', e.foto_entrega_url,
            'foto_canhoto_url', e.foto_canhoto_url,
            'assinatura_url', e.assinatura_url,
            'latitude', e.latitude::text,
            'longitude', e.longitude::text,
            'created_at', e.created_at::text,
            'updated_at', e.updated_at::text,
            'observacao', e.observacao,
            'gps_accuracy', e.gps_accuracy::text
        ) AS detalhes
    FROM public.entregas_protocolo e
    JOIN dup_aloc d ON e.alocacao_id = d.alocacao_id
),
dup_contagem AS (
    SELECT alocacao_id, COUNT(*) AS total FROM public.entregas_protocolo
    WHERE alocacao_id IN (SELECT alocacao_id FROM dup_aloc)
    GROUP BY alocacao_id
),

-- ============================================================================
-- SEÇÃO 2 — DELIVERY_PROOFS
-- ============================================================================
delivery_proofs_data AS (
    SELECT
        dp.id AS dp_id,
        jsonb_build_object(
            'delivery_proof_id', dp.id::text,
            'operation_id', dp.operation_id,
            'driver_id', dp.driver_id,
            'status', dp.status,
            'receiver_name', dp.receiver_name,
            'receiver_document', dp.receiver_document,
            'photo_url', dp.photo_url,
            'signature_url', dp.signature_url,
            'foto_canhoto_url', dp.foto_canhoto_url,
            'latitude', dp.latitude::text,
            'longitude', dp.longitude::text,
            'gps_accuracy', dp.gps_accuracy::text,
            'observation', dp.observation,
            'delivered_at', dp.delivered_at::text,
            'created_at', dp.created_at::text
        ) AS detalhes
    FROM public.delivery_proofs dp
),

-- ============================================================================
-- SEÇÃO 3 — COMPARAÇÃO ORIGEM × DESTINO
-- ============================================================================
comparacao AS (
    SELECT
        dp.id AS dp_id,
        dp.operation_id,
        CASE WHEN dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN dp.operation_id::uuid ELSE NULL END AS aloc_uuid,
        ep.id AS ep_id,
        COALESCE(dp.receiver_name,'') = COALESCE(ep.nome_recebedor,'') AS rec_igual,
        COALESCE(dp.receiver_document,'') = COALESCE(ep.documento_recebedor,'') AS doc_igual,
        COALESCE(dp.photo_url,'') = COALESCE(ep.foto_entrega_url,'') AS foto_igual,
        COALESCE(dp.signature_url,'') = COALESCE(ep.assinatura_url,'') AS ass_igual,
        COALESCE(dp.status,'') = COALESCE(
            CASE WHEN ep.status IS NOT NULL THEN
                CASE dp.status
                    WHEN 'delivered' THEN 'entregue'
                    WHEN 'delivered_with_note' THEN 'entregue_ressalva'
                    WHEN 'not_delivered' THEN 'nao_entregue'
                    ELSE dp.status
                END
            ELSE NULL END, '') AS status_igual,
        dp.created_at AS origem_created,
        ep.created_at AS destino_created
    FROM public.delivery_proofs dp
    LEFT JOIN public.entregas_protocolo ep
        ON ep.alocacao_id = dp.operation_id::uuid
        AND dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
comp_detalhes AS (
    SELECT
        c.dp_id,
        c.operation_id,
        jsonb_build_object(
            'delivery_proof_id', c.dp_id::text,
            'entregas_protocolo_id', c.ep_id::text,
            'operation_id', c.operation_id,
            'alocacao_id', c.aloc_uuid::text,
            'status_igual', c.status_igual,
            'recebedor_igual', c.rec_igual,
            'documento_igual', c.doc_igual,
            'foto_igual', c.foto_igual,
            'assinatura_igual', c.ass_igual,
            'origem_created_at', c.origem_created::text,
            'destino_created_at', c.destino_created::text,
            'diferenca_segundos',
                CASE WHEN c.origem_created IS NOT NULL AND c.destino_created IS NOT NULL
                     THEN EXTRACT(EPOCH FROM (c.destino_created - c.origem_created))::numeric(10,3)
                     ELSE NULL END,
            'delivery_proofs_por_operation',
                (SELECT COUNT(*) FROM public.delivery_proofs dp2 WHERE dp2.operation_id = c.operation_id),
            'entregas_protocolo_por_alocacao',
                (SELECT COUNT(*) FROM public.entregas_protocolo ep2
                 WHERE c.aloc_uuid IS NOT NULL AND ep2.alocacao_id = c.aloc_uuid)
        ) AS detalhes
    FROM comparacao c
),

-- ============================================================================
-- SEÇÃO 4 — SEGURANÇA
-- ============================================================================
policies_entrega AS (
    SELECT schemaname, tablename, policyname, permissive, cmd, roles::text,
           qual::text AS using_expr, with_check::text AS with_check_expr
    FROM pg_policies WHERE tablename = 'entregas_protocolo' AND schemaname = 'public'
),
policies_delivery AS (
    SELECT schemaname, tablename, policyname, permissive, cmd, roles::text,
           qual::text AS using_expr, with_check::text AS with_check_expr
    FROM pg_policies WHERE tablename = 'delivery_proofs' AND schemaname = 'public'
),
grants_entrega AS (
    SELECT grantee::text, privilege_type::text
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'
),
grants_delivery AS (
    SELECT grantee::text, privilege_type::text
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'delivery_proofs'
),
rls_status AS (
    SELECT relname::text AS tabela,
           CASE WHEN relrowsecurity THEN 'habilitado' ELSE 'desabilitado' END AS status
    FROM pg_class WHERE relname IN ('entregas_protocolo','delivery_proofs')
      AND relnamespace = 'public'::regnamespace
),

-- ============================================================================
-- SEÇÃO 5 — MÉTRICAS PARA RESUMO
-- ============================================================================
metricas AS (
    SELECT
        (SELECT COUNT(*) FROM public.delivery_proofs) AS total_dp,
        (SELECT COUNT(*) FROM public.entregas_protocolo) AS total_ep,
        (SELECT COUNT(*) FROM (SELECT operation_id FROM public.delivery_proofs GROUP BY operation_id HAVING COUNT(*) > 1) x) AS dp_operation_duplicado,
        (SELECT COUNT(*) FROM dup_aloc) AS ep_aloc_duplicado,
        (SELECT COUNT(*) FROM public.delivery_proofs dp WHERE NOT EXISTS (
            SELECT 1 FROM public.entregas_protocolo ep
            WHERE ep.alocacao_id = dp.operation_id::uuid
              AND dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )) AS dp_sem_destino,
        (SELECT COUNT(*) FROM policies_entrega) AS policies_ep,
        (SELECT COUNT(*) FROM policies_delivery) AS policies_dp,
        (SELECT COUNT(*) FROM grants_entrega) AS grants_ep,
        (SELECT COUNT(*) FROM grants_delivery) AS grants_dp,
        has_table_privilege('anon', 'public.entregas_protocolo', 'INSERT') AS anon_insert_ep,
        has_table_privilege('anon', 'public.delivery_proofs', 'INSERT') AS anon_insert_dp
)

-- ============================================================================
-- SELECT FINAL (único UNION ALL, 5 colunas, UM ponto e vírgula no final)
-- ============================================================================
-- Seção 1: Duplicidade — registros
SELECT 1 AS ordem, '1. Duplicidade (registros)' AS secao,
       COALESCE(e.nome_recebedor, '(sem nome)') AS item,
       'alocacao_id: ' || e.alocacao_id::text AS resultado,
       d.detalhes
FROM dup_detalhes d
JOIN public.entregas_protocolo e ON e.id = (d.detalhes->>'id')::uuid

UNION ALL

-- Seção 1: Duplicidade — contagem
SELECT 1, '1. Duplicidade (contagem)',
       'alocacao_id: ' || alocacao_id::text,
       total::text || ' registro(s)',
       jsonb_build_object('alocacao_id', alocacao_id::text, 'total', total)
FROM dup_contagem

UNION ALL

-- Seção 1: Duplicidade — alerta
SELECT 1, '1. Duplicidade (alerta)',
       CASE WHEN (SELECT COUNT(*) FROM dup_aloc) > 0 THEN 'ATENCAO: duplicidade detectada' ELSE 'OK: sem duplicidade' END,
       (SELECT COUNT(*) FROM dup_aloc)::text || ' alocacao_id duplicado(s)',
       jsonb_build_object('total_aloc_duplicados', (SELECT COUNT(*) FROM dup_aloc))

UNION ALL

-- Seção 2: Delivery Proofs
SELECT 2, '2. Delivery Proofs',
       'ID: ' || (d.detalhes->>'delivery_proof_id'),
       'operation: ' || COALESCE(d.detalhes->>'operation_id', 'N/A'),
       d.detalhes
FROM delivery_proofs_data d

UNION ALL

-- Seção 2: Delivery Proofs — contagem
SELECT 2, '2. Delivery Proofs (contagem)',
       'Total delivery_proofs',
       (SELECT COUNT(*)::text FROM public.delivery_proofs),
       jsonb_build_object('total', (SELECT COUNT(*) FROM public.delivery_proofs))

UNION ALL

-- Seção 3: Comparação origem × destino
SELECT 3, '3. Comparacao Origem x Destino',
       'DP: ' || COALESCE(c.detalhes->>'delivery_proof_id', 'N/A'),
       'EP: ' || COALESCE(c.detalhes->>'entregas_protocolo_id', 'SEM DESTINO'),
       c.detalhes
FROM comp_detalhes c

UNION ALL

-- Seção 4: Policies entregas_protocolo
SELECT 4, '4. Policies (entregas_protocolo)',
       p.policyname,
       p.cmd || ' | roles: ' || COALESCE(p.roles, ''),
       jsonb_build_object('cmd', p.cmd, 'roles', p.roles, 'using', p.using_expr, 'with_check', p.with_check_expr)
FROM policies_entrega p

UNION ALL

-- Seção 4: Policies delivery_proofs
SELECT 4, '4. Policies (delivery_proofs)',
       p.policyname,
       p.cmd || ' | roles: ' || COALESCE(p.roles, ''),
       jsonb_build_object('cmd', p.cmd, 'roles', p.roles, 'using', p.using_expr, 'with_check', p.with_check_expr)
FROM policies_delivery p

UNION ALL

-- Seção 4: Grants entregas_protocolo
SELECT 4, '4. Grants (entregas_protocolo)',
       g.grantee || ' -> ' || g.privilege_type,
       g.privilege_type,
       jsonb_build_object('grantee', g.grantee, 'privilege', g.privilege_type)
FROM grants_entrega g

UNION ALL

-- Seção 4: Grants delivery_proofs
SELECT 4, '4. Grants (delivery_proofs)',
       g.grantee || ' -> ' || g.privilege_type,
       g.privilege_type,
       jsonb_build_object('grantee', g.grantee, 'privilege', g.privilege_type)
FROM grants_delivery g

UNION ALL

-- Seção 4: Privilégios efetivos
SELECT 4, '4. Privilegios efetivos',
       r.role_name || ' @ ' || t.tabela,
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'SELECT') THEN 'SELECT OK' ELSE 'SELECT BLOQ' END || ' | ' ||
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'INSERT') THEN 'INSERT OK' ELSE 'INSERT BLOQ' END || ' | ' ||
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'UPDATE') THEN 'UPDATE OK' ELSE 'UPDATE BLOQ' END || ' | ' ||
       CASE WHEN has_table_privilege(r.role_name, 'public.' || t.tabela, 'DELETE') THEN 'DELETE OK' ELSE 'DELETE BLOQ' END,
       jsonb_build_object('role', r.role_name, 'tabela', t.tabela,
           'SELECT', has_table_privilege(r.role_name, 'public.' || t.tabela, 'SELECT'),
           'INSERT', has_table_privilege(r.role_name, 'public.' || t.tabela, 'INSERT'),
           'UPDATE', has_table_privilege(r.role_name, 'public.' || t.tabela, 'UPDATE'),
           'DELETE', has_table_privilege(r.role_name, 'public.' || t.tabela, 'DELETE'))
FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) AS r(role_name)
CROSS JOIN (VALUES ('entregas_protocolo'), ('delivery_proofs')) AS t(tabela)

UNION ALL

-- Seção 4: RLS status
SELECT 4, '4. RLS',
       r.tabela,
       r.status,
       jsonb_build_object('tabela', r.tabela, 'rls', r.status)
FROM rls_status r

UNION ALL

-- Seção 5: Resumo
SELECT 5, '5. Resumo',
       'Delivery Proofs',
       m.total_dp::text || ' registro(s)',
       jsonb_build_object('total', m.total_dp)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Entregas Protocolo',
       m.total_ep::text || ' registro(s)',
       jsonb_build_object('total', m.total_ep)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Operations duplicadas na origem (delivery_proofs)',
       m.dp_operation_duplicado::text || ' operation(s)',
       jsonb_build_object('total', m.dp_operation_duplicado)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Alocacoes duplicadas no destino (entregas_protocolo)',
       m.ep_aloc_duplicado::text || ' alocacao(s)',
       jsonb_build_object('total', m.ep_aloc_duplicado)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Delivery Proofs sem destino',
       m.dp_sem_destino::text || ' registro(s)',
       jsonb_build_object('total', m.dp_sem_destino)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Policies entregas_protocolo',
       m.policies_ep::text || ' policy(s)',
       jsonb_build_object('total', m.policies_ep)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Policies delivery_proofs',
       m.policies_dp::text || ' policy(s)',
       jsonb_build_object('total', m.policies_dp)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Grants entregas_protocolo',
       m.grants_ep::text || ' grant(s)',
       jsonb_build_object('total', m.grants_ep)
FROM metricas m

UNION ALL

SELECT 5, '5. Resumo',
       'Grants delivery_proofs',
       m.grants_dp::text || ' grant(s)',
       jsonb_build_object('total', m.grants_dp)
FROM metricas m

UNION ALL

-- Alertas
SELECT 5, '5. Alerta',
       'anon INSERT em entregas_protocolo',
       CASE WHEN m.anon_insert_ep THEN 'ATENCAO: anon pode inserir em entregas_protocolo' ELSE 'OK: anon bloqueado' END,
       jsonb_build_object('anon_insert_entregas_protocolo', m.anon_insert_ep)
FROM metricas m

UNION ALL

SELECT 5, '5. Alerta',
       'anon INSERT em delivery_proofs',
       CASE WHEN m.anon_insert_dp THEN 'ATENCAO: anon pode inserir em delivery_proofs' ELSE 'OK: anon bloqueado' END,
       jsonb_build_object('anon_insert_delivery_proofs', m.anon_insert_dp)
FROM metricas m

UNION ALL

SELECT 5, '5. Alerta',
       'Duplicidade no destino',
       CASE WHEN m.ep_aloc_duplicado > 0 THEN 'ATENCAO: existem alocacao_id duplicados em entregas_protocolo' ELSE 'OK' END,
       jsonb_build_object('alerta_duplicidade_destino', m.ep_aloc_duplicado > 0, 'total', m.ep_aloc_duplicado)
FROM metricas m

ORDER BY ordem, secao, item;
-- ============================================================================
-- FIM — TMS-022D Diagnóstico Consolidado
-- ============================================================================
