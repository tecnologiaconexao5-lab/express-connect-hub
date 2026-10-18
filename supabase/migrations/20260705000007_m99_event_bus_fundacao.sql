-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 99
-- Event Bus Enterprise — Fundacao Oficial
-- Data: 2026-07-05
--
-- Cria a tabela eventos_oficiais como fonte unica de eventos.
-- Nenhuma tabela existente e removida. Coexistencia total.
-- ============================================================

-- ============================================================
-- SECAO 1: TABELA EVENTOS_OFICIAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.eventos_oficiais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT public.current_tenant_id_safe(),
    event_type      TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    entity_number   TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    source          TEXT NOT NULL DEFAULT 'service',
    created_by      UUID,
    visibility      TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'internal', 'admin')),
    payload         JSONB NOT NULL DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    version         TEXT NOT NULL DEFAULT '1.0',
    retry_count     INTEGER NOT NULL DEFAULT 0
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_type ON public.eventos_oficiais (event_type);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_entity ON public.eventos_oficiais (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_tenant ON public.eventos_oficiais (tenant_id);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_created ON public.eventos_oficiais (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_visibility ON public.eventos_oficiais (visibility);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_status ON public.eventos_oficiais (status);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_source ON public.eventos_oficiais (source);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.trg_eventos_oficiais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.processed_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eventos_oficiais_updated_at
    BEFORE UPDATE ON public.eventos_oficiais
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_eventos_oficiais_updated_at();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos_oficiais;

-- ============================================================
-- SECAO 2: RLS
-- ============================================================

ALTER TABLE public.eventos_oficiais ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "eventos_oficiais_admin_select"
    ON public.eventos_oficiais FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "eventos_oficiais_admin_insert"
    ON public.eventos_oficiais FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "eventos_oficiais_admin_update"
    ON public.eventos_oficiais FOR UPDATE
    TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "eventos_oficiais_admin_delete"
    ON public.eventos_oficiais FOR DELETE
    TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- ============================================================
-- SECAO 3: TRIGGERS PRODUTORES
-- ============================================================

-- 3.1 Trigger: OS criada → evento oficial
CREATE OR REPLACE FUNCTION public.trg_evento_os_criada()
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
            'status', NEW.status,
            'origem', NEW.origem,
            'destino', NEW.destino,
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
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_os_criada
    AFTER INSERT ON public.ordens_servico
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_evento_os_criada();

-- 3.2 Trigger: Prestador aceitou alocacao → evento oficial
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
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_prestador_aceitou
    AFTER UPDATE OF aceite_prestador ON public.alocacoes_escala
    FOR EACH ROW
    WHEN (NEW.aceite_prestador = true AND (OLD.aceite_prestador IS DISTINCT FROM NEW.aceite_prestador))
    EXECUTE FUNCTION public.trg_evento_prestador_aceitou();

-- 3.3 Trigger: Operacao finalizada (alocacao concluida) → evento oficial
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
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_operacao_finalizada
    AFTER UPDATE OF finalizada ON public.alocacoes_escala
    FOR EACH ROW
    WHEN (NEW.finalizada = true AND (OLD.finalizada IS DISTINCT FROM NEW.finalizada))
    EXECUTE FUNCTION public.trg_evento_operacao_finalizada();

-- 3.4 Trigger: OS finalizada → evento oficial
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
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_os_finalizada
    AFTER UPDATE OF status ON public.ordens_servico
    FOR EACH ROW
    WHEN (NEW.status IN ('finalizada', 'encerrada') AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.trg_evento_os_finalizada();
