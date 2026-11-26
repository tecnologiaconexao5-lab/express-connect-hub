-- =============================================================================
-- ONDA 2 — PORTAL DO CLIENTE: MULTI-PARADAS NA CONVERSÃO PEDIDO → OS
-- Data: 2026-11-26
--
-- Objetivo:
--   1. Atualizar SOMENTE o corpo base (_converter_pedido_para_os_base) para
--      ler metadata->'paradas' do portal_pedidos e gravar TODAS as paradas
--      ordenadas em ordens_servico.enderecos (estrutura padrão do TMS).
--   2. Consolidar volumes/peso/cubagem a partir das paradas (ou metadata.totais
--      quando a origem antiga não possuir array de paradas).
--
-- SEGURANÇA:
--   - O wrapper público converter_pedido_para_os (Onda 1) NÃO é alterado e
--     continua validando posse do pedido pelo cliente autenticado.
--   - Nenhum custo/margem é gravado ou retornado ao Portal do Cliente.
--   - Nenhuma policy RLS é criada/alterada aqui.
--
-- IDEMPOTENTE: CREATE OR REPLACE FUNCTION.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._converter_pedido_para_os_base(
  p_pedido_id uuid,
  p_operador_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pedido RECORD;
  v_os_id UUID;
  v_os_numero TEXT;
  v_status_atual TEXT;
  v_paradas jsonb := '[]'::jsonb;
  v_parada jsonb;
  v_enderecos jsonb := '[]'::jsonb;
  v_endereco jsonb;
  v_qtd_paradas INTEGER := 0;
  v_volumes NUMERIC := 0;
  v_peso NUMERIC := 0;
  v_cubagem NUMERIC := 0;
  v_origem TEXT;
  v_destino TEXT;
  v_tipo TEXT;
  v_cidade TEXT;
  v_uf TEXT;
  v_preco_cliente NUMERIC := 0;
BEGIN
  -- ============================================================
  -- 1. PEDIDO
  -- ============================================================
  SELECT * INTO v_pedido
  FROM public.portal_pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PEDIDO_NAO_ENCONTRADO',
      'message', 'Pedido não encontrado'
    );
  END IF;

  -- 2. IDEMPOTÊNCIA
  IF v_pedido.os_vinculada_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'pedido_id', v_pedido.id,
      'ordem_servico_id', v_pedido.os_vinculada_id,
      'numero_os', (SELECT numero FROM public.ordens_servico WHERE id = v_pedido.os_vinculada_id),
      'status_pedido', v_pedido.status,
      'status_os', (SELECT status FROM public.ordens_servico WHERE id = v_pedido.os_vinculada_id),
      'created', false,
      'message', 'Pedido já convertido anteriormente'
    );
  END IF;

  v_status_atual := v_pedido.status;

  IF v_status_atual NOT IN ('enviado', 'em_analise', 'aprovado') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'STATUS_INVALIDO',
      'message', format('Pedido em status "%s" não pode ser convertido', v_status_atual),
      'status_atual', v_status_atual
    );
  END IF;

  -- ============================================================
  -- 3. MULTI-PARADAS (metadata.paradas)
  -- ============================================================
  IF jsonb_typeof(COALESCE(v_pedido.metadata, '{}'::jsonb) -> 'paradas') = 'array' THEN
    v_paradas := COALESCE(v_pedido.metadata -> 'paradas', '[]'::jsonb);
  END IF;

  -- Fallback legado só é exigido quando NÃO há paradas estruturadas.
  IF jsonb_array_length(v_paradas) = 0
     AND (v_pedido.coleta_cidade IS NULL OR v_pedido.entrega_cidade IS NULL) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAMPOS_OBRIGATORIOS',
      'message', 'Cidade de coleta e destino são obrigatórias'
    );
  END IF;

  IF jsonb_array_length(v_paradas) > 0 THEN
    FOR v_parada IN SELECT value FROM jsonb_array_elements(v_paradas)
    LOOP
      v_tipo := lower(COALESCE(v_parada ->> 'tipo', 'entrega'));
      IF v_tipo IN ('coleta', 'retirada', 'retirada_entrega', 'pickup', 'origem') THEN
        v_tipo := 'coleta';
      ELSE
        v_tipo := 'entrega';
      END IF;

      v_cidade := COALESCE(v_parada ->> 'cidade', '');
      v_uf := COALESCE(v_parada ->> 'uf', '');

      v_endereco := jsonb_build_object(
        'sequencia', v_qtd_paradas,
        'tipo', v_tipo,
        'cep', COALESCE(v_parada ->> 'cep', ''),
        'logradouro', COALESCE(v_parada ->> 'logradouro', v_parada ->> 'rua', v_parada ->> 'endereco', ''),
        'numero', COALESCE(v_parada ->> 'numero', ''),
        'complemento', COALESCE(v_parada ->> 'complemento', ''),
        'bairro', COALESCE(v_parada ->> 'bairro', ''),
        'cidade', v_cidade,
        'uf', v_uf,
        'endereco', concat_ws(', ',
          NULLIF(COALESCE(v_parada ->> 'logradouro', v_parada ->> 'rua', v_parada ->> 'endereco', ''), ''),
          NULLIF(COALESCE(v_parada ->> 'numero', ''), '')
        ),
        'contato', COALESCE(v_parada ->> 'contato', v_parada ->> 'destinatario', v_parada ->> 'recebedor', ''),
        'telefone', COALESCE(v_parada ->> 'telefone', v_parada ->> 'contato_telefone', ''),
        'email', COALESCE(v_parada ->> 'email', ''),
        'janela_inicio', COALESCE(v_parada ->> 'janela_inicio', v_parada ->> 'janela_entrega', ''),
        'janela_fim', COALESCE(v_parada ->> 'janela_fim', ''),
        'instrucoes', COALESCE(v_parada ->> 'instrucoes', v_parada ->> 'observacoes', ''),
        'referencia', COALESCE(v_parada ->> 'referencia', v_parada ->> 'complemento', '')
      );

      v_enderecos := v_enderecos || jsonb_build_array(v_endereco);

      IF v_qtd_paradas = 0 THEN
        v_origem := format('%s/%s', v_cidade, v_uf);
      END IF;
      IF v_tipo = 'entrega' THEN
        v_destino := format('%s/%s', v_cidade, v_uf);
      END IF;

      v_volumes := v_volumes + COALESCE(
        NULLIF(v_parada ->> 'volumes', '')::numeric,
        NULLIF(v_parada ->> 'quantidade_volumes', '')::numeric,
        0
      );

      v_peso := v_peso + COALESCE(
        NULLIF(v_parada ->> 'peso_kg', '')::numeric,
        NULLIF(v_parada ->> 'peso', '')::numeric,
        0
      );

      v_cubagem := v_cubagem + COALESCE(
        NULLIF(v_parada ->> 'cubagem_m3', '')::numeric,
        CASE
          WHEN COALESCE(NULLIF(v_parada ->> 'comprimento_cm', '')::numeric, 0) > 0
           AND COALESCE(NULLIF(v_parada ->> 'largura_cm', '')::numeric, 0) > 0
           AND COALESCE(NULLIF(v_parada ->> 'altura_cm', '')::numeric, 0) > 0
          THEN (
            COALESCE(NULLIF(v_parada ->> 'comprimento_cm', '')::numeric, 0)
            * COALESCE(NULLIF(v_parada ->> 'largura_cm', '')::numeric, 0)
            * COALESCE(NULLIF(v_parada ->> 'altura_cm', '')::numeric, 0)
            * GREATEST(COALESCE(NULLIF(v_parada ->> 'volumes', '')::numeric, 1), 1)
          ) / 1000000
          ELSE 0
        END,
        0
      );

      v_qtd_paradas := v_qtd_paradas + 1;
    END LOOP;
  END IF;

  -- ============================================================
  -- 4. FALLBACK (pedido antigo sem metadata.paradas)
  -- ============================================================
  IF v_qtd_paradas = 0 THEN
    v_enderecos := jsonb_build_array(
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
        'contato', COALESCE(v_pedido.solicitante_nome, ''),
        'telefone', COALESCE(v_pedido.solicitante_telefone, ''),
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
        'contato', v_pedido.entrega_destinatario,
        'telefone', v_pedido.entrega_telefone,
        'email', v_pedido.entrega_email,
        'referencia', v_pedido.entrega_referencia
      )
    );

    v_origem := format('%s/%s', COALESCE(v_pedido.coleta_cidade, ''), COALESCE(v_pedido.coleta_uf, ''));
    v_destino := format('%s/%s', COALESCE(v_pedido.entrega_cidade, ''), COALESCE(v_pedido.entrega_uf, ''));
    v_volumes := COALESCE(v_pedido.volumes, 1);
    v_peso := COALESCE(v_pedido.peso, 0);
    v_cubagem := 0;
  END IF;

  -- Totais explícitos no metadata (quando o importador já consolidou)
  IF v_volumes <= 0 THEN
    v_volumes := COALESCE((v_pedido.metadata -> 'totais' ->> 'volumes')::numeric, v_pedido.volumes, 1);
  END IF;
  IF v_peso <= 0 THEN
    v_peso := COALESCE((v_pedido.metadata -> 'totais' ->> 'peso_kg')::numeric, v_pedido.peso, 0);
  END IF;
  IF v_cubagem <= 0 THEN
    v_cubagem := COALESCE((v_pedido.metadata -> 'totais' ->> 'cubagem_m3')::numeric, 0);
  END IF;

  -- Preço estimado exibido ao cliente (nunca custo/margem)
  BEGIN
    v_preco_cliente := COALESCE(NULLIF(v_pedido.metadata ->> 'preco_estimado', '')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_preco_cliente := 0;
  END;

  -- ============================================================
  -- 5. OS
  -- ============================================================
  v_destino := COALESCE(
    v_destino,
    format('%s/%s', COALESCE(v_pedido.entrega_cidade, ''), COALESCE(v_pedido.entrega_uf, ''))
  );

  v_os_numero := public.f_proximo_numero_os();

  INSERT INTO public.ordens_servico (
    numero, data, cliente_id, cliente, unidade, status, origem, destino,
    tipo_operacao, carga_descricao, peso, volumes, cubagem, valor_declarado,
    tipo_carga, observacoes_gerais, carga, valor_cliente, custo_prestador,
    data_programada, pedido_portal_id, created_at, updated_at, prioridade
  ) VALUES (
    v_os_numero,
    now()::DATE,
    v_pedido.cliente_id,
    v_pedido.cliente_id,
    v_pedido.filial,
    'rascunho',
    v_origem,
    v_destino,
    'fracionado',
    COALESCE(v_pedido.descricao, 'Pedido Portal'),
    v_peso,
    v_volumes,
    v_cubagem,
    COALESCE(v_pedido.valor_declarado, 0),
    COALESCE(v_pedido.tipo_carga, 'seca'),
    COALESCE(v_pedido.observacoes, ''),
    jsonb_build_object(
      'tipo', COALESCE(v_pedido.tipo_carga, 'seca'),
      'descricao', COALESCE(v_pedido.descricao, 'Pedido Portal'),
      'volumes', v_volumes,
      'peso', v_peso,
      'cubagem', v_cubagem,
      'valorDeclarado', COALESCE(v_pedido.valor_declarado, 0),
      'refrigerada', COALESCE(v_pedido.tipo_carga = 'refrigerado', false),
      'paradas', v_qtd_paradas
    ),
    v_preco_cliente,
    0,
    v_pedido.coleta_data,
    v_pedido.id,
    now(),
    now(),
    COALESCE(v_pedido.prioridade, 'normal')
  )
  RETURNING id INTO v_os_id;

  UPDATE public.ordens_servico
     SET enderecos = v_enderecos
   WHERE id = v_os_id;

  -- ============================================================
  -- 6. VÍNCULO DO PEDIDO
  -- ============================================================
  UPDATE public.portal_pedidos
     SET os_vinculada_id = v_os_id,
         status = 'convertido',
         converted_at = now(),
         updated_at = now(),
         erro_processamento = NULL,
         codigo_erro = NULL
   WHERE id = p_pedido_id;

  -- ============================================================
  -- 7. EVENT BUS (não bloqueia a conversão)
  -- ============================================================
  BEGIN
    INSERT INTO public.eventos_oficiais (
      tenant_id, event_type, entity_type, entity_id, entity_number,
      status, source, created_by, visibility, payload, metadata
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
        'cliente_id', v_pedido.cliente_id,
        'paradas', v_qtd_paradas,
        'volumes', v_volumes,
        'peso', v_peso,
        'cubagem', v_cubagem
      ),
      jsonb_build_object(
        'correlation_id', gen_random_uuid()::TEXT,
        'published_at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'ordem_servico_id', v_os_id,
    'numero_os', v_os_numero,
    'status_pedido', 'convertido',
    'status_os', 'rascunho',
    'created', true,
    'paradas', v_qtd_paradas,
    'volumes', v_volumes,
    'peso', v_peso,
    'cubagem', v_cubagem,
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
$function$;

COMMENT ON FUNCTION public._converter_pedido_para_os_base(uuid, uuid) IS
  'ONDA 2 — Conversão de pedido do Portal para OS. Lê metadata.paradas (multi-paradas), consolida volumes/peso/cubagem e grava enderecos ordenados. O wrapper converter_pedido_para_os mantém a checagem de posse.';

NOTIFY pgrst, 'reload schema';

COMMIT;
