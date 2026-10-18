-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSAO 06 (M6) — RLS: Tabelas Remanescentes (Financeiro, CRM, Fiscal, etc.)
--
-- Substitui todas as policies com `TO anon` ou `USING(true)` sem TO por
-- policies `TO authenticated` escopadas por tenant_id + tenant_usuarios guard.
--
-- Padrão de correção:
--   Antes: CREATE POLICY "xxx_select_tenant" ON tabela FOR SELECT TO anon, authenticated
--            USING (tenant_id = current_tenant_id_safe());
--   Depois: CREATE POLICY "xxx_select_tms" ON tabela FOR SELECT TO authenticated
--             USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
--                    AND tenant_id = current_tenant_id_safe());
--
-- Tabelas corrigidas (27):
--   SECAO 1: Financeiro (5)  — financeiro_receber, financeiro_pagar,
--                               composicao_financeira_os, financeiro_baixas,
--                               despesas_operacionais
--   SECAO 2: CRM (7)         — crm_leads, crm_conversas, crm_mensagens,
--                               crm_historico, crm_followups,
--                               crm_templates_mensagem, crm_interacoes_prestadores
--   SECAO 3: Cadastro (2)    — prestadores, veiculos
--   SECAO 4: Fiscal (3)      — fiscal_ctes, fiscal_nfse, fiscal_mdfes
--   SECAO 5: Contratos (3)   — contratos_gerados, contratos_modelos,
--                               contratos_historico
--   SECAO 6: Precificacao (1) — tabelas_valores
--   SECAO 7: Operacao (3)    — orcamentos, historico_alocacoes_escala,
--                               operacao_localizacao
--   SECAO 8: Audit/GPS (2)   — auditoria_operacional, integracoes_logs
--   SECAO 9: Tenant/Auth (1) — usuarios_cliente
--
-- Excluídas propositalmente:
--   - tenants, tenant_usuarios: SELECT anon necessário para fluxo de auth inicial
--   - recrutamento_candidatos: anon INSERT necessário para formulário público
--
-- Nao requeridas (já cobertas por M3+M4):
--   portal_*, alocacoes_escala, ordens_servico, clientes,
--   documentos_prestadores, pagamentos_prestadores
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 1: FINANCEIRO
-- ═══════════════════════════════════════════════════════════════════════════════

-- NOTA: NENHUMA tabela desta seção TEM coluna tenant_id em produção.
--       Usamos apenas guard tenant_usuarios (sem tenant_id = current_tenant_id_safe()).
--       As políticas _tenant das migrações missao16/missao18 nunca foram criadas
--       por falta da coluna — por isso os DROPs abaixo usam IF EXISTS.

-- 1.1 financeiro_receber — 81 registros, valores financeiros
-- Também acessado por portal_cliente_financeiro_view (SECURITY INVOKER)
ALTER TABLE public.financeiro_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fr_select_tenant" ON public.financeiro_receber;
DROP POLICY IF EXISTS "fr_insert_tenant" ON public.financeiro_receber;
DROP POLICY IF EXISTS "fr_update_tenant" ON public.financeiro_receber;
DROP POLICY IF EXISTS "fr_delete_tenant" ON public.financeiro_receber;
DROP POLICY IF EXISTS "Allow all on financeiro_receber" ON public.financeiro_receber;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'financeiro_receber') THEN
    -- TMS users (via tenant_usuarios) — sem tenant_id (coluna nao existe)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_receber' AND policyname='fr_select_tms') THEN
      CREATE POLICY "fr_select_tms" ON public.financeiro_receber FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_receber' AND policyname='fr_insert_tms') THEN
      CREATE POLICY "fr_insert_tms" ON public.financeiro_receber FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_receber' AND policyname='fr_update_tms') THEN
      CREATE POLICY "fr_update_tms" ON public.financeiro_receber FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_receber' AND policyname='fr_delete_tms') THEN
      CREATE POLICY "fr_delete_tms" ON public.financeiro_receber FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Cliente: vê apenas seus próprios recebíveis
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_receber' AND policyname='fr_select_cliente') THEN
      CREATE POLICY "fr_select_cliente" ON public.financeiro_receber FOR SELECT
        TO authenticated
        USING (cliente_id = f_obter_cliente_id_do_usuario());
    END IF;
  END IF;
END $$;

