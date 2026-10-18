-- ============================================================
-- MIGRATION: 20260713_f31_missoes_metas_kpi_agenda
-- F31 — SISTEMA DE MISSÕES, METAS, AGENDA E KPIs
-- ============================================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodicidade_meta') THEN
    CREATE TYPE periodicidade_meta AS ENUM ('diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_meta') THEN
    CREATE TYPE status_meta AS ENUM ('ativa', 'pausada', 'atingida', 'nao_atingida', 'cancelada');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_missao') THEN
    CREATE TYPE status_missao AS ENUM ('ativa', 'pausada', 'concluida', 'cancelada', 'rascunho');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridade_missao') THEN
    CREATE TYPE prioridade_missao AS ENUM ('baixa', 'media', 'alta', 'critica');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_atividade_agenda') THEN
    CREATE TYPE tipo_atividade_agenda AS ENUM ('prospeccao', 'followup', 'email', 'cobranca', 'analise', 'relatorio', 'reuniao', 'treinamento', 'comunicacao', 'outro');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dia_semana') THEN
    CREATE TYPE dia_semana AS ENUM ('domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado');
  END IF;
END $$;

-- ==================== TABELA: MISSÕES ====================
CREATE TABLE IF NOT EXISTS ia_missoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  nome_missao TEXT NOT NULL,
  descricao TEXT,
  objetivo_estrategico TEXT,
  prioridade prioridade_missao NOT NULL DEFAULT 'media',
  status status_missao NOT NULL DEFAULT 'rascunho',
  inicio_vigencia DATE,
  fim_vigencia DATE,
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: METAS ====================
CREATE TABLE IF NOT EXISTS ia_metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  missao_id UUID NOT NULL REFERENCES ia_missoes(id) ON DELETE CASCADE,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  nome_meta TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  valor_meta NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_atual NUMERIC(15,2) NOT NULL DEFAULT 0,
  unidade TEXT DEFAULT 'unidades',
  periodicidade periodicidade_meta NOT NULL DEFAULT 'mensal',
  peso NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  status status_meta NOT NULL DEFAULT 'ativa',
  data_referencia_inicio DATE,
  data_referencia_fim DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: INDICADORES (KPIs) ====================
CREATE TABLE IF NOT EXISTS ia_indicadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_id UUID NOT NULL REFERENCES ia_metas(id) ON DELETE CASCADE,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  valor_planejado NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_realizado NUMERIC(15,2) NOT NULL DEFAULT 0,
  percentual_atingido NUMERIC(5,2) DEFAULT 0,
  tendencia TEXT DEFAULT 'estavel',
  periodo_referencia TEXT,
  data_apuracao DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: HISTÓRICO DE INDICADORES ====================
CREATE TABLE IF NOT EXISTS ia_historico_indicadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  indicador_id UUID REFERENCES ia_indicadores(id) ON DELETE SET NULL,
  meta_id UUID REFERENCES ia_metas(id) ON DELETE CASCADE,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  valor_planejado NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_realizado NUMERIC(15,2) NOT NULL DEFAULT 0,
  percentual_atingido NUMERIC(5,2) DEFAULT 0,
  tendencia TEXT DEFAULT 'estavel',
  periodo_referencia TEXT,
  data_apuracao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: AGENDA DE TRABALHO ====================
CREATE TABLE IF NOT EXISTS ia_agenda_trabalho (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  dia_semana dia_semana NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(robo_id, dia_semana)
);

-- ==================== TABELA: ATIVIDADES DA AGENDA ====================
CREATE TABLE IF NOT EXISTS ia_agenda_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id UUID NOT NULL REFERENCES ia_agenda_trabalho(id) ON DELETE CASCADE,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  tipo_atividade tipo_atividade_agenda NOT NULL DEFAULT 'outro',
  descricao TEXT NOT NULL,
  prioridade prioridade_missao NOT NULL DEFAULT 'media',
  frequencia TEXT DEFAULT 'diario',
  repeticoes INTEGER DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: LIMITES OPERACIONAIS ====================
