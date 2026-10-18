-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 128-C.2-TMS — RESTAURAR RPC f_buscar_operacoes_motorista SEM PARÂMETROS
--
-- OBJETIVO: Criar overload de f_buscar_operacoes_motorista() sem parâmetros
-- que utiliza auth.uid() para identificar o prestador autenticado.
--
-- CAUSA RAIZ: A RPC original (M127-E.1) exige p_prestador_id UUID (obrigatório).
-- O App Motorista chama sem parâmetros → PostgREST retorna PGRST202 (sem overload
-- com 0 parâmetros no schema cache).
--
-- SOLUÇÃO: Nova overload:
--   f_buscar_operacoes_motorista() RETURNS SETOF vw_app_motorista_operacoes
--   Sem parâmetros. auth.uid() → prestadores.auth_user_id → operações.
--
-- SEGURANÇA: SECURITY DEFINER, search_path fixo, EXECUTE apenas para authenticated.
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- Overload sem parâmetros — usa auth.uid() para identificar o prestador
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()
RETURNS SETOF public.vw_app_motorista_operacoes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.*
  FROM public.vw_app_motorista_operacoes v
  WHERE v.prestador_id IN (
    SELECT p.id
    FROM public.prestadores p
    WHERE p.auth_user_id = auth.uid()
  )
  ORDER BY v.data_escala DESC, v.alocacao_id DESC;
$$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista() IS
  'M128-C.2 — Busca operações do motorista autenticado. Sem parâmetros. auth.uid() → prestadores.auth_user_id → vw_app_motorista_operacoes.';

-- =============================================================================
-- SEGURANÇA — Garantir grants corretos para AMBAS as overloads
-- =============================================================================

-- A overload com 4 parâmetros (M127-E.1) — manter grants existentes
-- (já configurados na migration M127-E.1)

-- A nova overload (0 parâmetros) — grants específicos
-- Remover acesso público/anon primeiro
REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista() FROM PUBLIC, anon;

-- Conceder EXECUTE apenas para authenticated
GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista() TO authenticated;

-- =============================================================================
-- VALIDAÇÃO
-- =============================================================================
-- SELECT 'M128-C.2 migration applied' AS status;
