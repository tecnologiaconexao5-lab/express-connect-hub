-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 02
-- Financial Margin Fix Migration
-- Data: 2026-06-26
-- Corrige: Trigger de propagacao financeira com custos completos
-- ============================================================

-- ============================================================
-- SECAO 1: Recriar trigger com custos reais
-- ============================================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;
DROP FUNCTION IF EXISTS f_trg_propagar_financeiro_alocacao();

-- Recriar funcao com custos completos
CREATE OR REPLACE FUNCTION f_trg_propagar_financeiro_alocacao()
RETURNS TRIGGER AS $$
DECLARE
    v_os_id UUID;
    v_pedagio_valor NUMERIC;
    v_combustivel_valor NUMERIC;
    v_ajudante_valor NUMERIC;
    v_adicional_valor NUMERIC;
    v_desconto_valor NUMERIC;
    v_outros_custos NUMERIC;
    v_custo_total NUMERIC;
BEGIN
    -- So propaga quando finalizada = true E status = concluida
    IF (NEW.finalizada IS NOT TRUE) OR (NEW.status IS DISTINCT FROM 'concluida') THEN
        RETURN NEW;
    END IF;

    -- Evita re-processamento se nada relevante mudou
    IF (
        OLD.finalizada IS NOT DISTINCT FROM NEW.finalizada AND
        OLD.status IS NOT DISTINCT FROM NEW.status AND
        OLD.valor_frete IS NOT DISTINCT FROM NEW.valor_frete AND
        OLD.valor_repasse IS NOT DISTINCT FROM NEW.valor_repasse AND
        OLD.valor_pedagio IS NOT DISTINCT FROM NEW.valor_pedagio AND
        OLD.valor_combustivel IS NOT DISTINCT FROM NEW.valor_combustivel AND
        OLD.valor_ajudante IS NOT DISTINCT FROM NEW.valor_ajudante AND
        OLD.valor_adicional IS NOT DISTINCT FROM NEW.valor_adicional AND
        OLD.valor_desconto IS NOT DISTINCT FROM NEW.valor_desconto
    ) THEN
        RETURN NEW;
    END IF;

    v_os_id := NEW.ordem_servico_id;

    -- ===========================================================================
    -- MISSAO 02: Agregar TODOS os custos da escala para o calculo real de margem
    -- ===========================================================================
    v_pedagio_valor     := COALESCE(NEW.valor_pedagio, 0);
    v_combustivel_valor := COALESCE(NEW.valor_combustivel, 0);
    v_ajudante_valor    := COALESCE(NEW.valor_ajudante, 0);
    v_adicional_valor   := COALESCE(NEW.valor_adicional, 0);
    v_desconto_valor    := COALESCE(NEW.valor_desconto, 0);

    -- outros_custos agora inclui TODOS os custos operacionais reais
    v_outros_custos := v_combustivel_valor
                     + v_ajudante_valor
                     + v_adicional_valor
                     - v_desconto_valor;

    -- Custo total real = base prestador + pedagio + combustivel + ajudante + adicionais - descontos
    v_custo_total := COALESCE(NEW.valor_repasse, 0)
                   + v_pedagio_valor
                   + v_outros_custos;

    -- ===========================================================================
    -- 1. Atualiza ordens_servico com dados financeiros da escala
    -- ===========================================================================
    IF v_os_id IS NOT NULL THEN
        UPDATE ordens_servico SET
            valor_cliente    = COALESCE(NEW.valor_frete, valor_cliente),
            custo_prestador  = v_custo_total,
            prestador_id     = COALESCE(NEW.prestador_id, prestador_id),
            data_programada  = COALESCE(NEW.data_escala, data_programada),
            updated_at       = now()
        WHERE id = v_os_id
          AND status != 'cancelada';
    END IF;

    -- ===========================================================================
    -- 2. Cria / Atualiza financeiro_receber (Conta a Receber do Cliente)
    -- ===========================================================================
    IF COALESCE(NEW.valor_frete, 0) > 0 THEN
        PERFORM 1 FROM financeiro_receber WHERE os_id = NEW.id LIMIT 1;
        IF NOT FOUND THEN
            INSERT INTO financeiro_receber (
                os_id, descricao, valor, status,
                cliente_id, data_vencimento
            ) VALUES (
                NEW.id,
                'Faturamento Escala ' || COALESCE(NEW.id::text, ''),
                NEW.valor_frete,
                'aberto',
                NEW.cliente_id,
                (CURRENT_DATE + INTERVAL '30 days')::date
            );
        ELSE
            UPDATE financeiro_receber SET
                valor      = NEW.valor_frete,
                cliente_id = COALESCE(NEW.cliente_id, cliente_id),
                status     = CASE WHEN status = 'cancelado' THEN 'aberto' ELSE status END
            WHERE os_id = NEW.id;
        END IF;
    END IF;

    -- ===========================================================================
    -- 3. Cria / Atualiza financeiro_pagar (Conta a Pagar ao Prestador)
    -- ===========================================================================
    IF v_custo_total > 0 AND NEW.prestador_id IS NOT NULL THEN
        PERFORM 1 FROM financeiro_pagar WHERE os_id = NEW.id LIMIT 1;
        IF NOT FOUND THEN
            INSERT INTO financeiro_pagar (
                os_id, descricao, valor, status,
                fornecedor_id, fornecedor_nome, data_vencimento
            ) VALUES (
                NEW.id,
                'Pagamento Prestador Escala ' || COALESCE(NEW.id::text, ''),
                v_custo_total,
                'aberto',
                NEW.prestador_id,
                '',
                (CURRENT_DATE + INTERVAL '15 days')::date
            );
        ELSE
            UPDATE financeiro_pagar SET
                valor          = v_custo_total,
                fornecedor_id  = COALESCE(NEW.prestador_id, fornecedor_id),
                status         = CASE WHEN status = 'cancelado' THEN 'aberto' ELSE status END
            WHERE os_id = NEW.id;
        END IF;
    END IF;

    -- ===========================================================================
    -- 4. Cria / Atualiza pagamentos_prestadores (Repasse ao Prestador)
    -- ===========================================================================
    IF v_custo_total > 0 AND NEW.prestador_id IS NOT NULL THEN
        PERFORM 1 FROM pagamentos_prestadores WHERE os_id = NEW.id LIMIT 1;
        IF NOT FOUND THEN
            INSERT INTO pagamentos_prestadores (
                prestador_id, os_id, os_numero,
                tipo_lancamento, natureza,
                valor, valor_liquido, valor_servicos,
                data_competencia, data_prevista_pagamento,
                status_conferencia, status_pagamento,
                origem_lancamento, quantidade_os,
                categoria_financeira
            ) VALUES (
                NEW.prestador_id, NEW.id,
                'ALOC-' || substring(NEW.id::text, 1, 8),
                'Serviço Escala', 'credito',
                v_custo_total, v_custo_total, v_custo_total,
                COALESCE(NEW.data_escala, CURRENT_DATE),
                (CURRENT_DATE + INTERVAL '15 days')::date,
                'em_aberto', 'pendente',
                'trigger_escala', 1,
                'Custo Logístico'
            );
        ELSE
            UPDATE pagamentos_prestadores SET
                valor          = v_custo_total,
                valor_liquido  = v_custo_total,
                valor_servicos = v_custo_total,
                prestador_id   = COALESCE(NEW.prestador_id, prestador_id),
                status_pagamento = CASE WHEN status_pagamento = 'cancelado' THEN 'pendente' ELSE status_pagamento END
            WHERE os_id = NEW.id;
        END IF;
    END IF;

    -- ===========================================================================
    -- 5. Cria / Atualiza composicao_financeira_os (MARGEM REAL)
    --    MISSAO 02: outros_custos agora inclui TODOS os custos operacionais
    --    imposto = 4.5% (PIS/COFINS/ISS estimado)
    --    seguro = 1% (estimativa de seguro de carga)
    -- ===========================================================================
    IF COALESCE(NEW.valor_frete, 0) > 0 THEN
        INSERT INTO composicao_financeira_os (
            os_id, cliente_id, prestador_id,
            valor_cliente, valor_prestador,
            imposto_percentual, imposto_valor, seguro_valor,
            pedagio_valor, outros_custos,
            combustivel_valor, ajudante_valor, adicional_valor, desconto_valor
        ) VALUES (
            v_os_id, NEW.cliente_id, NEW.prestador_id,
            NEW.valor_frete, COALESCE(NEW.valor_repasse, 0),
            4.5,
            ROUND(NEW.valor_frete * 4.5 / 100, 2),
            ROUND(NEW.valor_frete * 0.01, 2),
            v_pedagio_valor, v_outros_custos,
            v_combustivel_valor, v_ajudante_valor, v_adicional_valor, v_desconto_valor
        )
        ON CONFLICT (os_id) DO UPDATE SET
            valor_cliente      = NEW.valor_frete,
            valor_prestador    = COALESCE(NEW.valor_repasse, 0),
            imposto_percentual = 4.5,
            imposto_valor      = ROUND(NEW.valor_frete * 4.5 / 100, 2),
            seguro_valor       = ROUND(NEW.valor_frete * 0.01, 2),
            pedagio_valor      = v_pedagio_valor,
            outros_custos      = v_outros_custos,
            combustivel_valor  = v_combustivel_valor,
            ajudante_valor     = v_ajudante_valor,
            adicional_valor    = v_adicional_valor,
            desconto_valor     = v_desconto_valor;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- SECAO 2: Recriar o trigger
