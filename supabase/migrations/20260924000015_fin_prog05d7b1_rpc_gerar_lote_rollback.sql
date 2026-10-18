-- ============================================================================
-- TMS-FIN-PROG-05D.7B.1 — ROLLBACK
-- ============================================================================
BEGIN;

DROP FUNCTION IF EXISTS public.f_gerar_lote_pagamentos(uuid[]);

COMMIT;
