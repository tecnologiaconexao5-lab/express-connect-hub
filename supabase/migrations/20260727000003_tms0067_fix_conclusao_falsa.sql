-- MISSÃO TMS-006.7 — CORREÇÃO DO TRIGGER DE CONCLUSÃO FALSO POSITIVO
--
-- Problema: trg_evento_operacao_finalizada cria evento
-- 'escala.alocacao.concluida' quando finalizada=true,
-- inclusive quando status='cancelada'.
--
-- Correção: adicionar AND NEW.status != 'cancelada' na condição WHEN.
--
-- Migrations originais:
--   20260705_m99_event_bus_fundacao.sql (criação)
--   20260711_m109_p0_fix_m99_triggers_onconflict.sql (recreate da função)

-- 1. DROP trigger antigo
DROP TRIGGER IF EXISTS trg_evento_operacao_finalizada ON public.alocacoes_escala;

-- 2. Recria com condição corrigida (exclui cancelada)
CREATE TRIGGER trg_evento_operacao_finalizada
    AFTER UPDATE OF finalizada ON public.alocacoes_escala
    FOR EACH ROW
    WHEN (NEW.finalizada = true
          AND (OLD.finalizada IS DISTINCT FROM NEW.finalizada)
          AND NEW.status != 'cancelada')
    EXECUTE FUNCTION public.trg_evento_operacao_finalizada();

-- 3. Validação simplificada
DO $$
BEGIN
    RAISE NOTICE 'Trigger trg_evento_operacao_finalizada recriada com exclusao de cancelada';
END $$;
