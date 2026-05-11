-- ==========================================
-- MIGRATION: TABELA PRESTADOR + COMPOSIÇÃO FINANCEIRA
-- Data: 2026-04-27
-- Objetivo: Separar valor cliente, custo prestador e custos operacionais
-- ==========================================

-- ==========================================
-- 1. TABELA PRESTADOR (Tabela de Preços do Prestador)
-- ==========================================

CREATE TABLE IF NOT EXISTS tabela_prestador (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL,
  tipo_veiculo text,
  regiao text,
  valor_minimo numeric DEFAULT 0,
  km_incluso integer DEFAULT 0,
  valor_km numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  prestador_id uuid REFERENCES prestadores(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tabela_prestador_regiao ON tabela_prestador(regiao);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_tipo_veiculo ON tabela_prestador(tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_ativo ON tabela_prestador(ativo);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_prestador ON tabela_prestador(prestador_id);

-- Comentários
COMMENT ON TABLE tabela_prestador IS 'Tabela de preços e condições por prestador/veículo/região';
COMMENT ON COLUMN tabela_prestador.nome IS 'Nome identificador da tabela';
COMMENT ON COLUMN tabela_prestador.tipo_veiculo IS 'Tipo de veículo (Van, Toco, Truck, etc.)';
COMMENT ON COLUMN tabela_prestador.regiao IS 'Região de atendimento (CEP, Cidade ou Nome)';
COMMENT ON COLUMN tabela_prestador.valor_minimo IS 'Valor mínimo da corrida';
COMMENT ON COLUMN tabela_prestador.km_incluso IS 'KM inclusos no valor mínimo';
COMMENT ON COLUMN tabela_prestador.valor_km IS 'Valor cobrado por KM excedente';
COMMENT ON COLUMN tabela_prestador.prestador_id IS 'Referência direta ao prestador (opcional)';

-- ==========================================
-- 2. COMPOSIÇÃO FINANCEIRA
-- ==========================================

CREATE TABLE IF NOT EXISTS composicao_financeira (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  os_id uuid REFERENCES ordens_servico(id) ON DELETE CASCADE,
  valor_cliente numeric DEFAULT 0,
  valor_prestador numeric DEFAULT 0,
  impostos numeric DEFAULT 0,
  seguro numeric DEFAULT 0,
  pedagio numeric DEFAULT 0,
  outros numeric DEFAULT 0,
  margem_bruta numeric DEFAULT 0,
  margem_liquida numeric DEFAULT 0,
  percentual_margem_bruta numeric DEFAULT 0,
  percentual_margem_liquida numeric DEFAULT 0,
  custos_operacionais numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_composicao_financeira_os ON composicao_financeira(os_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_composicao_financeira_os_unique ON composicao_financeira(os_id);

-- Comentários
COMMENT ON TABLE composicao_financeira IS 'Composição detalhada de custos e margens por OS';
COMMENT ON COLUMN composicao_financeira.valor_cliente IS 'Valor faturado ao cliente';
COMMENT ON COLUMN composicao_financeira.valor_prestador IS 'Custo pago ao prestador';
COMMENT ON COLUMN composicao_financeira.impostos IS 'Impostos sobre a operação (PIS, COFINS, ISS, etc)';
COMMENT ON COLUMN composicao_financeira.seguro IS 'Custo de seguro da carga';
COMMENT ON COLUMN composicao_financeira.pedagio IS 'Pedágios da rota';
COMMENT ON COLUMN composicao_financeira.outros IS 'Outros custos operacionais';
COMMENT ON COLUMN composicao_financeira.margem_bruta IS 'valor_cliente - valor_prestador - pedagio - outros';
COMMENT ON COLUMN composicao_financeira.margem_liquida IS 'margem_bruta - impostos - seguro';
COMMENT ON COLUMN composicao_financeira.percentual_margem_bruta IS 'margem_bruta / valor_cliente * 100';
COMMENT ON COLUMN composicao_financeira.percentual_margem_liquida IS 'margem_liquida / valor_cliente * 100';
COMMENT ON COLUMN composicao_financeira.custos_operacionais IS 'impostos + seguro + pedagio + outros';

-- ==========================================
-- 3. FUNÇÃO PARA CÁLCULO AUTOMÁTICO DE MARGENS
-- ==========================================

CREATE OR REPLACE FUNCTION calcular_margens_financeiras()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular custos operacionais
  NEW.custos_operacionais = COALESCE(NEW.impostos, 0) + COALESCE(NEW.seguro, 0) + COALESCE(NEW.pedagio, 0) + COALESCE(NEW.outros, 0);
  
  -- Calcular margem bruta: valor cliente - valor prestador - pedagio - outros
  NEW.margem_bruta = COALESCE(NEW.valor_cliente, 0) - COALESCE(NEW.valor_prestador, 0) - COALESCE(NEW.pedagio, 0) - COALESCE(NEW.outros, 0);
  
  -- Calcular margem líquida: margem bruta - impostos - seguro
  NEW.margem_liquida = NEW.margem_bruta - COALESCE(NEW.impostos, 0) - COALESCE(NEW.seguro, 0);
  
  -- Calcular percentuais (evitar divisão por zero)
  IF COALESCE(NEW.valor_cliente, 0) > 0 THEN
    NEW.percentual_margem_bruta = (NEW.margem_bruta / NEW.valor_cliente) * 100;
    NEW.percentual_margem_liquida = (NEW.margem_liquida / NEW.valor_cliente) * 100;
  ELSE
    NEW.percentual_margem_bruta = 0;
    NEW.percentual_margem_liquida = 0;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para cálculo automático
DROP TRIGGER IF EXISTS trigger_calcular_margens ON composicao_financeira;
CREATE TRIGGER trigger_calcular_margens
  BEFORE INSERT OR UPDATE ON composicao_financeira
  FOR EACH ROW
  EXECUTE FUNCTION calcular_margens_financeiras();

-- ==========================================
-- 4. RLS (ROW LEVEL SECURITY)
-- ==========================================

ALTER TABLE tabela_prestador ENABLE ROW LEVEL SECURITY;
ALTER TABLE composicao_financeira ENABLE ROW LEVEL SECURITY;

-- Policies (exemplo, ajustar conforme necessidade)
CREATE POLICY view_all_tabela_prestador ON tabela_prestador 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY view_all_composicao_financeira ON composicao_financeira 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tabela_prestador;
ALTER PUBLICATION supabase_realtime ADD TABLE composicao_financeira;

-- ==========================================
-- MIGRATION COMPLETED
-- ==========================================
