-- ============================================================
-- MIGRATION: 20260620_f25fa3_storage_policies_biblioteca_global
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Policies de storage para o bucket biblioteca-global
-- Permite upload/delete/select de arquivos de treinamento IA
-- ============================================================

-- ==================== POLICIES STORAGE.OBJECTS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'biblioteca_global_insert' AND tablename = 'objects') THEN
    CREATE POLICY biblioteca_global_insert ON storage.objects
      FOR INSERT TO public
      WITH CHECK (bucket_id = 'biblioteca-global');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'biblioteca_global_select' AND tablename = 'objects') THEN
    CREATE POLICY biblioteca_global_select ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'biblioteca-global');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'biblioteca_global_delete' AND tablename = 'objects') THEN
    CREATE POLICY biblioteca_global_delete ON storage.objects
      FOR DELETE TO public
      USING (bucket_id = 'biblioteca-global');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'biblioteca_global_update' AND tablename = 'objects') THEN
    CREATE POLICY biblioteca_global_update ON storage.objects
      FOR UPDATE TO public
      USING (bucket_id = 'biblioteca-global')
      WITH CHECK (bucket_id = 'biblioteca-global');
  END IF;
END
$$;
