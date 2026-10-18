-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 133-D.4 — ROLLBACK
-- Reverte todas as correções da migration 20260722_m133d4_fix_rpc_app_security.sql
--
-- RESTAURA:
--   1. f_avancar_etapa_app_motorista → STABLE (volatilidade incorreta original)
--   2. f_atualizar_reversa_app → sem auth.uid() (validação fraca original)
--   3. Grants → PUBLIC + anon restaurados (segurança permissiva original)
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1. RESTAURAR GRANTS ORIGINAIS (PUBLIC + anon)
-- =============================================================================

-- f_buscar_operacoes_motorista
REVOKE EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista(p_auth_user_id uuid) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista(p_auth_user_id uuid) TO PUBLIC, anon;

-- f_avancar_etapa_app_motorista
REVOKE EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista(
  p_alocacao_id uuid, p_etapa text, p_payload jsonb,
  p_idempotency_key text, p_auth_user_id uuid
) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista(
  p_alocacao_id uuid, p_etapa text, p_payload jsonb,
  p_idempotency_key text, p_auth_user_id uuid
) TO PUBLIC, anon;

-- f_atualizar_reversa_app
REVOKE EXECUTE ON FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id uuid, p_reversa_status text, p_reversa_qtd_coletada integer,
  p_reversa_motivo_divergencia text, p_reversa_responsavel text,
  p_reversa_telefone text, p_reversa_data_realizada date,
  p_reversa_fotos jsonb, p_reversa_assinatura_url text,
  p_reversa_latitude numeric, p_reversa_longitude numeric,
  p_auth_user_id uuid
) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id uuid, p_reversa_status text, p_reversa_qtd_coletada integer,
  p_reversa_motivo_divergencia text, p_reversa_responsavel text,
  p_reversa_telefone text, p_reversa_data_realizada date,
  p_reversa_fotos jsonb, p_reversa_assinatura_url text,
  p_reversa_latitude numeric, p_reversa_longitude numeric,
  p_auth_user_id uuid
) TO PUBLIC, anon;