-- 1.2 financeiro_pagar — 74 registros, valores financeiros
-- Contém contas a pagar para prestadores e fornecedores
ALTER TABLE public.financeiro_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fp_select_tenant" ON public.financeiro_pagar;
DROP POLICY IF EXISTS "fp_insert_tenant" ON public.financeiro_pagar;
DROP POLICY IF EXISTS "fp_update_tenant" ON public.financeiro_pagar;
DROP POLICY IF EXISTS "fp_delete_tenant" ON public.financeiro_pagar;
DROP POLICY IF EXISTS "Allow all on financeiro_pagar" ON public.financeiro_pagar;

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
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_pagar' AND policyname='fp_delete_tms') THEN
      CREATE POLICY "fp_delete_tms" ON public.financeiro_pagar FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 1.3 composicao_financeira_os — Margens financeiras por OS
-- Contém detalhes de composição de custos (combustível, ajudante, adicionais, descontos)
ALTER TABLE public.composicao_financeira_os ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cfo_select_tenant" ON public.composicao_financeira_os;
DROP POLICY IF EXISTS "cfo_insert_tenant" ON public.composicao_financeira_os;
DROP POLICY IF EXISTS "cfo_update_tenant" ON public.composicao_financeira_os;
DROP POLICY IF EXISTS "cfo_delete_tenant" ON public.composicao_financeira_os;

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
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 1.4 financeiro_baixas — Baixas financeiras (TABELA NAO EXISTE em producao)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'financeiro_baixas') THEN
    DROP POLICY IF EXISTS "fb_select_tenant" ON public.financeiro_baixas;
    DROP POLICY IF EXISTS "fb_insert_tenant" ON public.financeiro_baixas;
    DROP POLICY IF EXISTS "fb_update_tenant" ON public.financeiro_baixas;
    DROP POLICY IF EXISTS "fb_delete_tenant" ON public.financeiro_baixas;

    ALTER TABLE public.financeiro_baixas ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_baixas' AND policyname='fb_select_tms') THEN
      CREATE POLICY "fb_select_tms" ON public.financeiro_baixas FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_baixas' AND policyname='fb_insert_tms') THEN
      CREATE POLICY "fb_insert_tms" ON public.financeiro_baixas FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_baixas' AND policyname='fb_update_tms') THEN
      CREATE POLICY "fb_update_tms" ON public.financeiro_baixas FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 1.5 despesas_operacionais — Despesas operacionais (TABELA NAO EXISTE em producao)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'despesas_operacionais') THEN
    DROP POLICY IF EXISTS "do_select_tenant" ON public.despesas_operacionais;
    DROP POLICY IF EXISTS "do_insert_tenant" ON public.despesas_operacionais;
    DROP POLICY IF EXISTS "do_update_tenant" ON public.despesas_operacionais;
    DROP POLICY IF EXISTS "do_delete_tenant" ON public.despesas_operacionais;

    ALTER TABLE public.despesas_operacionais ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='despesas_operacionais' AND policyname='do_select_tms') THEN
      CREATE POLICY "do_select_tms" ON public.despesas_operacionais FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='despesas_operacionais' AND policyname='do_insert_tms') THEN
      CREATE POLICY "do_insert_tms" ON public.despesas_operacionais FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='despesas_operacionais' AND policyname='do_update_tms') THEN
      CREATE POLICY "do_update_tms" ON public.despesas_operacionais FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 2: CRM
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2.1 crm_leads — Leads comerciais (dados sensíveis de clientes potenciais)
-- NOTA: crm_leads NAO tem coluna tenant_id em producao.
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cl_select_tenant" ON public.crm_leads;
DROP POLICY IF EXISTS "cl_insert_tenant" ON public.crm_leads;
DROP POLICY IF EXISTS "cl_update_tenant" ON public.crm_leads;
DROP POLICY IF EXISTS "cl_delete_tenant" ON public.crm_leads;
DROP POLICY IF EXISTS "allow_all_crm_leads" ON public.crm_leads;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_leads') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='cl_select_tms') THEN
      CREATE POLICY "cl_select_tms" ON public.crm_leads FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='cl_insert_tms') THEN
      CREATE POLICY "cl_insert_tms" ON public.crm_leads FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='cl_update_tms') THEN
      CREATE POLICY "cl_update_tms" ON public.crm_leads FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_leads' AND policyname='cl_delete_tms') THEN
      CREATE POLICY "cl_delete_tms" ON public.crm_leads FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- Limpeza de policies anon/irrestritas da missao01 nos CRMs sem tenant_id
