-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-023 — DIAGNÓSTICO CONSOLIDADO DO TRACKING
-- APP MOTORISTA → SUPABASE → TMS → PORTAL
--
-- Modo: READ-ONLY
-- Execução: SELECT apenas. Nenhum INSERT/UPDATE/DELETE.
-- Uso: pg client, psql, ou Supabase Dashboard > SQL Editor
--
-- Resultado: colunas (ordem, secao, item, resultado, detalhes JSONB)
-- ═══════════════════════════════════════════════════════════════════════════════

WITH diagnostic AS (
  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 1 — EXISTÊNCIA E DEFINIÇÃO DA RPC
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 1 AS ordem, 'RPC' AS secao, 'registrar_posicao_motorista existe' AS item,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS resultado,
    jsonb_build_object(
      'found', COUNT(*) > 0,
      'expected', 'ao menos 1',
      'actual', COUNT(*)
    ) AS detalhes
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 2, 'RPC', 'Assinatura da RPC (params)',
    CASE WHEN p.pronargs >= 8 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'param_count', p.pronargs,
      'expected_min', 8,
      'param_names', (
        SELECT jsonb_agg(a.argname ORDER BY a.argnum)
        FROM pg_proc p2
        CROSS JOIN LATERAL unnest(
          p2.proargnames::text[]
        ) WITH ORDINALITY AS a(argname, argnum)
        WHERE p2.oid = p.oid
      ),
      'param_types', (
        SELECT jsonb_agg(t.typname ORDER BY a.argnum)
        FROM pg_proc p2
        CROSS JOIN LATERAL unnest(p2.proargtypes::int[]) WITH ORDINALITY AS a(type_oid, argnum)
        JOIN pg_type t ON t.oid = a.type_oid
        WHERE p2.oid = p.oid
      )
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 3, 'RPC', 'Language da RPC',
    CASE WHEN p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql') THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'language', (SELECT lanname FROM pg_language WHERE oid = p.prolang),
      'expected', 'plpgsql'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 4, 'RPC', 'Security INVOKER ou DEFINER',
    CASE WHEN p.prosecdef THEN 'PASS (SECURITY DEFINER)' ELSE 'PASS (SECURITY INVOKER)' END,
    jsonb_build_object(
      'prosecdef', p.prosecdef,
      'note', 'SECURITY DEFINER permite bypassar RLS com validações internas'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 5, 'RPC', 'Corpo da RPC usa auth.uid()',
    CASE
      WHEN prosrc LIKE '%auth.uid()%' THEN 'FAIL (usa auth.uid direto)'
      ELSE 'PASS (usa lookup por prestadores.auth_user_id)'
    END,
    jsonb_build_object(
      'contains_auth_uid', prosrc LIKE '%auth.uid()%',
      'contains_prestadores_auth_user_id', prosrc LIKE '%prestadores.auth_user_id%',
      'note_auth_uid', 'auth.uid() = auth.users.id, que NUNCA é igual a prestadores.id'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 6, 'RPC', 'Resposta da RPC retorna ''success''',
    CASE
      WHEN prosrc LIKE '%''success''%' OR prosrc LIKE '%''success''%' THEN 'PASS (retorna success)'
      ELSE 'WARN (retorna ok - incompatível com Dart)'
    END,
    jsonb_build_object(
      'returns_success', prosrc LIKE '%''success''%',
      'returns_ok', prosrc LIKE '%''ok''%',
      'dart_checks_for', 'response[''success'']',
      'impact', 'Se RPC retorna ''ok'' mas Dart checa ''success'', tracking sempre falha'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 7, 'RPC', 'Deduplicação na RPC',
    CASE
      WHEN prosrc LIKE '%duplic%' OR prosrc LIKE '%5 second%' OR prosrc LIKE '%10 second%' THEN 'PASS'
      ELSE 'FAIL (sem deduplicação)'
    END,
    jsonb_build_object(
      'has_dedup', (prosrc LIKE '%duplic%' OR prosrc LIKE '%5 second%' OR prosrc LIKE '%10 second%'),
      'method', CASE
        WHEN prosrc LIKE '%10 second%' THEN 'mesma coordenada nos últimos 10s (hotfix)'
        WHEN prosrc LIKE '%5 second%' THEN 'mesma coordenada nos últimos 5s (M106)'
        ELSE 'desconhecido'
      END
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  SELECT 8, 'RPC', 'GRANT EXECUTE TO anon/authenticated',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p2
        JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
        JOIN information_schema.routine_privileges rp
          ON rp.specific_name = (
            SELECT specific_name FROM information_schema.routines
            WHERE routine_name = 'registrar_posicao_motorista'
              AND routine_schema = 'public'
            LIMIT 1
          )
        WHERE n2.nspname = 'public' AND p2.proname = 'registrar_posicao_motorista'
          AND rp.grantee IN ('public', 'anon')
      ) THEN 'FAIL (anon/public tem EXECUTE)'
      ELSE 'PASS (anon sem EXECUTE)'
    END,
    jsonb_build_object(
      'check_method', 'information_schema.routine_privileges',
      'expected', 'apenas authenticated e service_role'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'registrar_posicao_motorista'
  LIMIT 1

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 2 — TABELAS
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 9, 'Tabelas', 'portal_tracking_realtime existe',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('found', COUNT(*) > 0)
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'portal_tracking_realtime'

  UNION ALL

  SELECT 10, 'Tabelas', 'operacao_localizacao existe',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('found', COUNT(*) > 0)
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'operacao_localizacao'

  UNION ALL

  SELECT 11, 'Tabelas', 'Colunas de portal_tracking_realtime',
    'PASS',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'coluna', column_name,
        'tipo', data_type || COALESCE('(' || character_maximum_length::text || ')', ''),
        'nullable', is_nullable,
        'default', COALESCE(column_default, 'nenhum')
      ) ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'portal_tracking_realtime'
    )

  UNION ALL

  SELECT 12, 'Tabelas', 'Colunas de operacao_localizacao',
    'PASS',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'coluna', column_name,
        'tipo', data_type || COALESCE('(' || character_maximum_length::text || ')', ''),
        'nullable', is_nullable,
        'default', COALESCE(column_default, 'nenhum')
      ) ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'operacao_localizacao'
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 3 — ÍNDICES
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 13, 'Índices', 'Índices em portal_tracking_realtime',
    CASE WHEN COUNT(*) >= 4 THEN 'PASS' ELSE 'WARN' END,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'index', i.indexname,
        'columns', (
          SELECT string_agg(a.attname, ', ' ORDER BY array_position(i.indkey, a.attnum::smallint))
          FROM pg_attribute a
          WHERE a.attrelid = i.indexrelid
            AND a.attnum = ANY(i.indkey)
            AND a.attnum > 0
        ),
        'unique', i.indisunique,
        'definition', pg_get_indexdef(i.indexrelid)
      ))
      FROM (
        SELECT
          c.relname AS tablename,
          i.relname AS indexname,
          ix.indkey,
          ix.indisunique,
          ix.indexrelid,
          ix.indrelid
        FROM pg_index ix
        JOIN pg_class c ON c.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE c.relname = 'portal_tracking_realtime'
          AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) i
    )
  FROM pg_index ix
  JOIN pg_class c ON c.oid = ix.indrelid
  WHERE c.relname = 'portal_tracking_realtime'
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

  UNION ALL

  SELECT 14, 'Índices', 'Índices em operacao_localizacao',
    CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'WARN' END,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'index', i.indexname,
        'columns', (
          SELECT string_agg(a.attname, ', ' ORDER BY array_position(i.indkey, a.attnum::smallint))
          FROM pg_attribute a
          WHERE a.attrelid = i.indexrelid
            AND a.attnum = ANY(i.indkey)
            AND a.attnum > 0
        ),
        'unique', i.indisunique,
        'definition', pg_get_indexdef(i.indexrelid)
      ))
      FROM (
        SELECT
          c.relname AS tablename,
          i.relname AS indexname,
          ix.indkey,
          ix.indisunique,
          ix.indexrelid,
          ix.indrelid
        FROM pg_index ix
        JOIN pg_class c ON c.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE c.relname = 'operacao_localizacao'
          AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) i
    )
  FROM pg_index ix
  JOIN pg_class c ON c.oid = ix.indrelid
  WHERE c.relname = 'operacao_localizacao'
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 4 — RLS E POLICIES
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 15, 'RLS', 'RLS habilitado em portal_tracking_realtime',
    CASE WHEN relrowsecurity THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'rls_enabled', relrowsecurity,
      'force_rls', relforcerowsecurity
    )
  FROM pg_class
  WHERE relname = 'portal_tracking_realtime'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

  UNION ALL

  SELECT 16, 'RLS', 'Policies em portal_tracking_realtime',
    'PASS',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'policy', policyname,
        'cmd', cmd,
        'role', roles::text,
        'qual', qual,
        'with_check', with_check
      ))
      FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
    )

  UNION ALL

  SELECT 17, 'RLS', 'anon bloqueado em portal_tracking_realtime',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
        AND 'anon' = ANY(roles)
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'anon_policies_exist', EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'portal_tracking_realtime'
          AND schemaname = 'public'
          AND 'anon' = ANY(roles)
      )
    )

  UNION ALL

  SELECT 18, 'RLS', 'authenticated pode INSERT com restrição de prestador',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
        AND cmd = 'INSERT'
        AND with_check LIKE '%prestador%'
    ) THEN 'PASS' ELSE 'WARN' END,
    (
      SELECT jsonb_build_object(
        'insert_policies', jsonb_agg(jsonb_build_object(
          'policy', policyname,
          'with_check', with_check
        ))
      )
      FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
        AND cmd = 'INSERT'
    )

  UNION ALL

  SELECT 19, 'RLS', 'authenticated SELECT isolado por tenant ou prestador',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
        AND cmd = 'SELECT'
        AND (qual LIKE '%tenant%' OR qual LIKE '%prestador%')
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'select_policies', jsonb_agg(jsonb_build_object(
          'policy', policyname,
          'qual', qual
        ))
      )
      FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
        AND cmd = 'SELECT'
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 5 — GRANTS / PRIVILÉGIOS
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 20, 'Grants', 'Privilégios em portal_tracking_realtime',
    'PASS',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'grantee', grantee,
        'privilege', privilege_type,
        'grantor', grantor
      ))
      FROM information_schema.table_privileges
      WHERE table_schema = 'public'
        AND table_name = 'portal_tracking_realtime'
    )

  UNION ALL

  SELECT 21, 'Grants', 'Privilégios em operacao_localizacao',
    'PASS',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'grantee', grantee,
        'privilege', privilege_type,
        'grantor', grantor
      ))
      FROM information_schema.table_privileges
      WHERE table_schema = 'public'
        AND table_name = 'operacao_localizacao'
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 6 — TRIGGERS
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 22, 'Triggers', 'Triggers em portal_tracking_realtime',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'WARN' END,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'trigger', tgname,
        'event', CASE
          WHEN tgtype & 2 > 0 THEN 'INSERT'
          WHEN tgtype & 4 > 0 THEN 'DELETE'
          WHEN tgtype & 16 > 0 THEN 'UPDATE'
          ELSE 'DESCONHECIDO'
        END,
        'function', tgfname,
        'enabled', tgenabled != 'D'
      ))
      FROM pg_trigger
      WHERE tgrelid = 'portal_tracking_realtime'::regclass
        AND tgname NOT LIKE 'pg_%'
    )
  FROM pg_trigger
  WHERE tgrelid = 'portal_tracking_realtime'::regclass
    AND tgname NOT LIKE 'pg_%'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 7 — DADOS
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 23, 'Dados', 'Total de posições em portal_tracking_realtime',
    CASE WHEN COUNT(*) > 0 THEN 'WARN (com dados)' ELSE 'PASS (vazia - esperado sem seed)' END,
    jsonb_build_object('count', COUNT(*))
  FROM portal_tracking_realtime

  UNION ALL

  SELECT 24, 'Dados', 'Posições nos últimos 7 dias',
    CASE WHEN COUNT(*) > 0 THEN 'INFO' ELSE 'INFO (sem dados recentes)' END,
    jsonb_build_object(
      'ultimos_7_dias', COUNT(*),
      'periodo', NOW() - INTERVAL '7 days'
    )
  FROM portal_tracking_realtime
  WHERE created_at > NOW() - INTERVAL '7 days'

  UNION ALL

  SELECT 25, 'Dados', 'Posições sem alocacao_id',
    'INFO',
    jsonb_build_object('count', COUNT(*))
  FROM portal_tracking_realtime
  WHERE alocacao_id IS NULL

  UNION ALL

  SELECT 26, 'Dados', 'Posições sem prestador_id',
    'INFO',
    jsonb_build_object('count', COUNT(*))
  FROM portal_tracking_realtime
  WHERE prestador_id IS NULL

  UNION ALL

  SELECT 27, 'Dados', 'Posições com coordenadas 0,0',
    'INFO',
    jsonb_build_object('count', COUNT(*))
  FROM portal_tracking_realtime
  WHERE latitude = 0 AND longitude = 0

  UNION ALL

  SELECT 28, 'Dados', 'Última posição por prestador (amostra)',
    'INFO',
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'prestador_id', prestador_id,
          'ultima_latitude', latitude,
          'ultima_longitude', longitude,
          'ultimo_captured_at', captured_at,
          'velocidade', velocidade,
          'precisao', precisao
        ) ORDER BY captured_at DESC)
        FROM (
          SELECT DISTINCT ON (prestador_id) prestador_id, latitude, longitude, captured_at, velocidade, precisao
          FROM portal_tracking_realtime
          WHERE prestador_id IS NOT NULL
          ORDER BY prestador_id, captured_at DESC
        ) sub
      ),
      '[]'::jsonb
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 8 — VÍNCULO COM PRESTADOR TESTE APP
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 29, 'Vínculo', 'PRESTADOR TESTE APP (e6646799-...)',
    CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'WARN' END,
    jsonb_build_object(
      'count', COUNT(*),
      'id_search', 'e6646799%',
      'nome_search', '%PRESTADOR TESTE APP%'
    )
  FROM prestadores
  WHERE (id::text LIKE 'e6646799%' OR nome_completo LIKE '%PRESTADOR TESTE APP%')
    AND status = 'ativo'

  UNION ALL

  SELECT 30, 'Vínculo', 'auth_user_id do PRESTADOR TESTE APP',
    'INFO',
    (
      SELECT jsonb_build_object(
        'prestador_id', id,
        'nome', nome_completo,
        'auth_user_id', auth_user_id,
        'auth_user_exists', auth_user_id IS NOT NULL
      )
      FROM prestadores
      WHERE id::text LIKE 'e6646799%'
        OR nome_completo LIKE '%PRESTADOR TESTE APP%'
      LIMIT 1
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 9 — MIGRAÇÕES
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 31, 'Migrações', 'M106 tracking_real_go_live aplicada',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
        AND column_name = 'alocacao_id'
    ) AND EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'table_exists', EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
      ),
      'has_alocacao_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
          AND column_name = 'alocacao_id'
      ),
      'rpc_exists', EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
      )
    )

  UNION ALL

  SELECT 32, 'Migrações', 'Hotfix 20260731_fix_registrar_posicao_motorista',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
          AND p.prosrc LIKE '%prestadores.auth_user_id%'
      ) THEN 'PASS (hotfix aplicado)'
      ELSE 'FAIL (hotfix NÃO aplicado - RPC ainda usa auth.uid() direto)'
    END,
    jsonb_build_object(
      'uses_prestadores_auth_user_id', EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
          AND p.prosrc LIKE '%prestadores.auth_user_id%'
      ),
      'param_count', (
        SELECT p.pronargs
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
      )
    )

  UNION ALL

  SELECT 33, 'Migrações', 'M108I NOC (trigger sync operacao_localizacao)',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'portal_tracking_realtime'::regclass
        AND tgname = 'trg_sync_tracking_to_oper_localizacao'
        AND tgenabled != 'D'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'trigger_exists', EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'portal_tracking_realtime'::regclass
          AND tgname = 'trg_sync_tracking_to_oper_localizacao'
      ),
      'trigger_enabled', EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'portal_tracking_realtime'::regclass
          AND tgname = 'trg_sync_tracking_to_oper_localizacao'
          AND tgenabled != 'D'
      )
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 10 — VIEWS E DEPENDÊNCIAS
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 34, 'Views', 'vw_noc_operacional existe',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('found', COUNT(*) > 0)
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name = 'vw_noc_operacional'

  UNION ALL

  SELECT 35, 'Views', 'vw_app_motorista_operacoes existe',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('found', COUNT(*) > 0)
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name = 'vw_app_motorista_operacoes'

  UNION ALL

  SELECT 36, 'Views', 'vw_noc_operacional contém tracking_lat/lng',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'WARN' END,
    jsonb_build_object(
      'tracking_fields', (
        SELECT jsonb_agg(column_name ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vw_noc_operacional'
          AND column_name IN ('tracking_lat', 'tracking_lng', 'tracking_velocidade', 'tracking_ultima_atualizacao')
      ),
      'note', 'vw_noc_operacional lê de operacao_localizacao (via LATERAL)'
    )
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'vw_noc_operacional'
    AND column_name IN ('tracking_lat', 'tracking_lng')

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 11 — CHECKPOINT
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 37, 'Checkpoint', 'Tabela hml_seed_checkpoint existe',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'INFO' END,
    jsonb_build_object('found', COUNT(*) > 0)
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'hml_seed_checkpoint'

  UNION ALL

  SELECT 38, 'Checkpoint', 'Status do checkpoint',
    'INFO',
    (
      SELECT jsonb_build_object(
        'etapas_executadas', COUNT(*),
        'ultima_execucao', MAX(executed_at),
        'etapas', jsonb_agg(jsonb_build_object(
          'etapa', etapa,
          'status', status,
          'executed_at', executed_at,
          'hash', hash
        ) ORDER BY executed_at)
      )
      FROM hml_seed_checkpoint
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 12 — RESULTADO CONSOLIDADO
  -- ═════════════════════════════════════════════════════════════════════════════

  SELECT 99, 'Resumo', 'Diagnóstico concluído',
    'INFO',
    jsonb_build_object(
      'timestamp', NOW(),
      'database', current_database(),
      'tables_checked', ARRAY['portal_tracking_realtime', 'operacao_localizacao'],
      'rpcs_checked', ARRAY['registrar_posicao_motorista'],
      'migrations_checked', ARRAY['M106', 'M108I', 'hotfix_20260731'],
      'warning_hotfix_applied', EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
          AND p.prosrc LIKE '%prestadores.auth_user_id%'
      ),
      'critical_bugs', jsonb_build_array(
        jsonb_build_object(
          'id', 'BUG-001',
          'descricao', 'RPC usa auth.uid() direto em vez de lookup por prestadores.auth_user_id',
          'impacto', 'Todas as tentativas de tracking retornam ALOCACAO_OUTRO_PRESTADOR',
          'fix', 'Aplicar hotfix 20260731_fix_registrar_posicao_motorista.sql'
        ),
        jsonb_build_object(
          'id', 'BUG-002',
          'descricao', 'RPC retorna chave "ok" mas Dart espera "success"',
          'impacto', 'Todas as posições são tratadas como erro no Flutter',
          'fix', '(1) Aplicar hotfix SQL + (2) Corrigir Dart para aceitar ambas as chaves'
        ),
        jsonb_build_object(
          'id', 'BUG-003',
          'descricao', 'Dart envia 11 parâmetros mas RPC em produção aceita 8',
          'impacto', 'Erro de "function does not exist" - tracking nunca funciona',
          'fix', 'Aplicar hotfix SQL que aceita 12 parâmetros (com defaults)'
        )
      )
    )
)
-- ═══════════════════════════════════════════════════════════════════════════════
-- OUTPUT FINAL
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT ordem, secao, item, resultado, detalhes::text
FROM diagnostic
ORDER BY ordem;
