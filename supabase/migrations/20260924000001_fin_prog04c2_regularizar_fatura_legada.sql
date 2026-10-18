-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FIN-PROG-04C.2 — PROCEDIMENTO DE REGULARIZAÇÃO DE FATURA LEGADA
-- Uso RESTRITO ao saneamento histórico (admin). NÃO é fluxo normal de emissão.
--   • Vincula AR legado existente (p_ar_id) OU cria 1 AR novo (p_ar_id NULL).
--   • Gera Nº Conexão + Nº Cliente de forma atômica/idempotente.
--   • NUNCA altera valor/status/data_pagamento/baixa de AR vinculado.
--   • NUNCA duplica AR (valida AR existente por fatura_id).
--   • SECURITY DEFINER, tenant-safe, sem anon.
-- ═══════════════════════════════════════════════════════════════════════════════

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

  -- Nº Conexão (mecanismo oficial)
  v_numero := public.f_gerar_numero_fatura(p_fatura_id);
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FALHA_GERAR_NUMERO');
  END IF;

  IF p_ar_id IS NOT NULL THEN
    -- ── VINCULAR AR LEGADO EXISTENTE ──
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
    -- SOMENTE fatura_id é alterado (valor/status/data_pagamento/baixa preservados)
    UPDATE public.financeiro_receber
      SET fatura_id = p_fatura_id
      WHERE id = p_ar_id AND fatura_id IS DISTINCT FROM p_fatura_id;
    v_receber_id := p_ar_id;
  ELSE
    -- ── CRIAR 1 AR NOVO (falha se já existir AR para a fatura) ──
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

  -- Nº Cliente (contador atômico por tenant+cliente)
  INSERT INTO public.fatura_contadores_cliente (tenant_id, cliente_id, ultimo_numero, updated_at)
  VALUES (v_fatura.tenant_id, v_fatura.cliente_id, 1, now())
  ON CONFLICT (tenant_id, cliente_id)
  DO UPDATE SET ultimo_numero = public.fatura_contadores_cliente.ultimo_numero + 1, updated_at = now()
  RETURNING ultimo_numero INTO v_numero_cliente;

  UPDATE public.faturas
    SET status = 'emitida',
        numero = v_numero,
        numero_cliente = v_numero_cliente,
        conta_receber_id = v_receber_id,
        atualizado_em = now()
    WHERE id = p_fatura_id;

  RETURN jsonb_build_object('success', true,
    'fatura_id', p_fatura_id,
    'numero', v_numero,
    'numero_cliente', v_numero_cliente,
    'conta_receber_id', v_receber_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.f_regularizar_fatura_legada(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_regularizar_fatura_legada(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.f_regularizar_fatura_legada(uuid, uuid) IS
  'TMS-FIN-PROG-04C.2 — saneamento historico controlado (admin). Nao e fluxo normal de emissao.';