-- =============================================================================
-- 2. RESTAURAR f_avancar_etapa_app_motorista → STABLE (volatilidade incorreta)
--    Corpo idêntico ao remoto (M133-D.2 hotfix), com STABLE no lugar de VOLATILE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_avancar_etapa_app_motorista(
  p_alocacao_id uuid,
  p_etapa text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL::text,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_alocacao RECORD;
  v_tenant_id UUID;
  v_os_id UUID;
  v_etapa_atual TEXT;
  v_ultima_idempotency TEXT;
  v_allowed BOOLEAN;
  v_app_meta JSONB;
  v_updated_meta JSONB;
  v_status_update TEXT;
  v_event_id UUID;
  v_evento_tipo TEXT;
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
  SELECT ae.*,
    ae.metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
    ae.metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency
  INTO v_alocacao
  FROM public.alocacoes_escala ae
  WHERE ae.id = p_alocacao_id;
  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  v_tenant_id := v_alocacao.tenant_id;
  v_os_id := v_alocacao.ordem_servico_id;
  IF v_alocacao.status IN ('cancelada', 'recusada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_CANCELADA');
  END IF;
  IF v_alocacao.status = 'concluida' OR (v_alocacao.metadata->'app_motorista'->>'servico_finalizado')::BOOLEAN = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_FINALIZADA');
  END IF;
  v_etapa_atual := COALESCE(v_alocacao.etapa_atual, '');
  v_ultima_idempotency := COALESCE(v_alocacao.ultima_idempotency, '');
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' AND p_idempotency_key = v_ultima_idempotency THEN
    RETURN jsonb_build_object('success', true, 'message', 'Etapa já registrada (idempotente).', 'etapa', p_etapa, 'idempotent', true);
  END IF;
  v_allowed := false;
  IF v_etapa_atual = '' AND p_etapa = 'viagem_aceita' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'viagem_aceita' AND p_etapa = 'cheguei_coleta' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'cheguei_coleta' AND p_etapa = 'carregamento_iniciado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'carregamento_iniciado' AND p_etapa = 'carregamento_finalizado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'carregamento_finalizado' AND p_etapa IN ('romaneio_informado', 'foto_romaneio', 'km_inicial_informado', 'saiu_em_rota') THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'romaneio_informado' AND p_etapa IN ('foto_romaneio', 'km_inicial_informado') THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'foto_romaneio' AND p_etapa = 'km_inicial_informado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'km_inicial_informado' AND p_etapa = 'saiu_em_rota' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'saiu_em_rota' AND p_etapa = 'chegou_entrega' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'chegou_entrega' AND p_etapa = 'descarregamento_iniciado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'descarregamento_iniciado' AND p_etapa = 'descarga_finalizada' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'descarga_finalizada' AND p_etapa = 'km_final_informado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'km_final_informado' AND p_etapa = 'assinatura_capturada' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'assinatura_capturada' AND p_etapa = 'pod_registrado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'pod_registrado' AND p_etapa = 'servico_finalizado' THEN v_allowed := true; END IF;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'TRANSICAO_INVALIDA', 'message', format('Transição inválida: de "%s" para "%s"', v_etapa_atual, p_etapa), 'etapa_atual', v_etapa_atual, 'etapa_solicitada', p_etapa);
  END IF;
  IF p_etapa = 'servico_finalizado' THEN
    IF NOT (v_alocacao.metadata->'app_motorista'->>'pod_registrado')::BOOLEAN = true THEN
      RETURN jsonb_build_object('success', false, 'error', 'FINALIZACAO_SEM_POD', 'message', 'Operação não pode ser finalizada sem POD registrado.');
    END IF;
  END IF;
  v_app_meta := COALESCE(v_alocacao.metadata->'app_motorista', '{}'::JSONB);
  v_app_meta := jsonb_set(v_app_meta, '{etapa_atual}', to_jsonb(p_etapa));
  v_app_meta := jsonb_set(v_app_meta, '{ultima_acao}', to_jsonb(p_etapa));
  v_app_meta := jsonb_set(v_app_meta, '{atualizado_por_app}', 'true'::JSONB);
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    v_app_meta := jsonb_set(v_app_meta, '{ultima_idempotency}', to_jsonb(p_idempotency_key));
  END IF;
  IF p_payload IS NOT NULL AND p_payload <> '{}'::JSONB THEN
    v_app_meta := v_app_meta || p_payload;
  END IF;
  v_updated_meta := COALESCE(v_alocacao.metadata, '{}'::JSONB);
  v_updated_meta := jsonb_set(v_updated_meta, '{app_motorista}', v_app_meta);
  v_status_update := NULL;
  IF p_etapa = 'viagem_aceita' THEN v_status_update := 'aceita';
  ELSIF p_etapa = 'cheguei_coleta' THEN v_status_update := 'em_rota';
  ELSIF p_etapa = 'servico_finalizado' THEN v_status_update := 'concluida';
  END IF;
  UPDATE public.alocacoes_escala SET
    metadata = v_updated_meta, status = COALESCE(v_status_update, status),
    aceite_prestador = CASE WHEN p_etapa = 'viagem_aceita' THEN true ELSE aceite_prestador END,
    data_aceite = CASE WHEN p_etapa = 'viagem_aceita' THEN NOW() ELSE data_aceite END,
    horario_inicio_real = CASE WHEN p_etapa = 'cheguei_coleta' THEN NOW() ELSE horario_inicio_real END,
    horario_fim_real = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE horario_fim_real END,
    finalizada = CASE WHEN p_etapa = 'servico_finalizado' THEN true ELSE finalizada END,
    data_finalizacao = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE data_finalizacao END,
    updated_at = NOW()
  WHERE id = p_alocacao_id AND prestador_id = v_prestador_id;
  v_evento_tipo := CASE
    WHEN p_etapa = 'viagem_aceita' THEN 'operation_accepted'
    WHEN p_etapa = 'cheguei_coleta' THEN 'arrived_pickup'
    WHEN p_etapa = 'carregamento_iniciado' THEN 'loading_started'
    WHEN p_etapa = 'carregamento_finalizado' THEN 'loading_finished'
    WHEN p_etapa = 'romaneio_informado' THEN 'romaneio_informado'
    WHEN p_etapa = 'foto_romaneio' THEN 'romaneio_foto'
    WHEN p_etapa = 'km_inicial_informado' THEN 'km_registered'
    WHEN p_etapa = 'saiu_em_rota' THEN 'route_started'
    WHEN p_etapa = 'chegou_entrega' THEN 'arrived_delivery'
    WHEN p_etapa = 'descarregamento_iniciado' THEN 'unloading_started'
    WHEN p_etapa = 'descarga_finalizada' THEN 'unloading_finished'
    WHEN p_etapa = 'km_final_informado' THEN 'km_final'
    WHEN p_etapa = 'assinatura_capturada' THEN 'signature_captured'
    WHEN p_etapa = 'pod_registrado' THEN 'pod_sent'
    WHEN p_etapa = 'servico_finalizado' THEN 'operation_finished'
    ELSE p_etapa
  END;
  v_event_id := gen_random_uuid();
  INSERT INTO public.eventos_oficiais (id, tenant_id, event_type, entity_type, entity_id, entity_number, status, source, created_by, visibility, payload, metadata, created_at, processed_at, version, retry_count) VALUES (v_event_id, v_tenant_id, v_evento_tipo, 'alocacao', p_alocacao_id, v_os_id::TEXT, COALESCE(v_status_update, 'em_andamento'), 'app_motorista', v_prestador_id, 'internal', jsonb_build_object('etapa', p_etapa, 'etapa_anterior', v_etapa_atual, 'payload', p_payload, 'idempotency_key', p_idempotency_key), jsonb_build_object('app_motorista', v_app_meta, 'prestador_id', v_prestador_id), NOW(), NULL, '1.0', 0);
  INSERT INTO public.operation_timeline_events (id, operation_id, driver_id, type, title, metadata, event_time, created_at) VALUES (v_event_id, p_alocacao_id::TEXT, v_prestador_id::TEXT, v_evento_tipo, p_etapa, jsonb_build_object('etapa', p_etapa, 'payload', p_payload), NOW(), NOW());
  RETURN jsonb_build_object('success', true, 'message', 'Etapa avançada com sucesso.', 'etapa', p_etapa, 'etapa_anterior', v_etapa_atual, 'status', COALESCE(v_status_update, v_alocacao.status), 'event_id', v_event_id, 'idempotent', false);
