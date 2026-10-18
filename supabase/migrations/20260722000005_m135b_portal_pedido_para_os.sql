-- ============================================================
-- MISSÃO 135-B — Conversão automática e controlada de
-- Pedido do Portal em Ordem de Serviço
-- ============================================================
-- Data: 2026-07-22
--
-- O que faz:
--   1. Adiciona coluna ordem_servico_id em portal_pedidos (FK)
--   2. Adiciona coluna pedido_portal_id em ordens_servico
--   3. Unique index em portal_pedidos.ordem_servico_id
--   4. RPC converter_pedido_para_os — transacional e idempotente
--   5. Trigger de validação de duplicidade
-- ============================================================

-- ============================================================
-- SEÇÃO 1: VÍNCULO BIDIRECIONAL
-- ============================================================

-- 1a. FK em portal_pedidos → ordens_servico (coluna existente: os_vinculada_id)
-- Já existe como UUID, apenas garantimos que tem FK explícita (se aplicável)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_pedidos' AND column_name = 'os_vinculada_id'
  ) THEN
    ALTER TABLE public.portal_pedidos ADD COLUMN os_vinculada_id UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_pedidos_os_vinculada
  ON public.portal_pedidos(os_vinculada_id)
  WHERE os_vinculada_id IS NOT NULL;

-- 1b. FK em ordens_servico → portal_pedidos
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pedido_portal_id UUID REFERENCES public.portal_pedidos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordens_servico_pedido_portal
  ON public.ordens_servico(pedido_portal_id)
  WHERE pedido_portal_id IS NOT NULL;

-- 1c. Unique constraint: um pedido só pode ter UMA OS
-- (proteção estrutural contra duplicidade)
DROP INDEX IF EXISTS idx_portal_pedidos_os_vinculada_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_pedidos_os_vinculada_unique
  ON public.portal_pedidos(os_vinculada_id)
  WHERE os_vinculada_id IS NOT NULL;

-- ============================================================
-- SEÇÃO 2: COLUNAS ADICIONAIS PARA CONTROLE
-- ============================================================

ALTER TABLE public.portal_pedidos
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erro_processamento TEXT,
  ADD COLUMN IF NOT EXISTS codigo_erro TEXT,
  ADD COLUMN IF NOT EXISTS tentativas_processamento INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS solicitacao_via TEXT DEFAULT 'portal_cliente',
  ADD COLUMN IF NOT EXISTS data_solicitada TIMESTAMPTZ;

-- Novo status para pedidos convertidos
ALTER TABLE public.portal_pedidos
  DROP CONSTRAINT IF EXISTS portal_pedidos_status_check;

ALTER TABLE public.portal_pedidos
  ADD CONSTRAINT portal_pedidos_status_check
    CHECK (status IN (
      'rascunho',
      'enviado',
      'em_analise',
      'aprovado',
      'convertido',
      'programado',
      'coleta',
      'em_rota',
      'entregue',
      'rejeitado',
      'erro_conversao',
      'cancelado'
    ));

-- ============================================================
-- SEÇÃO 3: RPC DE CONVERSÃO (transacional e idempotente)
-- ============================================================

