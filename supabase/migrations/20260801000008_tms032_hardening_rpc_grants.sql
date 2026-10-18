-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-032 — MIGRATION 2 (HARDENING POSTERIOR) — NÃO AUTORIZADA
--
-- ⚠️ SEPARADA DA CORREÇÃO P0 (Migration 1) POR DECISÃO DE REVISÃO.
--    NÃO APLICAR. AGUARDAR AUTORIZAÇÃO EXPLÍCITA.
--
-- ESCOPO: hardening de segurança identificado na auditoria TMS-032.
--   - S1 — f_atualizar_status_parada: exigir auth.uid() + pertencimento da
--          rota/parada ao prestador + REVOKE anon/PUBLIC.
--   - S2 — f_aceitar_oportunidade_rede: exigir usuário autenticado,
--          p_auth_user_id = auth.uid() e, para prestador, aceite apenas em
--          nome próprio + REVOKE anon/PUBLIC.
--   - S9 — REVOKE anon/PUBLIC em f_atualizar_reversa_app,
--          f_registrar_notificacao_app, f_calcular_financeiro_operacao.
--
-- BASE: estado real de Produção capturado read-only em 2026-08-01
--   (scripts/tms032_readonly_rpcs.mjs). Corpos = PRODUÇÃO, não migrations
--   originais. f_atualizar_reversa_app usa timestamptz+text[] (produção);
--   corpo NÃO alterado (já valida auth.uid()), apenas grants.
--   f_avancar_etapa_app_motorista / f_buscar_operacoes_motorista já estão
--   corretas e com grants restritos em produção — NÃO incluídas aqui.
--
-- CONTRATO PRESERVADO: assinaturas idênticas às de produção; retornos
--   pt-BR preservados (sucesso/erro / success/error).
--
-- IDEMPOTENTE: Sim.
-- ROLLBACK: a Migration 1 rollback NÃO cobre esta; reverter o hardening exige
--   restaurar os corpos/grant capturados (ver seção de rollback ao final).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. S1 — f_atualizar_status_parada (MULTIPARADAS)
-- ═══════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.f_atualizar_status_parada(
  p_parada_id uuid, p_status text, p_recebedor text, p_assinatura_url text,
  p_pod_url text, p_fotos jsonb, p_ocorrencia text, p_latitude_fim numeric,
  p_longitude_fim numeric, p_volumes_entregues integer, p_observacoes text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_atualizar_status_parada(
  p_parada_id uuid, p_status text, p_recebedor text, p_assinatura_url text,
  p_pod_url text, p_fotos jsonb, p_ocorrencia text, p_latitude_fim numeric,
  p_longitude_fim numeric, p_volumes_entregues integer, p_observacoes text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.f_atualizar_status_parada(
  p_parada_id UUID,
  p_status TEXT,
  p_recebedor TEXT DEFAULT NULL,
  p_assinatura_url TEXT DEFAULT NULL,
  p_pod_url TEXT DEFAULT NULL,
  p_fotos JSONB DEFAULT '[]'::jsonb,
  p_ocorrencia TEXT DEFAULT NULL,
  p_latitude_fim NUMERIC DEFAULT NULL,
  p_longitude_fim NUMERIC DEFAULT NULL,
  p_volumes_entregues INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_rota_id UUID;
  v_parada_atual RECORD;
  v_total_paradas INTEGER;
  v_paradas_resolvidas INTEGER;
BEGIN
  -- ══════════════════════════════════════════════════════════════════
  -- VALIDAÇÃO DE AUTENTICAÇÃO (TMS-032 S1)
  -- ══════════════════════════════════════════════════════════════════
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Resolver prestador vinculado ao usuário
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;

  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  -- Validar status
  IF p_status NOT IN ('pendente', 'em_deslocamento', 'chegou', 'entregue', 'nao_entregue', 'ocorrencia', 'reentrega', 'devolucao', 'cancelada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Status inválido: %s', p_status));
  END IF;

  -- Buscar parada (inclui prestador_id da rota para validação de pertencimento)
  SELECT rp.*, r.os_id, r.alocacao_id, r.prestador_id INTO v_parada_atual
  FROM public.rota_paradas rp
  JOIN public.rotas r ON r.id = rp.rota_id
  WHERE rp.id = p_parada_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Parada não encontrada');
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- VALIDAÇÃO DE PERTENCIMENTO (TMS-032 S1)
  -- ══════════════════════════════════════════════════════════════════
  IF v_parada_atual.prestador_id IS NOT NULL
     AND v_parada_atual.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PARADA_OUTRO_PRESTADOR');
  END IF;

  IF v_parada_atual.prestador_id IS NULL THEN
    IF v_parada_atual.alocacao_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.alocacoes_escala ae
        WHERE ae.id = v_parada_atual.alocacao_id AND ae.prestador_id = v_prestador_id
      ) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'PARADA_OUTRO_PRESTADOR');
      END IF;
    ELSE
      RETURN jsonb_build_object('sucesso', false, 'erro', 'PARADA_SEM_VINCULO');
    END IF;
  END IF;

  v_rota_id := v_parada_atual.rota_id;

  -- Atualizar parada
  UPDATE public.rota_paradas SET
    status = p_status,
    recebedor = COALESCE(p_recebedor, recebedor),
    assinatura_url = COALESCE(p_assinatura_url, assinatura_url),
    pod_url = COALESCE(p_pod_url, pod_url),
    fotos = CASE WHEN jsonb_array_length(p_fotos) > 0 THEN p_fotos ELSE fotos END,
    ocorrencia = COALESCE(p_ocorrencia, ocorrencia),
    latitude_fim = COALESCE(p_latitude_fim, latitude_fim),
    longitude_fim = COALESCE(p_longitude_fim, longitude_fim),
    volumes_entregues = COALESCE(p_volumes_entregues, volumes_entregues),
    data_hora = CASE WHEN p_status IN ('entregue', 'nao_entregue', 'ocorrencia') THEN NOW() ELSE data_hora END,
    data_entrega = CASE WHEN p_status = 'entregue' THEN NOW() ELSE data_entrega END,
    observacoes = COALESCE(p_observacoes, observacoes)
  WHERE id = p_parada_id;

  -- Recalcular contagem de paradas pendentes na rota
  SELECT COUNT(*) INTO v_total_paradas FROM public.rota_paradas WHERE rota_id = v_rota_id;
  SELECT COUNT(*) INTO v_paradas_resolvidas FROM public.rota_paradas
    WHERE rota_id = v_rota_id AND status IN ('entregue', 'nao_entregue', 'cancelada', 'devolucao');

  -- Atualizar rota
  UPDATE public.rotas SET
    numero_paradas = v_total_paradas,
    paradas_pendentes = v_total_paradas - v_paradas_resolvidas,
    status = CASE
      WHEN v_paradas_resolvidas >= v_total_paradas THEN 'concluida'
      WHEN p_status = 'em_deslocamento' THEN 'em_andamento'
      ELSE status
    END,
    horario_realizado = CASE WHEN v_paradas_resolvidas >= v_total_paradas THEN NOW() ELSE horario_realizado END
  WHERE id = v_rota_id;

  -- Se a rota foi concluída, atualizar alocação e OS
  IF v_paradas_resolvidas >= v_total_paradas AND v_parada_atual.alocacao_id IS NOT NULL THEN
    UPDATE public.alocacoes_escala SET
      status = 'concluida',
      finalizada = true,
      data_finalizacao = NOW()
    WHERE id = v_parada_atual.alocacao_id
      AND prestador_id = v_prestador_id;

    IF v_parada_atual.os_id IS NOT NULL THEN
      UPDATE public.ordens_servico SET
        status = 'finalizada'
      WHERE id = v_parada_atual.os_id;
    END IF;
  END IF;

  -- Histórico
  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (
    COALESCE(v_parada_atual.os_id, v_parada_atual.alocacao_id),
    format('Parada %s: %s (seq %s)', p_parada_id, p_status, v_parada_atual.sequencia),
    p_status,
    'App Motorista'
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'parada_id', p_parada_id,
    'rota_id', v_rota_id,
    'status', p_status,
    'paradas_pendentes', v_total_paradas - v_paradas_resolvidas,
    'total_paradas', v_total_paradas,
    'rota_concluida', v_paradas_resolvidas >= v_total_paradas
  );
