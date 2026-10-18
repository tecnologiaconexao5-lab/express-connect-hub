-- =============================================================================
-- CLEANUP HML-APP-20260729 — Limpeza Controlada de Dados de Homologação
-- MISSÃO TMS-013 / TMS-017 (Seed v2 com Idempotência C)
--
-- ATENÇÃO: Este script EXCLUI dados de homologação criados exclusivamente
-- pelo seed TMS013-SEED-v2 (scripts/tms013_seed_hml.mjs).
-- NÃO use em produção sem revisão.
--
-- Antes de executar, verifique:
--   1. Quantidade de registros por tabela (PASSO 0)
--   2. IDs que serão excluídos
--   3. Ordem de exclusão (dependentes primeiro)
--   4. Descomente 'PROCEED' para executar (ou mantenha comentado para ROLLBACK)
--
-- Uso: psql -f supabase/scripts/cleanup_hml_app_20260729.sql
-- Ou: no Supabase Dashboard > SQL Editor > cole e execute
-- =============================================================================

-- =============================================================================
-- CONSTANTES
-- =============================================================================
-- Altere esta linha se o TENANT_ID de homologação for diferente:
\set HML_TENANT_ID '00000000-0000-0000-0000-000000000001'

-- =============================================================================
-- PASSO 0 — CONFERÊNCIA (leitura apenas, sem exclusão)
-- =============================================================================
-- Execute esta seção ANTES de prosseguir com os DELETEs.
-- Para modo de segurança: troque BEGIN/COMMIT por BEGIN/ROLLBACK.

SELECT '=== CONTAGEM POR TABELA ===' as info;

-- Checkpoint (seed v2)
SELECT '_hml_seed_checkpoint' as tabela,
       COUNT(*) as registros
FROM public._hml_seed_checkpoint
WHERE marcador = 'HML-APP-20260729';

-- Auth users (seed v2)
SELECT 'auth.users (tamiris.castilho)' as info,
       COUNT(*) as registros
FROM auth.users
WHERE email = 'tamiris.castilho@conexaoexpress.com.br';

-- Tenant usuarios (seed v2 — isola por tenant)
SELECT 'tenant_usuarios' as tabela,
       COUNT(*) as registros
FROM public.tenant_usuarios
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND nome_exibicao LIKE '%(HML)%';

-- Perfis permissoes (seed v2 — isola por tenant)
SELECT 'perfis_permissoes' as tabela,
       COUNT(*) as registros
FROM public.perfis_permissoes
WHERE tenant_id = :'HML_TENANT_ID'::uuid;

-- Agentes IA internos (seed v2 — isola por codigo)
SELECT 'agentes_ia_internos' as tabela,
       COUNT(*) as registros
FROM public.agentes_ia_internos
WHERE codigo IN ('IA-FINANCEIRA','IA-OPERACIONAL','IA-COMERCIAL','IA-AUDITORIA','IA-ATENDIMENTO');

-- Financeiro receber (seed v2)
SELECT 'financeiro_receber' as tabela,
       COUNT(*) as registros
FROM public.financeiro_receber
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND descricao LIKE '%HML%';

-- Financeiro pagar (seed v2)
SELECT 'financeiro_pagar' as tabela,
       COUNT(*) as registros
FROM public.financeiro_pagar
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND descricao LIKE '%HML%';

-- Pagamentos prestadores (seed v2)
SELECT 'pagamentos_prestadores' as tabela,
       COUNT(*) as registros
FROM public.pagamentos_prestadores
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND (observacao LIKE '%HML%' OR observacoes LIKE '%HML%');

-- Alocações escala (seed v2)
SELECT 'alocacoes_escala' as tabela,
       COUNT(*) as registros
FROM public.alocacoes_escala
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND origem LIKE '%HML%';

-- Entregas protocolo (seed v2)
SELECT 'entregas_protocolo' as tabela,
       COUNT(*) as registros
FROM public.entregas_protocolo
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND observacao LIKE '%HML%';

-- Fotos do protocolo (seed v2 — sem FK explícita, relacional via entrega)
-- entregas_protocolo_fotos: tabela não existe no schema real — ignorado
SELECT 'entregas_protocolo_fotos' as tabela, 0 as registros;

-- CRM leads (seed v2)
SELECT 'crm_leads' as tabela,
       COUNT(*) as registros
FROM public.crm_leads
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND email LIKE 'lead%.hml@email.com';

-- CRM followups (seed v2 — via leads)
SELECT 'crm_followups' as tabela,
       COUNT(*) as registros
FROM public.crm_followups f
WHERE EXISTS (
    SELECT 1 FROM public.crm_leads l
    WHERE l.id = f.lead_id AND l.tenant_id = :'HML_TENANT_ID'::uuid
      AND l.email LIKE 'lead%.hml@email.com'
);

SELECT '=== TOTAL REGISTROS A EXCLUIR ===' as info;

-- Após conferir, descomente PROCEED para executar ou mantenha comentado para ROLLBACK:
-- SELECT 'PROCEED' as status;

-- =============================================================================
-- PASSO 1 — EXCLUIR FILHOS (TABELAS DEPENDENTES)
-- =============================================================================
-- Ordem: tabelas sem FK para outras tabelas de homologação primeiro

BEGIN;

-- 1a. _hml_seed_checkpoint (checkpoint do seed v2)
DELETE FROM public._hml_seed_checkpoint
WHERE marcador = 'HML-APP-20260729';
GET DIAGNOSTICS cp_count = ROW_COUNT;

-- 1b. CRM followups (FK → crm_leads)
DELETE FROM public.crm_followups f
WHERE EXISTS (
    SELECT 1 FROM public.crm_leads l
    WHERE l.id = f.lead_id
      AND l.tenant_id = :'HML_TENANT_ID'::uuid
      AND l.email LIKE 'lead%.hml@email.com'
);
GET DIAGNOSTICS fu_count = ROW_COUNT;

