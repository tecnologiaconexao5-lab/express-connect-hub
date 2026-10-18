-- ==========================================================================
-- MISSÃO 133-D.7.1 — SCRIPT FINAL DE TESTE TRANSACIONAL DE AVANÇO
-- ==========================================================================
-- ATENÇÃO: NÃO EXECUTAR. Apenas revisão e planejamento.
-- Data: 2026-07-27
-- ==========================================================================

-- ==========================================================================
-- CONSTANTES
-- ==========================================================================
\set AUTH_USER_PRESTADOR_TESTE 'a5e51631-5ed8-430d-9041-4b185c03d821'
\set PRESTADOR_TESTE_ID        'e6646799-fbac-453e-a3ef-afdfc01a7085'
\set ALOCACAO_HML_ID           '76af8e4a-a3bc-492a-897d-4556574cc5d1'
\set AUTH_USER_OUTRO           '00000000-0000-0000-0000-000000000000'

-- Chave de idempotência única (gerar no momento do teste):
-- 'MISSAO133D7-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || gen_random_uuid()::text

-- ==========================================================================
-- ETAPA 4 — VALIDAÇÃO DO ROLLBACK
-- ==========================================================================

-- 4.1 — SNAPSHOT ANTES (consultas pré-transação)
-- Estas consultas devem ser executadas ANTES do BEGIN para capturar
-- o estado inicial de referência.

-- Snapshot A: Alocação candidata
SELECT id, ordem_servico_id, status, aceite_prestador, data_aceite,
       finalizada, data_finalizacao, horario_inicio_real, horario_fim_real,
       metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
       metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency,
       updated_at
FROM public.alocacoes_escala
WHERE id = :'ALOCACAO_HML_ID';

-- Snapshot B: Contagem de eventos relacionados
SELECT 'eventos_oficiais' AS tabela, COUNT(*) AS qtd
FROM public.eventos_oficiais
WHERE entity_id = :'ALOCACAO_HML_ID'::text
  AND entity_type = 'alocacao'
UNION ALL
SELECT 'operation_timeline_events', COUNT(*)
FROM public.operation_timeline_events
WHERE operation_id = :'ALOCACAO_HML_ID'::text
UNION ALL
SELECT 'historico_alocacoes_escala', COUNT(*)
FROM public.historico_alocacoes_escala
WHERE alocacao_id = :'ALOCACAO_HML_ID'::uuid;

-- 4.2 — TRANSAÇÃO DE TESTE
BEGIN;

-- Configurar contexto JWT completo (ver ETAPA 2)
SET LOCAL "request.jwt.claim.sub"    = :'AUTH_USER_PRESTADOR_TESTE';
SET LOCAL "request.jwt.claim.role"   = 'authenticated';
SET LOCAL "request.jwt.claims"       = '{"sub":"' || :'AUTH_USER_PRESTADOR_TESTE' || '","role":"authenticated"}';

-- Executar RPC
SELECT public.f_avancar_etapa_app_motorista(
  :'ALOCACAO_HML_ID'::uuid,                    -- p_alocacao_id
  'viagem_aceita'::text,                        -- p_etapa
  '{}'::jsonb,                                  -- p_payload
  'MISSAO133D7-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || gen_random_uuid()::text,  -- p_idempotency_key
  :'AUTH_USER_PRESTADOR_TESTE'::uuid            -- p_auth_user_id
) AS resultado_rpc;

-- Snapshot DENTRO da transação: verificar alterações
SELECT id, ordem_servico_id, status, aceite_prestador, data_aceite,
       finalizada, data_finalizacao, horario_inicio_real, horario_fim_real,
       metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
       metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency,
       updated_at
FROM public.alocacoes_escala
WHERE id = :'ALOCACAO_HML_ID';

SELECT 'eventos_oficiais' AS tabela, COUNT(*) AS qtd
FROM public.eventos_oficiais
WHERE entity_id = :'ALOCACAO_HML_ID'::text
  AND entity_type = 'alocacao'
UNION ALL
SELECT 'operation_timeline_events', COUNT(*)
FROM public.operation_timeline_events
WHERE operation_id = :'ALOCACAO_HML_ID'::text
UNION ALL
SELECT 'historico_alocacoes_escala', COUNT(*)
FROM public.historico_alocacoes_escala
WHERE alocacao_id = :'ALOCACAO_HML_ID'::uuid;

