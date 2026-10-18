-- ============================================================================
-- TMS-FIN-PROG-05D.6A — RLS UPDATE do TMS em public.pagamentos_prestadores
-- ----------------------------------------------------------------------------
-- OBJETIVO: permitir UPDATE seguro pelo TMS (preparacao do gate da Conferencia),
--           sem ampliar acesso do APP/prestador e sem alterar dados financeiros.
--
-- BASE: 05D.4 criou pp_select_tms (isolamento por tenant derivado via
--       f_pp_tenant_id(os_id) -> ordens_servico/alocacoes_escala.tenant_id).
--
-- DESENHO (minimo e idempotente):
--   * Apenas UPDATE. NAO altera SELECT/INSERT/DELETE.
--   * Preserva pp_update_own (prestador).
--   * USING e WITH CHECK obrigatorios (mesmo criterio de tenant).
--   * NAO desabilita RLS. NAO usa service_role. NAO concede UPDATE generico
--     (o privilegio UPDATE de authenticated JA existe no baseline; quem limita
--      as linhas e a RLS).
--   * WITH CHECK avalia a LINHA NOVA: se o os_id for alterado para um vinculo de
--     outro tenant (ou sem tenant resolvivel), o UPDATE e recusado.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS pp_update_tms ON public.pagamentos_prestadores;

CREATE POLICY pp_update_tms ON public.pagamentos_prestadores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'ativo'
        AND tu.tenant_id = public.f_pp_tenant_id(pagamentos_prestadores.os_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'ativo'
        AND tu.tenant_id = public.f_pp_tenant_id(pagamentos_prestadores.os_id)
    )
  );

COMMENT ON POLICY pp_update_tms ON public.pagamentos_prestadores IS
  'TMS-FIN-PROG-05D.6A: UPDATE do TMS restrito ao proprio tenant (os_id->OS/alocacao via f_pp_tenant_id). USING+WITH CHECK. Preserva pp_update_own.';

COMMIT;
