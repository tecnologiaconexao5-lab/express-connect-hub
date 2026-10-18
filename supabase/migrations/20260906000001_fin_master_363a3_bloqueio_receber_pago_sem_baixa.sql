-- FIN-MASTER-363A.3 — Bloquear receber pago sem baixa
-- Trigger que impede financeiro_receber de assumir status 'pago'/'recebido'/'baixado'
-- sem uma baixa correspondente em financeiro_baixas.

CREATE OR REPLACE FUNCTION public.trg_guardar_receber_pago_sem_baixa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tem_baixa boolean;
BEGIN
  -- Só valida quando status muda para pago/recebido/baixado
  IF NEW.status IN ('pago', 'recebido', 'baixado') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'recebido', 'baixado')) THEN
    
    -- Verificar se existe baixa não estornada
    SELECT EXISTS(
      SELECT 1 FROM public.financeiro_baixas
      WHERE titulo_tabela = 'financeiro_receber'
        AND titulo_id = NEW.id
        AND NOT estornada
    ) INTO v_tem_baixa;
    
    IF NOT v_tem_baixa THEN
      RAISE EXCEPTION 'Não é permitido marcar recebível como % sem baixa financeira correspondente. Use o fluxo oficial de baixa.', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_guardar_receber_pago_sem_baixa ON public.financeiro_receber;
CREATE TRIGGER trg_guardar_receber_pago_sem_baixa
  BEFORE INSERT OR UPDATE OF status ON public.financeiro_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guardar_receber_pago_sem_baixa();

-- Grants
GRANT EXECUTE ON FUNCTION public.trg_guardar_receber_pago_sem_baixa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guardar_receber_pago_sem_baixa() TO service_role;

COMMENT ON FUNCTION public.trg_guardar_receber_pago_sem_baixa() IS 'FIN-363A.3: Bloqueia status pago/recebido/baixado sem baixa correspondente';
