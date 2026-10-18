-- ============================================================
-- FIN-MOT-1 — EXTRATO DE FECHAMENTO DO PRESTADOR
-- Migration para criação da estrutura de extrato profissional
-- ============================================================

-- Tabela principal: fechamentos_prestador
CREATE TABLE IF NOT EXISTS fechamentos_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação do fechamento
  numero TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  data_geracao TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prestador
  prestador_id UUID NOT NULL REFERENCES prestadores(id),
  prestador_nome TEXT NOT NULL,
  prestador_documento TEXT,
  prestador_telefone TEXT,
  prestador_email TEXT,
  
  -- Veículo (quando aplicável)
  veiculo_id UUID REFERENCES veiculos(id),
  veiculo_tipo TEXT,
  veiculo_placa TEXT,
  
  -- Status e aprovação
  status TEXT NOT NULL DEFAULT 'em_conferencia',
  status_conferencia TEXT DEFAULT 'em_aberto',
  status_aprovacao TEXT DEFAULT 'aguardando_aprovacao',
  status_pagamento TEXT DEFAULT 'pendente',
  
  -- Dados bancários (para pagamento)
  forma_pagamento TEXT,
  chave_pix TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT,
  
  -- Valores financeiros
  valor_servicos NUMERIC DEFAULT 0,
  valor_pedagio NUMERIC DEFAULT 0,
  valor_ajudante NUMERIC DEFAULT 0,
  valor_adicionais NUMERIC DEFAULT 0,
  valor_reembolsos NUMERIC DEFAULT 0,
  valor_bonus NUMERIC DEFAULT 0,
  valor_descontos NUMERIC DEFAULT 0,
  valor_adiantamentos NUMERIC DEFAULT 0,
  valor_combustivel NUMERIC DEFAULT 0,
  valor_total_creditos NUMERIC DEFAULT 0,
  valor_total_debitos NUMERIC DEFAULT 0,
  valor_liquido NUMERIC DEFAULT 0,
  
  -- Informações de pagamento (quando pago)
  data_pagamento DATE,
  valor_pago NUMERIC DEFAULT 0,
  comprovante_pagamento TEXT,
  forma_pagamento_realizada TEXT,
  
  -- Rastreamento
  origem_lancamento TEXT DEFAULT 'manual',
  elegivel_lote BOOLEAN DEFAULT false,
  lote_id UUID,
  
  -- Observações e controle
  observacoes TEXT,
  observacoes_internas TEXT,
  usuario_gerador UUID,
  usuario_aprovador UUID,
  data_aprovacao TIMESTAMPTZ,
  data_conferencia TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tenancy
  tenant_id UUID REFERENCES tenants(id),
  
  -- Constraints
  CONSTRAINT fechamentos_prestador_status_check CHECK (status IN ('em_conferencia', 'conferido', 'aprovado', 'rejeitado', 'programado', 'pago', 'cancelado')),
  CONSTRAINT fechamentos_prestador_status_conferencia_check CHECK (status_conferencia IN ('em_aberto', 'conferido', 'divergente')),
  CONSTRAINT fechamentos_prestador_status_aprovacao_check CHECK (status_aprovacao IN ('aguardando_aprovacao', 'aprovado', 'rejeitado')),
  CONSTRAINT fechamentos_prestador_status_pagamento_check CHECK (status_pagamento IN ('pendente', 'programado', 'em_lote', 'pago', 'cancelado'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fechamentos_prestador_prestador_id ON fechamentos_prestador(prestador_id);
CREATE INDEX IF NOT EXISTS idx_fechamentos_prestador_periodo_inicio ON fechamentos_prestador(periodo_inicio);
CREATE INDEX IF NOT EXISTS idx_fechamentos_prestador_periodo_fim ON fechamentos_prestador(periodo_fim);
CREATE INDEX IF NOT EXISTS idx_fechamentos_prestador_status ON fechamentos_prestador(status);
CREATE INDEX IF NOT EXISTS idx_fechamentos_prestador_status_pagamento ON fechamentos_prestador(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_fechamentos_prestador_numero ON fechamentos_prestador(numero);

-- Tabela: itens_fechamento_prestador (linhas de produção)
CREATE TABLE IF NOT EXISTS itens_fechamento_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID NOT NULL REFERENCES fechamentos_prestador(id) ON DELETE CASCADE,
  
  -- Origem da operação
  origem_tipo TEXT NOT NULL, -- 'ordem_servico', 'alocacao_escala', 'manual'
  origem_id UUID NOT NULL,
  
  -- Dados da operação
  data_operacao DATE NOT NULL,
  os_numero TEXT,
  os_id UUID REFERENCES ordens_servico(id),
  romaneio_oc TEXT,
  cliente_id UUID REFERENCES clientes(id),
  cliente_nome TEXT,
  cliente_documento TEXT,
  
  -- Dados do serviço
  tipo_servico TEXT,
  descricao_servico TEXT,
  distancia_km NUMERIC DEFAULT 0,
  tempo_estimado_minutos INTEGER DEFAULT 0,
  
  -- Valores financeiros
  valor_base NUMERIC DEFAULT 0,
  valor_km_adicional NUMERIC DEFAULT 0,
  valor_pedagio NUMERIC DEFAULT 0,
  valor_ajudante NUMERIC DEFAULT 0,
  valor_adicionais NUMERIC DEFAULT 0,
  valor_reembolsos NUMERIC DEFAULT 0,
  valor_descontos NUMERIC DEFAULT 0,
  valor_total NUMERIC DEFAULT 0,
  
  -- Status e controle
  status_operacao TEXT,
  status_financeiro TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tenancy
  tenant_id UUID REFERENCES tenants(id),
  
  CONSTRAINT itens_fechamento_prestador_origem_tipo_check CHECK (origem_tipo IN ('ordem_servico', 'alocacao_escala', 'manual'))
);

-- Índices para itens
CREATE INDEX IF NOT EXISTS idx_itens_fechamento_fechamento_id ON itens_fechamento_prestador(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_itens_fechamento_origem ON itens_fechamento_prestador(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_itens_fechamento_data_operacao ON itens_fechamento_prestador(data_operacao);
CREATE INDEX IF NOT EXISTS idx_itens_fechamento_os_id ON itens_fechamento_prestador(os_id);

-- Tabela: movimentos_conta_corrente_prestador (descontos, adiantamentos, combustível)
CREATE TABLE IF NOT EXISTS movimentos_conta_corrente_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES prestadores(id),
  fechamento_id UUID REFERENCES fechamentos_prestador(id),
  
  -- Identificação do movimento
  data_movimento DATE NOT NULL,
  tipo_movimento TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  
  -- Referência
  referencia TEXT,
  estabelecimento TEXT,
  autorizacao TEXT,
  origem_id UUID,
  origem_tipo TEXT,
  
  -- Valores
  valor NUMERIC NOT NULL DEFAULT 0,
  natureza TEXT NOT NULL DEFAULT 'debito', -- 'credito' ou 'debito'
  
  -- Status
  status TEXT DEFAULT 'pendente',
  status_aprovacao TEXT DEFAULT 'aguardando_aprovacao',
  
  -- Observações
  observacoes TEXT,
  observacoes_internas TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  usuario_criador UUID,
  usuario_aprovador UUID,
  
  -- Tenancy
  tenant_id UUID REFERENCES tenants(id),
  
  CONSTRAINT movimentos_conta_corrente_tipo_movimento_check CHECK (tipo_movimento IN ('combustivel', 'adiantamento', 'vale', 'convenio', 'desconto', 'ajuste', 'outro')),
  CONSTRAINT movimentos_conta_corrente_natureza_check CHECK (natureza IN ('credito', 'debito')),
  CONSTRAINT movimentos_conta_corrente_status_check CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'liquidado'))
);

-- Índices para movimentos
CREATE INDEX IF NOT EXISTS idx_movimentos_prestador_id ON movimentos_conta_corrente_prestador(prestador_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_fechamento_id ON movimentos_conta_corrente_prestador(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_data_movimento ON movimentos_conta_corrente_prestador(data_movimento);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo_movimento ON movimentos_conta_corrente_prestador(tipo_movimento);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fechamentos_prestador_updated_at
  BEFORE UPDATE ON fechamentos_prestador
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_itens_fechamento_prestador_updated_at
  BEFORE UPDATE ON itens_fechamento_prestador
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_movimentos_conta_corrente_prestador_updated_at
  BEFORE UPDATE ON movimentos_conta_corrente_prestador
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Função para gerar número do fechamento
CREATE OR REPLACE FUNCTION gerar_numero_fechamento_prestador()
RETURNS TEXT AS $$
DECLARE
  ano TEXT;
  sequencia INTEGER;
  numero_formatado TEXT;
BEGIN
  ano := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Buscar sequência atual
  SELECT COALESCE(MAX(SUBSTRING(numero FROM 'FP-(\d+)-(\d+)')::INTEGER), 0) + 1
  INTO sequencia
  FROM fechamentos_prestador
  WHERE numero LIKE 'FP-' || ano || '-%';
  
  -- Formatar número
  numero_formatado := 'FP-' || ano || '-' || LPAD(sequencia::TEXT, comparative_length => 6, fill_text => '0');
  
  RETURN numero_formatado;
END;
$$ LANGUAGE plpgsql;

-- Policy RLS para segurança
ALTER TABLE fechamentos_prestador ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_fechamento_prestador ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentos_conta_corrente_prestador ENABLE ROW LEVEL SECURITY;

-- Policies para authenticated users
CREATE POLICY fechamentos_prestador_select_policy ON fechamentos_prestador
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY fechamentos_prestador_insert_policy ON fechamentos_prestador
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY fechamentos_prestador_update_policy ON fechamentos_prestador
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY itens_fechamento_select_policy ON itens_fechamento_prestador
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY itens_fechamento_insert_policy ON itens_fechamento_prestador
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY movimentos_prestador_select_policy ON movimentos_conta_corrente_prestador
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY movimentos_prestador_insert_policy ON movimentos_conta_corrente_prestador
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Comentários para documentação
COMMENT ON TABLE fechamentos_prestador IS 'Tabela principal de fechamentos/faturamento de prestadores - FIN-MOT-1';
COMMENT ON TABLE itens_fechamento_prestador IS 'Linhas de produção/detalhes das operações do fechamento - FIN-MOT-1';
COMMENT ON TABLE movimentos_conta_corrente_prestador IS 'Movimentos de conta corrente (descontos, adiantamentos, combustível) - FIN-MOT-1';