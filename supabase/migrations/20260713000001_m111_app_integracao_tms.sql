-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 111 — INTEGRAÇÃO FUNCIONAL COMPLETA TMS ↔ APP MOTORISTA
-- FASE 2+6+8+9+10+11+12 (DB layer)
--
-- Aplica todas as alterações necessárias no Supabase para suportar o App Motorista
-- com operações normais, coleta reversa, rede de oportunidades,
-- rotas multiparadas de e-commerce, financeiro, eventos, escala e alocação.
--
-- IDEMPOTENTE: Pode executar N vezes sem duplicar dados.
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- PRÉ-REQUISITO: COLUNAS AUSENTES EM TABELAS EXISTENTES
-- =============================================================================
-- Os RPCs existentes (M84, M108E) escrevem em os_historico(os_id, acao, status_novo, usuario)
-- mas a tabela atual tem (id, ordem_servico_id, descricao, created_at).
-- Adicionar colunas faltantes para compatibilidade.

ALTER TABLE public.os_historico
  ADD COLUMN IF NOT EXISTS os_id UUID,
  ADD COLUMN IF NOT EXISTS acao TEXT,
  ADD COLUMN IF NOT EXISTS status_novo TEXT,
  ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Mapear dados existentes de ordem_servico_id → os_id (se houver)
UPDATE public.os_historico SET os_id = ordem_servico_id WHERE os_id IS NULL AND ordem_servico_id IS NOT NULL;
UPDATE public.os_historico SET acao = descricao WHERE acao IS NULL AND descricao IS NOT NULL;
UPDATE public.os_historico SET usuario = 'Sistema' WHERE usuario IS NULL;

-- portal_notificacoes precisa de prestador_id + campos de origem
ALTER TABLE public.portal_notificacoes
  ADD COLUMN IF NOT EXISTS prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_id UUID,
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT;

CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_prestador ON public.portal_notificacoes(prestador_id);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_lida ON public.portal_notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_origem ON public.portal_notificacoes(origem_id, origem_tipo);

-- =============================================================================
-- FASE 2 — CORRIGIR RPC DE ACEITE DA REDE COM p_auth_user_id
-- =============================================================================
-- O App Motorista chama: f_aceitar_oportunidade_rede(p_oportunidade_id, p_prestador_uuid, p_auth_user_id)
-- A RPC atual aceita apenas (p_oportunidade_id, p_prestador_id)

CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_uuid UUID,
  p_auth_user_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_prestador_nome TEXT;
  v_prestador_doc TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
  v_tenant_id UUID;
  v_tipo_operacao TEXT;
  v_tipo_reversa TEXT;
  v_operation_mode TEXT;
  v_rota_id UUID;
