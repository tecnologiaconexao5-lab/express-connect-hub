-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-032 — ROLLBACK da MIGRATION 1 (P0) — policy do aceite
--
-- Remove exclusivamente a policy hae_insert_prestador criada pela
-- Migration 1. Não toca em funções, grants ou outras tabelas.
--
-- ⚠️ ATENÇÃO: restaurar este rollback REINTRODUZ o 403 do aceite/recusa/
--    status via REST (fluxo do prestador). Usar apenas para reverter.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "hae_insert_prestador" ON public.historico_alocacoes_escala;

COMMIT;
