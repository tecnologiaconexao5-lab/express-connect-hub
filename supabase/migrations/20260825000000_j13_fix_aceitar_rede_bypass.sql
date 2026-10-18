-- AG-07J.13: Correção do bypass de elegibilidade operacional no aceite via Rede
--
-- PROBLEMA: f_aceitar_oportunidade_rede criava alocação sem validar:
--   - tipo de veículo incompatível
--   - capacidade kg/m3 insuficiente
--   - capacidade térmica (refrigerado/térmico) incompatível
--   - ajudante exigido mas não disponível
--   - prestador sem liberado_app=true
--
-- SOLUÇÃO: Adicionar gates de elegibilidade ANTES de qualquer INSERT/UPDATE.
--   O veículo avaliado é o primeiro vinculado ao prestador (prestador_vinculado).
--   Preserva assinatura, retorno e segurança (SECURITY DEFINER, search_path).
--
-- REGRAS (fail-closed, alinhadas com eligibilidadeOperacionalService.ts):
--   1. prestador.status = 'ativo' + liberado_app = true
--   2. prestador deve ter pelo menos 1 veículo vinculado ativo
--   3. tipo_veiculo compatível (match exato, lowercase+trim)
--   4. capacidade_kg >= peso OS (se ambos definidos e > 0)
--   5. capacidade_m3 >= cubagem OS (se ambos definidos e > 0)
--   6. tipo_carga compatível com carga_refrigerada/veiculo_termica da OS
--   7. carga_ajudante=true + ajudantes<=0 → bloqueia (se informação disponível)
--
-- NÃO ALTERA: assinatura da função, retorno JSONB, demais lógicas (rotas, notificações, histórico)

CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id uuid,
  p_prestador_id uuid,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_prestador_liberado BOOLEAN;
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
  -- Gates de elegibilidade
  v_veiculo RECORD;
  v_os_tipo_veiculo TEXT;
  v_os_peso NUMERIC;
  v_os_cubagem NUMERIC;
  v_os_carga_refrigerada BOOLEAN;
  v_os_veiculo_termica TEXT;
  v_os_carga_ajudante BOOLEAN;
  v_veiculo_tipo_norm TEXT;
  v_os_tipo_norm TEXT;
