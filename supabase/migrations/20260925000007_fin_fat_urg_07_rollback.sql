-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FAT-URG-07 — ROLLBACK: restaura o guard e a f_cancelar_fatura ORIGINAIS.
-- Não altera dados/tabelas/M66/M80.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Guard original (SECURITY DEFINER, sem exceção de cancelamento)
CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_bloqueio_emissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.faturas WHERE id = NEW.fatura_id;
  IF v_status IN ('emitida','cancelada') THEN
    RAISE EXCEPTION 'FATURA_BLOQUEADA: Não é permitido alterar itens de fatura % (status %). Use cancelamento/correção controlada.', v_status, v_status;
  END IF;
  RETURN NEW;
END;
$function$;

-- f_cancelar_fatura original (versão 20260816000001)
CREATE OR REPLACE FUNCTION public.f_cancelar_fatura(p_fatura_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_CANCELADA');
  END IF;

  UPDATE public.faturas
  SET status = 'cancelada',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      motivo_cancelamento = p_motivo,
      atualizado_em = now()
  WHERE id = p_fatura_id;

  UPDATE public.fatura_itens SET status = 'cancelado', atualizado_em = now()
  WHERE fatura_id = p_fatura_id AND status = 'ativo';

  IF v_fatura.conta_receber_id IS NOT NULL THEN
    UPDATE public.financeiro_receber
    SET status = 'cancelado', observacoes = COALESCE(observacoes, '') || ' | Cancelada pela Fatura ' || COALESCE(v_fatura.numero, '')
    WHERE id = v_fatura.conta_receber_id AND status NOT IN ('pago');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'status', 'cancelada',
    'servicos_liberados', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.f_cancelar_fatura(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_cancelar_fatura(uuid, text) TO authenticated, service_role;

COMMIT;
