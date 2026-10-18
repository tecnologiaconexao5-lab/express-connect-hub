CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(p_oportunidade_id uuid, p_prestador_uuid uuid, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_rota_id UUID;
  v_cliente_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
  v_tipo_operacao TEXT;
  v_tipo_reversa TEXT;
  v_operation_mode TEXT;
BEGIN
  IF p_auth_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de autenticação inválido');
    END IF;
  END IF;
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r WHERE r.id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;
  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;
  SELECT status INTO v_prestador_status FROM public.prestadores WHERE id = p_prestador_uuid;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;
  SELECT * INTO v_os_record FROM public.ordens_servico WHERE id = v_os_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS vinculada não encontrada');
  END IF;
  IF v_os_record.status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS não pode mais receber prestador');
  END IF;
  v_os_status := v_os_record.status;
  v_tipo_operacao := COALESCE(v_os_record.tipo_operacao, '');
  v_tipo_reversa := COALESCE(v_os_record.tipo_reversa, 'sem_reversa');
  v_cliente_id := CASE
    WHEN v_os_record.cliente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN v_os_record.cliente_id::uuid
    ELSE NULL
  END;
  IF v_tipo_operacao ILIKE '%multiparada%' OR v_tipo_operacao ILIKE '%e-commerce%' OR v_tipo_operacao ILIKE '%distribuição%' OR v_tipo_operacao ILIKE '%distribuicao%' THEN
    v_operation_mode := 'multi_stop_route';
  ELSIF v_tipo_reversa != 'sem_reversa' THEN
    v_operation_mode := 'reverse_logistics';
  ELSE
    v_operation_mode := 'standard_delivery';
  END IF;
  UPDATE public.rede_oportunidades SET status = 'aceita', prestador_aceite_id = p_prestador_uuid, aceite_em = NOW()
  WHERE id = p_oportunidade_id;
  UPDATE public.ordens_servico SET prestador_id = p_prestador_uuid::TEXT, prestador = p_prestador_uuid,
    status = CASE WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada' ELSE v_os_status END
  WHERE id = v_os_id;
  IF EXISTS (SELECT 1 FROM public.alocacoes_escala WHERE ordem_servico_id = v_os_id) THEN
    UPDATE public.alocacoes_escala SET
      prestador_id = p_prestador_uuid,
      status = 'aceita',
      cliente_id = COALESCE(cliente_id, v_cliente_id),
      valor_frete = COALESCE(v_os_record.valor_cliente, 0),
      valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
      aceite_prestador = true,
      data_aceite = NOW(),
      tipo_reversa = CASE WHEN alocacoes_escala.tipo_reversa = 'sem_reversa' THEN v_tipo_reversa ELSE alocacoes_escala.tipo_reversa END,
      metadata = alocacoes_escala.metadata
        || jsonb_build_object('aceite_tipo', 'rede_enterprise', 'operation_mode', v_operation_mode, 'os_numero', v_os_record.numero)
        || jsonb_build_object('app_motorista',
             COALESCE(alocacoes_escala.metadata->'app_motorista', '{}'::jsonb)
             || jsonb_build_object('etapa_atual', 'viagem_aceita', 'ultima_acao', 'viagem_aceita',
                                   'aceite_em', to_jsonb(NOW())))
    WHERE ordem_servico_id = v_os_id
    RETURNING id INTO v_alocacao_id;
  ELSE
    INSERT INTO public.alocacoes_escala (ordem_servico_id, prestador_id, cliente_id, status, data_escala, tipo_veiculo, placa, origem, destino, valor_frete, valor_repasse, km_previstos, aceite_prestador, data_aceite, tipo_reversa, observacoes, metadata)
    VALUES (v_os_id, p_prestador_uuid, v_cliente_id, 'aceita', COALESCE(v_os_record.data_programada, CURRENT_DATE),
      COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''), v_os_record.placa_alocada,
      CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
      CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1 THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade' ELSE v_os_record.destino END,
      COALESCE(v_os_record.valor_cliente, 0), COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
      v_os_record.distancia_km, true, NOW(), v_tipo_reversa, v_os_record.observacoes_gerais,
      jsonb_build_object('aceite_tipo', 'rede_enterprise', 'oportunidade_id', p_oportunidade_id, 'origem', 'rede_prestadores', 'operation_mode', v_operation_mode, 'tipo_operacao', v_tipo_operacao, 'os_numero', v_os_record.numero,
        'app_motorista', jsonb_build_object('etapa_atual', 'viagem_aceita', 'ultima_acao', 'viagem_aceita', 'aceite_em', NOW())))
    RETURNING id INTO v_alocacao_id;
  END IF;
  IF v_operation_mode = 'multi_stop_route' AND v_os_record.enderecos IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.rotas WHERE os_id = v_os_id) THEN
      UPDATE public.rotas SET prestador_id = p_prestador_uuid, status = 'em_andamento'
      WHERE os_id = v_os_id
      RETURNING id INTO v_rota_id;
    ELSE
      INSERT INTO public.rotas (os_id, cliente_id, data_rota, status, origem, distancia_km, duracao_min, peso_total, volumes_total, prestador_id, tipo_rota, metadata)
      VALUES (v_os_id, v_cliente_id, COALESCE(v_os_record.data_programada, CURRENT_DATE), 'em_andamento',
        CASE WHEN jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
        v_os_record.distancia_km, v_os_record.tempo_minutos, v_os_record.peso, v_os_record.volumes, p_prestador_uuid,
        CASE WHEN v_tipo_operacao ILIKE '%refrigerado%' THEN 'refrigerada' ELSE 'seca' END,
        jsonb_build_object('operation_mode', v_operation_mode, 'alocacao_id', v_alocacao_id, 'tipo_operacao', v_tipo_operacao))
      RETURNING id INTO v_rota_id;
    END IF;
    INSERT INTO public.rota_paradas (rota_id, sequencia, cliente_nome, endereco, numero, bairro, cidade, uf, cep, latitude, longitude, peso, volumes, cubagem, temperatura, observacoes, status)
    SELECT v_rota_id, seq,
      COALESCE(e->>'nome_destinatario', e->>'nome', ''), COALESCE(e->>'logradouro', e->>'endereco', ''),
      COALESCE(e->>'numero', ''), COALESCE(e->>'bairro', ''), COALESCE(e->>'cidade', ''), COALESCE(e->>'uf', ''),
      COALESCE(e->>'cep', ''), COALESCE((e->>'latitude')::numeric, NULL), COALESCE((e->>'longitude')::numeric, NULL),
      v_os_record.peso / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      GREATEST(CEIL(COALESCE(v_os_record.volumes, 0) / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1)), 1),
      v_os_record.cubagem / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      CASE WHEN v_os_record.carga_refrigerada THEN 'refrigerada' ELSE 'seca' END,
      COALESCE(e->>'instrucoes', e->>'observacoes', ''), 'pendente'
    FROM jsonb_array_elements(v_os_record.enderecos::jsonb) WITH ORDINALITY AS e(elem, seq)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.portal_notificacoes (prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at)
  VALUES (p_prestador_uuid, 'Nova operação disponível',
    format('Você aceitou a oportunidade #%s. Operação: %s.', UPPER(SUBSTRING(v_os_id::TEXT, 1, 8)), v_operation_mode),
    'oportunidade_aceita', v_os_id, 'rede_oportunidades', false, NOW());
  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, format('Prestador aceitou via Rede [mode=%s]', v_operation_mode), 'agendada',
          CASE WHEN p_auth_user_id IS NOT NULL THEN p_auth_user_id::TEXT ELSE 'Sistema Rede' END);
  DELETE FROM public.rede_visualizacoes WHERE oportunidade_id = p_oportunidade_id AND prestador_id != p_prestador_uuid;
  RETURN jsonb_build_object('sucesso', true, 'os_id', v_os_id, 'alocacao_id', v_alocacao_id, 'rota_id', v_rota_id, 'prestador_id', p_prestador_uuid, 'operation_mode', v_operation_mode,
    'mensagem', format('Oportunidade aceita. Modo: %s. Alocação criada.', v_operation_mode));
END;
$function$
