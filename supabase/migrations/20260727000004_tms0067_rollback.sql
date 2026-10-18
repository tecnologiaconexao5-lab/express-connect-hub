-- ROLLBACK da MISSÃO TMS-006.7 — Restaura trigger original (com bug)
--
-- ATENÇÃO: Este rollback restaura o bug do falso positivo:
-- cancelamento gera evento 'escala.alocacao.concluida' indevidamente.

DROP TRIGGER IF EXISTS trg_evento_operacao_finalizada ON public.alocacoes_escala;

CREATE TRIGGER trg_evento_operacao_finalizada
    AFTER UPDATE OF finalizada ON public.alocacoes_escala
    FOR EACH ROW
    WHEN (NEW.finalizada = true AND (OLD.finalizada IS DISTINCT FROM NEW.finalizada))
    EXECUTE FUNCTION public.trg_evento_operacao_finalizada();
