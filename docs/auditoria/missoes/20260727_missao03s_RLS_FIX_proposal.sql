-- ============================================================
-- PROPOSTA DE CORRECAO RLS — MISSAO 03S
-- Biblioteca Global (modelos_mensagens, fluxo_recrutamento,
-- biblioteca_documentos)
--
-- Status: NAO APLICADO — apenas para revisao
-- Data: 2026-07-27
-- Autor: Auditoria
-- Ambiente: Producao — requer autorizacao antes de aplicar
-- ============================================================

-- NOTA: As 3 tabelas ja tem RLS ativo (FOR authenticated USING true).
--       As politicas atuais permitem CRUD completo a qualquer usuario
--       authenticated, sem isolamento por tenant ou auth.uid().
--
--       Para a Biblioteca Global, acesso compartilhado e intencional
--       (modelos de mensagem, templates, fluxos sao corporativos).
--       A correcao abaixo e conservadora: mantem acesso authenticated
--       mas adiciona rastreamento de criador e protecao basica.

-- ============================================================
-- 1. Adicionar coluna created_by em modelos_mensagens
-- ============================================================
-- Objetivo: rastrear quem criou cada registro sem alterar
--           comportamento atual de leitura/escrita.
--
-- ALTER TABLE modelos_mensagens
--   ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id)
--   DEFAULT auth.uid();
--
-- ALTER TABLE fluxo_recrutamento
--   ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id)
--   DEFAULT auth.uid();
--
-- ALTER TABLE biblioteca_documentos
--   ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id)
--   DEFAULT auth.uid();

-- ============================================================
-- 2. Recreate policies com auditoria minima
-- ============================================================
-- SELECT continua irrestrito (conteudo compartilhado)
-- INSERT registra created_by automaticamente
-- UPDATE/DELETE com restricao: only owner OU service_role
--
-- DROP POLICY IF EXISTS mm_insert ON modelos_mensagens;
-- CREATE POLICY "mm_insert_20260727" ON modelos_mensagens
--   FOR INSERT TO authenticated
--   WITH CHECK (true);
--   -- created_by = auth.uid() via DEFAULT, sem CHECK explicito
--
-- DROP POLICY IF EXISTS mm_delete ON modelos_mensagens;
-- CREATE POLICY "mm_delete_20260727" ON modelos_mensagens
--   FOR DELETE TO authenticated
--   USING (created_by = auth.uid() OR current_setting('role') = 'service_role');
--
-- DROP POLICY IF EXISTS mm_update ON modelos_mensagens;
-- CREATE POLICY "mm_update_20260727" ON modelos_mensagens
--   FOR UPDATE TO authenticated
--   USING (created_by = auth.uid() OR current_setting('role') = 'service_role');
--
-- (Repetir analogamente para fluxo_recrutamento e biblioteca_documentos)

-- ============================================================
-- 3. Isolamento por tenant (futuro)
-- ============================================================
-- NOTA: Isolamento tenant requer coluna tenant_id nas 3 tabelas
--       mais RLS policy USING (tenant_id = current_tenant_id_safe()).
--       Nao implementado porque a Biblioteca Global e corporativa
--       (compartilhada entre todos os tenants).
--
-- Se no futuro for necessario isolar documentos por tenant:
--
-- ALTER TABLE biblioteca_documentos ADD COLUMN tenant_id UUID;
-- CREATE POLICY "bd_tenant_select" ON biblioteca_documentos
--   FOR SELECT TO authenticated
--   USING (tenant_id = current_tenant_id_safe());
-- CREATE POLICY "bd_tenant_insert" ON biblioteca_documentos
--   FOR INSERT TO authenticated
--   WITH CHECK (tenant_id = current_tenant_id_safe());

-- ============================================================
-- 4. Resumo das politicas PROPOSTAS
-- ============================================================
--
┌───────────────────────┬──────────┬──────────────────────────────────────────┐
│ Tabela                │ Operacao │ Policy                                   │
├───────────────────────┼──────────┼──────────────────────────────────────────┤
│ modelos_mensagens     │ SELECT   │ authenticated (irrestrito)               │
│                       │ INSERT   │ authenticated (registra created_by)       │
│                       │ UPDATE   │ created_by = auth.uid() OU service_role  │
│                       │ DELETE   │ created_by = auth.uid() OU service_role  │
├───────────────────────┼──────────┼──────────────────────────────────────────┤
│ fluxo_recrutamento    │ SELECT   │ authenticated (irrestrito)               │
│                       │ INSERT   │ authenticated (registra created_by)       │
│                       │ UPDATE   │ created_by = auth.uid() OU service_role  │
│                       │ DELETE   │ created_by = auth.uid() OU service_role  │
├───────────────────────┼──────────┼──────────────────────────────────────────┤
│ biblioteca_documentos │ SELECT   │ authenticated (irrestrito)               │
│                       │ INSERT   │ authenticated (registra created_by)       │
│                       │ UPDATE   │ created_by = auth.uid() OU service_role  │
│                       │ DELETE   │ created_by = auth.uid() OU service_role  │
└───────────────────────┴──────────┴──────────────────────────────────────────┘
