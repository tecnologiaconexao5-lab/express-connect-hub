-- FIN-MASTER-363B.1 — Bloquear pagar pago sem baixa
-- Trigger que impede financeiro_pagar de assumir status 'pago'/'paga'/'baixado'
-- sem uma baixa correspondente em financeiro_baixas.
-- Espelho exato do padrão 363A.3 (financeiro_receber).

CREATE OR REPLACE FUNCTION public.trg_guardar_pagar_pago_sem_baixa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tem_baixa boolean;
BEGIN
  -- Só valida quando status muda para pago/paga/baixado
  IF NEW.status IN ('pago', 'paga', 'baixado') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'paga', 'baixado')) THEN
    
    -- Verificar se existe baixa não estornada
    SELECT EXISTS(
      SELECT 1 FROM public.financeiro_baixas
      WHERE titulo_tabela = 'financeiro_pagar'
        AND titulo_id = NEW.id
        AND NOT estornada
    ) INTO v_tem_baixa;
    
    IF NOT v_tem_baixa THEN
      RAISE EXCEPTION 'Não é permitido marcar conta a pagar como % sem baixa financeira correspondente. Use o fluxo oficial de baixa.', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_guardar_pagar_pago_sem_baixa ON public.financeiro_pagar;
CREATE TRIGGER trg_guardar_pagar_pago_sem_baixa
  BEFORE INSERT OR UPDATE OF status ON public.financeiro_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guardar_pagar_pago_sem_baixa();

-- Grants
GRANT EXECUTE ON FUNCTION public.trg_guardar_pagar_pago_sem_baixa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guardar_pagar_pago_sem_baixa() TO service_role;

COMMENT ON FUNCTION public.trg_guardar_pagar_pago_sem_baixa() IS 'FIN-363B.1: Bloqueia status pago/paga/baixado sem baixa correspondente';