-- 1c. Entregas protocolo fotos: tabela não existe no schema real — ignorado
SELECT 'entregas_protocolo_fotos' as tabela, 0 as registros, 'ignorado_tabela_inexistente' as info;


-- =============================================================================
-- PASSO 2 — ENTREGAS E ALOCAÇÕES
-- =============================================================================

-- 2a. Entregas protocolo (POD)
DELETE FROM public.entregas_protocolo
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND observacao LIKE '%HML%';
GET DIAGNOSTICS pod_count = ROW_COUNT;

-- 2b. Alocações escala
DELETE FROM public.alocacoes_escala
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND origem LIKE '%HML%';
GET DIAGNOSTICS aloc_count = ROW_COUNT;

-- =============================================================================
-- PASSO 3 — TABELAS FINANCEIRAS
-- =============================================================================

-- 3a. Pagamentos prestadores
DELETE FROM public.pagamentos_prestadores
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND (observacao LIKE '%HML%' OR observacoes LIKE '%HML%');
GET DIAGNOSTICS pp_count = ROW_COUNT;

-- 3b. Financeiro pagar
DELETE FROM public.financeiro_pagar
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND descricao LIKE '%HML%';
GET DIAGNOSTICS fp_count = ROW_COUNT;

-- 3c. Financeiro receber
DELETE FROM public.financeiro_receber
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND descricao LIKE '%HML%';
GET DIAGNOSTICS fr_count = ROW_COUNT;

-- =============================================================================
-- PASSO 4 — CRM LEADS
-- =============================================================================

DELETE FROM public.crm_leads
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND email LIKE 'lead%.hml@email.com';
GET DIAGNOSTICS leads_count = ROW_COUNT;

-- =============================================================================
-- PASSO 5 — AGENTES IA INTERNOS
-- =============================================================================

DELETE FROM public.agentes_ia_internos
WHERE codigo IN ('IA-FINANCEIRA','IA-OPERACIONAL','IA-COMERCIAL','IA-AUDITORIA','IA-ATENDIMENTO');
GET DIAGNOSTICS agentes_count = ROW_COUNT;

-- =============================================================================
-- PASSO 6 — PERFIS PERMISSÕES
-- =============================================================================

DELETE FROM public.perfis_permissoes
WHERE tenant_id = :'HML_TENANT_ID'::uuid;
GET DIAGNOSTICS perms_count = ROW_COUNT;

-- =============================================================================
-- PASSO 7 — TENANT USUÁRIOS (vinculação de homologação)
-- =============================================================================

DELETE FROM public.tenant_usuarios
WHERE tenant_id = :'HML_TENANT_ID'::uuid
  AND nome_exibicao LIKE '%(HML)%';
GET DIAGNOSTICS tu_count = ROW_COUNT;

-- =============================================================================
-- PASSO 8 — AUTH USERS
-- =============================================================================
-- ATENÇÃO: Excluir de auth.users é diferente de excluir de tabelas públicas.
-- Se houver dados reais vinculados ao mesmo email, este DELETE falhará por FK.
-- Isto é proposital — proteção contra exclusão de usuários reais.

DELETE FROM auth.users
WHERE email = 'tamiris.castilho@conexaoexpress.com.br';
GET DIAGNOSTICS au_count = ROW_COUNT;

-- =============================================================================
-- RESUMO
-- =============================================================================

SELECT '=== RESUMO DA LIMPEZA ===' as info;
SELECT '_hml_seed_checkpoint'  as tabela, cp_count    as excluidos;
SELECT 'crm_followups'         as tabela, fu_count    as excluidos;
SELECT 'entregas_protocolo_fotos' as tabela, 0 as excluidos;
SELECT 'entregas_protocolo'    as tabela, pod_count   as excluidos;
SELECT 'alocacoes_escala'      as tabela, aloc_count  as excluidos;
SELECT 'pagamentos_prestadores' as tabela, pp_count   as excluidos;
SELECT 'financeiro_pagar'      as tabela, fp_count    as excluidos;
SELECT 'financeiro_receber'    as tabela, fr_count    as excluidos;
SELECT 'crm_leads'             as tabela, leads_count as excluidos;
SELECT 'agentes_ia_internos'   as tabela, agentes_count as excluidos;
SELECT 'perfis_permissoes'     as tabela, perms_count as excluidos;
SELECT 'tenant_usuarios'       as tabela, tu_count    as excluidos;
SELECT 'auth.users'            as tabela, au_count    as excluidos;

SELECT '=== FIM DA LIMPEZA ===' as info;

COMMIT;

-- =============================================================================
-- VERIFICAÇÃO PÓS-LIMPEZA
-- =============================================================================
-- Descomente para verificar se restaram registros:

-- SELECT 'HML-APP-20260729 checkpoint' as filtro, COUNT(*) FROM _hml_seed_checkpoint WHERE marcador = 'HML-APP-20260729'
-- UNION ALL
-- SELECT 'tenant_usuarios (HML)', COUNT(*) FROM tenant_usuarios WHERE tenant_id = :'HML_TENANT_ID'::uuid AND nome_exibicao LIKE '%(HML)%'
-- UNION ALL
-- SELECT 'financeiro HML', COUNT(*) FROM financeiro_receber WHERE tenant_id = :'HML_TENANT_ID'::uuid AND descricao LIKE '%HML%'
-- UNION ALL
-- SELECT 'leads HML', COUNT(*) FROM crm_leads WHERE tenant_id = :'HML_TENANT_ID'::uuid AND email LIKE 'lead%.hml@email.com';
