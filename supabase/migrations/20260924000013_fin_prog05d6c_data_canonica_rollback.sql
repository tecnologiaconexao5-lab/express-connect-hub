-- ============================================================================
-- TMS-FIN-PROG-05D.6C — ROLLBACK
-- Restaura f_trg_propagar_financeiro_os (periodo/competencia = CURRENT_DATE)
-- e o trigger original (sem 'data' na lista UPDATE OF).
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
      INTO STRICT v_cliente_nome FROM clientes c WHERE c.id = NEW.cliente;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    v_cliente_nome := COALESCE(NEW.cliente::TEXT, 'Cliente #' || NEW.cliente_id);
  WHEN OTHERS THEN
    v_cliente_nome := COALESCE(NEW.cliente::TEXT, NEW.cliente_id, 'Cliente');
  END;
  BEGIN
    SELECT COALESCE(p.nome_completo, 'Prestador #' || NEW.prestador_id), COALESCE(p.cpf_cnpj, '')
      INTO STRICT v_prestador_nome, v_prestador_doc FROM prestadores p WHERE p.id = NEW.prestador;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    v_prestador_nome := COALESCE(NEW.prestador::TEXT, 'Prestador #' || NEW.prestador_id);
    v_prestador_doc := '';
  WHEN OTHERS THEN
    v_prestador_nome := COALESCE(NEW.prestador::TEXT, NEW.prestador_id, 'Prestador');
    v_prestador_doc := '';
  END;
  v_data_venc_30  := CURRENT_DATE + 30;
  v_is_finalizada := (NEW.status = 'finalizada');
  v_outros_custos := COALESCE((CASE WHEN NEW.adicionais IS NULL THEN 0 WHEN jsonb_typeof(NEW.adicionais)='number' THEN (NEW.adicionais #>> '{}')::NUMERIC ELSE COALESCE((NEW.adicionais->>'valor')::NUMERIC,0) END),0)
    + COALESCE((CASE WHEN NEW.ajudante IS NULL THEN 0 WHEN jsonb_typeof(NEW.ajudante)='number' THEN (NEW.ajudante #>> '{}')::NUMERIC ELSE COALESCE((NEW.ajudante->>'valor')::NUMERIC,0) END),0)
    - COALESCE(NEW.descontos, 0);
  v_valor_liquido := v_valor_prestador + COALESCE(NEW.pedagio, 0) + v_outros_custos;
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM financeiro_pagar WHERE os_id = NEW.id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_pagar (os_id, descricao, valor, data_vencimento, status, prestador, fornecedor_id, fornecedor_nome)
      VALUES (NEW.id::TEXT, 'Repasse ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT,1,8)), v_valor_liquido, v_data_venc_30,
              CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END, v_prestador_nome, NEW.prestador, v_prestador_nome);
    ELSE
      UPDATE financeiro_pagar SET valor=v_valor_liquido, prestador=v_prestador_nome, fornecedor_id=NEW.prestador,
        fornecedor_nome=v_prestador_nome,
        status=CASE WHEN v_is_finalizada THEN 'aberto' WHEN financeiro_pagar.status='aberto' THEN 'aberto' ELSE 'pendente' END,
        data_vencimento=v_data_venc_30, updated_at=NOW()
      WHERE os_id = NEW.id::TEXT AND status NOT IN ('pago','parcial','cancelado','cancelada');
    END IF;
  END IF;
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM pagamentos_prestadores WHERE os_id = NEW.id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO pagamentos_prestadores (prestador_id, prestador_nome, prestador_documento, os_id, qtd_os, valor_liquido, valor_servicos, pedagio, adicionais, status_conferencia, status_pagamento, origem_lancamento, quantidade_os, categoria_financeira, data_prevista_pagamento, competencia, impacto_dre, impacto_fluxo_caixa, periodo_inicio, periodo_fim)
      VALUES (NEW.prestador, v_prestador_nome, COALESCE(v_prestador_doc,''), NEW.id, 1, v_valor_liquido, v_valor_prestador, COALESCE(NEW.pedagio,0), v_outros_custos, 'em_aberto', 'pendente', 'os_direta', 1, 'Custo Logístico', v_data_venc_30, CURRENT_DATE, true, true, CURRENT_DATE, CURRENT_DATE);
    ELSE
      UPDATE pagamentos_prestadores SET prestador_id=NEW.prestador, prestador_nome=v_prestador_nome, prestador_documento=COALESCE(v_prestador_doc,''), valor_liquido=v_valor_liquido, valor_servicos=v_valor_prestador, pedagio=COALESCE(NEW.pedagio,0), adicionais=v_outros_custos, status_conferencia='em_aberto', competencia=CURRENT_DATE, updated_at=NOW()
      WHERE os_id = NEW.id AND status_pagamento NOT IN ('pago','cancelado');
    END IF;
  END IF;
  IF v_is_finalizada AND v_valor_cliente > 0 THEN
    v_imposto_valor  := ROUND(v_valor_cliente * 4.5 / 100, 2);
    v_seguro_valor   := ROUND(v_valor_cliente * 0.01, 2);
    v_margem_bruta   := v_valor_cliente - v_valor_prestador - COALESCE(NEW.pedagio,0) - v_outros_custos;
    v_margem_liquida := v_margem_bruta - v_imposto_valor - v_seguro_valor;
    PERFORM 1 FROM composicao_financeira_os WHERE os_id = NEW.id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO composicao_financeira_os (os_id, cliente_id, prestador_id, valor_cliente, valor_prestador, imposto_percentual, imposto_valor, seguro_valor, pedagio_valor, outros_custos, margem_bruta, margem_liquida, percentual_margem_bruta, percentual_margem_liquida, origem_calculo)
      VALUES (NEW.id, NEW.cliente, NEW.prestador, v_valor_cliente, v_valor_prestador, 4.5, v_imposto_valor, v_seguro_valor, COALESCE(NEW.pedagio,0), v_outros_custos, v_margem_bruta, v_margem_liquida, CASE WHEN v_valor_cliente>0 THEN ROUND(v_margem_bruta/v_valor_cliente*100,2) ELSE 0 END, CASE WHEN v_valor_cliente>0 THEN ROUND(v_margem_liquida/v_valor_cliente*100,2) ELSE 0 END, 'os_direta');
    ELSE
      UPDATE composicao_financeira_os SET valor_cliente=v_valor_cliente, valor_prestador=v_valor_prestador, imposto_percentual=4.5, imposto_valor=v_imposto_valor, seguro_valor=v_seguro_valor, pedagio_valor=COALESCE(NEW.pedagio,0), outros_custos=v_outros_custos, margem_bruta=v_margem_bruta, margem_liquida=v_margem_liquida, origem_calculo='os_direta' WHERE os_id=NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagar_financeiro_os ON public.ordens_servico;
CREATE TRIGGER trg_propagar_financeiro_os
  AFTER INSERT OR UPDATE OF valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, status
  ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_os();

COMMIT;
