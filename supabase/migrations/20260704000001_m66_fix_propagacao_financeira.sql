-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 66 — CORREÇÃO DA PROPAGAÇÃO FINANCEIRA AUTOMÁTICA
-- Fix da migration 20260731_p0_propagacao_financeira_trigger.sql original que
-- continha 9 bugs críticos que impediam a sincronização financeira automática.
--
-- BUGS CORRIGIDOS:
--   1. Trigger só disparava em conclusão → agora dispara em INSERT também
--   2. `ordens_servico.cliente` recebia UUID em vez do nome do cliente
--   3. `financeiro_receber` colunas `cliente_nome`/`cliente_id` não existiam
--   4. `financeiro_pagar` colunas `fornecedor_id`/`fornecedor_nome` não existiam
--   5. `ordens_servico.instrucoes_operacionais_os` → `instrucoes_operacionais`
--   6. `pagamentos_prestadores.valor_liquido` não incluía pedágio + adicionais
--   7. `pagamentos_prestadores` não propagava `pedagio` e `adicionais`
--   8. `composicao_financeira_os.outros_custos` = 0 fixo (ignorava adicional)
--   9. Margem bruta/líquida não era calculada
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1. DROP da trigger/função antiga (se existir) — idempotente
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;
DROP FUNCTION IF EXISTS public.f_trg_propagar_financeiro_alocacao();

-- =============================================================================
-- 2. Função trigger corrigida
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
  v_valor_liquido      NUMERIC;
  v_margem_bruta       NUMERIC;
  v_margem_liquida     NUMERIC;
  v_imposto_valor      NUMERIC;
  v_seguro_valor       NUMERIC;
  v_is_concluida       BOOLEAN;
BEGIN
  -- ===========================================================================
  -- Proteção: pula se alocação foi cancelada (evita criar financeiro para zero)
  -- ===========================================================================
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- Busca dados auxiliares (cliente e prestador)
  -- ===========================================================================
  SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || NEW.cliente_id::TEXT)
    INTO v_cliente_nome
    FROM clientes c WHERE c.id = NEW.cliente_id;

  SELECT COALESCE(p.nome_completo, 'Prestador #' || NEW.prestador_id::TEXT),
         COALESCE(p.cpf_cnpj, '')
    INTO v_prestador_nome, v_prestador_doc
    FROM prestadores p WHERE p.id = NEW.prestador_id;

  v_data_venc_30 := CURRENT_DATE + 30;

  -- ===========================================================================
  -- Define v_os_id: se já existe OS vinculada, usa ela; senão usa o ID da alocação
  -- ===========================================================================
  IF NEW.ordem_servico_id IS NOT NULL THEN
    v_os_id := NEW.ordem_servico_id;
    v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  ELSE
    v_os_id := NEW.id;
    v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  END IF;

  -- ===========================================================================
  -- Valor líquido do prestador = repasse + pedágio + adicional - desconto
  -- ===========================================================================
  v_valor_liquido := COALESCE(NEW.valor_repasse, 0)
                   + COALESCE(NEW.valor_pedagio, 0)
                   + COALESCE(NEW.valor_adicional, 0)
                   - COALESCE(NEW.valor_desconto, 0);

  v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);

  -- ===========================================================================
  -- 1. CRIA / ATUALIZA ordens_servico (usando v_os_id como PK)
  -- NOTA: No Supabase real, ordens_servico tem:
  --   cliente = UUID (FK), cliente_id = TEXT (nome do cliente)
  --   prestador = UUID (FK), prestador_id = TEXT (nome do prestador)
  --   (invertido em relação ao schema.sql — conforme validado in loco)
  -- ===========================================================================
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

  -- ===========================================================================
  -- 2. CRIA / ATUALIZA financeiro_receber via PERFORM (sem unique em os_id)
  -- ===========================================================================
  IF COALESCE(NEW.valor_frete, 0) > 0 THEN
    PERFORM 1 FROM financeiro_receber WHERE os_id = v_os_id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_receber (
        os_id, descricao, valor, data_vencimento, status,
        cliente, cliente_id
      ) VALUES (
        v_os_id::TEXT,
        'Faturamento ' || v_os_numero,
        NEW.valor_frete,
        v_data_venc_30,
        CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END,
        v_cliente_nome, NEW.cliente_id
      );
    ELSE
      UPDATE financeiro_receber SET
        valor          = NEW.valor_frete,
        cliente        = v_cliente_nome,
        cliente_id     = NEW.cliente_id,
        status         = CASE WHEN v_is_concluida THEN 'aberto'
                              WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END
        WHERE os_id    = v_os_id::TEXT;
    END IF;
  END IF;

  -- ===========================================================================
  -- 3. CRIA / ATUALIZA financeiro_pagar via PERFORM (sem unique em os_id)
  -- ===========================================================================
  IF COALESCE(NEW.valor_repasse, 0) > 0 AND NEW.prestador_id IS NOT NULL THEN
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
  END IF;

  -- ===========================================================================
  -- 4. CRIA / ATUALIZA pagamentos_prestadores via PERFORM
  -- ===========================================================================
  IF COALESCE(NEW.valor_repasse, 0) > 0 AND NEW.prestador_id IS NOT NULL THEN
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
  END IF;

  -- ===========================================================================
  -- 5. CRIA / ATUALIZA composicao_financeira_os (apenas na conclusão)
  -- ===========================================================================
  IF v_is_concluida AND COALESCE(NEW.valor_frete, 0) > 0 THEN
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
      percentual_margem_bruta, percentual_margem_liquida
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
           ELSE 0 END
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
                                       ELSE 0 END;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. Trigger AFTER INSERT OR UPDATE
--    Dispara em INSERT (criação) e UPDATE nas colunas financeiras
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
                             valor_pedagio, valor_adicional, valor_desconto
  ON alocacoes_escala
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

-- =============================================================================
-- 4. Comentários
-- =============================================================================
COMMENT ON FUNCTION public.f_trg_propagar_financeiro_alocacao IS
  'M66 — Propagacao financeira automatica de alocacoes_escala. '
  'Dispara em INSERT e UPDATE de colunas financeiras. '
  'Sincroniza ordens_servico, financeiro_receber, financeiro_pagar, '
  'pagamentos_prestadores e composicao_financeira_os (apenas na conclusao). '
  'Calcula margem bruta e liquida com impostos (4.5%) e seguro (1%). '
  'Valor liquido do prestador = repasse + pedagio + adicional - desconto.';

COMMENT ON TRIGGER trg_propagar_financeiro_alocacao ON alocacoes_escala IS
  'M66 — Gatilho de propagacao financeira automatica. Dispara em INSERT e UPDATE '
  'de status, finalizada, valor_frete, valor_repasse, valor_pedagio, '
  'valor_adicional, valor_desconto. Pula alocacoes canceladas.';
