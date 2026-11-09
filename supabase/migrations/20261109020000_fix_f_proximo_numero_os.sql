-- ============================================================================
-- FIX — ERRO NA CONVERSÃO COTAÇÃO → OS ("Não foi possível abrir a OS agora")
-- Data: 2026-11-09
--
-- Causa: a RPC `f_cotacao_detalhes_para_os` (Lote 1) chama
-- `public.f_proximo_numero_os()`, mas a migration
-- `20261102000000_os_numero_sequencial.sql` NUNCA foi aplicada em produção.
-- Sem a função, a RPC cai no EXCEPTION e devolve erro (o browser ainda
-- registra 401s de requests concorrentes).
--
-- Esta migration cria APENAS a sequence + função de numeração — NÃO
-- reescreve `f_cotacao_detalhes_para_os` (para não regredir as correções
-- de fuso/cliente/endereço/status do Lote 1).
--
-- Idempotente: CREATE SEQUENCE IF NOT EXISTS + CREATE OR REPLACE.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq
  AS bigint
  START WITH 1200
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.f_proximo_numero_os()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'OS-' ||
         to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYYMM') ||
         '-' ||
         lpad(nextval('public.os_numero_seq')::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.f_proximo_numero_os() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_proximo_numero_os() TO authenticated;

-- A função é chamada apenas dentro de RPC SECURITY DEFINER; o anon não
-- precisa de EXECUTE direto. O reload garante que o PostgREST reconheça.
NOTIFY pgrst, 'reload schema';
