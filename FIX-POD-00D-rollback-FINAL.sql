-- ============================================================================
-- FIX-POD-00D-rollback-FINAL.sql
-- Restores EXACTLY the LIVE production function (before FIX-POD-00D)
-- NO ALTER TABLE — NO DROP COLUMN — NO schema changes
-- ============================================================================

BEGIN;

-- ============================================================================
-- Part 1: Restore LIVE production function (exactly as before)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_alocacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$

DECLARE
  v_cliente_nome TEXT; v_prestador_nome TEXT; v_prestador_doc TEXT;
  v_os_id UUID; v_os_numero TEXT; v_data_venc_30 DATE;
  v_valor_cliente NUMERIC; v_valor_prestador NUMERIC;
  v_pedagio_valor NUMERIC; v_adicional_valor NUMERIC;
  v_ajudante_valor NUMERIC; v_desconto_valor NUMERIC;
  v_outros_custos NUMERIC; v_valor_liquido NUMERIC;
  v_is_concluida BOOLEAN; v_error_msg TEXT;
  v_fallback_cliente TEXT; v_fallback_prestador TEXT;
  v_status_financeiro TEXT;
  v_reversa_cliente NUMERIC; v_reversa_prestador NUMERIC;
  v_execucao_id UUID;
BEGIN
  v_execucao_id := gen_random_uuid();
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  BEGIN
    v_valor_cliente := COALESCE(NEW.valor_frete, 0);
    v_valor_prestador := COALESCE(NEW.valor_repasse, 0);
    v_pedagio_valor := COALESCE(NEW.valor_pedagio, 0);
    v_adicional_valor := COALESCE(NEW.valor_adicional, 0);
    v_ajudante_valor := COALESCE(NEW.valor_ajudante, 0);
    v_desconto_valor := COALESCE(NEW.valor_desconto_prestador, 0);
    v_reversa_cliente := COALESCE(NEW.reversa_valor_cliente, 0);
    v_reversa_prestador := COALESCE(NEW.reversa_valor_prestador, 0);
    IF v_valor_cliente = 0 AND v_valor_prestador = 0 AND v_reversa_cliente = 0 AND v_reversa_prestador = 0 THEN RETURN NEW; END IF;
    v_valor_cliente := v_valor_cliente + v_reversa_cliente;
    v_valor_prestador := v_valor_prestador + v_reversa_prestador;
    v_fallback_cliente := COALESCE(NEW.cliente_id::TEXT, 'cliente_nao_informado');
    v_fallback_prestador := COALESCE(NEW.prestador_id::TEXT, 'prestador_nao_informado');
    BEGIN
      SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || v_fallback_cliente) INTO STRICT v_cliente_nome FROM clientes c WHERE c.id = NEW.cliente_id;
    EXCEPTION WHEN OTHERS THEN v_cliente_nome := 'Cliente #' || v_fallback_cliente; END;
    BEGIN
      SELECT COALESCE(p.nome_completo, 'Prestador #' || v_fallback_prestador), COALESCE(p.cpf_cnpj, '') INTO STRICT v_prestador_nome, v_prestador_doc FROM prestadores p WHERE p.id = NEW.prestador_id;
    EXCEPTION WHEN OTHERS THEN v_prestador_nome := 'Prestador #' || v_fallback_prestador; v_prestador_doc := ''; END;
    v_data_venc_30 := CURRENT_DATE + 30;
    v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);
    v_status_financeiro := CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END;
    IF NEW.ordem_servico_id IS NOT NULL THEN
      v_os_id := NEW.ordem_servico_id;
      v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    ELSE
      v_os_id := NEW.id;
      v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    END IF;
    v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor;
    v_valor_liquido := v_valor_prestador + v_pedagio_valor + v_outros_custos;
    -- OS (preservado do comportamento pre-02B; casts corrigidos para schema real)
    BEGIN
      INSERT INTO ordens_servico (id, numero, cliente, cliente_id, prestador, prestador_id, status, data, tipo_veiculo, origem, destino, valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, tipo_reversa, reversa_qtd_volumes, observacoes_gerais, created_at, updated_at)
      VALUES (v_os_id, v_os_numero, NEW.cliente_id, v_cliente_nome, NEW.prestador_id, v_prestador_nome, CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END, COALESCE(NEW.data_escala, CURRENT_DATE), NEW.tipo_veiculo, NEW.origem, NEW.destino, v_valor_cliente, v_valor_prestador, v_pedagio_valor, to_jsonb(v_adicional_valor), to_jsonb(v_ajudante_valor), v_desconto_valor, NEW.tipo_reversa, NEW.reversa_qtd_volumes, NEW.observacoes, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END, valor_cliente = v_valor_cliente, custo_prestador = v_valor_prestador, tipo_reversa = COALESCE(NEW.tipo_reversa, ordens_servico.tipo_reversa), updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN NULL; END;
    -- Receber
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (os_id, descricao, valor, data_vencimento, status, cliente, cliente_nome, cliente_id)
        VALUES (v_os_id::TEXT, 'Faturamento ' || v_os_numero || CASE WHEN v_reversa_cliente > 0 THEN ' (c/ reversa)' ELSE '' END, v_valor_cliente, v_data_venc_30, v_status_financeiro, v_cliente_nome, v_cliente_nome, NEW.cliente_id)
        ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_cliente, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_receber.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Pagar (CORRECAO: valor = v_valor_liquido)
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (os_id, descricao, valor, data_vencimento, status, prestador, fornecedor_id, fornecedor_nome, desconto)
        VALUES (v_os_id::TEXT, 'Repasse ' || v_os_numero || CASE WHEN v_reversa_prestador > 0 THEN ' (c/ reversa)' ELSE '' END, v_valor_liquido, v_data_venc_30, v_status_financeiro, v_prestador_nome, NEW.prestador_id, v_prestador_nome, v_desconto_valor)
        ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_liquido, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_pagar.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30, fornecedor_id = NEW.prestador_id, fornecedor_nome = v_prestador_nome, desconto = v_desconto_valor, prestador = v_prestador_nome;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Pagamentos prestadores
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO pagamentos_prestadores (prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, valor_servicos, pedagio, adicionais, status_conferencia, status_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, categoria_financeira, data_prevista_pagamento, competencia, impacto_dre, impacto_fluxo_caixa)
        VALUES (NEW.prestador_id, v_prestador_nome, v_prestador_doc, v_os_id, v_valor_liquido, v_valor_prestador, v_pedagio_valor, v_outros_custos, CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END, CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END, 'escala_direta', 1, COALESCE(NEW.data_escala, CURRENT_DATE), COALESCE(NEW.data_escala, CURRENT_DATE), 'Custo Logistico', v_data_venc_30, COALESCE(NEW.data_escala, CURRENT_DATE), true, true)
        ON CONFLICT (os_id) DO UPDATE SET valor_liquido = v_valor_liquido, valor_servicos = v_valor_prestador, status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END, prestador_id = NEW.prestador_id, prestador_nome = v_prestador_nome, prestador_documento = COALESCE(v_prestador_doc, '');
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Composicao
    IF v_is_concluida AND v_valor_cliente > 0 THEN
      DECLARE v_imp NUMERIC; v_seg NUMERIC; v_mb NUMERIC; v_ml NUMERIC; BEGIN
        v_imp := ROUND(v_valor_cliente * 4.5 / 100, 2);
        v_seg := ROUND(v_valor_cliente * 0.01, 2);
        v_mb := v_valor_cliente - v_valor_prestador - v_pedagio_valor - v_outros_custos;
        v_ml := v_mb - v_imp - v_seg;
        INSERT INTO composicao_financeira_os (os_id, cliente_id, prestador_id, valor_cliente, valor_prestador, imposto_percentual, imposto_valor, seguro_valor, pedagio_valor, outros_custos, combustivel_valor, ajudante_valor, adicional_valor, desconto_valor, margem_bruta, margem_liquida, percentual_margem_bruta, percentual_margem_liquida, origem_calculo)
        VALUES (v_os_id, NEW.cliente_id, NEW.prestador_id, v_valor_cliente, v_valor_prestador, 4.5, v_imp, v_seg, v_pedagio_valor, v_outros_custos, 0, v_ajudante_valor, v_adicional_valor, v_desconto_valor, v_mb, v_ml, CASE WHEN v_valor_cliente > 0 THEN ROUND(v_mb / v_valor_cliente * 100, 2) ELSE 0 END, CASE WHEN v_valor_cliente > 0 THEN ROUND(v_ml / v_valor_cliente * 100, 2) ELSE 0 END, 'escala_direta')
        ON CONFLICT (os_id) DO UPDATE SET valor_cliente = v_valor_cliente, valor_prestador = v_valor_prestador, margem_bruta = v_mb, margem_liquida = v_ml;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[M108F] Erro (alocacao %): %', NEW.id, v_error_msg;
    RETURN NEW;
  END;
END;

$function$;

-- ============================================================================
-- Part 2: Recreate trigger event (idempotent, preserves existing definition)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON public.alocacoes_escala;
CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
    valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional,
    valor_desconto, valor_desconto_prestador, tipo_reversa,
    reversa_valor_cliente, reversa_valor_prestador, prestador_id
  ON public.alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

COMMIT;
