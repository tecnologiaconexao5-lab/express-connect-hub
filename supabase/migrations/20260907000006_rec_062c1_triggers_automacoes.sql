-- ============================================================================
-- REC-06.2C.1 — 3 Triggers de Automação em recrutamento_candidatos
-- Conexão Express TMS
-- Data: 2026-09-08
--
-- FLUXO: DB Trigger → eventos_oficiais → eventProcessorWorker → ação + log
--
-- REGRA CRÍTICA:
--   ultima_execucao e total_execucoes são atualizados SOMENTE após
--   processamento efetivamente bem-sucedido no eventProcessorWorker.
--   Evento detectado ≠ automação executada.
-- ============================================================================

-- ============================================================================
-- SEÇÃO 1: TRIGGER — NOVO CANDIDATO
-- Detecta INSERT em recrutamento_candidatos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_trg_novo_candidato_evento()
RETURNS TRIGGER AS $$
DECLARE
  v_automacao_id UUID;
BEGIN
  -- Verificar se existe automação ativa do tipo 'notifcacao' (novo candidato)
  SELECT id INTO v_automacao_id
  FROM public.recrutamento_automacoes
  WHERE tipo = 'notificacao' AND status = 'ativa'
  LIMIT 1;

  -- Se não há automação ativa, apenas retorna (sem bloquear INSERT)
  IF v_automacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Inserir evento no Event Bus (best-effort — não bloqueia o cadastro)
  BEGIN
    INSERT INTO public.eventos_oficiais (
      event_type, entity_type, entity_id, payload, source, visibility
    ) VALUES (
      'recrutamento.candidato.criado',
      'recrutamento_candidatos',
      NEW.id,
      jsonb_build_object(
        'candidato_id', NEW.id,
        'nome', NEW.nome,
        'telefone', NEW.telefone,
        'cidade', NEW.cidade,
        'uf', NEW.uf,
        'stage', NEW.stage,
        'score', NEW.score,
        'automacao_id', v_automacao_id
      ),
      'trigger_db',
      'internal'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'REC-06.2C.1 [novo_candidato]: falha ao inserir evento: %', SQLERRM;
  END;

  -- NÃO atualizar contadores aqui — eventProcessorWorker atualiza após processamento
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_novo_candidato_evento ON public.recrutamento_candidatos;
CREATE TRIGGER trg_novo_candidato_evento
  AFTER INSERT ON public.recrutamento_candidatos
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_novo_candidato_evento();

COMMENT ON FUNCTION public.f_trg_novo_candidato_evento() IS
  'REC-06.2C.1: Detecta novo candidato e cria evento em eventos_oficiais. '
  'Contadores são atualizados apenas pelo eventProcessorWorker após processamento bem-sucedido.';

COMMENT ON TRIGGER trg_novo_candidato_evento ON public.recrutamento_candidatos IS
  'REC-06.2C.1: AFTER INSERT → evento recrutamento.candidato.criado para automação.';


-- ============================================================================
-- SEÇÃO 2: TRIGGER — SCORE LIMIAR CRUZADO
-- Detecta UPDATE em score que cruza o limiar configurado na automação
-- Condição: OLD.score < limite AND NEW.score >= limite (cruzamento ascendente)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_trg_score_limiar_evento()
RETURNS TRIGGER AS $$
DECLARE
  v_automacao RECORD;
  v_limiar INT;
  v_eventos_inseridos INT := 0;
BEGIN
  -- Só processa se score mudou
  IF OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;

  -- Para cada automação ativa do tipo 'score'
  FOR v_automacao IN
    SELECT id, trigger
    FROM public.recrutamento_automacoes
    WHERE tipo = 'score' AND status = 'ativa'
  LOOP
    -- Extrair limiar do JSONB trigger
    v_limiar := (v_automacao.trigger->>'score_min')::INT;

    -- Se limiar não configurado ou inválido, skip
    IF v_limiar IS NULL OR v_limiar < 0 OR v_limiar > 100 THEN
      CONTINUE;
    END IF;

    -- Condição de cruzamento: OLD < limiar AND NEW >= limiar
    IF COALESCE(OLD.score, 0) < v_limiar AND NEW.score >= v_limiar THEN
      BEGIN
        INSERT INTO public.eventos_oficiais (
          event_type, entity_type, entity_id, payload, source, visibility
        ) VALUES (
          'recrutamento.score.limiar_cruzado',
          'recrutamento_candidatos',
          NEW.id,
          jsonb_build_object(
            'candidato_id', NEW.id,
            'nome', NEW.nome,
            'score_anterior', OLD.score,
            'score_novo', NEW.score,
            'limiar_configurado', v_limiar,
            'classificacao', NEW.classificacao_comprometimento,
            'automacao_id', v_automacao.id
          ),
          'trigger_db',
          'internal'
        );
        v_eventos_inseridos := v_eventos_inseridos + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'REC-06.2C.1 [score_limiar]: falha ao inserir evento: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  -- NÃO atualizar contadores aqui — eventProcessorWorker atualiza após processamento
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_score_limiar_evento ON public.recrutamento_candidatos;
CREATE TRIGGER trg_score_limiar_evento
  AFTER UPDATE OF score ON public.recrutamento_candidatos
  FOR EACH ROW
  WHEN (OLD.score IS DISTINCT FROM NEW.score)
  EXECUTE FUNCTION public.f_trg_score_limiar_evento();

COMMENT ON FUNCTION public.f_trg_score_limiar_evento() IS
  'REC-06.2C.1: Detecta cruzamento de limiar de score (OLD < limite AND NEW >= limite). '
  'Cria evento por cada automação ativa do tipo score. Contadores atualizados pelo worker.';

COMMENT ON TRIGGER trg_score_limiar_evento ON public.recrutamento_candidatos IS
  'REC-06.2C.1: AFTER UPDATE OF score → evento recrutamento.score.limiar_cruzado quando cruza limiar.';


-- ============================================================================
-- SEÇÃO 3: TRIGGER — VALIDADE DOCUMENTAL
-- Detecta documentos com validade próxima ou vencida (≤30 dias)
-- Reutiliza padrão do trigger existente + scheduler no worker
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_trg_validade_documento_evento()
RETURNS TRIGGER AS $$
DECLARE
  v_automacao_id UUID;
  v_doc JSONB;
  v_nome TEXT;
  v_validade DATE;
  v_dias INTEGER;
  v_documento_status TEXT;
BEGIN
  -- Verificar se existe automação ativa do tipo 'validade_documento'
  SELECT id INTO v_automacao_id
  FROM public.recrutamento_automacoes
  WHERE tipo = 'validade_documento' AND status = 'ativa'
  LIMIT 1;

  -- Se não há automação ativa, retorna
  IF v_automacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Iterar documentos do array JSONB
  IF NEW.documentos IS NOT NULL AND jsonb_typeof(NEW.documentos) = 'array' THEN
    FOR v_doc IN SELECT jsonb_array_elements(NEW.documentos)
    LOOP
      v_nome := v_doc->>'nome';
      v_documento_status := v_doc->>'status';

      -- Pular se não tem data de validade
      BEGIN
        v_validade := (v_doc->>'dataValidade')::DATE;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      IF v_validade IS NULL THEN
        CONTINUE;
      END IF;

      v_dias := v_validade - CURRENT_DATE;

      -- Documento vencido (dias < 0) ou próximo do vencimento (≤30 dias)
      IF v_dias <= 30 THEN
        BEGIN
          INSERT INTO public.eventos_oficiais (
            event_type, entity_type, entity_id, payload, source, visibility
          ) VALUES (
            'recrutamento.documento.vencimento_proximo',
            'recrutamento_candidatos',
            NEW.id,
            jsonb_build_object(
              'candidato_id', NEW.id,
              'nome_candidato', NEW.nome,
              'tipo_documento', v_nome,
              'validade', v_validade::TEXT,
              'dias_para_vencer', v_dias,
              'status_documento', v_documento_status,
              'ja_vencido', v_dias < 0,
              'automacao_id', v_automacao_id
            ),
            'trigger_db',
            'internal'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'REC-06.2C.1 [validade_doc]: falha ao inserir evento: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;

  -- NÃO atualizar contadores aqui — eventProcessorWorker atualiza após processamento
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validade_documento_evento ON public.recrutamento_candidatos;
CREATE TRIGGER trg_validade_documento_evento
  AFTER INSERT OR UPDATE OF documentos ON public.recrutamento_candidatos
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_validade_documento_evento();

COMMENT ON FUNCTION public.f_trg_validade_documento_evento() IS
  'REC-06.2C.1: Detecta documentos com validade ≤30 dias no JSONB documentos. '
  'Cria evento por documento vencido/próximo. Contadores atualizados pelo worker. '
  'NÃO bloqueia/libera prestador — apenas gera alerta.';

COMMENT ON TRIGGER trg_validade_documento_evento ON public.recrutamento_candidatos IS
  'REC-06.2C.1: AFTER INSERT OR UPDATE OF documentos → evento recrutamento.documento.vencimento_proximo.';


-- ============================================================================
-- SEÇÃO 4: FUNÇÃO DE SCAN PERIÓDICO (chamada pelo eventProcessorWorker)
-- Detecta documentos que entram na janela de vencimento apenas pela passagem
-- do tempo (sem INSERT/UPDATE na tabela).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_scan_validade_documentos()
RETURNS TABLE (
  candidato_id UUID,
  nome TEXT,
  tipo_documento TEXT,
  validade DATE,
  dias_para_vencer INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id AS candidato_id,
    rc.nome,
    doc->>'nome' AS tipo_documento,
    (doc->>'dataValidade')::DATE AS validade,
    ((doc->>'dataValidade')::DATE - CURRENT_DATE) AS dias_para_vencer
  FROM public.recrutamento_candidatos rc,
       jsonb_array_elements(rc.documentos) AS doc
  WHERE rc.documentos IS NOT NULL
    AND jsonb_typeof(rc.documentos) = 'array'
    AND (doc->>'dataValidade') IS NOT NULL
    AND (doc->>'dataValidade') != ''
    AND ((doc->>'dataValidade')::DATE - CURRENT_DATE) <= 30
    AND ((doc->>'dataValidade')::DATE - CURRENT_DATE) >= -365;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.f_scan_validade_documentos() IS
  'REC-06.2C.1: Scan periódico de documentos vencidos/próximos. '
  'Chamado pelo eventProcessorWorker a cada 5 minutos. Não bloqueia/libera prestador.';


-- ============================================================================
-- SEÇÃO 5: RLS para search path seguro
-- ============================================================================

ALTER FUNCTION public.f_trg_novo_candidato_evento() SET search_path = public;
ALTER FUNCTION public.f_trg_score_limiar_evento() SET search_path = public;
ALTER FUNCTION public.f_trg_validade_documento_evento() SET search_path = public;
ALTER FUNCTION public.f_scan_validade_documentos() SET search_path = public;


-- ============================================================================
-- FIM — REC-06.2C.1
-- ============================================================================