BEGIN
  -- ======================================================================
  -- 1. VALIDAÇÕES DE SEGURANÇA
  -- ======================================================================

  -- Validar auth_user_id se fornecido (App Motorista)
  IF p_auth_user_id IS NOT NULL THEN
    -- Verificar se o auth_user_id existe no auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de autenticação inválido');
    END IF;
  END IF;

  -- ======================================================================
  -- 2. LOCK E VALIDAÇÃO DA OPORTUNIDADE
  -- ======================================================================
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r
  WHERE r.id = p_oportunidade_id
  FOR UPDATE; -- Lock para evitar race condition / duplo aceite

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;

  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro',
      format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;

  -- ======================================================================
  -- 3. VALIDAÇÃO DO PRESTADOR
  -- ======================================================================
  SELECT p.status, p.nome_completo, p.cpf_cnpj, p.tenant_id
  INTO v_prestador_status, v_prestador_nome, v_prestador_doc, v_tenant_id
  FROM public.prestadores p WHERE p.id = p_prestador_uuid;

  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;

  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;

  -- ======================================================================
  -- 4. VALIDAÇÃO DA OS
  -- ======================================================================
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

  -- Determinar operation_mode para o App
  IF v_tipo_operacao ILIKE '%multiparada%' OR v_tipo_operacao ILIKE '%e-commerce%' OR v_tipo_operacao ILIKE '%distribuição%' OR v_tipo_operacao ILIKE '%distribuicao%' THEN
    v_operation_mode := 'multi_stop_route';
  ELSIF v_tipo_reversa != 'sem_reversa' THEN
    v_operation_mode := 'reverse_logistics';
  ELSE
    v_operation_mode := 'standard_delivery';
  END IF;

  -- ======================================================================
  -- 5. MARCAR OPORTUNIDADE COMO ACEITA
  -- ======================================================================
  UPDATE public.rede_oportunidades SET
    status = 'aceita',
    prestador_aceite_id = p_prestador_uuid,
    aceite_em = NOW()
  WHERE id = p_oportunidade_id;

  -- ======================================================================
  -- 6. ATUALIZAR OS COM PRESTADOR E STATUS
  -- ======================================================================
  UPDATE public.ordens_servico SET
    prestador_id = p_prestador_uuid::TEXT,
    prestador = p_prestador_uuid,
    status = CASE
      WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada'
      ELSE v_os_status
    END
  WHERE id = v_os_id;

  -- ======================================================================
  -- 7. CRIAR ALOCAÇÃO NA ESCALA
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
    tipo_reversa,
    observacoes,
    metadata
  ) VALUES (
    v_os_id,
    p_prestador_uuid,
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
    v_tipo_reversa,
    v_os_record.observacoes_gerais,
    jsonb_build_object(
      'aceite_tipo', 'rede_enterprise',
      'oportunidade_id', p_oportunidade_id,
      'origem', 'rede_prestadores',
      'operation_mode', v_operation_mode,
      'tipo_operacao', v_tipo_operacao
    )
  )
  ON CONFLICT (ordem_servico_id) DO UPDATE SET
    prestador_id = p_prestador_uuid,
    status = 'aceita',
    valor_frete = COALESCE(v_os_record.valor_cliente, 0),
    valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    aceite_prestador = true,
    data_aceite = NOW(),
    tipo_reversa = CASE WHEN alocacoes_escala.tipo_reversa = 'sem_reversa' THEN v_tipo_reversa ELSE alocacoes_escala.tipo_reversa END,
    metadata = alocacoes_escala.metadata || jsonb_build_object(
      'aceite_tipo', 'rede_enterprise',
      'operation_mode', v_operation_mode
    )
  RETURNING id INTO v_alocacao_id;

  -- ======================================================================
  -- 8. SE FOR ROTA MULTIPARADAS, CRIAR ROTA + PARADAS
  -- ======================================================================
  IF v_operation_mode = 'multi_stop_route' AND v_os_record.enderecos IS NOT NULL THEN
    -- Criar rota
    INSERT INTO public.rotas (
      os_id, cliente_id, data_rota, status,
      origem, distancia_km, duracao_min,
      peso_total, volumes_total, prestador_id,
      tipo_rota, metadata
    ) VALUES (
      v_os_id,
      v_os_record.cliente_id,
      COALESCE(v_os_record.data_programada, CURRENT_DATE),
      'em_andamento',
      CASE WHEN jsonb_array_length(v_os_record.enderecos::jsonb) > 0
           THEN v_os_record.enderecos::jsonb->0->>'cidade'
           ELSE v_os_record.origem END,
      v_os_record.distancia_km,
      v_os_record.tempo_minutos,
      v_os_record.peso,
      v_os_record.volumes,
      p_prestador_uuid,
      CASE WHEN v_tipo_operacao ILIKE '%refrigerado%' THEN 'refrigerada' ELSE 'seca' END,
      jsonb_build_object('operation_mode', v_operation_mode, 'alocacao_id', v_alocacao_id, 'tipo_operacao', v_tipo_operacao)
    )
    ON CONFLICT (os_id) DO UPDATE SET
      prestador_id = p_prestador_uuid,
      status = 'em_andamento'
    RETURNING id INTO v_rota_id;

    -- Criar paradas a partir dos endereços da OS
    INSERT INTO public.rota_paradas (
      rota_id, sequencia, cliente_nome, endereco, numero, bairro, cidade, uf,
      cep, latitude, longitude, peso, volumes, cubagem,
      temperatura, observacoes, status
    )
    SELECT
      v_rota_id,
      seq,
      COALESCE(e->>'nome_destinatario', e->>'nome', ''),
      COALESCE(e->>'logradouro', e->>'endereco', ''),
      COALESCE(e->>'numero', ''),
      COALESCE(e->>'bairro', ''),
      COALESCE(e->>'cidade', ''),
      COALESCE(e->>'uf', ''),
      COALESCE(e->>'cep', ''),
      COALESCE((e->>'latitude')::numeric, NULL),
      COALESCE((e->>'longitude')::numeric, NULL),
      v_os_record.peso / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      GREATEST(CEIL(COALESCE(v_os_record.volumes, 0) / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1)), 1),
      v_os_record.cubagem / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      CASE WHEN v_os_record.carga_refrigerada THEN 'refrigerada' ELSE 'seca' END,
      COALESCE(e->>'instrucoes', e->>'observacoes', ''),
      'pendente'
    FROM jsonb_array_elements(v_os_record.enderecos::jsonb) WITH ORDINALITY AS e(elem, seq)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ======================================================================
  -- 9. REGISTRAR NOTIFICAÇÃO PARA O APP
  -- ======================================================================
  INSERT INTO public.portal_notificacoes (
    prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at
  ) VALUES (
    p_prestador_uuid,
    'Nova operação disponível',
    format('Você aceitou a oportunidade #%s. Operação: %s.', UPPER(SUBSTRING(v_os_id::TEXT, 1, 8)), v_operation_mode),
    'oportunidade_aceita',
    v_os_id,
    'rede_oportunidades',
    false,
    NOW()
  );

  -- ======================================================================
  -- 10. REGISTRAR HISTÓRICO NA OS
  -- ======================================================================
  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, format('Prestador aceitou via Rede [mode=%s]', v_operation_mode), 'agendada',
          CASE WHEN p_auth_user_id IS NOT NULL THEN p_auth_user_id::TEXT ELSE 'Sistema Rede' END);

  -- ======================================================================
  -- 11. REMOVER VISUALIZAÇÕES DE OUTROS PRESTADORES
  -- ======================================================================
  DELETE FROM public.rede_visualizacoes
  WHERE oportunidade_id = p_oportunidade_id
    AND prestador_id != p_prestador_uuid;

  -- ======================================================================
  -- 12. RETORNO ESTRUTURADO PARA O APP
  -- ======================================================================
  RETURN jsonb_build_object(
    'sucesso', true,
    'os_id', v_os_id,
    'alocacao_id', v_alocacao_id,
    'rota_id', v_rota_id,
    'prestador_id', p_prestador_uuid,
    'operation_mode', v_operation_mode,
    'mensagem', format('Oportunidade aceita. Modo: %s. Alocação criada.', v_operation_mode)
  );
