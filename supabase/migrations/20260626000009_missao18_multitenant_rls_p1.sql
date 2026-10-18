-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 18
-- Multi-Tenant Fase 4: RLS Seguro P1 (18 tabelas de negocio)
-- Data: 2026-06-26
-- Padrao: tenant_id = current_tenant_id_safe() (Missao 16)
-- ============================================================

-- ============================================================
-- SECAO 1: alocacoes_escala
-- ============================================================
ALTER TABLE alocacoes_escala ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ae_select_tenant" ON alocacoes_escala;
DROP POLICY IF EXISTS "ae_insert_tenant" ON alocacoes_escala;
DROP POLICY IF EXISTS "ae_update_tenant" ON alocacoes_escala;
DROP POLICY IF EXISTS "ae_delete_tenant" ON alocacoes_escala;
CREATE POLICY "ae_select_tenant" ON alocacoes_escala FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "ae_insert_tenant" ON alocacoes_escala FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "ae_update_tenant" ON alocacoes_escala FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "ae_delete_tenant" ON alocacoes_escala FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 2: composicao_financeira_os
-- ============================================================
ALTER TABLE composicao_financeira_os ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cfo_select_tenant" ON composicao_financeira_os;
DROP POLICY IF EXISTS "cfo_insert_tenant" ON composicao_financeira_os;
DROP POLICY IF EXISTS "cfo_update_tenant" ON composicao_financeira_os;
CREATE POLICY "cfo_select_tenant" ON composicao_financeira_os FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "cfo_insert_tenant" ON composicao_financeira_os FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "cfo_update_tenant" ON composicao_financeira_os FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 3: orcamentos
-- ============================================================
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orc_select_tenant" ON orcamentos;
DROP POLICY IF EXISTS "orc_insert_tenant" ON orcamentos;
DROP POLICY IF EXISTS "orc_update_tenant" ON orcamentos;
DROP POLICY IF EXISTS "orc_delete_tenant" ON orcamentos;
CREATE POLICY "orc_select_tenant" ON orcamentos FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "orc_insert_tenant" ON orcamentos FOR INSERT TO anon, authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "orc_update_tenant" ON orcamentos FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "orc_delete_tenant" ON orcamentos FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 4: CRM (crm_leads, crm_historico, crm_followups)
-- ============================================================
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cl_select_tenant" ON crm_leads;
DROP POLICY IF EXISTS "cl_insert_tenant" ON crm_leads;
DROP POLICY IF EXISTS "cl_update_tenant" ON crm_leads;
DROP POLICY IF EXISTS "cl_delete_tenant" ON crm_leads;
CREATE POLICY "cl_select_tenant" ON crm_leads FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "cl_insert_tenant" ON crm_leads FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "cl_update_tenant" ON crm_leads FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "cl_delete_tenant" ON crm_leads FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE crm_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ch_select_tenant" ON crm_historico;
DROP POLICY IF EXISTS "ch_insert_tenant" ON crm_historico;
CREATE POLICY "ch_select_tenant" ON crm_historico FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "ch_insert_tenant" ON crm_historico FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());

ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cf_select_tenant" ON crm_followups;
DROP POLICY IF EXISTS "cf_insert_tenant" ON crm_followups;
CREATE POLICY "cf_select_tenant" ON crm_followups FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "cf_insert_tenant" ON crm_followups FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 5: Portal (portal_pedidos, portal_ocorrencias, portal_faturas)
-- ============================================================
ALTER TABLE portal_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ppd_select_tenant" ON portal_pedidos;
DROP POLICY IF EXISTS "ppd_insert_tenant" ON portal_pedidos;
DROP POLICY IF EXISTS "ppd_update_tenant" ON portal_pedidos;
DROP POLICY IF EXISTS "ppd_delete_tenant" ON portal_pedidos;
CREATE POLICY "ppd_select_tenant" ON portal_pedidos FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "ppd_insert_tenant" ON portal_pedidos FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "ppd_update_tenant" ON portal_pedidos FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "ppd_delete_tenant" ON portal_pedidos FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE portal_ocorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_select_tenant" ON portal_ocorrencias;
DROP POLICY IF EXISTS "po_insert_tenant" ON portal_ocorrencias;
DROP POLICY IF EXISTS "po_update_tenant" ON portal_ocorrencias;
CREATE POLICY "po_select_tenant" ON portal_ocorrencias FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "po_insert_tenant" ON portal_ocorrencias FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "po_update_tenant" ON portal_ocorrencias FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE portal_faturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pf_select_tenant" ON portal_faturas;
DROP POLICY IF EXISTS "pf_insert_tenant" ON portal_faturas;
DROP POLICY IF EXISTS "pf_update_tenant" ON portal_faturas;
CREATE POLICY "pf_select_tenant" ON portal_faturas FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "pf_insert_tenant" ON portal_faturas FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "pf_update_tenant" ON portal_faturas FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 6: Contratos
-- ============================================================
ALTER TABLE contratos_gerados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cg_select_tenant" ON contratos_gerados;
DROP POLICY IF EXISTS "cg_insert_tenant" ON contratos_gerados;
DROP POLICY IF EXISTS "cg_update_tenant" ON contratos_gerados;
CREATE POLICY "cg_select_tenant" ON contratos_gerados FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "cg_insert_tenant" ON contratos_gerados FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "cg_update_tenant" ON contratos_gerados FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 7: Fiscal (fiscal_ctes, fiscal_nfse, fiscal_mdfes)
-- ============================================================
ALTER TABLE fiscal_ctes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fcte_select_tenant" ON fiscal_ctes;
DROP POLICY IF EXISTS "fcte_insert_tenant" ON fiscal_ctes;
DROP POLICY IF EXISTS "fcte_update_tenant" ON fiscal_ctes;
CREATE POLICY "fcte_select_tenant" ON fiscal_ctes FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fcte_insert_tenant" ON fiscal_ctes FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "fcte_update_tenant" ON fiscal_ctes FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE fiscal_nfse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fnfse_select_tenant" ON fiscal_nfse;
DROP POLICY IF EXISTS "fnfse_insert_tenant" ON fiscal_nfse;
DROP POLICY IF EXISTS "fnfse_update_tenant" ON fiscal_nfse;
CREATE POLICY "fnfse_select_tenant" ON fiscal_nfse FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fnfse_insert_tenant" ON fiscal_nfse FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "fnfse_update_tenant" ON fiscal_nfse FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE fiscal_mdfes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fmdfe_select_tenant" ON fiscal_mdfes;
DROP POLICY IF EXISTS "fmdfe_insert_tenant" ON fiscal_mdfes;
DROP POLICY IF EXISTS "fmdfe_update_tenant" ON fiscal_mdfes;
CREATE POLICY "fmdfe_select_tenant" ON fiscal_mdfes FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fmdfe_insert_tenant" ON fiscal_mdfes FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "fmdfe_update_tenant" ON fiscal_mdfes FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- SECAO 8: Suporte (despesas_operacionais, financeiro_baixas, auditoria_operacional, historico, notificacoes)
-- ============================================================
ALTER TABLE despesas_operacionais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "do_select_tenant" ON despesas_operacionais;
DROP POLICY IF EXISTS "do_insert_tenant" ON despesas_operacionais;
DROP POLICY IF EXISTS "do_update_tenant" ON despesas_operacionais;
CREATE POLICY "do_select_tenant" ON despesas_operacionais FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "do_insert_tenant" ON despesas_operacionais FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "do_update_tenant" ON despesas_operacionais FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE financeiro_baixas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fb_select_tenant" ON financeiro_baixas;
DROP POLICY IF EXISTS "fb_insert_tenant" ON financeiro_baixas;
DROP POLICY IF EXISTS "fb_update_tenant" ON financeiro_baixas;
CREATE POLICY "fb_select_tenant" ON financeiro_baixas FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "fb_insert_tenant" ON financeiro_baixas FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "fb_update_tenant" ON financeiro_baixas FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

