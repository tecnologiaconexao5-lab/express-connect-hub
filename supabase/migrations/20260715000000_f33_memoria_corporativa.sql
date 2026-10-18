-- ============================================================
-- MIGRATION: 20260715_f33_memoria_corporativa
-- F33 — MEMÓRIA CORPORATIVA PERSISTENTE E CONTEXTUAL
-- ============================================================
-- REUSO: reaproveita automacoes_robos (FK robo_id),
--        automacoes_logs (auditoria via centralIaService),
--        memoria_conhecimento (memoria de longo prazo existente),
--        raciocinio_auditoria (thought-process existente)
-- ============================================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escopo_memoria') THEN
    CREATE TYPE escopo_memoria AS ENUM ('compartilhada', 'privada');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_entidade') THEN
    CREATE TYPE tipo_entidade AS ENUM ('cliente', 'lead', 'motorista', 'prestador', 'fornecedor', 'colaborador', 'robo', 'projeto', 'contrato', 'outro');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_evento') THEN
    CREATE TYPE tipo_evento AS ENUM ('negociacao', 'reclamacao', 'proposta', 'contratacao', 'atraso', 'pagamento', 'bloqueio', 'elogio', 'cancelamento', 'renovacao', 'alerta', 'outro');
  END IF;
END $$;

-- ==================== TABELA: ENTIDADES ====================
CREATE TABLE IF NOT EXISTS memoria_entidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  entidade_tipo tipo_entidade NOT NULL DEFAULT 'outro',
  entidade_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  resumo TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  escopo escopo_memoria NOT NULL DEFAULT 'compartilhada',
  relevancia REAL DEFAULT 0.5,
  ultima_interacao TIMESTAMPTZ,
  criado_por_robo UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entidade_tipo, entidade_id)
);

-- ==================== TABELA: EVENTOS ====================
CREATE TABLE IF NOT EXISTS memoria_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  entidade_tipo tipo_entidade,
  entidade_id TEXT,
  tipo_evento tipo_evento NOT NULL DEFAULT 'outro',
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_evento TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  escopo escopo_memoria NOT NULL DEFAULT 'compartilhada',
  criado_por_robo UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: CONVERSAS CONSOLIDADAS ====================
CREATE TABLE IF NOT EXISTS memoria_conversas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  entidade_tipo tipo_entidade,
  entidade_id TEXT,
  canal TEXT DEFAULT 'whatsapp',
  assunto TEXT,
  resumo TEXT,
  mensagens_count INTEGER DEFAULT 0,
  ultima_mensagem TEXT,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  escopo escopo_memoria NOT NULL DEFAULT 'compartilhada',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: PREFERÊNCIAS ====================
CREATE TABLE IF NOT EXISTS memoria_preferencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  entidade_tipo tipo_entidade,
  entidade_id TEXT,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  categoria TEXT DEFAULT 'geral',
  aprendido_automaticamente BOOLEAN DEFAULT false,
  escopo escopo_memoria NOT NULL DEFAULT 'compartilhada',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entidade_tipo, entidade_id, chave)
);

