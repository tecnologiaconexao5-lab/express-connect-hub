-- Scripts para criar tabelas da Biblioteca
-- Execute estes comandos no editor SQL do Supabase

-- Tabela de modelos de mensagens
CREATE TABLE IF NOT EXISTS modelos_mensagens (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de fluxo de recrutamento
CREATE TABLE IF NOT EXISTS fluxo_recrutamento (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS nas tabelas (opcional - pode desabilitar para teste)
-- ALTER TABLE modelos_mensagens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fluxo_recrutamento ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso público para leitura/escrita (temporário)
-- CREATE POLICY "Allow all" ON modelos_mensagens FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON fluxo_recrutamento FOR ALL USING (true) WITH CHECK (true);