ALTER TABLE auditoria_operacional ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ao_select_tenant" ON auditoria_operacional;
DROP POLICY IF EXISTS "ao_insert_tenant" ON auditoria_operacional;
CREATE POLICY "ao_select_tenant" ON auditoria_operacional FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "ao_insert_tenant" ON auditoria_operacional FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());

ALTER TABLE historico_alocacoes_escala ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hae_select_tenant" ON historico_alocacoes_escala;
DROP POLICY IF EXISTS "hae_insert_tenant" ON historico_alocacoes_escala;
CREATE POLICY "hae_select_tenant" ON historico_alocacoes_escala FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "hae_insert_tenant" ON historico_alocacoes_escala FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());

ALTER TABLE portal_notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pn_select_tenant" ON portal_notificacoes;
DROP POLICY IF EXISTS "pn_insert_tenant" ON portal_notificacoes;
DROP POLICY IF EXISTS "pn_update_tenant" ON portal_notificacoes;
CREATE POLICY "pn_select_tenant" ON portal_notificacoes FOR SELECT TO anon, authenticated USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "pn_insert_tenant" ON portal_notificacoes FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "pn_update_tenant" ON portal_notificacoes FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());

-- ============================================================
-- FIM MIGRATION MISSAO 18
-- ============================================================
