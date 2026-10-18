-- ============================================================
-- ROLLBACK DE EMERGENCIA CORRIGIDO
-- Migracoes Pendentes 2026-07-31
--
-- ESTRATEGIA: rollback seguro e nao destrutivo.
-- NENHUM comando apaga colunas, tabelas, dados ou linhas.
-- NENHUMA policy anon/public/USING(true) e recriada.
--
-- ATENCAO: Execute APENAS a secao necessaria.
-- Cada secao e independente (BEGIN/COMMIT proprio).
-- ============================================================

-- ============================================================
-- ROLLBACK M1 - 20260730_fix_assinatura_legivel.sql
-- ============================================================
--
-- OBJETIVO
-- NENHUM - Rollback fisico e INSEGURO. Colunas adicionadas
-- em clientes (18 ADD COLUMN com DEFAULT) sao mantidas.
--
-- PRE-CONDICOES
-- N/A
--
-- COMANDOS
-- NENHUM
--
-- JUSTIFICATIVA
-- As 18 colunas adicionadas em clientes sao ADD COLUMN IF NOT
-- EXISTS com defaults seguros. Remove-las (DROP COLUMN) e
-- destrutivo: se houver dados em producao, o DROP COLUMN os
-- apaga permanentemente. Como nao temos como comprovar que as
-- colunas estao vazias, a unica acao segura e NAO FAZER NADA.
--
-- RISCOS
-- NENHUM: colunas inativas com DEFAULT nao causam impacto.
-- Se usadas pelo frontend sem valor, aparecem vazias - mesmo
-- comportamento esperado ANTES da migration.
--
-- VERIFICACAO
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'clientes'
--     AND column_name IN ('assinatura_legivel','regime_tributario','cnae');
--
-- CRITERIO PARA ABORTAR
-- N/A (sem comando para abortar)
--
-- STATUS
-- Rollback fisico NAO REALIZADO. Colunas mantidas.

-- ============================================================
-- ROLLBACK M2 - 20260722_m135b_portal_pedido_para_os.sql
-- ============================================================
--
-- OBJETIVO
-- Remover apenas a RPC converter_pedido_para_os (funcao nova).
-- Manter colunas, indices, trigger de evento (contem FIX da
-- M104 original que estava quebrada).
--
-- PRE-CONDICOES
-- - Nenhum processo automatico depende da RPC
-- - A trigger trg_evento_portal_pedido_criado DEVE permanecer
--   (versao original M104 referenciava colunas inexistentes:
--   tipo_servico, total_pedido, cidade_origem, cidade_destino)
--
-- COMANDOS

BEGIN;

DROP FUNCTION IF EXISTS public.converter_pedido_para_os(UUID, UUID);

-- NOTA: As seguintes alteracoes NAO sao revertidas:
--   - ordens_servico.pedido_portal_id (coluna)
--   - portal_pedidos.converted_at, erro_processamento,
--     codigo_erro, tentativas_processamento,
--     ultima_tentativa_em, solicitacao_via, data_solicitada
--   - idx_portal_pedidos_os_vinculada_unique (UNIQUE index)
--   - idx_ordens_servico_pedido_portal (INDEX)
--   - trg_evento_portal_pedido_criado (trigger + function)
--   - portal_pedidos_status_check (CHECK constraint)
--   Motivo: todas sao alteracoes aditivas ou corrigem bugs
--   da M104 original. Remove-las e desnecessario e arriscado.

RAISE NOTICE '[M2 OK] RPC converter_pedido_para_os removida';

COMMIT;

-- VERIFICACAO
--   SELECT proname FROM pg_proc
--   WHERE proname = 'converter_pedido_para_os'
--     AND pronamespace = 'public'::regnamespace;
--   -- Deve retornar 0 linhas

-- CRITERIO PARA ABORTAR
-- Se houver processos em fila que chamam a RPC.
-- Verificar: SELECT COUNT(*) FROM automacoes_logs
-- WHERE mensagem LIKE '%converter_pedido_para_os%'
--   AND criado_em > now() - interval '1 hour';

-- RISCOS
-- NENHUM: funcao sem callers conhecidos em producao.
-- Se houver caller futuro, a RPC pode ser recriada via M2.

