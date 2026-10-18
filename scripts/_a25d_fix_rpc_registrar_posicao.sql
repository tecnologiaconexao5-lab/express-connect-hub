-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO A25-D — CORREÇÃO FINAL DO TRACKING
-- RPC registrar_posicao_motorista
--
-- CAUSA A25-C comprovada: o RPC usava prestadores.tenant_id, coluna que NÃO
-- existe em public.prestadores. O RPC quebrava antes do INSERT.
--
-- CORREÇÃO (somente esta função — autorizada):
--   * Resolver o prestador SEM tenant_id:
--       SELECT id INTO v_prestador_id FROM public.prestadores WHERE auth_user_id=...
--   * Resolver o tenant a partir da alocação autenticada:
--       alocacoes_escala.tenant_id (coluna REAL e existente)
--   * Manter TODAS as validações (auth, prestador, liberado_app, alocação existe,
--     dono da alocação, status ativo, 0,0, limites, dedup 10s).
--   * Preservar a MESMA assinatura (compatível com APK build 1306 — sem novo APK).
--   * INSERT apenas em colunas existentes de portal_tracking_realtime.
--   * p_altitude / p_status_operacional preservados em metadata (JSONB).
--   * os_id = alocacao.ordem_servico_id (pode ser NULL quando não houver OS) —
--     NÃO impede o registro; tracking fica vinculado por alocacao_id + prestador_id.
--   * SECURITY DEFINER + search_path public preservados.
--
-- BACKUP/ROLLBACK: scripts/_a25d_backup_rpc_registrar_posicao.sql (definição anterior).
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
    v_alocacao_tenant_id UUID;
    v_os_id UUID;
    v_cliente_id UUID;
    v_veiculo_id UUID;
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
    -- Resolve SOMENTE o prestador (tenant vem da alocação — coluna real)
    -- ══════════════════════════════════════════════════════════════════════
    SELECT id INTO v_prestador_id
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
    -- VALIDAÇÃO 3: alocação existe + resolução de relacionamentos reais
    -- (tenant_id da alocação — coluna existente; os_id/cliente_id derivados)
    -- ══════════════════════════════════════════════════════════════════════
    SELECT ae.status, ae.prestador_id, ae.ordem_servico_id, ae.cliente_id, ae.tenant_id
    INTO v_alocacao_status, v_alocacao_prestador_id, v_os_id, v_cliente_id, v_alocacao_tenant_id
    FROM public.alocacoes_escala ae
    WHERE ae.id = p_alocacao_id;

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
    -- Tenant: derivado da alocação autenticada (coluna REAL)
    -- Fallback seguro: current_tenant_id_safe() quando a alocação não tiver tenant
    -- ══════════════════════════════════════════════════════════════════════
    v_tenant_id := COALESCE(v_alocacao_tenant_id, public.current_tenant_id_safe());

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
    -- Resolução do veículo vinculado ao prestador (best-effort, coluna real)
    -- ══════════════════════════════════════════════════════════════════════
    BEGIN
        SELECT v.id INTO v_veiculo_id
        FROM public.veiculos v
        WHERE v.prestador_vinculado = v_prestador_id
        ORDER BY v.updated_at DESC NULLS LAST, v.created_at DESC NULLS LAST
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_veiculo_id := NULL;
    END;

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
    -- INSERT na tabela de tracking (APENAS colunas existentes)
    -- os_id pode ser NULL (alocação sem OS) — NÃO impede o registro.
    -- p_altitude / p_status_operacional preservados em metadata (JSONB).
    -- ══════════════════════════════════════════════════════════════════════
    INSERT INTO public.portal_tracking_realtime (
        alocacao_id,
        os_id,
        prestador_id,
        veiculo_id,
        cliente_id,
        tenant_id,
        status,
        latitude,
        longitude,
        precisao,
        velocidade,
        direcao,
        bateria,
        captured_at,
        origem,
        metadata
    ) VALUES (
        p_alocacao_id,
        COALESCE(v_os_id, p_ordem_servico_id),
        v_prestador_id,
        v_veiculo_id,
        v_cliente_id,
        v_tenant_id,
        'online',
        p_latitude,
        p_longitude,
        p_precisao,
        p_velocidade,
        p_direcao,
        p_bateria,
        p_captured_at,
        p_origem,
        jsonb_build_object(
            'altitude', p_altitude,
            'status_operacional', p_status_operacional
        )
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
    -- ══════════════════════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', true,
        'ok', true,
        'id', v_result,
        'alocacao_id', p_alocacao_id,
        'os_id', COALESCE(v_os_id, p_ordem_servico_id),
        'prestador_id', v_prestador_id,
        'veiculo_id', v_veiculo_id,
        'tenant_id', v_tenant_id,
        'primeiro_ponto', v_is_first,
        'message', 'Posição registrada com sucesso.'
    );
END;
$$;
