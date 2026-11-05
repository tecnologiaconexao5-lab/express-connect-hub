-- =============================================================================
-- GD-02 - BLINDAGEM DE RLS DA GESTAO DE DOCUMENTOS
-- Tabela: public.documentos_metadata
--
-- Objetivo: substituir as policies permissivas USING (true) por regras
-- granulares por papel e departamento, sem alterar schema, dados, storage,
-- trigger de espelhamento ou servicos existentes.
--
-- Premissas (documentadas para auditoria):
--  * "documento publico da empresa" = documento com departamento IS NULL.
--  * super_admin, admin e admin_tenant veem/gerenciam tudo no proprio tenant.
--  * tenant_usuarios nao possui coluna de departamento; o departamento e
--    derivado do papel (mapeamento abaixo).
--  * O trigger trg_documentos_prestadores_metadata roda em funcao
--    SECURITY DEFINER e continua funcional (owner do schema public).
--
-- Aplicacao: transacional. Rollback = DROP das policies/funcoes criadas e
-- recriacao das policies anteriores (ver bloco de rollback no fim).
-- =============================================================================

-- 1) FUNCOES AUXILIARES (SECURITY DEFINER para ler tenant_usuarios com seguranca)
CREATE OR REPLACE FUNCTION public.f_documentos_usuario_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid()
       AND tu.status = 'ativo'
       AND tu.papel IN ('super_admin', 'admin', 'admin_tenant')
  );
$$;

CREATE OR REPLACE FUNCTION public.f_documentos_pode_departamento(p_departamento text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid()
       AND tu.status = 'ativo'
       AND tu.papel IN (
         'super_admin', 'admin', 'admin_tenant', 'gestor',
         'operacional', 'financeiro', 'comercial', 'atendimento'
       )
       AND (
         tu.papel IN ('super_admin', 'admin', 'admin_tenant')
         OR p_departamento IS NULL
         OR (tu.papel = 'financeiro'  AND lower(btrim(p_departamento)) = 'financeiro')
         OR (tu.papel = 'comercial'   AND lower(btrim(p_departamento)) IN ('comercial', 'administrativo'))
         OR (tu.papel = 'operacional' AND lower(btrim(p_departamento)) IN ('operacional', 'operacoes', 'operações', 'recrutamento', 'administrativo', 'comercial'))
         OR (tu.papel = 'gestor'      AND lower(btrim(p_departamento)) IN ('operacional', 'operacoes', 'operações', 'recrutamento', 'administrativo'))
         OR (tu.papel = 'atendimento' AND lower(btrim(p_departamento)) IN ('atendimento', 'comercial', 'operacional', 'operacoes', 'operações'))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.f_documentos_usuario_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_documentos_pode_departamento(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_documentos_usuario_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_documentos_pode_departamento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_documentos_usuario_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.f_documentos_pode_departamento(text) TO service_role;

-- 2) REMOCAO DAS POLICIES PERMISSIVAS
DROP POLICY IF EXISTS "documentos_metadata_select" ON public.documentos_metadata;
DROP POLICY IF EXISTS "documentos_metadata_insert" ON public.documentos_metadata;
DROP POLICY IF EXISTS "documentos_metadata_update" ON public.documentos_metadata;
DROP POLICY IF EXISTS "documentos_metadata_delete" ON public.documentos_metadata;

-- 3) LEITURA: tenant ativo + (admin OU responsavel OU departamento/publico)
CREATE POLICY "documentos_metadata_select" ON public.documentos_metadata
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tenant_usuarios tu
       WHERE tu.user_id = auth.uid()
         AND tu.status = 'ativo'
         AND tu.tenant_id = COALESCE(
           documentos_metadata.tenant_id,
           public.current_tenant_id_safe()
         )
    )
    AND (
      public.f_documentos_usuario_admin()
      OR documentos_metadata.responsavel_id = auth.uid()
      OR public.f_documentos_pode_departamento(documentos_metadata.departamento)
    )
  );

