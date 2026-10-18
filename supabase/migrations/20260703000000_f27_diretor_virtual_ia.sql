-- ============================================================
-- MIGRATION: 20260703_f27_diretor_virtual_ia
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Diretor Virtual IA — Orquestrador da Empresa Digital
-- ============================================================

-- ==================== TIPOS ENUM ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_diretor_virtual') THEN
    CREATE TYPE status_diretor_virtual AS ENUM ('active', 'paused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modo_diretor_virtual') THEN
    CREATE TYPE modo_diretor_virtual AS ENUM ('auto', 'semi_auto', 'manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_decisao_diretor') THEN
    CREATE TYPE tipo_decisao_diretor AS ENUM ('priorizacao', 'risco', 'falha', 'overload', 'oportunidade');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impacto_decisao_diretor') THEN
    CREATE TYPE impacto_decisao_diretor AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'acao_decisao_diretor') THEN
    CREATE TYPE acao_decisao_diretor AS ENUM ('pause', 'resume', 'repriorizar', 'redistribuir', 'escalar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_decisao_diretor') THEN
    CREATE TYPE status_decisao_diretor AS ENUM ('pending', 'executed', 'rejected');
  END IF;
END $$;

-- ==================== TABELA: diretor_virtual_ia ====================
CREATE TABLE IF NOT EXISTS diretor_virtual_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status status_diretor_virtual NOT NULL DEFAULT 'active',
  modo_operacao modo_diretor_virtual NOT NULL DEFAULT 'semi_auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir apenas 1 registro (singleton)
CREATE UNIQUE INDEX IF NOT EXISTS idx_diretor_virtual_unique ON diretor_virtual_ia ((true));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_diretor_virtual_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_diretor_virtual_updated_at ON diretor_virtual_ia;
CREATE TRIGGER trg_diretor_virtual_updated_at
  BEFORE UPDATE ON diretor_virtual_ia
  FOR EACH ROW EXECUTE FUNCTION update_diretor_virtual_updated_at();

-- Inserir registro padrão
INSERT INTO diretor_virtual_ia (status, modo_operacao)
VALUES ('active', 'semi_auto')
ON CONFLICT DO NOTHING;

-- ==================== TABELA: diretor_virtual_decisoes_ia ====================
CREATE TABLE IF NOT EXISTS diretor_virtual_decisoes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL,
  robo_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  tipo tipo_decisao_diretor NOT NULL,
  descricao text NOT NULL,
  impacto impacto_decisao_diretor NOT NULL DEFAULT 'medium',
  acao acao_decisao_diretor NOT NULL,
  detalhes jsonb DEFAULT '{}'::jsonb,
  status status_decisao_diretor NOT NULL DEFAULT 'pending',
  executado boolean NOT NULL DEFAULT false,
  executado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisoes_status ON diretor_virtual_decisoes_ia (status);
CREATE INDEX IF NOT EXISTS idx_decisoes_tipo ON diretor_virtual_decisoes_ia (tipo);
CREATE INDEX IF NOT EXISTS idx_decisoes_robo ON diretor_virtual_decisoes_ia (robo_id);
CREATE INDEX IF NOT EXISTS idx_decisoes_created ON diretor_virtual_decisoes_ia (created_at DESC);

-- ==================== TABELA: diretor_virtual_metricas_ia ====================
CREATE TABLE IF NOT EXISTS diretor_virtual_metricas_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  rotinas_ativas integer NOT NULL DEFAULT 0,
  rotinas_atrasadas integer NOT NULL DEFAULT 0,
  falhas_24h integer NOT NULL DEFAULT 0,
  execucoes_24h integer NOT NULL DEFAULT 0,
  carga_percentual numeric(5,2) NOT NULL DEFAULT 0,
  risco_score numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metricas_robo ON diretor_virtual_metricas_ia (robo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metricas_robo_unique ON diretor_virtual_metricas_ia (robo_id);

-- ==================== RLS POLICIES ====================
ALTER TABLE diretor_virtual_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE diretor_virtual_decisoes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE diretor_virtual_metricas_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_select' AND tablename = 'diretor_virtual_ia') THEN
    CREATE POLICY dv_select ON diretor_virtual_ia FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_insert' AND tablename = 'diretor_virtual_ia') THEN
    CREATE POLICY dv_insert ON diretor_virtual_ia FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_update' AND tablename = 'diretor_virtual_ia') THEN
    CREATE POLICY dv_update ON diretor_virtual_ia FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_decisoes_select' AND tablename = 'diretor_virtual_decisoes_ia') THEN
    CREATE POLICY dv_decisoes_select ON diretor_virtual_decisoes_ia FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_decisoes_insert' AND tablename = 'diretor_virtual_decisoes_ia') THEN
    CREATE POLICY dv_decisoes_insert ON diretor_virtual_decisoes_ia FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_decisoes_update' AND tablename = 'diretor_virtual_decisoes_ia') THEN
    CREATE POLICY dv_decisoes_update ON diretor_virtual_decisoes_ia FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_metricas_select' AND tablename = 'diretor_virtual_metricas_ia') THEN
    CREATE POLICY dv_metricas_select ON diretor_virtual_metricas_ia FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_metricas_insert' AND tablename = 'diretor_virtual_metricas_ia') THEN
    CREATE POLICY dv_metricas_insert ON diretor_virtual_metricas_ia FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_metricas_update' AND tablename = 'diretor_virtual_metricas_ia') THEN
    CREATE POLICY dv_metricas_update ON diretor_virtual_metricas_ia FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;
