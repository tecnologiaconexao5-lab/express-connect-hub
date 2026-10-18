-- ══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 136-C.2-F2-A1 — CORREÇÃO RLS DE LEITURA EM ordens_servico
--
-- ATUALIZAÇÃO: Baseado na extração real do schema pg_policies via pg.
-- As policies reais no banco são DIFERENTES do que as migrations sugerem:
--
-- Policies REAIS (extraídas do banco em 2026-07-23):
--   1. "os_select_own" FOR SELECT TO authenticated
--      USING (cliente_id::uuid IN (SELECT f_obter_cliente_id_do_usuario())
--             OR f_usuario_pode_acessar_cliente(cliente_id::uuid))
--   2. "os_insert_portal" FOR INSERT TO authenticated
--      WITH CHECK (cliente_id::uuid = f_obter_cliente_id_do_usuario())
--
-- As policies "os_select_tenant", "os_insert_tenant", "os_update_tenant",
-- "os_delete_tenant" da migration 20260626 NUNCA FORAM APLICADAS ou foram
-- substituídas. O banco real TEM APENAS 2 policies.
--
-- Problema REAL:
--   cliente_id em ordens_servico é TEXT (não UUID). A policy faz
--   cliente_id::uuid que falha para registros com valores não-UUID
--   (ex: "M43_2026-06-29_18-27-54 Cliente").
--
-- Correção:
--   1. Remove "os_select_own"
--   2. Recria "os_select_own" com safe-cast via regex UUID em cliente_id
--   3. Mantém "os_insert_portal" (WITH CHECK em INSERT é seguro)
--   4. NÃO adiciona tenant check (não fazia parte da policy original)
--      — a função f_usuario_pode_acessar_cliente já trata tenant via
--        tenant_usuarios e super_admin
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ============================================================
-- 1. REMOVER POLICY DEFEITUOSA
-- ============================================================
DROP POLICY IF EXISTS "os_select_own" ON ordens_servico;

-- ============================================================
-- 2. CRIAR POLICY CORRIGIDA
-- ============================================================
-- Regras:
--   a. cliente_id deve ser UUID válido (evita cast inseguro)
--   b. Se for UUID, usa f_obter_cliente_id_do_usuario() (Portal)
--      OU f_usuario_pode_acessar_cliente() (TMS/admin)
--   c. Registros com cliente_id inválido ficam invisíveis
--      (não causam erro)
--   d. Sempre TO authenticated (anon continua sem policy)
-- ============================================================
CREATE POLICY "os_select_own" ON ordens_servico
FOR SELECT TO authenticated
USING (
  cliente_id IS NOT NULL
  AND cliente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    cliente_id::uuid IN (SELECT f_obter_cliente_id_do_usuario())
    OR f_usuario_pode_acessar_cliente(cliente_id::uuid)
  )
);

-- ============================================================
-- 3. PRESERVAR POLICY INSERT
-- ============================================================
-- "os_insert_portal" não é removida nem alterada.
-- Seu WITH CHECK (cliente_id::uuid = f_obter_cliente_id_do_usuario())
-- é seguro — apenas bloqueia INSERTs com cliente_id inválido,
-- que é o comportamento desejado.
-- ============================================================

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK:
--   DROP POLICY IF EXISTS "os_select_own" ON ordens_servico;
--   CREATE POLICY "os_select_own" ON ordens_servico FOR SELECT TO authenticated
--     USING ((cliente_id::uuid IN (SELECT f_obter_cliente_id_do_usuario())
--             OR f_usuario_pode_acessar_cliente(cliente_id::uuid)));
-- ══════════════════════════════════════════════════════════════════════════════
