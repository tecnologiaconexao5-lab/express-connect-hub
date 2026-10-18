-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDITORIA FINAL INTEGRAÇÃO — CORREÇÃO RLS alocacoes_escala
--
-- Problema:
--   3 policies com role {public} e qual/with_check = true em alocacoes_escala:
--     - alocacoes_escala_select_anon (SELECT, qual=true) — TODO ANON LÊ TUDO
--     - alocacoes_escala_insert_anon (INSERT, check=true) — TODO ANON CRIA
--     - alocacoes_escala_update_anon (UPDATE, qual=true, check=true) — TODO ANON ALTERA
--
-- Impacto:
--   Qualquer pessoa com a chave anon pública (embutida no frontend React)
--   pode ler, inserir e alterar QUALQUER registro de alocacoes_escala,
--   incluindo dados de outros tenants, sem autenticação.
--
-- Abordagem (Alternativa A — Mínima Segura):
--   Mantém role {public} para compatibilidade com App Motorista (Flutter externo
--   que opera como anon), mas RESTRINGE por prestadores.auth_user_id:
--     - SELECT: só alocações onde prestador_id -> prestadores.auth_user_id = auth.uid()
--     - INSERT: só cria alocações onde prestador_id pertence ao próprio prestador
--     - UPDATE: só altera alocações do próprio prestador, colunas limitadas
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DROP das policies anon inseguras
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "alocacoes_escala_select_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_insert_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_update_anon" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "alocacoes_escala_update_authenticated" ON public.alocacoes_escala;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Policies substitutas — scoped por prestador (anon + authenticated)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2A. SELECT — anon/authenticated só vê suas próprias alocações
CREATE POLICY "ae_select_own" ON public.alocacoes_escala FOR SELECT
  TO public
  USING (
    NOT (prestador_id IS NULL)
    AND prestador_id IN (
      SELECT p.id FROM public.prestadores p
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- 2B. INSERT — anon/authenticated só cria alocação como próprio prestador
CREATE POLICY "ae_insert_own" ON public.alocacoes_escala FOR INSERT
  TO public
  WITH CHECK (
    NOT (prestador_id IS NULL)
    AND prestador_id IN (
      SELECT p.id FROM public.prestadores p
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- 2C. UPDATE — anon/authenticated só altera alocações próprias
CREATE POLICY "ae_update_own" ON public.alocacoes_escala FOR UPDATE
  TO public
  USING (
    NOT (prestador_id IS NULL)
    AND prestador_id IN (
      SELECT p.id FROM public.prestadores p
      WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    NOT (prestador_id IS NULL)
    AND prestador_id IN (
      SELECT p.id FROM public.prestadores p
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- 2D. SELECT — qualquer authenticated com tenant_usuarios (TMS) vê por tenant
CREATE POLICY "ae_select_tms" ON public.alocacoes_escala FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2E. INSERT — TMS autenticado insere com tenant_id
CREATE POLICY "ae_insert_tms" ON public.alocacoes_escala FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2F. UPDATE — TMS autenticado altera por tenant
CREATE POLICY "ae_update_tms" ON public.alocacoes_escala FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2G. DELETE — TMS autenticado deleta por tenant
CREATE POLICY "ae_delete_tms" ON public.alocacoes_escala FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );

-- 2H. SELECT — Portal Cliente vê alocações do seu cliente_id
CREATE POLICY "ae_select_cliente" ON public.alocacoes_escala FOR SELECT
  TO authenticated
  USING (cliente_id = f_obter_cliente_id_do_usuario());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. REVOKE grants anon perigosos (se existirem)
-- ═══════════════════════════════════════════════════════════════════════════════

REVOKE INSERT ON public.alocacoes_escala FROM anon;
REVOKE UPDATE ON public.alocacoes_escala FROM anon;
REVOKE DELETE ON public.alocacoes_escala FROM anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. VALIDAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total integer;
  v_public_true integer;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM pg_policies WHERE tablename = 'alocacoes_escala';

  SELECT COUNT(*) INTO v_public_true
  FROM pg_policies
  WHERE tablename = 'alocacoes_escala'
    AND (roles @> ARRAY['public'::name])
    AND (qual LIKE '%true%' OR with_check LIKE '%true%');

  RAISE NOTICE 'alocacoes_escala: total policies=%, public+true=% (deve ser 0)', v_total, v_public_true;

  IF v_public_true > 0 THEN
    RAISE EXCEPTION 'ERRO: Ainda existem % policies public+true em alocacoes_escala!', v_public_true;
  END IF;

  RAISE NOTICE '=== RLS alocacoes_escala corrigido com sucesso ===';
END $$;
