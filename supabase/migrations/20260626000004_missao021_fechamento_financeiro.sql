-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 02.1
-- Fechamento Financeiro Enterprise
-- Data: 2026-06-26
-- ============================================================

-- ============================================================
-- SECAO 1: TABELA DE BAIXAS FINANCEIRAS
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_baixas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Vinculo com o titulo
    titulo_tabela TEXT NOT NULL,          -- 'financeiro_receber' | 'financeiro_pagar' | 'pagamentos_prestadores'
    titulo_id UUID NOT NULL,

    -- Dados da baixa
    valor_original NUMERIC NOT NULL,      -- Valor do titulo ANTES desta baixa
    valor_baixado NUMERIC NOT NULL,       -- Valor pago nesta baixa
    saldo_restante NUMERIC NOT NULL,      -- Saldo APOS esta baixa

    -- Metadados
    data_baixa DATE NOT NULL DEFAULT CURRENT_DATE,
    forma_pagamento TEXT,                 -- 'pix', 'boleto', 'ted', 'dinheiro', 'cartao', 'compensacao'
    referencia_bancaria TEXT,             -- ID transacao, comprovante
    observacao TEXT,

    -- Usuario que efetuou a baixa
    usuario_id TEXT,
    usuario_nome TEXT,

    -- Estorno
    estornada BOOLEAN DEFAULT false,
    data_estorno TIMESTAMPTZ,
    motivo_estorno TEXT,

    -- Auditoria
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_fb_titulo ON financeiro_baixas(titulo_tabela, titulo_id);
CREATE INDEX IF NOT EXISTS idx_fb_data ON financeiro_baixas(data_baixa);
CREATE INDEX IF NOT EXISTS idx_fb_estorno ON financeiro_baixas(estornada) WHERE estornada = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_financeiro_baixas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fb_updated_at ON financeiro_baixas;
CREATE TRIGGER trg_fb_updated_at
    BEFORE UPDATE ON financeiro_baixas
    FOR EACH ROW EXECUTE FUNCTION update_financeiro_baixas_updated_at();

-- RLS
ALTER TABLE financeiro_baixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_select_anon" ON financeiro_baixas FOR SELECT TO anon USING (true);
CREATE POLICY "fb_insert_auth" ON financeiro_baixas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fb_update_auth" ON financeiro_baixas FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- SECAO 2: TABELA DE DESPESAS OPERACIONAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS despesas_operacionais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Classificacao
    categoria TEXT NOT NULL,              -- 'manutencao','combustivel','hospedagem','alimentacao',
                                          -- 'seguro','imposto','taxa','multa','pedagio',
                                          -- 'aluguel','software','salario','comissao',
                                          -- 'marketing','outros'
    subcategoria TEXT,                    -- Detalhamento (ex: 'pneus','oleo','freios' para manutencao)
    descricao TEXT NOT NULL,

    -- Valores
    valor NUMERIC NOT NULL CHECK (valor >= 0),
    valor_imposto NUMERIC DEFAULT 0,      -- Impostos recuperaveis (credito PIS/COFINS)

    -- Vinculos opcionais
    os_id UUID,                           -- Vinculo com OS (se for custo direto)
    prestador_id UUID,                    -- Vinculo com prestador
    veiculo_id UUID,                      -- Vinculo com veiculo (manutencao, combustivel)
    cliente_id UUID,                      -- Vinculo com cliente (se reembolsavel)

    -- Periodo
    data_competencia DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE,
    data_pagamento DATE,

    -- Status
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
    forma_pagamento TEXT,

    -- Documento
    numero_documento TEXT,                -- NF, recibo
    comprovante_url TEXT,                 -- URL do comprovante no storage

    -- Rateio (para DRE)
    rateio_percentual NUMERIC DEFAULT 100,  -- % que afeta a margem (100 = custo total, 50 = rateado)
    afeta_margem BOOLEAN DEFAULT true,      -- Se entra no calculo de margem operacional

    -- Auditoria
    usuario_id TEXT,
    observacao TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_do_categoria ON despesas_operacionais(categoria);