-- NOTA: crm_conversas e crm_mensagens NÃO têm tenant_id. O guard tenant_usuarios
--       impede anon mas não isola por tenant entre usuários TMS.
--       Para isolamento multi-tenant completo, será necessário adicionar tenant_id
--       via migration futura. Por ora, risco aceito (apenas TMS authenticated, sem anon).
DROP POLICY IF EXISTS "crm_conversas_select_anon" ON public.crm_conversas;
DROP POLICY IF EXISTS "crm_conversas_write_auth" ON public.crm_conversas;
DROP POLICY IF EXISTS "crm_conversas_update_auth" ON public.crm_conversas;
DROP POLICY IF EXISTS "crm_mensagens_select_anon" ON public.crm_mensagens;
DROP POLICY IF EXISTS "crm_mensagens_write_auth" ON public.crm_mensagens;
DROP POLICY IF EXISTS "crm_historico_select_anon" ON public.crm_historico;
DROP POLICY IF EXISTS "crm_historico_write_auth" ON public.crm_historico;
DROP POLICY IF EXISTS "crm_followups_select_anon" ON public.crm_followups;
DROP POLICY IF EXISTS "crm_followups_write_auth" ON public.crm_followups;
DROP POLICY IF EXISTS "crm_tmpl_select_anon" ON public.crm_templates_mensagem;
DROP POLICY IF EXISTS "crm_tmpl_write_auth" ON public.crm_templates_mensagem;
DROP POLICY IF EXISTS "cip_select_anon" ON public.crm_interacoes_prestadores;

-- 2.2 crm_conversas — Conversas de clientes (conteúdo sensível)
ALTER TABLE public.crm_conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_crm_conversas" ON public.crm_conversas;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_conversas') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_conversas' AND policyname='cc_select_tms') THEN
      CREATE POLICY "cc_select_tms" ON public.crm_conversas FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_conversas' AND policyname='cc_insert_tms') THEN
      CREATE POLICY "cc_insert_tms" ON public.crm_conversas FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_conversas' AND policyname='cc_update_tms') THEN
      CREATE POLICY "cc_update_tms" ON public.crm_conversas FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 2.3 crm_mensagens — Mensagens das conversas (conteúdo sensível)
ALTER TABLE public.crm_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_crm_mensagens" ON public.crm_mensagens;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_mensagens') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_mensagens' AND policyname='cm_select_tms') THEN
      CREATE POLICY "cm_select_tms" ON public.crm_mensagens FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_mensagens' AND policyname='cm_insert_tms') THEN
      CREATE POLICY "cm_insert_tms" ON public.crm_mensagens FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_mensagens' AND policyname='cm_update_tms') THEN
      CREATE POLICY "cm_update_tms" ON public.crm_mensagens FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 2.4 crm_historico — Histórico de atividades de leads
ALTER TABLE public.crm_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ch_select_tenant" ON public.crm_historico;
DROP POLICY IF EXISTS "ch_insert_tenant" ON public.crm_historico;
DROP POLICY IF EXISTS "allow_all_crm_historico" ON public.crm_historico;

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
  END IF;
END $$;

-- 2.5 crm_followups — Followups agendados
ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cf_select_tenant" ON public.crm_followups;
DROP POLICY IF EXISTS "cf_insert_tenant" ON public.crm_followups;
DROP POLICY IF EXISTS "allow_all_crm_followups" ON public.crm_followups;

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

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_followups' AND policyname='cf_update_tms') THEN
      CREATE POLICY "cf_update_tms" ON public.crm_followups FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 2.6 crm_templates_mensagem — Templates de comunicação
ALTER TABLE public.crm_templates_mensagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_crm_templates_mensagem" ON public.crm_templates_mensagem;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_templates_mensagem') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_templates_mensagem' AND policyname='ctm_select_tms') THEN
      CREATE POLICY "ctm_select_tms" ON public.crm_templates_mensagem FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_templates_mensagem' AND policyname='ctm_insert_tms') THEN
      CREATE POLICY "ctm_insert_tms" ON public.crm_templates_mensagem FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_templates_mensagem' AND policyname='ctm_update_tms') THEN
      CREATE POLICY "ctm_update_tms" ON public.crm_templates_mensagem FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 2.7 crm_interacoes_prestadores — Interações com prestadores
