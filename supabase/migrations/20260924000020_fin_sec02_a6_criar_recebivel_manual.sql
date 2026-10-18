-- =============================================================================
-- TMS-FIN-SEC-02-A6 — NOVA RECEITA: CONTRATO/RPC OFICIAL (elimina DML direto)
-- =============================================================================
-- Contexto: A5 classificou P0 — UI ativa -> receberService.criarRecebivel()
--           -> INSERT direto em financeiro_receber (fora de RPC/gate).
-- Objetivo: criar RPC oficial, transacional, segura e IDEMPOTENTE para criação
--           manual de Contas a Receber. Frontend passa a chamar SOMENTE a RPC.
--
-- Schema auditado (real):
--   financeiro_receber: id, cliente_id, descricao, valor, vencimento, status,
--     created_at, updated_at, os_id, cliente, cliente_nome, data_vencimento,
--     data_emissao, data_pagamento, categoria, observacoes, cliente_documento,
--     fatura, serie, numero, os_vinculadas, contrato_vinculado,
--     proposta_vinculada, valor_bruto, valor_liquido, desconto, juros, multa,
--     abatimento, data_previsao_recebimento, recorrente, quantidade_parcelas,
--     parcela_atual, centro_resultado, plano_conta, conta_entrada, recorrencia,
--     fatura_id, is_teste.  (NAO possui tenant_id nem conta_financeira_id)
--   clientes: possui tenant_id (vinculo seguro real para autorizacao).
--   tenant_usuarios: papeis reais = super_admin, financeiro, operacional,
--     comercial, atendimento, cliente, admin.
--
-- Escopo: aditivo e reversivel. NAO altera dados. NAO toca S1/S2/A4/baixas.
-- =============================================================================

BEGIN;

-- 1) Coluna de idempotencia (necessaria para requisitos 8/9). Nao existia.
ALTER TABLE public.financeiro_receber
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fr_idempotency_key
  ON public.financeiro_receber (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) RPC oficial de criacao manual de recebivel (idempotente)
