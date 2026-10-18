-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 03
-- Operacao Enterprise — Auditoria e Integridade
-- Data: 2026-06-26
-- ============================================================

-- ============================================================
-- SECAO 1: Trigger de auditoria operacional (OS)
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria_operacional (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Entidade auditada
    entidade_tipo TEXT NOT NULL,          -- 'ordem_servico', 'alocacao_escala', 'prestador', 'veiculo'
    entidade_id UUID NOT NULL,

    -- Acao
    acao TEXT NOT NULL,                   -- 'criacao', 'edicao', 'cancelamento', 'troca_motorista',
                                          -- 'troca_veiculo', 'finalizacao', 'reabertura', 'exclusao'
    -- Dados
    dados_anteriores JSONB,               -- Snapshot antes da alteracao
    dados_novos JSONB,                    -- Snapshot depois da alteracao
    campos_alterados TEXT[],              -- Lista de campos que mudaram

    -- Contexto
    usuario_id TEXT,
    usuario_nome TEXT,
    motivo TEXT,
    ip_origem TEXT,

    -- Vinculos
    os_id UUID,
    escala_id UUID,
    prestador_id UUID,
    veiculo_id UUID
);

CREATE INDEX IF NOT EXISTS idx_ao_entidade ON auditoria_operacional(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_ao_acao ON auditoria_operacional(acao);
CREATE INDEX IF NOT EXISTS idx_ao_os ON auditoria_operacional(os_id);
CREATE INDEX IF NOT EXISTS idx_ao_data ON auditoria_operacional(created_at);

ALTER TABLE auditoria_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ao_select_anon" ON auditoria_operacional FOR SELECT TO anon USING (true);
CREATE POLICY "ao_insert_auth" ON auditoria_operacional FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- SECAO 2: Trigger para auditoria automatica na OS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_auditar_ordem_servico()
RETURNS TRIGGER AS $$
DECLARE
    v_campos TEXT[];
BEGIN
    -- Determina quais campos mudaram
    v_campos := ARRAY[]::TEXT[];
    IF OLD.status IS DISTINCT FROM NEW.status THEN v_campos := array_append(v_campos, 'status'); END IF;
    IF OLD.valor_cliente IS DISTINCT FROM NEW.valor_cliente THEN v_campos := array_append(v_campos, 'valor_cliente'); END IF;
    IF OLD.custo_prestador IS DISTINCT FROM NEW.custo_prestador THEN v_campos := array_append(v_campos, 'custo_prestador'); END IF;
    IF OLD.prestador_id IS DISTINCT FROM NEW.prestador_id THEN v_campos := array_append(v_campos, 'prestador_id'); END IF;
    IF OLD.cliente_id IS DISTINCT FROM NEW.cliente_id THEN v_campos := array_append(v_campos, 'cliente_id'); END IF;

    -- Determina a acao
    INSERT INTO auditoria_operacional (
        entidade_tipo, entidade_id, acao,
        dados_anteriores, dados_novos, campos_alterados,
        os_id
    ) VALUES (
        'ordem_servico', NEW.id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'criacao'
            WHEN NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN 'cancelamento'
            WHEN NEW.status = 'finalizada' AND OLD.status IS DISTINCT FROM 'finalizada' THEN 'finalizacao'
            ELSE 'edicao'
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW),
        v_campos,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_auditar_os ON ordens_servico;
CREATE TRIGGER trg_auditar_os
    AFTER INSERT OR UPDATE ON ordens_servico
    FOR EACH ROW
    EXECUTE FUNCTION fn_auditar_ordem_servico();

-- ============================================================
-- SECAO 3: Indice unico parcial para conflito de motorista
-- ============================================================
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_alocacao_prestador_data
        ON alocacoes_escala(prestador_id, data_escala)
        WHERE status IN ('planejada', 'aguardando_aceite', 'aceita', 'em_rota', 'ocorrencia')
          AND prestador_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- ============================================================
-- SECAO 4: Indice unico parcial para conflito de veiculo
-- ============================================================
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_alocacao_placa_data
        ON alocacoes_escala(placa, data_escala)
        WHERE status IN ('planejada', 'aguardando_aceite', 'aceita', 'em_rota', 'ocorrencia')
          AND placa IS NOT NULL AND placa != '';
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- ============================================================
-- FIM MIGRATION MISSAO 03
-- ============================================================
