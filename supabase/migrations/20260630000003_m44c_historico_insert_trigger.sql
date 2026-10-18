-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 44C — CORREÇÃO DO TRIGGER historico_alocacoes_escala
-- Resolve P2: trigger não registrava o evento de criação (INSERT).
-- Agora registra o status inicial em historico_alocacoes_escala no INSERT.
-- ═══════════════════════════════════════════════════════════════════════════════

-- substitui a função existente para incluir INSERT
CREATE OR REPLACE FUNCTION public.registrar_historico_alocacao()
RETURNS TRIGGER AS $$
BEGIN
    -- 0. Criação da alocação (INSERT): registra status inicial
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, status_novo, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'criacao', NEW.status,
            'Alocação criada com status ' || COALESCE(NEW.status, 'planejada'),
            jsonb_build_object(
                'origem', NEW.origem,
                'destino', NEW.destino,
                'prestador_id', NEW.prestador_id,
                'cliente_id', NEW.cliente_id,
                'data_escala', NEW.data_escala,
                'placa', NEW.placa
            ),
            NEW.created_by
        );
        RETURN NEW;
    END IF;

    -- 1. Mudança de status (UPDATE)
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, status_anterior, status_novo, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'mudanca_status', OLD.status, NEW.status,
            'Status alterado de ' || COALESCE(OLD.status, 'null') || ' para ' || COALESCE(NEW.status, 'null'),
            jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status, 'updated_by', NEW.updated_by),
            NEW.updated_by
        );
    END IF;

    -- 2. Aceite do prestador
    IF (TG_OP = 'UPDATE' AND OLD.aceite_prestador IS DISTINCT FROM NEW.aceite_prestador AND NEW.aceite_prestador = true) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'aceite_prestador', 'Prestador aceitou a alocação',
            jsonb_build_object('prestador_id', NEW.prestador_id, 'data_aceite', NEW.data_aceite),
            NEW.updated_by
        );
    END IF;

    -- 3. Finalização
    IF (TG_OP = 'UPDATE' AND OLD.finalizada IS DISTINCT FROM NEW.finalizada AND NEW.finalizada = true) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'finalizacao', 'Alocação finalizada',
            jsonb_build_object(
                'data_finalizacao', NEW.data_finalizacao,
                'km_realizados', NEW.km_realizados,
                'tempo_total_minutos', NEW.tempo_total_minutos,
                'comprovante_url', NEW.comprovante_url
            ),
            NEW.updated_by
        );
    END IF;

    -- 4. Cancelamento
    IF (TG_OP = 'UPDATE' AND OLD.status != 'cancelada' AND NEW.status = 'cancelada') THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, status_anterior, status_novo, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'cancelamento', OLD.status, NEW.status,
            'Alocação cancelada. Status anterior: ' || COALESCE(OLD.status, 'null'),
            jsonb_build_object(
                'motivo_recusa', NEW.motivo_recusa,
                'observacoes', NEW.observacoes
            ),
            NEW.updated_by
        );
    END IF;

    -- 5. Ocorrência
    IF (TG_OP = 'UPDATE' AND OLD.status != 'ocorrencia' AND NEW.status = 'ocorrencia') THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, status_anterior, status_novo, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'ocorrencia_registrada', OLD.status, NEW.status,
            'Ocorrência registrada na alocação',
            jsonb_build_object(
                'ocorrencias_count', NEW.ocorrencias_count,
                'ocorrencias_descricao', NEW.ocorrencias_descricao
            ),
            NEW.updated_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- recria o trigger (DROP + CREATE para garantir idempotência)
DROP TRIGGER IF EXISTS trg_registrar_historico_alocacao ON public.alocacoes_escala;
CREATE TRIGGER trg_registrar_historico_alocacao
    AFTER INSERT OR UPDATE ON public.alocacoes_escala
    FOR EACH ROW
    EXECUTE FUNCTION public.registrar_historico_alocacao();

-- 6. COMENTÁRIO
COMMENT ON FUNCTION public.registrar_historico_alocacao() IS 'Missão 44C: registra eventos de criação (INSERT), mudança de status, aceite, finalização, cancelamento e ocorrência em historico_alocacoes_escala.';
