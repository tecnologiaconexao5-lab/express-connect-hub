-- ============================================================
-- MARKETING - Schema de Campanhas e Leads
-- ============================================================

-- Tabela de Campanhas
CREATE TABLE IF NOT EXISTS campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_campanha TEXT NOT NULL,
  tipo_campanha TEXT CHECK (tipo_campanha IN ('CLIENTE', 'MOTORISTA')) NOT NULL,
  objetivo TEXT,
  canal TEXT,
  publico_alvo TEXT,
  orcamento_estimado NUMERIC(12,2),
  data_inicio DATE,
  data_fim DATE,
  status TEXT CHECK (status IN ('Rascunho', 'Ativa', 'Pausada', 'Finalizada')) DEFAULT 'Rascunho',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Leads (vinculados a campanhas)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  empresa TEXT,
  origem TEXT,
  campanha_id UUID REFERENCES campanhas(id) ON DELETE SET NULL,
  tipo_lead TEXT CHECK (tipo_lead IN ('CLIENTE', 'MOTORISTA')) NOT NULL,
  status TEXT CHECK (status IN ('Novo', 'Em contato', 'Qualificado', 'Perdido')) DEFAULT 'Novo',
  responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Criativos
CREATE TABLE IF NOT EXISTS criativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('Imagem', 'Vídeo', 'Carrossel', 'Story', 'Post', 'Banner')) NOT NULL,
  descricao TEXT,
  link TEXT,
  campanha_id UUID REFERENCES campanhas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Postagens/Conteúdo
CREATE TABLE IF NOT EXISTS postagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_planejada DATE,
  canal TEXT,
  conteudo TEXT,
  status TEXT CHECK (status IN ('Rascunho', 'Agendada', 'Publicada', 'Cancelada')) DEFAULT 'Rascunho',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_leads_campanha ON leads(campanha_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_origem ON leads(origem);
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON campanhas(status);
CREATE INDEX IF NOT EXISTS idx_criativos_campanha ON criativos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_postagens_data ON postagens(data_planejada);

-- Habilitar RLS (Row Level Security)
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE criativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE postagens ENABLE ROW LEVEL SECURITY;

-- Policies para acesso público
DROP POLICY IF EXISTS "Allow public access campanhas" ON campanhas;
CREATE POLICY "Allow public access campanhas" ON campanhas FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access leads" ON leads;
CREATE POLICY "Allow public access leads" ON leads FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access criativos" ON criativos;
CREATE POLICY "Allow public access criativos" ON criativos FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access postagens" ON postagens;
CREATE POLICY "Allow public access postagens" ON postagens FOR ALL USING (true);