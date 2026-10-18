-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 44B — CRIAÇÃO DOS BUCKETS DE STORAGE AUSENTES
-- Resolve P2: buckets referenciados pelo código não existiam.
-- Usa ON CONFLICT DO NOTHING para ser idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. BUCKET: prestadores (fotos de perfil, documentos do prestador)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'prestadores',
    'prestadores',
    true,
    10485760,  -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. BUCKET: documentos_prestadores (CNH, CRLV, contratos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documentos_prestadores',
    'documentos_prestadores',
    true,
    10485760,  -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. BUCKET: veiculos (fotos de veículos, documentos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'veiculos',
    'veiculos',
    true,
    10485760,  -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 4. BUCKET: documentos (documentos gerais, já em migration 202605200003_documentos_bucket.sql)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documentos',
    'documentos',
    true,
    10485760,  -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 5. BUCKET: contratos (PDFs de contratos, já em migration contratos_enterprise.sql)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'contratos',
    'contratos',
    true,
    10485760,  -- 10 MB
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 6. BUCKET: biblioteca-global (treinamento IA, conhecimento corporativo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'biblioteca-global',
    'biblioteca-global',
    true,
    104857600,  -- 100 MB
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'text/csv', 'text/html',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'application/zip', 'application/x-rar-compressed',
        'application/json', 'application/xml'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- 7. BUCKET: comprovantes-entrega (PODs, usado por podService.ts — não tinha migration)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'comprovantes-entrega',
    'comprovantes-entrega',
    true,
    10485760,  -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 8. POLÍTICAS DE STORAGE (RLS para upload/download público)
-- Permite SELECT (download) público em todos os buckets públicos

-- prestadores
DROP POLICY IF EXISTS "prestadores_select_public" ON storage.objects;
CREATE POLICY "prestadores_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'prestadores');

DROP POLICY IF EXISTS "prestadores_insert_auth" ON storage.objects;
CREATE POLICY "prestadores_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'prestadores');

-- documentos_prestadores
DROP POLICY IF EXISTS "docprestadores_select_public" ON storage.objects;
CREATE POLICY "docprestadores_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'documentos_prestadores');

DROP POLICY IF EXISTS "docprestadores_insert_auth" ON storage.objects;
CREATE POLICY "docprestadores_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documentos_prestadores');

-- veiculos
DROP POLICY IF EXISTS "veiculos_select_public" ON storage.objects;
CREATE POLICY "veiculos_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'veiculos');

DROP POLICY IF EXISTS "veiculos_insert_auth" ON storage.objects;
CREATE POLICY "veiculos_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'veiculos');

-- documentos
DROP POLICY IF EXISTS "documentos_select_public" ON storage.objects;
CREATE POLICY "documentos_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_insert_auth" ON storage.objects;
CREATE POLICY "documentos_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documentos');

-- contratos
DROP POLICY IF EXISTS "contratos_select_public" ON storage.objects;
CREATE POLICY "contratos_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS "contratos_insert_auth" ON storage.objects;
CREATE POLICY "contratos_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'contratos');

-- biblioteca-global
DROP POLICY IF EXISTS "biblioteca_select_public" ON storage.objects;
CREATE POLICY "biblioteca_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'biblioteca-global');

DROP POLICY IF EXISTS "biblioteca_insert_auth" ON storage.objects;
CREATE POLICY "biblioteca_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'biblioteca-global');

-- comprovantes-entrega
DROP POLICY IF EXISTS "comprovantes_select_public" ON storage.objects;
CREATE POLICY "comprovantes_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'comprovantes-entrega');

DROP POLICY IF EXISTS "comprovantes_insert_auth" ON storage.objects;
CREATE POLICY "comprovantes_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'comprovantes-entrega');

-- 9. COMENTÁRIOS (ignorar erro de permissão no Supabase)
DO $$
BEGIN
    COMMENT ON TABLE storage.buckets IS 'Buckets de storage — Missão 44B garante existência dos 7 buckets operacionais.';
EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;
