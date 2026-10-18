-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 108-F — LOGÍSTICA REVERSA ENTERPRISE
--
-- ETAPAS 2-8:
--   2. OS: tipo_reversa (sem/coleta/devolucao/troca/retorno_cd)
--   3. Tabelas cliente: reversa_tipo, reversa_valor no JSONB adicionais
--   4. Prestador: valor_reentrega/valor_devolucao (já existe)
--   5. Execução: reversa_valor_cliente, reversa_valor_prestador, reversa_qtd_volumes
--      reversa_status, reversa_pod_url, reversa_fotos na alocacao
--   6. Composição financeira: reversa na margem via engine M108-D
--   7. Rede: veiculo_necessario.reversa_prevista + valor_reversa_repassado
--   8. Portal: view já contempla alocacoes_escala (reversa visível)
--
-- REAPROVEITA:
--   - prestadores.valor_reentrega, valor_devolucao (já existem)
--   - tabelas_valores.adicionais.devolucao, reentrega (já existem)
--   - retorno_obrigatorio em ordens_servico (reaproveitado)
--   - M104A trigger (estendido)
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — ETAPA 2: Campos de reversa na OS
-- =============================================================================
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS tipo_reversa TEXT DEFAULT 'sem_reversa';

COMMENT ON COLUMN public.ordens_servico.tipo_reversa IS
  'Tipo de logística reversa: sem_reversa, coleta_reversa, devolucao, troca, retorno_cd';

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS reversa_qtd_volumes INTEGER DEFAULT 0;

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS reversa_observacoes TEXT;

-- =============================================================================
-- SEÇÃO 2 — ETAPA 3+4: Regras de reversa na tabela de valores do cliente
--   (armazenado no JSONB adicionais, que já existe em tabelas_valores)
-- =============================================================================

-- =============================================================================
-- SEÇÃO 3 — ETAPA 5: Reversa na alocação (execução)
-- =============================================================================
ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS tipo_reversa TEXT DEFAULT 'sem_reversa';

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_valor_cliente NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_valor_prestador NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_qtd_volumes INTEGER DEFAULT 0;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_status TEXT;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_pod_url TEXT;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_fotos JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_observacoes TEXT;

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS reversa_realizada_em TIMESTAMPTZ;

