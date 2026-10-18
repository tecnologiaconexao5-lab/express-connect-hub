-- =============================================================================
-- TMS-FIN-SEC-02-A6 — ROLLBACK
-- Reverte a RPC oficial e a coluna de idempotencia.
-- NAO afeta dados existentes (idempotency_key preenchida e preservada na coluna
-- somente se reaplicada; o rollback apenas remove a funcao e a coluna).
-- =============================================================================
BEGIN;

REVOKE ALL ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) FROM service_role;
DROP FUNCTION IF EXISTS public.f_criar_recebivel_manual(jsonb, text);

DROP INDEX IF EXISTS public.uq_fr_idempotency_key;
ALTER TABLE public.financeiro_receber DROP COLUMN IF EXISTS idempotency_key;

COMMIT;
