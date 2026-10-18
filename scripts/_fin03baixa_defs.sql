########## f_confirmar_pagamento_prestador(uuid,date,numeric) ##########
CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_prestador(p_pagamento_id uuid, p_data_pagamento date DEFAULT CURRENT_DATE, p_valor_pago numeric DEFAULT NULL::numeric)
 RETURNS TABLE(sucesso boolean, mensagem text, pagamento_id uuid, titulo_id uuid, baixa_id uuid, valor_pagamento numeric, valor_liquidado numeric, saldo_restante numeric, conta_financeira_id uuid, conta_financeira text, status_pagamento text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_pagamento    RECORD;
    v_titulo       RECORD;
    v_conta        RECORD;
    v_total_baixado NUMERIC(18,2);
    v_saldo        NUMERIC(18,2);
    v_titulos      INTEGER;
    v_baixa_id     UUID;
    v_valor        NUMERIC(18,2);
    v_data         DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_eh_parcial   BOOLEAN := FALSE;
    v_tenant       uuid;
BEGIN
    -- Autorizacao: usuario TMS ativo com papel financeiro/admin
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    SELECT tu.tenant_id INTO v_tenant FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid() AND tu.status = 'ativo' LIMIT 1;
    IF v_tenant IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.tenant_usuarios tu
        WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
          AND tu.papel IN ('super_admin','admin_tenant','financeiro')) THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    SELECT p.*
      INTO v_pagamento
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Pagamento de prestador nao encontrado.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    -- Isolamento por tenant quando o vinculo (os_id) e resolvivel
    IF v_pagamento.os_id IS NOT NULL THEN
        IF public.f_pp_tenant_id(v_pagamento.os_id) IS DISTINCT FROM v_tenant THEN
            RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT',
                v_pagamento.id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
                NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
            RETURN;
        END IF;
    END IF;

    IF p_valor_pago IS NOT NULL AND p_valor_pago > 0 THEN
        v_valor := ROUND(p_valor_pago::NUMERIC, 2);
        v_eh_parcial := TRUE;
    ELSIF p_valor_pago IS NOT NULL AND p_valor_pago <= 0 THEN
        RETURN QUERY SELECT false, 'Valor do pagamento parcial deve ser maior que zero.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    ELSE
        v_valor := ROUND(COALESCE(v_pagamento.valor_liquido, 0)::NUMERIC, 2);
        v_eh_parcial := FALSE;
    END IF;

    IF v_pagamento.status_pagamento = 'pago' OR v_pagamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Pagamento ja esta marcado como pago.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_pagamento.status_pagamento = 'cancelado' OR v_pagamento.status = 'cancelado' THEN
        RETURN QUERY SELECT false, 'Pagamento cancelado nao pode ser confirmado.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_valor <= 0 THEN
        RETURN QUERY SELECT false, 'Valor do pagamento deve ser maior que zero.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    SELECT c.id, c.nome
      INTO v_conta
      FROM public.contas_financeiras c
     WHERE c.ativa = true
     ORDER BY c.principal DESC, c.nome ASC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Nenhuma conta financeira ativa esta configurada.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_pagamento.os_id IS NOT NULL THEN
        SELECT count(*)::INTEGER INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );
        IF v_titulos = 1 THEN
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        ELSE
            SELECT count(*)::INTEGER INTO v_titulos
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               );
            IF v_titulos <> 1 THEN
                RETURN QUERY SELECT false,
                    CASE WHEN v_titulos = 0
                         THEN 'Nao existe titulo financeiro aberto para esta OS e prestador.'
                         ELSE 'Existe mais de um titulo candidato para a mesma OS; conciliacao ambigua.'
                    END,
                    v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                    NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
                RETURN;
            END IF;
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        END IF;
    ELSE
        SELECT count(*)::INTEGER INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );
        IF v_titulos = 1 THEN
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        ELSE
            SELECT count(*)::INTEGER INTO v_titulos
              FROM public.financeiro_pagar fp
             WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               );
            IF v_titulos <> 1 THEN
                RETURN QUERY SELECT false,
                    CASE WHEN v_titulos = 0
                         THEN 'Nao existe titulo financeiro aberto de mesma origem e prestador.'
                         ELSE 'Existem varios titulos de mesmo prestador; vinculo explicito e obrigatorio.'
                    END,
                    v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                    NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
                RETURN;
            END IF;
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        END IF;
    END IF;

    SELECT COALESCE(SUM(fb.valor_baixado), 0)::NUMERIC(18,2)
      INTO v_total_baixado
      FROM public.financeiro_baixas fb
     WHERE fb.titulo_tabela = 'financeiro_pagar'
       AND fb.titulo_id = v_titulo.id
       AND NOT COALESCE(fb.estornada, false);

    v_saldo := ROUND(COALESCE(v_titulo.valor, 0)::NUMERIC, 2) - v_total_baixado;

    IF v_valor > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor do pagamento (R$ ' || v_valor || ') excede o saldo restante (R$ ' || v_saldo || ').',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false,
            'Titulo ja esta integralmente quitado.',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        observacao, estornada
    ) VALUES (
        'financeiro_pagar', v_titulo.id, v_titulo.valor, v_valor,
        v_saldo - v_valor,
        v_data, 'Pagamento Prestador', v_conta.nome, v_conta.id,
        CASE WHEN v_eh_parcial
             THEN 'Baixa parcial - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8)
             ELSE 'Baixa atomica - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8)
        END,
        false
    ) RETURNING id INTO v_baixa_id;

    IF (v_saldo - v_valor) > 0 THEN
        UPDATE public.financeiro_pagar
           SET status = 'parcial', data_pagamento = v_data, data_efetiva_pgto = v_data, conta_pagadora = v_conta.nome,
               observacoes = CASE WHEN observacoes IS NULL OR observacoes = ''
                    THEN 'Baixa parcial R$ ' || v_valor || ' de R$ ' || v_titulo.valor
                    ELSE observacoes || E'\nBaixa parcial R$ ' || v_valor || ' de R$ ' || v_titulo.valor END
         WHERE id = v_titulo.id;
    ELSE
        UPDATE public.financeiro_pagar
           SET status = 'pago', data_pagamento = v_data, data_efetiva_pgto = v_data, conta_pagadora = v_conta.nome,
               observacoes = CASE WHEN observacoes IS NULL OR observacoes = ''
                    THEN 'Baixa integral de pagamento de prestador.'
                    ELSE observacoes || E'\nBaixa integral de pagamento de prestador.' END
         WHERE id = v_titulo.id;
    END IF;

    IF (v_saldo - v_valor) > 0 THEN
        UPDATE public.pagamentos_prestadores
           SET status_conferencia = 'conferido', data_pagamento = v_data
         WHERE id = v_pagamento.id;
    ELSE
        UPDATE public.pagamentos_prestadores
           SET status = 'pago', status_pagamento = 'pago', status_conferencia = 'conferido', data_pagamento = v_data
         WHERE id = v_pagamento.id;
    END IF;

    RETURN QUERY SELECT
        true,
        CASE WHEN v_eh_parcial
             THEN 'Pagamento parcial registrado. Saldo restante: R$ ' || (v_saldo - v_valor) || '.'
             ELSE 'Pagamento confirmado com baixa integral.' END,
        v_pagamento.id, v_titulo.id, v_baixa_id, v_valor, v_valor, v_saldo - v_valor,
        v_conta.id, v_conta.nome,
        CASE WHEN (v_saldo - v_valor) > 0 THEN 'pendente' ELSE 'pago' END;