-- STATUS
-- Rollback PARCIAL (apenas RPC removida, estrutura mantida)

-- ============================================================
-- ROLLBACK M3 - 20260725_missao_rls_fix_priority_tables.sql
-- ============================================================
--
-- OBJETIVO
-- Se as novas policies scoped estiverem BLOQUEANDO acesso
-- legitimo, criar policies ADICIONAIS seguras (authenticated
-- + tenant_usuarios) como margem de seguranca.
-- NUNCA remover policies scoped.
-- NUNCA restaurar anon/public.
--
-- PRE-CONDICOES
-- Antes de executar, testar se o bloqueio e causado pela
-- policy nova e nao por problema pre-existente:
--   SELECT current_tenant_id_safe();  -- deve retornar UUID valido
--   SELECT * FROM tenant_usuarios WHERE user_id = auth.uid();
--   SELECT f_obter_cliente_id_do_usuario();  -- deve retornar UUID ou NULL esperado
--
-- COMANDOS

BEGIN;

-- BLOCO CONDICIONAL - descomente APENAS o necessario

-- Se TMS nao consegue ler portal_ocorrencias:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_ocorrencias' AND policyname='po_select_tms_emergency') THEN
--     CREATE POLICY "po_select_tms_emergency" ON public.portal_ocorrencias
--       FOR SELECT TO authenticated
--       USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
--   END IF;
-- END $$;

-- Se TMS nao consegue ler entregas_protocolo:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='ep_select_tms_emergency') THEN
--     CREATE POLICY "ep_select_tms_emergency" ON public.entregas_protocolo
--       FOR SELECT TO authenticated
--       USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
--   END IF;
-- END $$;

-- Se TMS nao consegue ler documentos_prestadores:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documentos_prestadores' AND policyname='dp_select_tms_emergency') THEN
--     CREATE POLICY "dp_select_tms_emergency" ON public.documentos_prestadores
--       FOR SELECT TO authenticated
--       USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
--   END IF;
-- END $$;

-- Se TMS nao consegue ler pagamentos_prestadores:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pagamentos_prestadores' AND policyname='pp_select_tms_emergency') THEN
--     CREATE POLICY "pp_select_tms_emergency" ON public.pagamentos_prestadores
--       FOR SELECT TO authenticated
--       USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
--   END IF;
-- END $$;

-- Se Portal Cliente nao consegue ler dados:
--   Solucao: corrigir f_obter_cliente_id_do_usuario(), nao as policies.
--   Verificar: SELECT * FROM usuarios_cliente WHERE auth_user_id = auth.uid();

RAISE NOTICE '[M3 OK] Policies scoped mantidas. Nenhuma policy insegura adicionada.';

COMMIT;

-- VERIFICACAO
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND (roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name])
--     AND tablename IN ('documentos_prestadores','pagamentos_prestadores',
--       'portal_tracking_realtime','portal_pedidos','portal_ocorrencias',
--       'entregas_protocolo','portal_avaliacoes','portal_comprovantes',
--       'portal_rotas','portal_relatorios','portal_notificacoes',
--       'portal_protocolos','portal_preferencias_cliente','portal_faturas');
--   -- Deve retornar 0 linhas (nenhuma policy publica/anon)

-- CRITERIO PARA ABORTAR
-- Se policies anon/public forem detectadas (indicam que M3
-- nao foi aplicada). Executar:
--   SELECT COUNT(*) FROM pg_policies
--   WHERE roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name];

-- RISCOS
-- Emergency policies dao acesso amplo para qualquer
-- authenticated com tenant_usuarios. Mais permissivo que o
-- scoped original, mas SEGURO comparado ao anon/public.

-- STATUS
-- Rollback NAO REALIZADO (policies scoped mantidas).
-- Mitigacao via policies emergenciais adicionais
-- (descomentar se necessario).

