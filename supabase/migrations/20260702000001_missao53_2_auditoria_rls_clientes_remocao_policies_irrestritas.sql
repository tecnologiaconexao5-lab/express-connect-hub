-- =====================================================
-- MISSÃO 53.2 — AUDITORIA RLS: REMOÇÃO DE POLICIES IRRESTRITAS
-- Data: 2026-07-02
-- =====================================================
--
-- PROBLEMA ENCONTRADO:
-- Duas policies com USING(true) AND WITH CHECK(true) permitem
-- acesso irrestrito à tabela clientes:
--   1. allow_all_clientes      → originada de sql/alter_clientes_flags_comercial.sql (dev shortcut)
--   2. liberar_tudo_clientes  → originada de rls_fix_temporario.sql (fix temporário)
--
-- AMBAS SÃO PERMISSIVE E NÃO TEM RESTRIÇÃO DE TENANT/USUÁRIO.
-- DEVEM SER REMOVIDAS.
--
-- POLICIES QUE DEVEM PERMANECER (com restrição):
--   - cliente_select_own       (missao53_perfil_cliente.sql)
--   - cliente_update_own       (missao53_perfil_cliente.sql)
--   - clientes_select_tenant   (missao16_multitenant_rls_p0.sql)
--   - clientes_insert_tenant   (missao16_multitenant_rls_p0.sql)
--   - clientes_update_tenant   (missao16_multitenant_rls_p0.sql)
--   - clientes_delete_tenant   (missao16_multitenant_rls_p0.sql)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. REMOVER allow_all_clientes
-- Justificativa: development shortcut em alter_clientes_flags_comercial.sql
-- "Garantir RLS permissivo em clientes (para salvar sem auth)"
-- NUNCA DEVERIA TER SIDO APLICADA EM PRODUÇÃO
-- =====================================================
DROP POLICY IF EXISTS "allow_all_clientes" ON clientes;

-- =====================================================
-- 2. REMOVER liberar_tudo_clientes (underscore)
-- Justificativa: rls_fix_temporario.sql criou "liberar tudo temporario"
-- O nome com underscore indica variante da mesma policy problemática
-- =====================================================
DROP POLICY IF EXISTS "liberar_tudo_clientes" ON clientes;

-- =====================================================
-- 3. REMOVER "liberar tudo temporario" (com espaço) — se existir
-- Criada em rls_fix_temporario.sql como FIX TEMPORÁRIO
-- JÁ DEVERIA TER SIDO REMOVIDA
-- =====================================================
DROP POLICY IF EXISTS "liberar tudo temporario" ON clientes;

-- =====================================================
-- 4. CONFIRMAR QUE AS POLICIES SEGURAS EXISTEM
-- Se não existirem, recriar com a definição correta
-- =====================================================

-- cliente_select_own
DROP POLICY IF EXISTS "cliente_select_own" ON clientes;
CREATE POLICY "cliente_select_own" ON clientes
  FOR SELECT
  USING (id = public.obter_cliente_id_do_usuario());

-- cliente_update_own
DROP POLICY IF EXISTS "cliente_update_own" ON clientes;
CREATE POLICY "cliente_update_own" ON clientes
  FOR UPDATE
  USING (id = public.obter_cliente_id_do_usuario())
  WITH CHECK (id = public.obter_cliente_id_do_usuario());

-- =====================================================
-- 5. VERIFICAÇÃO FINAL — Listar todas as policies da tabela clientes
-- =====================================================
-- Esta query retorna as policies remanescentes para auditoria
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'clientes'
ORDER BY policyname;

COMMIT;

-- =====================================================
-- RESULTADO ESPERADO APÓS EXECUÇÃO:
-- Polices em clientes:
--   - cliente_select_own      (SELECT restrito ao cliente logado)
--   - cliente_update_own      (UPDATE restrito ao cliente logado)
--   - clientes_select_tenant  (SELECT restrito ao tenant)
--   - clientes_insert_tenant  (INSERT restrito ao tenant)
--   - clientes_update_tenant  (UPDATE restrito ao tenant)
--   - clientes_delete_tenant  (DELETE restrito ao tenant)
--
-- NÃO deve existir nenhuma policy com USING(true) ou WITH CHECK(true)
-- que não tenha restrição de tenant/usuário.
-- =====================================================