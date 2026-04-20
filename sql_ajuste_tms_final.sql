-- ============================================================
-- EXPRESS CONNECT HUB - SQL AJUSTE FINAL TMS
-- Apenas colunas que FALTAM no banco vs frontend
-- Execute no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. FINANCEIRO_RECEBER - Campos que o frontend envia
-- ============================================================

-- Campos principais que faltam
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(12,2);
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2);
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS data_previsao_recebimento DATE;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS data_recebimento DATE;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS os_vinculadas TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS contrato_vinculado TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS proposta_vinculada TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS serie TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS documento TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT false;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS quantidade_parcelas INTEGER DEFAULT 1;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS parcela_atual INTEGER DEFAULT 1;

-- Campos financeiros adicionais
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS juros NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS multa NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS abatimento NUMERIC(12,2) DEFAULT 0;

-- Compatibilidade: manter "vencimento" como alias para data_vencimento
-- O banco já tem data_vencimento, não precisa de coluna adicional

-- ============================================================
-- 2. FINANCEIRO_PAGAR - Campos que o frontend envia
-- ============================================================

-- Campos principais
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS os_vinculada TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS contrato_vinculado TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS proposta_vinculada TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS serie TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS documento TEXT;

-- Campos financeiros
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(12,2);
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2);
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS data_previsao_pagamento DATE;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS juros NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS multa NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT false;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS quantidade_parcelas INTEGER DEFAULT 1;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS parcela_atual INTEGER DEFAULT 1;

-- ============================================================
-- 3. ORDENS_SERVICO - Campos adicionais do frontend
-- ============================================================

ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS orcamento_origem TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculo_alocado TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_tipo TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_descricao TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS volumes INTEGER DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS peso NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cubagem NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS pallets INTEGER DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS valor_declarado NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS qtd_notas INTEGER DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_refrigerada BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_ajudante BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_fragil BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_empilhavel BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS carga_risco BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS conferencia_obrigatoria BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS equipamento_obrigatorio TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS condicao_transporte TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculo_tipo TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculo_subcategoria TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculo_carroceria TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculo_termica TEXT DEFAULT 'seco';
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS is_reserva BOOLEAN DEFAULT false;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS retorno_obrigatorio BOOLEAN DEFAULT false;

-- Campos programming
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS data_programada DATE;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS janela_operacional TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS previsao_inicio TIMESTAMPTZ;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS previsao_termino TIMESTAMPTZ;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tipo_escala TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS instrucoes_operacionais TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS observacao_torre TEXT;

-- Campos financeiro OS
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS pedagio NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS ajudante NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS adicionais NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS descontos NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS reembolso_previsto NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS conta_contabil TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS centro_custo_fin TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS status_faturamento TEXT DEFAULT 'a faturar';
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'a pagar';

-- Campos notificação
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS email_destinatario TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS whatsapp_destinatario TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS notificar_destinatario BOOLEAN DEFAULT true;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS eventos_tracker TEXT DEFAULT 'principais';

-- ============================================================
-- 4. INDEXES ADICIONAIS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_financeiro_receber_cliente ON public.financeiro_receber(cliente);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_data_vencimento ON public.financeiro_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_status ON public.financeiro_receber(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_prestador ON public.financeiro_pagar(prestador);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_data_vencimento ON public.financeiro_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_status ON public.financeiro_pagar(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente ON public.ordens_servico(cliente);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_prestador ON public.ordens_servico(prestador);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data_programada ON public.ordens_servico(data_programada);
CREATE INDEX IF NOT EXISTS idx_os_historico_os_id ON public.os_historico(os_id);

-- ============================================================
-- 5. POLICIES (apenas se não existirem)
-- ============================================================

--As políticas "Allow all" já existem no schema completo anterior
--Se for primeiro ajuste, descomentar abaixo:
--ALTER TABLE public.financeiro_receber ENABLE ROW LEVEL SECURITY;
--ALTER TABLE public.financeiro_pagar ENABLE ROW LEVEL SECURITY;
--ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
--ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;

--CREATE POLICY "Allow all on financeiro_receber" ON public.financeiro_receber FOR ALL USING (true) WITH CHECK (true);
--CREATE POLICY "Allow all on financeiro_pagar" ON public.financeiro_pagar FOR ALL USING (true) WITH CHECK (true);
--CREATE POLICY "Allow all on ordens_servico" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);
--CREATE POLICY "Allow all on os_historico" ON public.os_historico FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM DO SQL DE AJUSTE
-- ============================================================