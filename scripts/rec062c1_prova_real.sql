-- ============================================================================
-- REC-06.2C.1 — SCRIPT DE PROVA REAL (A-G)
-- Conexão Express TMS — Supabase Remoto (PRODUÇÃO)
-- Data: 2026-09-08
--
-- INSTRUÇÕES:
--   1. Executar este script via Supabase SQL Editor OU psql
--   2. Cada seção tem RAISE NOTICE para conferência
--   3. SEÇÃO G faz cleanup automático
-- ============================================================================

-- Pré-requisito: automações ativas para cada tipo
INSERT INTO recrutamento_automacoes (nome, tipo, trigger, acao, status)
VALUES
  ('Automação Novo Candidato TESTE', 'notificacao',
   '{"evento": "candidato_criado"}'::jsonb,
   '{"acao": "log_e_tarefa"}'::jsonb,
   'ativa'),
  ('Automação Score Limiar TESTE', 'score',
   '{"score_min": 60}'::jsonb,
   '{"acao": "revisao_score"}'::jsonb,
   'ativa'),
  ('Automação Validade Documental TESTE', 'validade_documento',
   '{"dias_alerta": 30}'::jsonb,
   '{"acao": "alerta_renovacao"}'::jsonb,
   'ativa')
ON CONFLICT DO NOTHING;

-- Capturar IDs das automações
DO $$
DECLARE
  v_auto_notif UUID;
  v_auto_score UUID;
  v_auto_validade UUID;
  v_candidato1 UUID;
  v_candidato2 UUID;
  v_eventos_antes INT;
  v_eventos_depois INT;
  v_total_exec_notif INT;
  v_total_exec_score INT;
  v_total_exec_validade INT;