ALTER TABLE public.crm_interacoes_prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "anon_insert" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "anon_update" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "anon_delete" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "authenticated_select" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "authenticated_insert" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "authenticated_update" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "authenticated_delete" ON public.crm_interacoes_prestadores;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'crm_interacoes_prestadores') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_interacoes_prestadores' AND policyname='cip_select_tms') THEN
      CREATE POLICY "cip_select_tms" ON public.crm_interacoes_prestadores FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_interacoes_prestadores' AND policyname='cip_insert_tms') THEN
      CREATE POLICY "cip_insert_tms" ON public.crm_interacoes_prestadores FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_interacoes_prestadores' AND policyname='cip_update_tms') THEN
      CREATE POLICY "cip_update_tms" ON public.crm_interacoes_prestadores FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 3: CADASTRO (prestadores, veiculos)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 3.1 prestadores — Dados cadastrais de prestadores/motoristas
-- NOTA: prestadores NAO tem coluna tenant_id em producao.
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prestadores_select_tenant" ON public.prestadores;
DROP POLICY IF EXISTS "prestadores_insert_tenant" ON public.prestadores;
DROP POLICY IF EXISTS "prestadores_update_tenant" ON public.prestadores;
DROP POLICY IF EXISTS "prestadores_delete_tenant" ON public.prestadores;
DROP POLICY IF EXISTS "Allow all on prestadores" ON public.prestadores;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'prestadores') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='prestadores_select_tms') THEN
      CREATE POLICY "prestadores_select_tms" ON public.prestadores FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='prestadores_insert_tms') THEN
      CREATE POLICY "prestadores_insert_tms" ON public.prestadores FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='prestadores_update_tms') THEN
      CREATE POLICY "prestadores_update_tms" ON public.prestadores FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='prestadores_delete_tms') THEN
      CREATE POLICY "prestadores_delete_tms" ON public.prestadores FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Prestador self-service: vê apenas seu próprio cadastro
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='prestadores_select_own') THEN
      CREATE POLICY "prestadores_select_own" ON public.prestadores FOR SELECT
        TO authenticated
        USING (auth_user_id = auth.uid());
    END IF;

    -- Portal Cliente: vê nome/veículo dos prestadores vinculados às suas entregas
    -- (SELECT limitado via alocacoes_escala.cliente_id)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prestadores' AND policyname='prestadores_select_portal') THEN
      CREATE POLICY "prestadores_select_portal" ON public.prestadores FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM alocacoes_escala ae
            WHERE ae.prestador_id = prestadores.id
              AND ae.cliente_id = f_obter_cliente_id_do_usuario()
          )
          OR auth_user_id = auth.uid()
        );
    END IF;
  END IF;
END $$;

-- 3.2 veiculos — Dados dos veículos
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "veiculos_select_tenant" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_insert_tenant" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_update_tenant" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_delete_tenant" ON public.veiculos;
DROP POLICY IF EXISTS "Allow all on veiculos" ON public.veiculos;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'veiculos') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veiculos' AND policyname='veiculos_select_tms') THEN
      CREATE POLICY "veiculos_select_tms" ON public.veiculos FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veiculos' AND policyname='veiculos_insert_tms') THEN
      CREATE POLICY "veiculos_insert_tms" ON public.veiculos FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veiculos' AND policyname='veiculos_update_tms') THEN
      CREATE POLICY "veiculos_update_tms" ON public.veiculos FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veiculos' AND policyname='veiculos_delete_tms') THEN
      CREATE POLICY "veiculos_delete_tms" ON public.veiculos FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Cliente: vê veículos dos prestadores vinculados às suas entregas
    -- Join: alocacoes_escala.prestador_id → prestadores.id → veiculos.prestador_vinculado
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veiculos' AND policyname='veiculos_select_portal') THEN
      CREATE POLICY "veiculos_select_portal" ON public.veiculos FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM alocacoes_escala ae
            JOIN prestadores p ON p.id = ae.prestador_id
            WHERE p.id = veiculos.prestador_vinculado
              AND ae.cliente_id = f_obter_cliente_id_do_usuario()
          )
        );
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 4: FISCAL
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4.1 fiscal_ctes — Conhecimentos de Transporte Eletrônico
ALTER TABLE public.fiscal_ctes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcte_select_tenant" ON public.fiscal_ctes;
DROP POLICY IF EXISTS "fcte_insert_tenant" ON public.fiscal_ctes;
DROP POLICY IF EXISTS "fcte_update_tenant" ON public.fiscal_ctes;

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
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Cliente: vê CTEs dos seus clientes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_ctes' AND policyname='fcte_select_cliente') THEN
      CREATE POLICY "fcte_select_cliente" ON public.fiscal_ctes FOR SELECT
        TO authenticated
        USING (cliente_id = f_obter_cliente_id_do_usuario());
    END IF;
  END IF;