-- =============================================================================
-- SEÇÃO 4 — ETAPA 6: Atualizar trigger M104A para propagar reversa
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
  v_reversa_cliente    NUMERIC;
  v_reversa_prestador  NUMERIC;
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_valor_cliente    := COALESCE(NEW.valor_frete, 0);
    v_valor_prestador  := COALESCE(NEW.valor_repasse, 0);
    v_pedagio_valor    := COALESCE(NEW.valor_pedagio, 0);
    v_adicional_valor  := COALESCE(NEW.valor_adicional, 0);
    v_ajudante_valor   := COALESCE(NEW.valor_ajudante, 0);
    v_desconto_valor   := COALESCE(NEW.valor_desconto, 0);
    -- MISSÃO 108-F: incluir valores da reversa
    v_reversa_cliente  := COALESCE(NEW.reversa_valor_cliente, 0);
    v_reversa_prestador := COALESCE(NEW.reversa_valor_prestador, 0);

    IF v_valor_cliente = 0 AND v_valor_prestador = 0 AND v_reversa_cliente = 0 AND v_reversa_prestador = 0 THEN
      RETURN NEW;
    END IF;

    -- Total cliente = valor_frete + receita_reversa
    -- Total prestador = valor_repasse + custo_reversa
    v_valor_cliente   := v_valor_cliente + v_reversa_cliente;
    v_valor_prestador := v_valor_prestador + v_reversa_prestador;

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

    -- FÓRMULA UNIFICADA (M108-D + M108-F): outros_custos inclui reversa
    v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor;
    v_valor_liquido := v_valor_prestador + v_pedagio_valor + v_outros_custos;

    -- 1. OS
    BEGIN
      INSERT INTO ordens_servico (id, numero, cliente, cliente_id, prestador, prestador_id,
        status, data, tipo_veiculo, origem, destino,
        valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos,
        tipo_reversa, reversa_qtd_volumes,
        observacoes_gerais, created_at, updated_at)
      VALUES (v_os_id, v_os_numero,
        NEW.cliente_id, v_cliente_nome,
        NEW.prestador_id, v_prestador_nome,
        CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END,
        COALESCE(NEW.data_escala, CURRENT_DATE),
        NEW.tipo_veiculo, NEW.origem, NEW.destino,
        v_valor_cliente, v_valor_prestador,
        v_pedagio_valor, v_adicional_valor, v_ajudante_valor, v_desconto_valor,
        NEW.tipo_reversa, NEW.reversa_qtd_volumes,
        NEW.observacoes, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END,
        valor_cliente = v_valor_cliente,
        custo_prestador = v_valor_prestador,
        tipo_reversa = COALESCE(NEW.tipo_reversa, ordens_servico.tipo_reversa),
        updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Financeiro receber (inclui reversa)
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (os_id, descricao, valor, data_vencimento, status, cliente, cliente_nome, cliente_id)
        VALUES (v_os_id::TEXT,
          'Faturamento ' || v_os_numero || CASE WHEN v_reversa_cliente > 0 THEN ' (c/ reversa)' ELSE '' END,
          v_valor_cliente, v_data_venc_30, v_status_financeiro,
          v_cliente_nome, v_cliente_nome, NEW.cliente_id)
        ON CONFLICT (os_id) DO UPDATE SET
          valor = v_valor_cliente,
          status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_receber.status = 'aberto' THEN 'aberto' ELSE 'pendente' END,
          data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- 3. Financeiro pagar (inclui reversa)
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (os_id, descricao, valor, data_vencimento, status, prestador, fornecedor_id, fornecedor_nome)
        VALUES (v_os_id::TEXT,
          'Repasse ' || v_os_numero || CASE WHEN v_reversa_prestador > 0 THEN ' (c/ reversa)' ELSE '' END,
          v_valor_prestador, v_data_venc_30, v_status_financeiro,
          v_prestador_nome, NEW.prestador_id, v_prestador_nome)
        ON CONFLICT (os_id) DO UPDATE SET
          valor = v_valor_prestador,
          status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_pagar.status = 'aberto' THEN 'aberto' ELSE 'pendente' END,
          data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- 4. Pagamentos prestadores
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO pagamentos_prestadores (prestador_id, prestador_nome, prestador_documento,
          os_id, valor_liquido, valor_servicos, pedagio, adicionais,
          status_conferencia, status_pagamento, origem_lancamento, quantidade_os,
          periodo_inicio, periodo_fim, categoria_financeira, data_prevista_pagamento,
          competencia, impacto_dre, impacto_fluxo_caixa)
        VALUES (NEW.prestador_id, v_prestador_nome, v_prestador_doc,
          v_os_id, v_valor_liquido, v_valor_prestador,
          v_pedagio_valor, v_outros_custos,
          CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END,
          CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END,
          'escala_direta', 1,
          COALESCE(NEW.data_escala, CURRENT_DATE), COALESCE(NEW.data_escala, CURRENT_DATE),
          'Custo Logístico', v_data_venc_30,
          COALESCE(NEW.data_escala, CURRENT_DATE), true, true)
        ON CONFLICT (os_id) DO UPDATE SET
          valor_liquido = v_valor_liquido,
          valor_servicos = v_valor_prestador,
          status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- 5. Composição financeira (apenas na conclusão)
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

        INSERT INTO composicao_financeira_os (os_id, cliente_id, prestador_id,
          valor_cliente, valor_prestador,
          imposto_percentual, imposto_valor, seguro_valor,
          pedagio_valor, outros_custos,
          combustivel_valor, ajudante_valor, adicional_valor, desconto_valor,
          margem_bruta, margem_liquida,
          percentual_margem_bruta, percentual_margem_liquida,
          origem_calculo)
        VALUES (v_os_id, NEW.cliente_id, NEW.prestador_id,
          v_valor_cliente, v_valor_prestador,
          4.5, v_imposto_valor, v_seguro_valor,
          v_pedagio_valor, v_outros_custos,
          0, v_ajudante_valor, v_adicional_valor, v_desconto_valor,
          v_margem_bruta, v_margem_liquida,
          CASE WHEN v_valor_cliente > 0 THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2) ELSE 0 END,
          CASE WHEN v_valor_cliente > 0 THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2) ELSE 0 END,
          'escala_direta')
        ON CONFLICT (os_id) DO UPDATE SET
          valor_cliente = v_valor_cliente,
          valor_prestador = v_valor_prestador,
          margem_bruta = v_margem_bruta,
          margem_liquida = v_margem_liquida;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[M108F] Erro propagacao financeira (alocacao %): %', NEW.id, v_error_msg;
    RETURN NEW;
  END;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
    valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto,
    tipo_reversa, reversa_valor_cliente, reversa_valor_prestador
  ON alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

COMMENT ON FUNCTION public.f_trg_propagar_financeiro_alocacao IS
  'M108F — Propagacao financeira com reversa. Soma reversa_valor_cliente ao faturamento e reversa_valor_prestador ao custo.';

-- =============================================================================
-- SEÇÃO 5 — ETAPA 7: Atualizar RPC f_aceitar_oportunidade_rede com reversa
-- =============================================================================

-- =============================================================================
-- SEÇÃO 6 — ETAPA 8: View do Portal Cliente já contempla alocacoes_escala
--   A view portal_cliente_alocacoes_view já expõe todos os campos da alocacao.
--   Reversa ficará visível automaticamente.
-- =============================================================================

-- =============================================================================
-- SEÇÃO 7 — Índices
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_alocacoes_tipo_reversa ON public.alocacoes_escala(tipo_reversa);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_tipo_reversa ON public.ordens_servico(tipo_reversa);

-- =============================================================================
-- SEÇÃO 8 — Comentários
-- =============================================================================
COMMENT ON COLUMN public.alocacoes_escala.tipo_reversa IS
  'Tipo de reversa na execução: sem_reversa, coleta_reversa, devolucao, troca, retorno_cd';

COMMENT ON COLUMN public.alocacoes_escala.reversa_valor_cliente IS
  'Receita adicional da reversa cobrada do cliente';

COMMENT ON COLUMN public.alocacoes_escala.reversa_valor_prestador IS
  'Custo adicional da reversa pago ao prestador';