END;
$$;

COMMENT ON FUNCTION public.f_atualizar_status_parada IS
  'TMS-032 S1 — Atualiza status de parada individual. Exige auth.uid() + pertencimento da rota/parada ao prestador. Recalcula pendências na rota. Se todas resolvidas, conclui rota + alocação + OS. Grants: authenticated + service_role.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. S2 — f_aceitar_oportunidade_rede (ACEITE VIA REDE)
-- ═══════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id uuid, p_prestador_uuid uuid, p_auth_user_id uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id uuid, p_prestador_uuid uuid, p_auth_user_id uuid
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_uuid UUID,
  p_auth_user_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_authenticated_uid UUID;
  v_call_prestador_id UUID;
  v_is_tms BOOLEAN;
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
  v_tipo_operacao TEXT;
  v_tipo_reversa TEXT;
  v_operation_mode TEXT;
  v_rota_id UUID;
BEGIN
  -- ══════════════════════════════════════════════════════════════════
  -- VALIDAÇÃO DE AUTENTICAÇÃO (TMS-032 S2)
  -- ══════════════════════════════════════════════════════════════════
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- p_auth_user_id, quando informado, deve ser o próprio usuário autenticado
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'AUTH_USER_ID_INVALIDO');
  END IF;

  -- Determinar o tipo de chamador: prestador vinculado OU usuário TMS
  SELECT id INTO v_call_prestador_id
  FROM public.prestadores WHERE auth_user_id = v_authenticated_uid;

  SELECT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
    WHERE tu.user_id = v_authenticated_uid AND tu.status = 'ativo'
  ) INTO v_is_tms;

  IF v_call_prestador_id IS NULL AND NOT v_is_tms THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'SEM_PERMISSAO_ACEITE');
  END IF;

  -- Chamador prestador só pode aceitar em nome dele mesmo
  IF v_call_prestador_id IS NOT NULL AND NOT v_is_tms THEN
    IF p_prestador_uuid IS DISTINCT FROM v_call_prestador_id THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_INVALIDO');
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
  INSERT INTO public.alocacoes_escala (ordem_servico_id, prestador_id, cliente_id, status, data_escala, tipo_veiculo, placa, origem, destino, valor_frete, valor_repasse, km_previstos, aceite_prestador, data_aceite, tipo_reversa, observacoes, metadata)
  VALUES (v_os_id, p_prestador_uuid, v_os_record.cliente_id, 'aceita', COALESCE(v_os_record.data_programada, CURRENT_DATE),
    COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''), v_os_record.placa_alocada,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1 THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade' ELSE v_os_record.destino END,
    COALESCE(v_os_record.valor_cliente, 0), COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    v_os_record.distancia_km, true, NOW(), v_tipo_reversa, v_os_record.observacoes_gerais,
    jsonb_build_object('aceite_tipo', 'rede_enterprise', 'oportunidade_id', p_oportunidade_id, 'origem', 'rede_prestadores', 'operation_mode', v_operation_mode, 'tipo_operacao', v_tipo_operacao))
  ON CONFLICT (ordem_servico_id) DO UPDATE SET prestador_id = p_prestador_uuid, status = 'aceita',
    valor_frete = COALESCE(v_os_record.valor_cliente, 0), valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    aceite_prestador = true, data_aceite = NOW(),
    tipo_reversa = CASE WHEN alocacoes_escala.tipo_reversa = 'sem_reversa' THEN v_tipo_reversa ELSE alocacoes_escala.tipo_reversa END,
    metadata = alocacoes_escala.metadata || jsonb_build_object('aceite_tipo', 'rede_enterprise', 'operation_mode', v_operation_mode)
  RETURNING id INTO v_alocacao_id;
  IF v_operation_mode = 'multi_stop_route' AND v_os_record.enderecos IS NOT NULL THEN
    INSERT INTO public.rotas (os_id, cliente_id, data_rota, status, origem, distancia_km, duracao_min, peso_total, volumes_total, prestador_id, tipo_rota, metadata)
    VALUES (v_os_id, v_os_record.cliente_id, COALESCE(v_os_record.data_programada, CURRENT_DATE), 'em_andamento',
      CASE WHEN jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
      v_os_record.distancia_km, v_os_record.tempo_minutos, v_os_record.peso, v_os_record.volumes, p_prestador_uuid,
      CASE WHEN v_tipo_operacao ILIKE '%refrigerado%' THEN 'refrigerada' ELSE 'seca' END,
      jsonb_build_object('operation_mode', v_operation_mode, 'alocacao_id', v_alocacao_id, 'tipo_operacao', v_tipo_operacao))
    ON CONFLICT (os_id) DO UPDATE SET prestador_id = p_prestador_uuid, status = 'em_andamento'
    RETURNING id INTO v_rota_id;
    INSERT INTO public.rota_paradas (rota_id, sequencia, cliente_nome, endereco, numero, bairro, cidade, uf, cep, latitude, longitude, peso, volumes, cubagem, temperatura, observacoes, status)
    SELECT v_rota_id, seq,
      COALESCE(e->>'nome_destinatario', e->>'nome', ''), COALESCE(e->>'logradouro', e->>'endereco', ''),
      COALESCE(e->>'numero', ''), COALESCE(e->>'bairro', ''), COALESCE(e->>'uf', ''),
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
$$;