-- ==================== TABELA: RESUMOS ====================
CREATE TABLE IF NOT EXISTS memoria_resumos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  entidade_tipo tipo_entidade,
  entidade_id TEXT,
  sumario TEXT NOT NULL,
  nivel_detalhe TEXT DEFAULT 'normal',
  periodo_referencia TEXT,
  gerado_por UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  origem_dados TEXT[] DEFAULT '{}',
  escopo escopo_memoria NOT NULL DEFAULT 'compartilhada',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_tipo_id ON memoria_entidades (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_robo ON memoria_entidades (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_relevancia ON memoria_entidades (relevancia DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_ultima ON memoria_entidades (ultima_interacao DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_nome ON memoria_entidades USING gin (to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_resumo ON memoria_entidades USING gin (to_tsvector('portuguese', coalesce(resumo, '')));

CREATE INDEX IF NOT EXISTS idx_memoria_eventos_entidade ON memoria_eventos (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_robo ON memoria_eventos (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_tipo ON memoria_eventos (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_data ON memoria_eventos (data_evento DESC);

CREATE INDEX IF NOT EXISTS idx_memoria_conversas_entidade ON memoria_conversas (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_conversas_robo ON memoria_conversas (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_conversas_data ON memoria_conversas (data_fim DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_memoria_preferencias_entidade ON memoria_preferencias (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_preferencias_robo ON memoria_preferencias (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_preferencias_categoria ON memoria_preferencias (categoria);

CREATE INDEX IF NOT EXISTS idx_memoria_resumos_entidade ON memoria_resumos (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_resumos_robo ON memoria_resumos (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_resumos_data ON memoria_resumos (created_at DESC);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE memoria_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoria_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoria_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoria_preferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoria_resumos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_entidades_select' AND tablename = 'memoria_entidades') THEN
    CREATE POLICY "memoria_entidades_select" ON memoria_entidades FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_entidades_insert' AND tablename = 'memoria_entidades') THEN
    CREATE POLICY "memoria_entidades_insert" ON memoria_entidades FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_entidades_update' AND tablename = 'memoria_entidades') THEN
    CREATE POLICY "memoria_entidades_update" ON memoria_entidades FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_entidades_delete' AND tablename = 'memoria_entidades') THEN
    CREATE POLICY "memoria_entidades_delete" ON memoria_entidades FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_eventos_select' AND tablename = 'memoria_eventos') THEN
    CREATE POLICY "memoria_eventos_select" ON memoria_eventos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_eventos_insert' AND tablename = 'memoria_eventos') THEN
    CREATE POLICY "memoria_eventos_insert" ON memoria_eventos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_eventos_update' AND tablename = 'memoria_eventos') THEN
    CREATE POLICY "memoria_eventos_update" ON memoria_eventos FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_eventos_delete' AND tablename = 'memoria_eventos') THEN
    CREATE POLICY "memoria_eventos_delete" ON memoria_eventos FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conversas_select' AND tablename = 'memoria_conversas') THEN
    CREATE POLICY "memoria_conversas_select" ON memoria_conversas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conversas_insert' AND tablename = 'memoria_conversas') THEN
    CREATE POLICY "memoria_conversas_insert" ON memoria_conversas FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conversas_update' AND tablename = 'memoria_conversas') THEN
    CREATE POLICY "memoria_conversas_update" ON memoria_conversas FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_conversas_delete' AND tablename = 'memoria_conversas') THEN
    CREATE POLICY "memoria_conversas_delete" ON memoria_conversas FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_preferencias_select' AND tablename = 'memoria_preferencias') THEN
    CREATE POLICY "memoria_preferencias_select" ON memoria_preferencias FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_preferencias_insert' AND tablename = 'memoria_preferencias') THEN
    CREATE POLICY "memoria_preferencias_insert" ON memoria_preferencias FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_preferencias_update' AND tablename = 'memoria_preferencias') THEN
    CREATE POLICY "memoria_preferencias_update" ON memoria_preferencias FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_preferencias_delete' AND tablename = 'memoria_preferencias') THEN
    CREATE POLICY "memoria_preferencias_delete" ON memoria_preferencias FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_resumos_select' AND tablename = 'memoria_resumos') THEN
    CREATE POLICY "memoria_resumos_select" ON memoria_resumos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_resumos_insert' AND tablename = 'memoria_resumos') THEN
    CREATE POLICY "memoria_resumos_insert" ON memoria_resumos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_resumos_update' AND tablename = 'memoria_resumos') THEN
    CREATE POLICY "memoria_resumos_update" ON memoria_resumos FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'memoria_resumos_delete' AND tablename = 'memoria_resumos') THEN
    CREATE POLICY "memoria_resumos_delete" ON memoria_resumos FOR DELETE USING (true);
  END IF;
END $$;

-- ==================== TRIGGERS UPDATED_AT ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memoria_entidades_updated_at') THEN
    CREATE TRIGGER trg_memoria_entidades_updated_at BEFORE UPDATE ON memoria_entidades FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memoria_conversas_updated_at') THEN
    CREATE TRIGGER trg_memoria_conversas_updated_at BEFORE UPDATE ON memoria_conversas FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memoria_preferencias_updated_at') THEN
    CREATE TRIGGER trg_memoria_preferencias_updated_at BEFORE UPDATE ON memoria_preferencias FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
END $$;
