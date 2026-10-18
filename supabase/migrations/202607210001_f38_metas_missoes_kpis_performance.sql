-- ============================================================
-- F38 — METAS, MISSÕES, KPIs E PERFORMANCE DOS FUNCIONÁRIOS DIGITAIS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_execucao_missao') THEN
    CREATE TYPE status_execucao_missao AS ENUM ('pendente','em_andamento','concluida','falhou','cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='periodicidade_kpi') THEN
    CREATE TYPE periodicidade_kpi AS ENUM ('diario','semanal','quinzenal','mensal','trimestral','semestral','anual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_auditoria_performance') THEN
    CREATE TYPE tipo_auditoria_performance AS ENUM ('meta','kpi','score','missao_execucao');
  END IF;
END$$;

-- ==================== MISSÕES EXECUÇÃO (FASE 3) ====================
CREATE TABLE IF NOT EXISTS ia_missoes_execucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  missao_id UUID REFERENCES ia_missoes(id) ON DELETE SET NULL,
  titulo VARCHAR NOT NULL,
  descricao TEXT,
  status status_execucao_missao NOT NULL DEFAULT 'pendente',
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  resultado JSONB DEFAULT '{}',
  impacto_estimado VARCHAR,
  planejamento_id UUID,
  total_acoes INTEGER DEFAULT 0,
  acoes_concluidas INTEGER DEFAULT 0,
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_missoes_exec_robo ON ia_missoes_execucao(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_exec_status ON ia_missoes_execucao(status);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_exec_missao ON ia_missoes_execucao(missao_id);

-- ==================== KPIs DE ROBÔS (FASE 4) ====================
CREATE TABLE IF NOT EXISTS ia_kpis_robo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  nome_kpi VARCHAR NOT NULL,
  descricao TEXT,
  formula TEXT NOT NULL,
  valor_atual DECIMAL NOT NULL DEFAULT 0,
  valor_meta DECIMAL NOT NULL DEFAULT 100,
  unidade VARCHAR DEFAULT 'pontos',
  periodicidade periodicidade_kpi NOT NULL DEFAULT 'mensal',
  fonte_dados VARCHAR,
  ultima_atualizacao TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_kpis_robo_robo ON ia_kpis_robo(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_kpis_robo_periodicidade ON ia_kpis_robo(periodicidade);

-- ==================== SCORE DO FUNCIONÁRIO DIGITAL (FASE 6) ====================
CREATE TABLE IF NOT EXISTS ia_score_robo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE UNIQUE,
  performance_score DECIMAL NOT NULL DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
  eficiencia_score DECIMAL NOT NULL DEFAULT 0 CHECK (eficiencia_score >= 0 AND eficiencia_score <= 100),
  confiabilidade_score DECIMAL NOT NULL DEFAULT 0 CHECK (confiabilidade_score >= 0 AND confiabilidade_score <= 100),
  risco_score DECIMAL NOT NULL DEFAULT 0 CHECK (risco_score >= 0 AND risco_score <= 100),
  score_geral DECIMAL NOT NULL DEFAULT 0 CHECK (score_geral >= 0 AND score_geral <= 100),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_score_robo_geral ON ia_score_robo(score_geral DESC);

-- ==================== AUDITORIA DE PERFORMANCE (FASE 9) ====================
CREATE TABLE IF NOT EXISTS ia_auditoria_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  missao_execucao_id UUID REFERENCES ia_missoes_execucao(id) ON DELETE SET NULL,
  tipo tipo_auditoria_performance NOT NULL,
  acao VARCHAR NOT NULL,
  descricao TEXT,
  valor_anterior JSONB DEFAULT '{}',
  valor_novo JSONB DEFAULT '{}',
  resultado VARCHAR,
  impacto TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_auditoria_perf_robo ON ia_auditoria_performance(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_auditoria_perf_tipo ON ia_auditoria_performance(tipo);
CREATE INDEX IF NOT EXISTS idx_ia_auditoria_perf_created ON ia_auditoria_performance(created_at DESC);

-- ==================== RLS ====================
ALTER TABLE ia_missoes_execucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_kpis_robo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_score_robo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_auditoria_performance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar missoes exec' AND tablename='ia_missoes_execucao') THEN
    CREATE POLICY "Gerenciar missoes exec" ON ia_missoes_execucao FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar kpis robo' AND tablename='ia_kpis_robo') THEN
    CREATE POLICY "Gerenciar kpis robo" ON ia_kpis_robo FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar score robo' AND tablename='ia_score_robo') THEN
    CREATE POLICY "Gerenciar score robo" ON ia_score_robo FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar auditoria perf' AND tablename='ia_auditoria_performance') THEN
    CREATE POLICY "Gerenciar auditoria perf" ON ia_auditoria_performance FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ==================== TRIGGERS ====================
CREATE OR REPLACE FUNCTION f38_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ia_missoes_exec_updated ON ia_missoes_execucao;
CREATE TRIGGER trg_ia_missoes_exec_updated BEFORE UPDATE ON ia_missoes_execucao FOR EACH ROW EXECUTE FUNCTION f38_updated_at();

DROP TRIGGER IF EXISTS trg_ia_kpis_robo_updated ON ia_kpis_robo;
CREATE TRIGGER trg_ia_kpis_robo_updated BEFORE UPDATE ON ia_kpis_robo FOR EACH ROW EXECUTE FUNCTION f38_updated_at();

DROP TRIGGER IF EXISTS trg_ia_score_robo_updated ON ia_score_robo;
CREATE TRIGGER trg_ia_score_robo_updated BEFORE UPDATE ON ia_score_robo FOR EACH ROW EXECUTE FUNCTION f38_updated_at();

-- ==================== GRANTS ====================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_missoes_execucao TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_kpis_robo TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_score_robo TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.ia_auditoria_performance TO anon, authenticated;
