-- ============================================================
-- MIGRATION: 20260709_f303_motor_aprendizado_processamento
-- F30.3 — MOTOR DE APRENDIZADO E PROCESSAMENTO INTELIGENTE
-- ============================================================

-- ==================== TIPOS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_processamento') THEN
    CREATE TYPE status_processamento AS ENUM (
      'aguardando_processamento', 'processando', 'processado',
      'erro', 'cancelado', 'reprocessando'
    );
  END IF;
END $$;

-- ==================== TABELA: FILA DE PROCESSAMENTO (F1) ====================
CREATE TABLE IF NOT EXISTS processamento_fila (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academia_material_id UUID REFERENCES academia_materiais(id) ON DELETE SET NULL,
  curso_id UUID REFERENCES academia_cursos(id) ON DELETE SET NULL,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  nome_original TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT DEFAULT 0,
  storage_path TEXT,
  bucket TEXT DEFAULT 'biblioteca-global',
  responsavel TEXT,
  robos_autorizados UUID[] DEFAULT '{}',
  status status_processamento NOT NULL DEFAULT 'aguardando_processamento',
  erro TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 3,
  tempo_processamento_ms INTEGER,
  data_envio TIMESTAMPTZ DEFAULT now(),
  data_processamento TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: MEMORIA CONHECIMENTO (F3) ====================
CREATE TABLE IF NOT EXISTS memoria_conhecimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  processamento_id UUID REFERENCES processamento_fila(id) ON DELETE CASCADE,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  documento_origem TEXT NOT NULL,
  tipo_arquivo TEXT,
  conteudo TEXT NOT NULL,
  categoria TEXT,
  tags TEXT[] DEFAULT '{}',
  data_ref DATE DEFAULT CURRENT_DATE,
  versao INTEGER NOT NULL DEFAULT 1,
  score_relevancia REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: AUDITORIA DE RACIOCINIO (F6) ====================
CREATE TABLE IF NOT EXISTS raciocinio_auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  processo_id TEXT NOT NULL,
  documento_utilizado TEXT,
  trechos_considerados TEXT[] DEFAULT '{}',
  pergunta TEXT,
  decisao TEXT,
  acao_executada TEXT,
  contexto JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_processamento_fila_status ON processamento_fila (status);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_robo ON processamento_fila (robo_id);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_curso ON processamento_fila (curso_id);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_data ON processamento_fila (data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_tipo ON processamento_fila (tipo_arquivo);

CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_robo ON memoria_conhecimento (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_categoria ON memoria_conhecimento (categoria);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_tags ON memoria_conhecimento USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_data ON memoria_conhecimento (data_ref DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_score ON memoria_conhecimento (score_relevancia DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_busca ON memoria_conhecimento USING gin (to_tsvector('portuguese', conteudo));

CREATE INDEX IF NOT EXISTS idx_raciocinio_auditoria_robo ON raciocinio_auditoria (robo_id);
CREATE INDEX IF NOT EXISTS idx_raciocinio_auditoria_data ON raciocinio_auditoria (created_at DESC);

-- ==================== ROW LEVEL SECURITY (F8) ====================
ALTER TABLE processamento_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoria_conhecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE raciocinio_auditoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'processamento_fila_select' AND tablename = 'processamento_fila') THEN
    CREATE POLICY "processamento_fila_select" ON processamento_fila FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'processamento_fila_insert' AND tablename = 'processamento_fila') THEN
    CREATE POLICY "processamento_fila_insert" ON processamento_fila FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'processamento_fila_update' AND tablename = 'processamento_fila') THEN
    CREATE POLICY "processamento_fila_update" ON processamento_fila FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'processamento_fila_delete' AND tablename = 'processamento_fila') THEN
    CREATE POLICY "processamento_fila_delete" ON processamento_fila FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conhecimento_select' AND tablename = 'memoria_conhecimento') THEN
    CREATE POLICY "memoria_conhecimento_select" ON memoria_conhecimento FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conhecimento_insert' AND tablename = 'memoria_conhecimento') THEN
    CREATE POLICY "memoria_conhecimento_insert" ON memoria_conhecimento FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conhecimento_update' AND tablename = 'memoria_conhecimento') THEN
    CREATE POLICY "memoria_conhecimento_update" ON memoria_conhecimento FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conhecimento_delete' AND tablename = 'memoria_conhecimento') THEN
    CREATE POLICY "memoria_conhecimento_delete" ON memoria_conhecimento FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'raciocinio_auditoria_select' AND tablename = 'raciocinio_auditoria') THEN
    CREATE POLICY "raciocinio_auditoria_select" ON raciocinio_auditoria FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'raciocinio_auditoria_insert' AND tablename = 'raciocinio_auditoria') THEN
    CREATE POLICY "raciocinio_auditoria_insert" ON raciocinio_auditoria FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'raciocinio_auditoria_update' AND tablename = 'raciocinio_auditoria') THEN
    CREATE POLICY "raciocinio_auditoria_update" ON raciocinio_auditoria FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'raciocinio_auditoria_delete' AND tablename = 'raciocinio_auditoria') THEN
    CREATE POLICY "raciocinio_auditoria_delete" ON raciocinio_auditoria FOR DELETE USING (true);
  END IF;
END $$;