END;
$function$


########## f_confirmar_pagamento_fechamento(uuid,date) ##########
CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_fechamento(p_fechamento_id uuid, p_data_pagamento date DEFAULT CURRENT_DATE)
 RETURNS TABLE(sucesso boolean, mensagem text, fechamento_id uuid, itens_processados integer, itens_ignorados integer, total_baixas integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_fechamento       RECORD;
    v_item             RECORD;
    v_res              RECORD;
    v_data             DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_processados      INTEGER := 0;
    v_ignorados        INTEGER := 0;
    v_total_baixas     INTEGER := 0;
    v_total_itens      INTEGER := 0;
    v_total_valor      NUMERIC(18,2) := 0;
    v_tenant           uuid;
    v_tenant_ok        boolean := true;
BEGIN
    -- 0. Autorizacao (hardening)
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    SELECT tu.tenant_id INTO v_tenant
      FROM public.tenant_usuarios tu
     WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
     LIMIT 1;

    IF v_tenant IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.tenant_usuarios tu
         WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
           AND tu.papel IN ('super_admin','admin_tenant','financeiro')) THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 1. Valida fechamento
    SELECT id, os_id, status_pagamento, status_aprovacao, status_conferencia, status, valor_liquido
      INTO v_fechamento
      FROM public.pagamentos_prestadores
     WHERE id = p_fechamento_id
       AND tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Fechamento nao encontrado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.os_id IS NOT NULL
       AND public.f_pp_tenant_id(v_fechamento.os_id) IS DISTINCT FROM v_tenant THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_pagamento = 'pago' OR v_fechamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Fechamento ja esta pago.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_aprovacao <> 'aprovado' THEN
        RETURN QUERY SELECT false, 'Fechamento nao esta aprovado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 1.1 Reconciliacao: soma dos itens deve bater com o valor do fechamento + tenant dos itens
    SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0),
           COALESCE(bool_and(CASE WHEN os_id IS NULL THEN true ELSE public.f_pp_tenant_id(os_id) IS NOT DISTINCT FROM v_tenant END), true)
      INTO v_total_itens, v_total_valor, v_tenant_ok
      FROM public.pagamentos_prestadores
     WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
       AND pagamentos_prestadores.id <> p_fechamento_id;

    IF v_total_itens = 0 THEN
        RETURN QUERY SELECT false, 'Fechamento nao possui itens vinculados.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF NOT v_tenant_ok THEN
        RETURN QUERY SELECT false, 'NAO_AUTORIZADO_TENANT', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF ROUND(COALESCE(v_fechamento.valor_liquido, 0)::NUMERIC, 2) <> ROUND(v_total_valor, 2) THEN
        RETURN QUERY SELECT false,
                            'Divergencia de valores no fechamento: fechamento=' || COALESCE(v_fechamento.valor_liquido, 0) || ', itens=' || v_total_valor || '.',
                            p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 2. Itera pelos itens vinculados
    FOR v_item IN
        SELECT id, status_pagamento, status
          FROM public.pagamentos_prestadores
         WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
           AND pagamentos_prestadores.id <> p_fechamento_id
         ORDER BY id
    LOOP
        IF v_item.status_pagamento = 'pago' OR v_item.status = 'pago' THEN
            v_ignorados := v_ignorados + 1;
            CONTINUE;
        END IF;

        IF v_item.status_pagamento = 'cancelado' OR v_item.status = 'cancelado' THEN
            RAISE EXCEPTION 'Item % do fechamento esta cancelado; pagamento nao pode prosseguir.', v_item.id;
        END IF;

        SELECT r.sucesso, r.mensagem, r.baixa_id
          INTO v_res
          FROM public.f_confirmar_pagamento_prestador(v_item.id, v_data) r;

        IF NOT v_res.sucesso THEN
            RAISE EXCEPTION 'Item % do fechamento falhou: %', v_item.id, COALESCE(v_res.mensagem, 'erro desconhecido');
        END IF;

        v_processados := v_processados + 1;
        IF v_res.baixa_id IS NOT NULL THEN
            v_total_baixas := v_total_baixas + 1;
        END IF;
    END LOOP;

    -- 3. Atualiza fechamento para pago
    UPDATE public.pagamentos_prestadores
       SET status = 'pago',
           status_pagamento = 'pago',
           status_conferencia = 'conferido',
           data_pagamento = v_data
     WHERE id = p_fechamento_id;

    RETURN QUERY SELECT true,
                        'Fechamento pago com sucesso. Itens processados: ' || v_processados || ', ignorados: ' || v_ignorados || ', baixas: ' || v_total_baixas || '.',
                        p_fechamento_id,
                        v_processados,
                        v_ignorados,
                        v_total_baixas;
