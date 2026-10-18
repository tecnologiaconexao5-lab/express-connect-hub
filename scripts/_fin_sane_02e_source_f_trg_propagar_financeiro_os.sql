-- SOURCE REAL: f_trg_propagar_financeiro_os

CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_os()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_nome       TEXT;
  v_prestador_nome     TEXT;
  v_prestador_doc      TEXT;
  v_data_venc_30       DATE;
  v_valor_cliente      NUMERIC;
  v_valor_prestador    NUMERIC;
  v_outros_custos      NUMERIC;
  v_valor_liquido      NUMERIC;
  v_margem_bruta       NUMERIC;
  v_margem_liquida     NUMERIC;
  v_imposto_valor      NUMERIC;
  v_seguro_valor       NUMERIC;
  v_is_finalizada      BOOLEAN;
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  v_valor_cliente   := COALESCE(NEW.valor_cliente, 0);
  v_valor_prestador := COALESCE(NEW.custo_prestador, 0);

  IF v_valor_cliente = 0 AND v_valor_prestador = 0 THEN
    RETURN NEW;
  END IF;

  -- Busca dados do cliente com fallback seguro
  -- NOTA: ordens_servico.cliente = UUID, cliente_id = TEXT (design legado)
  -- Usamos NEW.cliente (UUID) para lookup, NEW.cliente_id (TEXT) para fallback
  BEGIN
    SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || NEW.cliente_id)
      INTO STRICT v_cliente_nome
      FROM clientes c WHERE c.id = NEW.cliente;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_cliente_nome := COALESCE(NEW.cliente::TEXT, 'Cliente #' || NEW.cliente_id);
    WHEN OTHERS THEN
      v_cliente_nome := COALESCE(NEW.cliente::TEXT, NEW.cliente_id, 'Cliente');
  END;

  -- Busca dados do prestador
  -- NOTA: ordens_servico.prestador = UUID, prestador_id = TEXT
  BEGIN
    SELECT COALESCE(p.nome_completo, 'Prestador #' || NEW.prestador_id),
           COALESCE(p.cpf_cnpj, '')
      INTO STRICT v_prestador_nome, v_prestador_doc
      FROM prestadores p WHERE p.id = NEW.prestador;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_prestador_nome := COALESCE(NEW.prestador::TEXT, 'Prestador #' || NEW.prestador_id);
      v_prestador_doc := '';
    WHEN OTHERS THEN
      v_prestador_nome := COALESCE(NEW.prestador::TEXT, NEW.prestador_id, 'Prestador');
      v_prestador_doc := '';
  END;

  v_data_venc_30  := CURRENT_DATE + 30;
  v_is_finalizada := (NEW.status = 'finalizada');

  -- FÓRMULA UNIFICADA: outros_custos = adicionais + ajudante - descontos
  -- NOTA: ordens_servico.adicionais e ajudante sao JSONB (nao numeric)
  -- Extraimos o valor numerico: se JSONB for objeto, pega chave 'valor';
  -- se for numero puro, converte direto; caso contrario, 0
  v_outros_custos := COALESCE(
      (CASE
        WHEN NEW.adicionais IS NULL THEN 0
        WHEN jsonb_typeof(NEW.adicionais) = 'number' THEN (NEW.adicionais #>> '{}')::NUMERIC
        ELSE COALESCE((NEW.adicionais->>'valor')::NUMERIC, 0)
      END), 0
    )
    + COALESCE(
      (CASE
        WHEN NEW.ajudante IS NULL THEN 0
        WHEN jsonb_typeof(NEW.ajudante) = 'number' THEN (NEW.ajudante #>> '{}')::NUMERIC
        ELSE COALESCE((NEW.ajudante->>'valor')::NUMERIC, 0)
      END), 0
    )
    - COALESCE(NEW.descontos, 0);

  v_valor_liquido := v_valor_prestador
                   + COALESCE(NEW.pedagio, 0)
                   + v_outros_custos;

  -- 1. financeiro_receber (padrao PERFORM + IF, evita UNIQUE constraint)
  IF v_valor_cliente > 0 THEN
    PERFORM 1 FROM financeiro_receber WHERE os_id = NEW.id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_receber (
        os_id, descricao, valor, data_vencimento, status,
        cliente, cliente_nome, cliente_id
      ) VALUES (
        NEW.id::TEXT,
        'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        v_valor_cliente,
        v_data_venc_30,
        CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
        v_cliente_nome,
        v_cliente_nome,
        NEW.cliente_id::UUID
      );
    ELSE
      UPDATE financeiro_receber SET
        valor          = v_valor_cliente,
        cliente        = v_cliente_nome,
        cliente_nome   = v_cliente_nome,
        cliente_id     = NEW.cliente_id::UUID,
        status         = CASE WHEN v_is_finalizada THEN 'aberto'
                              WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END,
        descricao      = 'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        data_vencimento = v_data_venc_30,
        updated_at     = NOW()
      WHERE os_id = NEW.id::TEXT;
    END IF;
  END IF;

  -- 2. financeiro_pagar
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM financeiro_pagar WHERE os_id = NEW.id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_pagar (
        os_id, descricao, valor, data_vencimento, status,
        prestador, fornecedor_id, fornecedor_nome
      ) VALUES (
        NEW.id::TEXT,
        'Repasse ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        v_valor_prestador,
        v_data_venc_30,
        CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
        v_prestador_nome,
        NEW.prestador_id::UUID,
        v_prestador_nome
      );
    ELSE
      UPDATE financeiro_pagar SET
        valor          = v_valor_prestador,
        prestador      = v_prestador_nome,
        fornecedor_id  = NEW.prestador_id::UUID,
        fornecedor_nome = v_prestador_nome,
        status         = CASE WHEN v_is_finalizada THEN 'aberto'
                              WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END,
        data_vencimento = v_data_venc_30,
        updated_at     = NOW()
      WHERE os_id = NEW.id::TEXT;
    END IF;
  END IF;

  -- 3. pagamentos_prestadores
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM pagamentos_prestadores WHERE os_id = NEW.id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO pagamentos_prestadores (
        prestador_id, prestador_nome, prestador_documento,
        os_id, qtd_os,
        valor_liquido, valor_servicos, pedagio, adicionais,
        status_conferencia, status_pagamento,
        origem_lancamento, quantidade_os,
        categoria_financeira, data_prevista_pagamento,
      competencia, impacto_dre, impacto_fluxo_caixa,
      periodo_inicio, periodo_fim
    ) VALUES (
      NEW.prestador_id::UUID,
      v_prestador_nome,
      COALESCE(v_prestador_doc, ''),
      NEW.id,
      1,
      v_valor_liquido,
        v_valor_prestador,
        COALESCE(NEW.pedagio, 0),
        v_outros_custos,
      'em_aberto',
      'pendente',
      'os_direta',
      1,
      'Custo Logístico',
      v_data_venc_30,
      CURRENT_DATE,
      true, true,
      CURRENT_DATE, CURRENT_DATE
      );
    ELSE
      UPDATE pagamentos_prestadores SET
        prestador_id        = NEW.prestador_id::UUID,
        prestador_nome      = v_prestador_nome,
        prestador_documento = COALESCE(v_prestador_doc, ''),
        valor_liquido       = v_valor_liquido,
        valor_servicos      = v_valor_prestador,
        pedagio             = COALESCE(NEW.pedagio, 0),
        adicionais          = v_outros_custos,
        status_conferencia  = 'em_aberto',
        competencia         = CURRENT_DATE,
        updated_at          = NOW()
      WHERE os_id = NEW.id;
    END IF;
  END IF;

  -- 4. composicao_financeira_os (apenas na finalizacao)
  IF v_is_finalizada AND v_valor_cliente > 0 THEN
    v_imposto_valor  := ROUND(v_valor_cliente * 4.5 / 100, 2);
    v_seguro_valor   := ROUND(v_valor_cliente * 0.01, 2);
    v_margem_bruta   := v_valor_cliente
                      - v_valor_prestador
                      - COALESCE(NEW.pedagio, 0)
                      - v_outros_custos;
    v_margem_liquida := v_margem_bruta - v_imposto_valor - v_seguro_valor;

    PERFORM 1 FROM composicao_financeira_os WHERE os_id = NEW.id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO composicao_financeira_os (
        os_id, cliente_id, prestador_id,
        valor_cliente, valor_prestador,
        imposto_percentual, imposto_valor, seguro_valor,
        pedagio_valor, outros_custos,
        margem_bruta, margem_liquida,
        percentual_margem_bruta, percentual_margem_liquida,
        origem_calculo
      ) VALUES (
        NEW.id,
        NEW.cliente_id::UUID,
        NEW.prestador_id::UUID,
        v_valor_cliente,
        v_valor_prestador,
        4.5,
        v_imposto_valor,
        v_seguro_valor,
        COALESCE(NEW.pedagio, 0),
        v_outros_custos,
        v_margem_bruta,
        v_margem_liquida,
        CASE WHEN v_valor_cliente > 0
             THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
             ELSE 0 END,
        CASE WHEN v_valor_cliente > 0
             THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
             ELSE 0 END,
        'os_direta'
      );
    ELSE
      UPDATE composicao_financeira_os SET
        valor_cliente              = v_valor_cliente,
        valor_prestador            = v_valor_prestador,
        imposto_percentual         = 4.5,
        imposto_valor              = v_imposto_valor,
        seguro_valor               = v_seguro_valor,
        pedagio_valor              = COALESCE(NEW.pedagio, 0),
        outros_custos              = v_outros_custos,
        margem_bruta               = v_margem_bruta,
        margem_liquida             = v_margem_liquida,
        percentual_margem_bruta    = CASE WHEN v_valor_cliente > 0
                                          THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
                                          ELSE 0 END,
        percentual_margem_liquida  = CASE WHEN v_valor_cliente > 0
                                          THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
                                          ELSE 0 END,
        origem_calculo             = 'os_direta'
      WHERE os_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
