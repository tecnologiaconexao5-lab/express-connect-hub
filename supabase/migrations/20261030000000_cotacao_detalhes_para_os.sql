-- ============================================================
-- COTAÇÃO EXPRESS — FASE 2 → ORÇAMENTO + OS NO TMS
-- ============================================================
-- Ao concluir o preenchimento dos endereços (Fase 2), o site
-- público precisa criar, de forma atômica e idempotente:
--   1. cliente (reusa ou cria pré-cadastro);
--   2. orçamento na Gestão Comercial;
--   3. OS "solicitada pelo cliente" no painel operacional;
--   4. vínculo cotacoes_publicas.orcamento_id.
--
-- A página é pública (anon), por isso a operação roda em uma
-- função SECURITY DEFINER com EXECUTE apenas para anon/authenticated.
-- Nenhum dado além do id da cotação é aceito.
-- ============================================================

CREATE OR REPLACE FUNCTION public.f_cotacao_detalhes_para_os(p_cotacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cot              RECORD;
  v_cliente_id       uuid;
  v_cliente_nome     text;
  v_telefone         text;
  v_orcamento_id     uuid;
  v_orcamento_numero text;
  v_os_id            uuid;
  v_os_numero        text;
  v_enderecos        jsonb;
  v_carga            jsonb;
  v_valor            numeric;
  v_preco            jsonb;
  v_tipo_veiculo     text;
  v_rotulo           text;
  v_km               numeric;
  v_obs              text;
  v_hist_orc         jsonb;
  v_hist_os          jsonb;
  v_existente        RECORD;
BEGIN
  IF p_cotacao_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_INVALIDA',
      'message', 'Cotação não informada.'
    );
  END IF;

  -- Serializa chamadas concorrentes da mesma cotação (evita duplicidade).
  PERFORM pg_advisory_xact_lock(hashtext('cotacao_express_os:' || p_cotacao_id::text)::bigint);

  SELECT * INTO v_cot
  FROM public.cotacoes_publicas
  WHERE id = p_cotacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_NAO_ENCONTRADA',
      'message', 'Cotação não encontrada.'
    );
  END IF;

  -- ----------------------------------------------------------
  -- IDEMPOTÊNCIA — vínculo já gravado na cotação
  -- ----------------------------------------------------------
  IF v_cot.orcamento_id IS NOT NULL THEN
    SELECT o.id, o.numero, o.cliente_id, o.os_vinculada_id, o.os_vinculada_numero
      INTO v_existente
      FROM public.orcamentos o
     WHERE o.id = v_cot.orcamento_id;

    IF FOUND THEN
      IF v_existente.os_vinculada_id IS NULL THEN
        SELECT id, numero INTO v_os_id, v_os_numero
          FROM public.ordens_servico
         WHERE orcamento_id = v_existente.id
         ORDER BY created_at
         LIMIT 1;

        IF v_os_id IS NOT NULL THEN
          UPDATE public.orcamentos
             SET os_vinculada_id = v_os_id,
                 os_vinculada_numero = v_os_numero,
                 status = 'convertido',
                 updated_at = now()
           WHERE id = v_existente.id;
          v_existente.os_vinculada_id := v_os_id;
          v_existente.os_vinculada_numero := v_os_numero;
        END IF;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'created', false,
        'cotacao_id', v_cot.id,
        'cliente_id', v_existente.cliente_id,
        'orcamento_id', v_existente.id,
        'orcamento_numero', v_existente.numero,
        'os_id', v_existente.os_vinculada_id,
        'os_numero', v_existente.os_vinculada_numero
      );
    END IF;
  END IF;

  -- Fallback de idempotência: orçamento órfão com o mesmo pedido_interno.
  SELECT o.id, o.numero, o.cliente_id, o.os_vinculada_id, o.os_vinculada_numero
    INTO v_existente
    FROM public.orcamentos o
   WHERE o.pedido_interno = p_cotacao_id::text
   ORDER BY o.id
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.cotacoes_publicas
       SET orcamento_id = v_existente.id,
           updated_at = now()
     WHERE id = p_cotacao_id;

    IF v_existente.os_vinculada_id IS NULL THEN
      SELECT id, numero INTO v_os_id, v_os_numero
        FROM public.ordens_servico
       WHERE orcamento_id = v_existente.id
       ORDER BY created_at
       LIMIT 1;

      IF v_os_id IS NOT NULL THEN
        UPDATE public.orcamentos
           SET os_vinculada_id = v_os_id,
               os_vinculada_numero = v_os_numero,
               status = 'convertido',
               updated_at = now()
         WHERE id = v_existente.id;
        v_existente.os_vinculada_id := v_os_id;
        v_existente.os_vinculada_numero := v_os_numero;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'cotacao_id', p_cotacao_id,
      'cliente_id', v_existente.cliente_id,
      'orcamento_id', v_existente.id,
      'orcamento_numero', v_existente.numero,
      'os_id', v_existente.os_vinculada_id,
      'os_numero', v_existente.os_vinculada_numero
    );
  END IF;

  -- Só permite gerar OS depois que o cliente concluiu os endereços.
  IF v_cot.status <> 'Pronto para OS' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DETALHES_PENDENTES',
      'message', 'A cotação ainda não está pronta para gerar a OS.'
    );
  END IF;

  -- ----------------------------------------------------------
  -- DADOS BASE
  -- ----------------------------------------------------------
  v_cliente_nome := COALESCE(NULLIF(btrim(v_cot.nome_cliente), ''), 'Cliente Cotação Express');
  v_telefone     := NULLIF(btrim(COALESCE(v_cot.telefone, '')), '');
  v_preco        := COALESCE(v_cot.metadata -> 'precificacao', '{}'::jsonb);
  v_valor        := COALESCE(v_cot.valor_aprovado, NULLIF(v_preco ->> 'valor', '')::numeric, 0);
  v_tipo_veiculo := COALESCE(NULLIF(v_preco ->> 'tipo_veiculo', ''), '');
  v_rotulo       := COALESCE(NULLIF(v_preco ->> 'rotulo_veiculo', ''), '');
  v_km           := NULLIF(v_preco ->> 'distancia_km', '')::numeric;

  -- ----------------------------------------------------------
  -- CLIENTE — dedup por nome/telefone; senão cria pré-cadastro
  -- ----------------------------------------------------------
  SELECT id INTO v_cliente_id
    FROM public.clientes
   WHERE lower(btrim(COALESCE(nome_fantasia, ''))) = lower(v_cliente_nome)
      OR lower(btrim(COALESCE(razao_social, ''))) = lower(v_cliente_nome)
   ORDER BY id
   LIMIT 1;

  IF v_cliente_id IS NULL AND v_telefone IS NOT NULL THEN
    SELECT id INTO v_cliente_id
      FROM public.clientes
     WHERE regexp_replace(COALESCE(telefone, ''), '\D', '', 'g') = regexp_replace(v_telefone, '\D', '', 'g')
        OR regexp_replace(COALESCE(whatsapp, ''), '\D', '', 'g') = regexp_replace(v_telefone, '\D', '', 'g')
     ORDER BY id
     LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL THEN
    v_cliente_id := gen_random_uuid();

    INSERT INTO public.clientes (
      id, nome_fantasia, razao_social, telefone, whatsapp,
      status, origem_comercial, tenant_id
    ) VALUES (
      v_cliente_id,
      v_cliente_nome,
      v_cliente_nome,
      v_telefone,
      v_telefone,
      'pre-cadastro',
      'Cotação Express',
      COALESCE(public.current_tenant_id_safe(), '00000000-0000-0000-0000-000000000001'::uuid)
    );
  END IF;

  -- ----------------------------------------------------------
  -- ENDEREÇOS — paradas da Fase 1 + detalhes da Fase 2
  -- ----------------------------------------------------------
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequencia', COALESCE(NULLIF(p ->> 'sequencia', '')::int, ord::int),
        'tipo', CASE WHEN ord = 1 THEN 'coleta' ELSE 'entrega' END,
        'endereco', CASE
          WHEN NULLIF(d ->> 'numero', '') IS NOT NULL
               AND position((d ->> 'numero') in COALESCE(p ->> 'endereco', '')) = 0
          THEN concat_ws(', ', NULLIF(p ->> 'endereco', ''), NULLIF(d ->> 'numero', ''))
          ELSE COALESCE(p ->> 'endereco', '')
        END,
        'logradouro', COALESCE(p ->> 'endereco', ''),
        'numero', COALESCE(d ->> 'numero', ''),
        'complemento', COALESCE(d ->> 'complemento', ''),
        'cep', '',
        'bairro', '',
        'cidade', '',
        'uf', '',
        'referencia', COALESCE(
          NULLIF(btrim(concat_ws(' · ',
            NULLIF(d ->> 'numero', ''),
            NULLIF(d ->> 'complemento', ''),
            NULLIF(d ->> 'observacoes', '')
          ), ' ·'), ''),
          ''
        ),
        'instrucoes', COALESCE(
          NULLIF(btrim(concat_ws(' · ',
            NULLIF(d ->> 'numero', ''),
            NULLIF(d ->> 'complemento', ''),
            NULLIF(d ->> 'observacoes', '')
          ), ' ·'), ''),
          ''
        ),
        'contato', COALESCE(d ->> 'contato', ''),
        'contatoNome', COALESCE(d ->> 'contato', ''),
        'contato_nome', COALESCE(d ->> 'contato', ''),
        'responsavel', COALESCE(d ->> 'contato', ''),
        'telefone', '',
        'janelaInicio', '',
        'janelaFim', '',
        'agendamento', false,
        'statusPonto', 'pendente',
        'status_ponto', 'pendente',
        'observacoes', COALESCE(d ->> 'observacoes', '')
      )
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  INTO v_enderecos
  FROM jsonb_array_elements(COALESCE(v_cot.paradas, '[]'::jsonb)) WITH ORDINALITY AS t(p, ord)
  LEFT JOIN LATERAL (
    SELECT dd AS d
      FROM jsonb_array_elements(COALESCE(v_cot.detalhes, '[]'::jsonb)) WITH ORDINALITY AS dt(dd, dord)
     WHERE COALESCE(NULLIF(dd ->> 'sequencia', '')::int, dord::int)
           = COALESCE(NULLIF(p ->> 'sequencia', '')::int, ord::int)
     LIMIT 1
  ) det ON true;

  -- ----------------------------------------------------------
  -- CARGA / OBSERVAÇÕES
  -- ----------------------------------------------------------
  v_carga := jsonb_build_object(
    'tipo', 'Seca',
    'descricao', COALESCE(v_cot.carga_descricao, ''),
    'volumes', COALESCE(v_cot.carga_volumes, 0),
    'peso', COALESCE(v_cot.carga_peso, 0),
    'cubagem', 0,
    'pallets', 0,
    'valorDeclarado', 0,
    'qtdNotas', 0,
    'refrigerada', false,
    'ajudante', false,
    'fragil', false,
    'empilhavel', true,
    'risco', false,
    'perigosa', false,
    'controlada', false,
    'conferencia', false,
    'equipamento', '',
    'condicao', '',
    'comprimento', 0,
    'largura', 0,
    'altura', 0,
    'pesoPorVolume', 0,
    'temperaturaMinima', 0,
    'temperaturaMaxima', 0,
    'observacoesCarga', COALESCE(v_cot.carga_dimensoes, ''),
    'origem_cotacao', v_cot.id::text
  );

  v_obs := concat_ws(' · ',
    'Cotação web (Fase 2) — cliente ' || v_cliente_nome,
    CASE WHEN v_telefone IS NOT NULL THEN 'WhatsApp: ' || v_telefone END,
    CASE WHEN v_valor > 0 THEN 'Valor aprovado: R$ ' || replace(to_char(v_valor, 'FM999999990D00'), '.', ',') END,
    CASE WHEN v_km IS NOT NULL THEN 'Distância estimada: ' || v_km || ' km' END,
    CASE WHEN v_rotulo <> '' THEN 'Veículo sugerido: ' || v_rotulo END,
    CASE WHEN v_cot.data_desejada IS NOT NULL THEN 'Data desejada: ' || to_char(v_cot.data_desejada, 'DD/MM/YYYY') END,
    CASE WHEN v_cot.hora_desejada IS NOT NULL THEN 'Horário: ' || v_cot.hora_desejada END,
    'ID da cotação: ' || v_cot.id::text
  );

  v_hist_orc := jsonb_build_array(
    jsonb_build_object(
      'data', to_char(now(), 'DD/MM/YYYY HH24:MI:SS'),
      'acao', 'Orçamento criado automaticamente pela Cotação Express (Fase 2)',
      'usuario', 'Site /cotacao-express'
    )
  );

  v_hist_os := jsonb_build_array(
    jsonb_build_object(
      'data', now(),
      'acao', 'OS criada automaticamente pela Cotação Express (Fase 2)',
      'status_novo', 'pendente',
      'usuario', 'Sistema'
    )
  );

  -- ----------------------------------------------------------
  -- NÚMERO DO ORÇAMENTO (ORC-AAAAMM-XXXX, único)
  -- ----------------------------------------------------------
  LOOP
    v_orcamento_numero := 'ORC-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orcamentos WHERE numero = v_orcamento_numero
    );
  END LOOP;

  INSERT INTO public.orcamentos (
    numero, cliente, cliente_id, unidade, data_emissao, validade,
    tipo_operacao, modalidade, prioridade, pedido_interno,
    observacoes_gerais, status,
    carga_descricao, carga_volumes, carga_peso, carga_cubagem,
    carga_pallets, carga_valor_declarado, carga_refrigerado, carga_ajudante,
    carga_fragil, carga_tipo, carga_refrigerada, carga_empilhavel,
    carga_risco, carga_perigosa, carga_controlada, veiculo_termica,
    veiculo_tipo,
    valor_base, pedagio, adicionais, descontos, valor_final, custo_estimado,
    historico, enderecos, carga, veiculo, valores,
    created_at, updated_at
  ) VALUES (
    v_orcamento_numero, v_cliente_nome, v_cliente_id, 'São Paulo - Matriz',
    CURRENT_DATE, NULL, 'Coleta e Entrega', 'esporadico', 'normal',
    p_cotacao_id::text, v_obs, 'em_analise',
    COALESCE(v_cot.carga_descricao, ''), COALESCE(v_cot.carga_volumes, 0),
    COALESCE(v_cot.carga_peso, 0), 0, 0, 0, false, false,
    false, 'Seca', false, true, false, false, false, 'seco',
    v_tipo_veiculo,
    v_valor, 0, 0, 0, v_valor, 0,
    v_hist_orc, v_enderecos, v_carga,
    jsonb_build_object('tipo', v_tipo_veiculo, 'subcategoria', v_rotulo, 'carroceria', ''),
    jsonb_build_object(
      'tabelaVinculada', COALESCE(v_preco ->> 'tabela', ''),
      'valorBase', v_valor,
      'adicionais', 0,
      'pedagio', 0,
      'kmExcedente', COALESCE((v_preco -> 'formula' ->> 'kmExcedente')::numeric, 0),
      'ajudante', 0,
      'devolucao', 0,
      'reentrega', 0,
      'descontos', 0,
      'valorFinal', v_valor,
      'custoEstimado', 0,
      'margemEstimada', 0,
      'lucroEstimado', 0
    ),
    now(), now()
  )
  RETURNING id INTO v_orcamento_id;

  -- ----------------------------------------------------------
  -- NÚMERO DA OS (OS-AAAAMM-NNNNNN, único)
  -- ----------------------------------------------------------
  LOOP
    v_os_numero := 'OS-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.ordens_servico WHERE numero = v_os_numero
    );
  END LOOP;

  INSERT INTO public.ordens_servico (
    numero, data, cliente, cliente_id, unidade, status,
    tipo_operacao, modalidade, prioridade,
    carga_descricao, peso, volumes, valor_declarado, tipo_carga,
    observacoes_gerais, origem, destino,
    carga, enderecos, historico,
    valor_cliente, custo_prestador,
    tipo_veiculo, veiculo_subcategoria, veiculo_carroceria, veiculo_termica,
    orcamento_id, orcamento_origem,
    status_faturamento, status_pagamento,
    created_at, updated_at
  ) VALUES (
    v_os_numero, CURRENT_DATE, v_cliente_id, v_cliente_id::text,
    'São Paulo - Matriz', 'pendente',
    'Coleta e Entrega', 'esporadico', 'normal',
    COALESCE(v_cot.carga_descricao, ''), COALESCE(v_cot.carga_peso, 0),
    COALESCE(v_cot.carga_volumes, 0), 0, 'Seca',
    v_obs,
    COALESCE(v_enderecos -> 0 ->> 'endereco', ''),
    COALESCE(v_enderecos -> (jsonb_array_length(v_enderecos) - 1) ->> 'endereco', ''),
    v_carga, v_enderecos, v_hist_os,
    v_valor, 0,
    v_tipo_veiculo, v_rotulo, '', 'seco',
    v_orcamento_id, v_orcamento_numero,
    'a faturar', 'a pagar',
    now(), now()
  )
  RETURNING id INTO v_os_id;

  UPDATE public.orcamentos
     SET status = 'convertido',
         os_vinculada_id = v_os_id,
         os_vinculada_numero = v_os_numero,
         updated_at = now()
   WHERE id = v_orcamento_id;

  UPDATE public.cotacoes_publicas
     SET orcamento_id = v_orcamento_id,
         status = 'Pronto para OS',
         updated_at = now()
   WHERE id = p_cotacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'created', true,
    'cotacao_id', p_cotacao_id,
    'cliente_id', v_cliente_id,
    'orcamento_id', v_orcamento_id,
    'orcamento_numero', v_orcamento_numero,
    'os_id', v_os_id,
    'os_numero', v_os_numero
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[f_cotacao_detalhes_para_os] %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'ERRO_CONVERSAO',
    'message', 'Não foi possível abrir a OS agora. Tente novamente em instantes.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_cotacao_detalhes_para_os(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_cotacao_detalhes_para_os(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