END;
$function$


########## f_gerar_lote_pagamentos(uuid[]) ##########
CREATE OR REPLACE FUNCTION public.f_gerar_lote_pagamentos(p_ids uuid[])
 RETURNS TABLE(lote_id uuid, solicitados integer, incluidos integer, ja_em_lote integer, bloqueados integer, detalhes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_papel text;
  v_ids uuid[];
  v_total int;
  v_aprovaveis int;
  v_ja int;
  v_lotes int;
  v_lote_existente uuid;
  v_bloqueados int;
  v_novo uuid;
  v_total_valor numeric;
  v_detalhes jsonb;
  v_papeis_autorizados text[] := ARRAY['super_admin','admin_tenant','financeiro'];
BEGIN
  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_ids, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL);
  v_total := COALESCE(cardinality(v_ids), 0);

  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','USUARIO_NAO_AUTENTICADO'));
    RETURN;
  END IF;

  SELECT tu.tenant_id, tu.papel INTO v_tenant, v_papel
    FROM public.tenant_usuarios tu WHERE tu.user_id = v_uid AND tu.status = 'ativo' LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','USUARIO_SEM_TENANT_ATIVO'));
    RETURN;
  END IF;
  IF NOT (COALESCE(v_papel,'') = ANY(v_papeis_autorizados)) THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','PAPEL_NAO_AUTORIZADO','papel',COALESCE(v_papel,'')));
    RETURN;
  END IF;
  IF v_total = 0 THEN
    RETURN QUERY SELECT NULL::uuid, 0, 0, 0, 0, '[]'::jsonb;
    RETURN;
  END IF;

  PERFORM 1 FROM public.pagamentos_prestadores WHERE id = ANY(v_ids) FOR UPDATE;

  DROP TABLE IF EXISTS tmp_lote_class;
  DROP TABLE IF EXISTS tmp_lote_missing;
  CREATE TEMP TABLE tmp_lote_class ON COMMIT DROP AS
  WITH base AS (
    SELECT p.id, p.lote_id AS lote_atual, p.prestador_id,
           p.origem_lancamento,
           COALESCE(p.valor_liquido,0) AS valor_liquido,
           p.status, p.status_pagamento, p.status_conferencia, p.status_aprovacao, p.elegivel_lote,
           p.is_teste, p.tipo_pagamento,
           public.f_pp_tenant_id(p.os_id) AS row_tenant,
           (SELECT o.status FROM public.ordens_servico o WHERE o.id=p.os_id) AS os_status,
           (SELECT a.status FROM public.alocacoes_escala a WHERE a.id=p.os_id) AS aloc_status,
           (COALESCE(btrim(pr.chave_pix),'')<>'' OR
            (COALESCE(btrim(pr.banco),'')<>'' AND COALESCE(btrim(pr.agencia),'')<>'' AND COALESCE(btrim(pr.conta),'')<>'')) AS destino_ok
      FROM public.pagamentos_prestadores p
      LEFT JOIN public.prestadores pr ON pr.id = p.prestador_id
     WHERE p.id = ANY(v_ids)
  )
  SELECT b.id, b.lote_atual, b.prestador_id, b.valor_liquido,
    CASE
      WHEN b.row_tenant IS NULL AND COALESCE(b.origem_lancamento,'') <> 'manual' THEN 'SEM_TENANT'
      WHEN b.row_tenant IS NOT NULL AND b.row_tenant <> v_tenant THEN 'CROSS_TENANT'
      WHEN COALESCE(b.os_status,'')='cancelada' OR COALESCE(b.aloc_status,'')='cancelada' THEN 'OPERACAO_CANCELADA'
      WHEN COALESCE(b.status_pagamento,'')='pago' OR COALESCE(b.status,'')='pago' THEN 'PAGO'
      WHEN COALESCE(b.status_pagamento,'')='cancelado' OR COALESCE(b.status_conferencia,'')='cancelado' OR COALESCE(b.status,'')='cancelado' THEN 'CANCELADO'
      WHEN b.is_teste IS TRUE THEN 'TESTE'
      WHEN b.prestador_id IS NULL THEN 'SEM_PRESTADOR'
      WHEN NOT b.destino_ok THEN 'DESTINO_INVALIDO'
      WHEN b.valor_liquido <= 0 THEN 'VALOR_INVALIDO'
      WHEN COALESCE(b.tipo_pagamento,'')='fechamento' THEN 'AGREGADO'
      WHEN b.lote_atual IS NOT NULL THEN 'JA_EM_LOTE'
      WHEN NOT (COALESCE(b.status_conferencia,'')='conferido' AND COALESCE(b.status_aprovacao,'')='aprovado' AND b.elegivel_lote IS TRUE) THEN 'NAO_ELEGIVEL'
      ELSE 'APROVAVEL'
    END AS resultado
  FROM base b;

  CREATE TEMP TABLE tmp_lote_missing ON COMMIT DROP AS
  SELECT x AS id, NULL::uuid AS lote_atual, 'NAO_ENCONTRADO'::text AS resultado
    FROM unnest(v_ids) x WHERE NOT EXISTS (SELECT 1 FROM tmp_lote_class c WHERE c.id = x);

  SELECT count(*)::int INTO v_aprovaveis FROM tmp_lote_class WHERE resultado='APROVAVEL';
  SELECT count(*)::int INTO v_ja FROM tmp_lote_class WHERE resultado='JA_EM_LOTE';
  SELECT count(DISTINCT lote_atual)::int INTO v_lotes FROM tmp_lote_class WHERE resultado='JA_EM_LOTE';
  SELECT lote_atual INTO v_lote_existente FROM tmp_lote_class WHERE resultado='JA_EM_LOTE' LIMIT 1;
  SELECT count(*)::int INTO v_bloqueados
    FROM (SELECT resultado FROM tmp_lote_class WHERE resultado NOT IN ('APROVAVEL','JA_EM_LOTE')
          UNION ALL SELECT resultado FROM tmp_lote_missing) z;

  v_detalhes := COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'resultado', resultado, 'motivo',
      CASE resultado
        WHEN 'SEM_TENANT' THEN 'Tenant do vinculo (os_id) nao resolvivel'
        WHEN 'CROSS_TENANT' THEN 'Registro pertence a outro tenant'
        WHEN 'OPERACAO_CANCELADA' THEN 'Operacao/OS vinculada cancelada'
        WHEN 'PAGO' THEN 'Pagamento ja efetuado'
        WHEN 'CANCELADO' THEN 'Pagamento cancelado'
        WHEN 'TESTE' THEN 'Registro de teste/HML'
        WHEN 'SEM_PRESTADOR' THEN 'Sem prestador vinculado'
        WHEN 'DESTINO_INVALIDO' THEN 'Prestador sem destino bancario valido (PIX ou conta)'
        WHEN 'VALOR_INVALIDO' THEN 'Valor liquido <= 0'
        WHEN 'AGREGADO' THEN 'Registro agregado (fechamento)'
        WHEN 'JA_EM_LOTE' THEN 'Ja pertence a um lote'
        WHEN 'NAO_ELEGIVEL' THEN 'Nao conferido/aprovado/elegivel'
        WHEN 'NAO_ENCONTRADO' THEN 'Registro nao encontrado'
        ELSE 'Erro desconhecido' END))
    FROM (SELECT id, resultado FROM tmp_lote_class UNION ALL SELECT id, resultado FROM tmp_lote_missing) d
  ), '[]'::jsonb);

  IF v_bloqueados > 0 THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, v_ja, v_bloqueados, v_detalhes;
    RETURN;
  END IF;
  IF v_ja > 0 AND v_aprovaveis > 0 THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, v_ja, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','MISTURA_JA_EM_LOTE_E_SEM_LOTE'));
    RETURN;
  END IF;
  IF v_lotes > 1 THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, v_ja, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','LOTES_DIFERENTES'));
    RETURN;
  END IF;
  IF v_ja > 0 AND v_aprovaveis = 0 THEN
    RETURN QUERY SELECT v_lote_existente, v_total, 0, v_ja, 0, v_detalhes;
    RETURN;
  END IF;

  -- Cabecalho
  v_novo := gen_random_uuid();
  SELECT COALESCE(SUM(valor_liquido),0) INTO v_total_valor FROM tmp_lote_class WHERE resultado='APROVAVEL';

  INSERT INTO public.lotes_pagamento (id, tenant_id, status, quantidade_pagamentos, valor_total, criado_por)
  VALUES (v_novo, v_tenant, 'preparado', v_aprovaveis, v_total_valor, v_uid);

  -- Snapshots (dados do prestador congelados no momento da formacao)
  INSERT INTO public.lotes_pagamento_itens (
    lote_id, pagamento_prestador_id, prestador_id, valor, forma_destino,
    banco, agencia, conta, digito, tipo_conta, favorecido, documento_favorecido, chave_pix, tipo_chave_pix
  )
  SELECT v_novo, t.id, t.prestador_id, t.valor_liquido,
         CASE WHEN COALESCE(btrim(pr.chave_pix),'')<>'' THEN 'pix' ELSE 'conta' END,
         pr.banco, pr.agencia, pr.conta, pr.digito, pr.tipo_conta, pr.favorecido, pr.cpf_cnpj_favorecido, pr.chave_pix, pr.tipo_chave_pix
    FROM tmp_lote_class t
    JOIN public.prestadores pr ON pr.id = t.prestador_id
   WHERE t.resultado='APROVAVEL';

  -- Marca pagamentos
  UPDATE public.pagamentos_prestadores p
     SET lote_id = v_novo, status_pagamento = 'em_lote'
    FROM tmp_lote_class t
   WHERE p.id = t.id AND t.resultado='APROVAVEL'
     AND p.lote_id IS NULL
     AND COALESCE(p.status_pagamento,'') NOT IN ('pago','cancelado')
     AND COALESCE(p.status_conferencia,'') = 'conferido'
     AND COALESCE(p.status_aprovacao,'') = 'aprovado'
     AND p.elegivel_lote IS TRUE;

  RETURN QUERY SELECT v_novo, v_total, v_aprovaveis, 0, 0, v_detalhes;
