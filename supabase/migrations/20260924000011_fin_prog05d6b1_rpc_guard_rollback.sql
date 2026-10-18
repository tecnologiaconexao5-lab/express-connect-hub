-- ============================================================================
-- TMS-FIN-PROG-05D.6B.1 — ROLLBACK
-- Remove a RPC (reexecutar 20260924000008 recria a versao 05D.6B).
-- ============================================================================
BEGIN;

DROP FUNCTION IF EXISTS public.f_aprovar_pagamento_prestadores(uuid[]);

COMMIT;
