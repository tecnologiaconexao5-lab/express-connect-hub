-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO: CORREÇÃO DE SEGURANÇA RLS — alocacoes_escala, ordens_servico, clientes
--
-- Substitui policies public/anon/USING(true) por policies scoped por:
--   - tenant_id (TMS admins)
--   - cliente_id (Portal Cliente)
--   - prestador_id → prestadores.auth_user_id (App Motorista / Portal Prestador)
--
-- Padrões de vínculo confirmados (2026-07-25):
--   prestadores.auth_user_id = auth.uid()   ✅ (prestador.id != auth.uid())
--   usuarios_cliente.auth_user_id = auth.uid() → cliente_id
--   tenant_usuarios.user_id = auth.uid() → tenant_id
--   f_obter_cliente_id_do_usuario() → SECDEF, search_path=public
--   current_tenant_id_safe() → session setting com fallback sentinel
--   f_usuario_pode_acessar_cliente(id) → SECDEF, cobre portal/TMS/admin
--
-- Tabelas não modificadas nesta migration:
--   documentos_prestadores, pagamentos_prestadores, portal_* (já cobertas
--   por 20260725_missao_rls_fix_priority_tables.sql)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. alocacoes_escala
--    Colunas: tenant_id(UUID), cliente_id(UUID), prestador_id(UUID)
--    Policies preservadas:
--      - "Prestador can view own alocacoes" (authenticated, prestadores.auth_user_id)
--      - "Prestador can update own alocacoes" (authenticated, prestadores.auth_user_id)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "alocacoes_escala_select_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_insert_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_update_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_update_authenticated" ON public.alocacoes_escala;

-- 1A. SELECT — TMS (tenant-based + tenant_usuarios guard)
--     NOTA: current_tenant_id_safe() retorna sentinel UUID se app.current_tenant_id
--     não estiver definido. O guard tenant_usuarios impede que usuários do Portal
--     Cliente (que não têm tenant_usuarios) acessem dados via este caminho.
CREATE POLICY "ae_select_tms" ON public.alocacoes_escala FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 1B. SELECT — Portal Cliente
CREATE POLICY "ae_select_cliente" ON public.alocacoes_escala FOR SELECT
  TO authenticated
  USING (cliente_id = f_obter_cliente_id_do_usuario());

-- 1C. INSERT — TMS (tenant-based + tenant_usuarios guard)
CREATE POLICY "ae_insert_tms" ON public.alocacoes_escala FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 1D. INSERT — Prestador (App Motorista / Portal Prestador)
--     prestador_id referencia prestadores.id (NUNCA auth.uid())
--     lookup via prestadores.auth_user_id
--     OBS: tenant_id pode ser NULL para inserções do prestador
CREATE POLICY "ae_insert_prestador" ON public.alocacoes_escala FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()
  ));

-- 1E. UPDATE — TMS (tenant-based + tenant_usuarios guard)
CREATE POLICY "ae_update_tms" ON public.alocacoes_escala FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 1F. DELETE — TMS only (nenhum cliente/prestador pode deletar alocações)
CREATE POLICY "ae_delete_tms" ON public.alocacoes_escala FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ordens_servico
--    Colunas: tenant_id(UUID), cliente_id(TEXT), cliente(UUID), prestador_id(TEXT)
--    NOTA: cliente_id é TEXT, não UUID. Usa cast (cliente_id)::uuid para
--          compatibilidade com f_obter_cliente_id_do_usuario().
--    Policies preservadas:
--      - "os_insert_portal" (authenticated, cliente_id casting, Portal Cliente)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "os_select_own" ON public.ordens_servico;

-- 2A. SELECT — TMS (tenant-based + tenant_usuarios guard)
CREATE POLICY "os_select_tms" ON public.ordens_servico FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2B. SELECT — Portal Cliente (substitui os_select_own sem role anon)
CREATE POLICY "os_select_cliente" ON public.ordens_servico FOR SELECT
  TO authenticated
  USING ((cliente_id)::uuid = f_obter_cliente_id_do_usuario());

-- 2C. SELECT — Prestador (via vínculo em alocacoes_escala)
CREATE POLICY "os_select_prestador" ON public.ordens_servico FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM alocacoes_escala ae
    JOIN prestadores p ON p.id = ae.prestador_id
    WHERE ae.ordem_servico_id = ordens_servico.id
      AND p.auth_user_id = auth.uid()
  ));

-- 2D. INSERT — TMS (tenant-based + tenant_usuarios guard)
CREATE POLICY "os_insert_tms" ON public.ordens_servico FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2E. UPDATE — TMS (tenant-based + tenant_usuarios guard)
CREATE POLICY "os_update_tms" ON public.ordens_servico FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2F. DELETE — TMS only
CREATE POLICY "os_delete_tms" ON public.ordens_servico FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. clientes
--    Colunas: tenant_id(UUID)
--    Policies preservadas:
--      - "clientes_select_own" (será recriada sem role anon)
--      - "clientes_update_own" (authenticated, f_usuario_pode_acessar_cliente)
--      - "clientes_insert_own" (authenticated, f_usuario_pode_acessar_cliente)
--      - "clientes_delete_own" (authenticated, f_usuario_pode_acessar_cliente)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove as policies com role public/anon
DROP POLICY IF EXISTS "cliente_select_own" ON public.clientes;
DROP POLICY IF EXISTS "cliente_update_own" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select_own" ON public.clientes;

-- Recria clientes_select_own apenas para authenticated
CREATE POLICY "clientes_select_own" ON public.clientes FOR SELECT
  TO authenticated
  USING (f_usuario_pode_acessar_cliente(id) OR (id = f_obter_cliente_id_do_usuario()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- VALIDAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table text;
  v_policy_count integer;
  v_anon_pub_count integer;
  v_true_count integer;
BEGIN
  RAISE NOTICE '=== VALIDACAO DE POLICIES — alocacoes_escala, ordens_servico, clientes ===';

  FOR v_table IN SELECT unnest(ARRAY['alocacoes_escala', 'ordens_servico', 'clientes']) LOOP
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

  RAISE NOTICE '=== FIM DA VALIDACAO ===';
END $$;
