-- ============================================================
-- CORREÇÃO: Biblioteca / Documentos - SQL de setup
-- ============================================================

-- 1. Criar bucket storage (via SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos_prestadores', 'documentos_prestadores', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 2. Policy para leitura pública
DROP POLICY IF EXISTS "Public select on documentos_prestadores" ON storage.objects;
CREATE POLICY "Public select on documentos_prestadores" ON storage.objects
FOR SELECT USING (bucket_id = 'documentos_prestadores');

-- 3. Policy para upload autenticado
DROP POLICY IF EXISTS "Authenticated insert on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated insert on documentos_prestadores" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- 4. Policy para update autenticado
DROP POLICY IF EXISTS "Authenticated update on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated update on documentos_prestadores" ON storage.objects
FOR UPDATE USING (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- 5. Policy para delete autenticado
DROP POLICY IF EXISTS "Authenticated delete on documentos_prestadores" ON storage.objects;
CREATE POLICY "Authenticated delete on documentos_prestadores" ON storage.objects
FOR DELETE USING (bucket_id = 'documentos_prestadores' AND auth.role() = 'authenticated');

-- 6. Allow all para desenvolvimento (remover em produção)
DROP POLICY IF EXISTS "Allow all on documentos_prestadores" ON storage.objects;
CREATE POLICY "Allow all on documentos_prestadores" ON storage.objects
FOR ALL USING (true) WITH CHECK (true);

-- 7. Habilitar RLS na tabela documentos_prestadores
ALTER TABLE public.documentos_prestadores ENABLE ROW LEVEL SECURITY;

-- 8. Policy para documentos_prestadores
DROP POLICY IF EXISTS "Allow all on documentos_prestadores_tb" ON public.documentos_prestadores;
CREATE POLICY "Allow all on documentos_prestadores_tb" ON public.documentos_prestadores
FOR ALL USING (true) WITH CHECK (true);