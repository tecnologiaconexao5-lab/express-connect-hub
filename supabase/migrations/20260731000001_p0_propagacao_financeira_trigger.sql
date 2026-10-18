-- ═══════════════════════════════════════════════════════════════════════════════
-- ⚠️  IMPORTANTE — CORREÇÃO DE REGRESSÃO (2026-07-25)
-- ═══════════════════════════════════════════════════════════════════════════════
-- A versão original deste arquivo (P0, 31/07) era uma REGRESSÃO em relação
-- à M108F (11/07). A P0 original:
--   ❌ Só disparava na conclusão (nenhum registro financeiro durante o ciclo)
--   ❌ Armazenava UUID como nome do cliente/prestador
--   ❌ Não incluía pedágio+adicionais no valor líquido do prestador
--   ❌ outros_custos = 0 fixo
--   ❌ Não calculava margens
--   ❌ Sem EXCEPTION handler (quebrava a criação da alocação se falhasse)
--
-- A trigger ATIVA em produção é a M108F (20260711_m108f_logistica_reversa).
-- Este arquivo foi CORRIGIDO para refletir o mesmo padrão M108F/M104A,
-- garantindo que mesmo se aplicado, NÃO cause regressão.
--
-- Referências:
--   ✅ M104A (07/07) — EXCEPTION handler, names lookup, custos completos
--   ✅ M108F (11/07) — Reversa, fórmula unificada, ON CONFLICT
--   📋 MISSAO74 — Auditoria documentou P0-FI1 a P0-FI9 (todas corrigidas)
-- ═══════════════════════════════════════════════════════════════════════════════
-- P0 — Trigger de Propagação Financeira Automática (CORRIGIDA)
-- Dispara em INSERT e UPDATE de status/valores financeiros em alocacoes_escala.
-- Cria/atualiza automaticamente (sempre com EXCEPTION handler):
--   ordens_servico
--   financeiro_receber
--   financeiro_pagar
--   pagamentos_prestadores
--   composicao_financeira_os
--
-- Compatível com o padrão M108F:
--   - Nunca quebra o INSERT da alocação (EXCEPTION → WARNING)
--   - Cria registros com status 'pendente' na criação, 'aberto' na conclusão
--   - Fórmula unificada: outros_custos = adicionais + ajudante - descontos
--   - Busca nomes reais de clientes/prestadores (não UUID)
--   - Inclui reversa nos totais
--   - Calcula margens na composicao_financeira_os (apenas na conclusão)
-- =============================================================================

-- =============================================================================
-- 1. Função trigger principal (reescrita = M108F + M104A)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_alocacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_nome        TEXT;
  v_prestador_nome      TEXT;
  v_prestador_doc       TEXT;
  v_os_id               UUID;
  v_os_numero           TEXT;
  v_data_venc_30        DATE;
  v_valor_cliente       NUMERIC;
  v_valor_prestador     NUMERIC;
  v_pedagio_valor       NUMERIC;
  v_adicional_valor     NUMERIC;
  v_ajudante_valor      NUMERIC;
  v_desconto_valor      NUMERIC;
  v_outros_custos       NUMERIC;
  v_valor_liquido       NUMERIC;
  v_is_concluida        BOOLEAN;
  v_error_msg           TEXT;
  v_fallback_cliente    TEXT;
  v_fallback_prestador  TEXT;
  v_status_financeiro   TEXT;
  v_reversa_cliente     NUMERIC;
  v_reversa_prestador   NUMERIC;