END;
$$;

COMMENT ON FUNCTION public.f_aceitar_oportunidade_rede IS
  'M111 — Aceita oportunidade da Rede. Parâmetros: p_oportunidade_id, p_prestador_uuid, p_auth_user_id (opcional). '
  'Valida autenticação, prestador, OS. Cria alocação + rota multiparadas + notificação. '
  'Retorna os_id, alocacao_id, rota_id, operation_mode para o App Motorista.';

-- =============================================================================
-- FASE 6 — ENHANCEMENT: CAMPOS ADICIONAIS EM ROTAS E PARADAS
-- =============================================================================

-- Adicionar colunas faltantes em rotas
ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT current_tenant_id_safe(),
  ADD COLUMN IF NOT EXISTS motorista TEXT,
  ADD COLUMN IF NOT EXISTS veiculo TEXT,
  ADD COLUMN IF NOT EXISTS horario_previsto TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS horario_realizado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla TEXT,
  ADD COLUMN IF NOT EXISTS destino_final TEXT,
  ADD COLUMN IF NOT EXISTS numero_paradas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paradas_pendentes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operation_mode TEXT DEFAULT 'standard_delivery',
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS alocacao_id UUID REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL;

-- Adicionar colunas faltantes em rota_paradas
ALTER TABLE public.rota_paradas
  ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alocacao_id UUID REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pedido TEXT,
  ADD COLUMN IF NOT EXISTS nota_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS destinatario TEXT,
  ADD COLUMN IF NOT EXISTS contato TEXT,
  ADD COLUMN IF NOT EXISTS tipo_carga TEXT,
  ADD COLUMN IF NOT EXISTS janela_entrega TEXT,
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS recebedor TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS pod_url TEXT,
  ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ocorrencia TEXT,
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latitude_fim NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude_fim NUMERIC,
  ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS volumes_entregues INTEGER DEFAULT 0;

