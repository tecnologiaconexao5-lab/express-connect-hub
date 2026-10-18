-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN-SANE-02B — Unificação de financeiro_pagar.valor com valor_liquido
-- Data: 2026-09-13
-- Projeto: TMS (Supabase Produção: uwrvzsjtpgaifkktpepn)
--
-- Objetivo:
--   1. Corrigir triggers M66 e M80 para que financeiro_pagar.valor represente
--      a OBRIGAÇÃO TOTAL do prestador (= v_valor_liquido).
--   2. Criar RPC transacional f_confirmar_pagamento_fechamento para pagamento
--      atômico de fechamento.
--   3. Snapshot e ajuste seguro dos títulos históricos NÃO pagos que estejam
--      vinculados a pagamentos_prestadores.
--
-- ADITIVA / SEGURA:
--   - Não remove dados.
--   - Não altera títulos já pagos, cancelados ou estornados.
--   - Não altera baixas históricas.
--   - Não altera despesas genéricas sem vínculo a prestador/OS.
--   - Preserva UNIQUE(os_id) e demais constraints.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 0 — Snapshot de segurança
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fin_sane_02b_snapshot (
    id              SERIAL PRIMARY KEY,
    financeiro_pagar_id UUID NOT NULL,
    os_id           TEXT,
    pagamento_prestador_id UUID,
    prestador_id    UUID,
    valor_anterior  NUMERIC(18,2),
    valor_novo      NUMERIC(18,2),
    status_anterior TEXT,
    motivo          TEXT,
    processado_em   TIMESTAMPTZ DEFAULT NOW(),
    execucao_id     UUID DEFAULT gen_random_uuid()
);

COMMENT ON TABLE public.fin_sane_02b_snapshot IS
  'FIN-SANE-02B — Snapshot dos valores de financeiro_pagar alterados pela migration.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 1 — Trigger M66 corrigido (alocacoes_escala)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Alteração: financeiro_pagar.valor = v_valor_liquido (obrigação total)
-- Demais lógicas preservadas integralmente.
-- ═══════════════════════════════════════════════════════════════════════════════

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
    -- OS (preservado do comportamento pré-02B; casts corrigidos para schema real)
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
    -- Pagar (CORREÇÃO: valor = v_valor_liquido)
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

DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON public.alocacoes_escala;
CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto, valor_desconto_prestador, tipo_reversa, reversa_valor_cliente, reversa_valor_prestador, prestador_id
  ON public.alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

COMMENT ON FUNCTION public.f_trg_propagar_financeiro_alocacao() IS
  'FIN-SANE-02B — Propagacao financeira de alocacoes_escala. financeiro_pagar.valor = valor_liquido total do prestador.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 2 — Trigger M80 corrigido (ordens_servico)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Alteração: financeiro_pagar.valor = v_valor_liquido (obrigação total)
-- Demais lógicas preservadas integralmente.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_os()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- 1. financeiro_receber
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
        NEW.cliente
      );
    ELSE
      UPDATE financeiro_receber SET
        valor          = v_valor_cliente,
        cliente        = v_cliente_nome,
        cliente_nome   = v_cliente_nome,
        cliente_id     = NEW.cliente,
        status         = CASE WHEN v_is_finalizada THEN 'aberto'
                              WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END,
        descricao      = 'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        data_vencimento = v_data_venc_30,
        updated_at     = NOW()
      WHERE os_id = NEW.id::TEXT;
    END IF;
  END IF;

  -- 2. financeiro_pagar (CORREÇÃO: valor = v_valor_liquido)
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
        CURRENT_DATE,
        true, true,
        CURRENT_DATE, CURRENT_DATE
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
        competencia         = CURRENT_DATE,
        updated_at          = NOW()
      WHERE os_id = NEW.id;
    END IF;
  END IF;

    -- 4. composicao_financeira_os (apenas na finalização)
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
$$;

