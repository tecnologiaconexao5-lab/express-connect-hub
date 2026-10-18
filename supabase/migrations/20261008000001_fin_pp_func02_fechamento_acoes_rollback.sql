-- =============================================================================
-- ROLLBACK — TMS-FIN-PP-FUNC-02 — AÇÕES SEGURAS DE FECHAMENTO DO PRESTADOR
-- Remove as 3 RPCs criadas pela migration forward correspondente.
-- (Funções eram NOVAS; não existiam versões anteriores a restaurar.)
-- =============================================================================

DROP FUNCTION IF EXISTS public.f_conferir_fechamento(uuid, text);
DROP FUNCTION IF EXISTS public.f_aprovar_fechamento(uuid, text);
DROP FUNCTION IF EXISTS public.f_cancelar_fechamento(uuid, text);
