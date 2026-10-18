-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FAT-URG-07 — CANCELAMENTO OFICIAL DE FATURA (P0)
--
-- CAUSA-RAIZ do defeito: f_cancelar_fatura marcava faturas.status='cancelada' e
-- SO DEPOIS tentava UPDATE fatura_itens SET status='cancelado'. O trigger
-- trg_fatura_itens_bloqueio_emissao (BEFORE INSERT/UPDATE/DELETE em fatura_itens)
-- bloqueia alteração de itens quando a fatura está 'emitida'/'cancelada' — logo a
-- própria RPC era abortada.
--
-- CORREÇÃO (cirúrgica, sem desabilitar proteção):
--   1) O guard de itens passa a ser SECURITY INVOKER e AUTORIZA SOMENTE a transição
--      oficial de cancelamento do item (status ativo->cancelado) quando executada por
--      RPC SECURITY DEFINER (current_user='postgres') ou service_role. Qualquer outra
--      alteração/edição direta pelo cliente (authenticated) continua BLOQUEADA, e a
--      proteção de fatura emitida permanece.
--   2) f_cancelar_fatura reordenada: cancela ITENS e AR ANTES de marcar a fatura como
--      'cancelada', com guards de autenticação, perfil (financeiro/admin), tenant,
--      fatura existente, estado e bloqueio de AR pago/baixado. Operação atômica.
--
-- SEM DELETE. SEM desabilitar trigger. Aditiva/reversível. Não altera M66/M80.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ==============================================================================
-- 1) Guard de itens: INVOKER + autoriza apenas o cancelamento oficial do item
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_bloqueio_emissao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.faturas WHERE id = COALESCE(NEW.fatura_id, OLD.fatura_id);
  IF v_status IN ('emitida','cancelada') THEN
    -- TMS-FAT-URG-07 — única exceção: cancelamento OFICIAL do item
    -- (ativo -> cancelado) por RPC SECURITY DEFINER (current_user=postgres) ou service_role.
    IF TG_OP = 'UPDATE'
       AND NEW.status = 'cancelado'
       AND OLD.status = 'ativo'
       AND current_user IN ('postgres', 'service_role') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'FATURA_BLOQUEADA: Não é permitido alterar itens de fatura % (status %). Use cancelamento/correção controlada.', v_status, v_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ==============================================================================
-- 2) f_cancelar_fatura — ordem correta + guards (atômico)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_cancelar_fatura(p_fatura_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_perfil_ok boolean;
  v_tenant_ok boolean;
  v_ar_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Perfil autorizado (financeiro/admin) — mesma autoridade das demais RPCs de fatura
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
       AND tu.papel IN ('super_admin','admin_tenant','financeiro')
  ) INTO v_perfil_ok;
  IF NOT v_perfil_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'SEM_PERMISSAO_PERFIL');
  END IF;

  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  -- Isolamento por tenant
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
       AND tu.tenant_id = v_fatura.tenant_id
  ) INTO v_tenant_ok;
  IF NOT v_tenant_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'SEM_PERMISSAO_TENANT');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_CANCELADA');
  END IF;

  -- Não cancelar fatura cujo AR já possui efeito financeiro (pago/parcial)
  IF v_fatura.conta_receber_id IS NOT NULL THEN
    SELECT status INTO v_ar_status FROM public.financeiro_receber WHERE id = v_fatura.conta_receber_id;
    IF v_ar_status IN ('pago','parcial','recebido') THEN
      RETURN jsonb_build_object('success', false, 'error', 'FATURA_AR_COM_EFEITO_FINANCEIRO', 'ar_status', v_ar_status);
    END IF;
  END IF;

  -- (1) Cancela ITENS antes de mudar o status da fatura (o guard autoriza esta transição)
  UPDATE public.fatura_itens
     SET status = 'cancelado', atualizado_em = now()
   WHERE fatura_id = p_fatura_id AND status = 'ativo';

  -- (2) Cancela a Conta a Receber vinculada (se existir e não paga)
  IF v_fatura.conta_receber_id IS NOT NULL THEN
    UPDATE public.financeiro_receber
       SET status = 'cancelado',
           observacoes = COALESCE(observacoes, '') || ' | Cancelada pela Fatura ' || COALESCE(v_fatura.numero, '')
     WHERE id = v_fatura.conta_receber_id AND status NOT IN ('pago', 'recebido');
  END IF;

  -- (3) Cancela a fatura
  UPDATE public.faturas
     SET status = 'cancelada',
         cancelado_em = now(),
         cancelado_por = auth.uid(),
         motivo_cancelamento = p_motivo,
         atualizado_em = now()
   WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'status', 'cancelada',
    'servicos_liberados', true
  );
END;
$function$;

-- Grants preservados (único caminho autorizado, sem anon/PUBLIC)
REVOKE ALL ON FUNCTION public.f_cancelar_fatura(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_cancelar_fatura(uuid, text) TO authenticated, service_role;

COMMIT;
