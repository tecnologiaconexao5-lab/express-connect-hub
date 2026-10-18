-- ============================================================
-- F40 — AUTO-EVOLUÇÃO CONTROLADA DOS FUNCIONÁRIOS DIGITAIS
-- ============================================================

-- ==================== ENUMS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_evento_aprendizado') THEN
    CREATE TYPE tipo_evento_aprendizado AS ENUM ('execucao','erro','bloqueio','sucesso','decisao','performance','insight','fluxo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_insight') THEN
    CREATE TYPE status_insight AS ENUM ('novo','analisado','aprovado','rejeitado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_sugestao_melhoria') THEN
    CREATE TYPE status_sugestao_melhoria AS ENUM ('pendente','aprovado','rejeitado','aplicado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_sugestao_melhoria') THEN
    CREATE TYPE tipo_sugestao_melhoria AS ENUM ('fluxo','regra','kpi','prompt','ferramenta');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_versao_sistema') THEN
    CREATE TYPE tipo_versao_sistema AS ENUM ('fluxo','regra','prompt','kpi');
  END IF;
END$$;

-- ==================== EVENTOS DE APRENDIZADO (FASE 2) ====================
CREATE TABLE IF NOT EXISTS ia_aprendizado_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  entidade_tipo VARCHAR,
  entidade_id VARCHAR,
  tipo_evento tipo_evento_aprendizado NOT NULL,
  origem VARCHAR NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_tipo ON ia_aprendizado_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_origem ON ia_aprendizado_eventos(origem);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_robo ON ia_aprendizado_eventos(robo_id);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_created ON ia_aprendizado_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_entidade ON ia_aprendizado_eventos(entidade_tipo, entidade_id);

-- ==================== INSIGHTS AUTOMÁTICOS (FASE 3) ====================
CREATE TABLE IF NOT EXISTS ia_insights_automaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contexto TEXT,
  insight_texto TEXT NOT NULL,
  impacto_estimado VARCHAR,
  prioridade VARCHAR DEFAULT 'media',
  status status_insight NOT NULL DEFAULT 'novo',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insights_status ON ia_insights_automaticos(status);
CREATE INDEX IF NOT EXISTS idx_insights_prioridade ON ia_insights_automaticos(prioridade);
CREATE INDEX IF NOT EXISTS idx_insights_created ON ia_insights_automaticos(created_at DESC);

-- ==================== SUGESTÕES DE MELHORIA (FASE 4) ====================
CREATE TABLE IF NOT EXISTS ia_sugestoes_melhoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_sugestao_melhoria NOT NULL,
  descricao TEXT NOT NULL,
  origem_insight_id UUID REFERENCES ia_insights_automaticos(id) ON DELETE SET NULL,
  impacto_estimado TEXT,
  status status_sugestao_melhoria NOT NULL DEFAULT 'pendente',
  governanca_aprovacao_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sugestoes_status ON ia_sugestoes_melhoria(status);
CREATE INDEX IF NOT EXISTS idx_sugestoes_tipo ON ia_sugestoes_melhoria(tipo);
CREATE INDEX IF NOT EXISTS idx_sugestoes_insight ON ia_sugestoes_melhoria(origem_insight_id);

-- ==================== VERSÕES DO SISTEMA (FASE 5) ====================
CREATE TABLE IF NOT EXISTS ia_versoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_versao_sistema NOT NULL,
  entidade_id VARCHAR,
  versao INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  ativo BOOLEAN DEFAULT true,
  sugerido_por UUID,
  aprovado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_versoes_tipo ON ia_versoes_sistema(tipo);
CREATE INDEX IF NOT EXISTS idx_versoes_entidade ON ia_versoes_sistema(entidade_id);
CREATE INDEX IF NOT EXISTS idx_versoes_ativo ON ia_versoes_sistema(ativo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_versoes_entidade_versao ON ia_versoes_sistema(tipo, entidade_id, versao);

-- ==================== RLS ====================
ALTER TABLE ia_aprendizado_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_insights_automaticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_sugestoes_melhoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_versoes_sistema ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar aprendizado eventos' AND tablename='ia_aprendizado_eventos') THEN
    CREATE POLICY "Gerenciar aprendizado eventos" ON ia_aprendizado_eventos FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar insights' AND tablename='ia_insights_automaticos') THEN
    CREATE POLICY "Gerenciar insights" ON ia_insights_automaticos FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar sugestoes' AND tablename='ia_sugestoes_melhoria') THEN
    CREATE POLICY "Gerenciar sugestoes" ON ia_sugestoes_melhoria FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar versoes' AND tablename='ia_versoes_sistema') THEN
    CREATE POLICY "Gerenciar versoes" ON ia_versoes_sistema FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ==================== GRANTS ====================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_aprendizado_eventos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_insights_automaticos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_sugestoes_melhoria TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_versoes_sistema TO anon, authenticated;
