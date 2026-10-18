-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 104-A — CORREÇÃO DA PROPAGAÇÃO FINANCEIRA DO TRIGGER M66
--
-- CAUSA RAIZ:
--   A P0 (20260731) sobrescreveu a M103A (20260706) com um trigger que SÓ
--   dispara em UPDATE quando status='concluida' AND finalizada=true. Isso fez
--   com que a CRIAÇÃO de alocações (INSERT com status='planejada' ou
--   'aguardando_aceite') não propagasse nada para as tabelas financeiras.
--
--   Adicionalmente, a Edge Function criar-alocacao-escala NÃO enviava os
--   campos valor_adicional, valor_desconto, valor_fixo e km_realizados para
--   o banco, fazendo com que esses campos chegassem como 0 mesmo quando
--   o frontend os enviava.
--
-- CORREÇÕES:
--   1. DROP da trigger/function P0
--   2. Recria trigger function M66 (M104A) que dispara em INSERT e UPDATE
--      com EXCEPTION handler (não quebra criação da alocação)
--   3. Cria financeiro_receber, financeiro_pagar e pagamentos_prestadores
--      já na criação da alocação (status 'pendente')
--   4. Atualiza status financeiro para 'aberto' na conclusão
--   5. Fórmula unificada (M80): outros_custos = valor_adicional + valor_ajudante - valor_desconto
--   6. Passa adicionais/ajudante/descontos para ordens_servico (compatibilidade M80)
--   7. Edge Function corrigida separadamente (arquivo index.ts)
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — DROP da trigger P0 e da function anterior
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;
DROP FUNCTION IF EXISTS public.f_trg_propagar_financeiro_alocacao();

-- =============================================================================
-- SEÇÃO 2 — Função trigger M104A
-- Dispara em INSERT e UPDATE. Cria registros financeiros com status 'pendente'
-- na criação, atualiza para 'aberto' na conclusão.
-- Fórmula unificada (M80): outros_custos = adicionais + ajudante - descontos
-- =============================================================================
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
  v_valor_cliente      NUMERIC;
  v_valor_prestador    NUMERIC;
  v_pedagio_valor      NUMERIC;
  v_adicional_valor    NUMERIC;
  v_ajudante_valor     NUMERIC;
  v_desconto_valor     NUMERIC;
  v_outros_custos      NUMERIC;
  v_valor_liquido      NUMERIC;
  v_is_concluida       BOOLEAN;
  v_error_msg          TEXT;
  v_fallback_cliente   TEXT;
  v_fallback_prestador TEXT;
  v_status_financeiro  TEXT;
