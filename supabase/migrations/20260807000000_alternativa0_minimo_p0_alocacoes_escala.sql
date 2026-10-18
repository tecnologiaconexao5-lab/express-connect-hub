-- =============================================================================
-- ALTERNATIVA 0 — CORREÇÃO MÍNIMA P0: alocacoes_escala
-- 
-- Objetivo:
--   Eliminar a vulnerabilidade P0 comprovada (anon lê/escreve dados reais)
--   sem refatorar código, sem criar RPCs, sem alterar TypeScript.
--
-- O que faz:
--   1. DROP das 4 policies com role public + USING(true) / WITH CHECK(true)
--   2. REVOKE ALL (SELECT, INSERT, UPDATE, DELETE) de anon
--   3. Cria 4 novas policies TMS (SELECT/INSERT/UPDATE/DELETE) usando
--      subquery direta em tenant_usuarios (NÃO usa current_tenant_id_safe)
--   4. Cria policy SELECT para Portal Cliente via f_obter_cliente_id_do_usuario
--   5. Preserva intocadas as 2 policies do prestador (não são P0)
--
-- O que NÃO faz:
--   ❌ Não cria RPCs
--   ❌ Não altera TypeScript
--   ❌ Não refatora fluxos
--   ❌ Não modifica dados (DDL puro)
--   ❌ Não altera migrations antigas
--
-- Risco residual pós-migration:
--   A policy "Prestador can update own alocacoes" permanece.
--   Prestador autenticado pode alterar colunas operacionais das
--   próprias alocações via REST. Risco documentado separadamente
--   para correção futura — não faz parte do P0 anônimo.
--
-- Data: 2026-08-07
-- =============================================================================

-- =============================================================================
-- SEÇÃO 1 — DROP DAS 4 POLICIES INSEGURAS
-- =============================================================================
-- Policies removidas:
--   1. alocacoes_escala_select_anon      (role: public,  qual: true)
--   2. alocacoes_escala_insert_anon      (role: public,  qual: true)
--   3. alocacoes_escala_update_anon      (role: public,  qual: true, check: true)
--   4. alocacoes_escala_update_authenticated (role: public, qual: true)
-- =============================================================================

DROP POLICY IF EXISTS "alocacoes_escala_select_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_insert_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_update_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_update_authenticated" ON public.alocacoes_escala;

-- =============================================================================
-- SEÇÃO 2 — REVOKE ALL DE anon
-- =============================================================================
-- Antes: anon tinha SELECT, INSERT, UPDATE, DELETE (grants padrão herdados)
-- Depois: anon tem 0 permissões em alocacoes_escala
-- =============================================================================

REVOKE ALL PRIVILEGES ON public.alocacoes_escala FROM anon;

-- =============================================================================
-- SEÇÃO 3 — TMS POLICIES (subquery direta, SEM current_tenant_id_safe)
-- =============================================================================
-- 
-- Padrão: EXISTS (SELECT 1 FROM tenant_usuarios tu
--           WHERE tu.user_id = auth.uid()
--             AND tu.tenant_id = alocacoes_escala.tenant_id
--             AND tu.status = 'ativo')
--
-- Por que não current_tenant_id_safe():
--   A função tem 3 versões conflitantes no repositório. As versões
--   M44A/M46 leem app.current_tenant_id (nome errado), enquanto o
--   frontend seta app.tenant_id via RPC set_tenant_context. A subquery
--   direta elimina esta dependência e funciona independentemente de
--   session parameters.
--
-- Guard tenant_usuarios:
--   O EXISTS com tenant_usuarios garante que apenas usuários TMS reais
--   (com vínculo explícito a um tenant) acessem dados pelo caminho
--   tenant. Usuários do Portal Cliente (que NÃO têm tenant_usuarios)
--   são barrados e devem usar a policy ae_select_cliente (SEÇÃO 4).
-- =============================================================================

-- 3A. SELECT — TMS
CREATE POLICY "ae_select_tms" ON public.alocacoes_escala FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = alocacoes_escala.tenant_id
        AND tu.status = 'ativo'
    )
  );

-- 3B. INSERT — TMS
CREATE POLICY "ae_insert_tms" ON public.alocacoes_escala FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = alocacoes_escala.tenant_id
        AND tu.status = 'ativo'
    )
  );

-- 3C. UPDATE — TMS
CREATE POLICY "ae_update_tms" ON public.alocacoes_escala FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = alocacoes_escala.tenant_id
        AND tu.status = 'ativo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = alocacoes_escala.tenant_id
        AND tu.status = 'ativo'
    )
  );

-- 3D. DELETE — TMS
CREATE POLICY "ae_delete_tms" ON public.alocacoes_escala FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = alocacoes_escala.tenant_id
        AND tu.status = 'ativo'
    )
  );