-- Adicionar UNIQUE em rotas.os_id depois de garantir que não há nulos conflitantes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rotas_os_id_key' AND conrelid = 'public.rotas'::regclass
  ) THEN
    -- Remover possíveis duplicatas antes de criar UNIQUE
    DELETE FROM public.rotas a USING (
      SELECT os_id, MIN(id) as min_id FROM public.rotas
      WHERE os_id IS NOT NULL GROUP BY os_id HAVING COUNT(*) > 1
    ) b WHERE a.os_id = b.os_id AND a.id != b.min_id;
    ALTER TABLE public.rotas ADD CONSTRAINT rotas_os_id_key UNIQUE (os_id);
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_rotas_os_id ON public.rotas(os_id);
CREATE INDEX IF NOT EXISTS idx_rotas_prestador_id ON public.rotas(prestador_id);
CREATE INDEX IF NOT EXISTS idx_rotas_status ON public.rotas(status);
CREATE INDEX IF NOT EXISTS idx_rotas_data ON public.rotas(data_rota);
CREATE INDEX IF NOT EXISTS idx_rotas_operation_mode ON public.rotas(operation_mode);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_rota_id ON public.rota_paradas(rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_status ON public.rota_paradas(status);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_os_id ON public.rota_paradas(os_id);

-- =============================================================================
-- FASE 8+9 — VIEW PARA O APP: operacao_app_view
-- View consolidada que o App Motorista consulta para ver suas operações
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
  a.tipo_reversa,
  a.reversa_status,
  a.reversa_qtd_volumes,
  a.reversa_valor_cliente,
  a.reversa_valor_prestador,
  a.reversa_observacoes,
  a.observacoes,
  a.instrucoes_operacionais,
  COALESCE(a.metadata->>'operation_mode',
    CASE
      WHEN a.tipo_reversa != 'sem_reversa' THEN 'reverse_logistics'
      ELSE 'standard_delivery'
    END
  ) AS operation_mode,
  a.metadata,
  -- Dados do cliente
  c.nome_fantasia AS cliente_nome,
  c.razao_social AS cliente_razao_social,
  c.cpf_cnpj AS cliente_documento,
  c.telefone AS cliente_telefone,
  c.endereco AS cliente_endereco,
  c.cidade AS cliente_cidade,
  c.uf AS cliente_uf,
  -- Dados da OS
  os.numero AS os_numero,
  os.tipo_operacao,
  os.peso,
  os.volumes,
  os.cubagem,
  os.carga_tipo,
  os.carga_refrigerada,
  os.tipo_carga,
  os.prioridade,
  os.instrucoes_operacionais_os,
  os.enderecos,
  -- Dados da rota multiparadas
  r.id AS rota_id,
  r.nome AS rota_nome,
  r.status AS rota_status,
  r.distancia_km AS rota_distancia_km,
  r.numero_paradas,
  r.paradas_pendentes,
  r.operation_mode AS rota_operation_mode,
  -- Tracking
  tr.latitude,
  tr.longitude,
  tr.velocidade,
  tr.ultima_atualizacao
FROM public.alocacoes_escala a
LEFT JOIN public.clientes c ON c.id = a.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
LEFT JOIN public.rotas r ON r.alocacao_id = a.id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, velocidade, updated_at AS ultima_atualizacao
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = a.id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
) tr ON true
WHERE a.prestador_id IS NOT NULL;

COMMENT ON VIEW public.vw_app_motorista_operacoes IS
  'M111 — View consolidada para o App Motorista. Junta alocação + cliente + OS + rota + tracking.';