-- ASSERTIVAS DENTRO DA TRANSAÇÃO (verificar expectativas)
DO $$
DECLARE
  v_alocacao RECORD;
  v_resultado JSONB;
BEGIN
  SELECT * INTO v_alocacao
  FROM public.alocacoes_escala
  WHERE id = :'ALOCACAO_HML_ID';

  -- 1. Status deve ser 'aceita' (viagem_aceita → status aceita)
  IF v_alocacao.status != 'aceita' THEN
    RAISE EXCEPTION 'FALHA: status esperado=aceita, obtido=%', v_alocacao.status;
  END IF;

  -- 2. aceite_prestador deve ser true
  IF v_alocacao.aceite_prestador IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FALHA: aceite_prestador esperado=true, obtido=%', v_alocacao.aceite_prestador;
  END IF;

  -- 3. data_aceite deve ser preenchida
  IF v_alocacao.data_aceite IS NULL THEN
    RAISE EXCEPTION 'FALHA: data_aceite deveria ter sido preenchida';
  END IF;

  -- 4. etapa_atual deve ser 'viagem_aceita'
  IF v_alocacao.metadata->'app_motorista'->>'etapa_atual' != 'viagem_aceita' THEN
    RAISE EXCEPTION 'FALHA: etapa_atual esperada=viagem_aceita, obtida=%',
      v_alocacao.metadata->'app_motorista'->>'etapa_atual';
  END IF;

  -- 5. Não deve ter alterado finalizada
  IF v_alocacao.finalizada IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FALHA: finalizada deveria continuar false';
  END IF;

  RAISE NOTICE '✅ ASSERTIVAS OK: status=%, aceite=%, etapa=%, finalizada=%',
    v_alocacao.status, v_alocacao.aceite_prestador,
    v_alocacao.metadata->'app_motorista'->>'etapa_atual',
    v_alocacao.finalizada;
END;
$$;

-- ==========================================================================
-- ETAPA 6 — TESTE DE IDEMPOTÊNCIA
-- ==========================================================================

-- Repetir a chamada com a MESMA idempotency_key
-- (deve retornar idempotent = true sem alterar nada)

DO $$
DECLARE
  v_resultado JSONB;
  v_idempotency TEXT;
BEGIN
  -- Recuperar a chave usada
  SELECT metadata->'app_motorista'->>'ultima_idempotency' INTO v_idempotency
  FROM public.alocacoes_escala
  WHERE id = :'ALOCACAO_HML_ID';

  v_resultado := public.f_avancar_etapa_app_motorista(
    :'ALOCACAO_HML_ID'::uuid,
    'viagem_aceita',
    '{}',
    v_idempotency,                               -- mesma chave
    :'AUTH_USER_PRESTADOR_TESTE'::uuid
  );

  IF v_resultado->>'idempotent' != 'true' THEN
    RAISE EXCEPTION 'FALHA: segunda chamada deveria ser idempotente. Resultado: %', v_resultado;
  END IF;

  RAISE NOTICE '✅ IDEMPOTÊNCIA OK: %', v_resultado->>'message';
END;
$$;

-- ==========================================================================
-- ETAPA 5 — TESTES DE OWNERSHIP NEGATIVO
-- ==========================================================================

-- 5.1 — p_auth_user_id diferente de auth.uid()
DO $$
BEGIN
  IF (public.f_avancar_etapa_app_motorista(
    :'ALOCACAO_HML_ID'::uuid,
    'viagem_aceita',
    '{}',
    gen_random_uuid()::text,
    '00000000-0000-0000-0000-000000000000'::uuid   -- auth_user_id diferente
  )->>'error') != 'AUTH_USER_ID_INVALIDO' THEN
    RAISE EXCEPTION 'FALHA: deveria rejeitar AUTH_USER_ID_INVALIDO';
  END IF;
  RAISE NOTICE '✅ NEGATIVO 5.1 OK: AUTH_USER_ID_INVALIDO rejeitado';
END;
$$;

