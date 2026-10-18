-- ============================================================
-- MIGRATION: 20260714_f32_workforce_orchestrator
-- F32 — ORQUESTRADOR DE TRABALHO DOS FUNCIONÁRIOS DIGITAIS
-- ============================================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridade_trabalho') THEN
    CREATE TYPE prioridade_trabalho AS ENUM ('baixa', 'normal', 'alta', 'critica');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_trabalho') THEN
    CREATE TYPE status_trabalho AS ENUM ('pendente', 'em_andamento', 'concluida', 'falhou', 'cancelada', 'escalada');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_fila_trabalho') THEN
    CREATE TYPE status_fila_trabalho AS ENUM ('pendente', 'em_andamento', 'concluida', 'falhou');
  END IF;
END $$;

-- ==================== TABELA: TRABALHOS ====================
CREATE TABLE IF NOT EXISTS ia_trabalhos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  tipo TEXT NOT NULL DEFAULT 'outro',
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade prioridade_trabalho NOT NULL DEFAULT 'normal',
  status status_trabalho NOT NULL DEFAULT 'pendente',
  criado_por_robo UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  atribuido_por_robo UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ DEFAULT now(),
  data_vencimento TIMESTAMPTZ,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'::jsonb,
  resultado JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: FILA DE TRABALHO ====================
CREATE TABLE IF NOT EXISTS ia_fila_trabalho (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalho_id UUID NOT NULL REFERENCES ia_trabalhos(id) ON DELETE CASCADE,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  ordem_execucao INTEGER NOT NULL DEFAULT 0,
  status status_fila_trabalho NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: HISTÓRICO DE TRABALHO ====================
CREATE TABLE IF NOT EXISTS ia_historico_trabalho (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalho_id UUID NOT NULL REFERENCES ia_trabalhos(id) ON DELETE CASCADE,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_robo ON ia_trabalhos (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_status ON ia_trabalhos (status);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_prioridade ON ia_trabalhos (prioridade);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_origem ON ia_trabalhos (origem);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_tipo ON ia_trabalhos (tipo);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_data_criacao ON ia_trabalhos (data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_vencimento ON ia_trabalhos (data_vencimento) WHERE data_vencimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_trabalho ON ia_fila_trabalho (trabalho_id);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_robo ON ia_fila_trabalho (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_status ON ia_fila_trabalho (status);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_ordem ON ia_fila_trabalho (ordem_execucao);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_proxima ON ia_fila_trabalho (proxima_execucao) WHERE proxima_execucao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ia_historico_trabalho_trabalho ON ia_historico_trabalho (trabalho_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_trabalho_robo ON ia_historico_trabalho (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_trabalho_data ON ia_historico_trabalho (created_at DESC);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE ia_trabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_fila_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_historico_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_trabalhos_select" ON ia_trabalhos FOR SELECT USING (true);
CREATE POLICY "ia_trabalhos_insert" ON ia_trabalhos FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_trabalhos_update" ON ia_trabalhos FOR UPDATE USING (true);
CREATE POLICY "ia_trabalhos_delete" ON ia_trabalhos FOR DELETE USING (true);

CREATE POLICY "ia_fila_trabalho_select" ON ia_fila_trabalho FOR SELECT USING (true);
CREATE POLICY "ia_fila_trabalho_insert" ON ia_fila_trabalho FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_fila_trabalho_update" ON ia_fila_trabalho FOR UPDATE USING (true);
CREATE POLICY "ia_fila_trabalho_delete" ON ia_fila_trabalho FOR DELETE USING (true);

CREATE POLICY "ia_historico_trabalho_select" ON ia_historico_trabalho FOR SELECT USING (true);
CREATE POLICY "ia_historico_trabalho_insert" ON ia_historico_trabalho FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_historico_trabalho_delete" ON ia_historico_trabalho FOR DELETE USING (true);

-- ==================== TRIGGERS UPDATED_AT ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_trabalhos_updated_at') THEN
    CREATE TRIGGER trg_ia_trabalhos_updated_at BEFORE UPDATE ON ia_trabalhos FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_fila_trabalho_updated_at') THEN
    CREATE TRIGGER trg_ia_fila_trabalho_updated_at BEFORE UPDATE ON ia_fila_trabalho FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
END $$;
