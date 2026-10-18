-- ============================================================
-- MIGRATION: 20260629_f25e_gatilhos_alertas
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Gatilhos, alertas e escalonamento por robô
-- Permite que robôs por setor reajam a eventos reais do TMS
-- de forma segura, auditável e controlada.
-- ============================================================

-- ==================== TIPO: nivel_risco ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_risco') THEN
    CREATE TYPE nivel_risco AS ENUM ('baixo', 'medio', 'alto', 'critico');
  END IF;
END
$$;

-- ==================== TIPO: tipo_acao_gatilho ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_acao_gatilho') THEN
    CREATE TYPE tipo_acao_gatilho AS ENUM (
      'criar_tarefa', 'criar_aprovacao', 'criar_alerta',
      'acionar_humano', 'executar_robo_simulado', 'notificar_setor'
    );
  END IF;
END
$$;

-- ==================== TABELA: automacoes_gatilhos ====================
CREATE TABLE IF NOT EXISTS automacoes_gatilhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  setor text NOT NULL,
  evento text NOT NULL,
  descricao text,
  -- Condições
  cliente_id uuid,
  operacao_id uuid,
  regiao text,
  prioridade text NOT NULL DEFAULT 'normal',
  status_anterior text,
  status_novo text,
  condicao_json jsonb DEFAULT '{}'::jsonb,
  -- Ação
  tipo_acao text NOT NULL DEFAULT 'criar_tarefa',
  criar_tarefa boolean DEFAULT true,
  criar_aprovacao boolean DEFAULT false,
  criar_alerta boolean DEFAULT false,
  acionar_humano boolean DEFAULT false,
  executar_robo_simulado boolean DEFAULT false,
  -- Segurança
  exige_aprovacao_humana boolean DEFAULT true,
  permite_execucao_automatica boolean DEFAULT false,
  nivel_risco text NOT NULL DEFAULT 'medio',
  limite_execucoes integer DEFAULT 0,
  -- Controle
  ativo boolean DEFAULT true,
  horario_inicio time,
  horario_fim time,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prioridade_gatilho_check CHECK (prioridade IN ('baixa', 'normal', 'alta', 'critica')),
  CONSTRAINT tipo_acao_gatilho_check CHECK (tipo_acao IN ('criar_tarefa', 'criar_aprovacao', 'criar_alerta', 'acionar_humano', 'executar_robo_simulado', 'notificar_setor')),
  CONSTRAINT nivel_risco_gatilho_check CHECK (nivel_risco IN ('baixo', 'medio', 'alto', 'critico'))
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_gatilhos_robo ON automacoes_gatilhos (robo_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_setor ON automacoes_gatilhos (setor);
CREATE INDEX IF NOT EXISTS idx_gatilhos_evento ON automacoes_gatilhos (evento);
CREATE INDEX IF NOT EXISTS idx_gatilhos_prioridade ON automacoes_gatilhos (prioridade);
CREATE INDEX IF NOT EXISTS idx_gatilhos_ativo ON automacoes_gatilhos (ativo);

-- ==================== FUNÇÃO: atualizar updated_at ====================
CREATE OR REPLACE FUNCTION update_gatilhos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gatilhos_updated_at ON automacoes_gatilhos;
CREATE TRIGGER trg_gatilhos_updated_at
  BEFORE UPDATE ON automacoes_gatilhos
  FOR EACH ROW
  EXECUTE FUNCTION update_gatilhos_updated_at();

-- ==================== TABELA: automacoes_gatilhos_execucao (log de execuções) ====================
CREATE TABLE IF NOT EXISTS automacoes_gatilhos_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gatilho_id uuid NOT NULL REFERENCES automacoes_gatilhos(id) ON DELETE CASCADE,
  robo_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  evento text NOT NULL,
  tipo_acao text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  resultado jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processado',
  erro text,
  executado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_gatilho ON automacoes_gatilhos_execucao (gatilho_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_evento ON automacoes_gatilhos_execucao (evento);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_status ON automacoes_gatilhos_execucao (status);