END;
$function$;

COMMENT ON FUNCTION public.f_avancar_etapa_app_motorista IS
  'ROLLBACK M133-D.4 — STABLE (volatilidade incorreta original). Grants: PUBLIC+anon.';

-- =============================================================================
-- 3. RESTAURAR f_atualizar_reversa_app — SEM auth.uid() (versão insegura original)
--    Assinatura: date + jsonb (preservada)
--    Auth: lookup fraco em auth.users (sem cruzar com prestador)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id uuid,
  p_reversa_status text DEFAULT NULL::text,
  p_reversa_qtd_coletada integer DEFAULT NULL::integer,
  p_reversa_motivo_divergencia text DEFAULT NULL::text,
  p_reversa_responsavel text DEFAULT NULL::text,
  p_reversa_telefone text DEFAULT NULL::text,
  p_reversa_data_realizada date DEFAULT NULL::date,
  p_reversa_fotos jsonb DEFAULT NULL::jsonb,
  p_reversa_assinatura_url text DEFAULT NULL::text,
  p_reversa_latitude numeric DEFAULT NULL::numeric,
  p_reversa_longitude numeric DEFAULT NULL::numeric,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alocacao RECORD;
  v_qtd_prevista INTEGER;
  v_divergencia TEXT;
  v_divergencia_num INTEGER;
  v_evento_tipo TEXT;
  v_valor_cliente NUMERIC;
  v_valor_prestador NUMERIC;
  v_os_id UUID;
  v_qtd_faturar INTEGER;
