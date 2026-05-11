-- ==========================================
-- MIGRATION: TABELA PRESTADOR OPERACIONAL + COMPOSIÇÃO FINANCEIRA OS
-- Data: 2026-04-27
-- Objetivo: Professional cost separation and real margins
-- ==========================================

-- ==========================================
-- 1. TABELA PRESTADOR (Operacional)
-- ==========================================

CREATE TABLE IF NOT EXISTS tabela_prestador (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  prestador_id uuid REFERENCES prestadores(id),
  tipo_veiculo text,
  regiao text,
  cidade text,
  uf text,
  valor_minimo numeric DEFAULT 0,
  km_incluso numeric DEFAULT 0,
  valor_km numeric DEFAULT 0,
  valor_diaria numeric DEFAULT 0,
  valor_saida numeric DEFAULT 0,
  percentual_bonus numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tabela_prestador_tipo_veiculo ON tabela_prestador(tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_ativo ON tabela_prestador(ativo);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_prestador ON tabela_prestador(prestador_id);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_regiao ON tabela_prestador(regiao);

COMMENT ON TABLE tabela_prestador IS 'Tabela de preços operacional por prestador/veículo/região';
COMMENT ON COLUMN tabela_prestador.nome IS 'Nome identificador da tabela';
COMMENT ON COLUMN tabela_prestador.prestador_id IS 'Referência direta ao prestador (opcional)';
COMMENT ON COLUMN tabela_prestador.tipo_veiculo IS 'Tipo de veículo (Van, Toco, Truck, etc.)';
COMMENT ON COLUMN tabela_prestador.regiao IS 'Região de atendimento (CEP, Cidade ou Nome)';
COMMENT ON COLUMN tabela_prestador.valor_minimo IS 'Valor mínimo da corrida';
COMMENT ON COLUMN tabela_prestador.km_incluso IS 'KM inclusos no valor mínimo';
COMMENT ON COLUMN tabela_prestador.valor_km IS 'Valor cobrado por KM excedente';
COMMENT ON COLUMN tabela_prestador.valor_diaria IS 'Valor da diária (caso aplicável)';
COMMENT ON COLUMN tabela_prestador.valor_saida IS 'Valor de saída (taxa fixa)';
COMMENT ON COLUMN tabela_prestador.percentual_bonus IS 'Percentual de bônus para o prestador';

-- ==========================================
-- 2. COMPOSIÇÃO FINANCEIRA OS
-- ==========================================

CREATE TABLE IF NOT EXISTS composicao_financeira_os (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id),
  prestador_id uuid REFERENCES prestadores(id),
  valor_cliente numeric DEFAULT 0,
  valor_prestador numeric DEFAULT 0,
  imposto_percentual numeric DEFAULT 0,
  imposto_valor numeric DEFAULT 0,
  seguro_valor numeric DEFAULT 0,
  pedagio_valor numeric DEFAULT 0,
  outros_custos numeric DEFAULT 0,
  margem_bruta numeric DEFAULT 0,
  margem_liquida numeric DEFAULT 0,
  percentual_margem_bruta numeric DEFAULT 0,
  percentual_margem_liquida numeric DEFAULT 0,
  origem_calculo text DEFAULT 'ordem_servico',
  calculado_em timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_composicao_financeira_os_unique ON composicao_financeira_os(os_id);
CREATE INDEX IF NOT EXISTS idx_composicao_financeira_os_cliente ON composicao_financeira_os(cliente_id);
CREATE INDEX IF NOT EXISTS idx_composicao_financeira_os_prestador ON composicao_financeira_os(prestador_id);

COMMENT ON TABLE composicao_financeira_os IS 'Composição detalhada de custos e margens por OS';
COMMENT ON COLUMN composicao_financeira_os.valor_cliente IS 'Valor faturado ao cliente';
COMMENT ON COLUMN composicao_financeira_os.valor_prestador IS 'Custo pago ao prestador';
COMMENT ON COLUMN composicao_financeira_os.imposto_percentual IS 'Percentual de imposto (PIS, COFINS, ISS, etc)';
COMMENT ON COLUMN composicao_financeira_os.imposto_valor IS 'Valor monetário do imposto';
COMMENT ON COLUMN composicao_financeira_os.seguro_valor IS 'Custo de seguro da carga';
COMMENT ON COLUMN composicao_financeira_os.pedagio_valor IS 'Pedágios da rota';
COMMENT ON COLUMN composicao_financeira_os.outros_custos IS 'Outros custos operacionais';
COMMENT ON COLUMN composicao_financeira_os.margem_bruta IS 'valor_cliente - valor_prestador - pedagio_valor - outros_custos';
COMMENT ON COLUMN composicao_financeira_os.margem_liquida IS 'margem_bruta - imposto_valor - seguro_valor';
COMMENT ON COLUMN composicao_financeira_os.percentual_margem_bruta IS '(margem_bruta / valor_cliente) * 100';
COMMENT ON COLUMN composicao_financeira_os.percentual_margem_liquida IS '(margem_liquida / valor_cliente) * 100';
COMMENT ON COLUMN composicao_financeira_os.origem_calculo IS 'Origem do cálculo (ordem_servico, manual, etc)';

-- ==========================================
-- 3. TRIGGER PARA CÁLCULO AUTOMÁTICO DE MARGENS
-- ==========================================

CREATE OR REPLACE FUNCTION calcular_margens_financeiras_os()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular margem bruta: valor cliente - valor prestador - pedagio - outros custos
  NEW.margem_bruta = COALESCE(NEW.valor_cliente, 0) - COALESCE(NEW.valor_prestador, 0) - COALESCE(NEW.pedagio_valor, 0) - COALESCE(NEW.outros_custos, 0);
  
  -- Calcular margem líquida: margem bruta - imposto - seguro
  NEW.margem_liquida = NEW.margem_bruta - COALESCE(NEW.imposto_valor, 0) - COALESCE(NEW.seguro_valor, 0);
  
  -- Calcular percentuais (evitar divisão por zero)
  IF COALESCE(NEW.valor_cliente, 0) > 0 THEN
    NEW.percentual_margem_bruta = (NEW.margem_bruta / NEW.valor_cliente) * 100;
    NEW.percentual_margem_liquida = (NEW.margem_liquida / NEW.valor_cliente) * 100;
  ELSE
    NEW.percentual_margem_bruta = 0;
    NEW.percentual_margem_liquida = 0;
  END IF;
  
  NEW.updated_at = now();
  NEW.calculado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_margens_os ON composicao_financeira_os;
CREATE TRIGGER trigger_calcular_margens_os
  BEFORE INSERT OR UPDATE ON composicao_financeira_os
  FOR EACH ROW
  EXECUTE FUNCTION calcular_margens_financeiras_os();

-- ==========================================
-- 4. ALTERAÇÃO DA TABELA ORDENS_SERVICO
-- ==========================================

ALTER TABLE IF EXISTS ordens_servico 
  ADD COLUMN IF NOT EXISTS tabela_prestador_id uuid,
  ADD COLUMN IF NOT EXISTS valor_prestador_calculado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margem_bruta numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margem_liquida numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imposto_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedagio_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_custos_reais numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS composicao_financeira_id uuid;

COMMENT ON COLUMN ordens_servico.tabela_prestador_id IS 'Referência à tabela do prestador usada';
COMMENT ON COLUMN ordens_servico.valor_prestador_calculado IS 'Valor calculado para o prestador';
COMMENT ON COLUMN ordens_servico.margem_bruta IS 'Margem bruta da OS';
COMMENT ON COLUMN ordens_servico.margem_liquida IS 'Margem líquida da OS';
COMMENT ON COLUMN ordens_servico.imposto_valor IS 'Valor de impostos';
COMMENT ON COLUMN ordens_servico.seguro_valor IS 'Valor de seguro';
COMMENT ON COLUMN ordens_servico.pedagio_valor IS 'Valor de pedágios';
COMMENT ON COLUMN ordens_servico.outros_custos_reais IS 'Outros custos reais';
COMMENT ON COLUMN ordens_servico.composicao_financeira_id IS 'ID da composição financeira relacionada';

-- ==========================================
-- 5. RLS (ROW LEVEL SECURITY)
-- ==========================================

ALTER TABLE tabela_prestador ENABLE ROW LEVEL SECURITY;
ALTER TABLE composicao_financeira_os ENABLE ROW LEVEL SECURITY;

-- Policies (exemplo)
CREATE POLICY IF NOT EXISTS view_all_tabela_prestador_op ON tabela_prestador
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS view_all_composicao_fin_os ON composicao_financeira_os
  FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime (opcional)
ALTER PUBLICATION supabase_realtime ADD TABLE tabela_prestador;
ALTER PUBLICATION supabase_realtime ADD TABLE composicao_financeira_os;

-- ==========================================
-- MIGRATION COMPLETED
-- ==========================================
