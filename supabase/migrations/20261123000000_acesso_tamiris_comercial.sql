-- ===================================================================
-- Acesso exclusivo Tamiris Castilho — CRM/Prospecções com escopo próprio.
--
-- - Adiciona o vínculo de responsável/criador em crm_leads (não existia FK).
-- - Restringe, via RLS RESTRICTIVE, que o usuário Tamiris veja/edite/apague
--   apenas leads atribuídos a ela (responsavel_id ou created_by = auth.uid()).
-- - Administradores (super_admin/admin_tenant/admin) continuam vendo tudo.
-- - Demais usuários permanecem com o comportamento anterior.
-- ===================================================================
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS responsavel_id uuid;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel_id ON public.crm_leads (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_by ON public.crm_leads (created_by);

DROP POLICY IF EXISTS crm_leads_escopo_tamiris ON public.crm_leads;
CREATE POLICY crm_leads_escopo_tamiris ON public.crm_leads
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR responsavel_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR responsavel_id = auth.uid()
    OR created_by = auth.uid()
  );

-- Histórico/follow-ups/conversas/mensagens vinculados a leads também ficam
-- restritos aos leads da própria Tamiris.
DROP POLICY IF EXISTS crm_historico_escopo_tamiris ON public.crm_historico;
CREATE POLICY crm_historico_escopo_tamiris ON public.crm_historico
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_historico.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_historico.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS crm_followups_escopo_tamiris ON public.crm_followups;
CREATE POLICY crm_followups_escopo_tamiris ON public.crm_followups
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_followups.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_followups.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS crm_conversas_escopo_tamiris ON public.crm_conversas;
CREATE POLICY crm_conversas_escopo_tamiris ON public.crm_conversas
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_conversas.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_conversas.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS crm_mensagens_escopo_tamiris ON public.crm_mensagens;
CREATE POLICY crm_mensagens_escopo_tamiris ON public.crm_mensagens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_mensagens.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS DISTINCT FROM '8c12fc67-4dac-4f1e-b4fd-23cf0d168284'::uuid
    OR EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND lower(coalesce(tu.papel, '')) IN ('super_admin', 'admin_tenant', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id = crm_mensagens.lead_id
        AND (l.responsavel_id = auth.uid() OR l.created_by = auth.uid())
    )
  );
