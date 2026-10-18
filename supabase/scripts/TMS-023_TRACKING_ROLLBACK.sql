-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-023B — TRACKING ROLLBACK (EMERGÊNCIA)
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ⚠️  EMERGÊNCIA — USO RESTRITO                                        ║
-- ║                                                                        ║
-- ║  Este rollback restaura a RPC M106 ORIGINAL com 3 BUGS CONHECIDOS:     ║
-- ║                                                                        ║
-- ║  BUG-001: auth.uid() direto → lookup NUNCA encontra o prestador        ║
-- ║  BUG-002: resposta 'ok' → Flutter espera 'success'                     ║
-- ║  BUG-003: 8 parâmetros → Flutter envia 11 → function does not exist   ║
-- ║                                                                        ║
-- ║  APÓS ESTE ROLLBACK O TRACKING PARA DE FUNCIONAR NOVAMENTE.            ║
-- ║  Não execute para "testar" — o hotfix é a versão correta e final.      ║
-- ║  Execute apenas se o hotfix TMS-023B causar falha em PRODUÇÃO.         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRECHECK — Verificar se a RPC foi alterada por TMS-023
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_uses_new_lookup BOOLEAN;
BEGIN
  SELECT p.prosrc LIKE '%prestadores.auth_user_id%' INTO v_uses_new_lookup
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  IF NOT v_uses_new_lookup THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: RPC já está na versão original (M106). Nada a reverter.';
  END IF;

  RAISE NOTICE 'PRECHECK: RPC usa prestadores.auth_user_id. Rollback necessário.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ETAPA 1 — RESTAURAR RPC ORIGINAL (M106)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Versão com 8 parâmetros, auth.uid() direto, resposta 'ok'
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.registrar_posicao_motorista(
  p_alocacao_id   UUID,
  p_latitude      NUMERIC,
  p_longitude     NUMERIC,
  p_velocidade    NUMERIC DEFAULT NULL,
  p_precisao      NUMERIC DEFAULT NULL,
  p_direcao       NUMERIC DEFAULT NULL,
  p_bateria       NUMERIC DEFAULT NULL,
  p_captured_at   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestador_id   UUID;
  v_alocacao       RECORD;
  v_cliente_id     UUID;
  v_os_id          UUID;
  v_veiculo_id     UUID;
  v_tenant_id      UUID;
BEGIN
  -- 1. VALIDAR AUTENTICAÇÃO
  v_prestador_id := auth.uid();
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado');
  END IF;

  -- 2. VALIDAR COORDENADAS
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Latitude e longitude são obrigatórias');
  END IF;

  IF p_latitude = 0 AND p_longitude = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Coordenadas 0,0 são inválidas');
  END IF;

  IF p_latitude < -90 OR p_latitude > 90 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Latitude fora do intervalo (-90 a 90)');
  END IF;

  IF p_longitude < -180 OR p_longitude > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Longitude fora do intervalo (-180 a 180)');
  END IF;

  -- 3. VALIDAR ALOCAÇÃO ATIVA
  SELECT ae.id, ae.cliente_id, ae.ordem_servico_id, ae.veiculo_id, ae.empresa_id
    INTO v_alocacao
    FROM alocacoes_escala ae
    WHERE ae.id = p_alocacao_id
      AND ae.prestador_id = v_prestador_id
      AND ae.status IN ('aceita', 'em_rota', 'ocorrencia')
      AND ae.finalizada = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Alocação não encontrada ou não está ativa para o motorista',
      'alocacao_id', p_alocacao_id
    );
  END IF;

  -- 4. RESOLVER VALORES AUXILIARES
  v_cliente_id := v_alocacao.cliente_id;
  v_os_id      := v_alocacao.ordem_servico_id;
  v_veiculo_id := v_alocacao.veiculo_id;
  v_tenant_id  := COALESCE(v_alocacao.empresa_id,
                           public.current_tenant_id_safe(),
                           '00000000-0000-0000-0000-000000000001'::UUID);

  -- 5. DEDUPLICAÇÃO (5s)
  IF EXISTS (
    SELECT 1 FROM portal_tracking_realtime ptr
    WHERE ptr.alocacao_id = p_alocacao_id
      AND ptr.latitude = p_latitude
      AND ptr.longitude = p_longitude
      AND ptr.created_at > (NOW() - INTERVAL '5 seconds')
  ) THEN
    RETURN jsonb_build_object('ok', true, 'deduplicated', true,
      'message', 'Posição duplicada ignorada (mesma coordenada nos últimos 5s)');
  END IF;

  -- 6. INSERT
  INSERT INTO portal_tracking_realtime (
    alocacao_id, cliente_id, os_id, prestador_id, veiculo_id,
    tenant_id,
    latitude, longitude,
    velocidade, precisao, direcao, bateria,
    captured_at, created_at,
    status, origem
  ) VALUES (
    p_alocacao_id, v_cliente_id, v_os_id, v_prestador_id, v_veiculo_id,
    v_tenant_id,
    p_latitude, p_longitude,
    p_velocidade, p_precisao, p_direcao, p_bateria,
    COALESCE(p_captured_at, NOW()), NOW(),
    'online', 'app_motorista'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'alocacao_id', p_alocacao_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'captured_at', COALESCE(p_captured_at, NOW())
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ETAPA 2 — RESTAURAR POLICIES ORIGINAIS (M106)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS tracking_insert_prestador ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS tracking_prestador_select ON public.portal_tracking_realtime;

CREATE POLICY "tracking_insert_prestador" ON public.portal_tracking_realtime
  FOR INSERT
  TO authenticated
  WITH CHECK (
    prestador_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM alocacoes_escala ae
      WHERE ae.id = alocacao_id
        AND ae.prestador_id = auth.uid()
        AND ae.status IN ('aceita', 'em_rota', 'ocorrencia')
        AND ae.finalizada = false
    )
  );

CREATE POLICY "tracking_select_prestador" ON public.portal_tracking_realtime
  FOR SELECT
  TO authenticated
  USING (
    prestador_id = auth.uid()
  );

CREATE POLICY "tracking_select_tenant" ON public.portal_tracking_realtime
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- PÓS-VALIDAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_is_original BOOLEAN;
  v_param_count INT;
  v_policy_count INT;
BEGIN
  SELECT p.pronargs INTO v_param_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista';

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'portal_tracking_realtime'
    AND schemaname = 'public';

  RAISE NOTICE 'PÓS-VALIDAÇÃO ROLLBACK:';
  RAISE NOTICE '  Parâmetros RPC: % (original: 8)', v_param_count;
  RAISE NOTICE '  Policies: %', v_policy_count;
  RAISE NOTICE '  ⚠️ BUGS RESTAURADOS: auth.uid() direto, resposta ''ok'', 8 params';
  RAISE NOTICE '  ⚠️ Tracking APP MOTORISTA → SUPABASE volta a falhar';
  RAISE NOTICE '  ⚠️ Para corrigir novamente, execute TMS-023_TRACKING_INCREMENTAL.sql';
END;
$$;
