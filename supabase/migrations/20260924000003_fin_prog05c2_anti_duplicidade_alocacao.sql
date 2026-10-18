-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FIN-PROG-05C.2 — ANTI-DUPLICIDADE POR ALOCAÇÃO
-- Altera SOMENTE a função existente f_trg_fatura_itens_anti_duplicidade.
-- Passa a identificar a operação por os_id quando disponível, senão por
-- alocacao_id. Comparação explicita coluna-a-coluna (sem concatenacao de texto,
-- evitando colisao entre dominios uuid diferentes).
-- Nao cria segundo trigger. Historico existente intacto (trigger so em writes).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_anti_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dup_id uuid;
  v_status_fatura text;
BEGIN
  SELECT status INTO v_status_fatura FROM public.faturas WHERE id = NEW.fatura_id;

  IF v_status_fatura IS DISTINCT FROM 'cancelada' THEN
    IF NEW.os_id IS NOT NULL THEN
      -- Operacao identificada pela OS (dominio os_id)
      SELECT fi.id INTO v_dup_id
      FROM public.fatura_itens fi
      JOIN public.faturas f ON f.id = fi.fatura_id
      WHERE fi.os_id = NEW.os_id
        AND fi.status = 'ativo'
        AND f.status IS DISTINCT FROM 'cancelada'
        AND fi.fatura_id IS DISTINCT FROM NEW.fatura_id
      LIMIT 1;
      IF v_dup_id IS NOT NULL THEN
        RAISE EXCEPTION 'SERVIÇO_JA_FATURADO: A OS % já está vinculada a outra fatura ativa.', NEW.os_id;
      END IF;
    ELSIF NEW.alocacao_id IS NOT NULL THEN
      -- Operacao identificada pela ALOCACAO (dominio alocacao_id); so itens sem OS
      SELECT fi.id INTO v_dup_id
      FROM public.fatura_itens fi
      JOIN public.faturas f ON f.id = fi.fatura_id
      WHERE fi.alocacao_id = NEW.alocacao_id
        AND fi.os_id IS NULL
        AND fi.status = 'ativo'
        AND f.status IS DISTINCT FROM 'cancelada'
        AND fi.fatura_id IS DISTINCT FROM NEW.fatura_id
      LIMIT 1;
      IF v_dup_id IS NOT NULL THEN
        RAISE EXCEPTION 'SERVIÇO_JA_FATURADO: A alocação % já está vinculada a outra fatura ativa.', NEW.alocacao_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
