-- ============================================================================
-- TMS-FIN-PROG-05D.6B — ROLLBACK
-- Remove a RPC de aprovacao.
-- ============================================================================
BEGIN;

DROP FUNCTION IF EXISTS public.f_aprovar_pagamento_prestadores(uuid[]);

COMMIT;
