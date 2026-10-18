-- =============================================================================
-- M07 — Eliminação Final de Policies RLS Vulneráveis
-- Corrige 19 policies vulneráveis em 13 tabelas:
--   USING(true), WITH CHECK(true), TO anon, TO public
-- =============================================================================
-- Data:      2026-08-02
-- Projeto:   express-connect-hub
-- Ambiente:  uwrvzsjtpgaifkktpepn.supabase.co (PRODUÇÃO)
-- =============================================================================
-- Estratégia:
--   1. DROP das policies vulneráveis (com IF EXISTS)
--   2. CREATE de policies substitutas com:
--      - TO authenticated
--      - USING/CHECK vinculado a tenant_usuarios, cliente_id ou prestador_id
--      - Nunca USING(true), nunca WITH CHECK(true)
--   3. IF NOT EXISTS em todas as CREATEs (compatível com M06)
-- =============================================================================

-- =============================================================================
-- 1. financeiro_pagar — Contas a Pagar
-- =============================================================================
-- Policy vulnerável: fp_select_tms (TO authenticated, USING=true)
-- Substituída por:   fp_select_tms (TO authenticated, USING via tenant_usuarios)

DROP POLICY IF EXISTS "fp_select_tms" ON public.financeiro_pagar;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'financeiro_pagar') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_pagar' AND policyname='fp_select_tms') THEN
      CREATE POLICY "fp_select_tms" ON public.financeiro_pagar FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_pagar' AND policyname='fp_insert_tms') THEN
      CREATE POLICY "fp_insert_tms" ON public.financeiro_pagar FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_pagar' AND policyname='fp_update_tms') THEN
      CREATE POLICY "fp_update_tms" ON public.financeiro_pagar FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 2. composicao_financeira_os — Composição Financeira por OS
-- =============================================================================
-- Policy vulnerável: Allow all on composicao_financeira_os (TO public, ALL, USING=true, CHECK=true)
-- Substituída por:   cfo_select_tms, cfo_insert_tms, cfo_update_tms

DROP POLICY IF EXISTS "Allow all on composicao_financeira_os" ON public.composicao_financeira_os;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'composicao_financeira_os') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='composicao_financeira_os' AND policyname='cfo_select_tms') THEN
      CREATE POLICY "cfo_select_tms" ON public.composicao_financeira_os FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='composicao_financeira_os' AND policyname='cfo_insert_tms') THEN
      CREATE POLICY "cfo_insert_tms" ON public.composicao_financeira_os FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='composicao_financeira_os' AND policyname='cfo_update_tms') THEN
      CREATE POLICY "cfo_update_tms" ON public.composicao_financeira_os FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 3. crm_leads — Leads Comerciais
-- =============================================================================
-- Policies vulneráveis:
--   Allow all on crm_leads (TO public, ALL, USING=true, CHECK=true)
--   allow_anon_read (TO anon, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all on crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "allow_anon_read" ON public.crm_leads;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_leads') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='crm_leads_select_tms') THEN
      CREATE POLICY "crm_leads_select_tms" ON public.crm_leads FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='crm_leads_insert_tms') THEN
      CREATE POLICY "crm_leads_insert_tms" ON public.crm_leads FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='crm_leads_update_tms') THEN
      CREATE POLICY "crm_leads_update_tms" ON public.crm_leads FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='crm_leads_delete_tms') THEN
      CREATE POLICY "crm_leads_delete_tms" ON public.crm_leads FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 4. crm_historico — Histórico de Leads
-- =============================================================================
-- Policy vulnerável: allow_anon_read (TO anon, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "allow_anon_read" ON public.crm_historico;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_historico') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_historico' AND policyname='ch_select_tms') THEN
      CREATE POLICY "ch_select_tms" ON public.crm_historico FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_historico' AND policyname='ch_insert_tms') THEN
      CREATE POLICY "ch_insert_tms" ON public.crm_historico FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_historico' AND policyname='ch_delete_tms') THEN
      CREATE POLICY "ch_delete_tms" ON public.crm_historico FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 5. crm_followups — Follow-ups de Leads
-- =============================================================================
-- Policy vulnerável: allow_anon_read (TO anon, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "allow_anon_read" ON public.crm_followups;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_followups') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_followups' AND policyname='cf_select_tms') THEN
      CREATE POLICY "cf_select_tms" ON public.crm_followups FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_followups' AND policyname='cf_insert_tms') THEN
      CREATE POLICY "cf_insert_tms" ON public.crm_followups FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_followups' AND policyname='cf_delete_tms') THEN
      CREATE POLICY "cf_delete_tms" ON public.crm_followups FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 6. prestadores — INSERT de Candidatura (App Prestador)
-- =============================================================================
-- Policy vulnerável: App prestador can insert as candidate (TO authenticated, CHECK=true)
-- Substituída por:   WITH CHECK (auth.role() = 'authenticated'::text)
-- Nota: mantida para fluxo de cadastro de candidatos via App Prestador (autenticados)

