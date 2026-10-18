-- ═══════════════════════════════════════════════════════════════════════════
-- AG-07F — GATE ÚNICO DE ELEGIBILIDADE OPERACIONAL
-- Aplicar ao contrato do App: f_buscar_operacoes_motorista() não deve retornar
-- operações novas de prestador operacionalmente inelegível.
--
-- Regra (mesma do backend TS — eligibilidadeOperacionalService):
--   status autorizado (ativo/aprovado) AND liberado_app = true.
--
-- Correções AG-07J.3.1:
--   • 0-param retorna JSONB envelope { success, operacoes, total } (contrato Flutter)
--   • Ownership check em 4-param (auth.uid → prestadores.auth_user_id)
--   • REVOKE ALL em ambos overloads
--   • Exclui cancelada/recusada de operações novas
--   • Preserva em_andamento (em_rota/ocorrencia) para prestador inelegível
--     com operação já iniciada (somente aquela operação)
--
-- ⚠️ MIGRATION PENDENTE DE APLICAÇÃO — NÃO EXECUTADA NESTA MISSÃO.
-- Aplicar em ambiente controlado antes de produção.
-- ═══════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- Overload 0 parâmetros (contrato ativo do App) — JSONB envelope
-- Regra: prestador elegível → todas operações não-canceladas
--        prestador inelegível → somente em_andamento (em_rota/ocorrencia)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestador_id UUID;
  v_elegivel BOOLEAN;
  v_result JSONB;
  v_total INTEGER;
BEGIN
  -- 1. Resolver prestador autenticado
  SELECT p.id, (lower(coalesce(p.status, '')) IN ('ativo', 'aprovado') AND p.liberado_app = true)
  INTO v_prestador_id, v_elegivel
  FROM public.prestadores p
  WHERE p.auth_user_id = auth.uid();

  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRESTADOR_NAO_ENCONTRADO',
      'operacoes', '[]'::jsonb,
      'total', 0
    );
  END IF;

  IF v_elegivel IS true THEN
    -- Prestador elegível: retorna todas exceto cancelada/recusada
    SELECT COUNT(*), COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_total, v_result
    FROM (
      SELECT *
      FROM public.vw_app_motorista_operacoes v
      WHERE v.prestador_id = f_buscar_operacoes_motorista.v_prestador_id
        AND v.status NOT IN ('cancelada', 'recusada')
      ORDER BY v.data_escala DESC, v.alocacao_id DESC
    ) t;
  ELSE
    -- Prestador inelegível: somente em_andamento (preserva operação em curso)
    SELECT COUNT(*), COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_total, v_result
    FROM (
      SELECT *
      FROM public.vw_app_motorista_operacoes v
      WHERE v.prestador_id = f_buscar_operacoes_motorista.v_prestador_id
        AND v.status IN ('em_rota', 'ocorrencia')
      ORDER BY v.data_escala DESC, v.alocacao_id DESC
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'operacoes', v_result,
    'total', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista() IS
  'AG-07F/AG-07J.3.1 — Busca operações do motorista autenticado. Elegível: todas não-canceladas. Inelegível: somente em_andamento. Contrato Flutter: { success, operacoes, total }.';

-- =============================================================================
-- SEGURANÇA — REVOKE ALL em ambos overloads
-- =============================================================================
REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista() TO authenticated;

-- =============================================================================
-- Overload 4 parâmetros (legada, M127-E.1) — com ownership + gate
-- NOTA: App NÃO usa este overload (chama 0-param).
-- Preservado para compatibilidade de tooling/diagnóstico.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista(
  p_prestador_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
  v_total INTEGER;
  v_auth_uid UUID;
  v_prestador_owner UUID;
  v_elegivel BOOLEAN;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NAO_AUTENTICADO');
  END IF;

  -- Ownership check: auth.uid() deve ser o próprio prestador
  SELECT p.id, (lower(coalesce(p.status, '')) IN ('ativo', 'aprovado') AND p.liberado_app = true)
  INTO v_prestador_owner, v_elegivel
  FROM public.prestadores p
  WHERE p.id = p_prestador_id
    AND p.auth_user_id = v_auth_uid;

  IF v_prestador_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACESSO_NEGADO');
  END IF;

  IF v_elegivel IS DISTINCT FROM true THEN
    -- Inelegível: retornar somente em_andamento
    SELECT COUNT(*), COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_total, v_result
    FROM (
      SELECT *
      FROM public.vw_app_motorista_operacoes v
      WHERE v.prestador_id = p_prestador_id
        AND v.status IN ('em_rota', 'ocorrencia')
        AND (p_status IS NULL OR v.status = p_status)
      ORDER BY v.data_escala DESC, v.alocacao_id DESC
      LIMIT p_limit
      OFFSET p_offset
    ) t;

    RETURN jsonb_build_object(
      'success', true,
      'operacoes', COALESCE(v_result, '[]'::jsonb),
      'total', v_total
    );
  END IF;

  -- Elegível: todas exceto cancelada/recusada
  SELECT jsonb_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT *
    FROM public.vw_app_motorista_operacoes v
    WHERE v.prestador_id = p_prestador_id
      AND v.status NOT IN ('cancelada', 'recusada')
      AND (p_status IS NULL OR v.status = p_status)
    ORDER BY v.data_escala DESC, v.alocacao_id DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  SELECT COUNT(*)
  INTO v_total
  FROM public.vw_app_motorista_operacoes v
  WHERE v.prestador_id = p_prestador_id
    AND v.status NOT IN ('cancelada', 'recusada')
    AND (p_status IS NULL OR v.status = p_status);

  RETURN jsonb_build_object(
    'success', true,
    'operacoes', COALESCE(v_result, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista(UUID, TEXT, INTEGER, INTEGER) IS
  'AG-07F/AG-07J.3.1 — Legada (tooling/diagnóstico). Ownership check + gate elegibilidade + filtro cancelada/recusada.';

-- SEGURANÇA — REVOKE ALL no overload 4-param
REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
