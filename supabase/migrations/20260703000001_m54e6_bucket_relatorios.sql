-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 54 — ETAPA 6.4: Bucket relatorios para Storage de PDFs/Excel
-- Cria bucket público para relatórios operacionais, financeiros e comerciais.
-- Usa ON CONFLICT DO NOTHING para ser idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'relatorios',
    'relatorios',
    true,
    52428800,  -- 50 MB (comporta relatórios com muitas páginas)
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/json',
        'application/zip'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso
DROP POLICY IF EXISTS "relatorios_select_public" ON storage.objects;
CREATE POLICY "relatorios_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'relatorios');

DROP POLICY IF EXISTS "relatorios_insert_auth" ON storage.objects;
CREATE POLICY "relatorios_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'relatorios');

DROP POLICY IF EXISTS "relatorios_update_auth" ON storage.objects;
CREATE POLICY "relatorios_update_auth" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'relatorios')
    WITH CHECK (bucket_id = 'relatorios');

DROP POLICY IF EXISTS "relatorios_delete_auth" ON storage.objects;
CREATE POLICY "relatorios_delete_auth" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'relatorios');
