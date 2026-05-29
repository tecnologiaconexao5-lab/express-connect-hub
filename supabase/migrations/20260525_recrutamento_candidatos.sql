-- Migration: Create recrutamento_candidatos table (Enterprise Pipeline)
-- Description: Dedicated table for the Enterprise Kanban pipeline candidates.
-- Separate from the real `candidatos` table (which stores leads from CadastroPrestador, etc.).
-- This table holds candidates throughout the 10-stage pipeline (novo_cadastro → ativo/bloqueado/reprovado).

CREATE TABLE IF NOT EXISTS recrutamento_candidatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  foto TEXT DEFAULT '',
  score INTEGER DEFAULT 50,
  cidade TEXT DEFAULT '',
  uf TEXT DEFAULT '',
  veiculo TEXT DEFAULT '',
  placa TEXT DEFAULT '',
  status_documental TEXT DEFAULT 'pendente',
  prioridade TEXT DEFAULT 'media',
  validade_cnh TEXT DEFAULT 'valida',
  data_validade_cnh TEXT DEFAULT '',
  tags JSONB DEFAULT '[]'::jsonb,
  observacoes_ia TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  stage TEXT DEFAULT 'novo_cadastro',
  data_entrada TEXT DEFAULT '',
  data_atualizacao TEXT DEFAULT '',
  documentos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common pipeline queries
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_stage ON recrutamento_candidatos(stage);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_score ON recrutamento_candidatos(score);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_nome ON recrutamento_candidatos(nome);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_status_documental ON recrutamento_candidatos(status_documental);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_prioridade ON recrutamento_candidatos(prioridade);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_data_atualizacao ON recrutamento_candidatos(data_atualizacao);

-- GIN index for tags array queries
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_tags ON recrutamento_candidatos USING GIN (tags);

-- Enable Row Level Security
ALTER TABLE recrutamento_candidatos ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can SELECT
CREATE POLICY "recrutamento_candidatos_select" ON recrutamento_candidatos
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can INSERT
CREATE POLICY "recrutamento_candidatos_insert" ON recrutamento_candidatos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can UPDATE
CREATE POLICY "recrutamento_candidatos_update" ON recrutamento_candidatos
  FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can DELETE
CREATE POLICY "recrutamento_candidatos_delete" ON recrutamento_candidatos
  FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE recrutamento_candidatos;