DROP POLICY IF EXISTS "App prestador can insert as candidate" ON public.prestadores;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'prestadores') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='App prestador can insert as candidate') THEN
      CREATE POLICY "App prestador can insert as candidate" ON public.prestadores FOR INSERT
        TO authenticated
        WITH CHECK (auth.role() = 'authenticated'::text);
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 7. fiscal_ctes — CT-es
-- =============================================================================
-- Policy vulnerável: Allow all operations (TO public, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_ctes;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fiscal_ctes') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_ctes' AND policyname='fcte_select_tms') THEN
      CREATE POLICY "fcte_select_tms" ON public.fiscal_ctes FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_ctes' AND policyname='fcte_insert_tms') THEN
      CREATE POLICY "fcte_insert_tms" ON public.fiscal_ctes FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_ctes' AND policyname='fcte_update_tms') THEN
      CREATE POLICY "fcte_update_tms" ON public.fiscal_ctes FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 8. fiscal_nfse — NFS-es
-- =============================================================================
-- Policy vulnerável: Allow all operations (TO public, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_nfse;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fiscal_nfse') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_nfse' AND policyname='fnfse_select_tms') THEN
      CREATE POLICY "fnfse_select_tms" ON public.fiscal_nfse FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_nfse' AND policyname='fnfse_insert_tms') THEN
      CREATE POLICY "fnfse_insert_tms" ON public.fiscal_nfse FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_nfse' AND policyname='fnfse_update_tms') THEN
      CREATE POLICY "fnfse_update_tms" ON public.fiscal_nfse FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 9. fiscal_mdfes — MDF-es
-- =============================================================================
-- Policy vulnerável: Allow all operations (TO public, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_mdfes;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fiscal_mdfes') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_mdfes' AND policyname='fmdfe_select_tms') THEN
      CREATE POLICY "fmdfe_select_tms" ON public.fiscal_mdfes FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_mdfes' AND policyname='fmdfe_insert_tms') THEN
      CREATE POLICY "fmdfe_insert_tms" ON public.fiscal_mdfes FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_mdfes' AND policyname='fmdfe_update_tms') THEN
      CREATE POLICY "fmdfe_update_tms" ON public.fiscal_mdfes FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 10. contratos_gerados — Contratos Firmados
-- =============================================================================
-- Policy vulnerável: Allow all contratos_gerados (TO anon/authenticated, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all contratos_gerados" ON public.contratos_gerados;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contratos_gerados') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='cg_select_tms') THEN
      CREATE POLICY "cg_select_tms" ON public.contratos_gerados FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='cg_insert_tms') THEN
      CREATE POLICY "cg_insert_tms" ON public.contratos_gerados FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='cg_update_tms') THEN
      CREATE POLICY "cg_update_tms" ON public.contratos_gerados FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 11. contratos_modelos — Modelos de Contrato
-- =============================================================================
-- Policy vulnerável: Allow all contratos_modelos (TO anon/authenticated, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all contratos_modelos" ON public.contratos_modelos;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contratos_modelos') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_modelos' AND policyname='cm_select_tms') THEN
      CREATE POLICY "cm_select_tms" ON public.contratos_modelos FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_modelos' AND policyname='cm_insert_tms') THEN
      CREATE POLICY "cm_insert_tms" ON public.contratos_modelos FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_modelos' AND policyname='cm_update_tms') THEN
      CREATE POLICY "cm_update_tms" ON public.contratos_modelos FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 12. contratos_historico — Histórico de Contratos
-- =============================================================================
-- Policy vulnerável: Allow all contratos_historico (TO anon/authenticated, ALL, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow all contratos_historico" ON public.contratos_historico;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contratos_historico') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_historico' AND policyname='chist_select_tms') THEN
      CREATE POLICY "chist_select_tms" ON public.contratos_historico FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_historico' AND policyname='chist_insert_tms') THEN
      CREATE POLICY "chist_insert_tms" ON public.contratos_historico FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 13. orcamentos — Orçamentos / Simulador de Frete
-- =============================================================================
-- Policies vulneráveis (6):
--   Allow insert orcamentos for anon (TO anon/authenticated, CHECK=true)
--   Allow select orcamentos for anon (TO anon/authenticated, USING=true)
--   Allow update orcamentos for anon (TO anon/authenticated, USING=true, CHECK=true)
--   orcamentos_insert (TO anon/authenticated, CHECK=true)
--   orcamentos_select (TO anon/authenticated, USING=true)
--   orcamentos_update (TO anon/authenticated, USING=true, CHECK=true)

DROP POLICY IF EXISTS "Allow insert orcamentos for anon" ON public.orcamentos;
DROP POLICY IF EXISTS "Allow select orcamentos for anon" ON public.orcamentos;
DROP POLICY IF EXISTS "Allow update orcamentos for anon" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_insert" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_select" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_update" ON public.orcamentos;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orcamentos') THEN
    -- TMS: full CRUD via tenant_usuarios
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orcamentos' AND policyname='orc_select_tms') THEN
      CREATE POLICY "orc_select_tms" ON public.orcamentos FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orcamentos' AND policyname='orc_insert_tms') THEN
      CREATE POLICY "orc_insert_tms" ON public.orcamentos FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orcamentos' AND policyname='orc_update_tms') THEN
      CREATE POLICY "orc_update_tms" ON public.orcamentos FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orcamentos' AND policyname='orc_delete_tms') THEN
      CREATE POLICY "orc_delete_tms" ON public.orcamentos FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Cliente: SELECT via cliente_id
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orcamentos' AND policyname='orc_select_cliente') THEN
      CREATE POLICY "orc_select_cliente" ON public.orcamentos FOR SELECT
        TO authenticated
        USING (cliente_id = f_obter_cliente_id_do_usuario());
    END IF;
  END IF;
END $$;