END $$;

-- 4.2 fiscal_nfse — Notas Fiscais de Serviço Eletrônica
ALTER TABLE public.fiscal_nfse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fnfse_select_tenant" ON public.fiscal_nfse;
DROP POLICY IF EXISTS "fnfse_insert_tenant" ON public.fiscal_nfse;
DROP POLICY IF EXISTS "fnfse_update_tenant" ON public.fiscal_nfse;

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
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Cliente: vê NFSes dos seus clientes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_nfse' AND policyname='fnfse_select_cliente') THEN
      CREATE POLICY "fnfse_select_cliente" ON public.fiscal_nfse FOR SELECT
        TO authenticated
        USING (cliente_id = f_obter_cliente_id_do_usuario());
    END IF;
  END IF;
END $$;

-- 4.3 fiscal_mdfes — Manifestos Eletrônicos de Documentos Fiscais
ALTER TABLE public.fiscal_mdfes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmdfe_select_tenant" ON public.fiscal_mdfes;
DROP POLICY IF EXISTS "fmdfe_insert_tenant" ON public.fiscal_mdfes;
DROP POLICY IF EXISTS "fmdfe_update_tenant" ON public.fiscal_mdfes;

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
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Cliente: vê MDFes dos seus clientes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiscal_mdfes' AND policyname='fmdfe_select_cliente') THEN
      CREATE POLICY "fmdfe_select_cliente" ON public.fiscal_mdfes FOR SELECT
        TO authenticated
        USING (cliente_id = f_obter_cliente_id_do_usuario());
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 5: CONTRATOS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5.1 contratos_gerados — Contratos gerados (USING(true) sem TO → TO authenticated)
-- NOTA: contratos_gerados NAO tem coluna tenant_id em producao.
--       Usamos apenas guard tenant_usuarios (sem AND tenant_id = current_tenant_id_safe()).
ALTER TABLE public.contratos_gerados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_select" ON public.contratos_gerados;
DROP POLICY IF EXISTS "contratos_insert" ON public.contratos_gerados;
DROP POLICY IF EXISTS "contratos_update" ON public.contratos_gerados;
DROP POLICY IF EXISTS "contratos_gerados_select_anon" ON public.contratos_gerados;
DROP POLICY IF EXISTS "contratos_gerados_insert_auth" ON public.contratos_gerados;
DROP POLICY IF EXISTS "contratos_gerados_update_auth" ON public.contratos_gerados;
DROP POLICY IF EXISTS "cg_select_tenant" ON public.contratos_gerados;
DROP POLICY IF EXISTS "cg_insert_tenant" ON public.contratos_gerados;
DROP POLICY IF EXISTS "cg_update_tenant" ON public.contratos_gerados;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contratos_gerados') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='contratos_select_tms') THEN
      CREATE POLICY "contratos_select_tms" ON public.contratos_gerados FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='contratos_insert_tms') THEN
      CREATE POLICY "contratos_insert_tms" ON public.contratos_gerados FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='contratos_update_tms') THEN
      CREATE POLICY "contratos_update_tms" ON public.contratos_gerados FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    -- Portal Prestador: vê seus próprios contratos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_gerados' AND policyname='contratos_select_prestador') THEN
      CREATE POLICY "contratos_select_prestador" ON public.contratos_gerados FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM prestadores
            WHERE prestadores.id = contratos_gerados.prestador_id
              AND prestadores.auth_user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END $$;