-- 5.2 — Alocação de outro prestador (simular auth de outro prestador)
DO $$
BEGIN
  -- Este teste requer SET LOCAL para outro auth_user_id.
  -- O esquema é: configurar auth como outro usuário que não tem
  -- vínculo com esta alocação.
  -- Como não há outro prestador com auth_user_id, usamos um UUID
  -- que não pertence a nenhum prestador.
  -- Resultado esperado: PRESTADOR_NAO_ENCONTRADO
  -- (pois o auth_user_id não existe em prestadores.auth_user_id)
  
  -- NOTA: Este teste exige reconfigurar SET LOCAL,
  -- o que requer uma nova subtransação ou bloco separado.
  -- NO ESCOPO ATUAL: apenas documentado.
  RAISE NOTICE '⏳ NEGATIVO 5.2: requer SET LOCAL separado (documentado no plano)';
END;
$$;

-- 5.3 — Transição inválida (pular de "" direto para "servico_finalizado")
DO $$
DECLARE
  v_resultado JSONB;
BEGIN
  v_resultado := public.f_avancar_etapa_app_motorista(
    :'ALOCACAO_HML_ID'::uuid,
    'servico_finalizado',                         -- etapa inválida (pula 14 etapas)
    '{}',
    gen_random_uuid()::text,
    :'AUTH_USER_PRESTADOR_TESTE'::uuid
  );

  IF v_resultado->>'error' != 'TRANSICAO_INVALIDA' THEN
    RAISE EXCEPTION 'FALHA: deveria rejeitar TRANSICAO_INVALIDA. Resultado: %', v_resultado;
  END IF;
  RAISE NOTICE '✅ NEGATIVO 5.3 OK: TRANSICAO_INVALIDA rejeitada';
END;
$$;

-- ==========================================================================
-- ROLLBACK — Reverter TUDO
-- ==========================================================================
ROLLBACK;

-- ==========================================================================
-- SNAPSHOT DEPOIS (verificar que tudo voltou ao estado original)
-- ==========================================================================

-- Comparar com os snapshots ANTES:
-- 1. Alocação deve ter os mesmos valores
-- 2. Contagens de eventos devem ser as mesmas
-- 3. Nenhum registro residual deve existir

SELECT id, ordem_servico_id, status, aceite_prestador, data_aceite,
       finalizada, data_finalizacao, horario_inicio_real, horario_fim_real,
       metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
       metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency,
       updated_at
FROM public.alocacoes_escala
WHERE id = :'ALOCACAO_HML_ID';

SELECT 'eventos_oficiais' AS tabela, COUNT(*) AS qtd
FROM public.eventos_oficiais
WHERE entity_id = :'ALOCACAO_HML_ID'::text
  AND entity_type = 'alocacao'
UNION ALL
SELECT 'operation_timeline_events', COUNT(*)
FROM public.operation_timeline_events
WHERE operation_id = :'ALOCACAO_HML_ID'::text
UNION ALL
SELECT 'historico_alocacoes_escala', COUNT(*)
FROM public.historico_alocacoes_escala
WHERE alocacao_id = :'ALOCACAO_HML_ID'::uuid;

-- Validação final: comparar com snapshot ANTES
DO $$
DECLARE
  v_etapa_atual TEXT;
  v_aceite BOOLEAN;
BEGIN
  SELECT metadata->'app_motorista'->>'etapa_atual',
         aceite_prestador
  INTO v_etapa_atual, v_aceite
  FROM public.alocacoes_escala
  WHERE id = :'ALOCACAO_HML_ID';

  IF v_etapa_atual IS NOT NULL OR v_aceite IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FALHA: ROLLBACK não reverteu as alterações! etapa=%, aceite=%',
      v_etapa_atual, v_aceite;
  END IF;

  RAISE NOTICE '✅ ROLLBACK VERIFIED: estado original restaurado. etapa=%, aceite=%',
    v_etapa_atual, v_aceite;
END;
$$;

-- ==========================================================================
-- RESUMO FINAL
-- ==========================================================================
-- SE TODAS AS ASSERTIVAS PASSARAM:
--   ✅ LÓGICA SQL TESTADA
--   ✅ OWNERSHIP SQL TESTADO
--   ✅ IDEMPOTÊNCIA SQL TESTADA
--   ✅ EFEITOS NO BANCO OBSERVADOS E REVERTIDOS
-- 
-- NÃO CLASSIFICAR COMO:
--   ❌ PostgREST homologado (requer JWT real + chamada REST)
--   ❌ App Flutter homologado (requer app real + JWT real)
--   ❌ Fluxo ponta a ponta homologado (requer ambas as anteriores)
-- ==========================================================================
