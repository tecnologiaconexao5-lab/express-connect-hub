-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTFIX CLIENTES RLS — CORREÇÃO MÍNIMA DA POLICY SELECT (RETURNING)
-- TMS: express-connect-hub | Supabase: uwrvzsjtpgaifkktpepn
-- Base: HOTFIX_CLIENTES_RLS_SESSAO_REAL.txt
--
-- Causa: ClienteDetalhe usa .insert([payload]).select() → INSERT ... RETURNING.
-- O RETURNING é filtrado pela policy de SELECT `clientes_select_own`, cujo
-- critério f_usuario_pode_acessar_cliente(id) usa subquery autorreferente que
-- NÃO enxerga a linha recém-inserida na mesma instrução → 403 para não-admin.
--
-- Correção mínima autorizada (SOMENTE SELECT — nada de INSERT/UPDATE/DELETE):
--   * `clientes_select_own` é RECRIADA com a definição ORIGINAL EXATA
--     (roles anon, authenticated; critérios do Portal/cliente preservados).
--   * Nova policy `clientes_select_own_tenant` (FOR SELECT TO authenticated)
--     acrescenta acesso por tenant via f_usuario_pode_acessar_tenant(...),
--     resolvendo o RETURNING para usuários TMS autenticados.
--   * POR QUE policy separada em vez de editar a qual única: a qual da policy
--     inclui anon, e o PostgreSQL exige EXECUTE da função referenciada no
--     plano para TODAS as roles da policy. f_usuario_pode_acessar_tenant NÃO
--     é concedida a anon (proteção do hotfix INSERT). Referenciá-la na policy
--     anon causaria "permission denied for function" em qualquer SELECT anon.
--     Uma policy restrita a authenticated evita conceder EXECUTE a anon
--     (NÃO amplia roles/grants) e preserva os roles atuais da policy original.
--   * clientes com tenant NULL NÃO são expostos por este novo ramo
--     (mantém a visibilidade atual; sem impacto não provado).
-- Backup textual: scripts/backup_hotfix_clientes_rls_select_*.sql
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Restaurar clientes_select_own EXATAMENTE como estava (roles anon, authenticated)
DROP POLICY IF EXISTS clientes_select_own ON public.clientes;
CREATE POLICY clientes_select_own ON public.clientes
  FOR SELECT TO anon, authenticated
  USING (
    f_usuario_pode_acessar_cliente(id)
    OR (id = f_obter_cliente_id_do_usuario())
  );

-- 2. Nova policy SELECT restrita a authenticated: acesso por tenant (resolve RETURNING)
DROP POLICY IF EXISTS clientes_select_own_tenant ON public.clientes;
CREATE POLICY clientes_select_own_tenant ON public.clientes
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND f_usuario_pode_acessar_tenant(tenant_id)
  );

COMMIT;