-- 5.2 contratos_modelos — Modelos de contrato
ALTER TABLE public.contratos_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modelos_select" ON public.contratos_modelos;
DROP POLICY IF EXISTS "modelos_insert" ON public.contratos_modelos;
DROP POLICY IF EXISTS "modelos_update" ON public.contratos_modelos;
DROP POLICY IF EXISTS "contratos_modelos_select_anon" ON public.contratos_modelos;
DROP POLICY IF EXISTS "contratos_modelos_insert_auth" ON public.contratos_modelos;
DROP POLICY IF EXISTS "contratos_modelos_update_auth" ON public.contratos_modelos;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contratos_modelos') THEN
    -- Sem tenant_id nem cliente_id — acesso TMS apenas
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_modelos' AND policyname='modelos_select_tms') THEN
      CREATE POLICY "modelos_select_tms" ON public.contratos_modelos FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_modelos' AND policyname='modelos_insert_tms') THEN
      CREATE POLICY "modelos_insert_tms" ON public.contratos_modelos FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_modelos' AND policyname='modelos_update_tms') THEN
      CREATE POLICY "modelos_update_tms" ON public.contratos_modelos FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 5.3 contratos_historico — Histórico de ações em contratos
ALTER TABLE public.contratos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historico_select" ON public.contratos_historico;
DROP POLICY IF EXISTS "historico_insert" ON public.contratos_historico;
DROP POLICY IF EXISTS "contratos_historico_select_anon" ON public.contratos_historico;
DROP POLICY IF EXISTS "contratos_historico_insert_auth" ON public.contratos_historico;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contratos_historico') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_historico' AND policyname='historico_select_tms') THEN
      CREATE POLICY "historico_select_tms" ON public.contratos_historico FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_historico' AND policyname='historico_insert_tms') THEN
      CREATE POLICY "historico_insert_tms" ON public.contratos_historico FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 6: PRECIFICACAO
-- ═══════════════════════════════════════════════════════════════════════════════

-- 6.1 tabelas_valores — Tabelas de preços por veículo/cliente
-- NOTA: tabelas_valores TEM coluna tenant_id.
ALTER TABLE public.tabelas_valores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on tabelas_valores" ON public.tabelas_valores;
DROP POLICY IF EXISTS "tabelas_valores_select" ON public.tabelas_valores;
DROP POLICY IF EXISTS "tabelas_valores_insert" ON public.tabelas_valores;
DROP POLICY IF EXISTS "tabelas_valores_update" ON public.tabelas_valores;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tabelas_valores') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tabelas_valores' AND policyname='tv_select_tms') THEN
      CREATE POLICY "tv_select_tms" ON public.tabelas_valores FOR SELECT
        TO authenticated
        USING (
          EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
          AND tenant_id = current_tenant_id_safe()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tabelas_valores' AND policyname='tv_insert_tms') THEN
      CREATE POLICY "tv_insert_tms" ON public.tabelas_valores FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
          AND tenant_id = current_tenant_id_safe()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tabelas_valores' AND policyname='tv_update_tms') THEN
      CREATE POLICY "tv_update_tms" ON public.tabelas_valores FOR UPDATE
        TO authenticated
        USING (
          EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
          AND tenant_id = current_tenant_id_safe()
        );
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 7: OPERACAO
-- ═══════════════════════════════════════════════════════════════════════════════

-- 7.1 orcamentos — Orçamentos comerciais
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orc_select_tenant" ON public.orcamentos;
DROP POLICY IF EXISTS "orc_insert_tenant" ON public.orcamentos;
DROP POLICY IF EXISTS "orc_update_tenant" ON public.orcamentos;
DROP POLICY IF EXISTS "orc_delete_tenant" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_select_anon" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_insert_anon" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_update_auth" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_delete_auth" ON public.orcamentos;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orcamentos') THEN
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
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orcamentos' AND policyname='orc_delete_tms') THEN
      CREATE POLICY "orc_delete_tms" ON public.orcamentos FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 7.2 historico_alocacoes_escala — Histórico de eventos de alocações
ALTER TABLE public.historico_alocacoes_escala ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hae_select_tenant" ON public.historico_alocacoes_escala;
DROP POLICY IF EXISTS "hae_insert_tenant" ON public.historico_alocacoes_escala;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'historico_alocacoes_escala') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='historico_alocacoes_escala' AND policyname='hae_select_tms') THEN
      CREATE POLICY "hae_select_tms" ON public.historico_alocacoes_escala FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='historico_alocacoes_escala' AND policyname='hae_insert_tms') THEN
      CREATE POLICY "hae_insert_tms" ON public.historico_alocacoes_escala FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 7.3 operacao_localizacao — GPS em tempo real (INSERT TO anon removido)
