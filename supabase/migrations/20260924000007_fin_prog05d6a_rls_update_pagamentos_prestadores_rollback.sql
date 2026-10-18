-- ============================================================================
-- TMS-FIN-PROG-05D.6A — ROLLBACK
-- Remove a policy de UPDATE do TMS. Restaura o estado anterior
-- (pp_update_own + pp_select_own + pp_select_tms + pp_insert_own).
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS pp_update_tms ON public.pagamentos_prestadores;

COMMIT;
