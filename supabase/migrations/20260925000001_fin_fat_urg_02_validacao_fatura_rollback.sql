-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FAT-URG-02 — ROLLBACK da RPC de validação de fatura
-- Remove apenas a função criada. NÃO altera tabelas, dados, RLS ou triggers.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
DROP FUNCTION IF EXISTS public.f_mover_fatura_status(uuid, text);
COMMIT;
