-- =============================================================================
-- E2E-05E — ROLLBACK da RPC app_s6_resolver_identidade_legada
-- Data: 2026-09-22 | Projeto: uwrvzsjtpgaifkktpepn
--
-- Remove EXATAMENTE a função criada pela migration forward, com a MESMA
-- assinatura. Não altera dados, usuários, senhas, prestadores ou HML.
-- =============================================================================

DROP FUNCTION IF EXISTS public.app_s6_resolver_identidade_legada(TEXT, TEXT);
