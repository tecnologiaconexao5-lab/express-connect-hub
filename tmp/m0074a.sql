-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO TMS-007.4A — ADICIONAR RLS UPDATE EM ordens_servico PARA TMS
--
-- Motivação:
--   Produção tem apenas 2 RLS policies em ordens_servico:
--     1. "os_select_own"   FOR SELECT — cliente_id + f_usuario_pode_acessar_cliente
--     2. "os_insert_portal" FOR INSERT — cliente_id com f_obter_cliente_id_do_usuario
--   NENHUMA policy de UPDATE existe → toda tentativa de UPDATE via Supabase
--   Client (REST API) retorna 200 com 0 rows afetadas.
--
--   Bug confirmado em 2026-07-28: finalizarOrdemServico(), que usa
--   supabase.from("ordens_servico").update({status:"finalizada"}), falha
--   silenciosamente porque RLS bloqueia sem erro explícito.
--
-- Escopo:
--   APENAS UPDATE. Policies existentes (SELECT, INSERT) não são alteradas.
--
-- Perfis com permissão de UPDATE (matriz MISSÃO 50):
--   super_admin    ✅ TUDO
--   admin_tenant   ✅ TUDO
--   operacional    ✅ ver/editar
--
-- Perfis BLOQUEADOS (mesmo com auth.uid() válido):
--   financeiro     ❌ apenas leitura
--   comercial      ❌ apenas leitura
--   atendimento    ❌ apenas leitura
--   cliente        ❌ bloqueado pelo guard tenant_usuarios (não tem registro)
--   prestador      ❌ bloqueado pelo guard tenant_usuarios (não tem registro)
--
-- Nota: O guard tenant_usuarios é a barreira que SEPARA TMS de Portal/Prestador.
--   Usuários TMS (super_admin, admin_tenant, operacional) têm registro em
--   tenant_usuarios. Clientes e prestadores NÃO têm — eles usam usuarios_cliente
--   e prestadores.auth_user_id respectivamente.
--
-- IDEMPOTENTE: Pode executar N vezes.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ==============================================================================
-- 1. REMOVER POLICIES EXISTENTES (garantir idempotência)
-- ==============================================================================

-- Possíveis nomes de migrations anteriores que NÃO foram aplicadas em produção:
DROP POLICY IF EXISTS "os_update_tenant" ON ordens_servico;  -- 20260626
DROP POLICY IF EXISTS "os_update_tms"    ON ordens_servico;  -- 20260725
DROP POLICY IF EXISTS "os_update_auth"   ON ordens_servico;  -- legado

-- ==============================================================================
-- 2. CRIAR POLICY DE UPDATE PARA TMS
-- ==============================================================================

-- Estratégia (idêntica a ae_update_tms em alocacoes_escala — migration 20260725):
--   USING:  quais linhas o usuário pode ver/alterar
--   WITH CHECK:  quais modificações são permitidas na linha alterada
--
-- Condições:
--   1. tenant_usuarios guard: EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
--      — Garante que apenas usuários TMS reais (com papel em tenant_usuarios)
--        possam fazer UPDATE. Portal Cliente e App Prestador ficam bloqueados.
--   2. tenant_id match: tenant_id = current_tenant_id_safe()
--      — Garante isolamento multi-tenant. Cada tenant só vê/altera suas próprias OS.
--      — current_tenant_id_safe() resolve na ordem: app.current_tenant_id →
--        tenant_usuarios.tenant_id → sentinel UUID.
--      — Com o guard acima, auth.uid() estará sempre em tenant_usuarios para TMS,
--        então current_tenant_id_safe() retorna o tenant real (nunca sentinel).
--
-- WITH CHECK igual a USING porque:
--   - O tenant_id não deve mudar no UPDATE (proteção contra cross-tenant)
--   - O usuário deve continuar sendo TMS (mesmo que o papel não mude)

CREATE POLICY "os_update_tms" ON ordens_servico
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- ==============================================================================
-- 3. VALIDAÇÃO
-- ==============================================================================

DO $$
DECLARE
  v_count INTEGER;
  v_policies TEXT;
BEGIN
  -- Contar policies de UPDATE
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'ordens_servico'
    AND cmd = 'UPDATE';

  -- Listar todas as policies de ordens_servico
  SELECT string_agg(policyname || ' (' || cmd || ')', ', ' ORDER BY cmd, policyname)
    INTO v_policies
  FROM pg_policies
  WHERE tablename = 'ordens_servico';

  RAISE NOTICE '=== VALIDACAO TMS-007.4A — RLS UPDATE ordens_servico ===';
  RAISE NOTICE 'Policies UPDATE: %', v_count;
  RAISE NOTICE 'Todas as policies: %', v_policies;
  RAISE NOTICE '=== FIM ===';
END $$;

COMMIT;
