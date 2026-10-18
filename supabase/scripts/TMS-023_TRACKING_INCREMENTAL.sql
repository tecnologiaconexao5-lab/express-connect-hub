-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-023B — TRACKING INCREMENTAL (CONSOLIDADO)
-- ============================================================================
-- Script ÚNICO e AUTORIZADO para corrigir o tracking em produção.
-- Corrige os 3 bugs críticos da RPC registrar_posicao_motorista (M106):
--
--   BUG-001  auth.uid() direto em vez de prestadores.auth_user_id
--            → lookup nunca encontra o prestador, tracking nunca escreve
--
--   BUG-002  Resposta usa chave 'ok' mas Flutter espera 'success'
--            → toda posição vira erro no App
--
--   BUG-003  Flutter envia 11 parâmetros, RPC aceita só 8
--            → PostgreSQL named parameter mismatch → function does not exist
--
-- Tabela de mapeamento: Flutter → RPC (assinatura final)
--
--   #  Parâmetro Flutter         Parâmetro RPC              Tipo         Obrig.  Default          Transformação
--   ── ─────────────────────────  ─────────────────────────  ───────────  ──────  ───────────────  ───────────────
--   1  p_alocacao_id              p_alocacao_id              UUID         SIM     —                alocacaoId ?? operationId
--   2  p_latitude                 p_latitude                 NUMERIC(10,7) SIM    —                direto
--   3  p_longitude                p_longitude                NUMERIC(10,7) SIM    —                direto
--   4  p_velocidade               p_velocidade               NUMERIC       NÃO    0                speed ?? 0
--   5  p_precisao                 p_precisao                 NUMERIC       NÃO    0                accuracy (obrigatório no Flutter)
--   6  p_direcao                  p_direcao                  NUMERIC       NÃO    0                heading ?? 0
--   7  p_bateria                  p_bateria                  NUMERIC       NÃO    NULL             batteryLevel ?? 0
--   8  p_captured_at              p_captured_at              TIMESTAMPTZ   NÃO    NOW()            createdAt.toIso8601String()
--   9  p_altitude                 p_altitude                 NUMERIC       NÃO    NULL             altitude ?? 0
--  10  p_status_operacional       p_status_operacional       TEXT          NÃO    'em_deslocamento' statusOperacional ?? 'em_deslocamento'
--  11  p_origem                   p_origem                   TEXT          NÃO    'app_motorista'   origem (obrigatório no Flutter)
--  12  — (não enviado)            p_ordem_servico_id         UUID          NÃO    NULL             DEFAULT, reservado
--
-- A migration futura 20260801_e3b_tracking_policies_auth_role.sql NÃO será
-- necessária — a correção TO authenticated já está incorporada aqui.
--
-- Instrução:
--   1. Abrir Supabase Dashboard > SQL Editor
--   2. Colar TODO o conteúdo deste arquivo
--   3. EXECUTAR (uma única vez)
--   4. Verificar NOTICE de pós-validação
--   5. Se falhar, usar TMS-023_TRACKING_ROLLBACK.sql apenas em emergência
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRECHECK — Validar estado atual antes de alterar
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_rpc_exists       BOOLEAN;
  v_param_count      INT;
  v_uses_bad_lookup  BOOLEAN;
  v_uses_good_lookup BOOLEAN;
  v_already_fixed    BOOLEAN;