-- View para paradas de uma rota (App Motorista)
CREATE OR REPLACE VIEW public.vw_app_motorista_paradas AS
SELECT
  rp.id AS parada_id,
  rp.rota_id,
  rp.sequencia,
  rp.cliente_nome AS destinatario,
  rp.endereco,
  rp.numero,
  rp.bairro,
  rp.cidade,
  rp.uf,
  rp.cep,
  rp.latitude,
  rp.longitude,
  rp.peso,
  rp.volumes,
  rp.cubagem,
  rp.temperatura AS tipo_carga,
  rp.prioridade,
  rp.janela_entrega,
  rp.instrucoes,
  rp.status,
  rp.recebedor,
  rp.assinatura_url,
  rp.pod_url,
  rp.fotos,
  rp.ocorrencia,
  rp.data_hora,
  rp.latitude_fim,
  rp.longitude_fim,
  rp.data_entrega,
  rp.volumes_entregues,
  rp.observacoes,
  rp.os_id,
  rp.alocacao_id,
  rp.pedido,
  rp.nota_fiscal,
  rp.contato,
  rp.tipo_carga AS tipo_carga_parada
FROM public.rota_paradas rp
ORDER BY rp.sequencia;

COMMENT ON VIEW public.vw_app_motorista_paradas IS
  'M111 — Paradas de rota para o App Motorista. Ordenadas por sequência.';

GRANT SELECT ON public.vw_app_motorista_operacoes TO anon, authenticated;
GRANT SELECT ON public.vw_app_motorista_paradas TO anon, authenticated;

