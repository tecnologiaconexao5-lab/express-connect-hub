-- ============================================================================
-- MISSÃO A27 — ROLLBACK da proposta
--  20260815_a27_rpc_oportunidades_para_prestador.sql
--
-- ⚠️  NÃO AUTORIZADA — PROPOSTA APENAS. NÃO EXECUTAR EM PRODUÇÃO SEM
--     AUTORIZAÇÃO EXPLÍCITA.
--
-- Restaura o estado anterior: remove a função proposta.
-- ============================================================================

DROP FUNCTION IF EXISTS public.f_buscar_oportunidades_para_prestador(uuid);

-- Grants originais não existiam para essa função (nunca criada em produção).