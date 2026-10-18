-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FAT-URG-02 — ETAPA DE VALIDAÇÃO/AUTORIZAÇÃO DA FATURA
--
-- ADITIVA E REVERSÍVEL. NÃO DESTRUTIVA. NÃO TOCA DADOS EXISTENTES.
--
-- Cria a única autoridade de transição de status PRÉ-EMISSÃO da fatura:
--   rascunho -> aguardando_aprovacao -> aprovada
--   aguardando_aprovacao -> rascunho (devolver)
--
-- REGRA CRÍTICA: VALIDAR/APROVAR NÃO É RECEBER.
--   • NÃO cria financeiro_receber.
--   • NÃO altera conta_receber_id.
--   • NÃO emite. A emissão continua exclusivamente via f_emitir_fatura
--     (que aceita 'rascunho' | 'aguardando_aprovacao' | 'aprovada').
--   • Transições para 'emitida'/'cancelada' são rejeitadas aqui.
--
-- Reutiliza os estados JÁ existentes no CHECK de faturas
--   ('rascunho','aguardando_aprovacao','aprovada','emitida','cancelada').
-- Não cria status paralelo.
--
-- Segurança: SECURITY DEFINER, search_path fixo, exige auth.uid(), tenant do
-- registro pertencente ao usuário ativo e perfil financeiro/admin.
-- Idempotente: repetir a mesma transição retorna sucesso sem alterar nada.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.f_mover_fatura_status(p_fatura_id uuid, p_novo_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_perfil_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Perfil autorizado (mesma autoridade das demais RPCs financeiras)
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid()
       AND tu.status = 'ativo'
       AND tu.papel IN ('super_admin','admin_tenant','financeiro')
  ) INTO v_perfil_ok;
  IF NOT v_perfil_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'SEM_PERMISSAO_PERFIL');
  END IF;

  -- p_novo_status válido (apenas estados pré-emissão)
  IF p_novo_status IS NULL OR p_novo_status NOT IN ('rascunho','aguardando_aprovacao','aprovada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'STATUS_SOLICITADO_INVALIDO');
  END IF;

  -- Lock transacional (evita corrida de validação concorrente)
  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  -- Isolamento por tenant: o registro deve pertencer ao tenant do usuário ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid()
       AND tu.status = 'ativo'
       AND tu.tenant_id = v_fatura.tenant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SEM_PERMISSAO_TENANT');
  END IF;

  -- Estados finais não transitam por esta RPC
  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_CANCELADA');
  END IF;
  IF v_fatura.status = 'emitida' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_EMITIDA');
  END IF;

  -- Idempotência: já está no estado desejado
  IF v_fatura.status = p_novo_status THEN
    RETURN jsonb_build_object(
      'success', true, 'fatura_id', p_fatura_id,
      'status_anterior', v_fatura.status, 'status', v_fatura.status,
      'idempotente', true);
  END IF;

  -- Transições permitidas
  IF NOT (
    (v_fatura.status = 'rascunho'             AND p_novo_status = 'aguardando_aprovacao') OR
    (v_fatura.status = 'aguardando_aprovacao' AND p_novo_status = 'aprovada') OR
    (v_fatura.status = 'aguardando_aprovacao' AND p_novo_status = 'rascunho')
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'TRANSICAO_INVALIDA',
      'status_anterior', v_fatura.status, 'status_solicitado', p_novo_status);
  END IF;

  -- SOMENTE status/auditoria. NAO toca conta_receber_id nem financeiro_receber.
  UPDATE public.faturas
     SET status = p_novo_status,
         atualizado_por = auth.uid(),
         atualizado_em = now()
   WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true, 'fatura_id', p_fatura_id,
    'status_anterior', v_fatura.status, 'status', p_novo_status,
    'idempotente', false);
END;
$function$;

-- Grants: único caminho autorizado, sem anon/PUBLIC
REVOKE ALL ON FUNCTION public.f_mover_fatura_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_mover_fatura_status(uuid, text) TO authenticated, service_role;

COMMIT;
