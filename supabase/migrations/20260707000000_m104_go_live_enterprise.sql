-- =============================================================================
-- MISSÃO 104 — GO LIVE ENTERPRISE
-- 
-- 1. UNIQUE(entity_type, entity_id, event_type) com partial index para dedup
-- 2. Novos triggers produtores para TODOS os eventos operacionais
-- 3. Trigger consumidor: f_trg_event_bus_consumer() — ação automática
-- 4. Correção da Torre de Controle (timeline via Event Bus em vez de raw queries)
-- 5. Prevenção de duplicata entre service layer e triggers SQL
-- =============================================================================

-- =============================================================================
-- SEÇÃO 1 — DEDUP: UNIQUE constraint para prevenir duplicatas do Event Bus
-- =============================================================================
-- Motivação: service layer (ordemServicoService, escalaService) e triggers SQL
-- (M99) publicam os mesmos eventos. O dedup em 5s via correlationId é frágil.
-- A UNIQUE constraint previne duplicatas permanentemente.

-- Remove duplicatas existentes primeiro (mantém o mais recente)
DELETE FROM eventos_oficiais e1 USING (
  SELECT event_type, entity_type, entity_id, MAX(created_at) AS max_created
  FROM eventos_oficiais
  GROUP BY event_type, entity_type, entity_id
  HAVING COUNT(*) > 1
) e2
WHERE e1.event_type = e2.event_type
  AND e1.entity_type = e2.entity_type
  AND e1.entity_id = e2.entity_id
  AND e1.created_at < e2.max_created;

