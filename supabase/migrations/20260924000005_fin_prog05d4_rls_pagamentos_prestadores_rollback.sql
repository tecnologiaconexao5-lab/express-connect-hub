-- ============================================================================
-- TMS-FIN-PROG-05D.4 — ROLLBACK
-- Remove a policy de leitura do TMS e o helper. Restaura o estado anterior
-- (somente pp_select_own / pp_insert_own / pp_update_own).
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS pp_select_tms ON public.pagamentos_prestadores;
DROP FUNCTION IF EXISTS public.f_pp_tenant_id(uuid);

COMMIT;
