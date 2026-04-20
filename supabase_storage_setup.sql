-- ============================================================
-- SUPABASE STORAGE SETUP - TMS CONEXÃO EXPRESS
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CRIAR BUCKETS
-- ============================================================

-- Bucket prestadores (para fotos de perfil e documentos pessoais)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('prestadores', 'prestadores', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Bucket documentos_prestadores (para CNH, contrato, CRLV, etc)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos_prestadores', 'documentos_prestadores', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Bucket veiculos (para fotos dos veículos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('veiculos', 'veiculos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- ============================================================
-- 2. POLICIES PARA CADA BUCKET
-- ============================================================

-- ============================================================
-- BUCKET: prestadores
-- ============================================================

-- Policy SELECT (público) - qualquer um pode visualizar
DROP POLICY IF EXISTS "Public select on prestadores" ON storage.objects;
CREATE POLICY "Public select on prestadores" ON storage.objects
FOR SELECT USING (bucket_id = 'prestadores');

-- Policy INSERT (autenticado) - usuários logados podem fazer upload
DROP POLICY IF EXISTS "Authenticated insert on prestadores" ON storage.objects;
CREATE POLICY "Authenticated insert on prestadores" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'prestadores' AND auth.role() = 'authenticated');

-- Policy UPDATE (autenticado) - usuários logados podem atualizar
DROP POLICY IF EXISTS "Authenticated update on prestadores" ON storage.objects;
CREATE POLICY "Authenticated update on prestadores" ON storage.objects
FOR UPDATE USING (bucket_id = 'prestadores' AND auth.role() = 'authenticated');

-- Policy DELETE (autenticado) - usuários logados podem deletar
DROP POLICY IF EXISTS "Authenticated delete on prestadores" ON storage.objects;
CREATE POLICY "Authenticated delete on prestadores" ON storage.objects
FOR DELETE USING (bucket_id = 'prestadores' AND auth.role() = 'authenticated');

-- ============================================================
-- BUCKET: documentos_prestadores
-- ============================================================

-- Policy SELECT (público)
DROP POLICY IF EXISTS "Public select on documentos_prestadores" ON storage.objects;
CREATE POLICY "Public select on documentos_prestadores" ON storage.objects
FOR SELECT USING (bucket_id = 'documentos_prestadores');

-- Policy INSERT (autenticado)
DROP POLICY IF EXISTS "Authenticated insert on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated insert on documentos_prestadores" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- Policy UPDATE (autenticado)
DROP POLICY IF EXISTS "Authenticated update on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated update on documentos_prestadores" ON storage.objects
FOR UPDATE USING (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- Policy DELETE (autenticado)
DROP POLICY IF EXISTS "Authenticated delete on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated delete on documentos_prestadores" ON storage.objects
FOR DELETE USING (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- ============================================================
-- BUCKET: veiculos
-- ============================================================

-- Policy SELECT (público)
DROP POLICY IF EXISTS "Public select on veiculos" ON storage.objects;
CREATE POLICY "Public select on veiculos" ON storage.objects
FOR SELECT USING (bucket_id = 'veiculos');

-- Policy INSERT (autenticado)
DROP POLICY IF EXISTS "Authenticated insert on veiculos" ON storage.objects;
CREATE POLICY "Authenticated insert on veiculos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'veiculos' AND auth.role() = 'authenticated');

-- Policy UPDATE (autenticado)
DROP POLICY IF EXISTS "Authenticated update on veiculos" ON storage.objects;
CREATE POLICY "Authenticated update on veiculos" ON storage.objects
FOR UPDATE USING (bucket_id = 'veiculos' AND auth.role() = 'authenticated');

-- Policy DELETE (autenticado)
DROP POLICY IF EXISTS "Authenticated delete on veiculos" ON storage.objects;
CREATE POLICY "Authenticated delete on veiculos" ON storage.objects
FOR DELETE USING (bucket_id = 'veiculos' AND auth.role() = 'authenticated');

-- ============================================================
-- 3. VALIDAR CRIAÇÃO
-- ============================================================

SELECT 
  id AS bucket_id,
  name AS bucket_name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('prestadores', 'documentos_prestadores', 'veiculos');

-- Verificar policies criadas
SELECT 
  policyname,
  tablename,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage';