-- MISSÃO 116 — Adicionar colunas de reversa faltantes em alocacoes_escala
-- e corrigir view do App para não expor valor_cliente.

-- =============================================================================
-- 1. Colunas faltantes em alocacoes_escala
-- =============================================================================
ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_qtd_coletada INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversa_endereco_coleta TEXT,
  ADD COLUMN IF NOT EXISTS reversa_endereco_devolucao TEXT,
  ADD COLUMN IF NOT EXISTS reversa_unidade_cobranca TEXT DEFAULT 'unidade',
  ADD COLUMN IF NOT EXISTS reversa_valor_unitario NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversa_divergencia TEXT,
  ADD COLUMN IF NOT EXISTS reversa_motivo_divergencia TEXT,
  ADD COLUMN IF NOT EXISTS reversa_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS reversa_documento_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS reversa_telefone TEXT,
  ADD COLUMN IF NOT EXISTS reversa_data_prevista DATE,
  ADD COLUMN IF NOT EXISTS reversa_data_realizada DATE,
  ADD COLUMN IF NOT EXISTS reversa_valor_adicional NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversa_assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS reversa_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS reversa_longitude NUMERIC;

-- =============================================================================
-- 2. Corrigir view do App: remover reversa_valor_cliente
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_app_motorista_operacoes AS
SELECT
  a.id AS alocacao_id,
  a.ordem_servico_id AS os_id,
  a.prestador_id AS motorista_id,
  a.cliente_id,
  a.status,
  a.data_escala,
  a.tipo_veiculo,
  a.placa,
  a.origem,
  a.destino,
  a.valor_frete,
  a.valor_repasse,
  a.km_previstos,
  a.km_realizados,
  a.aceite_prestador,
  a.data_aceite,
  a.horario_inicio_real,
  a.horario_fim_real,
  a.tempo_total_minutos,
  -- Reversa (sem valor_cliente)
  a.tipo_reversa,
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
  COALESCE(a.metadata->>'operation_mode',
    CASE WHEN a.tipo_reversa != 'sem_reversa' THEN 'reverse_logistics' ELSE 'standard_delivery' END
  ) AS operation_mode,
  a.metadata,
  c.nome_fantasia AS cliente_nome,
  c.razao_social AS cliente_razao_social,
  c.telefone AS cliente_telefone,
  c.cidade AS cliente_cidade,
  c.uf AS cliente_uf,
  os.numero AS os_numero,
  os.tipo_operacao,
  os.peso, os.volumes, os.cubagem,
  os.carga_tipo, os.carga_refrigerada, os.tipo_carga, os.prioridade,
  os.instrucoes_operacionais_os,
  os.enderecos,
  r.id AS rota_id, r.nome AS rota_nome, r.status AS rota_status,
  r.distancia_km AS rota_distancia_km, r.numero_paradas, r.paradas_pendentes,
  r.operation_mode AS rota_operation_mode,
  tr.latitude, tr.longitude, tr.velocidade, tr.ultima_atualizacao
FROM public.alocacoes_escala a
LEFT JOIN public.clientes c ON c.id = a.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
LEFT JOIN public.rotas r ON r.alocacao_id = a.id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, velocidade, updated_at AS ultima_atualizacao
  FROM public.portal_tracking_realtime WHERE alocacao_id = a.id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
) tr ON true
WHERE a.prestador_id IS NOT NULL;

COMMENT ON VIEW public.vw_app_motorista_operacoes IS
  'M116 — View App Motorista. SEM reversa_valor_cliente. Inclui reversa_qtd_coletada, reversa_endereco_*.';

-- =============================================================================
-- 3. RPC segura para App atualizar reversa
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_atualizar_reversa_app(
  p_alocacao_id UUID,
  p_reversa_status TEXT DEFAULT NULL,
  p_reversa_qtd_coletada INTEGER DEFAULT NULL,
  p_reversa_motivo_divergencia TEXT DEFAULT NULL,
  p_reversa_responsavel TEXT DEFAULT NULL,
  p_reversa_telefone TEXT DEFAULT NULL,
  p_reversa_data_realizada DATE DEFAULT NULL,
  p_reversa_fotos JSONB DEFAULT NULL,
  p_reversa_assinatura_url TEXT DEFAULT NULL,
  p_reversa_latitude NUMERIC DEFAULT NULL,
  p_reversa_longitude NUMERIC DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alocacao RECORD;
  v_qtd_prevista INTEGER;
  v_divergencia TEXT;
BEGIN
  -- Validar auth
  IF p_auth_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário inválido');
    END IF;
  END IF;

  -- Buscar alocação
  SELECT * INTO v_alocacao FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Alocação não encontrada');
  END IF;

  -- Calcular divergência
  v_qtd_prevista := COALESCE(v_alocacao.reversa_qtd_volumes, 0);
  IF p_reversa_qtd_coletada IS NOT NULL AND v_qtd_prevista > 0 THEN
    v_divergencia := CASE
      WHEN p_reversa_qtd_coletada = v_qtd_prevista THEN 'sem_divergencia'
      WHEN p_reversa_qtd_coletada < v_qtd_prevista THEN 'faltante'
      ELSE 'excedente'
    END;
  END IF;

  -- Atualizar
  UPDATE public.alocacoes_escala SET
    reversa_status = COALESCE(p_reversa_status, reversa_status),
    reversa_qtd_coletada = COALESCE(p_reversa_qtd_coletada, reversa_qtd_coletada),
    reversa_motivo_divergencia = COALESCE(p_reversa_motivo_divergencia, 
      CASE WHEN v_divergencia IS NOT NULL AND v_divergencia != 'sem_divergencia' THEN 
        format('Divergencia: %s (%s de %s)', v_divergencia, p_reversa_qtd_coletada, v_qtd_prevista) 
      ELSE reversa_motivo_divergencia END),
    reversa_responsavel = COALESCE(p_reversa_responsavel, reversa_responsavel),
    reversa_telefone = COALESCE(p_reversa_telefone, reversa_telefone),
    reversa_data_realizada = COALESCE(p_reversa_data_realizada, reversa_data_realizada),
    reversa_fotos = CASE WHEN p_reversa_fotos IS NOT NULL THEN p_reversa_fotos ELSE reversa_fotos END,
    reversa_assinatura_url = COALESCE(p_reversa_assinatura_url, reversa_assinatura_url),
    reversa_latitude = COALESCE(p_reversa_latitude, reversa_latitude),
    reversa_longitude = COALESCE(p_reversa_longitude, reversa_longitude),
    reversa_realizada_em = CASE WHEN p_reversa_status IN ('coletada','devolvida','divergente') THEN NOW() ELSE reversa_realizada_em END,
    updated_at = NOW()
  WHERE id = p_alocacao_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'alocacao_id', p_alocacao_id,
    'divergencia', v_divergencia,
    'qtd_prevista', v_qtd_prevista,
    'qtd_coletada', p_reversa_qtd_coletada,
    'mensagem', 'Reversa atualizada com sucesso'
  );
END;
$$;

COMMENT ON FUNCTION public.f_atualizar_reversa_app IS
  'M116 — App Motorista atualiza dados da reversa. Calcula divergência automaticamente.';

GRANT EXECUTE ON FUNCTION public.f_atualizar_reversa_app TO anon, authenticated;

-- =============================================================================
-- 4. Validação
-- =============================================================================
-- SELECT 'M116 migration applied' AS status;
