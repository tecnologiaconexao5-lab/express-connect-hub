-- ============================================================
-- MIGRATION: 20260705_f28_comunicacao_robos
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Comunicação entre Funcionários Digitais (F28)
-- ============================================================

-- ==================== TIPOS ENUM ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_comunicacao_robo') THEN
    CREATE TYPE tipo_comunicacao_robo AS ENUM ('solicitacao', 'resposta', 'delegacao', 'alerta', 'escalonamento');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_comunicacao_robo') THEN
    CREATE TYPE status_comunicacao_robo AS ENUM ('pendente', 'enviado', 'respondido', 'concluido', 'erro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridade_comunicacao_robo') THEN
    CREATE TYPE prioridade_comunicacao_robo AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

-- ==================== TABELA: ia_comunicacoes_robos ====================
CREATE TABLE IF NOT EXISTS ia_comunicacoes_robos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  destino_robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  tipo tipo_comunicacao_robo NOT NULL,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  contexto jsonb DEFAULT '{}'::jsonb,
  status status_comunicacao_robo NOT NULL DEFAULT 'pendente',
  prioridade prioridade_comunicacao_robo NOT NULL DEFAULT 'medium',
  tarefa_id uuid,
  rotina_id uuid,
  resposta_texto text,
  resposta_robo_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunic_origem ON ia_comunicacoes_robos (origem_robo_id);
CREATE INDEX IF NOT EXISTS idx_comunic_destino ON ia_comunicacoes_robos (destino_robo_id);
CREATE INDEX IF NOT EXISTS idx_comunic_status ON ia_comunicacoes_robos (status);
CREATE INDEX IF NOT EXISTS idx_comunic_tipo ON ia_comunicacoes_robos (tipo);
CREATE INDEX IF NOT EXISTS idx_comunic_created ON ia_comunicacoes_robos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comunic_tarefa ON ia_comunicacoes_robos (tarefa_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_comunicacoes_robos_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comunicacoes_robos_updated_at ON ia_comunicacoes_robos;
CREATE TRIGGER trg_comunicacoes_robos_updated_at
  BEFORE UPDATE ON ia_comunicacoes_robos
  FOR EACH ROW EXECUTE FUNCTION update_comunicacoes_robos_updated_at();

-- ==================== TABELA: ia_comunicacoes_fila_robos ====================
CREATE TABLE IF NOT EXISTS ia_comunicacoes_fila_robos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fila_robo ON ia_comunicacoes_fila_robos (robo_id);
CREATE INDEX IF NOT EXISTS idx_fila_status ON ia_comunicacoes_fila_robos (status);
CREATE INDEX IF NOT EXISTS idx_fila_created ON ia_comunicacoes_fila_robos (created_at);

-- ==================== RLS POLICIES ====================
ALTER TABLE ia_comunicacoes_robos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_comunicacoes_fila_robos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comunic_select' AND tablename = 'ia_comunicacoes_robos') THEN
    CREATE POLICY comunic_select ON ia_comunicacoes_robos FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comunic_insert' AND tablename = 'ia_comunicacoes_robos') THEN
    CREATE POLICY comunic_insert ON ia_comunicacoes_robos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comunic_update' AND tablename = 'ia_comunicacoes_robos') THEN
    CREATE POLICY comunic_update ON ia_comunicacoes_robos FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fila_select' AND tablename = 'ia_comunicacoes_fila_robos') THEN
    CREATE POLICY fila_select ON ia_comunicacoes_fila_robos FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fila_insert' AND tablename = 'ia_comunicacoes_fila_robos') THEN
    CREATE POLICY fila_insert ON ia_comunicacoes_fila_robos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fila_update' AND tablename = 'ia_comunicacoes_fila_robos') THEN
    CREATE POLICY fila_update ON ia_comunicacoes_fila_robos FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;
