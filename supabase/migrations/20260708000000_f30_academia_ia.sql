CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_academia') THEN
    CREATE TYPE status_academia AS ENUM ('rascunho', 'em_andamento', 'aprovado', 'obsoleto', 'revogado');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_material_academia') THEN
    CREATE TYPE tipo_material_academia AS ENUM (
      'texto', 'pergunta_resposta', 'pdf', 'doc', 'docx',
      'xls', 'xlsx', 'csv', 'xml', 'imagem', 'audio', 'video'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS academia_cursos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'curso' CHECK (tipo IN ('modulo','curso','licao')),
  categoria TEXT,
  objetivo TEXT,
  status status_academia NOT NULL DEFAULT 'rascunho',
  versao INTEGER NOT NULL DEFAULT 1,
  autor UUID,
  aprovador UUID,
  data_aprovacao TIMESTAMPTZ,
  validade DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academia_materiais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  curso_id UUID REFERENCES academia_cursos(id) ON DELETE CASCADE,
  tipo tipo_material_academia NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  pergunta TEXT,
  resposta TEXT,
  arquivo_url TEXT,
  storage_path TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  duracao_segundos INTEGER,
  ordem INTEGER NOT NULL DEFAULT 0,
  versao INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','rascunho')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academia_progresso (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  curso_id UUID REFERENCES academia_cursos(id) ON DELETE CASCADE,
  material_id UUID REFERENCES academia_materiais(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido','pulado')),
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(robo_id, curso_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_academia_cursos_robo ON academia_cursos(robo_id);
CREATE INDEX IF NOT EXISTS idx_academia_cursos_status ON academia_cursos(status);
CREATE INDEX IF NOT EXISTS idx_academia_materiais_curso ON academia_materiais(curso_id);
CREATE INDEX IF NOT EXISTS idx_academia_materiais_tipo ON academia_materiais(tipo);
CREATE INDEX IF NOT EXISTS idx_academia_progresso_robo ON academia_progresso(robo_id);
CREATE INDEX IF NOT EXISTS idx_academia_progresso_curso ON academia_progresso(curso_id);

ALTER TABLE academia_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE academia_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE academia_progresso ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_cursos_select' AND tablename = 'academia_cursos') THEN
    CREATE POLICY "academia_cursos_select" ON academia_cursos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_cursos_insert' AND tablename = 'academia_cursos') THEN
    CREATE POLICY "academia_cursos_insert" ON academia_cursos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_cursos_update' AND tablename = 'academia_cursos') THEN
    CREATE POLICY "academia_cursos_update" ON academia_cursos FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_cursos_delete' AND tablename = 'academia_cursos') THEN
    CREATE POLICY "academia_cursos_delete" ON academia_cursos FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_materiais_select' AND tablename = 'academia_materiais') THEN
    CREATE POLICY "academia_materiais_select" ON academia_materiais FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_materiais_insert' AND tablename = 'academia_materiais') THEN
    CREATE POLICY "academia_materiais_insert" ON academia_materiais FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_materiais_update' AND tablename = 'academia_materiais') THEN
    CREATE POLICY "academia_materiais_update" ON academia_materiais FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_materiais_delete' AND tablename = 'academia_materiais') THEN
    CREATE POLICY "academia_materiais_delete" ON academia_materiais FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_progresso_select' AND tablename = 'academia_progresso') THEN
    CREATE POLICY "academia_progresso_select" ON academia_progresso FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_progresso_insert' AND tablename = 'academia_progresso') THEN
    CREATE POLICY "academia_progresso_insert" ON academia_progresso FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_progresso_update' AND tablename = 'academia_progresso') THEN
    CREATE POLICY "academia_progresso_update" ON academia_progresso FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academia_progresso_delete' AND tablename = 'academia_progresso') THEN
    CREATE POLICY "academia_progresso_delete" ON academia_progresso FOR DELETE USING (true);
  END IF;
END $$;
