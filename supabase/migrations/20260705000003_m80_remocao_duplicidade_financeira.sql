-- =============================================================================
-- MISSÃO 80 — Remoção Segura da Duplicidade Financeira
--
-- 1. UNIQUE(os_id) em financeiro_pagar (previnir duplicatas)
-- 2. Trigger f_trg_propagar_financeiro_os() em ordens_servico (análogo ao M66)
-- 3. Fórmula unificada de margem para OS direta
-- 4. Garantir colunas texto cliente/prestador em ordens_servico
-- =============================================================================

-- =============================================================================
-- SEÇÃO 0 — Garantir colunas de texto em ordens_servico
-- =============================================================================
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS cliente TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS prestador TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS placa_alocada TEXT;

-- =============================================================================
-- SEÇÃO 1 — UNIQUE(os_id) em financeiro_pagar
-- Impede duplicatas: cada OS só pode ter UM registro em financeiro_pagar
-- =============================================================================
DO $$
BEGIN
  -- Remove duplicatas antes de criar a constraint (mantém o registro mais recente)
  DELETE FROM financeiro_pagar fp1 USING (
    SELECT os_id, MAX(created_at) AS max_created
    FROM financeiro_pagar
    WHERE os_id IS NOT NULL
    GROUP BY os_id
    HAVING COUNT(*) > 1
  ) fp2
  WHERE fp1.os_id = fp2.os_id
    AND fp1.created_at < fp2.max_created;

  -- Adiciona UNIQUE se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fp_os_id' AND conrelid = 'financeiro_pagar'::regclass
  ) THEN
    ALTER TABLE financeiro_pagar ADD CONSTRAINT uq_fp_os_id UNIQUE (os_id);
  END IF;
END;
$$;

-- =============================================================================
-- SEÇÃO 2 — DROP da trigger antiga P0 (se existir, foi superseeded pelo M66)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_propagar_financeiro_os ON ordens_servico;
DROP FUNCTION IF EXISTS public.f_trg_propagar_financeiro_os();