-- ============================================================
CREATE TRIGGER trg_propagar_financeiro_alocacao
    AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto
    ON alocacoes_escala
    FOR EACH ROW
    EXECUTE FUNCTION f_trg_propagar_financeiro_alocacao();

-- ============================================================
-- SECAO 3: Adicionar colunas faltantes em composicao_financeira_os
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' AND column_name = 'combustivel_valor') THEN
        ALTER TABLE composicao_financeira_os ADD COLUMN combustivel_valor NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' AND column_name = 'ajudante_valor') THEN
        ALTER TABLE composicao_financeira_os ADD COLUMN ajudante_valor NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' AND column_name = 'adicional_valor') THEN
        ALTER TABLE composicao_financeira_os ADD COLUMN adicional_valor NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' AND column_name = 'desconto_valor') THEN
        ALTER TABLE composicao_financeira_os ADD COLUMN desconto_valor NUMERIC DEFAULT 0;
    END IF;
END $$;

-- ============================================================
-- SECAO 4: UNIQUE constraint em financeiro_receber e pagamentos_prestadores
-- ============================================================
DO $$ BEGIN
    ALTER TABLE financeiro_receber ADD CONSTRAINT uq_fr_os_id UNIQUE (os_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE pagamentos_prestadores ADD CONSTRAINT uq_pp_os_id UNIQUE (os_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SECAO 5: Funcao de conciliacao financeira
-- ============================================================
CREATE OR REPLACE FUNCTION fn_conciliar_financeiro_os(p_os_id UUID DEFAULT NULL)
RETURNS TABLE(
    os_id UUID,
    os_numero TEXT,
    status_os TEXT,
    valor_cliente_os NUMERIC,
    valor_receber NUMERIC,
    valor_pagar NUMERIC,
    valor_prestador NUMERIC,
    margem_bruta NUMERIC,
    divergencia_receber NUMERIC,
    divergencia_pagar NUMERIC,
    status_conciliacao TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        os.id,
        os.numero,
        os.status::TEXT,
        COALESCE(os.valor_cliente, 0) AS valor_cliente_os,
        COALESCE(fr.valor, 0) AS valor_receber,
        COALESCE(fp.valor, 0) AS valor_pagar,
        COALESCE(pp.valor, 0) AS valor_prestador,
        COALESCE(cf.margem_bruta, 0) AS margem_bruta,
        COALESCE(os.valor_cliente, 0) - COALESCE(fr.valor, 0) AS divergencia_receber,
        COALESCE(os.custo_prestador, 0) - COALESCE(fp.valor, 0) AS divergencia_pagar,
        CASE
            WHEN COALESCE(os.valor_cliente, 0) != COALESCE(fr.valor, 0) THEN 'DIVERGENTE'
            WHEN COALESCE(os.custo_prestador, 0) != COALESCE(fp.valor, 0) THEN 'DIVERGENTE'
            ELSE 'CONCILIADO'
        END AS status_conciliacao
    FROM ordens_servico os
    LEFT JOIN financeiro_receber fr ON fr.os_id = os.id
    LEFT JOIN financeiro_pagar fp ON fp.os_id = os.id
    LEFT JOIN pagamentos_prestadores pp ON pp.os_id = os.id
    LEFT JOIN composicao_financeira_os cf ON cf.os_id = os.id
    WHERE (p_os_id IS NULL OR os.id = p_os_id)
      AND os.status = 'finalizada'
    ORDER BY os.created_at DESC
    LIMIT 500;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- FIM DA MIGRATION MISSAO 02
-- ============================================================