CREATE INDEX IF NOT EXISTS idx_do_os ON despesas_operacionais(os_id);
CREATE INDEX IF NOT EXISTS idx_do_veiculo ON despesas_operacionais(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_do_data ON despesas_operacionais(data_competencia);
CREATE INDEX IF NOT EXISTS idx_do_status ON despesas_operacionais(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_do_updated_at ON despesas_operacionais;
CREATE TRIGGER trg_do_updated_at
    BEFORE UPDATE ON despesas_operacionais
    FOR EACH ROW EXECUTE FUNCTION update_financeiro_baixas_updated_at();

-- RLS
ALTER TABLE despesas_operacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "do_select_anon" ON despesas_operacionais FOR SELECT TO anon USING (true);
CREATE POLICY "do_insert_auth" ON despesas_operacionais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "do_update_auth" ON despesas_operacionais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "do_delete_auth" ON despesas_operacionais FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SECAO 3: TRIGGER DE CANCELAMENTO — Propagar cancelamento de escala para financeiro
-- ============================================================

-- Atualizar o trigger existente para tambem tratar cancelamento
CREATE OR REPLACE FUNCTION f_trg_cancelar_financeiro_escala()
RETURNS TRIGGER AS $$
BEGIN
    -- So age quando status muda para 'cancelada'
    IF (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada') THEN
        -- Cancela financeiro_receber
        UPDATE financeiro_receber SET
            status = 'cancelado', valor = 0,
            observacao = COALESCE(observacao, '') || ' | Cancelado via escala ' || NEW.id
        WHERE os_id = NEW.id AND status != 'cancelado';

        -- Cancela financeiro_pagar
        UPDATE financeiro_pagar SET
            status = 'cancelado', valor = 0,
            observacao = COALESCE(observacao, '') || ' | Cancelado via escala ' || NEW.id
        WHERE os_id = NEW.id AND status != 'cancelado';

        -- Cancela pagamentos_prestadores
        UPDATE pagamentos_prestadores SET
            status_pagamento = 'cancelado', valor = 0, valor_liquido = 0,
            observacao = COALESCE(observacao, '') || ' | Cancelado via escala ' || NEW.id
        WHERE os_id = NEW.id AND status_pagamento != 'cancelado';

        -- Zera composicao_financeira_os
        UPDATE composicao_financeira_os SET
            valor_cliente = 0, valor_prestador = 0,
            pedagio_valor = 0, outros_custos = 0,
            combustivel_valor = 0, ajudante_valor = 0,
            adicional_valor = 0, desconto_valor = 0,
            imposto_valor = 0, seguro_valor = 0
        WHERE os_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Aplica o trigger de cancelamento
DROP TRIGGER IF EXISTS trg_cancelar_financeiro_escala ON alocacoes_escala;
CREATE TRIGGER trg_cancelar_financeiro_escala
    AFTER UPDATE OF status ON alocacoes_escala
    FOR EACH ROW
    WHEN (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada')
    EXECUTE FUNCTION f_trg_cancelar_financeiro_escala();

-- ============================================================
-- SECAO 4: FUNCAO DE ESTORNO DE BAIXA
-- ============================================================

CREATE OR REPLACE FUNCTION fn_estornar_baixa(p_baixa_id UUID)
RETURNS TABLE(sucesso BOOLEAN, mensagem TEXT) AS $$
DECLARE
    v_baixa RECORD;
    v_novo_saldo NUMERIC;
BEGIN
    SELECT * INTO v_baixa FROM financeiro_baixas WHERE id = p_baixa_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Baixa nao encontrada';
        RETURN;
    END IF;

    IF v_baixa.estornada THEN
        RETURN QUERY SELECT false, 'Baixa ja estornada';
        RETURN;
    END IF;

    -- Marca baixa como estornada
    UPDATE financeiro_baixas SET
        estornada = true,
        data_estorno = now(),
        updated_at = now()
    WHERE id = p_baixa_id;

    -- Restaura saldo no titulo original
    v_novo_saldo := v_baixa.saldo_restante + v_baixa.valor_baixado;

    IF v_baixa.titulo_tabela = 'financeiro_receber' THEN
        UPDATE financeiro_receber SET
            valor = v_novo_saldo,
            status = CASE WHEN v_novo_saldo > 0 THEN 'aberto' ELSE status END
        WHERE id = v_baixa.titulo_id;
    ELSIF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
        UPDATE financeiro_pagar SET
            valor = v_novo_saldo,
            status = CASE WHEN v_novo_saldo > 0 THEN 'aberto' ELSE status END
        WHERE id = v_baixa.titulo_id;
    ELSIF v_baixa.titulo_tabela = 'pagamentos_prestadores' THEN
        UPDATE pagamentos_prestadores SET
            valor = v_novo_saldo,
            valor_liquido = v_novo_saldo,
            status_pagamento = CASE WHEN v_novo_saldo > 0 THEN 'pendente' ELSE status_pagamento END
        WHERE id = v_baixa.titulo_id;
    END IF;

    RETURN QUERY SELECT true, 'Baixa estornada com sucesso. Saldo restaurado: ' || v_novo_saldo;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- FIM DA MIGRATION MISSAO 02.1
-- ============================================================