-- =============================================================================
-- SEÇÃO 3 — Função: f_trg_propagar_financeiro_os()
--
-- Propaga dados financeiros de ordens_servico para:
--   financeiro_receber       (INSERT ON CONFLICT DO UPDATE)
--   financeiro_pagar         (INSERT ON CONFLICT DO UPDATE)
--   pagamentos_prestadores   (INSERT ON CONFLICT DO UPDATE)
--   composicao_financeira_os (INSERT ON CONFLICT DO UPDATE, apenas na finalização)
--
-- Fórmula de margem (UNIFICADA):
--   outros_custos = adicionais + ajudante - descontos
--   margem_bruta = valor_cliente - custo_prestador - pedagio - outros_custos
--   margem_liquida = margem_bruta - imposto(4.5%) - seguro(1%)
-- =============================================================================
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
  -- ===========================================================================
  -- Proteção: pula se OS cancelada (trigger de cancelamento cuida)
  -- ===========================================================================
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- Valores base
  -- ===========================================================================
  v_valor_cliente   := COALESCE(NEW.valor_cliente, 0);
  v_valor_prestador := COALESCE(NEW.custo_prestador, 0);

  -- Pula se não há valor financeiro a propagar
  IF v_valor_cliente = 0 AND v_valor_prestador = 0 THEN
    RETURN NEW;
  END IF;

  -- ===========================================================================
  -- Busca dados auxiliares (cliente e prestador)
  -- ===========================================================================
  BEGIN
    SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || NEW.cliente_id::TEXT)
      INTO v_cliente_nome
      FROM clientes c WHERE c.id = NEW.cliente_id;
  EXCEPTION WHEN OTHERS THEN
    v_cliente_nome := COALESCE(NEW.cliente, 'Cliente');
  END;

  BEGIN
    SELECT COALESCE(p.nome_completo, 'Prestador #' || NEW.prestador_id::TEXT),
           COALESCE(p.cpf_cnpj, '')
      INTO v_prestador_nome, v_prestador_doc
      FROM prestadores p WHERE p.id = NEW.prestador_id;
  EXCEPTION WHEN OTHERS THEN
    v_prestador_nome := COALESCE(NEW.prestador, 'Prestador');
    v_prestador_doc := '';
  END;

  v_data_venc_30 := CURRENT_DATE + 30;
  v_is_finalizada := (NEW.status = 'finalizada');

  -- ===========================================================================
  -- FÓRMULA UNIFICADA DE CUSTOS E MARGEM
  -- outros_custos = adicionais + ajudante - descontos
  -- ===========================================================================
  v_outros_custos := COALESCE(NEW.adicionais, 0)
                   + COALESCE(NEW.ajudante, 0)
                   - COALESCE(NEW.descontos, 0);

  v_valor_liquido := v_valor_prestador
                   + COALESCE(NEW.pedagio, 0)
                   + v_outros_custos;

  -- ===========================================================================
  -- 1. CRIA / ATUALIZA financeiro_receber
  -- Usa ON CONFLICT (os_id) — idempotente com M66
  -- ===========================================================================
  IF v_valor_cliente > 0 THEN
    INSERT INTO financeiro_receber (
      os_id, descricao, valor, data_vencimento, status,
      cliente, cliente_id
    ) VALUES (
      NEW.id::TEXT,
      'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
      v_valor_cliente,
      v_data_venc_30,
      CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
      COALESCE(v_cliente_nome, NEW.cliente),
      NEW.cliente_id
    )
    ON CONFLICT (os_id) DO UPDATE SET
      valor        = v_valor_cliente,
      cliente      = COALESCE(v_cliente_nome, EXCLUDED.cliente),
      cliente_id   = NEW.cliente_id,
      status       = CASE WHEN v_is_finalizada THEN 'aberto'
                          WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                          ELSE 'pendente' END,
      descricao    = 'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
      data_vencimento = v_data_venc_30;
  END IF;

  -- ===========================================================================
  -- 2. CRIA / ATUALIZA financeiro_pagar (agora com UNIQUE os_id)
  -- ===========================================================================
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    INSERT INTO financeiro_pagar (
      os_id, descricao, valor, data_vencimento, status,
      prestador, fornecedor_id, fornecedor_nome
    ) VALUES (
      NEW.id::TEXT,
      'Repasse ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
      v_valor_prestador,
      v_data_venc_30,
      CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
      COALESCE(v_prestador_nome, NEW.prestador),
      NEW.prestador_id,
      COALESCE(v_prestador_nome, NEW.prestador)
    )
    ON CONFLICT (os_id) DO UPDATE SET
      valor          = v_valor_prestador,
      prestador      = COALESCE(v_prestador_nome, EXCLUDED.prestador),
      fornecedor_id  = NEW.prestador_id,
      fornecedor_nome = COALESCE(v_prestador_nome, EXCLUDED.fornecedor_nome),
      status         = CASE WHEN v_is_finalizada THEN 'aberto'
                            WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                            ELSE 'pendente' END,
      data_vencimento = v_data_venc_30;
  END IF;

  -- ===========================================================================
  -- 3. CRIA / ATUALIZA pagamentos_prestadores
  -- ===========================================================================
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    INSERT INTO pagamentos_prestadores (
      prestador_id, prestador_nome, prestador_documento,
      os_id, os_numero,
      valor_liquido, valor_servicos, pedagio, adicionais,
      status_conferencia, status_pagamento,
      origem_lancamento, quantidade_os,
      categoria_financeira, data_prevista_pagamento,
      competencia, impacto_dre, impacto_fluxo_caixa
    ) VALUES (
      NEW.prestador_id,
      COALESCE(v_prestador_nome, NEW.prestador),
      COALESCE(v_prestador_doc, ''),
      NEW.id,
      COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
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
      true, true
    )
    ON CONFLICT (os_id) DO UPDATE SET
      prestador_id        = NEW.prestador_id,
      prestador_nome      = COALESCE(v_prestador_nome, EXCLUDED.prestador_nome),
      prestador_documento = COALESCE(v_prestador_doc, EXCLUDED.prestador_documento),
      valor_liquido       = v_valor_liquido,
      valor_servicos      = v_valor_prestador,
      pedagio             = COALESCE(NEW.pedagio, 0),
      adicionais          = v_outros_custos,
      status_conferencia  = 'em_aberto',
      competencia         = CURRENT_DATE;
  END IF;

  -- ===========================================================================
  -- 4. CRIA / ATUALIZA composicao_financeira_os (apenas na finalização)
  -- Fórmula unificada: outros_custos = adicionais + ajudante - descontos
  -- ===========================================================================
  IF v_is_finalizada AND v_valor_cliente > 0 THEN
    v_imposto_valor  := ROUND(v_valor_cliente * 4.5 / 100, 2);
    v_seguro_valor   := ROUND(v_valor_cliente * 0.01, 2);
    v_margem_bruta   := v_valor_cliente
                      - v_valor_prestador
                      - COALESCE(NEW.pedagio, 0)
                      - v_outros_custos;
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
      NEW.id,
      NEW.cliente_id,
      NEW.prestador_id,
      v_valor_cliente,
      v_valor_prestador,
      4.5,
      v_imposto_valor,
      v_seguro_valor,
      COALESCE(NEW.pedagio, 0),
      v_outros_custos,
      0,
      COALESCE(NEW.ajudante, 0),
      COALESCE(NEW.adicionais, 0),
      COALESCE(NEW.descontos, 0),
      v_margem_bruta,
      v_margem_liquida,
      CASE WHEN v_valor_cliente > 0
           THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
           ELSE 0 END,
      CASE WHEN v_valor_cliente > 0
           THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
           ELSE 0 END,
      'os_direta'
    )
    ON CONFLICT (os_id) DO UPDATE SET
      valor_cliente              = v_valor_cliente,
      valor_prestador            = v_valor_prestador,
      imposto_percentual         = 4.5,
      imposto_valor              = v_imposto_valor,
      seguro_valor               = v_seguro_valor,
      pedagio_valor              = COALESCE(NEW.pedagio, 0),
      outros_custos              = v_outros_custos,
      combustivel_valor          = 0,
      ajudante_valor             = COALESCE(NEW.ajudante, 0),
      adicional_valor            = COALESCE(NEW.adicionais, 0),
      desconto_valor             = COALESCE(NEW.descontos, 0),
      margem_bruta               = v_margem_bruta,
      margem_liquida             = v_margem_liquida,
      percentual_margem_bruta    = CASE WHEN v_valor_cliente > 0
                                        THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
                                        ELSE 0 END,
      percentual_margem_liquida  = CASE WHEN v_valor_cliente > 0
                                        THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
                                        ELSE 0 END,
      origem_calculo             = 'os_direta';
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- SEÇÃO 4 — Trigger: trg_propagar_financeiro_os
-- Dispara em INSERT e UPDATE das colunas financeiras de ordens_servico
-- =============================================================================
CREATE TRIGGER trg_propagar_financeiro_os
  AFTER INSERT OR UPDATE OF valor_cliente, custo_prestador,
                             pedagio, adicionais, ajudante, descontos, status
  ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM 'cancelada')
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_os();

