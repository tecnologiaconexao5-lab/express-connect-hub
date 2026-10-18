-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FAT-URG-04 — EMISSÃO OBRIGATORIAMENTE APÓS APROVAÇÃO
--
-- Substitui f_emitir_fatura para que a emissão exija status 'aprovada'.
-- REGRAS NOVAS:
--   • rascunho          -> emitir = BLOQUEADO (FATURA_NAO_APROVADA)
--   • aguardando_aprovacao -> emitir = BLOQUEADO (FATURA_NAO_APROVADA)
--   • aprovada          -> emitir = PERMITIDO (gera Nº + 1 AR; marca emitida)
-- Preserva: FATURA_CANCELADA, FATURA_JA_EMITIDA, FATURA_SEM_CLIENTE, FATURA_SEM_ITENS,
-- numeração Nº Conexão + Nº Cliente, UNIQUE 1 AR por fatura, trigger de guarda.
--
-- Única diferença desta versão vs. 20260924000000: a checagem de status de origem.
-- Aditiva/reversível. Não altera dados, tabelas, RLS, triggers, M66/M80.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.f_emitir_fatura(p_fatura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_numero text;
  v_numero_cliente integer;
  v_receber_id uuid;
  v_vencimento date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Lock transacional na fatura (impede emissão concorrente)
  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_CANCELADA');
  END IF;
  IF v_fatura.status = 'emitida' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_EMITIDA');
  END IF;

  -- TMS-FAT-URG-04 — SOMENTE fatura APROVADA pode ser emitida.
  -- Bloqueia rascunho -> emitida e aguardando_aprovacao -> emitida.
  IF v_fatura.status <> 'aprovada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_APROVADA');
  END IF;

  -- Cliente é obrigatório para gerar o Nº Cliente
  IF v_fatura.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_CLIENTE');
  END IF;

  -- Deve haver itens
  IF NOT EXISTS (SELECT 1 FROM public.fatura_itens WHERE fatura_id = p_fatura_id AND status = 'ativo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_ITENS');
  END IF;

  -- Nº Conexão (sequencial global por ano — mecanismo existente)
  v_numero := public.f_gerar_numero_fatura(p_fatura_id);
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FALHA_GERAR_NUMERO');
  END IF;

  -- Nº Cliente (sequencial histórico por tenant+cliente, atômico via UPSERT)
  INSERT INTO public.fatura_contadores_cliente (tenant_id, cliente_id, ultimo_numero, updated_at)
  VALUES (v_fatura.tenant_id, v_fatura.cliente_id, 1, now())
  ON CONFLICT (tenant_id, cliente_id)
  DO UPDATE SET ultimo_numero = public.fatura_contadores_cliente.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_numero_cliente;

  -- Vencimento sugerido: vencimento da fatura, senão emissão + 30 dias
  v_vencimento := COALESCE(v_fatura.vencimento, v_fatura.data_emissao + 30);

  -- Cria Conta a Receber (1 por fatura; UNIQUE parcial em fatura_id)
  INSERT INTO public.financeiro_receber (
    cliente_id, descricao, valor, vencimento, data_vencimento, data_emissao,
    status, cliente, cliente_nome, fatura, numero, os_vinculadas,
    valor_bruto, valor_liquido, fatura_id
  ) VALUES (
    v_fatura.cliente_id,
    'Fatura ' || v_numero,
    v_fatura.valor_total,
    v_vencimento,
    v_vencimento,
    CURRENT_DATE,
    'aberto',
    (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
    (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
    v_numero,
    v_numero,
    NULL,
    v_fatura.valor_bruto,
    v_fatura.valor_total,
    p_fatura_id
  )
  RETURNING id INTO v_receber_id;

  -- Marca fatura emitida (conta_receber_id preenchido → passa pela guarda)
  UPDATE public.faturas
  SET status = 'emitida',
      numero = v_numero,
      numero_cliente = v_numero_cliente,
      conta_receber_id = v_receber_id,
      vencimento = v_vencimento,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'numero', v_numero,
    'numero_cliente', v_numero_cliente,
    'conta_receber_id', v_receber_id,
    'valor_total', v_fatura.valor_total,
    'vencimento', v_vencimento
  );
END;
$function$;

-- Grants preservados (sem anon/PUBLIC)
REVOKE ALL ON FUNCTION public.f_emitir_fatura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_emitir_fatura(uuid) TO authenticated, service_role;

COMMIT;
