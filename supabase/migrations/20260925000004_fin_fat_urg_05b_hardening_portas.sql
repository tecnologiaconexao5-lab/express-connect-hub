-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FAT-URG-05B — HARDENING DAS PORTAS DE EMISSÃO
--
-- Fecha os dois furos de contrato comprovados no FAT-URG-05A:
--   1) f_regularizar_fatura_legada podia EMITIR um rascunho (criava AR + 'emitida').
--      -> passa a aceitar SOMENTE fatura JÁ 'emitida' (regularização de AR legado);
--      -> REVOKE EXECUTE de PUBLIC, anon e authenticated; mantém service_role (admin).
--   2) UPDATE direto de faturas.status por authenticated era possível via RLS.
--      -> trigger BEFORE UPDATE OF status que só permite mudança de status por
--         RPC SECURITY DEFINER (owner postgres) ou service_role. Edições legítimas
--         (vencimento/observação/etc.) NÃO são afetadas (o trigger só dispara em status).
--
-- Aditiva/reversível. NÃO altera dados, tabelas, nem M66/M80.
-- Emissão operacional continua 100% via f_emitir_fatura (que exige 'aprovada').
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ==============================================================================
-- 1) f_regularizar_fatura_legada — somente LEGADO (fatura JÁ emitida sem AR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_regularizar_fatura_legada(
  p_fatura_id uuid,
  p_ar_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_tenant uuid;
  v_numero text;
  v_numero_cliente integer;
  v_receber_id uuid;
  v_ar public.financeiro_receber%ROWTYPE;
  v_vencimento date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.tenant_usuarios WHERE user_id = auth.uid() LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_SEM_TENANT');
  END IF;

  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;
  IF v_fatura.tenant_id <> v_tenant THEN
    RETURN jsonb_build_object('success', false, 'error', 'TENANT_DIVERGENTE');
  END IF;
  IF v_fatura.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_CLIENTE');
  END IF;
  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_CANCELADA');
  END IF;

  -- TMS-FAT-URG-05B — SOMENTE fatura JÁ 'emitida' (regularização de AR legado).
  -- Bloqueia rascunho / aguardando_aprovacao / aprovada: esta RPC NÃO é emissão.
  IF v_fatura.status <> 'emitida' THEN
    RETURN jsonb_build_object('success', false, 'error', 'REGULARIZAR_SO_FATURA_EMITIDA');
  END IF;

  -- Idempotência: já regularizada (número + AR) → não consome nada.
  IF v_fatura.numero IS NOT NULL AND v_fatura.conta_receber_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already', true,
      'fatura_id', v_fatura.id, 'numero', v_fatura.numero,
      'numero_cliente', v_fatura.numero_cliente,
      'conta_receber_id', v_fatura.conta_receber_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fatura_itens WHERE fatura_id = p_fatura_id AND status = 'ativo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_ITENS');
  END IF;

  -- Nº Conexão (somente se a fatura legada ainda não tem número)
  v_numero := COALESCE(v_fatura.numero, public.f_gerar_numero_fatura(p_fatura_id));
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FALHA_GERAR_NUMERO');
  END IF;

  IF p_ar_id IS NOT NULL THEN
    SELECT * INTO v_ar FROM public.financeiro_receber WHERE id = p_ar_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'AR_NAO_ENCONTRADO');
    END IF;
    IF v_ar.fatura_id IS NOT NULL AND v_ar.fatura_id <> p_fatura_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'AR_JA_VINCULADO_OUTRA_FATURA');
    END IF;
    IF v_ar.cliente_id IS DISTINCT FROM v_fatura.cliente_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'AR_CLIENTE_DIVERGENTE');
    END IF;
    IF ABS(COALESCE(v_ar.valor, 0) - COALESCE(v_fatura.valor_total, 0)) > 0.005 THEN
      RETURN jsonb_build_object('success', false, 'error', 'AR_VALOR_DIVERGENTE');
    END IF;
    UPDATE public.financeiro_receber
      SET fatura_id = p_fatura_id
      WHERE id = p_ar_id AND fatura_id IS DISTINCT FROM p_fatura_id;
    v_receber_id := p_ar_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.financeiro_receber WHERE fatura_id = p_fatura_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'AR_JA_EXISTE_PARA_FATURA');
    END IF;
    v_vencimento := COALESCE(v_fatura.vencimento, v_fatura.data_emissao + 30);
    INSERT INTO public.financeiro_receber (
      cliente_id, descricao, valor, vencimento, data_vencimento, data_emissao,
      status, cliente, cliente_nome, fatura, numero, os_vinculadas,
      valor_bruto, valor_liquido, fatura_id
    ) VALUES (
      v_fatura.cliente_id,
      'Fatura ' || v_numero || ' (regularizada)',
      v_fatura.valor_total,
      v_vencimento, v_vencimento, v_fatura.data_emissao,
      'aberto',
      (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
      (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
      v_numero, v_numero, NULL,
      v_fatura.valor_bruto, v_fatura.valor_total, p_fatura_id
    ) RETURNING id INTO v_receber_id;
  END IF;

  INSERT INTO public.fatura_contadores_cliente (tenant_id, cliente_id, ultimo_numero, updated_at)
  VALUES (v_fatura.tenant_id, v_fatura.cliente_id, 1, now())
  ON CONFLICT (tenant_id, cliente_id)
  DO UPDATE SET ultimo_numero = public.fatura_contadores_cliente.ultimo_numero + 1, updated_at = now()
  RETURNING ultimo_numero INTO v_numero_cliente;

  -- Mantém 'emitida' (já era); preenche número/AR que faltavam no legado.
  UPDATE public.faturas
    SET status = 'emitida',
        numero = v_numero,
        numero_cliente = COALESCE(v_fatura.numero_cliente, v_numero_cliente),
        conta_receber_id = v_receber_id,
        atualizado_em = now()
    WHERE id = p_fatura_id;

  RETURN jsonb_build_object('success', true,
    'fatura_id', p_fatura_id,
    'numero', v_numero,
    'numero_cliente', COALESCE(v_fatura.numero_cliente, v_numero_cliente),
    'conta_receber_id', v_receber_id);
END;
$function$;

-- Ferramenta administrativa/backfill: NÃO acessível ao cliente/authenticated.
REVOKE ALL ON FUNCTION public.f_regularizar_fatura_legada(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f_regularizar_fatura_legada(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.f_regularizar_fatura_legada(uuid, uuid) IS
  'TMS-FAT-URG-05B — saneamento de LEGADO (fatura JA emitida sem AR). NAO emite rascunho/aprovada. Restrito a service_role.';

-- ==============================================================================
-- 2) Guard: status de faturas só muda por RPC oficial (SECURITY DEFINER) ou service_role
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_faturas_protege_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Fatura nova deve NASCER como 'rascunho' (cliente). INSERT com 'aprovada'/
    -- 'emitida' por authenticated seria bypass da validação -> bloqueia.
    IF NEW.status IS DISTINCT FROM 'rascunho'
       AND current_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'FATURA_STATUS_INSERT_INVALIDO: fatura nova deve nascer como rascunho (use o fluxo Conferência/Criar Fatura).';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
        AND current_user NOT IN ('postgres', 'service_role') THEN
    -- Só bloqueia MUDANÇA de status. Edições de outros campos (vencimento,
    -- observação, metadata, etc.) NÃO passam por aqui.
    RAISE EXCEPTION 'FATURA_STATUS_SOMENTE_VIA_RPC: alteracao direta de status nao permitida. Use f_mover_fatura_status / f_emitir_fatura / f_cancelar_fatura.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_faturas_protege_status ON public.faturas;
CREATE TRIGGER trg_faturas_protege_status
  BEFORE INSERT OR UPDATE OF status ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_faturas_protege_status();

COMMIT;