-- =============================================================================
-- SEÇÃO 5 — Comentários
-- =============================================================================
COMMENT ON FUNCTION public.f_trg_propagar_financeiro_os IS
  'M80 — Propagacao financeira automatica de ordens_servico. '
  'Dispara em INSERT e UPDATE de colunas financeiras. '
  'Sincroniza financeiro_receber, financeiro_pagar, pagamentos_prestadores '
  'e composicao_financeira_os (apenas na finalizacao). '
  'Usa ON CONFLICT (os_id) DO UPDATE em todas as tabelas — '
  'idempotente com trigger M66 (alocacoes_escala). '
  'Formula unificada: outros_custos = adicionais + ajudante - descontos. '
  'Imposto fixo 4.5%, seguro fixo 1%.';

COMMENT ON TRIGGER trg_propagar_financeiro_os ON ordens_servico IS
  'M80 — Gatilho de propagacao financeira de OS direta. '
  'Dispara em INSERT e UPDATE de valor_cliente, custo_prestador, '
  'pedagio, adicionais, ajudante, descontos, status. '
  'Pula OS canceladas. Usa ON CONFLICT para ser idempotente com M66.';

COMMENT ON CONSTRAINT uq_fp_os_id ON financeiro_pagar IS
  'M80 — Impede duplicatas de financeiro_pagar por OS. '
  'Cada OS só pode ter UM registro em contas a pagar.';