BEGIN
  -- ============================================================
  -- AUTH (preservado)
  -- ============================================================
  IF p_auth_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de autenticação inválido');
    END IF;
  END IF;

  -- ============================================================
  -- OPORTUNIDADE (preservado)
  -- ============================================================
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r WHERE r.id = p_oportunidade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;

  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;

  -- ============================================================
  -- GATE 1: PRESTADOR — ativo + liberado_app
  -- ============================================================
  SELECT status, liberado_app INTO v_prestador_status, v_prestador_liberado
  FROM public.prestadores WHERE id = p_prestador_id;

  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;

  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;

  IF COALESCE(v_prestador_liberado, false) = false THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está liberado para operar via app');
  END IF;

  -- ============================================================
  -- OS (preservado + extração de requisitos)
  -- ============================================================
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

  -- Requisitos da OS para gates de compatibilidade
  v_os_tipo_veiculo := LOWER(TRIM(COALESCE(v_os_record.veiculo_tipo, '')));
  v_os_peso := v_os_record.peso;
  v_os_cubagem := v_os_record.cubagem;
  v_os_carga_refrigerada := COALESCE(v_os_record.carga_refrigerada, false);
  v_os_veiculo_termica := LOWER(TRIM(COALESCE(v_os_record.veiculo_termica, 'seco')));
  v_os_carga_ajudante := COALESCE(v_os_record.carga_ajudante, false);

  -- ============================================================
  -- GATE 2: VEÍCULO — primeiro vinculado ao prestador
  -- ============================================================
  SELECT id, tipo_veiculo, capacidade_kg, capacidade_m3, tipo_carga, status
  INTO v_veiculo
  FROM public.veiculos
  WHERE prestador_vinculado = p_prestador_id
    AND status = 'disponivel'
  ORDER BY principal DESC, created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não possui veículo disponível vinculado');
  END IF;

  -- ============================================================
  -- GATE 3: TIPO DE VEÍCULO
  -- ============================================================
  IF v_os_tipo_veiculo != '' THEN
    v_veiculo_tipo_norm := LOWER(TRIM(COALESCE(v_veiculo.tipo_veiculo, '')));
    IF v_veiculo_tipo_norm = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Veículo do prestador não possui tipo definido');
    END IF;
    IF v_os_tipo_veiculo != v_veiculo_tipo_norm THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', format('Tipo de veículo incompatível. OS exige: %s. Veículo do prestador: %s', v_os_tipo_veiculo, v_veiculo_tipo_norm));
    END IF;
  END IF;

  -- ============================================================
  -- GATE 4: CAPACIDADE KG
  -- ============================================================
  IF COALESCE(v_os_peso, 0) > 0 AND COALESCE(v_veiculo.capacidade_kg, 0) > 0 THEN
    IF v_veiculo.capacidade_kg < v_os_peso THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', format('Capacidade insuficiente. OS: %s kg. Veículo: %s kg', v_os_peso, v_veiculo.capacidade_kg));
    END IF;
  END IF;

  -- ============================================================
  -- GATE 5: CAPACIDADE M3
  -- ============================================================
  IF COALESCE(v_os_cubagem, 0) > 0 AND COALESCE(v_veiculo.capacidade_m3, 0) > 0 THEN
    IF v_veiculo.capacidade_m3 < v_os_cubagem THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', format('Cubagem insuficiente. OS: %s m3. Veículo: %s m3', v_os_cubagem, v_veiculo.capacidade_m3));
    END IF;
  END IF;

  -- ============================================================
  -- GATE 6: CAPACIDADE TÉRMICA (REFRIGERADO / TÉRMICO)
  -- ============================================================
  IF v_os_carga_refrigerada OR v_os_veiculo_termica IN ('refrigerado', 'congelado', 'termico') THEN
    IF LOWER(TRIM(COALESCE(v_veiculo.tipo_carga, 'seco'))) = 'seco' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'OS exige capacidade térmica (refrigerado/congelado/térmico). Veículo do prestador é seco');
    END IF;
    IF LOWER(TRIM(COALESCE(v_veiculo.tipo_carga, ''))) NOT IN ('refrigerado', 'congelado', 'termico') THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', format('Capacidade térmica do veículo não compatível com OS. Veículo: %s', v_veiculo.tipo_carga));
    END IF;
  END IF;

  -- ============================================================
  -- GATE 7: AJUDANTE (se OS exige e informação disponível)
  -- ============================================================
  IF v_os_carga_ajudante THEN
    -- No aceite via Rede, alocação é criada com ajudantes=0 (padrão)
    -- Se OS exige ajudante, bloqueia aceite (prestador não declarou ajudante)
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS exige ajudante. Aceite via Rede não suporta alocação com ajudante');
  END IF;

  -- ============================================================
  -- OPERATION MODE (preservado)
  -- ============================================================
  IF v_tipo_operacao ILIKE '%multiparada%' OR v_tipo_operacao ILIKE '%e-commerce%' OR v_tipo_operacao ILIKE '%distribuição%' OR v_tipo_operacao ILIKE '%distribuicao%' THEN
    v_operation_mode := 'multi_stop_route';
  ELSIF v_tipo_reversa != 'sem_reversa' THEN
    v_operation_mode := 'reverse_logistics';
  ELSE
    v_operation_mode := 'standard_delivery';
  END IF;

  -- ============================================================
  -- ESCRITAS (preservadas — gates acima garantem compatibilidade)
  -- ============================================================
  UPDATE public.rede_oportunidades SET status = 'aceita', prestador_aceite_id = p_prestador_id, aceite_em = NOW()
  WHERE id = p_oportunidade_id;

  UPDATE public.ordens_servico SET prestador_id = p_prestador_id::TEXT, prestador = p_prestador_id,
    status = CASE WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada' ELSE v_os_status END
  WHERE id = v_os_id;

  IF EXISTS (SELECT 1 FROM public.alocacoes_escala WHERE ordem_servico_id = v_os_id) THEN
    UPDATE public.alocacoes_escala SET
      prestador_id = p_prestador_id,
      status = 'aceita',
      cliente_id = COALESCE(cliente_id, v_cliente_id),
      valor_frete = COALESCE(v_os_record.valor_cliente, 0),
      valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
      aceite_prestador = true,
      data_aceite = NOW(),
      tipo_reversa = CASE WHEN alocacoes_escala.tipo_reversa = 'sem_reversa' THEN v_tipo_reversa ELSE alocacoes_escala.tipo_reversa END,
      metadata = alocacoes_escala.metadata || jsonb_build_object('aceite_tipo', 'rede_enterprise', 'operation_mode', v_operation_mode, 'os_numero', v_os_record.numero)
    WHERE ordem_servico_id = v_os_id
    RETURNING id INTO v_alocacao_id;
  ELSE
    INSERT INTO public.alocacoes_escala (ordem_servico_id, prestador_id, cliente_id, status, data_escala, tipo_veiculo, placa, origem, destino, valor_frete, valor_repasse, km_previstos, aceite_prestador, data_aceite, tipo_reversa, observacoes, metadata)
    VALUES (v_os_id, p_prestador_id, v_cliente_id, 'aceita', COALESCE(v_os_record.data_programada, CURRENT_DATE),
      COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''), v_os_record.placa_alocada,
      CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
      CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1 THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade' ELSE v_os_record.destino END,
      COALESCE(v_os_record.valor_cliente, 0), COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
      v_os_record.distancia_km, true, NOW(), v_tipo_reversa, v_os_record.observacoes_gerais,
      jsonb_build_object('aceite_tipo', 'rede_enterprise', 'oportunidade_id', p_oportunidade_id, 'origem', 'rede_prestadores', 'operation_mode', v_operation_mode, 'tipo_operacao', v_tipo_operacao, 'os_numero', v_os_record.numero))
    RETURNING id INTO v_alocacao_id;
  END IF;

  -- ============================================================
  -- ROTAS (preservado)
  -- ============================================================
  IF v_operation_mode = 'multi_stop_route' AND v_os_record.enderecos IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.rotas WHERE os_id = v_os_id) THEN
      UPDATE public.rotas SET prestador_id = p_prestador_id, status = 'em_andamento'
      WHERE os_id = v_os_id
      RETURNING id INTO v_rota_id;
    ELSE
      INSERT INTO public.rotas (os_id, cliente_id, data_rota, status, origem, distancia_km, duracao_min, peso_total, volumes_total, prestador_id, tipo_rota, metadata)
      VALUES (v_os_id, v_cliente_id, COALESCE(v_os_record.data_programada, CURRENT_DATE), 'em_andamento',
        CASE WHEN jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
        v_os_record.distancia_km, v_os_record.tempo_minutos, v_os_record.peso, v_os_record.volumes, p_prestador_id,
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

  -- ============================================================
  -- NOTIFICAÇÕES / HISTÓRICO (preservado)
  -- ============================================================
  INSERT INTO public.portal_notificacoes (prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at)
  VALUES (p_prestador_id, 'Nova operação disponível',
    format('Você aceitou a oportunidade #%s. Operação: %s.', UPPER(SUBSTRING(v_os_id::TEXT, 1, 8)), v_operation_mode),
    'oportunidade_aceita', v_os_id, 'rede_oportunidades', false, NOW());

  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, format('Prestador aceitou via Rede [mode=%s]', v_operation_mode), 'agendada',
          CASE WHEN p_auth_user_id IS NOT NULL THEN p_auth_user_id::TEXT ELSE 'Sistema Rede' END);

  DELETE FROM public.rede_visualizacoes WHERE oportunidade_id = p_oportunidade_id AND prestador_id != p_prestador_id;

  RETURN jsonb_build_object('sucesso', true, 'os_id', v_os_id, 'alocacao_id', v_alocacao_id, 'rota_id', v_rota_id, 'prestador_id', p_prestador_id, 'operation_mode', v_operation_mode,
    'mensagem', format('Oportunidade aceita. Modo: %s. Alocação criada.', v_operation_mode));
END;
$function$;