COMMENT ON FUNCTION public.f_aceitar_oportunidade_rede IS
  'TMS-032 S2 — Aceita oportunidade da Rede. Exige auth.uid(); p_auth_user_id quando informado deve ser o usuário; chamador prestador aceita apenas em nome próprio (TMS pode aceitar por terceiros). Cria alocação + rota multiparadas + notificação. Grants: authenticated + service_role.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. S9 — GRANTS RESIDUAIS ANON/PUBLIC (corpos já corretos em produção)
-- ═══════════════════════════════════════════════════════════════════════════════

-- f_atualizar_reversa_app (assinatura real de produção: timestamptz + text[])
REVOKE EXECUTE ON FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id uuid, p_reversa_status text, p_reversa_qtd_coletada integer,
  p_reversa_motivo_divergencia text, p_reversa_responsavel text,
  p_reversa_telefone text, p_reversa_data_realizada timestamp with time zone,
  p_reversa_fotos text[], p_reversa_assinatura_url text,
  p_reversa_latitude numeric, p_reversa_longitude numeric,
  p_auth_user_id uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id uuid, p_reversa_status text, p_reversa_qtd_coletada integer,
  p_reversa_motivo_divergencia text, p_reversa_responsavel text,
  p_reversa_telefone text, p_reversa_data_realizada timestamp with time zone,
  p_reversa_fotos text[], p_reversa_assinatura_url text,
  p_reversa_latitude numeric, p_reversa_longitude numeric,
  p_auth_user_id uuid
) TO authenticated, service_role;

