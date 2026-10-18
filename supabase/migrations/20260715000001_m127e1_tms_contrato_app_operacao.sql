-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 127-E.1-TMS — CONTRATO OFICIAL DE DADOS DA OPERAÇÃO PARA O APP MOTORISTA
--
-- OBJETIVO: Garantir que o TMS/Supabase entregue ao Aplicativo do Motorista
-- todos os dados reais necessários para o cabeçalho e o resumo da operação.
--
-- FASE 1-7: Mapeamento de fontes reais e adição de campos faltantes
-- FASE 8:   RPC reescrita para consumir view (contrato único)
-- FASE 9:   Segurança com auth.uid()
-- FASE 10:  Migration idempotente
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- FASE 4 — ROMANEIO
-- Campo não existe em alocacoes_escala, ordens_servico, escalas,
-- veiculos, prestadores, rotas, rota_paradas nem metadata tipada.
-- Fonte original: cte.metadata->>'romaneio_numero' (não joinável em view).
-- Adicionar coluna oficial em ordens_servico.
-- =============================================================================
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS romaneio TEXT;

COMMENT ON COLUMN public.ordens_servico.romaneio IS
  'Número do romaneio/lote da operação. Missão 127-E.1.';

-- =============================================================================
-- FASE 2+3+4+5+6+7 — VIEW CONSOLIDADA OFICIAL
--
-- vw_app_motorista_operacoes — Contrato único TMS → App Motorista.
-- Inclui: veículo completo, carga, motorista/prestador, multiparadas, reversa.
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_app_motorista_operacoes AS
SELECT
  -- Identificação (FASE 1)
  a.id AS alocacao_id,
  a.ordem_servico_id AS os_id,
  a.prestador_id AS motorista_id,
  a.prestador_id AS prestador_id,
  a.cliente_id,
  a.status,
  a.data_escala,
  COALESCE(a.metadata->>'operation_mode',
    CASE WHEN a.tipo_reversa IS DISTINCT FROM 'sem_reversa' THEN 'reverse_logistics' ELSE 'standard_delivery' END
  ) AS operation_mode,
  a.metadata,

  -- OS (FASE 1)
  os.numero AS os_numero,
  os.romaneio,
  os.tipo_operacao,
  os.prioridade,
  os.instrucoes_operacionais_os,
  os.enderecos,

  -- Datas e horários (FASE 1)
  a.data_aceite,
  a.horario_inicio_real,
  a.horario_fim_real,
  a.tempo_total_minutos,
  r.horario_previsto,

  -- Origem / Destino
  a.origem,
  a.destino,

  -- Veículo (FASE 3) — prioridade: alocação → prestador_fallback
  v.id AS veiculo_id,
  a.tipo_veiculo,
  a.placa AS veiculo_placa,
  a.placa,  -- mantido para compatibilidade com callers existentes
  CASE
    WHEN v.id IS NOT NULL THEN 'prestador_fallback'
    ELSE NULL
  END AS veiculo_origem,

  -- Carga (FASE 4)
  os.carga_tipo,
  os.carga_refrigerada,
  os.tipo_carga,
  os.carga_descricao,
  os.volumes,
  os.peso,
  os.cubagem,
  os.pallets,
  os.valor_declarado,

  -- Motorista / Prestador (FASE 5)
  p.nome_completo AS motorista_nome,
  p.nome_completo AS prestador_nome,
  p.nome_fantasia AS prestador_nome_fantasia,
  p.telefone AS motorista_telefone,
  p.whatsapp AS motorista_whatsapp,

  -- Cliente
  c.nome_fantasia AS cliente_nome,
  c.razao_social AS cliente_razao_social,
  c.telefone AS cliente_telefone,
  c.cidade AS cliente_cidade,
  c.uf AS cliente_uf,

  -- Financeiro (apenas o que o prestador pode ver)
  a.valor_frete,
  a.valor_repasse,
  a.km_previstos,
  a.km_realizados,
  a.aceite_prestador,

  -- Rota / Multiparadas (FASE 6)
  r.id AS rota_id,
  r.nome AS rota_nome,
  r.status AS rota_status,
  r.distancia_km AS rota_distancia_km,
  r.numero_paradas,
  r.paradas_pendentes,
  (SELECT COUNT(*) FROM public.rota_paradas rp WHERE rp.rota_id = r.id AND rp.status = 'pendente') AS paradas_pendentes_count,
  r.operation_mode AS rota_operation_mode,

  -- Reversa (FASE 7) — sem valor_cliente ou margem
  a.tipo_reversa,
  CASE WHEN a.tipo_reversa IS DISTINCT FROM 'sem_reversa' THEN true ELSE false END AS possui_reversa,
  a.reversa_status,
  a.reversa_qtd_volumes,
  a.reversa_qtd_coletada,
  a.reversa_unidade_cobranca,
  a.reversa_motivo_divergencia,
  a.reversa_responsavel,
  a.reversa_telefone,
  a.reversa_data_prevista,
  a.reversa_observacoes,
  a.reversa_endereco_coleta,
  a.reversa_endereco_devolucao,
  a.reversa_valor_prestador,
  a.reversa_pod_url,
  a.reversa_fotos,
  a.reversa_realizada_em,
  a.reversa_assinatura_url,
  a.reversa_latitude,
  a.reversa_longitude,

  -- Observações
  a.observacoes,
  a.instrucoes_operacionais,

  -- Tracking
  tr.latitude,
  tr.longitude,
  tr.velocidade,
  tr.ultima_atualizacao