CREATE OR REPLACE FUNCTION public.f_criar_recebivel_manual(
  p_payload jsonb,
  p_idempotency_key text
)
RETURNS TABLE(recebivel_id uuid, criado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_tenant     uuid;
  v_papel      text;
  v_key        text;
  v_existing   uuid;
  v_id         uuid;
  v_cliente_id uuid;
  v_valor      numeric;
  v_valor_br   numeric;
  v_venc       date;
  v_status     text;
BEGIN
  -- (2) auth.uid() obrigatorio
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  -- (3) autorizacao: usuario TMS ativo com papel financeiro/admin
  SELECT tu.tenant_id, tu.papel
    INTO v_tenant, v_papel
    FROM public.tenant_usuarios tu
   WHERE tu.user_id = v_uid
   LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'USUARIO_SEM_VINCULO_TENANT' USING ERRCODE = '28000';
  END IF;

  IF v_papel IS NULL OR lower(v_papel) NOT IN ('super_admin','admin','financeiro') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_FINANCEIRO' USING ERRCODE = '42501';
  END IF;

  -- (8/9) Idempotencia: chave obrigatoria
  v_key := NULLIF(btrim(coalesce(p_idempotency_key, '')), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_OBRIGATORIA' USING ERRCODE = '22023';
  END IF;

  -- Retorno rapido se ja existir (retry/duplo clique)
  SELECT fr.id INTO v_existing
    FROM public.financeiro_receber fr
   WHERE fr.idempotency_key = v_key
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, false;
    RETURN;
  END IF;

  -- (4) cliente obrigatorio + vinculo seguro de tenant via clientes.tenant_id
  v_cliente_id := NULLIF(p_payload->>'cliente_id', '')::uuid;
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'CLIENTE_OBRIGATORIO' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c
     WHERE c.id = v_cliente_id
       AND c.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'CLIENTE_INVALIDO_OU_OUTRO_TENANT' USING ERRCODE = '42501';
  END IF;

  -- (5) valor > 0
  v_valor_br := NULLIF(p_payload->>'valor_bruto', '')::numeric;
  v_valor    := COALESCE(NULLIF(p_payload->>'valor_liquido', '')::numeric, v_valor_br);
  IF v_valor IS NULL OR v_valor <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO' USING ERRCODE = '22023';
  END IF;

  -- (6) vencimento obrigatorio
  v_venc := COALESCE(
              NULLIF(p_payload->>'data_vencimento', '')::date,
              NULLIF(p_payload->>'vencimento', '')::date
            );
  IF v_venc IS NULL THEN
    RAISE EXCEPTION 'VENCIMENTO_OBRIGATORIO' USING ERRCODE = '22023';
  END IF;

  -- (7) status inicial exclusivamente permitido na criacao
  v_status := lower(coalesce(NULLIF(p_payload->>'status', ''), 'aberto'));
  IF v_status NOT IN ('aberto','pendente','a vencer','a_vencer','previsto') THEN
    RAISE EXCEPTION 'STATUS_INICIAL_INVALIDO: %' , v_status USING ERRCODE = '22023';
  END IF;

  -- (10) INSERT transacional, idempotente por constraint unica
  INSERT INTO public.financeiro_receber (
    cliente_id, cliente, cliente_nome, cliente_documento, descricao,
    valor, valor_bruto, valor_liquido, desconto, juros, multa, abatimento,
    vencimento, data_vencimento, data_emissao, data_previsao_recebimento,
    status, fatura, fatura_id, serie, numero, os_id, os_vinculadas,
    contrato_vinculado, proposta_vinculada, categoria, centro_resultado,
    plano_conta, conta_entrada, recorrente, recorrencia, quantidade_parcelas,
    parcela_atual, observacoes, idempotency_key
  ) VALUES (
    v_cliente_id,
    COALESCE(NULLIF(p_payload->>'cliente',''), NULLIF(p_payload->>'cliente_nome','')),
    NULLIF(p_payload->>'cliente_nome',''),
    NULLIF(p_payload->>'cliente_documento',''),
    NULLIF(p_payload->>'descricao',''),
    v_valor,
    COALESCE(v_valor_br, v_valor),
    v_valor,
    COALESCE(NULLIF(p_payload->>'desconto','')::numeric, 0),
    COALESCE(NULLIF(p_payload->>'juros','')::numeric, 0),
    COALESCE(NULLIF(p_payload->>'multa','')::numeric, 0),
    COALESCE(NULLIF(p_payload->>'abatimento','')::numeric, 0),
    v_venc,
    v_venc,
    COALESCE(NULLIF(p_payload->>'data_emissao','')::date, CURRENT_DATE),
    NULLIF(p_payload->>'data_previsao_recebimento','')::date,
    v_status,
    NULLIF(p_payload->>'fatura',''),
    NULLIF(p_payload->>'fatura_id','')::uuid,
    NULLIF(p_payload->>'serie',''),
    NULLIF(p_payload->>'numero',''),
    NULLIF(p_payload->>'os_id',''),
    NULLIF(p_payload->>'os_vinculadas',''),
    NULLIF(p_payload->>'contrato_vinculado',''),
    NULLIF(p_payload->>'proposta_vinculada',''),
    NULLIF(p_payload->>'categoria',''),
    NULLIF(p_payload->>'centro_resultado',''),
    NULLIF(p_payload->>'plano_conta',''),
    NULLIF(p_payload->>'conta_entrada',''),
    COALESCE(NULLIF(p_payload->>'recorrente','')::boolean, false),
    COALESCE(NULLIF(p_payload->>'recorrencia',''), 'nenhuma'),
    COALESCE(NULLIF(p_payload->>'quantidade_parcelas','')::integer, 1),
    COALESCE(NULLIF(p_payload->>'parcela_atual','')::integer, 1),
    NULLIF(p_payload->>'observacoes',''),
    v_key
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING public.financeiro_receber.id INTO v_id;

  IF v_id IS NULL THEN
    SELECT fr.id INTO v_id
      FROM public.financeiro_receber fr
     WHERE fr.idempotency_key = v_key
     LIMIT 1;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_id, true;
END;
$$;

-- (11) Permissoes: apenas authenticated; nada de anon/PUBLIC
REVOKE ALL ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.f_criar_recebivel_manual(jsonb, text) IS
  'TMS-FIN-SEC-02-A6: criacao manual de financeiro_receber via contrato idempotente. Unica porta permitida.';

COMMIT;