-- ============================================================
-- ROLLBACK M4 - 20260725_missao_rls_fix_core_operations.sql
-- ============================================================
--
-- OBJETIVO
-- CONDICIONAL: So executar se App Motorista parar de funcionar
-- apos M4. Adicionar policies emergenciais seguras para
-- alocacoes_escala e ordens_servico.
-- NUNCA remover policies scoped.
-- NUNCA restaurar anon/public.
--
-- PRE-CONDICOES (OBRIGATORIAS antes de descomentar)
-- 1. Confirmar que App Motorista usa auth.uid() (nao anon key)
-- 2. Se usa anon key, NAO executar - migrar App para auth primeiro
-- 3. Verificar prestadores.auth_user_id:
--      SELECT id, auth_user_id FROM prestadores
--      WHERE auth_user_id IS NULL;
--    Se houver resultado, prestador nao consegue acessar
--
-- COMANDOS

BEGIN;

-- BLOCO CONDICIONAL - descomente APENAS se App Motorista bloquear

-- Se prestador nao consegue INSERT em alocacoes_escala:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alocacoes_escala' AND policyname='ae_insert_emergency') THEN
--     CREATE POLICY "ae_insert_emergency" ON public.alocacoes_escala
--       FOR INSERT TO authenticated
--       WITH CHECK (EXISTS (SELECT 1 FROM prestadores WHERE auth_user_id = auth.uid()));
--   END IF;
-- END $$;

-- Se prestador nao consegue SELECT ordens_servico
-- (os_select_prestador falha sem ordem_servico_id):
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ordens_servico' AND policyname='os_select_prestador_emergency') THEN
--     CREATE POLICY "os_select_prestador_emergency" ON public.ordens_servico
--       FOR SELECT TO authenticated
--       USING (EXISTS (SELECT 1 FROM prestadores WHERE auth_user_id = auth.uid()));
--   END IF;
-- END $$;

-- Se Portal Cliente nao consegue SELECT clientes:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes' AND policyname='clientes_select_emergency') THEN
--     CREATE POLICY "clientes_select_emergency" ON public.clientes
--       FOR SELECT TO authenticated
--       USING (id = f_obter_cliente_id_do_usuario());
--   END IF;
-- END $$;

RAISE NOTICE '[M4 OK] CONDICIONAL - Blocos comentados. Descomentar apenas se App Motorista parar.';

COMMIT;

-- VERIFICACAO
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('alocacoes_escala','ordens_servico','clientes')
--     AND (roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name]);
--   -- Deve retornar 0 linhas

-- CRITERIO PARA ABORTAR
-- Se prestadores.auth_user_id estiver vazio:
--   SELECT count(*) FROM prestadores WHERE auth_user_id IS NOT NULL;
-- Se = 0, policies emergenciais nao funcionariam.

-- RISCOS
-- Emergency policies dao acesso amplo a qualquer authenticated
-- com vinculo em prestadores. Ainda SEGURO (nao anon).
-- Se prestadores.auth_user_id nao populado, policies sao dead code.

-- STATUS
-- Rollback NAO REALIZADO. Mitigacao condicional.

-- ============================================================
-- ROLLBACK M5 - 20260731_p0_propagacao_financeira_trigger.sql
-- ============================================================
--
-- OBJETIVO
-- Remover o trigger P0 e restaurar a funcao M108F
-- (versao comprovada no repositorio em
-- supabase/migrations/20260711_m108f_logistica_reversa_enterprise.sql)
--
-- PRE-CONDICOES
-- Nenhuma alocacao em INSERT no momento (risco baixissimo:
-- DROP TRIGGER e instantaneo e nao bloqueante)
--
-- COMANDOS

BEGIN;

-- 1. Remove o trigger P0 (para de disparar a funcao atual)
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

