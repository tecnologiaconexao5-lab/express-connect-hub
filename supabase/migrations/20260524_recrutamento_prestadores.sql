-- Migration: Create recrutamento_prestadores table
-- Description: Dedicated table for recruitment module's prestador pipeline data.
-- Separate from the company-wide `prestadores` table (which stores approved/active providers).
-- This table holds candidates throughout the recruitment workflow (novo → em_analise → aprovado/reserva/agregado/bloqueado).

CREATE TABLE IF NOT EXISTS recrutamento_prestadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  razao_social TEXT DEFAULT '',
  cpf_cnpj TEXT DEFAULT '',
  rg TEXT DEFAULT '',
  data_nascimento TEXT DEFAULT '',

  -- Complex nested structures (JSONB)
  contatos JSONB DEFAULT '[]'::jsonb,
  endereco JSONB DEFAULT '{}'::jsonb,

  -- Vehicle information
  tipo_veiculo TEXT DEFAULT '',
  placa_veiculo TEXT DEFAULT '',
  eixos INTEGER DEFAULT 0,
  capacidade_kg INTEGER DEFAULT 0,
  capacidade_m3 INTEGER DEFAULT 0,
  tipo_carga_veiculo TEXT DEFAULT 'seco',

  -- Availability and coverage regions
  disponibilidade TEXT DEFAULT '',
  regioes_atuacao JSONB DEFAULT '[]'::jsonb,

  -- Recruitment pipeline
  origem_cadastro TEXT DEFAULT 'site',
  status TEXT DEFAULT 'novo',

  -- Scoring system (JSONB with geral, documentacao, experiencia, reputacao, regularidade, perfil, tendencia, historico)
  score JSONB DEFAULT '{}'::jsonb,

  -- Uploaded documents (JSONB array)
  documentos JSONB DEFAULT '[]'::jsonb,

  -- Onboarding progress
  onboarding TEXT DEFAULT 'nao_iniciado',
  canal_captacao TEXT DEFAULT 'site',
  indicado_por TEXT DEFAULT '',

  -- Historical data
  historico JSONB DEFAULT '{}'::jsonb,
  data_cadastro TEXT DEFAULT '',
  data_ativacao TEXT DEFAULT '',
  ultima_atividade TEXT DEFAULT '',

  -- Free notes and tags
  observacoes TEXT DEFAULT '',
  tags JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_status ON recrutamento_prestadores(status);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_cpf_cnpj ON recrutamento_prestadores(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_nome ON recrutamento_prestadores(nome);

-- GIN index for JSONB score queries (e.g., score->>'geral')
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_score ON recrutamento_prestadores USING GIN (score);

-- GIN index for tags array matching
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_tags ON recrutamento_prestadores USING GIN (tags);

-- GIN index for regioes_atuacao array matching
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_regioes ON recrutamento_prestadores USING GIN (regioes_atuacao);

-- Index for onboarding filtering
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_onboarding ON recrutamento_prestadores(onboarding);

-- Index for data_cadastro sorting
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_data_cadastro ON recrutamento_prestadores(data_cadastro);

-- Enable Row Level Security
ALTER TABLE recrutamento_prestadores ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can SELECT
DROP POLICY IF EXISTS "recrutamento_prestadores_select" ON recrutamento_prestadores;
CREATE POLICY "recrutamento_prestadores_select" ON recrutamento_prestadores
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can INSERT
DROP POLICY IF EXISTS "recrutamento_prestadores_insert" ON recrutamento_prestadores;
CREATE POLICY "recrutamento_prestadores_insert" ON recrutamento_prestadores
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can UPDATE
DROP POLICY IF EXISTS "recrutamento_prestadores_update" ON recrutamento_prestadores;
CREATE POLICY "recrutamento_prestadores_update" ON recrutamento_prestadores
  FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS: authenticated users can DELETE
DROP POLICY IF EXISTS "recrutamento_prestadores_delete" ON recrutamento_prestadores;
CREATE POLICY "recrutamento_prestadores_delete" ON recrutamento_prestadores
  FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Add table to realtime publication so the frontend can subscribe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'recrutamento_prestadores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recrutamento_prestadores;
  END IF;
END $$;


