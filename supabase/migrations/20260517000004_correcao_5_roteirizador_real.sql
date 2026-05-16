-- ============================================================
-- MIGRAÇÃO: Roteirizador Real
-- Correção 5 — 2026-05-17
-- ============================================================

-- ─── 1. rotas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho',
  data_rota DATE,
  tipo_rota TEXT DEFAULT 'entrega',
  distancia_km NUMERIC DEFAULT 0,
  duracao_min NUMERIC DEFAULT 0,
  peso_total NUMERIC DEFAULT 0,
  volumes_total INTEGER DEFAULT 0,
  veiculo_sugerido TEXT,
  prestador_id UUID NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. rota_paradas ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rota_paradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  sequencia INTEGER NOT NULL,
  cliente_nome TEXT,
  telefone TEXT,
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  complemento TEXT,
  latitude NUMERIC NULL,
  longitude NUMERIC NULL,
  peso NUMERIC DEFAULT 0,
  volumes INTEGER DEFAULT 0,
  cubagem NUMERIC DEFAULT 0,
  temperatura TEXT,
  prioridade TEXT DEFAULT 'normal',
  janela_entrega TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. rota_execucoes (Preparação app motorista) ───────────
CREATE TABLE IF NOT EXISTS rota_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  prestador_id UUID,
  status TEXT DEFAULT 'pendente',
  iniciado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. Índices ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rotas_status ON rotas(status);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_rota_id ON rota_paradas(rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_cidade ON rota_paradas(cidade);
CREATE INDEX IF NOT EXISTS idx_rota_execucoes_rota_id ON rota_execucoes(rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_execucoes_prestador_id ON rota_execucoes(prestador_id);

-- ─── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_paradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_execucoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rotas' AND policyname = 'allow_all_rotas') THEN
    CREATE POLICY allow_all_rotas ON rotas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rota_paradas' AND policyname = 'allow_all_rota_paradas') THEN
    CREATE POLICY allow_all_rota_paradas ON rota_paradas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rota_execucoes' AND policyname = 'allow_all_rota_execucoes') THEN
    CREATE POLICY allow_all_rota_execucoes ON rota_execucoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;
