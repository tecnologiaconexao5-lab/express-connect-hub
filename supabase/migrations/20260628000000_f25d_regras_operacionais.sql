-- ============================================================
-- MIGRATION: 20260628_f25d_regras_operacionais
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Regras variáveis por operação para robôs
-- Permite que cada robô tenha regras específicas por cliente,
-- operação, região e cenário real de negócio.
-- ============================================================

-- ==================== TIPO: status_regra_operacao ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_regra_operacao') THEN
    CREATE TYPE status_regra_operacao AS ENUM ('ativo', 'inativo', 'rascunho', 'vencido');
  END IF;
END
$$;

-- ==================== TABELA: automacoes_regras_operacao ====================
CREATE TABLE IF NOT EXISTS automacoes_regras_operacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  cliente_id uuid,
  nome_operacao text NOT NULL,
  setor text NOT NULL,
  -- Dados operacionais
  tipo_veiculo text,
  capacidade text,
  local_carregamento text,
  cidade_operacao text,
  horario_inicio time,
  horario_fim time,
  dias_operacao text,
  -- Dados comerciais
  valor_operacao numeric(12,2),
  modelo_pagamento text,
  km_incluso integer,
  valor_km_excedente numeric(10,2),
  -- Regras do processo
  documentos_obrigatorios text[] DEFAULT '{}',
  exige_treinamento boolean DEFAULT false,
  criterios_aprovacao text,
  criterios_reprovacao text,
  mensagem_inicial text,
  -- Controle
  status text NOT NULL DEFAULT 'ativo',
  validade_inicio date,
  validade_fim date,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_regra_operacao_check CHECK (status IN ('ativo', 'inativo', 'rascunho', 'vencido'))
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_regras_operacao_robo ON automacoes_regras_operacao (robo_id);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_cliente ON automacoes_regras_operacao (cliente_id);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_setor ON automacoes_regras_operacao (setor);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_status ON automacoes_regras_operacao (status);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_validade ON automacoes_regras_operacao (validade_inicio, validade_fim);

-- ==================== FUNÇÃO: atualizar updated_at ====================
CREATE OR REPLACE FUNCTION update_regras_operacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_regras_operacao_updated_at ON automacoes_regras_operacao;
CREATE TRIGGER trg_regras_operacao_updated_at
  BEFORE UPDATE ON automacoes_regras_operacao
  FOR EACH ROW
  EXECUTE FUNCTION update_regras_operacao_updated_at();