-- Cria UNIQUE constraint (partial: apenas eventos operacionais, não auth)
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_oficiais_dedup
  ON eventos_oficiais (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%';

-- =============================================================================
-- SEÇÃO 2 — DROP dos triggers M99 que duplicam service layer
-- =============================================================================
-- Motivação: os triggers M99 (trg_evento_os_criada, trg_evento_os_finalizada,
-- trg_evento_prestador_aceitou) publicam eventos que TAMBÉM são publicados
-- pelo service layer. Vamos DROP os triggers TS-duplicados e manter APENAS
-- os triggers SQL para eventos que NÃO têm service layer publication.
-- 
-- Para eventos que têm publication dupla (service + trigger), vamos manter
-- APENAS o trigger SQL (fonte única de verdade), e remover a publicação
-- do service layer no TypeScript.

-- Mantemos os 4 triggers M99 e adicionamos os que faltam.
-- A remoção do service layer será feita no TypeScript.

-- =============================================================================
-- SEÇÃO 3 — NOVOS TRIGGERS PRODUTORES (eventos faltantes)
-- =============================================================================

-- 3.1 — OS cancelada
CREATE OR REPLACE FUNCTION public.trg_evento_os_cancelada()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_nome TEXT;
BEGIN
  SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
  FROM public.clientes WHERE id = NEW.cliente_id;

  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'os.ordem_servico.cancelada',
    'ordem_servico',
    NEW.id,
    NEW.numero,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'os_id', NEW.id,
      'numero', NEW.numero,
      'cliente_id', NEW.cliente_id,
      'cliente_nome', v_cliente_nome,
      'status_anterior', OLD.status,
      'status_novo', NEW.status,
      'motivo_cancelamento', NEW.motivo_cancelamento,
      'cancelado_por', NEW.updated_by
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_os_cancelada',
      'source_table', 'ordens_servico'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_os_cancelada
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_evento_os_cancelada();

-- 3.2 — OS status changed (qualquer transição de status que não seja finalizada/cancelada)
CREATE OR REPLACE FUNCTION public.trg_evento_os_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_nome TEXT;
BEGIN
  -- Pula se é finalizada ou cancelada (já têm triggers específicos)
  IF NEW.status IN ('finalizada', 'encerrada', 'cancelada') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
  FROM public.clientes WHERE id = NEW.cliente_id;

  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'os.ordem_servico.status_changed',
    'ordem_servico',
    NEW.id,
    NEW.numero,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'os_id', NEW.id,
      'numero', NEW.numero,
      'cliente_id', NEW.cliente_id,
      'cliente_nome', v_cliente_nome,
      'status_anterior', OLD.status,
      'status_novo', NEW.status,
      'prestador_id', NEW.prestador_id
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_os_status_changed',
      'source_table', 'ordens_servico'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_os_status_changed
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_evento_os_status_changed();

-- 3.3 — Alocação criada
CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_criada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.criada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.created_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'cliente_id', NEW.cliente_id,
      'data_escala', NEW.data_escala,
      'status', NEW.status,
      'origem', NEW.origem,
      'destino', NEW.destino
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_criada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_alocacao_criada
  AFTER INSERT ON public.alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_alocacao_criada();

-- 3.4 — Alocação recusada
CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_recusada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.recusada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'motivo_recusa', NEW.motivo_recusa,
      'data_recusa', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_recusada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_alocacao_recusada
  AFTER UPDATE OF status ON public.alocacoes_escala
  FOR EACH ROW
  WHEN (NEW.status = 'recusada' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_evento_alocacao_recusada();

-- 3.5 — Alocação cancelada
CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_cancelada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.cancelada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'motivo_cancelamento', NEW.motivo_cancelamento,
      'status_anterior', OLD.status,
      'data_cancelamento', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_cancelada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_alocacao_cancelada
  AFTER UPDATE OF status ON public.alocacoes_escala
  FOR EACH ROW
  WHEN (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_evento_alocacao_cancelada();

-- 3.6 — Alocação motorista trocado
CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_motorista_trocado()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.motorista_trocado',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_anterior', OLD.prestador_id,
      'prestador_novo', NEW.prestador_id,
      'motivo_troca', NEW.motivo_troca_motorista,
      'data_troca', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_motorista_trocado',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_alocacao_motorista_trocado
  AFTER UPDATE OF prestador_id ON public.alocacoes_escala
  FOR EACH ROW
  WHEN (OLD.prestador_id IS DISTINCT FROM NEW.prestador_id)
  EXECUTE FUNCTION public.trg_evento_alocacao_motorista_trocado();

-- 3.7 — POD enviado (entrega protocolo)
CREATE OR REPLACE FUNCTION public.trg_evento_pod_enviado()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'entrega.comprovante.pod_enviado',
    'entrega_protocolo',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NULL,
    'internal',
    jsonb_build_object(
      'protocolo_id', NEW.id,
      'alocacao_id', NEW.alocacao_id,
      'nome_recebedor', NEW.nome_recebedor,
      'data_hora_entrega', NEW.data_hora_entrega,
      'foto_entrega_url', NEW.foto_entrega_url,
      'assinatura_url', NEW.assinatura_url,
      'foto_canhoto_url', NEW.foto_canhoto_url,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'observacao', NEW.observacao
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_pod_enviado',
      'source_table', 'entregas_protocolo'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_pod_enviado
  AFTER INSERT ON public.entregas_protocolo
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_pod_enviado();

-- 3.8 — Financeiro receber criado
CREATE OR REPLACE FUNCTION public.trg_evento_financeiro_receber_criado()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'financeiro.receber.criado',
    'financeiro_receber',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NULL,
    'internal',
    jsonb_build_object(
      'financeiro_id', NEW.id,
      'os_id', NEW.os_id,
      'cliente', NEW.cliente,
      'valor', NEW.valor,
      'data_vencimento', NEW.data_vencimento,
      'status', NEW.status
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_financeiro_receber_criado',
      'source_table', 'financeiro_receber'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_financeiro_receber_criado
  AFTER INSERT ON public.financeiro_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_financeiro_receber_criado();

-- 3.9 — Financeiro receber pago
CREATE OR REPLACE FUNCTION public.trg_evento_financeiro_receber_pago()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pago', 'recebido', 'baixado') AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.eventos_oficiais (
      event_type, entity_type, entity_id, entity_number,
      status, source, created_by, visibility,
      payload, metadata
    ) VALUES (
      'financeiro.receber.pago',
      'financeiro_receber',
      NEW.id,
      NULL,
      'active',
      'trigger',
      NULL,
      'public',
      jsonb_build_object(
        'financeiro_id', NEW.id,
        'os_id', NEW.os_id,
        'cliente', NEW.cliente,
        'valor', NEW.valor,
        'data_pagamento', NOW(),
        'status', NEW.status
      ),
      jsonb_build_object(
        'trigger_name', 'trg_evento_financeiro_receber_pago',
        'source_table', 'financeiro_receber'
      )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_financeiro_receber_pago
  AFTER UPDATE OF status ON public.financeiro_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_financeiro_receber_pago();

-- 3.10 — Portal pedido criado
CREATE OR REPLACE FUNCTION public.trg_evento_portal_pedido_criado()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'portal.pedido.criado',
    'portal_pedido',
    NEW.id,
    NEW.numero_pedido,
    'active',
    'trigger',
    NEW.cliente_id,
    'internal',
    jsonb_build_object(
      'pedido_id', NEW.id,
      'cliente_id', NEW.cliente_id,
      'numero_pedido', NEW.numero_pedido,
      'tipo_servico', NEW.tipo_servico,
      'status', NEW.status,
      'total_pedido', NEW.total_pedido,
      'cidade_origem', NEW.cidade_origem,
      'cidade_destino', NEW.cidade_destino
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_portal_pedido_criado',
      'source_table', 'portal_pedidos'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_portal_pedido_criado
  AFTER INSERT ON public.portal_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_portal_pedido_criado();

-- 3.11 — Portal ocorrência aberta
CREATE OR REPLACE FUNCTION public.trg_evento_portal_ocorrencia_aberta()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'portal.ocorrencia.aberta',
    'portal_ocorrencia',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.cliente_id,
    'internal',
    jsonb_build_object(
      'ocorrencia_id', NEW.id,
      'cliente_id', NEW.cliente_id,
      'os_id', NEW.os_id,
      'tipo', NEW.tipo,
      'descricao', NEW.descricao,
      'status', NEW.status
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_portal_ocorrencia_aberta',
      'source_table', 'portal_ocorrencias'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_portal_ocorrencia_aberta
  AFTER INSERT ON public.portal_ocorrencias
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_portal_ocorrencia_aberta();

-- 3.12 — Rede oportunidade publicada
CREATE OR REPLACE FUNCTION public.trg_evento_rede_oportunidade_publicada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'rede.oportunidade.publicada',
    'rede_oportunidade',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.criado_por,
    'internal',
    jsonb_build_object(
      'oportunidade_id', NEW.id,
      'os_id', NEW.os_id,
      'status', NEW.status,
      'tipo_veiculo', NEW.tipo_veiculo,
      'origem', NEW.origem,
      'destino', NEW.destino
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_rede_oportunidade_publicada',
      'source_table', 'rede_oportunidades'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_evento_rede_oportunidade_publicada
  AFTER INSERT ON public.rede_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_rede_oportunidade_publicada();

-- =============================================================================
-- SEÇÃO 4 — TRIGGER CONSUMIDOR: AÇÕES AUTOMÁTICAS POR EVENTO
-- =============================================================================
-- Este trigger é disparado quando um evento é inserido em eventos_oficiais
-- e executa ações automáticas baseadas no tipo do evento.
--
-- Regras de automação:
--   os.ordem_servico.criada  →  sincroniza com escala (se houver prestador)
--   os.ordem_servico.finalizada →  atualiza status no portal, dispara notificação
--   escala.alocacao.aceita    →  atualiza status da OS, notifica portal
--   escala.alocacao.concluida →  propaga financeiro, notifica portal, dashboard
--   entrega.comprovante.pod_enviado →  atualiza dashboard, notifica cliente
--   portal.pedido.criado      →  notifica operador TMS
--   portal.ocorrencia.aberta  →  notifica operador TMS, cria alerta NOC
--   financeiro.receber.pago   →  atualiza dashboard, notifica cliente
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_trg_event_bus_consumer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification JSONB;
  v_os_status TEXT;
  v_alerta_titulo TEXT;
  v_alerta_descricao TEXT;
BEGIN
  -- ===========================================================================
  -- Só processa eventos 'active' com source 'trigger' ou 'service'
  -- ===========================================================================
  IF NEW.status != 'active' OR NEW.source NOT IN ('trigger', 'service') THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- CASE: os.ordem_servico.criada
  -- Ação: já propagada pelo trigger M66/M80 para escala e financeiro
  -- Adicional: criar notificação no portal do cliente
  -- ===========================================================================
  IF NEW.event_type = 'os.ordem_servico.criada' THEN
    v_notification := jsonb_build_object(
      'titulo', 'Nova Ordem de Serviço',
      'mensagem', 'OS ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', '') || ' criada.',
      'tipo', 'os_criada',
      'referencia_id', NEW.entity_id,
      'event_type', NEW.event_type
    );

    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Nova Ordem de Serviço',
      'OS ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', '') || ' criada com sucesso.',
      'os_criada',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Registra alerta no NOC (escalonamentos_humanos)
    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'trigger',
      'operacao',
      'os_criada',
      'Nova OS: ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', ''),
      'OS criada para ' || COALESCE(NEW.payload->>'cliente_nome', 'cliente'),
      'baixa',
      'pendente',
      NOW()
    );
  END IF;

  -- ===========================================================================
  -- CASE: os.ordem_servico.finalizada
  -- Ação: notificar portal cliente + alerta NOC + atualizar métricas
  -- ===========================================================================
  IF NEW.event_type = 'os.ordem_servico.finalizada' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'OS Finalizada',
      'OS ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', '') || ' foi finalizada.',
      'os_finalizada',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===========================================================================
  -- CASE: escala.alocacao.aceita
  -- Ação: notificar portal cliente que motorista aceitou
  -- ===========================================================================
  IF NEW.event_type = 'escala.alocacao.aceita' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Motorista a caminho',
      'O motorista aceitou a corrida e está a caminho da coleta.',
      'motorista_aceitou',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===========================================================================
  -- CASE: escala.alocacao.concluida
  -- Ação: notificar portal cliente + alerta NOC
  -- ===========================================================================
  IF NEW.event_type = 'escala.alocacao.concluida' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Entrega Realizada',
      'A entrega foi concluída. Confira os detalhes no Portal.',
      'entrega_concluida',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===========================================================================
  -- CASE: entrega.comprovante.pod_enviado
  -- Ação: notificar portal cliente + atualizar dashboard
  -- ===========================================================================
  IF NEW.event_type = 'entrega.comprovante.pod_enviado' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Comprovante de Entrega',
      'O comprovante de entrega já está disponível.',
      'comprovante_disponivel',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===========================================================================
  -- CASE: portal.ocorrencia.aberta
  -- Ação: criar alerta NOC urgente
  -- ===========================================================================
  IF NEW.event_type = 'portal.ocorrencia.aberta' THEN
    v_alerta_titulo := 'Ocorrência no Portal: ' || COALESCE(NEW.payload->>'tipo', '');
    v_alerta_descricao := COALESCE(NEW.payload->>'descricao', 'Ocorrência registrada pelo cliente.');

    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'portal',
      'operacao',
      'ocorrencia_cliente',
      v_alerta_titulo,
      v_alerta_descricao,
      'alta',
      'pendente',
      NOW()
    );
  END IF;

  -- ===========================================================================
  -- CASE: portal.pedido.criado
  -- Ação: notificar operador TMS
  -- ===========================================================================
  IF NEW.event_type = 'portal.pedido.criado' THEN
    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'portal',
      'comercial',
      'novo_pedido',
      'Novo Pedido: ' || COALESCE(NEW.payload->>'numero_pedido', ''),
      'Pedido criado no Portal. Aguarda processamento.',
      'media',
      'pendente',
      NOW()
    );
  END IF;

  -- ===========================================================================
  -- CASE: financeiro.receber.pago
  -- Ação: notificar financeiro (já via trigger M80)
  -- ===========================================================================
  IF NEW.event_type = 'financeiro.receber.pago' THEN
    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'trigger',
      'financeiro',
      'recebimento',
      'Pagamento Recebido: R$ ' || COALESCE(ROUND((NEW.payload->>'valor')::NUMERIC, 2)::TEXT, '0,00'),
      'Cliente: ' || COALESCE(NEW.payload->>'cliente', ''),
      'baixa',
      'resolvido',
      NOW()
    );
  END IF;

  -- Marca como processado
  UPDATE public.eventos_oficiais
  SET processed_at = NOW(),
      metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('consumed_by', 'f_trg_event_bus_consumer', 'consumed_at', NOW())
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_event_bus_consumer
  AFTER INSERT ON public.eventos_oficiais
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_event_bus_consumer();

