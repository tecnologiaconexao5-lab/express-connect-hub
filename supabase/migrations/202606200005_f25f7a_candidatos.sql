-- ============================================================
-- MIGRATION: 20260620_f25f7a_candidatos
-- PROJETO: TMS Conexão Express Hub
-- FASE: F25F.7A — Correção do ambiente: criação da tabela candidatos
-- DESCRIÇÃO:
--   Cria a tabela `candidatos` que nunca foi criada por migration.
--   A tabela existia apenas em schemas agregados (supabase_schema.sql,
--   rebuild_supabase_schema.sql, sql_final_supabase.sql) que nunca
--   foram executados no Supabase remoto.
--
--   Schema alinhado com Schema A (usado por CadastroPrestador,
--   criarCandidatoService, recrutamentoIA, recrutamentoIntegracao).
--   Inclui coluna `uf` que é inserida por criarCandidatoService mas
--   estava ausente em todos os schemas agregados.
-- ============================================================

-- ============================================================
-- PARTE 1: CRIAR TABELA candidatos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidatos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  cidade TEXT,
  uf TEXT,
  regiao TEXT,
  tipo_veiculo TEXT,
  tipo_carroceria TEXT,
  placa TEXT,
  experiencia_anos INTEGER,
  como_conheceu TEXT,
  mensagem_livre TEXT,
  canal_captacao TEXT DEFAULT 'link_direto',
  status TEXT DEFAULT 'interessado',
  score_perfil NUMERIC DEFAULT 0,
  prioridade NUMERIC DEFAULT 0,
  ultima_interacao TIMESTAMPTZ,
  prestador_id UUID REFERENCES public.prestadores(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PARTE 2: PERMISSÕES
-- ============================================================
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;

-- RLS: anon e authenticated podem SELECT
DROP POLICY IF EXISTS "candidatos_select" ON public.candidatos;
CREATE POLICY "candidatos_select" ON public.candidatos
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.role() = 'service_role');

-- RLS: anon e authenticated podem INSERT
DROP POLICY IF EXISTS "candidatos_insert" ON public.candidatos;
CREATE POLICY "candidatos_insert" ON public.candidatos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.role() = 'service_role');

-- RLS: authenticated podem UPDATE
DROP POLICY IF EXISTS "candidatos_update" ON public.candidatos;
CREATE POLICY "candidatos_update" ON public.candidatos
  FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================
-- PARTE 3: ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_candidatos_status ON public.candidatos(status);
CREATE INDEX IF NOT EXISTS idx_candidatos_prestador ON public.candidatos(prestador_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_cpf ON public.candidatos(cpf);
CREATE INDEX IF NOT EXISTS idx_candidatos_regiao ON public.candidatos(regiao);
CREATE INDEX IF NOT EXISTS idx_candidatos_criado_em ON public.candidatos(created_at);

-- ============================================================
-- PARTE 4: NOTIFICAR RECARGA DE SCHEMA
-- ============================================================
NOTIFY pgrst, 'reload schema';
