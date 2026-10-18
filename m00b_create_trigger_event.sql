-- FIX-POD-00B: Create trigger with QA columns
-- Production uses valor_frete/valor_repasse, QA uses valor_cliente/valor_prestador
-- QA is missing many columns - only use what exists

DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

CREATE TRIGGER trg_propagar_financeiro_alocacao
AFTER INSERT OR UPDATE OF status, finalizada, valor_cliente, valor_prestador, prestador_id
ON public.alocacoes_escala
FOR EACH ROW EXECUTE FUNCTION f_trg_propagar_financeiro_alocacao();