ALTER TABLE public.operacao_localizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oper_localizacao_insert" ON public.operacao_localizacao;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'operacao_localizacao') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='operacao_localizacao' AND policyname='oper_localizacao_insert_prestador') THEN
      CREATE POLICY "oper_localizacao_insert_prestador" ON public.operacao_localizacao FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (SELECT 1 FROM prestadores WHERE auth_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
        );
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 8: AUDITORIA / LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 8.1 auditoria_operacional — Logs de auditoria operacional (TABELA NAO EXISTE em producao)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'auditoria_operacional') THEN
    ALTER TABLE public.auditoria_operacional ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ao_select_tenant" ON public.auditoria_operacional;
    DROP POLICY IF EXISTS "ao_insert_tenant" ON public.auditoria_operacional;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auditoria_operacional' AND policyname='ao_select_tms') THEN
      CREATE POLICY "ao_select_tms" ON public.auditoria_operacional FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auditoria_operacional' AND policyname='ao_insert_tms') THEN
      CREATE POLICY "ao_insert_tms" ON public.auditoria_operacional FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- 8.2 integracoes_logs — Logs de integrações (Zoho, Evolution, etc.)
ALTER TABLE public.integracoes_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_integracoes_logs" ON public.integracoes_logs;
DROP POLICY IF EXISTS "integracoes_logs_select_anon" ON public.integracoes_logs;
DROP POLICY IF EXISTS "integracoes_logs_insert_auth" ON public.integracoes_logs;
DROP POLICY IF EXISTS "integracoes_logs_update_auth" ON public.integracoes_logs;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'integracoes_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='integracoes_logs' AND policyname='il_select_tms') THEN
      CREATE POLICY "il_select_tms" ON public.integracoes_logs FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='integracoes_logs' AND policyname='il_insert_tms') THEN
      CREATE POLICY "il_insert_tms" ON public.integracoes_logs FOR INSERT
        TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECAO 9: AUTENTICACAO (usuarios_cliente)
-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTA: Mantemos "cliente_read_own" (scope próprio) + "admin_all" (TMS auth).
--       Removemos apenas a política "anon_usuarios_cliente" que dava acesso
--       irrestrito a anon (USING true).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.usuarios_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_usuarios_cliente" ON public.usuarios_cliente;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VALIDACAO FINAL — Reporta policies restantes com TO anon/public ou USING(true)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table text;
  v_policy_count integer;
  v_anon_pub_count integer;
  v_true_count integer;
BEGIN
  RAISE NOTICE '=== M6 — VALIDACAO DE POLICIES POS-FIX ===';

  FOR v_table IN SELECT unnest(ARRAY[
    'financeiro_receber', 'financeiro_pagar', 'composicao_financeira_os',
    'financeiro_baixas', 'despesas_operacionais',
    'crm_leads', 'crm_conversas', 'crm_mensagens',
    'crm_historico', 'crm_followups', 'crm_templates_mensagem',
    'crm_interacoes_prestadores',
    'prestadores', 'veiculos',
    'fiscal_ctes', 'fiscal_nfse', 'fiscal_mdfes',
    'contratos_gerados', 'contratos_modelos', 'contratos_historico',
    'tabelas_valores',
    'orcamentos', 'historico_alocacoes_escala', 'operacao_localizacao',
    'auditoria_operacional', 'integracoes_logs',
    'usuarios_cliente'
  ]) LOOP
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies WHERE tablename = v_table;

    SELECT COUNT(*) INTO v_anon_pub_count
    FROM pg_policies
    WHERE tablename = v_table
      AND (roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name]);

    SELECT COUNT(*) INTO v_true_count
    FROM pg_policies
    WHERE tablename = v_table
      AND (qual LIKE '%true%' OR with_check LIKE '%true%');

    RAISE NOTICE 'Tabela: %, Policies: %, Public/Anon: %, USING(true): %',
      v_table, v_policy_count, v_anon_pub_count, v_true_count;
  END LOOP;

  RAISE NOTICE '=== FIM DA VALIDACAO M6 ===';
END $$;
