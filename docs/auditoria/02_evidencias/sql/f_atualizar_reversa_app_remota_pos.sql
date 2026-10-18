CREATE OR REPLACE FUNCTION public.f_atualizar_reversa_app(p_alocacao_id uuid, p_reversa_status text DEFAULT NULL::text, p_reversa_qtd_coletada integer DEFAULT NULL::integer, p_reversa_motivo_divergencia text DEFAULT NULL::text, p_reversa_responsavel text DEFAULT NULL::text, p_reversa_telefone text DEFAULT NULL::text, p_reversa_data_realizada date DEFAULT NULL::date, p_reversa_fotos jsonb DEFAULT NULL::jsonb, p_reversa_assinatura_url text DEFAULT NULL::text, p_reversa_latitude numeric DEFAULT NULL::numeric, p_reversa_longitude numeric DEFAULT NULL::numeric, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
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
  -- 1. Autenticação via auth.uid()
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- 2. Validar p_auth_user_id se fornecido (defesa em profundidade)
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'AUTH_USER_ID_INVALIDO');
  END IF;

  -- 3. Vincular prestador via auth.uid()
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;

  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  -- 4. Carregar alocação
  SELECT * INTO v_alocacao FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Alocação não encontrada');
  END IF;

  -- 5. Verificar pertencimento (alocação pertence ao prestador autenticado?)
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;

  v_os_id := v_alocacao.ordem_servico_id;
  v_qtd_prevista := COALESCE(v_alocacao.reversa_qtd_volumes, 0);
  v_qtd_faturar := COALESCE(p_reversa_qtd_coletada, v_alocacao.reversa_qtd_coletada, v_qtd_prevista, 0);

  -- Divergência
  IF p_reversa_qtd_coletada IS NOT NULL AND v_qtd_prevista > 0 THEN
    v_divergencia_num := p_reversa_qtd_coletada - v_qtd_prevista;
    v_divergencia := CASE WHEN v_divergencia_num = 0 THEN 'sem_divergencia'
      WHEN v_divergencia_num < 0 THEN 'faltante' ELSE 'excedente' END;
  END IF;

  -- Evento de timeline
  v_evento_tipo := CASE
    WHEN p_reversa_status = 'em_coleta' THEN 'reversa_iniciada'
    WHEN p_reversa_status = 'coletada' AND v_divergencia = 'sem_divergencia' THEN 'reversa_coletada'
    WHEN p_reversa_status = 'coletada' AND v_divergencia IN ('faltante','excedente') THEN 'reversa_divergente'
    WHEN p_reversa_status = 'em_devolucao' THEN 'reversa_em_devolucao'
    WHEN p_reversa_status = 'devolvida' THEN 'reversa_devolvida'
    WHEN p_reversa_status = 'divergente' THEN 'reversa_divergente'
    ELSE 'reversa_atualizada' END;

  -- Calcular valor CLIENTE (regra independente)
  v_valor_cliente := COALESCE(v_alocacao.reversa_valor_cliente, 0);
  IF p_reversa_qtd_coletada IS NOT NULL AND p_reversa_qtd_coletada > 0
     AND COALESCE(v_alocacao.reversa_valor_unitario, 0) > 0 THEN
    v_valor_cliente := v_qtd_faturar * COALESCE(v_alocacao.reversa_valor_unitario, 0);
  END IF;

  -- Calcular valor PRESTADOR (regra independente)
  v_valor_prestador := COALESCE(v_alocacao.reversa_valor_prestador, 0);

  -- Atualizar alocação
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

  -- Timeline
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

  -- Financeiro (idempotente)
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
$function$