-- =============================================================================
-- SEÇÃO 4 — PORTAL CLIENTE SELECT
-- =============================================================================
-- Permite que clientes autenticados via Portal Cliente vejam suas
-- alocações. Usa f_obter_cliente_id_do_usuario() (SECURITY DEFINER)
-- que retorna o cliente_id vinculado ao auth.uid() do usuário.
-- =============================================================================

CREATE POLICY "ae_select_cliente" ON public.alocacoes_escala FOR SELECT
  TO authenticated
  USING (cliente_id = f_obter_cliente_id_do_usuario());

-- =============================================================================
-- SEÇÃO 5 — POLICIES DO PRESTADOR PRESERVADAS
-- =============================================================================
-- As seguintes policies NÃO são alteradas (não fazem parte do P0):
--   ✅ "Prestador can view own alocacoes"
--      → TO authenticated
--      → USING (prestador_id IN (SELECT id FROM prestadores WHERE auth_user_id = auth.uid()))
--   ✅ "Prestador can update own alocacoes"
--      → TO authenticated
--      → USING (prestador_id IN (SELECT id FROM prestadores WHERE auth_user_id = auth.uid()))
-- =============================================================================

-- =============================================================================
-- SEÇÃO 6 — VALIDAÇÃO PÓS-MIGRATION
-- =============================================================================

DO $$
DECLARE
  v_total_policies INTEGER;
  v_public_policies INTEGER;
  v_anon_grants INTEGER;
  v_prestador_policies INTEGER;
  v_tms_policies INTEGER;
  v_cliente_policies INTEGER;
BEGIN
  -- 6.1. Contar policies
  SELECT COUNT(*) INTO v_total_policies
  FROM pg_policies WHERE tablename = 'alocacoes_escala';

  -- 6.2. Verificar policies com role public restante (devem ser 0)
  SELECT COUNT(*) INTO v_public_policies
  FROM pg_policies
  WHERE tablename = 'alocacoes_escala'
    AND (roles @> ARRAY['public'::name]);

  -- 6.3. Verificar grants anon (devem ser 0)
  SELECT COUNT(*) INTO v_anon_grants
  FROM information_schema.table_privileges
  WHERE table_name = 'alocacoes_escala'
    AND table_schema = 'public'
    AND grantee = 'anon';

  -- 6.4. Contar policies do prestador
  SELECT COUNT(*) INTO v_prestador_policies
  FROM pg_policies
  WHERE tablename = 'alocacoes_escala'
    AND policyname IN ('Prestador can view own alocacoes', 'Prestador can update own alocacoes');

  -- 6.5. Contar policies TMS
  SELECT COUNT(*) INTO v_tms_policies
  FROM pg_policies
  WHERE tablename = 'alocacoes_escala'
    AND policyname LIKE 'ae_%_tms';

  -- 6.6. Policy cliente
  SELECT COUNT(*) INTO v_cliente_policies
  FROM pg_policies
  WHERE tablename = 'alocacoes_escala'
    AND policyname = 'ae_select_cliente';

  -- 6.7. Report
  RAISE NOTICE '=== VALIDACAO ALTERNATIVA 0 — alocacoes_escala ===';
  RAISE NOTICE 'Total policies: %', v_total_policies;
  RAISE NOTICE 'Policies com role public: % (deve ser 0)', v_public_policies;
  RAISE NOTICE 'Grants para anon: % (deve ser 0)', v_anon_grants;
  RAISE NOTICE 'Policies prestador preservadas: % (deve ser 2)', v_prestador_policies;
  RAISE NOTICE 'Policies TMS criadas: % (deve ser 4)', v_tms_policies;
  RAISE NOTICE 'Policy cliente criada: % (deve ser 1)', v_cliente_policies;

  -- 6.8. Assertions
  IF v_public_policies > 0 THEN
    RAISE EXCEPTION 'FALHA: Ainda existem % policies com role public em alocacoes_escala!', v_public_policies;
  END IF;

  IF v_anon_grants > 0 THEN
    RAISE EXCEPTION 'FALHA: anon ainda tem % grants em alocacoes_escala!', v_anon_grants;
  END IF;

  IF v_prestador_policies < 2 THEN
    RAISE WARNING 'ATENCAO: %/2 policies prestador encontradas. Podem ter sido removidas acidentalmente.', v_prestador_policies;
  END IF;

  IF v_tms_policies < 4 THEN
    RAISE WARNING 'ATENCAO: Apenas %/4 policies TMS criadas.', v_tms_policies;
  END IF;

  IF v_cliente_policies < 1 THEN
    RAISE WARNING 'ATENCAO: Policy cliente nao encontrada.';
  END IF;

  RAISE NOTICE '=== ALTERNATIVA 0 APLICADA COM SUCESSO ===';
END;
$$;