END;
$function$


########## f_registrar_baixa_financeira(text,uuid,numeric,date,text,text,uuid,text,text,uuid,text) ##########
CREATE OR REPLACE FUNCTION public.f_registrar_baixa_financeira(p_titulo_tabela text, p_titulo_id uuid, p_valor_baixado numeric, p_data_baixa date DEFAULT CURRENT_DATE, p_forma_pagamento text DEFAULT NULL::text, p_conta_financeira text DEFAULT NULL::text, p_conta_financeira_id uuid DEFAULT NULL::uuid, p_referencia_bancaria text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text, p_usuario_id uuid DEFAULT NULL::uuid, p_usuario_nome text DEFAULT NULL::text)
 RETURNS TABLE(sucesso boolean, mensagem text, baixa_id uuid, saldo_restante numeric, status_titulo text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_valor_original   NUMERIC(18,2);
    v_status_atual     TEXT;
    v_total_baixado    NUMERIC(18,2);
    v_saldo            NUMERIC(18,2);
    v_novo_saldo       NUMERIC(18,2);
    v_novo_status      TEXT;
    v_baixa_id         UUID;
    v_linha_historico  TEXT;
BEGIN
    IF p_valor_baixado IS NULL OR p_valor_baixado <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da baixa deve ser maior que zero.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        SELECT valor, status INTO v_valor_original, v_status_atual
          FROM public.financeiro_pagar WHERE id = p_titulo_id FOR UPDATE;
    ELSIF p_titulo_tabela = 'financeiro_receber' THEN
        SELECT valor, status INTO v_valor_original, v_status_atual
          FROM public.financeiro_receber WHERE id = p_titulo_id FOR UPDATE;
    ELSE
        RETURN QUERY SELECT false, 'Tabela de título não suportada.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Título não encontrado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('cancelado','cancelada') THEN
        RETURN QUERY SELECT false, 'Não é permitido baixar título cancelado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('pago','paga') THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    SELECT COALESCE(SUM(valor_baixado), 0) INTO v_total_baixado
      FROM public.financeiro_baixas
     WHERE titulo_tabela = p_titulo_tabela AND titulo_id = p_titulo_id AND NOT estornada;

    v_saldo := v_valor_original - v_total_baixado;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_valor_baixado > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor da baixa excede o saldo restante (' || v_saldo || ').',
            NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    v_novo_saldo := v_saldo - p_valor_baixado;

    IF v_novo_saldo < 0 THEN
        RETURN QUERY SELECT false, 'Saldo não pode ficar negativo.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_novo_saldo > 0 THEN
        v_novo_status := 'parcial';
    ELSE
        v_novo_status := 'pago';
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        referencia_bancaria, observacao, usuario_id, usuario_nome
    ) VALUES (
        p_titulo_tabela, p_titulo_id, v_valor_original, p_valor_baixado, v_novo_saldo,
        p_data_baixa, p_forma_pagamento, p_conta_financeira, p_conta_financeira_id,
        p_referencia_bancaria, p_observacao, p_usuario_id, p_usuario_nome
    ) RETURNING id INTO v_baixa_id;

    v_linha_historico := 'Baixa R$ ' || p_valor_baixado || ' em ' || p_data_baixa
                         || '. Saldo restante: R$ ' || v_novo_saldo || '.';

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        UPDATE public.financeiro_pagar
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               data_efetiva_pgto = p_data_baixa,
               conta_pagadora    = COALESCE(p_conta_financeira, conta_pagadora),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    ELSE
        UPDATE public.financeiro_receber
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               conta_entrada     = COALESCE(p_conta_financeira, conta_entrada),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    END IF;

    RETURN QUERY SELECT true, 'Baixa registrada com sucesso.', v_baixa_id, v_novo_saldo, v_novo_status;
END;
$function$