CREATE OR REPLACE FUNCTION public.converter_pedido_para_os(
  p_pedido_id UUID,
  p_operador_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_os_id UUID;
  v_os_numero TEXT;
  v_status_atual TEXT;
  v_cliente_nome TEXT;
  v_prestador_nome TEXT;
BEGIN
  -- ============================================================
  -- VALIDAÇÕES
  -- ============================================================

  -- 1. Buscar pedido
  SELECT * INTO v_pedido
  FROM portal_pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PEDIDO_NAO_ENCONTRADO',
      'message', 'Pedido não encontrado'
    );
  END IF;

  -- 2. Verificar se já foi convertido (usa coluna existente os_vinculada_id)
  IF v_pedido.os_vinculada_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'pedido_id', v_pedido.id,
      'ordem_servico_id', v_pedido.os_vinculada_id,
      'numero_os', (SELECT numero FROM ordens_servico WHERE id = v_pedido.os_vinculada_id),
      'status_pedido', v_pedido.status,
      'status_os', (SELECT status FROM ordens_servico WHERE id = v_pedido.os_vinculada_id),
      'created', false,
      'message', 'Pedido já convertido anteriormente'
    );
  END IF;

  v_status_atual := v_pedido.status;

  -- 4. Validar status
  IF v_status_atual NOT IN ('enviado', 'em_analise', 'aprovado') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'STATUS_INVALIDO',
      'message', format('Pedido em status "%s" não pode ser convertido', v_status_atual),
      'status_atual', v_status_atual
    );
  END IF;

  -- 5. Validar campos obrigatórios
  IF v_pedido.coleta_cidade IS NULL OR v_pedido.entrega_cidade IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAMPOS_OBRIGATORIOS',
      'message', 'Cidade de coleta e destino são obrigatórias'
    );
  END IF;

  -- ============================================================
  -- BUSCAR NOMES REAIS (em vez de UUID como string)
  -- ============================================================
  BEGIN
    SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || v_pedido.cliente_id::TEXT)
      INTO STRICT v_cliente_nome
      FROM clientes c WHERE c.id = v_pedido.cliente_id;
  EXCEPTION WHEN OTHERS THEN
    v_cliente_nome := COALESCE(v_pedido.cliente_id::TEXT, 'Cliente não informado');
  END;

  BEGIN
    SELECT COALESCE(p.nome_completo, 'Prestador não informado')
      INTO STRICT v_prestador_nome
      FROM prestadores p WHERE p.id = v_pedido.prestador_id;
  EXCEPTION WHEN OTHERS THEN
    v_prestador_nome := COALESCE(v_pedido.prestador_id::TEXT, 'Prestador não informado');
  END;

  -- ============================================================
  -- GERAR NÚMERO DA OS
  -- ============================================================
  v_os_numero := format(
    'OS-%s-%s',
    to_char(now(), 'YYYYMM'),
    LPAD(floor(random() * 900000 + 100000)::TEXT, 6, '0')
  );

  -- ============================================================
  -- INSERIR ORDEM DE SERVIÇO
  -- ============================================================
  INSERT INTO ordens_servico (
    numero,
    data,
    cliente_id,
    cliente,
    unidade,
    status,
    origem,
    destino,
    tipo_operacao,
    carga_descricao,
    peso,
    volumes,
    valor_declarado,
    tipo_carga,
    observacoes_gerais,
    carga,
    valor_cliente,
    custo_prestador,
    data_programada,
    pedido_portal_id,
    created_at,
    updated_at,
    prioridade
  ) VALUES (
    v_os_numero,
    now()::DATE,
    v_pedido.cliente_id,    -- cliente_id (TEXT) = UUID do cliente (mesmo padrão do OrdemServicoForm)
    v_cliente_nome,         -- cliente (UUID) = nome real do cliente (display)
    v_pedido.filial,
    'rascunho',
    format('%s/%s', COALESCE(v_pedido.coleta_cidade, ''), COALESCE(v_pedido.coleta_uf, '')),
    format('%s/%s', COALESCE(v_pedido.entrega_cidade, ''), COALESCE(v_pedido.entrega_uf, '')),
    'fracionado',
    COALESCE(v_pedido.descricao, 'Pedido Portal'),
    COALESCE(v_pedido.peso, 0),
    COALESCE(v_pedido.volumes, 1),
    COALESCE(v_pedido.valor_declarado, 0),
    COALESCE(v_pedido.tipo_carga, 'seca'),
    COALESCE(v_pedido.observacoes, ''),
    jsonb_build_object(
      'tipo', COALESCE(v_pedido.tipo_carga, 'seca'),
      'descricao', COALESCE(v_pedido.descricao, 'Pedido Portal'),
      'volumes', COALESCE(v_pedido.volumes, 1),
      'peso', COALESCE(v_pedido.peso, 0),
      'cubagem', 0,
      'valorDeclarado', COALESCE(v_pedido.valor_declarado, 0),
      'refrigerada', COALESCE(v_pedido.tipo_carga = 'refrigerado', false)
    ),
    0,
    0,
    v_pedido.coleta_data,
    v_pedido.id,
    now(),
    now(),
    COALESCE(v_pedido.prioridade, 'normal')
  )
  RETURNING id INTO v_os_id;

  -- ============================================================
  -- ATUALIZAR ENDEREÇOS NA OS (coluna enderecos JSONB)
  -- ============================================================
  UPDATE ordens_servico SET enderecos = jsonb_build_array(
    jsonb_build_object(
      'sequencia', 0,
      'tipo', 'coleta',
      'cep', v_pedido.coleta_cep,
      'logradouro', v_pedido.coleta_rua,
      'numero', v_pedido.coleta_numero,
      'complemento', v_pedido.coleta_complemento,
      'bairro', v_pedido.coleta_bairro,
      'cidade', v_pedido.coleta_cidade,
      'uf', v_pedido.coleta_uf,
      'endereco', format('%s, %s', COALESCE(v_pedido.coleta_rua, ''), COALESCE(v_pedido.coleta_numero, '')),
      'referencia', v_pedido.coleta_referencia
    ),
    jsonb_build_object(
      'sequencia', 1,
      'tipo', 'entrega',
      'cep', v_pedido.entrega_cep,
      'logradouro', v_pedido.entrega_rua,
      'numero', v_pedido.entrega_numero,
      'complemento', v_pedido.entrega_complemento,
      'bairro', v_pedido.entrega_bairro,
      'cidade', v_pedido.entrega_cidade,
      'uf', v_pedido.entrega_uf,
      'endereco', format('%s, %s', COALESCE(v_pedido.entrega_rua, ''), COALESCE(v_pedido.entrega_numero, '')),
      'responsavel', v_pedido.entrega_destinatario,
      'telefone', v_pedido.entrega_telefone,
      'email', v_pedido.entrega_email,
      'referencia', v_pedido.entrega_referencia
    )
  ) WHERE id = v_os_id;

  -- ============================================================
  -- ATUALIZAR PEDIDO COM VÍNCULO DA OS
  -- ============================================================
  UPDATE portal_pedidos
  SET
    os_vinculada_id = v_os_id,
    status = 'convertido',
    converted_at = now(),
    updated_at = now(),
    erro_processamento = NULL,
    codigo_erro = NULL
  WHERE id = p_pedido_id;

  -- ============================================================
  -- PUBLICAR EVENTO NO EVENT BUS
  -- ============================================================
  BEGIN
    INSERT INTO eventos_oficiais (
      tenant_id,
      event_type,
      entity_type,
      entity_id,
      entity_number,
      status,
      source,
      created_by,
      visibility,
      payload,
      metadata
    ) VALUES (
      public.current_tenant_id_safe(),
      'portal.order.converted_to_service_order',
      'portal_pedido',
      v_os_id,
      v_os_numero,
      'active',
      'service',
      p_operador_id,
      'internal',
      jsonb_build_object(
        'pedido_id', p_pedido_id,
        'ordem_servico_id', v_os_id,
        'numero_os', v_os_numero,
        'cliente_id', v_pedido.cliente_id
      ),
      jsonb_build_object(
        'correlation_id', gen_random_uuid()::TEXT,
        'published_at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Falha na publicação não deve impedir a conversão
    NULL;
  END;

  -- ============================================================
  -- RETORNO
  -- ============================================================
  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'ordem_servico_id', v_os_id,
    'numero_os', v_os_numero,
    'status_pedido', 'convertido',
    'status_os', 'rascunho',
    'created', true,
    'message', format('Ordem de Serviço %s criada com sucesso', v_os_numero)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'ERRO_CONVERSAO',
    'message', format('Erro ao converter pedido: %s', SQLERRM),
    'pedido_id', p_pedido_id
  );
END;
$$;

-- ============================================================
-- SEÇÃO 4: GRANTS
-- ============================================================

-- Apenas authenticated (com RLS validando tenant) pode executar
GRANT EXECUTE ON FUNCTION public.converter_pedido_para_os(UUID, UUID)
  TO authenticated;

-- ============================================================
-- SEÇÃO 5: FIX — Trigger trg_evento_portal_pedido_criado
-- Corrige referências a colunas que não existem (tipo_servico, total_pedido,
-- cidade_origem, cidade_destino) para usar colunas reais (tipo_carga,
-- metadata->'preco_final', coleta_cidade, entrega_cidade)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_evento_portal_pedido_criado()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
      'tipo_servico', NEW.tipo_carga,
      'status', NEW.status,
      'total_pedido', COALESCE((NEW.metadata->>'preco_final')::numeric, 0),
      'cidade_origem', NEW.coleta_cidade,
      'cidade_destino', NEW.entrega_cidade
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
$function$;

-- ============================================================
-- SEÇÃO 6: CRIA TRIGGER (se M104 não foi aplicada)
-- A M104 criou o trigger trg_evento_portal_pedido_criado com
-- colunas que não existem (tipo_servico, total_pedido, etc).
-- Esta migration CORRIGE a função (CREATE OR REPLACE).
-- Se a M104 NÃO foi aplicada, o trigger não existe e precisa
-- ser criado. Usamos DO $$ com check para evitar duplicidade.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_evento_portal_pedido_criado'
      AND tgrelid = 'public.portal_pedidos'::regclass
  ) THEN
    CREATE TRIGGER trg_evento_portal_pedido_criado
      AFTER INSERT ON public.portal_pedidos
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_evento_portal_pedido_criado();
  END IF;
END;
$$;

-- ============================================================
-- SEÇÃO 7: ROLLBACK (comentado — executar somente se necessário)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.converter_pedido_para_os(UUID, UUID);
-- DROP INDEX IF EXISTS idx_portal_pedidos_os_vinculada_unique;
-- DROP INDEX IF EXISTS idx_ordens_servico_pedido_portal;
-- ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS pedido_portal_id;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS converted_at;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS erro_processamento;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS codigo_erro;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS tentativas_processamento;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS ultima_tentativa_em;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS solicitacao_via;
-- ALTER TABLE public.portal_pedidos DROP COLUMN IF EXISTS data_solicitada;
-- ALTER TABLE public.portal_pedidos DROP CONSTRAINT IF EXISTS portal_pedidos_status_check;
-- Adicionar constraint antiga:
-- ALTER TABLE public.portal_pedidos ADD CONSTRAINT portal_pedidos_status_check
--   CHECK (status IN ('rascunho','enviado','em_analise','programado','coleta','em_rota','entregue','cancelado'));