DROP TRIGGER IF EXISTS trg_propagar_financeiro_os ON public.ordens_servico;
CREATE TRIGGER trg_propagar_financeiro_os
  AFTER INSERT OR UPDATE OF valor_cliente, custo_prestador,
                             pedagio, adicionais, ajudante, descontos, status
  ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_os();

COMMENT ON FUNCTION public.f_trg_propagar_financeiro_os() IS
  'FIN-SANE-02B — Propagacao financeira de ordens_servico. financeiro_pagar.valor = valor_liquido total do prestador.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 3 — RPC transacional para pagamento de fechamento
-- ═══════════════════════════════════════════════════════════════════════════════
-- Garante atomicidade: se qualquer item falhar, toda a transação é desfeita.
-- Reutiliza f_confirmar_pagamento_prestador para cada item.
-- Itens já pagos são ignorados (idempotência).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_fechamento(
    p_fechamento_id UUID,
    p_data_pagamento DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    sucesso BOOLEAN,
    mensagem TEXT,
    fechamento_id UUID,
    itens_processados INTEGER,
    itens_ignorados INTEGER,
    total_baixas INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fechamento       RECORD;
    v_item             RECORD;
    v_res              RECORD;
    v_data             DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_processados      INTEGER := 0;
    v_ignorados        INTEGER := 0;
    v_total_baixas     INTEGER := 0;
    v_total_itens      INTEGER := 0;
    v_total_valor      NUMERIC(18,2) := 0;
BEGIN
    -- 1. Valida fechamento
    SELECT id, status_pagamento, status_aprovacao, status_conferencia, status, valor_liquido
      INTO v_fechamento
      FROM public.pagamentos_prestadores
     WHERE id = p_fechamento_id
       AND tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Fechamento nao encontrado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_pagamento = 'pago' OR v_fechamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Fechamento ja esta pago.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_aprovacao <> 'aprovado' THEN
        RETURN QUERY SELECT false, 'Fechamento nao esta aprovado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 1.1 Reconciliacao: soma dos itens deve bater com o valor do fechamento
    SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0)
      INTO v_total_itens, v_total_valor
      FROM public.pagamentos_prestadores
     WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
       AND pagamentos_prestadores.id <> p_fechamento_id;

    IF v_total_itens = 0 THEN
        RETURN QUERY SELECT false, 'Fechamento nao possui itens vinculados.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF ROUND(COALESCE(v_fechamento.valor_liquido, 0)::NUMERIC, 2) <> ROUND(v_total_valor, 2) THEN
        RETURN QUERY SELECT false,
                            'Divergencia de valores no fechamento: fechamento=' || COALESCE(v_fechamento.valor_liquido, 0) || ', itens=' || v_total_valor || '.',
                            p_fechamento_id,
                            0,
                            0,
                            0;
        RETURN;
    END IF;

    -- 2. Itera pelos itens vinculados
    FOR v_item IN
        SELECT id, status_pagamento, status
          FROM public.pagamentos_prestadores
         WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
           AND pagamentos_prestadores.id <> p_fechamento_id
         ORDER BY id
    LOOP
        -- Idempotência: ignora itens já pagos
        IF v_item.status_pagamento = 'pago' OR v_item.status = 'pago' THEN
            v_ignorados := v_ignorados + 1;
            CONTINUE;
        END IF;

        IF v_item.status_pagamento = 'cancelado' OR v_item.status = 'cancelado' THEN
            RAISE EXCEPTION 'Item % do fechamento esta cancelado; pagamento nao pode prosseguir.', v_item.id;
        END IF;

        -- Chama RPC existente para cada item (mesma transação)
        SELECT r.sucesso, r.mensagem, r.baixa_id
          INTO v_res
          FROM public.f_confirmar_pagamento_prestador(v_item.id, v_data) r;

        IF NOT v_res.sucesso THEN
            RAISE EXCEPTION 'Item % do fechamento falhou: %', v_item.id, COALESCE(v_res.mensagem, 'erro desconhecido');
        END IF;

        v_processados := v_processados + 1;
        IF v_res.baixa_id IS NOT NULL THEN
            v_total_baixas := v_total_baixas + 1;
        END IF;
    END LOOP;

    -- 3. Atualiza fechamento para pago
    UPDATE public.pagamentos_prestadores
       SET status = 'pago',
           status_pagamento = 'pago',
           status_conferencia = 'conferido',
           data_pagamento = v_data
     WHERE id = p_fechamento_id;

    RETURN QUERY SELECT true,
                        'Fechamento pago com sucesso. Itens processados: ' || v_processados || ', ignorados: ' || v_ignorados || ', baixas: ' || v_total_baixas || '.',
                        p_fechamento_id,
                        v_processados,
                        v_ignorados,
                        v_total_baixas;
