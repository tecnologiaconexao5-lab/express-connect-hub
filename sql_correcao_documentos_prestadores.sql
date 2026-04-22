-- ============================================================
-- CORREÇÃO: Documentos de Prestadores
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Garantir bucket documentos_prestadores existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos_prestadores', 'documentos_prestadores', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- 2. Policies do bucket
DROP POLICY IF EXISTS "Public select on documentos_prestadores" ON storage.objects;
CREATE POLICY "Public select on documentos_prestadores" ON storage.objects
FOR SELECT USING (bucket_id = 'documentos_prestadores');

DROP POLICY IF EXISTS "Authenticated insert on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated insert on documentos_prestadores" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated update on documentos_prestadores" ON storage.objects
FOR UPDATE USING (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated delete on documentos_prestadores" ON storage.objects
FOR DELETE USING (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- 3. Garantir tabela documentos_prestadores com campos corretos
ALTER TABLE IF EXISTS public.documentos_prestadores ALTER COLUMN tipo SET NOT NULL;

-- 4. Verificar se existe linha de teste
SELECT id, prestador_id, tipo, arquivo, created_at 
FROM public.documentos_prestadores 
ORDER BY created_at DESC 
LIMIT 10;

-- Resultado: Campos devem ser id, prestador_id, tipo, arquivo, created_at