-- f_registrar_notificacao_app
REVOKE EXECUTE ON FUNCTION public.f_registrar_notificacao_app(
  p_prestador_id uuid, p_titulo text, p_mensagem text, p_tipo text,
  p_origem_id uuid, p_origem_tipo text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_registrar_notificacao_app(
  p_prestador_id uuid, p_titulo text, p_mensagem text, p_tipo text,
  p_origem_id uuid, p_origem_tipo text
) TO authenticated, service_role;

-- f_calcular_financeiro_operacao
REVOKE EXECUTE ON FUNCTION public.f_calcular_financeiro_operacao(
  p_alocacao_id uuid, p_modo text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f_calcular_financeiro_operacao(
  p_alocacao_id uuid, p_modo text
) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK DO HARDENING (restaura estado de produção read-only 2026-08-01):
--   1. Recriar f_atualizar_status_parada / f_aceitar_oportunidade_rede com os
--      corpos ORIGINAIS (sem auth.uid) e GRANT anon, authenticated.
--   2. GRANT EXECUTE ... TO PUBLIC, anon nas 3 RPCs de S9.
--   Obs.: os corpos originais estão documentados em
--   scripts/tms032_readonly_rpcs.mjs e no relatório TMS-032 (seção 5/9).
-- ═══════════════════════════════════════════════════════════════════════════════

COMMIT;
