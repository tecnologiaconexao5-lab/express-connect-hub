-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-023B — VALIDAÇÃO PRÉ/PÓS-EXECUÇÃO
-- ============================================================================
-- Resultado único com todas as verificações.
-- READ-ONLY: apenas SELECTs. Nada é alterado.
-- Pode ser executado ANTES ou DEPOIS do incremental.
--
-- Uso: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

WITH checks AS (
  -- ═════════════════════════════════════════════════════════════════════════
  -- 1. RPC existe
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 1 AS chk, 'RPC existe' AS descricao,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS resultado,
    jsonb_build_object('found', COUNT(*) > 0) AS detalhes
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 2. Assinatura correta (12 parâmetros)
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 2, 'Parâmetros = 12',
    CASE WHEN p.pronargs = 12 THEN 'PASS' ELSE format('FAIL (actual: %s)', p.pronargs) END,
    jsonb_build_object(
      'param_count', p.pronargs,
      'expected', 12,
      'param_names', (
        SELECT jsonb_agg(a.argname ORDER BY a.argnum)
        FROM pg_proc p2
        CROSS JOIN LATERAL unnest(p2.proargnames::text[]) WITH ORDINALITY AS a(argname, argnum)
        WHERE p2.oid = p.oid
      )
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 3. Defaults corretos
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 3, 'Defaults dos parâmetros',
    CASE
      WHEN prosrc LIKE '%DEFAULT ''em_deslocamento''%'
        AND prosrc LIKE '%DEFAULT ''app_motorista''%'
        AND prosrc LIKE '%DEFAULT NOW()%'
      THEN 'PASS'
      ELSE 'WARN'
    END,
    jsonb_build_object(
      'default_em_deslocamento', prosrc LIKE '%DEFAULT ''em_deslocamento''%',
      'default_app_motorista', prosrc LIKE '%DEFAULT ''app_motorista''%',
      'default_now', prosrc LIKE '%DEFAULT NOW()%',
      'default_null_params', prosrc LIKE '%DEFAULT NULL%'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 4. Usa prestadores.auth_user_id (NÃO auth.uid() direto)
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 4, 'Lookup: prestadores.auth_user_id',
    CASE
      WHEN prosrc LIKE '%prestadores.auth_user_id%' THEN 'PASS'
      ELSE 'FAIL'
    END,
    jsonb_build_object(
      'uses_prestadores_auth_user_id', prosrc LIKE '%prestadores.auth_user_id%',
      'uses_auth_uid_direct', (prosrc LIKE '%v_prestador_id := auth.uid()%' OR prosrc LIKE '%= auth.uid()%')
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 5. Retorna 'success' E 'ok'
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 5, 'Resposta: success + ok',
    CASE
      WHEN prosrc LIKE '%''success''%' AND prosrc LIKE '%''ok''%' THEN 'PASS'
      WHEN prosrc LIKE '%''success''%' THEN 'WARN (só success)'
      ELSE 'FAIL'
    END,
    jsonb_build_object(
      'returns_success', prosrc LIKE '%''success''%',
      'returns_ok', prosrc LIKE '%''ok''%',
      'flutter_accepts', 'success OU ok'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 6. error_code presente nos erros
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 6, 'Erros: error_code presente',
    CASE
      WHEN prosrc LIKE '%''error_code''%' THEN 'PASS'
      ELSE 'FAIL (sem error_code)'
    END,
    jsonb_build_object('has_error_code', prosrc LIKE '%''error_code''%')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 7. Dedup: duplicada + deduplicated
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 7, 'Dedup: duplicada + deduplicated',
    CASE
      WHEN prosrc LIKE '%''duplicada''%' AND prosrc LIKE '%''deduplicated''%' THEN 'PASS'
      WHEN prosrc LIKE '%''duplicada''%' THEN 'WARN (só duplicada)'
      ELSE 'FAIL (sem dedup)'
    END,
    jsonb_build_object(
      'has_duplicada', prosrc LIKE '%''duplicada''%',
      'has_deduplicated', prosrc LIKE '%''deduplicated''%',
      'flutter_accepts', 'duplicada OU deduplicated'
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 8. SECURITY DEFINER
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 8, 'SECURITY DEFINER',
    CASE WHEN p.prosecdef THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('prosecdef', p.prosecdef, 'note', 'Necessário para ler prestadores + alocacoes_escala e inserir em portal_tracking_realtime')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 9. search_path = public
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 9, 'search_path = public',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p2
        JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
        WHERE n2.nspname = 'public' AND p2.proname = 'registrar_posicao_motorista'
          AND p2.proconfig IS NOT NULL
          AND (
            SELECT bool_and(v LIKE 'search_path%public%')
            FROM unnest(p2.proconfig) AS v
            WHERE v LIKE 'search_path%'
          )
      ) THEN 'PASS'
      ELSE 'WARN (pode ser default)'
    END,
    jsonb_build_object(
      'proconfig', (
        SELECT string_agg(v, ', ') FROM (
          SELECT unnest(p.proconfig) AS v FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
        ) t
      )
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 10. anon SEM EXECUTE
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 10, 'anon SEM EXECUTE',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'registrar_posicao_motorista'
          AND routine_schema = 'public'
          AND grantee IN ('anon', 'public')
      ) THEN 'FAIL'
      ELSE 'PASS'
    END,
    jsonb_build_object(
      'anon_execute', EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'registrar_posicao_motorista'
          AND routine_schema = 'public'
          AND grantee = 'anon'
      ),
      'public_execute', EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'registrar_posicao_motorista'
          AND routine_schema = 'public'
          AND grantee = 'public'
      )
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 11. authenticated com EXECUTE
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 11, 'authenticated com EXECUTE',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'registrar_posicao_motorista'
          AND routine_schema = 'public'
          AND grantee = 'authenticated'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END,
    jsonb_build_object('authenticated_execute', EXISTS (
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_name = 'registrar_posicao_motorista'
        AND routine_schema = 'public'
        AND grantee = 'authenticated'
    ))

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 12. Policies com TO authenticated
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 12, 'Policies: TO authenticated',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'portal_tracking_realtime'
          AND schemaname = 'public'
          AND 'authenticated' = ANY(roles)
      ) THEN 'PASS'
      ELSE 'FAIL'
    END,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'policy', policyname,
        'cmd', cmd,
        'roles', roles::text,
        'qual_substring', LEFT(COALESCE(qual, with_check), 120)
      ))
      FROM pg_policies
      WHERE tablename = 'portal_tracking_realtime'
        AND schemaname = 'public'
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 13. Nenhuma policy para PUBLIC ou anon
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 13, 'NENHUMA policy PUBLIC/anon',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'portal_tracking_realtime'
          AND schemaname = 'public'
          AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
      ) THEN 'FAIL'
      ELSE 'PASS'
    END,
    jsonb_build_object(
      'public_policies', EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'portal_tracking_realtime'
          AND schemaname = 'public'
          AND 'public' = ANY(roles)
      ),
      'anon_policies', EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'portal_tracking_realtime'
          AND schemaname = 'public'
          AND 'anon' = ANY(roles)
      )
    )

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 14. RLS habilitado
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 14, 'RLS habilitado',
    CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('rls_enabled', c.relrowsecurity, 'force_rls', c.relforcerowsecurity)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'portal_tracking_realtime'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 15. Tabela existe
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 15, 'Tabela portal_tracking_realtime',
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('found', COUNT(*) > 0)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 16. Índices
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 16, 'Índices (mín. 4)',
    CASE WHEN COUNT(*) >= 4 THEN format('PASS (%s)', COUNT(*))
         WHEN COUNT(*) > 0 THEN format('WARN (%s)', COUNT(*))
         ELSE 'FAIL (0)' END,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'index', i.indexname,
        'definition', pg_get_indexdef(i.indexrelid)
      ))
      FROM (
        SELECT c2.relname AS indexname, ix.indexrelid
        FROM pg_index ix
        JOIN pg_class c1 ON c1.oid = ix.indrelid
        JOIN pg_class c2 ON c2.oid = ix.indexrelid
        WHERE c1.relname = 'portal_tracking_realtime'
          AND c1.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) i
    )
  FROM pg_index ix
  JOIN pg_class c ON c.oid = ix.indrelid
  WHERE c.relname = 'portal_tracking_realtime'
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 17. Triggers
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 17, 'Triggers (mín. 1)',
    CASE WHEN COUNT(*) > 0 THEN format('PASS (%s)', COUNT(*)) ELSE 'WARN (0)' END,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'trigger', tg.tgname,
        'function', p.proname,
        'enabled', tg.tgenabled != 'D'
      ))
      FROM pg_trigger tg
      JOIN pg_proc p ON p.oid = tg.tgfoid
      WHERE tg.tgrelid = 'portal_tracking_realtime'::regclass
        AND tg.tgname NOT LIKE 'pg_%'
    )
  FROM pg_trigger
  WHERE tgrelid = 'portal_tracking_realtime'::regclass
    AND tgname NOT LIKE 'pg_%'

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 18. Posições existentes
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 18, 'Posições na tabela',
    CASE
      WHEN COUNT(*) > 0 THEN format('INFO (%s)', COUNT(*))
      ELSE 'INFO (0)'
    END,
    jsonb_build_object('count', COUNT(*))
  FROM public.portal_tracking_realtime

  UNION ALL

  -- ═════════════════════════════════════════════════════════════════════════
  -- 19. Vínculo PRESTADOR TESTE APP
  -- ═════════════════════════════════════════════════════════════════════════
  SELECT 19, 'PRESTADOR TESTE APP ativo',
    CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'WARN (não encontrado)' END,
    jsonb_build_object(
      'count', COUNT(*),
      'prestador', (
        SELECT jsonb_build_object(
          'id', id,
          'nome', nome_completo,
          'auth_user_id', auth_user_id,
          'status', status,
          'liberado_app', liberado_app
        )
        FROM prestadores
        WHERE (id::text LIKE 'e6646799%' OR nome_completo LIKE '%PRESTADOR TESTE APP%')
        LIMIT 1
      )
    )
  FROM prestadores
  WHERE (id::text LIKE 'e6646799%' OR nome_completo LIKE '%PRESTADOR TESTE APP%')
    AND status = 'ativo'
)
-- ═══════════════════════════════════════════════════════════════════════════════
-- OUTPUT ÚNICO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT
  chk,
  descricao,
  resultado,
  detalhes::text AS detalhes
FROM checks
ORDER BY chk;
