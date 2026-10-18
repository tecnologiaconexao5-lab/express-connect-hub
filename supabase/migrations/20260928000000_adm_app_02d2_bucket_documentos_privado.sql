-- ==============================================================================
-- ADM-APP-02D.2 — PRIVATIZAR BUCKET documentos_prestadores + STORAGE POLICIES
-- Migration NOVA incremental (NÃO edita migration histórica)
-- Data: 2026-09-28
--
-- PRÉ-CONDICAO: ADM-APP-02D.1 = PASS / READY_FOR_PRIVATE_BUCKET = YES
--
-- SNAPSHOT ANTES (scripts/_adm_app_02d2_snapshot_antes.json):
--   bucket documentos_prestadores: public = true, 78 objetos
--   tabela documentos_prestadores : 32 linhas, RLS ON, 8 policies dp_*
--   hash policies storage (6 do bucket) = 97f18480895b2aca345798a70e83d336585649fedcc98171d3ea25ef629bebb1
--   hash policies tabela (8 dp_*)      = 477d12130df5c169947f2f09f921c1f828b368b1631a388e10f12ee89613db96
--
-- 6 policies EXATAS removidas (definições preservadas para rollback):
--   1) "Permitir leitura"                | SELECT   | TO public       | USING      (bucket_id = 'documentos_prestadores'::text)
--   2) "Permitir upload"                 | INSERT   | TO public       | WITH CHECK (bucket_id = 'documentos_prestadores'::text)
--   3) "Permitir update"                 | UPDATE   | TO public       | USING      (bucket_id = 'documentos_prestadores'::text)
--   4) "Permitir delete"                 | DELETE   | TO public       | USING      (bucket_id = 'documentos_prestadores'::text)
--   5) "docprestadores_select_public"    | SELECT   | TO public       | USING      (bucket_id = 'documentos_prestadores'::text)
--   6) "docprestadores_insert_auth"      | INSERT   | TO authenticated| WITH CHECK (bucket_id = 'documentos_prestadores'::text)
--
-- NÃO ALTERA: policies da tabela documentos_prestadores (8 dp_*), grants,
--             outros buckets, schema, dados da tabela (nenhum UPDATE em massa
--             das 31 URLs legadas).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1) PRIVATIZAR O BUCKET (exatamente 1 linha; aborta se não achar)
-- ------------------------------------------------------------------------------
DO $$
DECLARE v_n int;
BEGIN
  UPDATE storage.buckets
     SET public = false
   WHERE id = 'documentos_prestadores';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ADM-APP-02D.2: esperava alterar exatamente 1 bucket, alterou %', v_n;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2) REMOVER SOMENTE as 6 policies antigas do bucket (com guarda anti-remocao
--    de policy de outro bucket: só derruba se a definição referenciar o bucket)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  p record;
  v_removidas int := 0;
  v_texto text;
BEGIN
  FOR p IN
    SELECT policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND policyname IN (
         'Permitir leitura',
         'Permitir upload',
         'Permitir update',
         'Permitir delete',
         'docprestadores_select_public',
         'docprestadores_insert_auth'
       )
  LOOP
    v_texto := coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '');
    IF v_texto NOT LIKE '%documentos_prestadores%' THEN
      RAISE EXCEPTION 'ADM-APP-02D.2: policy "%" não pertence ao bucket documentos_prestadores — abortando', p.policyname;
    END IF;
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
    v_removidas := v_removidas + 1;
  END LOOP;
  IF v_removidas <> 6 THEN
    RAISE EXCEPTION 'ADM-APP-02D.2: esperava remover 6 policies do bucket, removeu %', v_removidas;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3) POLICIES NOVAS — propriedade por prestador + admin TMS; anon = ZERO acesso
--
--    REGRA PRESTADOR: objeto cujo path segue a convenção da 02D.1
--      doc_{prestadorId}_... | foto_{prestadorId}_...
--    E o prestador EXISTE em `prestadores` com auth_user_id = auth.uid().
--    (o join em prestadores valida a POSSE do id embutido no path — não se
--     confia apenas no texto do caminho)
--
--    REGRA TMS: EXISTS em tenant_usuarios WHERE user_id = auth.uid()
--
--    service_role / postgres: rolbypassrls = true → comportamento de backend
--    preservado sem necessidade de policy.
--    anon: NENHUMA policy → acesso zero.
-- ------------------------------------------------------------------------------
CREATE POLICY "docprestadores_select_privado" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos_prestadores'::text
    AND (
      EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = auth.uid())
      OR EXISTS (
            SELECT 1 FROM prestadores pr
             WHERE pr.auth_user_id = auth.uid()
               AND (name ~ ('^doc_'  || pr.id::text || '_')
                 OR name ~ ('^foto_' || pr.id::text || '_'))
          )
    )
  );

CREATE POLICY "docprestadores_insert_privado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos_prestadores'::text
    AND (
      EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = auth.uid())
      OR EXISTS (
            SELECT 1 FROM prestadores pr
             WHERE pr.auth_user_id = auth.uid()
               AND (name ~ ('^doc_'  || pr.id::text || '_')
                 OR name ~ ('^foto_' || pr.id::text || '_'))
          )
    )
  );

CREATE POLICY "docprestadores_update_privado" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos_prestadores'::text
    AND (
      EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = auth.uid())
      OR EXISTS (
            SELECT 1 FROM prestadores pr
             WHERE pr.auth_user_id = auth.uid()
               AND (name ~ ('^doc_'  || pr.id::text || '_')
                 OR name ~ ('^foto_' || pr.id::text || '_'))
          )
    )
  )
  WITH CHECK (
    bucket_id = 'documentos_prestadores'::text
    AND (
      EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = auth.uid())
      OR EXISTS (
            SELECT 1 FROM prestadores pr
             WHERE pr.auth_user_id = auth.uid()
               AND (name ~ ('^doc_'  || pr.id::text || '_')
                 OR name ~ ('^foto_' || pr.id::text || '_'))
          )
    )
  );

CREATE POLICY "docprestadores_delete_privado" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos_prestadores'::text
    AND (
      EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = auth.uid())
      OR EXISTS (
            SELECT 1 FROM prestadores pr
             WHERE pr.auth_user_id = auth.uid()
               AND (name ~ ('^doc_'  || pr.id::text || '_')
                 OR name ~ ('^foto_' || pr.id::text || '_'))
          )
    )
  );

-- ------------------------------------------------------------------------------
-- 4) PROVAS DE NÃO-TOQUE
--    * tabela documentos_prestadores: 8 policies dp_* intactas
--    * nenhum outro bucket alterado
-- ------------------------------------------------------------------------------
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'documentos_prestadores';
  IF v_n <> 8 THEN
    RAISE EXCEPTION 'ADM-APP-02D.2: policies dp_* alteradas (esperado 8, encontrado %)', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM storage.buckets WHERE public = true;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'ADM-APP-02D.2: nenhum bucket público restante — escopo ampliado';
  END IF;
END $$;

COMMIT;