BEGIN
  -- Proteção: pula se alocação foi cancelada
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- Bloco protegido: erro na propagação NÃO quebra a alocação
  -- ===========================================================================
  BEGIN
    -- ------------------------------------------------------------------
    -- Valores base com coalesce
    -- ------------------------------------------------------------------
    v_valor_cliente    := COALESCE(NEW.valor_frete, 0);
    v_valor_prestador  := COALESCE(NEW.valor_repasse, 0);
    v_pedagio_valor    := COALESCE(NEW.valor_pedagio, 0);
    v_adicional_valor  := COALESCE(NEW.valor_adicional, 0);
    v_ajudante_valor   := COALESCE(NEW.valor_ajudante, 0);
    v_desconto_valor   := COALESCE(NEW.valor_desconto, 0);
    v_reversa_cliente  := COALESCE(NEW.reversa_valor_cliente, 0);
    v_reversa_prestador := COALESCE(NEW.reversa_valor_prestador, 0);

    -- Pula se não há valor financeiro a propagar
    IF v_valor_cliente = 0 AND v_valor_prestador = 0
       AND v_reversa_cliente = 0 AND v_reversa_prestador = 0 THEN
      RETURN NEW;
    END IF;

    -- Total cliente = valor_frete + receita_reversa
    -- Total prestador = valor_repasse + custo_reversa
    v_valor_cliente   := v_valor_cliente + v_reversa_cliente;
    v_valor_prestador := v_valor_prestador + v_reversa_prestador;

    -- ------------------------------------------------------------------
    -- Dados auxiliares com proteção contra NULL e STRICT
    -- ------------------------------------------------------------------
    v_fallback_cliente := COALESCE(NEW.cliente_id::TEXT, 'cliente_nao_informado');
    v_fallback_prestador := COALESCE(NEW.prestador_id::TEXT, 'prestador_nao_informado');

    BEGIN
      SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || v_fallback_cliente)
        INTO STRICT v_cliente_nome
        FROM clientes c WHERE c.id = NEW.cliente_id;
    EXCEPTION WHEN OTHERS THEN
      v_cliente_nome := 'Cliente #' || v_fallback_cliente;
    END;

    BEGIN
      SELECT COALESCE(p.nome_completo, 'Prestador #' || v_fallback_prestador),
             COALESCE(p.cpf_cnpj, '')
        INTO STRICT v_prestador_nome, v_prestador_doc
        FROM prestadores p WHERE p.id = NEW.prestador_id;
    EXCEPTION WHEN OTHERS THEN
      v_prestador_nome := 'Prestador #' || v_fallback_prestador;
      v_prestador_doc := '';
    END;

    -- ------------------------------------------------------------------
    -- Flags e IDs
    -- ------------------------------------------------------------------
    v_data_venc_30 := CURRENT_DATE + 30;
    v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);
    v_status_financeiro := CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END;

    -- Define v_os_id
    IF NEW.ordem_servico_id IS NOT NULL THEN
      v_os_id := NEW.ordem_servico_id;
      v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    ELSE
      v_os_id := NEW.id;
      v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    END IF;

    -- ------------------------------------------------------------------
    -- FÓRMULA UNIFICADA: outros_custos = adicionais + ajudante - descontos
    -- ------------------------------------------------------------------
    v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor;
    v_valor_liquido := v_valor_prestador + v_pedagio_valor + v_outros_custos;

    -- ==================================================================
    -- 1. CRIA / ATUALIZA ordens_servico
    -- ==================================================================
    BEGIN
      INSERT INTO ordens_servico (
        id, numero,
        cliente, cliente_id,
        prestador, prestador_id,
        status, data,
        tipo_veiculo, origem, destino,
        valor_cliente, custo_prestador,
        pedagio, adicionais, ajudante, descontos,
        tipo_reversa, reversa_qtd_volumes,
        observacoes_gerais, created_at, updated_at
      ) VALUES (
        v_os_id, v_os_numero,
        NEW.cliente_id, v_cliente_nome,
        NEW.prestador_id, v_prestador_nome,
        CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END,
        COALESCE(NEW.data_escala, CURRENT_DATE),
        NEW.tipo_veiculo, NEW.origem, NEW.destino,
        v_valor_cliente, v_valor_prestador,
        v_pedagio_valor, v_adicional_valor, v_ajudante_valor, v_desconto_valor,
        NEW.tipo_reversa, NEW.reversa_qtd_volumes,
        NEW.observacoes, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status          = CASE WHEN v_is_concluida THEN 'finalizada'
                               WHEN EXCLUDED.status = 'finalizada' THEN 'finalizada'
                               ELSE 'pendente' END,
        valor_cliente   = v_valor_cliente,
        custo_prestador = v_valor_prestador,
        updated_at      = NOW();
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      RAISE WARNING '[P0] Erro OS (aloc %): %', NEW.id, v_error_msg;
    END;

    -- ==================================================================
    -- 2. CRIA / ATUALIZA financeiro_receber
    -- ==================================================================
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (
          os_id, descricao, valor, data_vencimento, status,
          cliente, cliente_nome, cliente_id
        ) VALUES (
          v_os_id::TEXT,
          'Faturamento ' || v_os_numero || CASE WHEN v_reversa_cliente > 0 THEN ' (c/ reversa)' ELSE '' END,
          v_valor_cliente, v_data_venc_30, v_status_financeiro,
          v_cliente_nome, v_cliente_nome, NEW.cliente_id
        )
        ON CONFLICT (os_id) DO UPDATE SET
          valor          = v_valor_cliente,
          cliente        = v_cliente_nome,
          cliente_nome   = v_cliente_nome,
          cliente_id     = NEW.cliente_id,
          status         = CASE WHEN v_is_concluida THEN 'aberto'
                                WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                                ELSE 'pendente' END,
          data_vencimento = v_data_venc_30,
          updated_at     = NOW();
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[P0] Erro rec (aloc %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ==================================================================
    -- 3. CRIA / ATUALIZA financeiro_pagar
    -- ==================================================================
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (
          os_id, descricao, valor, data_vencimento, status,
          prestador, fornecedor_id, fornecedor_nome
        ) VALUES (
          v_os_id::TEXT,
          'Repasse ' || v_os_numero || CASE WHEN v_reversa_prestador > 0 THEN ' (c/ reversa)' ELSE '' END,
          v_valor_prestador, v_data_venc_30, v_status_financeiro,
          v_prestador_nome, NEW.prestador_id, v_prestador_nome
        )
        ON CONFLICT (os_id) DO UPDATE SET
          valor            = v_valor_prestador,
          prestador        = v_prestador_nome,
          fornecedor_id    = NEW.prestador_id,
          fornecedor_nome  = v_prestador_nome,
          status           = CASE WHEN v_is_concluida THEN 'aberto'
                                  WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                                  ELSE 'pendente' END,
          data_vencimento  = v_data_venc_30,
          updated_at       = NOW();
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[P0] Erro pag (aloc %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ==================================================================
    -- 4. CRIA / ATUALIZA pagamentos_prestadores
    -- ==================================================================
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO pagamentos_prestadores (
          prestador_id, prestador_nome, prestador_documento,
          os_id,
          valor_liquido, valor_servicos, pedagio, adicionais,
          status_conferencia, status_pagamento,
          origem_lancamento, quantidade_os,
          periodo_inicio, periodo_fim,
          categoria_financeira, data_prevista_pagamento,
          competencia, impacto_dre, impacto_fluxo_caixa
        ) VALUES (
          NEW.prestador_id, v_prestador_nome, v_prestador_doc,
          v_os_id,
          v_valor_liquido, v_valor_prestador,
          v_pedagio_valor, v_outros_custos,
          CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END,
          CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END,
          'escala_direta', 1,
          COALESCE(NEW.data_escala, CURRENT_DATE), COALESCE(NEW.data_escala, CURRENT_DATE),
          'Custo Logístico', v_data_venc_30,
          COALESCE(NEW.data_escala, CURRENT_DATE),
          true, true
        )
        ON CONFLICT (os_id) DO UPDATE SET
          prestador_id         = NEW.prestador_id,
          prestador_nome       = v_prestador_nome,
          prestador_documento  = v_prestador_doc,
          valor_liquido        = v_valor_liquido,
          valor_servicos       = v_valor_prestador,
          pedagio              = v_pedagio_valor,
          adicionais           = v_outros_custos,
          status_conferencia   = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END,
          status_pagamento     = CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END,
          competencia          = COALESCE(NEW.data_escala, CURRENT_DATE),
          updated_at           = NOW();
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[P0] Erro pp (aloc %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ==================================================================
    -- 5. CRIA / ATUALIZA composicao_financeira_os (apenas na conclusão)
    --    Fórmula unificada:
    --      outros_custos = adicionais + ajudante - descontos
    --      margem_bruta = valor_cliente - valor_prestador - pedagio - outros_custos
    --      margem_liquida = margem_bruta - imposto(4.5%) - seguro(1%)
    -- ==================================================================
    IF v_is_concluida AND v_valor_cliente > 0 THEN
      DECLARE
        v_imposto_valor   NUMERIC;
        v_seguro_valor    NUMERIC;
        v_margem_bruta    NUMERIC;
        v_margem_liquida  NUMERIC;
      BEGIN
        v_imposto_valor  := ROUND(v_valor_cliente * 4.5 / 100, 2);
        v_seguro_valor   := ROUND(v_valor_cliente * 0.01, 2);
        v_margem_bruta   := v_valor_cliente - v_valor_prestador - v_pedagio_valor - v_outros_custos;
        v_margem_liquida := v_margem_bruta - v_imposto_valor - v_seguro_valor;

        INSERT INTO composicao_financeira_os (
          os_id, cliente_id, prestador_id,
          valor_cliente, valor_prestador,
          imposto_percentual, imposto_valor, seguro_valor,
          pedagio_valor, outros_custos,
          combustivel_valor, ajudante_valor, adicional_valor, desconto_valor,
          margem_bruta, margem_liquida,
          percentual_margem_bruta, percentual_margem_liquida,
          origem_calculo
        ) VALUES (
          v_os_id, NEW.cliente_id, NEW.prestador_id,
          v_valor_cliente, v_valor_prestador,
          4.5, v_imposto_valor, v_seguro_valor,
          v_pedagio_valor, v_outros_custos,
          0, v_ajudante_valor, v_adicional_valor, v_desconto_valor,
          v_margem_bruta, v_margem_liquida,
          CASE WHEN v_valor_cliente > 0
               THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
               ELSE 0 END,
          CASE WHEN v_valor_cliente > 0
               THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
               ELSE 0 END,
          'escala_direta'
        )
        ON CONFLICT (os_id) DO UPDATE SET
          valor_cliente              = v_valor_cliente,
          valor_prestador            = v_valor_prestador,
          imposto_percentual         = 4.5,
          imposto_valor              = v_imposto_valor,
          seguro_valor               = v_seguro_valor,
          pedagio_valor              = v_pedagio_valor,
          outros_custos              = v_outros_custos,
          combustivel_valor          = 0,
          ajudante_valor             = v_ajudante_valor,
          adicional_valor            = v_adicional_valor,
          desconto_valor             = v_desconto_valor,
          margem_bruta               = v_margem_bruta,
          margem_liquida             = v_margem_liquida,
          percentual_margem_bruta    = CASE WHEN v_valor_cliente > 0
                                            THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
                                            ELSE 0 END,
          percentual_margem_liquida  = CASE WHEN v_valor_cliente > 0
                                            THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
                                            ELSE 0 END,
          origem_calculo             = 'escala_direta';
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[P0] Erro comp (aloc %): %', NEW.id, v_error_msg;
      END;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[P0] Erro propagacao financeira (ignorado, alocacao % mantida): %',
      NEW.id, v_error_msg;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Trigger AFTER INSERT OR UPDATE (colunas financeiras + status)
--    Dispara em INSERT e UPDATE — cria registros 'pendente' já na criação
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
    valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto,
    tipo_reversa, reversa_valor_cliente, reversa_valor_prestador
  ON alocacoes_escala
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

-- =============================================================================
-- 3. Comentários
-- =============================================================================
COMMENT ON FUNCTION public.f_trg_propagar_financeiro_alocacao IS
  'P0 (CORRIGIDA) — Propagacao financeira com EXCEPTION handler. '
  'Dispara em INSERT e UPDATE. Cria registros pendente na criacao, '
  'aberto na conclusao. Nao quebra o INSERT se a propagacao falhar. '
  'Formula unificada: outros_custos = adicionais + ajudante - descontos. '
  'Inclui reversa. UNIQUE(os_id) em todas as tabelas financeiras. '
  'Equivalente a M108F.';

COMMENT ON TRIGGER trg_propagar_financeiro_alocacao ON alocacoes_escala IS
  'P0 (CORRIGIDA) — Gatilho de propagacao financeira tolerante a falhas. '
  'Dispara em INSERT e nas atualizacoes de status/valores financeiros. '
  'WHEN exclui apenas canceladas. Cria financeiro ja na criacao da alocacao.';
