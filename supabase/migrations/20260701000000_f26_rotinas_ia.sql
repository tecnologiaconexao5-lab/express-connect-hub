-- ============================================================
-- MIGRATION: 20260701_f26_rotinas_ia
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Motor de Rotinas dos Funcionários Digitais (F26.1)
-- ============================================================

-- ==================== TIPO ENUM ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_rotina_ia') THEN
    CREATE TYPE tipo_rotina_ia AS ENUM ('scheduled', 'interval', 'event', 'manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_rotina_ia') THEN
    CREATE TYPE status_rotina_ia AS ENUM ('pending', 'running', 'success', 'error', 'paused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_execucao_rotina_ia') THEN
    CREATE TYPE status_execucao_rotina_ia AS ENUM ('running', 'success', 'error');
  END IF;
END $$;

-- ==================== TABELA: rotinas_ia ====================
CREATE TABLE IF NOT EXISTS rotinas_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo tipo_rotina_ia NOT NULL DEFAULT 'interval',
  cron_expression text,
  interval_seconds integer,
  ativo boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  ultima_execucao timestamptz,
  proxima_execucao timestamptz,
  status status_rotina_ia NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_robo_id ON rotinas_ia (robo_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_ativo ON rotinas_ia (ativo);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_status ON rotinas_ia (status);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_proxima_execucao ON rotinas_ia (proxima_execucao);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_tipo ON rotinas_ia (tipo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_rotinas_ia_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rotinas_ia_updated_at ON rotinas_ia;
CREATE TRIGGER trg_rotinas_ia_updated_at
  BEFORE UPDATE ON rotinas_ia
  FOR EACH ROW EXECUTE FUNCTION update_rotinas_ia_updated_at();

-- ==================== TABELA: rotinas_execucoes_ia ====================
CREATE TABLE IF NOT EXISTS rotinas_execucoes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES rotinas_ia(id) ON DELETE CASCADE,
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  status status_execucao_rotina_ia NOT NULL DEFAULT 'running',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  logs text,
  erro text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_rotina_id ON rotinas_execucoes_ia (rotina_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_robo_id ON rotinas_execucoes_ia (robo_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_status ON rotinas_execucoes_ia (status);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_started_at ON rotinas_execucoes_ia (started_at);

-- ==================== RLS POLICIES ====================
ALTER TABLE rotinas_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotinas_execucoes_ia ENABLE ROW LEVEL SECURITY;

-- Rotinas IA: leitura para todos autenticados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_ia_select_policy' AND tablename = 'rotinas_ia') THEN
    CREATE POLICY rotinas_ia_select_policy ON rotinas_ia
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_ia_insert_policy' AND tablename = 'rotinas_ia') THEN
    CREATE POLICY rotinas_ia_insert_policy ON rotinas_ia
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_ia_update_policy' AND tablename = 'rotinas_ia') THEN
    CREATE POLICY rotinas_ia_update_policy ON rotinas_ia
      FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_ia_delete_policy' AND tablename = 'rotinas_ia') THEN
    CREATE POLICY rotinas_ia_delete_policy ON rotinas_ia
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Rotinas Execucoes IA: leitura para todos autenticados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_execucoes_select_policy' AND tablename = 'rotinas_execucoes_ia') THEN
    CREATE POLICY rotinas_execucoes_select_policy ON rotinas_execucoes_ia
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_execucoes_insert_policy' AND tablename = 'rotinas_execucoes_ia') THEN
    CREATE POLICY rotinas_execucoes_insert_policy ON rotinas_execucoes_ia
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_execucoes_update_policy' AND tablename = 'rotinas_execucoes_ia') THEN
    CREATE POLICY rotinas_execucoes_update_policy ON rotinas_execucoes_ia
      FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rotinas_execucoes_delete_policy' AND tablename = 'rotinas_execucoes_ia') THEN
    CREATE POLICY rotinas_execucoes_delete_policy ON rotinas_execucoes_ia
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;
