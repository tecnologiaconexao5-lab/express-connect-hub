-- GD-11: Bucket privado `propostas` para uploads explícitos da aba Propostas.
-- Espelha o padrão de 20261102000001_documentos_operacionais_metadata.sql (linhas 1-39).
-- O INSERT com id em texto funciona porque storage.buckets.id é text no Supabase
-- (mesmo padrão aplicado com sucesso em produção em 20261102000001).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'propostas',
  'propostas',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "propostas_select" ON storage.objects;
DROP POLICY IF EXISTS "propostas_insert" ON storage.objects;
DROP POLICY IF EXISTS "propostas_update" ON storage.objects;
DROP POLICY IF EXISTS "propostas_delete" ON storage.objects;

CREATE POLICY "propostas_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'propostas');

CREATE POLICY "propostas_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'propostas');

CREATE POLICY "propostas_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'propostas')
  WITH CHECK (bucket_id = 'propostas');

CREATE POLICY "propostas_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'propostas');

NOTIFY pgrst, 'reload schema';
