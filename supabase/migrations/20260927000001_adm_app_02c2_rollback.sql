-- ADM-APP-02C.2 - ROLLBACK da migration 20260927000000_adm_app_02c2_seguranca_reconciliada
-- Restaura EXATAMENTE o snapshot pre-mudanca capturado em
-- scripts/_adm_app_02c2_snapshot.out.json (policies_hash + policies + relacl).
BEGIN;

-- [1] remove triggers e funcoes da 02C.2
DROP TRIGGER IF EXISTS trg_guardar_privilegio_prestador ON public.prestadores;
DROP TRIGGER IF EXISTS trg_audit_liberado_app ON public.prestadores;
DROP FUNCTION IF EXISTS public.fn_guardar_privilegio_prestador();
DROP FUNCTION IF EXISTS public.fn_audit_liberado_app();

-- [2] remove a tabela de auditoria
DROP TABLE IF EXISTS public.liberado_app_audit CASCADE;

-- [3] restaura prestadores_select_own original (com o buraco auth_user_id IS NULL)
DROP POLICY IF EXISTS prestadores_select_own ON public.prestadores;
CREATE POLICY prestadores_select_own
  ON public.prestadores FOR SELECT
  TO authenticated
  USING (((auth_user_id IS NULL)
       OR ((auth_user_id)::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       OR (auth_user_id = auth.uid())));

-- [4] restaura policies originais de recrutamento_candidatos / _prestadores / _operacoes
--     e candidato_documentos (padrao auth.role(), roles = public / authenticated)
DO $$
DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recrutamento_candidatos','recrutamento_prestadores',
                           'recrutamento_operacoes','candidato_documentos'] LOOP
    FOR p IN SELECT policyname FROM pg_policies
              WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
  END LOOP;
END;
$$;

-- recrutamento_candidatos (roles=public)
CREATE POLICY recrutamento_candidatos_select ON public.recrutamento_candidatos FOR SELECT
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY recrutamento_candidatos_insert ON public.recrutamento_candidatos FOR INSERT
  WITH CHECK (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY recrutamento_candidatos_update ON public.recrutamento_candidatos FOR UPDATE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY recrutamento_candidatos_delete ON public.recrutamento_candidatos FOR DELETE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));

-- recrutamento_prestadores (roles=public)
CREATE POLICY recrutamento_prestadores_select ON public.recrutamento_prestadores FOR SELECT
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY recrutamento_prestadores_insert ON public.recrutamento_prestadores FOR INSERT
  WITH CHECK (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY recrutamento_prestadores_update ON public.recrutamento_prestadores FOR UPDATE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY recrutamento_prestadores_delete ON public.recrutamento_prestadores FOR DELETE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));

-- recrutamento_operacoes (roles=authenticated)
CREATE POLICY recrutamento_operacoes_select ON public.recrutamento_operacoes FOR SELECT
  TO authenticated USING ((auth.role() = 'authenticated'));
CREATE POLICY recrutamento_operacoes_insert ON public.recrutamento_operacoes FOR INSERT
  TO authenticated WITH CHECK ((auth.role() = 'authenticated'));
CREATE POLICY recrutamento_operacoes_update ON public.recrutamento_operacoes FOR UPDATE
  TO authenticated USING ((auth.role() = 'authenticated')) WITH CHECK ((auth.role() = 'authenticated'));
CREATE POLICY recrutamento_operacoes_delete ON public.recrutamento_operacoes FOR DELETE
  TO authenticated USING ((auth.role() = 'authenticated'));

-- candidato_documentos (roles=public)
CREATE POLICY candidato_documentos_select ON public.candidato_documentos FOR SELECT
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY candidato_documentos_insert ON public.candidato_documentos FOR INSERT
  WITH CHECK (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY candidato_documentos_update ON public.candidato_documentos FOR UPDATE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
CREATE POLICY candidato_documentos_delete ON public.candidato_documentos FOR DELETE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));

-- [5] restaura tabela legada candidatos (grants originais incluiam anon)
GRANT ALL ON TABLE public.candidatos TO anon, authenticated, service_role;

DROP POLICY IF EXISTS candidatos_tms_select ON public.candidatos;
DROP POLICY IF EXISTS candidatos_tms_insert ON public.candidatos;
DROP POLICY IF EXISTS candidatos_tms_update ON public.candidatos;
DROP POLICY IF EXISTS candidatos_tms_delete ON public.candidatos;

CREATE POLICY candidatos_select ON public.candidatos FOR SELECT
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'anon')
       OR (auth.role() = 'service_role')));
CREATE POLICY candidatos_insert ON public.candidatos FOR INSERT
  WITH CHECK (((auth.role() = 'authenticated') OR (auth.role() = 'anon')
       OR (auth.role() = 'service_role')));
CREATE POLICY candidatos_update ON public.candidatos FOR UPDATE
  USING (((auth.role() = 'authenticated') OR (auth.role() = 'service_role')));
