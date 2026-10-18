-- ============================================================
-- MIGRATION: 20260706_f29_biblioteca_corporativa
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Biblioteca Global Corporativa — Cérebro Institucional (F29)
-- ============================================================
-- AUDITORIA: Reaproveita ia_conhecimento (F25FA.2) expandindo colunas
-- e cria ia_conhecimento_distribuicao para vincular conhecimento a robôs.
-- ============================================================

-- ==================== TIPO ENUM ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_conhecimento') THEN
    CREATE TYPE tipo_conhecimento AS ENUM (
      'procedimento', 'politica', 'contrato', 'tabela_preco',
      'treinamento', 'compliance', 'outro'
    );
  END IF;
END $$;

-- ==================== EXPANSÃO: ia_conhecimento ====================
ALTER TABLE ia_conhecimento
  ADD COLUMN IF NOT EXISTS tipo_conhecimento text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz;

-- Índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_tipo_conhecimento ON ia_conhecimento (tipo_conhecimento);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_versao ON ia_conhecimento (versao);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_aprovado ON ia_conhecimento (aprovado_por);

-- ==================== TABELA: ia_conhecimento_distribuicao ====================
CREATE TABLE IF NOT EXISTS ia_conhecimento_distribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conhecimento_id uuid NOT NULL REFERENCES ia_conhecimento(id) ON DELETE CASCADE,
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  obrigatorio boolean NOT NULL DEFAULT false,
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'critica')),
  data_vinculo timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE(conhecimento_id, robo_id)
);

CREATE INDEX IF NOT EXISTS idx_distribuicao_conhecimento ON ia_conhecimento_distribuicao (conhecimento_id);
CREATE INDEX IF NOT EXISTS idx_distribuicao_robo ON ia_conhecimento_distribuicao (robo_id);
CREATE INDEX IF NOT EXISTS idx_distribuicao_ativo ON ia_conhecimento_distribuicao (ativo);

-- ==================== RLS POLICIES ====================
ALTER TABLE ia_conhecimento_distribuicao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'distrib_select' AND tablename = 'ia_conhecimento_distribuicao') THEN
    CREATE POLICY distrib_select ON ia_conhecimento_distribuicao FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'distrib_insert' AND tablename = 'ia_conhecimento_distribuicao') THEN
    CREATE POLICY distrib_insert ON ia_conhecimento_distribuicao FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'distrib_update' AND tablename = 'ia_conhecimento_distribuicao') THEN
    CREATE POLICY distrib_update ON ia_conhecimento_distribuicao FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'distrib_delete' AND tablename = 'ia_conhecimento_distribuicao') THEN
    CREATE POLICY distrib_delete ON ia_conhecimento_distribuicao FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;