-- 4) INSERCAO: tenant ativo + (admin OU departamento permitido)
CREATE POLICY "documentos_metadata_insert" ON public.documentos_metadata
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.tenant_usuarios tu
       WHERE tu.user_id = auth.uid()
         AND tu.status = 'ativo'
         AND tu.tenant_id = COALESCE(
           documentos_metadata.tenant_id,
           public.current_tenant_id_safe()
         )
    )
    AND (
      public.f_documentos_usuario_admin()
      OR public.f_documentos_pode_departamento(documentos_metadata.departamento)
    )
  );

-- 5) ATUALIZACAO: mesma regra de leitura + mesmo CHECK de insercao
CREATE POLICY "documentos_metadata_update" ON public.documentos_metadata
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tenant_usuarios tu
       WHERE tu.user_id = auth.uid()
         AND tu.status = 'ativo'
         AND tu.tenant_id = COALESCE(
           documentos_metadata.tenant_id,
           public.current_tenant_id_safe()
         )
    )
    AND (
      public.f_documentos_usuario_admin()
      OR documentos_metadata.responsavel_id = auth.uid()
      OR public.f_documentos_pode_departamento(documentos_metadata.departamento)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.tenant_usuarios tu
       WHERE tu.user_id = auth.uid()
         AND tu.status = 'ativo'
         AND tu.tenant_id = COALESCE(
           documentos_metadata.tenant_id,
           public.current_tenant_id_safe()
         )
    )
    AND (
      public.f_documentos_usuario_admin()
      OR public.f_documentos_pode_departamento(documentos_metadata.departamento)
    )
  );

-- 6) EXCLUSAO: SOMENTE super_admin / admin / admin_tenant
CREATE POLICY "documentos_metadata_delete" ON public.documentos_metadata
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tenant_usuarios tu
       WHERE tu.user_id = auth.uid()
         AND tu.status = 'ativo'
         AND tu.tenant_id = COALESCE(
           documentos_metadata.tenant_id,
           public.current_tenant_id_safe()
         )
    )
    AND public.f_documentos_usuario_admin()
  );

-- 7) COMENTARIOS DE AUDITORIA
COMMENT ON FUNCTION public.f_documentos_usuario_admin() IS
  'GD-02: true para super_admin/admin/admin_tenant ativos.';
COMMENT ON FUNCTION public.f_documentos_pode_departamento(text) IS
  'GD-02: autoriza por departamento derivado do papel; departamento NULL = documento publico da empresa para usuarios internos.';
COMMENT ON POLICY "documentos_metadata_select" ON public.documentos_metadata IS
  'GD-02: leitura por tenant + admin/responsavel/departamento/publico.';
COMMENT ON POLICY "documentos_metadata_insert" ON public.documentos_metadata IS
  'GD-02: insercao por admin ou departamento permitido.';
COMMENT ON POLICY "documentos_metadata_update" ON public.documentos_metadata IS
  'GD-02: atualizacao por admin/responsavel/departamento permitido.';
COMMENT ON POLICY "documentos_metadata_delete" ON public.documentos_metadata IS
  'GD-02: exclusao exclusiva de super_admin/admin/admin_tenant.';

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK MANUAL (executar somente se necessario)
-- -----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "documentos_metadata_select" ON public.documentos_metadata;
-- DROP POLICY IF EXISTS "documentos_metadata_insert" ON public.documentos_metadata;
-- DROP POLICY IF EXISTS "documentos_metadata_update" ON public.documentos_metadata;
-- DROP POLICY IF EXISTS "documentos_metadata_delete" ON public.documentos_metadata;
--
-- CREATE POLICY "documentos_metadata_select" ON public.documentos_metadata
--   FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "documentos_metadata_insert" ON public.documentos_metadata
--   FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "documentos_metadata_update" ON public.documentos_metadata
--   FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "documentos_metadata_delete" ON public.documentos_metadata
--   FOR DELETE TO authenticated USING (true);
--
-- DROP FUNCTION IF EXISTS public.f_documentos_pode_departamento(text);
-- DROP FUNCTION IF EXISTS public.f_documentos_usuario_admin();
-- =============================================================================