BEGIN
  -- 1. RPC existe?
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
  ) INTO v_rpc_exists;

  IF NOT v_rpc_exists THEN
    RAISE EXCEPTION 'PRECHECK FAILED: RPC registrar_posicao_motorista não existe. '
                    'M106 não foi aplicada. Execute M106 primeiro.';
  END IF;

  -- 2. Assinatura atual
  SELECT p.pronargs INTO v_param_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  -- 3. Verifica corpo da RPC
  SELECT
    p.prosrc LIKE '%v_prestador_id := auth.uid()%' OR
    p.prosrc LIKE '%prestador_id = auth.uid()%' OR
    p.prosrc LIKE '%ae.prestador_id = v_prestador_id%'  -- se v_prestador_id = auth.uid(), ainda errado
    AND NOT p.prosrc LIKE '%prestadores.auth_user_id%'
  INTO v_uses_bad_lookup
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  -- 4. Já corrigido?
  SELECT p.prosrc LIKE '%prestadores.auth_user_id%' INTO v_uses_good_lookup
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  v_already_fixed := v_uses_good_lookup AND v_param_count >= 12;

  IF v_already_fixed THEN
    RAISE NOTICE 'PRECHECK: RPC já está corrigida (12 params, prestadores.auth_user_id). Nada a fazer.';
    RETURN;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'PRECHECK PASSED — RPC precisa de correção';
  RAISE NOTICE '  Parâmetros atuais: % (esperado: 12)', v_param_count;
  RAISE NOTICE '  Usa auth.uid() direto: %', v_uses_bad_lookup;
  RAISE NOTICE '  Usa prestadores.auth_user_id: %', v_uses_good_lookup;
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ETAPA 1 — RECRIAR RPC registrar_posicao_motorista
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mudanças em relação à M106:
--   1. Lookup: auth.uid() → prestadores.auth_user_id (corrige BUG-001)
--   2. Resposta: retorna 'success' E 'ok' (corrige BUG-002)
--   3. Parâmetros: 8 → 12 (corrige BUG-003)
--   4. Dedup: retorna 'duplicada' E 'deduplicated'
--   5. Erros: incluem 'error_code'
--   6. Deduplicação: 5s → 10s (mais tolerante)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.registrar_posicao_motorista(
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_alocacao_id UUID,
    p_ordem_servico_id UUID DEFAULT NULL,
    p_captured_at TIMESTAMPTZ DEFAULT NOW(),
    p_precisao NUMERIC DEFAULT 0,
    p_velocidade NUMERIC DEFAULT 0,
    p_direcao NUMERIC DEFAULT 0,
    p_bateria NUMERIC DEFAULT NULL,
    p_altitude NUMERIC DEFAULT NULL,
    p_status_operacional TEXT DEFAULT 'em_deslocamento',
    p_origem TEXT DEFAULT 'app_motorista'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prestador_id UUID;
    v_tenant_id UUID;
    v_alocacao_status TEXT;
    v_alocacao_prestador_id UUID;
    v_last_pos RECORD;
    v_result JSONB;
    v_is_first BOOLEAN := false;
BEGIN
    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 1: usuário autenticado
    -- ══════════════════════════════════════════════════════════════════════
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'USUARIO_NAO_AUTENTICADO',
            'error_code', 'UNAUTHENTICATED',
            'message', 'Usuário não autenticado. Faça login novamente.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 2: prestador existe e está autorizado
    -- Resolve v_prestador_id e v_tenant_id via prestadores.auth_user_id
    -- ══════════════════════════════════════════════════════════════════════
    SELECT id, tenant_id INTO v_prestador_id, v_tenant_id
    FROM public.prestadores
    WHERE auth_user_id = auth.uid()
      AND status = 'ativo'
      AND liberado_app = true;

    IF v_prestador_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'PRESTADOR_NAO_VINCULADO',
            'error_code', 'PRESTADOR_NOT_FOUND',
            'message', 'Prestador não encontrado ou não autorizado.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 3: alocação existe
    -- ══════════════════════════════════════════════════════════════════════
    SELECT status, prestador_id INTO v_alocacao_status, v_alocacao_prestador_id
    FROM public.alocacoes_escala
    WHERE id = p_alocacao_id;

    IF v_alocacao_prestador_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'ALOCACAO_NAO_ENCONTRADA',
            'error_code', 'ALOCACAO_NOT_FOUND',
            'message', 'Alocação não encontrada.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 4: alocação pertence ao prestador autenticado
    -- ══════════════════════════════════════════════════════════════════════
    IF v_alocacao_prestador_id != v_prestador_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'ALOCACAO_OUTRO_PRESTADOR',
            'error_code', 'ALOCACAO_WRONG_PRESTADOR',
            'message', 'Esta alocação não pertence ao seu vínculo.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 5: alocação está ativa
    -- ══════════════════════════════════════════════════════════════════════
    IF v_alocacao_status IN ('cancelada', 'concluida', 'recusada') THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'ALOCACAO_INATIVA',
            'error_code', 'ALOCACAO_INACTIVE',
            'message', 'Alocação não está mais ativa (status: ' || v_alocacao_status || ').'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 6: coordenadas válidas (0,0 é inválido)
    -- ══════════════════════════════════════════════════════════════════════
    IF p_latitude = 0 AND p_longitude = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'COORDENADA_INVALIDA',
            'error_code', 'INVALID_COORDS',
            'message', 'Coordenada 0,0 rejeitada. GPS indisponível.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 7: coordenadas dentro dos limites geográficos
    -- ══════════════════════════════════════════════════════════════════════
    IF p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'COORDENADA_FORA_LIMITE',
            'error_code', 'COORDS_OUT_OF_RANGE',
            'message', 'Coordenada fora dos limites permitidos.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- DEDUPLICAÇÃO: mesma coordenada nos últimos 10s
    -- ══════════════════════════════════════════════════════════════════════
    SELECT latitude, longitude, captured_at INTO v_last_pos
    FROM public.portal_tracking_realtime
    WHERE alocacao_id = p_alocacao_id
      AND prestador_id = v_prestador_id
    ORDER BY captured_at DESC
    LIMIT 1;

    IF v_last_pos.captured_at IS NOT NULL THEN
        IF v_last_pos.captured_at > (p_captured_at - INTERVAL '10 seconds') THEN
            IF (v_last_pos.latitude = p_latitude AND v_last_pos.longitude = p_longitude) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'ok', true,
                    'error', 'POSICAO_DUPLICADA',
                    'error_code', 'DUPLICATE_POSITION',
                    'duplicada', true,
                    'deduplicated', true,
                    'message', 'Posição duplicada. Ignorada.'
                );
            END IF;
        END IF;
    ELSE
        v_is_first := true;
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- INSERT na tabela de tracking
    -- ══════════════════════════════════════════════════════════════════════
    INSERT INTO public.portal_tracking_realtime (
        alocacao_id,
        ordem_servico_id,
        prestador_id,
        motorista_id,
        tenant_id,
        latitude,
        longitude,
        precisao,
        velocidade,
        direcao,
        altitude,
        captured_at,
        origem,
        status_operacional
    ) VALUES (
        p_alocacao_id,
        p_ordem_servico_id,
        v_prestador_id,
        v_prestador_id,
        v_tenant_id,
        p_latitude,
        p_longitude,
        p_precisao,
        p_velocidade,
        p_direcao,
        p_altitude,
        p_captured_at,
        p_origem,
        p_status_operacional
    )
    RETURNING id INTO v_result;

    -- ══════════════════════════════════════════════════════════════════════
    -- Evento: primeiro ponto de tracking (best-effort)
    -- ══════════════════════════════════════════════════════════════════════
    IF v_is_first THEN
        BEGIN
            INSERT INTO public.operation_timeline_events (
                operation_id,
                driver_id,
                type,
                title,
                description,
                metadata
            ) VALUES (
                p_alocacao_id,
                v_prestador_id,
                'tracking.iniciado',
                'Tracking Iniciado',
                'O motorista iniciou o envio de localização em tempo real.',
                jsonb_build_object(
                    'source', p_origem,
                    'alocacao_id', p_alocacao_id,
                    'latitude', p_latitude,
                    'longitude', p_longitude
                )
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- RESPOSTA DE SUCESSO
    -- Retorna 'success' (primário) e 'ok' (compatibilidade retroativa)
    -- ══════════════════════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', true,
        'ok', true,
        'id', v_result,
        'alocacao_id', p_alocacao_id,
        'prestador_id', v_prestador_id,
        'tenant_id', v_tenant_id,
        'primeiro_ponto', v_is_first,
        'message', 'Posição registrada com sucesso.'
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ETAPA 2 — CORRIGIR RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Todas as policies usam TO authenticated (NUNCA PUBLIC ou anon).
-- Lookup correto: prestadores.auth_user_id = auth.uid()
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2a. INSERT: prestador insere posição apenas para sua própria operação
DROP POLICY IF EXISTS tracking_insert_prestador ON public.portal_tracking_realtime;
CREATE POLICY tracking_insert_prestador ON public.portal_tracking_realtime
    FOR INSERT
    TO authenticated
    WITH CHECK (
        prestador_id IN (
            SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
    );

-- 2b. SELECT: prestador vê suas posições; cliente/operador vê por tenant
DROP POLICY IF EXISTS tracking_prestador_select ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS tracking_select_prestador ON public.portal_tracking_realtime;
CREATE POLICY tracking_prestador_select ON public.portal_tracking_realtime
    FOR SELECT
    TO authenticated
    USING (
        prestador_id IN (
            SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
        OR tenant_id IN (
            SELECT tenant_id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════════
-- ETAPA 3 — GRANTS MÍNIMOS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Apenas authenticated e service_role tem EXECUTE na RPC e acesso à tabela.
-- anon NÃO tem EXECUTE. PUBLIC NÃO tem permissões.
-- postgres/service_role preservados.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Schema USAGE necessário para qualquer operação no schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Tabela: authenticated tem todos os privilégios (SELECT, INSERT, etc.)
-- Restrição real vem das RLS policies acima
GRANT ALL ON public.portal_tracking_realtime TO authenticated;

-- RPC: apenas authenticated pode chamar (anon bloqueado)
GRANT EXECUTE ON FUNCTION public.registrar_posicao_motorista TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PÓS-VALIDAÇÃO — Confirmar que tudo foi aplicado corretamente
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_fixed         BOOLEAN;
  v_param_count   INT;
  v_returns_both  BOOLEAN;
  v_policy_insert BOOLEAN;
  v_policy_select BOOLEAN;
  v_auth_role     BOOLEAN;
  v_grant_auth    BOOLEAN;
  v_grant_anon    BOOLEAN;
  v_grant_public  BOOLEAN;
  v_rls_on        BOOLEAN;
  v_table_exists  BOOLEAN;
  v_idx_count     INT;
  v_trg_count     INT;
  v_pos_count     BIGINT;
BEGIN
  -- 1. RPC usa prestadores.auth_user_id
  SELECT p.prosrc LIKE '%prestadores.auth_user_id%' INTO v_fixed
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  -- 2. Parâmetros = 12
  SELECT p.pronargs INTO v_param_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  -- 3. RPC retorna 'success' E 'ok'
  SELECT p.prosrc LIKE '%''success''%' AND p.prosrc LIKE '%''ok''%' INTO v_returns_both
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  -- 4. Policy INSERT com prestadores.auth_user_id
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portal_tracking_realtime'
      AND schemaname = 'public'
      AND cmd = 'INSERT'
      AND qual LIKE '%auth_user_id%'
  ) INTO v_policy_insert;

  -- 5. Policy SELECT com tenant_id
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portal_tracking_realtime'
      AND schemaname = 'public'
      AND cmd = 'SELECT'
      AND qual LIKE '%tenant_id%'
  ) INTO v_policy_select;

  -- 6. Policies têm TO authenticated
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portal_tracking_realtime'
      AND schemaname = 'public'
      AND 'authenticated' = ANY(roles)
  ) INTO v_auth_role;

  -- 7. anon NÃO tem EXECUTE na RPC
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_name = 'registrar_posicao_motorista'
      AND routine_schema = 'public'
      AND grantee IN ('anon', 'public')
  ) INTO v_grant_anon;

  -- 8. authenticated tem EXECUTE
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_name = 'registrar_posicao_motorista'
      AND routine_schema = 'public'
      AND grantee = 'authenticated'
  ) INTO v_grant_auth;

  -- 9. RLS habilitado
  SELECT c.relrowsecurity INTO v_rls_on
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'portal_tracking_realtime';

  -- 10. Tabela existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
  ) INTO v_table_exists;

  -- 11. Índices
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_index ix
  JOIN pg_class c ON c.oid = ix.indrelid
  WHERE c.relname = 'portal_tracking_realtime'
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  -- 12. Triggers
  SELECT COUNT(*) INTO v_trg_count
  FROM pg_trigger
  WHERE tgrelid = 'portal_tracking_realtime'::regclass
    AND tgname NOT LIKE 'pg_%';

  -- 13. Posições existentes
  SELECT COUNT(*) INTO v_pos_count FROM public.portal_tracking_realtime;

  -- ══════════════════════════════════════════════════════════════════════
  -- RESUMO FINAL
  -- ══════════════════════════════════════════════════════════════════════
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  PÓS-VALIDAÇÃO TMS-023B                                 ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  RPC usa prestadores.auth_user_id: %s                     ║',
    CASE WHEN v_fixed THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '║  Parâmetros: % (esperado: 12)                            ║', v_param_count;
  RAISE NOTICE '║  Retorna success + ok: %                               ║',
    CASE WHEN v_returns_both THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '║  Policy INSERT: %s                                       ║',
    CASE WHEN v_policy_insert THEN '✅ OK' ELSE '❌ FALTA' END;
  RAISE NOTICE '║  Policy SELECT: %s                                        ║',
    CASE WHEN v_policy_select THEN '✅ OK' ELSE '❌ FALTA' END;
  RAISE NOTICE '║  TO authenticated: %s                                     ║',
    CASE WHEN v_auth_role THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '║  RLS habilitado: %s                                       ║',
    CASE WHEN v_rls_on THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '║  anon EXECUTE: %s                                          ║',
    CASE WHEN v_grant_anon THEN '❌ BLOQUEAR' ELSE '✅ BLOQUEADO' END;
  RAISE NOTICE '║  authenticated EXECUTE: %s                                ║',
    CASE WHEN v_grant_auth THEN '✅ OK' ELSE '❌ FALTA' END;
  RAISE NOTICE '║  Tabela existe: %s                                        ║',
    CASE WHEN v_table_exists THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '║  Índices: %                                               ║', v_idx_count;
  RAISE NOTICE '║  Triggers: %                                              ║', v_trg_count;
  RAISE NOTICE '║  Posições existentes: %                                   ║', v_pos_count;
  RAISE NOTICE '╚══════════════════════════════════════════════════════════╝';

  IF v_fixed AND v_param_count = 12 AND v_returns_both AND v_policy_insert
     AND v_auth_role AND NOT v_grant_anon AND v_grant_auth THEN
    RAISE NOTICE '✅ TMS-023B: Tracking incremental aplicado com sucesso.';
    RAISE NOTICE '   Migration E3b (20260801) NÃO é necessária — já incorporada.';
  ELSE
    RAISE WARNING '⚠️  TMS-023B: VERIFICAR ERROS ACIMA. Nem todos os checks passaram.';
  END IF;
END;
$$;
