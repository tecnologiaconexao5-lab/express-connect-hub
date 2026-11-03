-- Documentos Operacionais + metadados integrados (base do módulo com IA)
-- Bucket privado `documentos_operacionais` + tabela `documentos_metadata`.
-- Espelha documentos do App (documentos_prestadores) nos metadados para o TMS.

-- 1) Bucket privado -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_operacionais',
  'documentos_operacionais',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "documentos_operacionais_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_operacionais_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_operacionais_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_operacionais_delete" ON storage.objects;

CREATE POLICY "documentos_operacionais_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos_operacionais');

CREATE POLICY "documentos_operacionais_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos_operacionais');

CREATE POLICY "documentos_operacionais_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos_operacionais')
  WITH CHECK (bucket_id = 'documentos_operacionais');

CREATE POLICY "documentos_operacionais_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos_operacionais');

-- 2) Tabela de metadados ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documentos_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  nome TEXT,
  tipo TEXT,
  modulo_origem TEXT NOT NULL,
  entidade_id UUID,
  status_ia TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_ia IN (
      'pendente',
      'processando',
      'aprovado_na_conferencia',
      'com_ressalvas',
      'necessita_de_correcao',
      'erro'
    )),
  relatorio_ia JSONB,
  data_inclusao TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID DEFAULT current_tenant_id_safe(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_metadata_modulo_entidade_url
  ON public.documentos_metadata (modulo_origem, entidade_id, url);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_entidade
  ON public.documentos_metadata (modulo_origem, entidade_id, data_inclusao DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_status_ia
  ON public.documentos_metadata (status_ia);

ALTER TABLE public.documentos_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_metadata_select" ON public.documentos_metadata;
DROP POLICY IF EXISTS "documentos_metadata_insert" ON public.documentos_metadata;
DROP POLICY IF EXISTS "documentos_metadata_update" ON public.documentos_metadata;
DROP POLICY IF EXISTS "documentos_metadata_delete" ON public.documentos_metadata;

CREATE POLICY "documentos_metadata_select" ON public.documentos_metadata
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "documentos_metadata_insert" ON public.documentos_metadata
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "documentos_metadata_update" ON public.documentos_metadata
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "documentos_metadata_delete" ON public.documentos_metadata
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_metadata TO service_role;

-- 3) Backfill dos documentos já existentes (App/TMS legado) -------------------
INSERT INTO public.documentos_metadata
  (url, nome, tipo, modulo_origem, entidade_id, status_ia, data_inclusao)
SELECT
  CASE
    WHEN d.url ~ '^https?://' THEN d.url
    WHEN split_part(d.url, '/', 1) IN ('documentos_prestadores', 'documentos_operacionais') THEN d.url
    ELSE 'documentos_prestadores/' || d.url
  END,
  d.tipo,
  d.tipo,
  'prestadores',
  d.prestador_id,
  'pendente',
  COALESCE(d.created_at, now())
FROM public.documentos_prestadores d
WHERE d.prestador_id IS NOT NULL
  AND d.url IS NOT NULL
ON CONFLICT (modulo_origem, entidade_id, url) DO NOTHING;

-- 4) Espelha novos documentos do App na tabela de metadados -------------------
CREATE OR REPLACE FUNCTION public.f_documentos_prestadores_para_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url text;
BEGIN
  IF NEW.prestador_id IS NULL OR NEW.url IS NULL THEN
    RETURN NEW;
  END IF;

  v_url := CASE
    WHEN NEW.url ~ '^https?://' THEN NEW.url
    WHEN split_part(NEW.url, '/', 1) IN ('documentos_prestadores', 'documentos_operacionais') THEN NEW.url
    ELSE 'documentos_prestadores/' || NEW.url
  END;

  INSERT INTO public.documentos_metadata
    (url, nome, tipo, modulo_origem, entidade_id, status_ia, data_inclusao)
  VALUES
    (v_url, NEW.tipo, NEW.tipo, 'prestadores', NEW.prestador_id, 'pendente', COALESCE(NEW.created_at, now()))
  ON CONFLICT (modulo_origem, entidade_id, url) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_prestadores_metadata ON public.documentos_prestadores;
CREATE TRIGGER trg_documentos_prestadores_metadata
  AFTER INSERT OR UPDATE OF url, tipo
  ON public.documentos_prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.f_documentos_prestadores_para_metadata();

NOTIFY pgrst, 'reload schema';
