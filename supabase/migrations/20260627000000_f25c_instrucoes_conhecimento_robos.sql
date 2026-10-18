-- ============================================================
-- MIGRATION: 20260627_f25c_instrucoes_conhecimento_robos
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Instruções versionadas e base de conhecimento por robô
-- ============================================================

-- ==================== TAREFA 1: automacoes_instrucoes ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_instrucao') THEN
    CREATE TYPE status_instrucao AS ENUM ('rascunho', 'em_revisao', 'publicado', 'arquivado');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS automacoes_instrucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  objetivo text,
  tom_de_conversa text,
  regras_fixas text,
  perguntas_obrigatorias text,
  respostas_padrao jsonb DEFAULT '[]'::jsonb,
  limites_de_atuacao text,
  quando_chamar_humano text,
  proibicoes text,
  exemplos_de_conversa jsonb DEFAULT '[]'::jsonb,
  instrucoes_completas text,
  status text NOT NULL DEFAULT 'rascunho',
  ativo boolean NOT NULL DEFAULT false,
  criado_por uuid,
  publicado_por uuid,
  publicado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_instrucao_check CHECK (status IN ('rascunho', 'em_revisao', 'publicado', 'arquivado'))
);

-- Apenas uma instrução ativa por robô
CREATE UNIQUE INDEX IF NOT EXISTS idx_automacoes_instrucoes_robo_ativo
  ON automacoes_instrucoes (robo_id) WHERE ativo = true;

-- Índices
CREATE INDEX IF NOT EXISTS idx_automacoes_instrucoes_robo
  ON automacoes_instrucoes (robo_id);

CREATE INDEX IF NOT EXISTS idx_automacoes_instrucoes_status
  ON automacoes_instrucoes (status);

-- ==================== TAREFA 2: Expandir ia_conhecimento ====================
-- Adiciona campos se não existirem (para não quebrar existentes)
DO $$
BEGIN
  -- robo_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'robo_id') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN robo_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL;
  END IF;

  -- categoria
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'categoria') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN categoria text;
  END IF;

  -- titulo (já existe, mas verifica)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'titulo') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN titulo text NOT NULL DEFAULT '';
  END IF;

  -- conteudo (já existe, mas verifica)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'conteudo') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN conteudo text NOT NULL DEFAULT '';
  END IF;

  -- setor
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'setor') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN setor text;
  END IF;

  -- tags
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'tags') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  -- status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'status') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN status text NOT NULL DEFAULT 'ativo';
  END IF;

  -- validade_inicio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'validade_inicio') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN validade_inicio date;
  END IF;

  -- validade_fim
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'validade_fim') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN validade_fim date;
  END IF;

  -- criado_por
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'criado_por') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN criado_por uuid;
  END IF;

  -- atualizado_por
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'atualizado_por') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN atualizado_por uuid;
  END IF;

  -- criado_em (já existe, verifica)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'criado_em') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN criado_em timestamptz DEFAULT now();
  END IF;

  -- atualizado_em
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_conhecimento' AND column_name = 'atualizado_em') THEN
    ALTER TABLE ia_conhecimento ADD COLUMN atualizado_em timestamptz DEFAULT now();
  END IF;
END
$$;

-- Adicionar constraint de status se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ia_conhecimento' AND constraint_name = 'ia_conhecimento_status_check') THEN
    ALTER TABLE ia_conhecimento ADD CONSTRAINT ia_conhecimento_status_check
      CHECK (status IN ('ativo', 'inativo', 'vencido', 'rascunho'));
  END IF;
END
$$;

-- Índices ia_conhecimento
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_robo ON ia_conhecimento (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_categoria ON ia_conhecimento (categoria);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_status ON ia_conhecimento (status);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_setor ON ia_conhecimento (setor);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_validade ON ia_conhecimento (validade_inicio, validade_fim);

-- ==================== TRIGGER: apenas uma ativa por robô ====================
CREATE OR REPLACE FUNCTION check_automacoes_instrucoes_ativa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ativo = true AND NEW.status = 'publicado' THEN
    UPDATE automacoes_instrucoes
    SET ativo = false
    WHERE robo_id = NEW.robo_id
      AND id <> NEW.id
      AND ativo = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_automacoes_instrucoes_ativa ON automacoes_instrucoes;
CREATE TRIGGER trg_automacoes_instrucoes_ativa
  AFTER INSERT OR UPDATE OF ativo, status
  ON automacoes_instrucoes
  FOR EACH ROW
  WHEN (NEW.ativo = true AND NEW.status = 'publicado')
  EXECUTE FUNCTION check_automacoes_instrucoes_ativa();
