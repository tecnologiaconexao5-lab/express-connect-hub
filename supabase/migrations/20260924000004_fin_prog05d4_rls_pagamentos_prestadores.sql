-- ============================================================================
-- TMS-FIN-PROG-05D.4 — RLS SELECT do TMS em public.pagamentos_prestadores
-- ----------------------------------------------------------------------------
-- PROBLEMA (provado na 05D.3):
--   pagamentos_prestadores possuia SOMENTE policies *_own ligadas a
--   prestadores.auth_user_id = auth.uid(); o usuario financeiro do TMS recebia [].
--
-- DESENHO (minimo e idempotente):
--   * Apenas SELECT. NAO altera INSERT/UPDATE/DELETE.
--   * NAO remove as policies *_own do APP/prestador.
--   * NAO desabilita RLS. NAO usa service_role.
--   * Isolamento por TENANT: a tabela nao possui coluna tenant_id, portanto o
--     tenant do registro e derivado pelo vinculo SEGURO os_id ->
--     ordens_servico / alocacoes_escala (ambas com tenant_id).
--   * A resolucao do tenant e feita por helper SECURITY DEFINER
--     public.f_pp_tenant_id(uuid), que LE SOMENTE o tenant do os_id e nao
--     dispara RLS de terceiros (evita a fragilidade pre-existente de
--     os_select_cliente, que faz cast de cliente_id TEXT para uuid).
--   * Linhas sem vinculo resolvivel (os_id nulo / sem OS-alocacao) tem tenant
--     NULL e NAO sao visiveis ao TMS (default seguro).
-- ============================================================================

BEGIN;

-- Helper: resolve o tenant do registro pelo os_id (bypassa RLS de terceiros).
CREATE OR REPLACE FUNCTION public.f_pp_tenant_id(p_os_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (SELECT os.tenant_id FROM public.ordens_servico os WHERE os.id = p_os_id),
    (SELECT ae.tenant_id FROM public.alocacoes_escala ae WHERE ae.id = p_os_id)
  );
$fn$;

REVOKE ALL ON FUNCTION public.f_pp_tenant_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_pp_tenant_id(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS pp_select_tms ON public.pagamentos_prestadores;

CREATE POLICY pp_select_tms ON public.pagamentos_prestadores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'ativo'
        AND tu.tenant_id = public.f_pp_tenant_id(pagamentos_prestadores.os_id)
    )
  );

COMMENT ON POLICY pp_select_tms ON public.pagamentos_prestadores IS
  'TMS-FIN-PROG-05D.4: leitura TMS somente do proprio tenant (os_id->OS/alocacao via f_pp_tenant_id). Preserva pp_select_own.';

COMMIT;