BEGIN
  -- Proteção: pula se alocação foi cancelada
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- Bloco protegido: qualquer erro na propagação NÃO deve quebrar a alocação
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

    -- Pula se não há valor financeiro a propagar
    IF v_valor_cliente = 0 AND v_valor_prestador = 0 THEN
      RETURN NEW;
    END IF;

    -- ------------------------------------------------------------------
    -- Dados auxiliares com proteção contra NULL
    -- ------------------------------------------------------------------
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

    -- ------------------------------------------------------------------
    -- Flags e IDs
    -- ------------------------------------------------------------------
    v_data_venc_30 := CURRENT_DATE + 30;
    v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);
    v_status_financeiro := CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END;

    -- Define v_os_id: se já existe OS vinculada, usa ela; senão usa o ID da alocação
    IF NEW.ordem_servico_id IS NOT NULL THEN
      v_os_id := NEW.ordem_servico_id;
      v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    ELSE
      v_os_id := NEW.id;
      v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    END IF;

    -- ------------------------------------------------------------------
    -- FÓRMULA UNIFICADA (M80): outros_custos = adicionais + ajudante - descontos
    -- ------------------------------------------------------------------
    v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor;

    -- Valor líquido do prestador = repasse + pedágio + outros_custos
    v_valor_liquido := v_valor_prestador + v_pedagio_valor + v_outros_custos;

    -- ==================================================================
    -- 1. CRIA / ATUALIZA ordens_servico
    --    Inclui adicionais/ajudante/descontos para compatibilidade com
    --    trigger M80 (f_trg_propagar_financeiro_os) que depende desses
    --    campos para calcular a margem corretamente.
    -- ==================================================================
    BEGIN
      INSERT INTO ordens_servico (
        id, numero,
        cliente, cliente_id,
        prestador, prestador_id,
        status, data,
        tipo_veiculo, placa_alocada,
        origem, destino,
        valor_cliente, custo_prestador,
        pedagio, adicionais, ajudante, descontos,
        observacoes_gerais, instrucoes_operacionais_os,
        created_at, updated_at
      ) VALUES (
        v_os_id, v_os_numero,
        NEW.cliente_id, v_cliente_nome,
        NEW.prestador_id, v_prestador_nome,
        CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END,
        COALESCE(NEW.data_escala, CURRENT_DATE),
        NEW.tipo_veiculo, NEW.placa,
        NEW.origem, NEW.destino,
        v_valor_cliente, v_valor_prestador,
        v_pedagio_valor, v_adicional_valor, v_ajudante_valor, v_desconto_valor,
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
        valor_cliente   = v_valor_cliente,
        custo_prestador = v_valor_prestador,
        pedagio         = v_pedagio_valor,
        adicionais      = v_adicional_valor,
        ajudante        = v_ajudante_valor,
        descontos       = v_desconto_valor,
        observacoes_gerais = NEW.observacoes,
        updated_at      = NOW();
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      RAISE WARNING '[M104A] Erro ao propagar ordens_servico (alocacao %): %', NEW.id, v_error_msg;
    END;

    -- ==================================================================
    -- 2. CRIA / ATUALIZA financeiro_receber (1 registro por os_id)
    --    Cria com status 'pendente' na criação, atualiza para 'aberto'
    --    na conclusão.
    -- ==================================================================
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (
          os_id, descricao, valor, data_vencimento, status,
          cliente, cliente_nome, cliente_id
        ) VALUES (
          v_os_id::TEXT,
          'Faturamento ' || v_os_numero,
          v_valor_cliente,
          v_data_venc_30,
          v_status_financeiro,
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
          descricao      = 'Faturamento ' || v_os_numero,
          updated_at     = NOW();
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[M104A] Erro ao propagar financeiro_receber (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ==================================================================
    -- 3. CRIA / ATUALIZA financeiro_pagar (1 registro por os_id)
    -- ==================================================================
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (
          os_id, descricao, valor, data_vencimento, status,
          prestador, fornecedor_id, fornecedor_nome
        ) VALUES (
          v_os_id::TEXT,
          'Repasse ' || v_os_numero,
          v_valor_prestador,
          v_data_venc_30,
          v_status_financeiro,
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
          descricao        = 'Repasse ' || v_os_numero,
          updated_at       = NOW();
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE WARNING '[M104A] Erro ao propagar financeiro_pagar (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ==================================================================
    -- 4. CRIA / ATUALIZA pagamentos_prestadores (1 registro por os_id)
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
        RAISE WARNING '[M104A] Erro ao propagar pagamentos_prestadores (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

    -- ==================================================================
    -- 5. CRIA / ATUALIZA composicao_financeira_os (apenas na conclusão)
    --    Fórmula unificada (M80):
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
        RAISE WARNING '[M104A] Erro ao propagar composicao_financeira_os (alocacao %): %', NEW.id, v_error_msg;
      END;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[M104A] Erro na propagacao financeira da alocacao % (ignorado, alocacao mantida): %',
      NEW.id, v_error_msg;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- SEÇÃO 3 — Trigger: trg_propagar_financeiro_alocacao
-- Dispara em INSERT e UPDATE das colunas financeiras e de status.
-- Ao contrário da P0 (que só disparava em conclusão), esta versão dispara
-- em qualquer INSERT e nas atualizações relevantes, criando os registros
-- financeiros com status 'pendente' imediatamente.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
                             valor_pedagio, valor_adicional, valor_desconto,
                             valor_ajudante
  ON alocacoes_escala
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

-- =============================================================================
-- SEÇÃO 4 — Garantir UNIQUE(os_id) em financeiro_receber e pagamentos_prestadores
--           (financeiro_pagar já tem uq_fp_os_id da M80)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fr_os_id' AND conrelid = 'financeiro_receber'::regclass
  ) THEN
    ALTER TABLE financeiro_receber ADD CONSTRAINT uq_fr_os_id UNIQUE (os_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_pp_os_id' AND conrelid = 'pagamentos_prestadores'::regclass
  ) THEN
    -- Antes de criar a constraint, remover duplicatas se houver
    DELETE FROM pagamentos_prestadores pp1 USING (
      SELECT os_id, MAX(created_at) AS max_created
      FROM pagamentos_prestadores
      WHERE os_id IS NOT NULL
      GROUP BY os_id
      HAVING COUNT(*) > 1
    ) pp2
    WHERE pp1.os_id = pp2.os_id AND pp1.created_at < pp2.max_created;

    ALTER TABLE pagamentos_prestadores ADD CONSTRAINT uq_pp_os_id UNIQUE (os_id);
  END IF;
END;
$$;

-- =============================================================================
-- SEÇÃO 5 — Comentários
-- =============================================================================
COMMENT ON FUNCTION public.f_trg_propagar_financeiro_alocacao IS
  'M104A — Propagacao financeira com EXCEPTION handler. '
  'Dispara em INSERT e UPDATE. Cria registros com status pendente na criacao, '
  'atualiza para aberto na conclusao. Nao quebra o INSERT se a propagacao falhar. '
  'Formula unificada M80: outros_custos = adicionais + ajudante - descontos. '
  'UNIQUE(os_id) em todas as tabelas financeiras. '
  'Substitui a P0 que so propagava na conclusao.';

COMMENT ON TRIGGER trg_propagar_financeiro_alocacao ON alocacoes_escala IS
  'M104A — Gatilho de propagacao financeira tolerante a falhas. '
  'Dispara em INSERT e nas atualizacoes de status/valores financeiros. '
  'WHEN exclui apenas canceladas. Cria financeiro ja na criacao da alocacao.';