CREATE TABLE IF NOT EXISTS ia_limites_operacionais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  acao_tipo TEXT NOT NULL,
  limite_quantidade INTEGER NOT NULL DEFAULT 0,
  periodo TEXT NOT NULL DEFAULT 'diario',
  horario_permitido_inicio TIME DEFAULT '00:00:00',
  horario_permitido_fim TIME DEFAULT '23:59:59',
  limite_financeiro NUMERIC(15,2),
  alerta_quando_atingir NUMERIC(5,2) DEFAULT 80,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(robo_id, acao_tipo, periodo)
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_ia_missoes_robo ON ia_missoes (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_status ON ia_missoes (status);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_prioridade ON ia_missoes (prioridade);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_vigencia ON ia_missoes (inicio_vigencia, fim_vigencia);

CREATE INDEX IF NOT EXISTS idx_ia_metas_missao ON ia_metas (missao_id);
CREATE INDEX IF NOT EXISTS idx_ia_metas_robo ON ia_metas (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_metas_status ON ia_metas (status);
CREATE INDEX IF NOT EXISTS idx_ia_metas_periodicidade ON ia_metas (periodicidade);

CREATE INDEX IF NOT EXISTS idx_ia_indicadores_meta ON ia_indicadores (meta_id);
CREATE INDEX IF NOT EXISTS idx_ia_indicadores_robo ON ia_indicadores (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_indicadores_data ON ia_indicadores (data_apuracao DESC);

CREATE INDEX IF NOT EXISTS idx_ia_historico_indicadores_meta ON ia_historico_indicadores (meta_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_indicadores_robo ON ia_historico_indicadores (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_indicadores_data ON ia_historico_indicadores (data_apuracao DESC);

CREATE INDEX IF NOT EXISTS idx_ia_agenda_trabalho_robo ON ia_agenda_trabalho (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_trabalho_dia ON ia_agenda_trabalho (dia_semana);

CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_agenda ON ia_agenda_atividades (agenda_id);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_robo ON ia_agenda_atividades (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_tipo ON ia_agenda_atividades (tipo_atividade);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_horario ON ia_agenda_atividades (horario_inicio);

CREATE INDEX IF NOT EXISTS idx_ia_limites_operacionais_robo ON ia_limites_operacionais (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_limites_operacionais_acao ON ia_limites_operacionais (acao_tipo);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE ia_missoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_historico_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_agenda_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_agenda_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_limites_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_missoes_select" ON ia_missoes FOR SELECT USING (true);
CREATE POLICY "ia_missoes_insert" ON ia_missoes FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_missoes_update" ON ia_missoes FOR UPDATE USING (true);
CREATE POLICY "ia_missoes_delete" ON ia_missoes FOR DELETE USING (true);

CREATE POLICY "ia_metas_select" ON ia_metas FOR SELECT USING (true);
CREATE POLICY "ia_metas_insert" ON ia_metas FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_metas_update" ON ia_metas FOR UPDATE USING (true);
CREATE POLICY "ia_metas_delete" ON ia_metas FOR DELETE USING (true);

CREATE POLICY "ia_indicadores_select" ON ia_indicadores FOR SELECT USING (true);
CREATE POLICY "ia_indicadores_insert" ON ia_indicadores FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_indicadores_update" ON ia_indicadores FOR UPDATE USING (true);
CREATE POLICY "ia_indicadores_delete" ON ia_indicadores FOR DELETE USING (true);

CREATE POLICY "ia_historico_indicadores_select" ON ia_historico_indicadores FOR SELECT USING (true);
CREATE POLICY "ia_historico_indicadores_insert" ON ia_historico_indicadores FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_historico_indicadores_delete" ON ia_historico_indicadores FOR DELETE USING (true);

CREATE POLICY "ia_agenda_trabalho_select" ON ia_agenda_trabalho FOR SELECT USING (true);
CREATE POLICY "ia_agenda_trabalho_insert" ON ia_agenda_trabalho FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_agenda_trabalho_update" ON ia_agenda_trabalho FOR UPDATE USING (true);
CREATE POLICY "ia_agenda_trabalho_delete" ON ia_agenda_trabalho FOR DELETE USING (true);

CREATE POLICY "ia_agenda_atividades_select" ON ia_agenda_atividades FOR SELECT USING (true);
CREATE POLICY "ia_agenda_atividades_insert" ON ia_agenda_atividades FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_agenda_atividades_update" ON ia_agenda_atividades FOR UPDATE USING (true);
CREATE POLICY "ia_agenda_atividades_delete" ON ia_agenda_atividades FOR DELETE USING (true);

CREATE POLICY "ia_limites_operacionais_select" ON ia_limites_operacionais FOR SELECT USING (true);
CREATE POLICY "ia_limites_operacionais_insert" ON ia_limites_operacionais FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_limites_operacionais_update" ON ia_limites_operacionais FOR UPDATE USING (true);
CREATE POLICY "ia_limites_operacionais_delete" ON ia_limites_operacionais FOR DELETE USING (true);

-- ==================== FUNÇÃO: ATUALIZAR UPDATED_AT ====================
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_missoes_updated_at') THEN
    CREATE TRIGGER trg_ia_missoes_updated_at BEFORE UPDATE ON ia_missoes FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_metas_updated_at') THEN
    CREATE TRIGGER trg_ia_metas_updated_at BEFORE UPDATE ON ia_metas FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_agenda_trabalho_updated_at') THEN
    CREATE TRIGGER trg_ia_agenda_trabalho_updated_at BEFORE UPDATE ON ia_agenda_trabalho FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_agenda_atividades_updated_at') THEN
    CREATE TRIGGER trg_ia_agenda_atividades_updated_at BEFORE UPDATE ON ia_agenda_atividades FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_limites_operacionais_updated_at') THEN
    CREATE TRIGGER trg_ia_limites_operacionais_updated_at BEFORE UPDATE ON ia_limites_operacionais FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
END $$;
