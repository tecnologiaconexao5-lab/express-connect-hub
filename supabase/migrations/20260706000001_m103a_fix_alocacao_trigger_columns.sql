-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 103-A — CORREÇÃO CRÍTICA: CRIAÇÃO DE ALOCAÇÃO NA ESCALA
--
-- CAUSA RAIZ:
--   O trigger M66 (f_trg_propagar_financeiro_alocacao) dispara AFTER INSERT
--   em alocacoes_escala e tenta propagar para financeiro_receber,
--   financeiro_pagar, pagamentos_prestadores, composicao_financeira_os
--   e ordens_servico. Essas tabelas NÃO possuem todas as colunas que
--   o trigger espera, causando erro e revertendo toda a transação.
--
-- CORREÇÕES:
--   1. Adiciona colunas faltantes em pagamentos_prestadores, financeiro_receber,
--      financeiro_pagar, composicao_financeira_os
--   2. Recria o trigger M66 com EXCEPTION handler para não quebrar o INSERT
--      principal em caso de falha na propagação
--   3. Adiciona proteção para NULL em cliente_id e prestador_id
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — Adicionar colunas faltantes em pagamentos_prestadores
-- =============================================================================
ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS os_id                  UUID,
  ADD COLUMN IF NOT EXISTS pedagio                NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adicionais             NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_conferencia     TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS status_pagamento       TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS origem_lancamento      TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS categoria_financeira   TEXT DEFAULT 'Custo Logístico',
  ADD COLUMN IF NOT EXISTS data_prevista_pagamento DATE,
  ADD COLUMN IF NOT EXISTS competencia            DATE,
  ADD COLUMN IF NOT EXISTS impacto_dre            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS impacto_fluxo_caixa    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS os_numero              TEXT,
  ADD COLUMN IF NOT EXISTS tipo_lancamento        TEXT DEFAULT 'Serviço Escala',
  ADD COLUMN IF NOT EXISTS natureza               TEXT DEFAULT 'credito',
  ADD COLUMN IF NOT EXISTS data_competencia       DATE;

COMMENT ON COLUMN pagamentos_prestadores.os_id IS 'M103A — FK para alocacoes_escala.id ou ordens_servico.id';
COMMENT ON COLUMN pagamentos_prestadores.status_conferencia IS 'M103A — pendente, em_aberto, conferido, divergente';
COMMENT ON COLUMN pagamentos_prestadores.status_pagamento IS 'M103A — pendente, nao_vencido, pago, cancelado';
COMMENT ON COLUMN pagamentos_prestadores.origem_lancamento IS 'M103A — escala_direta, os_direta, fechamento, manual';

-- =============================================================================
-- SEÇÃO 2 — Adicionar colunas faltantes em financeiro_receber
-- =============================================================================
ALTER TABLE financeiro_receber
  ADD COLUMN IF NOT EXISTS cliente_id             UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome           TEXT,
  ADD COLUMN IF NOT EXISTS fatura                 TEXT;

COMMENT ON COLUMN financeiro_receber.cliente_id IS 'M103A — FK para clientes.id';
COMMENT ON COLUMN financeiro_receber.cliente_nome IS 'M103A — Nome do cliente para relatórios';

-- =============================================================================
-- SEÇÃO 3 — Adicionar colunas faltantes em financeiro_pagar
-- =============================================================================
ALTER TABLE financeiro_pagar
  ADD COLUMN IF NOT EXISTS fornecedor_id          UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fornecedor_nome        TEXT,
  ADD COLUMN IF NOT EXISTS documento              TEXT;

COMMENT ON COLUMN financeiro_pagar.fornecedor_id IS 'M103A — FK para prestadores.id';
COMMENT ON COLUMN financeiro_pagar.fornecedor_nome IS 'M103A — Nome do prestador para relatórios';

-- =============================================================================
-- SEÇÃO 4 — Adicionar colunas faltantes em composicao_financeira_os
-- =============================================================================
ALTER TABLE composicao_financeira_os
  ADD COLUMN IF NOT EXISTS origem_calculo         TEXT DEFAULT 'escala_direta',
  ADD COLUMN IF NOT EXISTS combustivel_valor      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ajudante_valor         NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adicional_valor        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_valor         NUMERIC DEFAULT 0;

