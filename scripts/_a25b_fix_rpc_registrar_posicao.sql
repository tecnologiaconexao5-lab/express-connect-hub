-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO A25-B — HOTFIX CONTROLADO — RPC registrar_posicao_motorista
--
-- PROBLEMA (auditoria A25): a função inseria em colunas que NÃO existem na tabela
-- real portal_tracking_realtime:
--   ordem_servico_id, motorista_id, altitude, status_operacional
-- A tabela real possui: id, cliente_id, os_id, prestador_id, veiculo_id, status,
-- latitude, longitude, eta_min, velocidade, bateria, metadata, updated_at,
-- alocacao_id, captured_at, precisao, direcao, tenant_id, created_at, origem.
--
-- CORREÇÃO (somente esta função; nenhuma coluna/tabela criada/removida):
--   * Mantém a MESMA assinatura (compatível com o APK build 1306 — sem novo APK).
--   * Mantém TODAS as validações/autorização (auth, prestador, alocação, dono,
--     status ativo, 0,0, limites, dedup 10s) e SECURITY DEFINER + search_path.
--   * INSERT apenas em colunas existentes; os_id/veiculo_id/cliente_id derivados
--     da alocação autenticada (NUNCA confiados no cliente).
--   * p_altitude e p_status_operacional (parâmetros do APK) são preservados em
--     metadata (JSONB existente) — sem colunas novas.
--   * status = 'online' para a posição ativa (coluna existente).
--
-- BACKUP/ROLLBACK: scripts/_a25b_backup_rpc_registrar_posicao.sql (definição anterior).
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
    -- VALIDAÇÃO 3: alocação existe + resolução de relacionamentos reais
    -- (os_id, cliente_id, veiculo_id derivados do banco, nunca do cliente)
    -- ══════════════════════════════════════════════════════════════════════
    SELECT ae.status, ae.prestador_id, ae.ordem_servico_id, ae.cliente_id
    INTO v_alocacao_status, v_alocacao_prestador_id, v_os_id, v_cliente_id
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
    -- p_altitude / p_status_operacional preservados em metadata (JSONB)
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
    -- Retorna 'success' (primário) e 'ok' (compatibilidade retroativa)
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
