-- Migration: DreamFlow RPC functions for motorista app
-- Created automatically by Antigravity

-- Function: aceitar_viagem
CREATE OR REPLACE FUNCTION public.aceitar_viagem(token_acesso TEXT, escala_id UUID)
RETURNS VOID AS $$
DECLARE
    motorista_id UUID;
BEGIN
    -- Validate token and get motorista (driver) ID from session table
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    -- Update escala_operacional status to "aceito"
    UPDATE escala_operacional
    SET status = 'aceito', atualizado_em = now()
    WHERE id = escala_id AND prestador_id = motorista_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: recusar_viagem
CREATE OR REPLACE FUNCTION public.recusar_viagem(token_acesso TEXT, escala_id UUID, motivo TEXT)
RETURNS VOID AS $$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    UPDATE escala_operacional
    SET status = 'recusado', observacoes = motivo, atualizado_em = now()
    WHERE id = escala_id AND prestador_id = motorista_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: atualizar_status_viagem
CREATE OR REPLACE FUNCTION public.atualizar_status_viagem(token_acesso TEXT, escala_id UUID, novo_status TEXT)
RETURNS VOID AS $$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    UPDATE escala_operacional
    SET status = novo_status, atualizado_em = now()
    WHERE id = escala_id AND prestador_id = motorista_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: registrar_checkin_motorista
CREATE OR REPLACE FUNCTION public.registrar_checkin_motorista(
    token_acesso TEXT,
    escala_id UUID,
    tipo TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    observacao TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    INSERT INTO motorista_checkins (
        prestador_id,
        escala_id,
        tipo,
        latitude,
        longitude,
        observacao,
        created_at
    ) VALUES (
        motorista_id,
        escala_id,
        tipo,
        latitude,
        longitude,
        observacao,
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: registrar_localizacao_motorista
CREATE OR REPLACE FUNCTION public.registrar_localizacao_motorista(
    token_acesso TEXT,
    escala_id UUID,
    latitude NUMERIC,
    longitude NUMERIC,
    velocidade NUMERIC DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    INSERT INTO operacao_localizacao (
        escala_id,
        latitude,
        longitude,
        velocidade,
        status,
        atualizado_em,
        origem
    ) VALUES (
        escala_id,
        latitude,
        longitude,
        velocidade,
        'em_rota',
        now(),
        'driver_app'
    );
    -- Also update escala_operacional for realtime panel
    UPDATE escala_operacional SET status = 'em_rota', atualizado_em = now() WHERE id = escala_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: reportar_ocorrencia_motorista
CREATE OR REPLACE FUNCTION public.reportar_ocorrencia_motorista(
    token_acesso TEXT,
    escala_id UUID,
    tipo TEXT,
    descricao TEXT,
    latitude NUMERIC,
    longitude NUMERIC
) RETURNS VOID AS $$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    -- Insert a record in escalonamentos_humanos for human handling
    INSERT INTO escalonamentos_humanos (
        origem,
        modulo,
        referencia_id,
        tipo,
        prioridade,
        status,
        titulo,
        descricao,
        mensagem_original,
        intencao,
        confianca,
        payload
    ) VALUES (
        'driver_app',
        'ocorrencia',
        escala_id,
        tipo,
        'alta',
        'aberto',
        concat('Ocorrência ', tipo, ' - ', descricao),
        descricao,
        concat('Motorista ', motorista_id, ': ', descricao),
        tipo,
        100,
        jsonb_build_object(
            'latitude', latitude,
            'longitude', longitude,
            'escala_id', escala_id
        )
    );
    -- Optionally update the operation status
    UPDATE escala_operacional SET status = 'ocorrencia', atualizado_em = now() WHERE id = escala_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