END;
$$;

REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) TO service_role;

COMMENT ON FUNCTION public.f_confirmar_pagamento_fechamento(uuid, date) IS
  'FIN-SANE-02B — Pagamento atômico de fechamento de prestador. Reutiliza f_confirmar_pagamento_prestador por item.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 4 — Snapshot e ajuste seguro de títulos históricos
-- ═══════════════════════════════════════════════════════════════════════════════
-- Critérios de elegibilidade:
--   - financeiro_pagar.status NÃO está em ('pago','paga','cancelado','cancelada','estornado')
--   - Existe pagamentos_prestadores vinculado pelo mesmo os_id
--   - pagamentos_prestadores.tipo_pagamento IS DISTINCT FROM 'fechamento'
--   - Valores diferem (arredondados em 2 casas)
--   - fornecedor_id coincide com prestador_id (garantia de vínculo seguro)
--
-- Exclui automaticamente:
--   - Títulos já pagos/cancelados/estornados
--   - Títulos sem OS correspondente em pagamentos_prestadores
--   - Fechamentos (tipo_pagamento = 'fechamento')
--   - Despesas genéricas sem vínculo prestador/OS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_execucao_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.fin_sane_02b_snapshot (
      financeiro_pagar_id,
      os_id,
      pagamento_prestador_id,
      prestador_id,
      valor_anterior,
      valor_novo,
      status_anterior,
      motivo,
      execucao_id
  )
  SELECT
      fp.id,
      fp.os_id,
      pp.id,
      fp.fornecedor_id,
      fp.valor,
      pp.valor_liquido,
      fp.status,
      'Atualizacao FIN-SANE-02B: valor_anterior=base, valor_novo=valor_liquido',
      v_execucao_id
  FROM public.financeiro_pagar fp
  INNER JOIN public.pagamentos_prestadores pp
         ON pp.os_id::TEXT = fp.os_id
        AND pp.prestador_id = fp.fornecedor_id
  WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
    AND fp.os_id IS NOT NULL
    AND fp.fornecedor_id IS NOT NULL
    AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
    AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2);

  -- ═══════════════════════════════════════════════════════════════════════════════
  -- SEÇÃO 5 — UPDATE seguro dos títulos elegíveis
  -- ═══════════════════════════════════════════════════════════════════════════════
  -- Atualiza SOMENTE os registros snapshotados na seção anterior.
  -- Usa CTE para garantir que só altera os ids presentes no snapshot desta execução.
  -- ═══════════════════════════════════════════════════════════════════════════════

  WITH candidatos AS (
      SELECT DISTINCT ON (s.financeiro_pagar_id)
             s.financeiro_pagar_id,
             s.valor_novo
        FROM public.fin_sane_02b_snapshot s
       WHERE s.execucao_id = v_execucao_id
         AND s.valor_novo IS NOT NULL
         AND s.valor_novo >= 0
  )
  UPDATE public.financeiro_pagar fp
     SET valor = c.valor_novo,
         updated_at = NOW()
    FROM candidatos c
   WHERE fp.id = c.financeiro_pagar_id
     AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 6 — Grants finais
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT ON public.fin_sane_02b_snapshot TO authenticated;
GRANT SELECT, INSERT ON public.fin_sane_02b_snapshot TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fin_sane_02b_snapshot_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.fin_sane_02b_snapshot_id_seq TO service_role;