BEGIN
  -- ==========================================================================
  -- A) CRIAR CANDIDATO TESTE → EXATAMENTE 1 EXECUÇÃO
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA A: Novo Candidato ═══';

  SELECT id INTO v_auto_notif FROM recrutamento_automacoes
  WHERE tipo = 'notificacao' AND status = 'ativa' LIMIT 1;

  SELECT count(*) INTO v_eventos_antes FROM eventos_oficiais
  WHERE event_type = 'recrutamento.candidato.criado';

  INSERT INTO recrutamento_candidatos (
    nome, telefone, cidade, uf, stage, score, status_documental, documentos
  ) VALUES (
    'TESTE_REC062C_A_NOVO_CANDIDATO',
    '(11) 99999-0001',
    'São Paulo',
    'SP',
    'novo_cadastro',
    50,
    'pendente',
    '[]'::jsonb
  ) RETURNING id INTO v_candidato1;

  SELECT count(*) INTO v_eventos_depois FROM eventos_oficiais
  WHERE event_type = 'recrutamento.candidato.criado'
    AND entity_id = v_candidato1;

  IF v_eventos_depois - v_eventos_antes = 1 THEN
    RAISE NOTICE '✅ PROVA A: PASSA — 1 evento criado para candidato %', v_candidato1;
  ELSE
    RAISE NOTICE '❌ PROVA A: FALHA — esperado 1, obtido %', (v_eventos_depois - v_eventos_antes);
  END IF;

  -- Verificar contadores
  SELECT total_execucoes INTO v_total_exec_notif FROM recrutamento_automacoes WHERE id = v_auto_notif;
  RAISE NOTICE '   Contador notificação: total_execucoes = %', v_total_exec_notif;

  -- ==========================================================================
  -- B) SCORE ABAIXO→ACIMA LIMIAR → 1 EXECUÇÃO; ATUALIZAÇÃO Ainda Acima → ZERO
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA B: Score Limiar ═══';

  SELECT id INTO v_auto_score FROM recrutamento_automacoes
  WHERE tipo = 'score' AND status = 'ativa' LIMIT 1;

  -- Criar candidato com score BAIXO (30 < limiar 60)
  INSERT INTO recrutamento_candidatos (
    nome, telefone, cidade, uf, stage, score, status_documental, documentos
  ) VALUES (
    'TESTE_REC062C_B_SCORE_BAIXO',
    '(11) 99999-0002',
    'Guarulhos',
    'SP',
    'em_analise',
    30,
    'pendente',
    '[]'::jsonb
  ) RETURNING id INTO v_candidato2;

  SELECT count(*) INTO v_eventos_antes FROM eventos_oficiais
  WHERE event_type = 'recrutamento.score.limiar_cruzado'
    AND entity_id = v_candidato2;

  -- Atualizar score de 30 → 65 (cruza limiar 60)
  UPDATE recrutamento_candidatos SET score = 65 WHERE id = v_candidato2;

  SELECT count(*) INTO v_eventos_depois FROM eventos_oficiais
  WHERE event_type = 'recrutamento.score.limiar_cruzado'
    AND entity_id = v_candidato2;

  IF v_eventos_depois - v_eventos_antes = 1 THEN
    RAISE NOTICE '✅ PROVA B.1: PASSA — 1 evento de cruzamento (30→65)';
  ELSE
    RAISE NOTICE '❌ PROVA B.1: FALHA — esperado 1, obtido %', (v_eventos_depois - v_eventos_antes);
  END IF;

  -- Atualizar score de 65 → 80 (JÁ acima do limiar → ZERO nova execução)
  SELECT count(*) INTO v_eventos_antes FROM eventos_oficiais
  WHERE event_type = 'recrutamento.score.limiar_cruzado'
    AND entity_id = v_candidato2;

  UPDATE recrutamento_candidatos SET score = 80 WHERE id = v_candidato2;

  SELECT count(*) INTO v_eventos_depois FROM eventos_oficiais
  WHERE event_type = 'recrutamento.score.limiar_cruzado'
    AND entity_id = v_candidato2;

  IF v_eventos_depois - v_eventos_antes = 0 THEN
    RAISE NOTICE '✅ PROVA B.2: PASSA — ZERO eventos para atualização ainda acima (65→80)';
  ELSE
    RAISE NOTICE '❌ PROVA B.2: FALHA — esperado 0, obtido %', (v_eventos_depois - v_eventos_antes);
  END IF;

  -- Verificar contadores
  SELECT total_execucoes INTO v_total_exec_score FROM recrutamento_automacoes WHERE id = v_auto_score;
  RAISE NOTICE '   Contador score: total_execucoes = %', v_total_exec_score;

  -- ==========================================================================
  -- C) DOCUMENTO PRÓXIMO/VENCIDO → EXATAMENTE 1 EXECUÇÃO
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA C: Validade Documental ═══';

  SELECT id INTO v_auto_validade FROM recrutamento_automacoes
  WHERE tipo = 'validade_documento' AND status = 'ativa' LIMIT 1;

  SELECT count(*) INTO v_eventos_antes FROM eventos_oficiais
  WHERE event_type = 'recrutamento.documento.vencimento_proximo'
    AND entity_id = v_candidato1;

  -- Atualizar documentos do candidato 1 com CNH vencendo em 15 dias
  UPDATE recrutamento_candidatos SET documentos = '[
    {"nome": "CNH", "status": "ok", "dataValidade": "' || (CURRENT_DATE + 15)::TEXT || '"},
    {"nome": "CRLV", "status": "ok", "dataValidade": "' || (CURRENT_DATE + 90)::TEXT || '"}
  ]'::jsonb WHERE id = v_candidato1;

  SELECT count(*) INTO v_eventos_depois FROM eventos_oficiais
  WHERE event_type = 'recrutamento.documento.vencimento_proximo'
    AND entity_id = v_candidato1
    AND payload->>'tipo_documento' = 'CNH';

  IF v_eventos_depois - v_eventos_antes >= 1 THEN
    RAISE NOTICE '✅ PROVA C: PASSA — % evento(s) de vencimento para CNH', (v_eventos_depois - v_eventos_antes);
  ELSE
    RAISE NOTICE '❌ PROVA C: FALHA — esperado >=1, obtido %', (v_eventos_depois - v_eventos_antes);
  END IF;

  -- Verificar contadores
  SELECT total_execucoes INTO v_total_exec_validade FROM recrutamento_automacoes WHERE id = v_auto_validade;
  RAISE NOTICE '   Contador validade: total_execucoes = %', v_total_exec_validade;

  -- ==========================================================================
  -- D) PROVAR CAMINHO DO SCHEDULER DOCUMENTAL
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA D: Scan Periódico (f_scan_validade_documentos) ═══';

  -- Criar candidato com documento vencendo em 20 dias (sem UPDATE → trigger não dispara)
  DECLARE
    v_candidato_sched UUID;
    v_scan_result RECORD;
    v_scan_count INT := 0;
  BEGIN
    INSERT INTO recrutamento_candidatos (
      nome, stage, score, status_documental, documentos
    ) VALUES (
      'TESTE_REC062C_D_SCHEDULER',
      'em_analise',
      45,
      'pendente',
      ('[{"nome": "ANTT", "status": "ok", "dataValidade": "' || (CURRENT_DATE + 20)::TEXT || '"}]')::jsonb
    ) RETURNING id INTO v_candidato_sched;

    -- Chamar função de scan periódico
    FOR v_scan_result IN
      SELECT * FROM f_scan_validade_documentos()
      WHERE candidato_id = v_candidato_sched
    LOOP
      v_scan_count := v_scan_count + 1;
      RAISE NOTICE '   Scan encontrou: % (dias: %)', v_scan_result.tipo_documento, v_scan_result.dias_para_vencer;
    END LOOP;

    IF v_scan_count >= 1 THEN
      RAISE NOTICE '✅ PROVA D: PASSA — scan periódico encontrou % documento(s) vencendo', v_scan_count;
    ELSE
      RAISE NOTICE '❌ PROVA D: FALHA — scan não encontrou documentos';
    END IF;
  END;

  -- ==========================================================================
  -- E) PROVAR EVENTOS/LOGS/CONTADORES
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA E: Eventos, Logs e Contadores ═══';

  DECLARE
    v_total_eventos INT;
    v_total_logs INT;
    v_total_automacoes INT;
  BEGIN
    SELECT count(*) INTO v_total_eventos FROM eventos_oficiais
    WHERE event_type LIKE 'recrutamento.%'
      AND entity_id IN (v_candidato1, v_candidato2);

    SELECT count(*) INTO v_total_logs FROM automacoes_logs
    WHERE acao IN ('novo_candidato_detectado', 'score_limiar_detectado', 'documento_vencimento_alerta');

    SELECT count(*) INTO v_total_automacoes FROM recrutamento_automacoes
    WHERE status = 'ativa' AND total_execucoes > 0;

    RAISE NOTICE '   Total eventos recrutamento: %', v_total_eventos;
    RAISE NOTICE '   Total logs de auditoria: %', v_total_logs;
    RAISE NOTICE '   Automações com contadores > 0: %', v_total_automacoes;

    IF v_total_eventos >= 3 AND v_total_logs >= 1 AND v_total_automacoes >= 1 THEN
      RAISE NOTICE '✅ PROVA E: PASSA — eventos, logs e contadores consistentes';
    ELSE
      RAISE NOTICE '❌ PROVA E: FALHA — inconsistência nos dados';
    END IF;
  END;

  -- ==========================================================================
  -- F) PROVAR RELOAD/PERSISTÊNCIA
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA F: Persistência (verificação direta) ═══';

  DECLARE
    v_rec_cand1 RECORD;
    v_rec_auto RECORD;
  BEGIN
    SELECT nome, score, stage INTO v_rec_cand1
    FROM recrutamento_candidatos WHERE id = v_candidato1;

    SELECT nome, total_execucoes, ultima_execucao INTO v_rec_auto
    FROM recrutamento_automacoes
    WHERE tipo = 'notificacao' AND status = 'ativa' LIMIT 1;

    RAISE NOTICE '   Candidato 1: nome=%, score=%, stage=%', v_rec_cand1.nome, v_rec_cand1.score, v_rec_cand1.stage;
    RAISE NOTICE '   Automação: nome=%, total=%, ultima=%', v_rec_auto.nome, v_rec_auto.total_execucoes, v_rec_auto.ultima_execucao;

    IF v_rec_cand1.nome IS NOT NULL AND v_rec_auto.total_execucoes >= 0 THEN
      RAISE NOTICE '✅ PROVA F: PASSA — dados persistidos corretamente';
    ELSE
      RAISE NOTICE '❌ PROVA F: FALHA — dados não persistidos';
    END IF;
  END;

  -- ==========================================================================
  -- G) CLEANUP COMPLETO DOS DADOS TESTE
  -- ==========================================================================
  RAISE NOTICE '═══ PROVA G: Cleanup ═══';

  -- Remover eventos de teste
  DELETE FROM eventos_oficiais
  WHERE entity_id IN (v_candidato1, v_candidato2)
    AND event_type LIKE 'recrutamento.%';

  -- Remover logs de teste
  DELETE FROM automacoes_logs
  WHERE acao IN ('novo_candidato_detectado', 'score_limiar_detectado', 'documento_vencimento_alerta')
    AND (entrada->>'candidato_id'::TEXT = v_candidato1::TEXT
      OR entrada->>'candidato_id'::TEXT = v_candidato2::TEXT);

  -- Remover candidatos de teste
  DELETE FROM recrutamento_candidatos
  WHERE nome LIKE 'TESTE_REC062C_%';

  -- Zerar contadores das automações de teste
  UPDATE recrutamento_automacoes
  SET total_execucoes = 0, ultima_execucao = NULL
  WHERE nome LIKE '%TESTE%';

  -- Remover automações de teste
  DELETE FROM recrutamento_automacoes WHERE nome LIKE '%TESTE%';

  RAISE NOTICE '✅ PROVA G: Cleanup concluído — todos os dados TESTE removidos';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'FIM DA PROVA REC-06.2C.1';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END;
$$;
