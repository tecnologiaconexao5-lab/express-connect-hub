-- ============================================================================
-- TMS-FIN-PROG-05D.6C — DATA CANONICA DO SERVICO EM pagamentos_prestadores
-- ----------------------------------------------------------------------------
-- REGRA CANONICA APROVADA:
--   * Programacao Operacional (M66): data_servico = alocacoes_escala.data_escala
--   * OS direta (M80):              data_servico = ordens_servico.data
--   * manual: preservar periodo/data informados pelo usuario (nao alterado)
--
-- PROVA DE SEMANTICA: ordens_servico.data e a data operacional do servico —
--   M66 grava ordens_servico.data = COALESCE(data_escala, CURRENT_DATE) e o
--   numero da OS = 'ALOC-' || TO_CHAR(data_escala,'YYYYMMDD'); amostras reais
--   confirmam data == dia operacional. data_escala e NOT NULL.
--
-- ESCOPO DESTA MIGRATION:
--   B) M80: substitui CURRENT_DATE por NEW.data em periodo_inicio/periodo_fim
--           e alinha competencia (competencia do servico).
--      Data nula: NAO usa CURRENT_DATE silenciosamente -> NAO cria a provisao
--           pagamentos_prestadores e emite WARNING explicito (pendencia).
--   C) competencia: alinhada a data canonica (era CURRENT_DATE no M80).
--   D) periodo_inicio = periodo_fim = data_servico (provisao individual).
--   M66 NAO e alterado (ja usa data_escala — correto).
--   Demais regras financeiras do M80 (financeiro_pagar, composicao, valores)
--   permanecem INALTERADAS.
--   Adiciona 'data' a lista UPDATE OF do trigger para permitir resolver a
--   pendencia quando a data for preenchida depois.
-- ============================================================================

BEGIN;

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
  v_data_servico       DATE;   -- 05D.6C: data canonica do servico
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  v_valor_cliente   := COALESCE(NEW.valor_cliente, 0);
  v_valor_prestador := COALESCE(NEW.custo_prestador, 0);

  IF v_valor_cliente = 0 AND v_valor_prestador = 0 THEN
    RETURN NEW;
  END IF;

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
  v_data_servico  := NEW.data;   -- 05D.6C: data canonica (operacional)

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

  -- TMS-FIN-PROG-05B: AR do cliente REMOVIDO (fonte unica = f_emitir_fatura).

  -- 2. financeiro_pagar (INALTERADO)
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM financeiro_pagar WHERE os_id = NEW.id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_pagar (
        os_id, descricao, valor, data_vencimento, status,
        prestador, fornecedor_id, fornecedor_nome
      ) VALUES (
        NEW.id::TEXT,
        'Repasse ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        v_valor_liquido,
        v_data_venc_30,
        CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
        v_prestador_nome,
        NEW.prestador,
        v_prestador_nome
      );
    ELSE
      UPDATE financeiro_pagar SET
        valor          = v_valor_liquido,
        prestador      = v_prestador_nome,
        fornecedor_id  = NEW.prestador,
        fornecedor_nome = v_prestador_nome,
        status         = CASE WHEN v_is_finalizada THEN 'aberto'
                              WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END,
        data_vencimento = v_data_venc_30,
        updated_at     = NOW()
      WHERE os_id = NEW.id::TEXT AND status NOT IN ('pago','parcial','cancelado','cancelada');
    END IF;
  END IF;

  -- 3. pagamentos_prestadores (05D.6C: periodo/competencia = data canonica)
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    IF v_data_servico IS NULL THEN
      -- Pendencia explicita: NAO inventar data (nao usa CURRENT_DATE).
      RAISE WARNING '[PAGAMENTO_PRESTADOR_SEM_DATA] OS % sem data operacional; provisao em pagamentos_prestadores NAO criada.', NEW.id;
    ELSE
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
          NEW.prestador,
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
          v_data_servico,
          true, true,
          v_data_servico, v_data_servico
        );
      ELSE
        UPDATE pagamentos_prestadores SET
          prestador_id        = NEW.prestador,
          prestador_nome      = v_prestador_nome,
          prestador_documento = COALESCE(v_prestador_doc, ''),
          valor_liquido       = v_valor_liquido,
          valor_servicos      = v_valor_prestador,
          pedagio             = COALESCE(NEW.pedagio, 0),
          adicionais          = v_outros_custos,
          status_conferencia  = 'em_aberto',
          competencia         = v_data_servico,
          periodo_inicio      = v_data_servico,
          periodo_fim         = v_data_servico,
          updated_at          = NOW()
        WHERE os_id = NEW.id AND status_pagamento NOT IN ('pago','cancelado');
      END IF;
    END IF;
  END IF;

  -- 4. composicao_financeira_os (INALTERADO)
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
        NEW.cliente,
        NEW.prestador,
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
$function$;

DROP TRIGGER IF EXISTS trg_propagar_financeiro_os ON public.ordens_servico;
CREATE TRIGGER trg_propagar_financeiro_os
  AFTER INSERT OR UPDATE OF valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, status, data
  ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_os();

COMMIT;
