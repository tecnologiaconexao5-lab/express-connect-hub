-- ============================================================
-- MISSÃO 109 — P0 Fix: M99 triggers sem ON CONFLICT
-- 
-- Risco: M99 triggers (trg_evento_os_criada, 
-- trg_evento_prestador_aceitou, trg_evento_operacao_finalizada,
-- trg_evento_os_finalizada) fazem INSERT em eventos_oficiais
-- SEM ON CONFLICT. Se uma duplicata ocorrer (ex: trigger + TS),
-- a UNIQUE constraint uq_eventos_oficiais_dedup causa 
-- UNIQUE VIOLATION e ROLLBACK de toda a transacao de negocio
-- (OS criada/finalizada, alocacao aceita/concluida).
--
-- Fix: Adiciona ON CONFLICT DO NOTHING nas 4 funcoes,
-- mesmo padrao usado nos triggers M104.
-- ============================================================

-- 1. trg_evento_os_criada — AFTER INSERT na OS
CREATE OR REPLACE FUNCTION public.trg_evento_os_criada()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_nome TEXT;
    v_prestador_nome TEXT;
BEGIN
    SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
    FROM public.clientes WHERE id = NEW.cliente_id;

    SELECT COALESCE(nome, razao_social, 'Prestador') INTO v_prestador_nome
    FROM public.prestadores WHERE id = NEW.prestador_id;

    INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
    ) VALUES (
        'os.ordem_servico.criada',
        'ordem_servico',
        NEW.id,
        NEW.numero,
        'active',
        'trigger',
        NEW.created_by,
        'internal',
        jsonb_build_object(
            'os_id', NEW.id,
            'numero', NEW.numero,
            'cliente_id', NEW.cliente_id,
            'cliente_nome', v_cliente_nome,
            'prestador_id', NEW.prestador_id,
            'prestador_nome', v_prestador_nome,
            'status', NEW.status,
            'tipo_operacao', NEW.tipo_operacao,
            'valor_cliente', NEW.valor_cliente,
            'tipo_carga', NEW.tipo_carga,
            'peso', NEW.peso,
            'volumes', NEW.volumes,
            'data_programada', NEW.data_programada
        ),
        jsonb_build_object(
            'trigger_name', 'trg_evento_os_criada',
            'source_table', 'ordens_servico'
        )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. trg_evento_prestador_aceitou — AFTER UPDATE aceite_prestador
CREATE OR REPLACE FUNCTION public.trg_evento_prestador_aceitou()
RETURNS TRIGGER AS $$
DECLARE
    v_prestador_nome TEXT;
    v_os_numero TEXT;
BEGIN
    SELECT COALESCE(nome, razao_social, 'Prestador') INTO v_prestador_nome
    FROM public.prestadores WHERE id = NEW.prestador_id;

    SELECT numero INTO v_os_numero
    FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;

    INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
    ) VALUES (
        'escala.alocacao.aceita',
        'alocacao',
        NEW.id,
        v_os_numero,
        'active',
        'trigger',
        NEW.updated_by,
        'internal',
        jsonb_build_object(
            'alocacao_id', NEW.id,
            'os_id', NEW.ordem_servico_id,
            'os_numero', v_os_numero,
            'prestador_id', NEW.prestador_id,
            'prestador_nome', v_prestador_nome,
            'data_aceite', NEW.data_aceite,
            'status', NEW.status,
            'cliente_id', NEW.cliente_id,
            'origem', NEW.origem,
            'destino', NEW.destino
        ),
        jsonb_build_object(
            'trigger_name', 'trg_evento_prestador_aceitou',
            'source_table', 'alocacoes_escala'
        )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 3. trg_evento_operacao_finalizada — AFTER UPDATE finalizada=true
CREATE OR REPLACE FUNCTION public.trg_evento_operacao_finalizada()
RETURNS TRIGGER AS $$
DECLARE
    v_prestador_nome TEXT;
    v_os_numero TEXT;
    v_recebedor_nome TEXT;
BEGIN
    SELECT COALESCE(nome, razao_social, 'Prestador') INTO v_prestador_nome
    FROM public.prestadores WHERE id = NEW.prestador_id;

    SELECT numero INTO v_os_numero
    FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;

    SELECT nome_recebedor INTO v_recebedor_nome
    FROM public.entregas_protocolo WHERE alocacao_id = NEW.id
    ORDER BY created_at DESC LIMIT 1;

    INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
    ) VALUES (
        'escala.alocacao.concluida',
        'alocacao',
        NEW.id,
        v_os_numero,
        'active',
        'trigger',
        NEW.updated_by,
        'public',
        jsonb_build_object(
            'alocacao_id', NEW.id,
            'os_id', NEW.ordem_servico_id,
            'os_numero', v_os_numero,
            'prestador_id', NEW.prestador_id,
            'prestador_nome', v_prestador_nome,
            'data_finalizacao', NEW.data_finalizacao,
            'km_realizados', NEW.km_realizados,
            'tempo_total_minutos', NEW.tempo_total_minutos,
            'comprovante_url', NEW.comprovante_url,
            'recebedor_nome', v_recebedor_nome,
            'status', NEW.status,
            'observacoes', NEW.observacoes
        ),
        jsonb_build_object(
            'trigger_name', 'trg_evento_operacao_finalizada',
            'source_table', 'alocacoes_escala'
        )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 4. trg_evento_os_finalizada — AFTER UPDATE status para finalizada/encerrada
CREATE OR REPLACE FUNCTION public.trg_evento_os_finalizada()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_nome TEXT;
BEGIN
    SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
    FROM public.clientes WHERE id = NEW.cliente_id;

    INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
    ) VALUES (
        'os.ordem_servico.finalizada',
        'ordem_servico',
        NEW.id,
        NEW.numero,
        'active',
        'trigger',
        NEW.updated_by,
        'public',
        jsonb_build_object(
            'os_id', NEW.id,
            'numero', NEW.numero,
            'cliente_id', NEW.cliente_id,
            'cliente_nome', v_cliente_nome,
            'status', NEW.status,
            'valor_cliente', NEW.valor_cliente,
            'custo_prestador', NEW.custo_prestador,
            'data_programada', NEW.data_programada
        ),
        jsonb_build_object(
            'trigger_name', 'trg_evento_os_finalizada',
            'source_table', 'ordens_servico'
        )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