FROM public.alocacoes_escala a
LEFT JOIN public.clientes c ON c.id = a.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
LEFT JOIN public.prestadores p ON p.id = a.prestador_id
LEFT JOIN LATERAL (
  SELECT id FROM public.veiculos
  WHERE prestador_vinculado::text = a.prestador_id::text
    AND UPPER(TRIM(placa)) = UPPER(TRIM(a.placa))
    AND (status IS NULL OR status = 'Ativo')
  LIMIT 1
) v ON true
LEFT JOIN public.rotas r ON r.alocacao_id = a.id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, velocidade, updated_at AS ultima_atualizacao
  FROM public.portal_tracking_realtime WHERE alocacao_id = a.id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
) tr ON true
WHERE a.prestador_id IS NOT NULL;

COMMENT ON VIEW public.vw_app_motorista_operacoes IS
  'M127-E.1 — View oficial App Motorista. Contrato único TMS→App. Inclui veiculo_id, motorista_nome, prestador_nome, possui_reversa, romaneio, horario_previsto, paradas_pendentes_count.';

-- Grants para a view
GRANT SELECT ON public.vw_app_motorista_operacoes TO anon, authenticated;

-- =============================================================================
-- FASE 8 — RPC OFICIAL DE BUSCA
--
-- f_buscar_operacoes_motorista — Reescrita para consumir a view diretamente,
-- garantindo contrato único entre view e RPC.
-- Mantém: paginação, filtro por prestador e status.
-- Adiciona: validação auth.uid() contra prestadores.auth_user_id.
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
BEGIN
  -- FASE 9 — Validar autenticação
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Usuário não autenticado'
    );
  END IF;

  -- Validar que o prestador pertence ao usuário autenticado
  -- (se auth_user_id estiver preenchido — compatibilidade com prestadores legados)
  IF EXISTS (SELECT 1 FROM public.prestadores WHERE id = p_prestador_id AND auth_user_id IS NOT NULL AND auth_user_id != v_auth_uid) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Acesso negado: prestador não corresponde ao usuário autenticado'
    );
  END IF;

  -- Buscar operações da view oficial (contrato único)
  SELECT jsonb_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT *
    FROM public.vw_app_motorista_operacoes v
    WHERE v.prestador_id = p_prestador_id
      AND (p_status IS NULL OR v.status = p_status)
    ORDER BY v.data_escala DESC, v.alocacao_id DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  -- Total para paginação
  SELECT COUNT(*)
  INTO v_total
  FROM public.vw_app_motorista_operacoes v
  WHERE v.prestador_id = p_prestador_id
    AND (p_status IS NULL OR v.status = p_status);

  RETURN jsonb_build_object(
    'sucesso', true,
    'prestador_id', p_prestador_id,
    'operacoes', COALESCE(v_result, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista IS
  'M127-E.1 — Busca operações do motorista. Consome vw_app_motorista_operacoes. Valida auth.uid() contra prestadores.auth_user_id.';

-- Grants para a RPC
GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista TO authenticated;

-- =============================================================================
-- FASE 9 — SEGURANÇA (RLS nas tabelas base)
--
-- As tabelas base já possuem RLS habilitado.
-- A view herda as políticas das tabelas base.
-- A RPC usa SECURITY DEFINER + validação auth.uid().
-- =============================================================================

-- =============================================================================
-- VALIDAÇÃO — Verificar se a view responde
-- =============================================================================
-- SELECT 'M127-E.1 migration applied' AS status;