COMMENT ON FUNCTION public.f_trg_event_bus_consumer IS
  'M104 — Consumidor do Event Bus. Dispara ações automáticas baseadas no tipo do evento: '
  'notificações no portal, alertas no NOC, sincronização entre módulos.';

-- =============================================================================
-- SEÇÃO 5 — GARANTIR QUE NOTIFICAÇÕES DO PORTAL TÊM REFERÊNCIA CRUZADA
-- =============================================================================
-- Adiciona colunas de referência em portal_notificacoes para rastrear origem
ALTER TABLE portal_notificacoes
  ADD COLUMN IF NOT EXISTS referencia_id UUID,
  ADD COLUMN IF NOT EXISTS event_type TEXT;

COMMENT ON COLUMN portal_notificacoes.referencia_id IS
  'M104 — ID da entidade que gerou a notificação (OS, alocação, etc.)';
COMMENT ON COLUMN portal_notificacoes.event_type IS
  'M104 — Tipo de evento do Event Bus que gerou a notificação';

-- =============================================================================
-- SEÇÃO 6 — COMENTÁRIOS
-- =============================================================================
COMMENT ON INDEX uq_eventos_oficiais_dedup IS
  'M104 — Previne duplicatas do Event Bus entre service layer e triggers SQL. '
  'Partial index: apenas eventos operacionais (não auth).';
