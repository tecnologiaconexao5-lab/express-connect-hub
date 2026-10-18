-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 108-E — Correção: RPC f_aceitar_oportunidade_rede cria alocacoes_escala
--
-- GAP DESCOBERTO:
--   Quando o App Motorista aceita uma oportunidade via RPC direta
--   (f_aceitar_oportunidade_rede), a alocacao_escala NUNCA era criada.
--   sincronizarComEscala() só rodava se o TMS chamasse aceitarOportunidade().
--
--   Resultado: sem alocacao → sem M104A → sem financeiro → sem Event Bus
--
-- CORREÇÃO:
--   A RPC agora cria alocacoes_escala automaticamente após aceitar.
--   Com a alocação criada, o trigger M104A dispara:
--     → financeiro_receber, financeiro_pagar, pagamentos_prestadores criados
--     → Event Bus: trg_evento_prestador_aceitou + trg_evento_alocacao_criada
--     → NOC recebe atualização
--
-- IDEMPOTENTE: Pode executar N vezes.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
  v_result JSONB;
BEGIN
  -- Verificar se oportunidade existe e está disponível
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r
  WHERE r.id = p_oportunidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;

  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro',
      format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;

  -- Verificar se prestador está ativo
  SELECT status INTO v_prestador_status FROM public.prestadores WHERE id = p_prestador_id;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;

  -- Buscar dados completos da OS
  SELECT * INTO v_os_record FROM public.ordens_servico WHERE id = v_os_id;
  IF v_os_record.status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS não pode mais receber prestador');
  END IF;
  v_os_status := v_os_record.status;

  -- ======================================================================
  -- 1. Marcar oportunidade como aceita
  -- ======================================================================
  UPDATE public.rede_oportunidades SET
    status = 'aceita',
    prestador_aceite_id = p_prestador_id,
    aceite_em = NOW()
  WHERE id = p_oportunidade_id;

  -- ======================================================================
  -- 2. Atualizar OS com prestador e status
  -- ======================================================================
  UPDATE public.ordens_servico SET
    prestador = (SELECT nome_completo FROM public.prestadores WHERE id = p_prestador_id),
    prestador_id = p_prestador_id,
    status = CASE
      WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada'
      ELSE v_os_status
    END
  WHERE id = v_os_id;

  -- ======================================================================
  -- 3. CRIAR ALOCAÇÃO NA ESCALA
  --    Este é o GAP corrigido: sem isso, App Motorista aceita mas escala
  --    nunca é criada, e financeiro/event bus nunca propagam.
  -- ======================================================================
  INSERT INTO public.alocacoes_escala (
    ordem_servico_id,
    prestador_id,
    cliente_id,
    status,
    data_escala,
    tipo_veiculo,
    placa,
    origem,
    destino,
    valor_frete,
    valor_repasse,
    km_previstos,
    aceite_prestador,
    data_aceite,
    observacoes,
    metadata
  ) VALUES (
    v_os_id,
    p_prestador_id,
    v_os_record.cliente_id,
    'aceita',
    COALESCE(v_os_record.data_programada, CURRENT_DATE),
    COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''),
    v_os_record.placa_alocada,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0
         THEN v_os_record.enderecos::jsonb->0->>'cidade'
         ELSE v_os_record.origem END,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1
         THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade'
         ELSE v_os_record.destino END,
    COALESCE(v_os_record.valor_cliente, 0),
    COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    v_os_record.distancia_km,
    true,
    NOW(),
    v_os_record.observacoes_gerais,
    jsonb_build_object(
      'aceite_tipo', 'rede_enterprise',
      'oportunidade_id', p_oportunidade_id,
      'origem', 'rede_prestadores'
    )
  )
  ON CONFLICT (ordem_servico_id) DO UPDATE SET
    prestador_id = p_prestador_id,
    status = 'aceita',
    valor_frete = COALESCE(v_os_record.valor_cliente, 0),
    valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    aceite_prestador = true,
    data_aceite = NOW(),
    metadata = alocacoes_escala.metadata || jsonb_build_object('aceite_tipo', 'rede_enterprise')
  RETURNING id INTO v_alocacao_id;

  -- ======================================================================
  -- 4. Registrar histórico na OS
  -- ======================================================================
  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, 'Prestador aceitou via Rede', 'agendada', 'Sistema Rede');

  -- ======================================================================
  -- 5. Remover visualizações de outros prestadores
  -- ======================================================================
  DELETE FROM public.rede_visualizacoes
  WHERE oportunidade_id = p_oportunidade_id
    AND prestador_id != p_prestador_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'os_id', v_os_id,
    'alocacao_id', v_alocacao_id,
    'prestador_id', p_prestador_id,
    'mensagem', 'Oportunidade aceita com sucesso. Alocação criada na escala.'
  );
END;
$$;

COMMENT ON FUNCTION public.f_aceitar_oportunidade_rede IS
  'M108E — Aceita oportunidade da Rede. Cria OS prestador + alocacao_escala + '
  'triggers M104A propagam financeiro automaticamente.';

-- Garantir que o trigger M104A existe e está ativo
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.alocacoes_escala'::regclass
    AND tgname = 'trg_propagar_financeiro_alocacao'
    AND NOT tgisinternal
) as trigger_m104a_exists;