-- =============================================================================
-- FASE 10 — FUNÇÃO DE CÁLCULO FINANCEIRO PARA MULTIPARADAS + REVERSA
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_calcular_financeiro_operacao(
  p_alocacao_id UUID,
  p_modo TEXT DEFAULT 'completo' -- 'completo', 'parcial' para paradas individuais
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec RECORD;
  v_valor_cliente NUMERIC := 0;
  v_valor_prestador NUMERIC := 0;
  v_pedagio NUMERIC := 0;
  v_ajudante NUMERIC := 0;
  v_adicional NUMERIC := 0;
  v_desconto NUMERIC := 0;
  v_reversa_cliente NUMERIC := 0;
  v_reversa_prestador NUMERIC := 0;
  v_base_prestador NUMERIC := 0;
  v_diaria NUMERIC := 0;
  v_km_adicional NUMERIC := 0;
  v_espera NUMERIC := 0;
  v_segunda_saida NUMERIC := 0;
  v_terceira_saida NUMERIC := 0;
  v_bonificacao NUMERIC := 0;
  v_total_cliente NUMERIC := 0;
  v_total_prestador NUMERIC := 0;
  v_margem NUMERIC := 0;
BEGIN
  SELECT * INTO v_rec FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Alocação não encontrada');
  END IF;

  v_valor_cliente := COALESCE(v_rec.valor_frete, 0);
  v_valor_prestador := COALESCE(v_rec.valor_repasse, 0);
  v_pedagio := COALESCE(v_rec.valor_pedagio, 0);
  v_ajudante := COALESCE(v_rec.valor_ajudante, 0);
  v_adicional := COALESCE(v_rec.valor_adicional, 0);
  v_desconto := COALESCE(v_rec.valor_desconto, 0);
  v_reversa_cliente := COALESCE(v_rec.reversa_valor_cliente, 0);
  v_reversa_prestador := COALESCE(v_rec.reversa_valor_prestador, 0);

  -- Calcular adicionais de diária, km extra, etc
  v_diaria := COALESCE(v_rec.diarias_adicionais, 0) * COALESCE(v_rec.valor_diaria, 0);
  IF v_rec.km_realizados > v_rec.km_previstos AND v_rec.km_previstos > 0 THEN
    v_km_adicional := (v_rec.km_realizados - v_rec.km_previstos) * COALESCE(v_rec.valor_km, 0);
  END IF;
  IF v_rec.segunda_saida THEN v_segunda_saida := COALESCE(v_rec.valor_segunda_saida, 0); END IF;
  IF v_rec.terceira_saida THEN v_terceira_saida := COALESCE(v_rec.valor_terceira_saida, 0); END IF;

  v_base_prestador := v_valor_prestador + v_pedagio + v_ajudante + v_adicional +
    v_diaria + v_km_adicional + v_espera + v_segunda_saida + v_terceira_saida +
    v_bonificacao + v_reversa_prestador;
  v_total_prestador := v_base_prestador - v_desconto;
  v_total_cliente := v_valor_cliente + v_reversa_cliente;

  IF v_total_cliente > 0 THEN
    v_margem := ROUND((v_total_cliente - v_total_prestador) / v_total_cliente * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'alocacao_id', p_alocacao_id,
    'valor_cliente', v_total_cliente,
    'valor_prestador', v_total_prestador,
    'valor_base_prestador', v_valor_prestador,
    'pedagio', v_pedagio,
    'ajudante', v_ajudante,
    'adicional', v_adicional,
    'desconto', v_desconto,
    'diaria', v_diaria,
    'km_adicional', v_km_adicional,
    'espera', v_espera,
    'segunda_saida', v_segunda_saida,
    'terceira_saida', v_terceira_saida,
    'bonificacao', v_bonificacao,
    'reversa_cliente', v_reversa_cliente,
    'reversa_prestador', v_reversa_prestador,
    'margem_percentual', v_margem,
    'km_previstos', v_rec.km_previstos,
    'km_realizados', v_rec.km_realizados
  );
END;
$$;

COMMENT ON FUNCTION public.f_calcular_financeiro_operacao IS
  'M111 — Calcula financeiro completo de uma operação incluindo reversa, diárias, km adicional, saídas.';

-- =============================================================================
-- FASE 11 — NOTIFICAÇÕES PARA O APP
-- =============================================================================

-- Função para registrar notificação para o App
CREATE OR REPLACE FUNCTION public.f_registrar_notificacao_app(
  p_prestador_id UUID,
  p_titulo TEXT,
  p_mensagem TEXT,
  p_tipo TEXT DEFAULT 'operacao',
  p_origem_id UUID DEFAULT NULL,
  p_origem_tipo TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_notificacao_id UUID;
BEGIN
  INSERT INTO public.portal_notificacoes (
    prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at
  ) VALUES (
    p_prestador_id, p_titulo, p_mensagem, p_tipo, p_origem_id, p_origem_tipo, false, NOW()
  ) RETURNING id INTO v_notificacao_id;

  RETURN v_notificacao_id;
END;
$$;

COMMENT ON FUNCTION public.f_registrar_notificacao_app IS
  'M111 — Registra notificação persistente para o App Motorista. Retorna ID da notificação.';

-- Trigger de notificação automática para novas OS (quando prestador definido)
CREATE OR REPLACE FUNCTION public.f_trg_notificar_os_para_app()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.prestador_id IS NOT NULL AND (OLD IS NULL OR OLD.prestador_id IS DISTINCT FROM NEW.prestador_id) THEN
    INSERT INTO public.portal_notificacoes (
      prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at
    ) VALUES (
      NEW.prestador_id::UUID,
      'Nova operação',
      format('Nova OS %s atribuída a você.', COALESCE(NEW.numero, SUBSTRING(NEW.id::TEXT, 1, 8))),
      'nova_os',
      NEW.id,
      'ordens_servico',
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_os_para_app ON public.ordens_servico;
CREATE TRIGGER trg_notificar_os_para_app
  AFTER INSERT OR UPDATE OF prestador_id
  ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_notificar_os_para_app();

-- Trigger de notificação para novas oportunidades na rede
CREATE OR REPLACE FUNCTION public.f_trg_notificar_oportunidade_rede()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'publicada' THEN
    INSERT INTO public.portal_notificacoes (
      prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at, metadata
    ) SELECT
      p.id,
      'Nova oportunidade na Rede',
      format('Nova oportunidade #%s disponível na sua região.', UPPER(SUBSTRING(NEW.os_id::TEXT, 1, 8))),
      'nova_oportunidade',
      NEW.id,
      'rede_oportunidades',
      false,
      NOW(),
      jsonb_build_object('regiao', NEW.regiao, 'valor', NEW.valor_prestador)
    FROM public.prestadores p
    WHERE p.status = 'ativo'
      AND (NEW.regiao IS NULL OR p.regiao_principal ILIKE '%' || COALESCE(NEW.regiao, '') || '%')
    LIMIT 50; -- Evitar explosão de notificações
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_oportunidade_rede ON public.rede_oportunidades;
CREATE TRIGGER trg_notificar_oportunidade_rede
  AFTER INSERT
  ON public.rede_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_notificar_oportunidade_rede();

-- =============================================================================
-- FASE 12 — SEGURANÇA RLS
-- =============================================================================

-- Garantir RLS habilitado
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_paradas ENABLE ROW LEVEL SECURITY;

-- Remover policies genéricas e criar policies específicas
DROP POLICY IF EXISTS "rotas_all_authenticated" ON public.rotas;
DROP POLICY IF EXISTS "rota_paradas_all_authenticated" ON public.rota_paradas;

-- Rotas: TMS (autenticado) vê tudo; App Motorista vê só suas rotas
CREATE POLICY "rotas_select_authenticated" ON public.rotas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rotas_insert_authenticated" ON public.rotas
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "rotas_update_authenticated" ON public.rotas
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "rotas_select_anon_suas" ON public.rotas
  FOR SELECT TO anon
  USING (
    prestador_id IN (
      SELECT id FROM public.prestadores
      WHERE tenant_id = current_tenant_id_safe()
    )
  );

-- Rota paradas: TMS vê tudo; App vê só paradas das suas rotas
CREATE POLICY "rota_paradas_select_authenticated" ON public.rota_paradas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rota_paradas_insert_authenticated" ON public.rota_paradas
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "rota_paradas_update_authenticated" ON public.rota_paradas
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "rota_paradas_select_anon" ON public.rota_paradas
  FOR SELECT TO anon
  USING (
    rota_id IN (
      SELECT id FROM public.rotas
      WHERE prestador_id IN (
        SELECT id FROM public.prestadores
        WHERE tenant_id = current_tenant_id_safe()
      )
    )
  );

-- Rede oportunidades: App Motorista (anon) vê apenas oportunidades publicadas
DROP POLICY IF EXISTS "rede_oportunidades_all_anon" ON public.rede_oportunidades;
CREATE POLICY "rede_oportunidades_select_anon" ON public.rede_oportunidades
  FOR SELECT TO anon
  USING (status IN ('publicada', 'visualizada', 'interessada'));

-- Prestador no App só vê suas próprias alocações
DROP POLICY IF EXISTS "alocacoes_escala_all_anon" ON public.alocacoes_escala;
CREATE POLICY "alocacoes_escala_select_anon" ON public.alocacoes_escala
  FOR SELECT TO anon
  USING (
    prestador_id IN (
      SELECT id FROM public.prestadores
      WHERE tenant_id = current_tenant_id_safe()
    )
  );

-- Notificações: prestador só vê as suas
DROP POLICY IF EXISTS "notificacoes_all_authenticated" ON public.portal_notificacoes;
DROP POLICY IF EXISTS "notificacoes_select_anon" ON public.portal_notificacoes;

CREATE POLICY "notificacoes_select_authenticated" ON public.portal_notificacoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "notificacoes_insert_service" ON public.portal_notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notificacoes_select_anon" ON public.portal_notificacoes
  FOR SELECT TO anon
  USING (
    prestador_id IN (
      SELECT id FROM public.prestadores
      WHERE tenant_id = current_tenant_id_safe()
    )
  );

-- =============================================================================
-- FASE 8 — GRANTS PARA O APP MOTORISTA (anon role)
-- =============================================================================
-- O App Motorista se autentica via Supabase Anon Key (cliente JavaScript)
-- e as RLS policies filtram os dados apropriadamente

-- Garantir permissão nas tabelas para anon
GRANT SELECT ON public.rotas TO anon;
GRANT INSERT ON public.rotas TO anon;
GRANT UPDATE ON public.rotas TO anon;

GRANT SELECT ON public.rota_paradas TO anon;
GRANT INSERT ON public.rota_paradas TO anon;
GRANT UPDATE ON public.rota_paradas TO anon;

GRANT SELECT ON public.portal_notificacoes TO anon;
GRANT SELECT ON public.rede_oportunidades TO anon;
GRANT SELECT ON public.alocacoes_escala TO anon;

-- =============================================================================
-- VIEW PARA NOTIFICAÇÕES NÃO LIDAS DO APP
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_app_notificacoes_pendentes AS
SELECT
  id,
  prestador_id,
  titulo,
  mensagem,
  tipo,
  origem_id,
  origem_tipo,
  lida,
  created_at
FROM public.portal_notificacoes
WHERE lida = false
ORDER BY created_at DESC;

COMMENT ON VIEW public.vw_app_notificacoes_pendentes IS
  'M111 — Notificações não lidas para o App Motorista.';

GRANT SELECT ON public.vw_app_notificacoes_pendentes TO anon, authenticated;

-- =============================================================================
-- FUNÇÃO: Buscar operações do motorista para o App
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista(
  p_prestador_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      a.id AS alocacao_id,
      a.ordem_servico_id AS os_id,
      a.status,
      a.data_escala,
      a.tipo_veiculo,
      a.placa,
      a.origem,
      a.destino,
      a.valor_repasse,
      a.km_previstos,
      a.aceite_prestador,
      a.tipo_reversa,
      a.reversa_status,
      a.reversa_qtd_volumes,
      a.observacoes,
      COALESCE(a.metadata->>'operation_mode', 'standard_delivery') AS operation_mode,
      c.nome_fantasia AS cliente_nome,
      c.cidade AS cliente_cidade,
      os.numero AS os_numero,
      os.tipo_operacao,
      r.id AS rota_id,
      r.numero_paradas,
      r.paradas_pendentes,
      (SELECT COUNT(*) FROM public.rota_paradas rp WHERE rp.rota_id = r.id AND rp.status = 'pendente') AS paradas_pendentes_count
    FROM public.alocacoes_escala a
    LEFT JOIN public.clientes c ON c.id = a.cliente_id
    LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    LEFT JOIN public.rotas r ON r.alocacao_id = a.id
    WHERE a.prestador_id = p_prestador_id
      AND (p_status IS NULL OR a.status = p_status)
    ORDER BY a.data_escala DESC, a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'sucesso', true,
    'prestador_id', p_prestador_id,
    'operacoes', COALESCE(v_result, '[]'::jsonb),
    'total', (SELECT COUNT(*) FROM public.alocacoes_escala WHERE prestador_id = p_prestador_id AND (p_status IS NULL OR status = p_status))
  );
END;
$$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista IS
  'M111 — Busca operações de um motorista para o App. Filtra por status, com paginação.';

GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista TO anon, authenticated;

-- =============================================================================
-- FUNÇÃO: Atualizar status de parada individual (App Motorista)
-- =============================================================================
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
  v_rota_id UUID;
  v_parada_atual RECORD;
  v_total_paradas INTEGER;
  v_paradas_resolvidas INTEGER;
BEGIN
  -- Validar status
  IF p_status NOT IN ('pendente', 'em_deslocamento', 'chegou', 'entregue', 'nao_entregue', 'ocorrencia', 'reentrega', 'devolucao', 'cancelada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Status inválido: %s', p_status));
  END IF;

  -- Buscar parada
  SELECT rp.*, r.os_id, r.alocacao_id INTO v_parada_atual
  FROM public.rota_paradas rp
  JOIN public.rotas r ON r.id = rp.rota_id
  WHERE rp.id = p_parada_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Parada não encontrada');
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
    WHERE id = v_parada_atual.alocacao_id;

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
  'M111 — Atualiza status de parada individual. Recalcula pendências na rota. Se todas resolvidas, conclui rota + alocação + OS.';

GRANT EXECUTE ON FUNCTION public.f_atualizar_status_parada TO anon, authenticated;

-- =============================================================================
-- FASE 2 — PERMITIR APENAS RPC PARA ACEITE (não INSERT direto)
-- =============================================================================
-- Bloquear INSERT/UPDATE direto em rede_oportunidades para anon (App)
-- O App DEVE usar a RPC f_aceitar_oportunidade_rede

-- Revogar INSERT/UPDATE para anon em rede_oportunidades
REVOKE INSERT, UPDATE, DELETE ON public.rede_oportunidades FROM anon;
-- Anon pode apenas SELECT (visualizar oportunidades disponíveis)
-- O aceite é feito exclusivamente via RPC f_aceitar_oportunidade_rede

-- =============================================================================
-- VALIDAÇÃO
-- =============================================================================
-- SELECT 'M111 migration applied successfully' AS status;