BEGIN
  IF p_auth_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário inválido');
    END IF;
  END IF;
  SELECT * INTO v_alocacao FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Alocação não encontrada');
  END IF;
  v_os_id := v_alocacao.ordem_servico_id;
  v_qtd_prevista := COALESCE(v_alocacao.reversa_qtd_volumes, 0);
  v_qtd_faturar := COALESCE(p_reversa_qtd_coletada, v_alocacao.reversa_qtd_coletada, v_qtd_prevista, 0);
  IF p_reversa_qtd_coletada IS NOT NULL AND v_qtd_prevista > 0 THEN
    v_divergencia_num := p_reversa_qtd_coletada - v_qtd_prevista;
    v_divergencia := CASE WHEN v_divergencia_num = 0 THEN 'sem_divergencia'
      WHEN v_divergencia_num < 0 THEN 'faltante' ELSE 'excedente' END;
  END IF;
  v_evento_tipo := CASE
    WHEN p_reversa_status = 'em_coleta' THEN 'reversa_iniciada'
    WHEN p_reversa_status = 'coletada' AND v_divergencia = 'sem_divergencia' THEN 'reversa_coletada'
    WHEN p_reversa_status = 'coletada' AND v_divergencia IN ('faltante','excedente') THEN 'reversa_divergente'
    WHEN p_reversa_status = 'em_devolucao' THEN 'reversa_em_devolucao'
    WHEN p_reversa_status = 'devolvida' THEN 'reversa_devolvida'
    WHEN p_reversa_status = 'divergente' THEN 'reversa_divergente'
    ELSE 'reversa_atualizada' END;
  v_valor_cliente := COALESCE(v_alocacao.reversa_valor_cliente, 0);
  IF p_reversa_qtd_coletada IS NOT NULL AND p_reversa_qtd_coletada > 0
     AND COALESCE(v_alocacao.reversa_valor_unitario, 0) > 0 THEN
    v_valor_cliente := v_qtd_faturar * COALESCE(v_alocacao.reversa_valor_unitario, 0);
  END IF;
  v_valor_prestador := COALESCE(v_alocacao.reversa_valor_prestador, 0);
  UPDATE public.alocacoes_escala SET
    reversa_status = COALESCE(p_reversa_status, reversa_status),
    reversa_qtd_coletada = COALESCE(p_reversa_qtd_coletada, reversa_qtd_coletada),
    reversa_motivo_divergencia = COALESCE(p_reversa_motivo_divergencia,
      CASE WHEN v_divergencia IS NOT NULL AND v_divergencia != 'sem_divergencia' THEN
        format('Divergencia %s: %s de %s', v_divergencia, p_reversa_qtd_coletada, v_qtd_prevista)
      ELSE reversa_motivo_divergencia END),
    reversa_responsavel = COALESCE(p_reversa_responsavel, reversa_responsavel),
    reversa_telefone = COALESCE(p_reversa_telefone, reversa_telefone),
    reversa_data_realizada = COALESCE(p_reversa_data_realizada, reversa_data_realizada),
    reversa_fotos = CASE WHEN p_reversa_fotos IS NOT NULL THEN p_reversa_fotos ELSE reversa_fotos END,
    reversa_assinatura_url = COALESCE(p_reversa_assinatura_url, reversa_assinatura_url),
    reversa_latitude = COALESCE(p_reversa_latitude, reversa_latitude),
    reversa_longitude = COALESCE(p_reversa_longitude, reversa_longitude),
    reversa_realizada_em = CASE WHEN p_reversa_status IN ('coletada','devolvida','divergente','em_coleta','em_devolucao')
      THEN NOW() ELSE reversa_realizada_em END,
    reversa_valor_cliente = v_valor_cliente,
    updated_at = NOW()
  WHERE id = p_alocacao_id;
  INSERT INTO public.eventos_oficiais (event_type, entity_type, entity_id, source, payload, metadata)
  VALUES (v_evento_tipo, 'alocacao', p_alocacao_id::text, 'app_motorista',
    jsonb_build_object('message', format('Reversa: status=%s, qtd=%s/%s',
      COALESCE(p_reversa_status, ''), v_qtd_faturar, v_qtd_prevista)),
    jsonb_build_object('alocacao_id', p_alocacao_id, 'os_id', v_os_id,
      'reversa_status', COALESCE(p_reversa_status, ''),
      'qtd_prevista', v_qtd_prevista, 'qtd_coletada', p_reversa_qtd_coletada,
      'qtd_faturar', v_qtd_faturar,
      'divergencia', v_divergencia, 'divergencia_num', v_divergencia_num,
      'valor_cliente', v_valor_cliente, 'valor_prestador', v_valor_prestador));
  IF v_os_id IS NOT NULL THEN
    UPDATE public.financeiro_receber SET
      valor = COALESCE(v_alocacao.valor_frete, 0) + v_valor_cliente,
      descricao = format('Faturamento OS + Reversa (cliente: R$ %s)', v_valor_cliente::text)
    WHERE os_id = v_os_id::text;
    UPDATE public.financeiro_pagar SET
      valor = COALESCE(v_alocacao.valor_repasse, 0) + v_valor_prestador,
      descricao = format('Repasse OS + Reversa (prestador: R$ %s)', v_valor_prestador::text)
    WHERE os_id = v_os_id::text;
  END IF;
  RETURN jsonb_build_object('sucesso', true, 'alocacao_id', p_alocacao_id,
    'evento', v_evento_tipo, 'divergencia', v_divergencia,
    'qtd_prevista', v_qtd_prevista, 'qtd_coletada', p_reversa_qtd_coletada,
    'qtd_faturar', v_qtd_faturar,
    'valor_cliente', v_valor_cliente, 'valor_prestador', v_valor_prestador,
    'mensagem', format('Reversa atualizada. Cliente: R$ %s, Prestador: R$ %s',
      v_valor_cliente::text, v_valor_prestador::text));
END;
$function$;

COMMENT ON FUNCTION public.f_atualizar_reversa_app IS
  'ROLLBACK M133-D.4 — Versão sem auth.uid() (validação fraca original). Grants: PUBLIC+anon.';

-- =============================================================================
-- 4. RESTAURAR COMMENT f_buscar_operacoes_motorista
-- =============================================================================

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista IS
  'ROLLBACK M133-D.4 — Grants: PUBLIC+anon restaurados.';

-- =============================================================================
-- VALIDAÇÃO
-- =============================================================================
-- SELECT 'ROLLBACK M133-D.4 applied: f_avancar_etapa STABLE restored, f_atualizar_reversa without auth.uid restored, PUBLIC+anon grants restored.' AS status;
