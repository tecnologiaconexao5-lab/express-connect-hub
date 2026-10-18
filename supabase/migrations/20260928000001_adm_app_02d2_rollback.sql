-- ==============================================================================
-- ADM-APP-02D.2 — ROLLBACK IRMÃO
-- Restaura EXATAMENTE o estado anterior:
--   * bucket documentos_prestadores: public = true
--   * as 6 policies originais com os MESMOS roles / qual / with_check
--   * remove as 4 policies novas docprestadores_*_privado
--
-- Definições originais (capturadas em
-- scripts/_adm_app_02d2_snapshot_antes.json, hash
-- 97f18480895b2aca345798a70e83d336585649fedcc98171d3ea25ef629bebb1):
--
--   "Permitir leitura"             SELECT   TO public        USING      (bucket_id = 'documentos_prestadores'::text)
--   "Permitir upload"              INSERT   TO public        (sem USING) WITH CHECK (bucket_id = 'documentos_prestadores'::text)
--   "Permitir update"              UPDATE   TO public        USING      (bucket_id = 'documentos_prestadores'::text)
--   "Permitir delete"              DELETE   TO public        USING      (bucket_id = 'documentos_prestadores'::text)
--   "docprestadores_select_public" SELECT   TO public        USING      (bucket_id = 'documentos_prestadores'::text)
--   "docprestadores_insert_auth"   INSERT   TO authenticated (sem USING) WITH CHECK (bucket_id = 'documentos_prestadores'::text)
--
-- VALIDAÇÃO OBRIGATÓRIA: executar este arquivo dentro de uma transação e
-- ROLLBACK (scripts/_adm_app_02d2_rollback_check.mjs) — produção NÃO fica
-- revertida.
-- ==============================================================================

BEGIN;

-- 1) remover as policies novas da 02D.2
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname IN ('docprestadores_select_privado',
                          'docprestadores_insert_privado',
                          'docprestadores_update_privado',
                          'docprestadores_delete_privado')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 2) recriar as 6 policies originais (idempotente)
CREATE POLICY "Permitir leitura" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'documentos_prestadores'::text);

CREATE POLICY "Permitir upload" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'documentos_prestadores'::text);

CREATE POLICY "Permitir update" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'documentos_prestadores'::text);

CREATE POLICY "Permitir delete" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'documentos_prestadores'::text);

CREATE POLICY "docprestadores_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'documentos_prestadores'::text);

CREATE POLICY "docprestadores_insert_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos_prestadores'::text);

-- 3) bucket público novamente
UPDATE storage.buckets
   SET public = true
 WHERE id = 'documentos_prestadores';

-- 4) guarda: as 6 policies devem existir e nenhuma policy nova pode restar
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('Permitir leitura','Permitir upload','Permitir update',
                        'Permitir delete','docprestadores_select_public',
                        'docprestadores_insert_auth');
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'ROLLBACK 02D.2: esperava 6 policies originais, encontrou %', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname LIKE 'docprestadores_%_privado';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK 02D.2: % policies novas restaram', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM storage.buckets
   WHERE id = 'documentos_prestadores' AND public = true;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK 02D.2: bucket não voltou a public=true';
  END IF;
END $$;

COMMIT;
