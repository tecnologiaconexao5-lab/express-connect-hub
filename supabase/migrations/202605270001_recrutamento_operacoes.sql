-- Migration: Create recrutamento_operacoes table
-- Description: Dedicated table for recruitment module's operational pipeline data.
-- Separate from the transport `operacoes` table. This table holds recruitment
-- campaigns/vagas with nested financial, meta, and historical data as JSONB.

CREATE TABLE IF NOT EXISTS recrutamento_operacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  cliente TEXT NOT NULL DEFAULT '',
  regiao TEXT NOT NULL DEFAULT '',
  rota_origem TEXT DEFAULT '',
  rota_destino TEXT DEFAULT '',
  tipo_veiculo TEXT DEFAULT '',
  tipo_carga TEXT DEFAULT 'seco',
  metodo_carga TEXT DEFAULT 'paletizado',
  temperatura TEXT DEFAULT '',
  peso_carga TEXT DEFAULT '',
  dimensoes TEXT DEFAULT '',
  local_carregamento TEXT DEFAULT '',
  local_descarregamento TEXT DEFAULT '',
  horario_carregamento TEXT DEFAULT '',
  horario_descarregamento TEXT DEFAULT '',
  data_inicio TEXT DEFAULT '',
  data_fim TEXT DEFAULT '',
  recurrencia TEXT DEFAULT 'unica',
  frequencia TEXT DEFAULT 'fixa',
  status TEXT DEFAULT 'aberta',
  prioridade TEXT DEFAULT 'media',

  -- Free text notes
  observacoes TEXT DEFAULT '',

  -- Complex nested structures (JSONB)
  financeiro JSONB DEFAULT '{}'::jsonb,
  meta JSONB DEFAULT '{}'::jsonb,
  historico JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'admin'
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_status ON recrutamento_operacoes(status);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_prioridade ON recrutamento_operacoes(prioridade);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_cliente ON recrutamento_operacoes(cliente);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_nome ON recrutamento_operacoes(nome);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_regiao ON recrutamento_operacoes(regiao);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_tipo_veiculo ON recrutamento_operacoes(tipo_veiculo);

-- GIN index for JSONB financeiro queries (e.g., financeiro->>'valorPrestador')
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_financeiro ON recrutamento_operacoes USING GIN (financeiro);

-- GIN index for JSONB meta queries (e.g., meta->>'vagasTotais')
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_meta ON recrutamento_operacoes USING GIN (meta);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_created_at ON recrutamento_operacoes(created_at);

-- Enable Row Level Security
ALTER TABLE recrutamento_operacoes ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can SELECT
CREATE POLICY "recrutamento_operacoes_select" ON recrutamento_operacoes
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can INSERT
CREATE POLICY "recrutamento_operacoes_insert" ON recrutamento_operacoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can UPDATE
CREATE POLICY "recrutamento_operacoes_update" ON recrutamento_operacoes
  FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can DELETE
CREATE POLICY "recrutamento_operacoes_delete" ON recrutamento_operacoes
  FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Add table to realtime publication so the frontend can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE recrutamento_operacoes;
