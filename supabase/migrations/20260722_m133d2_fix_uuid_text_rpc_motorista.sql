-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 133-D.2 — CORREÇÃO CIRÚRGICA UUID × TEXT EM RPCs DO APP MOTORISTA
--
-- CAUSA RAIZ:
--   3 funções contêm a expressão:
--
--     WHERE auth_user_id = v_authenticated_uid::text
--
--   auth_user_id é UUID (coluna em prestadores)
--   v_authenticated_uid é UUID (auth.uid())
--   v_authenticated_uid::text é TEXT
--
--   PostgreSQL rejeita: operator does not exist: uuid = text (SQLSTATE 42883)
--
-- FUNÇÕES AFETADAS:
--   1. f_buscar_operacoes_motorista     — Aba Operações do App
--   2. f_avancar_etapa_app_motorista    — Máquina de estados (etapas)
--   3. f_atualizar_reversa_app           — Reversa/coleta
--
-- CORREÇÃO:
--   Substituir por:  auth_user_id = v_authenticated_uid
--   Ambos UUID → operador = funciona.
--
-- SEGURANÇA:
--   SECURITY DEFINER mantido. search_path fixo mantido.
--   Grants preservados (CREATE OR REPLACE).
--   RLS inalterado.
--
-- IDEMPOTENTE: Sim (CREATE OR REPLACE FUNCTION).
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1. f_buscar_operacoes_motorista — Lista de operações do App
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista(
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_operacoes JSONB;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
  END IF;
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ae.id,
      'prestador_id', ae.prestador_id,
      'status', ae.status,
      'rota', ae.rota,
      'origem', ae.origem,
      'destino', ae.destino,
      'data_escala', ae.data_escala,
      'turno', ae.turno,
      'tipo_veiculo', ae.tipo_veiculo,
      'placa', ae.placa,
      'quantidade_paradas', ae.quantidade_paradas,
      'valor_repasse', ae.valor_repasse,
      'km_previstos', ae.km_previstos,
      'valor_km', ae.valor_km,
      'observacoes', ae.observacoes,
      'operation_mode', ae.operation_mode,
      'coleta_reversa', ae.coleta_reversa,
      'tenant_id', ae.tenant_id,
      'metadata', ae.metadata,
      'endereco_origem', ae.endereco_origem,
      'endereco_destino', ae.endereco_destino,
      'horario_saida', ae.horario_saida,
      'horario_retorno_previsto', ae.horario_retorno_previsto,
      'aceite_prestador', ae.aceite_prestador,
      'data_aceite', ae.data_aceite,
      'horario_inicio_real', ae.horario_inicio_real,
      'horario_fim_real', ae.horario_fim_real,
      'finalizada', ae.finalizada,
      'data_finalizacao', ae.data_finalizacao,
      'created_at', ae.created_at,
      'updated_at', ae.updated_at,
      'paradas', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'parada_id', rp.id,
              'sequencia', rp.sequencia,
              'destinatario', COALESCE(rp.destinatario, rp.cliente_nome, ''),
              'endereco', COALESCE(rp.endereco, ''),
              'logradouro', rp.logradouro,
              'numero', rp.numero,
              'complemento', rp.complemento,
              'bairro', rp.bairro,
              'cidade', rp.cidade,
              'uf', rp.uf,
              'cep', rp.cep,
              'referencia', rp.referencia,
              'latitude', rp.latitude,
              'longitude', rp.longitude,
              'portaria', rp.portaria,
              'doca', rp.doca,
              'procedimento_entrada', rp.procedimento_entrada,
              'procedimento_saida', rp.procedimento_saida,
              'contato_nome', rp.contato_nome,
              'contato_telefone', rp.contato_telefone,
              'pedido', rp.pedido,
              'nota_fiscal', rp.nota_fiscal,
              'peso', rp.peso,
              'volumes', rp.volumes,
              'prioridade', rp.prioridade,
              'janela_inicio', rp.janela_entrega,
              'instrucoes', rp.instrucoes,
              'status', rp.status,
              'data_prevista', rp.data_prevista
            )
            ORDER BY rp.sequencia
          )
          FROM public.rota_paradas rp
          WHERE rp.alocacao_id = ae.id
        ),
        '[]'::JSONB
      )
    )
    ORDER BY ae.data_escala DESC NULLS LAST, ae.created_at DESC
  ), '[]'::JSONB) INTO v_operacoes
  FROM public.alocacoes_escala ae
  WHERE ae.prestador_id = v_prestador_id
    AND (ae.status IS DISTINCT FROM 'cancelada')
    AND (ae.status IS DISTINCT FROM 'recusada');
  RETURN jsonb_build_object(
    'success', true,
    'operacoes', v_operacoes,
    'total', jsonb_array_length(v_operacoes)
  );
END;
$function$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista IS
  'M133-D.2 — Busca operações do motorista autenticado. Correção: removido ::text (SQLSTATE 42883).';

GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista TO authenticated, anon, service_role;

