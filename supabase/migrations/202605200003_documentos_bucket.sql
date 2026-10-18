-- Migration: Add safe `documentos` storage bucket and policies
-- This migration is safe to run multiple times and will not drop existing buckets or policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Public read access for documentos bucket
DROP POLICY IF EXISTS "Public select on documentos" ON storage.objects;
DROP POLICY IF EXISTS "Public select on documentos" ON storage.objects;
CREATE POLICY "Public select on documentos" ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos');

-- Authenticated upload access for documentos bucket
DROP POLICY IF EXISTS "Authenticated insert on documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert on documentos" ON storage.objects;
CREATE POLICY "Authenticated insert on documentos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documentos' AND auth.role() = 'authenticated');

-- Authenticated update access for documentos bucket
DROP POLICY IF EXISTS "Authenticated update on documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update on documentos" ON storage.objects;
CREATE POLICY "Authenticated update on documentos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');

-- Authenticated delete access for documentos bucket
DROP POLICY IF EXISTS "Authenticated delete on documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete on documentos" ON storage.objects;
CREATE POLICY "Authenticated delete on documentos" ON storage.objects
  FOR DELETE USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');