COMMENT ON COLUMN composicao_financeira_os.origem_calculo IS
  'M103A — Origem: escala_direta (M66) ou os_direta (M80)';

-- =============================================================================
-- SEÇÃO 5 — Recriar trigger function M66 com EXCEPTION handler
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;
DROP FUNCTION IF EXISTS public.f_trg_propagar_financeiro_alocacao();

CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_alocacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_nome       TEXT;
  v_prestador_nome     TEXT;
  v_prestador_doc      TEXT;
  v_os_id              UUID;
  v_os_numero          TEXT;
  v_data_venc_30       DATE;
  v_valor_liquido      NUMERIC;
  v_margem_bruta       NUMERIC;
  v_margem_liquida     NUMERIC;
  v_imposto_valor      NUMERIC;
  v_seguro_valor       NUMERIC;
  v_is_concluida       BOOLEAN;
  v_error_msg          TEXT;
  v_fallback_cliente   TEXT;
  v_fallback_prestador TEXT;
BEGIN
  -- Proteção: pula se alocação foi cancelada
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- Bloco protegido: qualquer erro na propagação NÃO deve quebrar a alocação
  -- ===========================================================================
  BEGIN
    -- Busca dados auxiliares com proteção contra NULL
    v_fallback_cliente := COALESCE(NEW.cliente_id::TEXT, 'cliente_nao_informado');
    v_fallback_prestador := COALESCE(NEW.prestador_id::TEXT, 'prestador_nao_informado');

    BEGIN
      SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || v_fallback_cliente)
        INTO STRICT v_cliente_nome
        FROM clientes c WHERE c.id = NEW.cliente_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_cliente_nome := 'Cliente #' || v_fallback_cliente;
      WHEN OTHERS THEN
        v_cliente_nome := v_fallback_cliente;
    END;

    BEGIN
      SELECT COALESCE(p.nome_completo, 'Prestador #' || v_fallback_prestador),
             COALESCE(p.cpf_cnpj, '')
        INTO STRICT v_prestador_nome, v_prestador_doc
        FROM prestadores p WHERE p.id = NEW.prestador_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_prestador_nome := 'Prestador #' || v_fallback_prestador;
        v_prestador_doc := '';
      WHEN OTHERS THEN
        v_prestador_nome := v_fallback_prestador;
        v_prestador_doc := '';
    END;

    v_data_venc_30 := CURRENT_DATE + 30;

    -- Define v_os_id: se já existe OS vinculada, usa ela; senão usa o ID da alocação
    IF NEW.ordem_servico_id IS NOT NULL THEN
      v_os_id := NEW.ordem_servico_id;
      v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    ELSE
      v_os_id := NEW.id;
      v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    END IF;

    -- Valor líquido do prestador = repasse + pedágio + adicional - desconto
    v_valor_liquido := COALESCE(NEW.valor_repasse, 0)
                     + COALESCE(NEW.valor_pedagio, 0)
                     + COALESCE(NEW.valor_adicional, 0)
                     - COALESCE(NEW.valor_desconto, 0);

    v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);

    -- ========================================================================
    -- 1. CRIA / ATUALIZA ordens_servico
    -- ========================================================================
    BEGIN
      INSERT INTO ordens_servico (
        id, numero,
        cliente, cliente_id,
        prestador, prestador_id,
        status, data,
        tipo_veiculo, placa_alocada,
        origem, destino,
        valor_cliente, custo_prestador,
        pedagio,
        observacoes_gerais, instrucoes_operacionais,
        created_at, updated_at
      ) VALUES (
        v_os_id, v_os_numero,
        NEW.cliente_id, v_cliente_nome,
        NEW.prestador_id, v_prestador_nome,
        CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END,
        COALESCE(NEW.data_escala, CURRENT_DATE),
        NEW.tipo_veiculo, NEW.placa,
        NEW.origem, NEW.destino,
        COALESCE(NEW.valor_frete, 0), COALESCE(NEW.valor_repasse, 0),
        COALESCE(NEW.valor_pedagio, 0),
        NEW.observacoes, NEW.instrucoes_operacionais,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status          = CASE WHEN v_is_concluida THEN 'finalizada'
                               WHEN EXCLUDED.status = 'finalizada' THEN 'finalizada'
                               ELSE 'pendente' END,
        data            = COALESCE(NEW.data_escala, CURRENT_DATE),
        cliente         = NEW.cliente_id,
        cliente_id      = v_cliente_nome,
        prestador       = NEW.prestador_id,
        prestador_id    = v_prestador_nome,
        valor_cliente   = COALESCE(NEW.valor_frete, 0),
        custo_prestador = COALESCE(NEW.valor_repasse, 0),
        pedagio         = COALESCE(NEW.valor_pedagio, 0),
        observacoes_gerais = NEW.observacoes,
        updated_at      = NOW();
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      RAISE WARNING '[M103A] Erro ao propagar ordens_servico (alocacao %): %', NEW.id, v_error_msg;
    END;

    -- ========================================================================
    -- 2. CRIA / ATUALIZA financeiro_receber
    -- ========================================================================
    IF COALESCE(NEW.valor_frete, 0) > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        PERFORM 1 FROM financeiro_receber WHERE os_id = v_os_id::TEXT LIMIT 1;
        IF NOT FOUND THEN
          INSERT INTO financeiro_receber (
            os_id, descricao, valor, data_vencimento, status,
            cliente, cliente_nome, cliente_id
          ) VALUES (
            v_os_id::TEXT,
            'Faturamento ' || v_os_numero,
            NEW.valor_frete,
            v_data_venc_30,
            CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END,
            v_cliente_nome,
            v_cliente_nome,
            NEW.cliente_id
          );
        ELSE
          UPDATE financeiro_receber SET
            valor          = NEW.valor_frete,
            cliente        = v_cliente_nome,
            cliente_nome   = v_cliente_nome,
            cliente_id     = NEW.cliente_id,
            status         = CASE WHEN v_is_concluida THEN 'aberto'
                                  WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                                  ELSE 'pendente' END
            WHERE os_id    = v_os_id::TEXT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[M103A] Erro ao propagar financeiro_receber (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ========================================================================
    -- 3. CRIA / ATUALIZA financeiro_pagar
    -- ========================================================================
    IF COALESCE(NEW.valor_repasse, 0) > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        PERFORM 1 FROM financeiro_pagar WHERE os_id = v_os_id::TEXT LIMIT 1;
        IF NOT FOUND THEN
          INSERT INTO financeiro_pagar (
            os_id, descricao, valor, data_vencimento, status,
            prestador, fornecedor_id, fornecedor_nome
          ) VALUES (
            v_os_id::TEXT,
            'Repasse ' || v_os_numero,
            NEW.valor_repasse,
            v_data_venc_30,
            CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END,
            v_prestador_nome, NEW.prestador_id, v_prestador_nome
          );
        ELSE
          UPDATE financeiro_pagar SET
            valor            = NEW.valor_repasse,
            prestador        = v_prestador_nome,
            fornecedor_id    = NEW.prestador_id,
            fornecedor_nome  = v_prestador_nome,
            status           = CASE WHEN v_is_concluida THEN 'aberto'
                                    WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                                    ELSE 'pendente' END
            WHERE os_id      = v_os_id::TEXT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[M103A] Erro ao propagar financeiro_pagar (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ========================================================================
    -- 4. CRIA / ATUALIZA pagamentos_prestadores
    -- ========================================================================
    IF COALESCE(NEW.valor_repasse, 0) > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        PERFORM 1 FROM pagamentos_prestadores WHERE os_id = v_os_id LIMIT 1;
        IF NOT FOUND THEN
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
            v_valor_liquido, COALESCE(NEW.valor_repasse, 0),
            COALESCE(NEW.valor_pedagio, 0), COALESCE(NEW.valor_adicional, 0),
            CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END,
            CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END,
            'escala_direta', 1,
            COALESCE(NEW.data_escala, CURRENT_DATE), COALESCE(NEW.data_escala, CURRENT_DATE),
            'Custo Logístico', v_data_venc_30,
            COALESCE(NEW.data_escala, CURRENT_DATE),
            true, true
          );
        ELSE
          UPDATE pagamentos_prestadores SET
            prestador_id         = NEW.prestador_id,
            prestador_nome       = v_prestador_nome,
            prestador_documento  = v_prestador_doc,
            valor_liquido        = v_valor_liquido,
            valor_servicos       = COALESCE(NEW.valor_repasse, 0),
            pedagio              = COALESCE(NEW.valor_pedagio, 0),
            adicionais           = COALESCE(NEW.valor_adicional, 0),
            status_conferencia   = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END,
            competencia          = COALESCE(NEW.data_escala, CURRENT_DATE),
            updated_at           = NOW()
          WHERE os_id = v_os_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[M103A] Erro ao propagar pagamentos_prestadores (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ========================================================================
    -- 5. CRIA / ATUALIZA composicao_financeira_os (apenas na conclusão)
    -- ========================================================================
    IF v_is_concluida AND COALESCE(NEW.valor_frete, 0) > 0 THEN
      BEGIN
        v_imposto_valor  := ROUND(NEW.valor_frete * 4.5 / 100, 2);
        v_seguro_valor   := ROUND(NEW.valor_frete * 0.01, 2);
        v_margem_bruta   := NEW.valor_frete - COALESCE(NEW.valor_repasse, 0)
                           - COALESCE(NEW.valor_pedagio, 0)
                           - COALESCE(NEW.valor_adicional, 0);
        v_margem_liquida := v_margem_bruta - v_imposto_valor - v_seguro_valor;

        INSERT INTO composicao_financeira_os (
          os_id, cliente_id, prestador_id,
          valor_cliente, valor_prestador,
          imposto_percentual, imposto_valor, seguro_valor,
          pedagio_valor, outros_custos,
          margem_bruta, margem_liquida,
          percentual_margem_bruta, percentual_margem_liquida,
          origem_calculo
        ) VALUES (
          v_os_id, NEW.cliente_id, NEW.prestador_id,
          NEW.valor_frete, COALESCE(NEW.valor_repasse, 0),
          4.5, v_imposto_valor, v_seguro_valor,
          COALESCE(NEW.valor_pedagio, 0), COALESCE(NEW.valor_adicional, 0),
          v_margem_bruta, v_margem_liquida,
          CASE WHEN NEW.valor_frete > 0
               THEN ROUND(v_margem_bruta / NEW.valor_frete * 100, 2)
               ELSE 0 END,
          CASE WHEN NEW.valor_frete > 0
               THEN ROUND(v_margem_liquida / NEW.valor_frete * 100, 2)
               ELSE 0 END,
          'escala_direta'
        )
        ON CONFLICT (os_id) DO UPDATE SET
          valor_cliente           = NEW.valor_frete,
          valor_prestador         = COALESCE(NEW.valor_repasse, 0),
          imposto_percentual      = 4.5,
          imposto_valor           = v_imposto_valor,
          seguro_valor            = v_seguro_valor,
          pedagio_valor           = COALESCE(NEW.valor_pedagio, 0),
          outros_custos           = COALESCE(NEW.valor_adicional, 0),
          margem_bruta            = v_margem_bruta,
          margem_liquida          = v_margem_liquida,
          percentual_margem_bruta = CASE WHEN NEW.valor_frete > 0
                                         THEN ROUND(v_margem_bruta / NEW.valor_frete * 100, 2)
                                         ELSE 0 END,
          percentual_margem_liquida = CASE WHEN NEW.valor_frete > 0
                                           THEN ROUND(v_margem_liquida / NEW.valor_frete * 100, 2)
                                           ELSE 0 END,
          origem_calculo          = 'escala_direta';
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[M103A] Erro ao propagar composicao_financeira_os (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Captura qualquer erro no bloco principal de propagação
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[M103A] Erro na propagacao financeira da alocacao % (ignorado, alocacao mantida): %',
      NEW.id, v_error_msg;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- SEÇÃO 6 — Recriar o trigger
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
                             valor_pedagio, valor_adicional, valor_desconto
  ON alocacoes_escala
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

COMMENT ON FUNCTION public.f_trg_propagar_financeiro_alocacao IS
  'M103A — Propagacao financeira com EXCEPTION handler. '
  'Nao quebra o INSERT em alocacoes_escala se a propagacao falhar. '
  'Protecao para NULL em cliente_id e prestador_id.';

COMMENT ON TRIGGER trg_propagar_financeiro_alocacao ON alocacoes_escala IS
  'M103A — Gatilho de propagacao financeira com tolerancia a falhas.';
