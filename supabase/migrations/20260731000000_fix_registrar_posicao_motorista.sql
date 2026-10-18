-- ===================================================================
-- HOTFIX 001 — CORREÇÃO RPC registrar_posicao_motorista
-- Problema: Produção tinha versão com v_prestador_id := auth.uid()
--           que compara auth.uid() com alocacoes_escala.prestador_id
--           (prestador_id = prestadores.id, NUNCA igual a auth.uid())
-- Fix: Lookup correto via prestadores.auth_user_id = auth.uid()
-- ===================================================================

-- ===================================================================
-- 1. RECRIAR RPC COM A LÓGICA CORRETA
-- ===================================================================
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
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USUARIO_NAO_AUTENTICADO',
            'message', 'Usuário não autenticado. Faça login novamente.'
        );
    END IF;

    SELECT id, tenant_id INTO v_prestador_id, v_tenant_id
    FROM public.prestadores
    WHERE auth_user_id = auth.uid()
      AND status = 'ativo'
      AND liberado_app = true;

    IF v_prestador_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PRESTADOR_NAO_VINCULADO',
            'message', 'Prestador não encontrado ou não autorizado.'
        );
    END IF;

    SELECT status, prestador_id INTO v_alocacao_status, v_alocacao_prestador_id
    FROM public.alocacoes_escala
    WHERE id = p_alocacao_id;

    IF v_alocacao_prestador_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ALOCACAO_NAO_ENCONTRADA',
            'message', 'Alocação não encontrada.'
        );
    END IF;

    IF v_alocacao_prestador_id != v_prestador_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ALOCACAO_OUTRO_PRESTADOR',
            'message', 'Esta alocação não pertence ao seu vínculo.'
        );
    END IF;

    IF v_alocacao_status IN ('cancelada', 'concluida', 'recusada') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ALOCACAO_INATIVA',
            'message', 'Alocação não está mais ativa (status: ' || v_alocacao_status || ').'
        );
    END IF;

    IF p_latitude = 0 AND p_longitude = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'COORDENADA_INVALIDA',
            'message', 'Coordenada 0,0 rejeitada. GPS indisponível.'
        );
    END IF;

    IF p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'COORDENADA_FORA_LIMITE',
            'message', 'Coordenada fora dos limites permitidos.'
        );
    END IF;

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
                    'error', 'POSICAO_DUPLICADA',
                    'message', 'Posição duplicada. Ignorada.',
                    'duplicada', true
                );
            END IF;
        END IF;
    ELSE
        v_is_first := true;
    END IF;

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

    RETURN jsonb_build_object(
        'success', true,
        'id', v_result,
        'alocacao_id', p_alocacao_id,
        'prestador_id', v_prestador_id,
        'tenant_id', v_tenant_id,
        'primeiro_ponto', v_is_first,
        'message', 'Posição registrada com sucesso.'
    );
END;
$$;

-- ===================================================================
-- 2. FIX RLS POLICIES — Usar prestadores.auth_user_id (NÃO auth.uid())
-- ===================================================================
DROP POLICY IF EXISTS tracking_insert_prestador ON public.portal_tracking_realtime;
CREATE POLICY tracking_insert_prestador ON public.portal_tracking_realtime
    FOR INSERT
    WITH CHECK (
        prestador_id IN (
            SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tracking_prestador_select ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS tracking_select_prestador ON public.portal_tracking_realtime;
CREATE POLICY tracking_prestador_select ON public.portal_tracking_realtime
    FOR SELECT
    USING (
        prestador_id IN (
            SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
        OR tenant_id IN (
            SELECT tenant_id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
    );

-- ===================================================================
-- 3. GRANT PERMISSIONS
-- ===================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.portal_tracking_realtime TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_posicao_motorista TO authenticated;