-- 2. Restaura a funcao M108F (versao comprovada do repositorio)
--    Diferencas para P0:
--    - M108F nao atualiza updated_at em financeiro_receber/pagar
--    - M108F nao propaga pedgio_valor em financeiro_pagar ON CONFLICT
--    - M108F nao tem updated_at no ON CONFLICT da OS
--    Ambos os riscos sao aceitaveis para rollback de emergencia.
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
    v_reversa_cliente  := COALESCE(NEW.reversa_valor_cliente, 0);
    v_reversa_prestador := COALESCE(NEW.reversa_valor_prestador, 0);

    IF v_valor_cliente = 0 AND v_valor_prestador = 0
       AND v_reversa_cliente = 0 AND v_reversa_prestador = 0 THEN
      RETURN NEW;
    END IF;

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

    -- 2. Financeiro receber
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (os_id, descricao, valor, data_vencimento, status,
          cliente, cliente_nome, cliente_id)
        VALUES (v_os_id::TEXT,
          'Faturamento ' || v_os_numero || CASE WHEN v_reversa_cliente > 0 THEN ' (c/ reversa)' ELSE '' END,
          v_valor_cliente, v_data_venc_30, v_status_financeiro,
          v_cliente_nome, v_cliente_nome, NEW.cliente_id)
        ON CONFLICT (os_id) DO UPDATE SET
          valor = v_valor_cliente,
          status = CASE WHEN v_is_concluida THEN 'aberto'
                        WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                        ELSE 'pendente' END,
          data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- 3. Financeiro pagar
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (os_id, descricao, valor, data_vencimento, status,
          prestador, fornecedor_id, fornecedor_nome)
        VALUES (v_os_id::TEXT,
          'Repasse ' || v_os_numero || CASE WHEN v_reversa_prestador > 0 THEN ' (c/ reversa)' ELSE '' END,
          v_valor_prestador, v_data_venc_30, v_status_financeiro,
          v_prestador_nome, NEW.prestador_id, v_prestador_nome)
        ON CONFLICT (os_id) DO UPDATE SET
          valor = v_valor_prestador,
          status = CASE WHEN v_is_concluida THEN 'aberto'
                        WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                        ELSE 'pendente' END,
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
          'Custo Logistico', v_data_venc_30,
          COALESCE(NEW.data_escala, CURRENT_DATE), true, true)
        ON CONFLICT (os_id) DO UPDATE SET
          valor_liquido = v_valor_liquido,
          valor_servicos = v_valor_prestador,
          status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- 5. Composicao financeira (apenas na conclusao)
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

-- 3. Recria o trigger usando a funcao M108F
CREATE TRIGGER trg_propagar_financeiro_alocacao
  AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse,
    valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto,
    tipo_reversa, reversa_valor_cliente, reversa_valor_prestador
  ON alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao();

RAISE NOTICE '[M5 OK] Trigger P0 removido. Funcao M108F restaurada. Trigger recriado.';

COMMIT;

-- VERIFICACAO
--   SELECT tgname FROM pg_trigger
--   WHERE tgname = 'trg_propagar_financeiro_alocacao'
--     AND tgrelid > 0 AND NOT tgisinternal;
--   -- Deve retornar 1 linha

-- CRITERIO PARA ABORTAR
-- Nenhum. DROP TRIGGER + CREATE TRIGGER e operacao segura.
-- Se a funcao M108F tiver erro de sintaxe (improvavel,
-- copiada do repositorio comprovado), o CREATE OR REPLACE
-- falha e o bloco e revertido.

-- RISCOS
-- - Entre DROP e CREATE (< 100ms): propagacao nao funciona.
-- - M108F nao atualiza updated_at em financeiro_receber/pagar
--   (diferenca para P0). Relatorios podem mostrar data antiga.
-- - M108F nao propaga pedgio_valor em financeiro_pagar
--   ON CONFLICT. Valor nao e atualizado em re-INSERT.
-- Ambos aceitaveis para rollback de emergencia.

-- STATUS
-- Rollback COMPLETO da trigger. Funcao M108F restaurada
-- fielmente do repositorio (20260711_m108f_logistica_reversa_enterprise.sql)

-- ============================================================
-- RELATORIO FINAL DE ROLLBACK
-- ============================================================
--
-- Migration | Acao de rollback         | Destrutivo? | Anon/Public?
-- M1        | NENHUMA (colunas mantidas)| NAO         | N/A
-- M2        | DROP RPC apenas           | NAO         | NAO
-- M3        | Policies emerg. (condic.) | NAO         | NAO
-- M4        | Policies emerg. (condic.) | NAO         | NAO
-- M5        | DROP+CREATE trigger+M108F | NAO         | NAO
--
-- NENHUM comando DROP COLUMN, DROP TABLE, DELETE, TRUNCATE.
-- NENHUMA policy anon, public, USING(true), WITH CHECK(true).
-- NENHUM dado apagado.
-- ============================================================