-- =============================================================================
-- 2. f_avancar_etapa_app_motorista — Máquina de estados do App
--    Fix: auth_user_id = v_authenticated_uid (UUID = UUID)
--    A função é extensa. Extraímos o prosrc remoto e aplicamos a correção.
-- =============================================================================

DO $fix_avancar_etapa$
DECLARE
  v_def TEXT;
  v_new_def TEXT;
  v_fixed BOOLEAN := false;
BEGIN
  -- Capturar a prosrc atual
  SELECT prosrc INTO v_def
  FROM pg_proc
  WHERE proname = 'f_avancar_etapa_app_motorista'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF v_def IS NULL THEN
    RAISE WARNING 'f_avancar_etapa_app_motorista não encontrada';
    RETURN;
  END IF;

  -- Verificar se ainda contém o bug
  IF position('auth_user_id = v_authenticated_uid::text' in v_def) > 0 THEN
    v_new_def := replace(v_def, 'auth_user_id = v_authenticated_uid::text', 'auth_user_id = v_authenticated_uid');
    v_fixed := true;
  ELSE
    v_new_def := v_def;
  END IF;

  IF v_fixed THEN
    -- Recriar com a prosrc corrigida
    -- Precisamos manter a assinatura original e criar do zero
    EXECUTE format($sql$
      CREATE OR REPLACE FUNCTION public.f_avancar_etapa_app_motorista(
        p_alocacao_id uuid,
        p_etapa text,
        p_payload jsonb DEFAULT '{}'::jsonb,
        p_idempotency_key text DEFAULT NULL::text,
        p_auth_user_id uuid DEFAULT NULL::uuid
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $function$
      %s
      $function$;
    $sql$, v_new_def);

    RAISE NOTICE 'f_avancar_etapa_app_motorista corrigida: ::text removido';
  ELSE
    RAISE NOTICE 'f_avancar_etapa_app_motorista: sem ::text para corrigir ou já corrigida';
  END IF;
END;
$fix_avancar_etapa$;

GRANT EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista TO authenticated, anon, service_role;

-- =============================================================================
-- 3. f_atualizar_reversa_app — Atualização de reversa/coleta
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id uuid,
  p_reversa_status text DEFAULT 'coletada'::text,
  p_reversa_qtd_coletada integer DEFAULT 0,
  p_reversa_motivo_divergencia text DEFAULT ''::text,
  p_reversa_responsavel text DEFAULT ''::text,
  p_reversa_telefone text DEFAULT ''::text,
  p_reversa_data_realizada timestamp with time zone DEFAULT now(),
  p_reversa_fotos text[] DEFAULT '{}'::text[],
  p_reversa_assinatura_url text DEFAULT ''::text,
  p_reversa_latitude numeric DEFAULT 0,
  p_reversa_longitude numeric DEFAULT 0,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_alocacao_prestador_id UUID;
  v_prev_qtd INT;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
  END IF;
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;
  SELECT ae.prestador_id, ae.reversa_qtd_volumes
  INTO v_alocacao_prestador_id, v_prev_qtd
  FROM public.alocacoes_escala ae
  WHERE ae.id = p_alocacao_id;
  IF v_alocacao_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao_prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF p_reversa_qtd_coletada < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA');
  END IF;
  IF v_prev_qtd IS NOT NULL AND v_prev_qtd <> p_reversa_qtd_coletada
     AND (p_reversa_motivo_divergencia IS NULL OR p_reversa_motivo_divergencia = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'DIVERGENCIA_SEM_JUSTIFICATIVA');
  END IF;
  UPDATE public.alocacoes_escala SET
    coleta_reversa = true,
    reversa_qtd_coletada = p_reversa_qtd_coletada,
    reversa_motivo_divergencia = p_reversa_motivo_divergencia,
    reversa_responsavel = p_reversa_responsavel,
    reversa_telefone = p_reversa_telefone,
    reversa_assinatura_url = p_reversa_assinatura_url,
    reversa_latitude = p_reversa_latitude,
    reversa_longitude = p_reversa_longitude,
    reversa_data_realizada = p_reversa_data_realizada,
    reversa_status = p_reversa_status,
    reversa_fotos = p_reversa_fotos,
    updated_at = NOW()
  WHERE id = p_alocacao_id;
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Reversa atualizada com sucesso.',
    'alocacao_id', p_alocacao_id,
    'reversa_status', p_reversa_status,
    'reversa_qtd_coletada', p_reversa_qtd_coletada
  );
END;
$function$;

COMMENT ON FUNCTION public.f_atualizar_reversa_app IS
  'M133-D.2 — Atualiza reversa/coleta. Correção: removido ::text (SQLSTATE 42883).';

GRANT EXECUTE ON FUNCTION public.f_atualizar_reversa_app TO authenticated, anon, service_role;

-- =============================================================================
-- VALIDAÇÃO
-- =============================================================================
-- SELECT 'M133-D.2 applied: 3 functions fixed (uuid = text → uuid = uuid)' AS status;
