-- ============================================================
-- MIGRATION: 20260620_f25fa3_treinamento_arquivos_ia
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Tabela de metadados dos arquivos de treinamento
-- dos Funcionários Digitais (Robôs IA)
-- ============================================================

-- ==================== TIPO ENUM ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_arquivo_treinamento') THEN
    CREATE TYPE status_arquivo_treinamento AS ENUM ('rascunho', 'ativo', 'arquivado', 'expirado');
  END IF;
END
$$;

-- ==================== TABELA ====================
CREATE TABLE IF NOT EXISTS treinamento_arquivos_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  conhecimento_id uuid REFERENCES ia_conhecimento(id) ON DELETE SET NULL,
  nome_original text NOT NULL,
  nome_armazenado text NOT NULL,
  tipo_arquivo text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  bucket text NOT NULL DEFAULT 'biblioteca-global',
  caminho_storage text NOT NULL,
  categoria text,
  descricao text,
  tags text[] DEFAULT '{}',
  versao integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativo',
  validade_inicio date,
  validade_fim date,
  hash_arquivo text,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_arquivo_treinamento_check CHECK (status IN ('rascunho', 'ativo', 'arquivado', 'expirado'))
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_robo ON treinamento_arquivos_ia (robo_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_conhecimento ON treinamento_arquivos_ia (conhecimento_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_categoria ON treinamento_arquivos_ia (categoria);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_status ON treinamento_arquivos_ia (status);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_tipo ON treinamento_arquivos_ia (tipo_arquivo);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_validade ON treinamento_arquivos_ia (validade_inicio, validade_fim);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_busca ON treinamento_arquivos_ia USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_criado_em ON treinamento_arquivos_ia (criado_em DESC);

-- ==================== RLS ====================
ALTER TABLE treinamento_arquivos_ia ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treinamento_arquivos_admin_all' AND tablename = 'treinamento_arquivos_ia') THEN
    CREATE POLICY treinamento_arquivos_admin_all ON treinamento_arquivos_ia
      FOR ALL TO public
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treinamento_arquivos_anon_all' AND tablename = 'treinamento_arquivos_ia') THEN
    CREATE POLICY treinamento_arquivos_anon_all ON treinamento_arquivos_ia
      FOR ALL TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ==================== ATUALIZAR BUCKET EXISTENTE ====================
-- Garantir que o bucket biblioteca-global aceite os MIME types de treinamento
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 104857600, -- 100MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'text/plain', 'text/csv', 'text/html',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/zip', 'application/x-rar-compressed',
    'application/json', 'application/xml', 'text/xml'
  ]
WHERE id = 'biblioteca-global';
