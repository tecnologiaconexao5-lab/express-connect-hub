-- Fundacao 04: Tabela fiscal_documentos_vinculados (XML/NF-e vinculados a OS/CT-e/MDF-e)
-- Idempotente: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS

CREATE TABLE IF NOT EXISTS public.fiscal_documentos_vinculados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  ordem_servico_id uuid,
  cte_id uuid REFERENCES public.fiscal_ctes(id) ON DELETE SET NULL,
  mdfe_id uuid REFERENCES public.fiscal_mdfes(id) ON DELETE SET NULL,

  tipo_documento text NOT NULL DEFAULT 'nfe',
  chave_acesso text,
  numero text,
  serie text,
  data_emissao date,

  emitente_cnpj text,
  emitente_nome text,
  destinatario_cnpj text,
  destinatario_nome text,
  municipio_origem text,
  uf_origem text,
  municipio_destino text,
  uf_destino text,

  valor_total numeric(14,2),
  peso_total numeric(14,3),
  produto_predominante text,

  xml_storage_path text,
  xml_nome_arquivo text,

  status text DEFAULT 'importado',
  metadata jsonb DEFAULT '{}'::jsonb,

  criado_por uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Colunas que podem nao existir em tabela preexistente
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS cte_id uuid REFERENCES public.fiscal_ctes(id) ON DELETE SET NULL;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS mdfe_id uuid REFERENCES public.fiscal_mdfes(id) ON DELETE SET NULL;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS municipio_origem text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS uf_origem text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS municipio_destino text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS uf_destino text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS produto_predominante text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS xml_storage_path text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS xml_nome_arquivo text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS peso_total numeric(14,3);
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS chave_acesso text;
ALTER TABLE public.fiscal_documentos_vinculados ADD COLUMN IF NOT EXISTS criado_por uuid;

-- Indices
CREATE INDEX IF NOT EXISTS idx_fdv_os ON public.fiscal_documentos_vinculados(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fdv_cte ON public.fiscal_documentos_vinculados(cte_id);
CREATE INDEX IF NOT EXISTS idx_fdv_mdfe ON public.fiscal_documentos_vinculados(mdfe_id);
CREATE INDEX IF NOT EXISTS idx_fdv_chave ON public.fiscal_documentos_vinculados(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fdv_tipo ON public.fiscal_documentos_vinculados(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_fdv_status ON public.fiscal_documentos_vinculados(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_fdv_updated_at ON public.fiscal_documentos_vinculados;
CREATE TRIGGER trg_fdv_updated_at
  BEFORE UPDATE ON public.fiscal_documentos_vinculados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.fiscal_documentos_vinculados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated" ON public.fiscal_documentos_vinculados;
CREATE POLICY "Enable select for authenticated" ON public.fiscal_documentos_vinculados
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.fiscal_documentos_vinculados;
CREATE POLICY "Enable insert for authenticated" ON public.fiscal_documentos_vinculados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated" ON public.fiscal_documentos_vinculados;
CREATE POLICY "Enable update for authenticated" ON public.fiscal_documentos_vinculados
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.fiscal_documentos_vinculados;
CREATE POLICY "Enable delete for authenticated" ON public.fiscal_documentos_vinculados
  FOR DELETE USING (auth.role() = 'authenticated');

-- Bucket Storage privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fiscal-documentos', 'fiscal-documentos', false, 20971520, ARRAY['application/xml', 'text/xml', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Comentarios
COMMENT ON TABLE public.fiscal_documentos_vinculados IS 'XMLs de NF-e e outros documentos fiscais importados e vinculados a OS, CT-e ou MDF-e.';
COMMENT ON COLUMN public.fiscal_documentos_vinculados.tipo_documento IS 'nfe, nfse, cte, mdfe, outro';
COMMENT ON COLUMN public.fiscal_documentos_vinculados.status IS 'importado, aguardando_vinculo, vinculado, processado';
