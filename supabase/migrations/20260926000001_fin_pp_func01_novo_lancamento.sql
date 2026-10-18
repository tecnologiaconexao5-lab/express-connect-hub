-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN-PP-FUNC-01 — NOVO LANÇAMENTO (obrigação manual de prestador) + E2E
-- Data: 2026-09-26
-- Projeto: TMS (Supabase Produção: uwrvzsjtpgaifkktpepn)
--
-- OBJETIVO
--   Habilitar "Novo Lançamento": criar uma OBRIGAÇÃO MANUAL de prestador
--   (serviço avulso / ajuste / reembolso / adiantamento) que NÃO nasceu de
--   OS/Programação. Atômico: PP (workflow operacional) + FP (obrigação contábil).
--
-- ESCOPO
--   1) CREATE f_criar_lancamento_manual_prestador(...)  — RPC oficial atômica.
--   2) CREATE OR REPLACE f_aprovar_pagamento_prestadores(...) — habilita que
--      lançamentos manuais (os_id NULL, origem 'manual') sejam aprovados.
--   3) CREATE OR REPLACE f_gerar_lote_pagamentos(...) — idem para lote.
--
-- NÃO ALTERA
--   - Regras de M66/M80 (propagação automática OS/Programação) — intactas.
--   - f_confirmar/f_reprovar/f_cancelar/f_estornar — intactas (já suportam os_id NULL).
--   - Nenhum dado histórico. Nenhum INSERT/UPDATE de saneamento.
--
-- Mudança mínima nas 2 RPCs de workflow: a classificação SEM_TENANT deixa de
-- bloquear registros com origem_lancamento = 'manual' (os_id NULL). Registros
-- vinculados a OS/Programação permanecem com a checagem de tenant inalterada.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 1 — RPC oficial: criar lançamento manual de prestador (PP + FP)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.f_criar_lancamento_manual_prestador(
  p_prestador_id uuid,
  p_tipo_lancamento text,
  p_data date,
  p_valor numeric,
  p_descricao text,
  p_forma_pagamento text DEFAULT NULL,
  p_conta_pagamento text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(
  sucesso boolean,
  mensagem text,
  pagamento_prestador_id uuid,
  financeiro_pagar_id uuid,
  idempotente boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_tenant     uuid;
  v_papel      text;
  v_prestador  RECORD;
  v_tipos_validos text[] := ARRAY['Serviço Avulso','Ajuste','Reembolso','Adiantamento'];
  v_tipo       text;
  v_valor      numeric(18,2);
  v_data       date;
  v_desc       text;
  v_forma      text;
  v_conta      text;
  v_key        text;
  v_obs        text;
  v_pp_id      uuid;
  v_fp_id      uuid;
  v_existente  uuid;
BEGIN
  -- 1. Autenticação
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'USUARIO_NAO_AUTENTICADO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- 2. Tenant + perfil financeiro/admin
  SELECT tu.tenant_id, tu.papel INTO v_tenant, v_papel
    FROM public.tenant_usuarios tu
   WHERE tu.user_id = v_uid AND tu.status = 'ativo'
   LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT false, 'USUARIO_SEM_TENANT_ATIVO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  IF NOT (COALESCE(v_papel,'') = ANY(ARRAY['super_admin','admin_tenant','financeiro'])) THEN
    RETURN QUERY SELECT false, 'PAPEL_NAO_AUTORIZADO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- 3. Validação de prestador
  IF p_prestador_id IS NULL THEN
    RETURN QUERY SELECT false, 'PRESTADOR_OBRIGATORIO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  SELECT p.id, p.nome_completo, p.cpf_cnpj INTO v_prestador
    FROM public.prestadores p
   WHERE p.id = p_prestador_id AND p.status = 'ativo';
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'PRESTADOR_NAO_ENCONTRADO_OU_INATIVO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  -- 4. Tipo / data / valor / descrição
  v_tipo := btrim(COALESCE(p_tipo_lancamento,''));
  IF NOT (v_tipo = ANY(v_tipos_validos)) THEN
    RETURN QUERY SELECT false, 'TIPO_INVALIDO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  IF p_data IS NULL THEN
    RETURN QUERY SELECT false, 'DATA_OBRIGATORIA', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  v_data := p_data;

  v_valor := ROUND(COALESCE(p_valor,0)::numeric, 2);
  IF v_valor <= 0 THEN
    RETURN QUERY SELECT false, 'VALOR_INVALIDO', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  v_desc := btrim(COALESCE(p_descricao,''));
  IF v_desc = '' THEN
    RETURN QUERY SELECT false, 'DESCRICAO_OBRIGATORIA', NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  v_forma := NULLIF(btrim(COALESCE(p_forma_pagamento,'')), '');
  v_conta := NULLIF(btrim(COALESCE(p_conta_pagamento,'')), '');
  v_key   := NULLIF(btrim(COALESCE(p_idempotency_key,'')), '');

  -- 5. Idempotência: retry da MESMA submissão retorna o lançamento existente
  IF v_key IS NOT NULL THEN
    SELECT pp.id INTO v_existente
      FROM public.pagamentos_prestadores pp
     WHERE pp.origem_lancamento = 'manual'
       AND pp.observacao LIKE '%[IDEMP:' || v_key || ']%'
     LIMIT 1;
    IF v_existente IS NOT NULL THEN
      SELECT fp.id INTO v_fp_id
        FROM public.financeiro_pagar fp
       WHERE fp.os_vinculada = v_existente::text
       LIMIT 1;
      RETURN QUERY SELECT true, 'LANCAMENTO_JA_EXISTENTE', v_existente, v_fp_id, true;
      RETURN;
    END IF;
  END IF;

  v_obs := v_desc
        || CASE WHEN v_conta IS NOT NULL THEN ' [Conta: ' || v_conta || ']' ELSE '' END
        || CASE WHEN v_key   IS NOT NULL THEN ' [IDEMP:' || v_key || ']'   ELSE '' END;

  -- 6. PP — workflow operacional (obrigação manual, sem OS)
  INSERT INTO public.pagamentos_prestadores (
    prestador_id, prestador_nome, prestador_documento,
    os_id, os_numero,
    valor_liquido, valor_servicos,
    status, status_conferencia, status_aprovacao, status_pagamento,
    origem_lancamento, tipo_lancamento, tipo_pagamento, natureza,
    quantidade_os, categoria_financeira,
    data_competencia, competencia, data_prevista_pagamento, periodo_inicio, periodo_fim,
    elegivel_lote, impacto_dre, impacto_fluxo_caixa, observacao, is_teste
  ) VALUES (
    v_prestador.id, v_prestador.nome_completo, v_prestador.cpf_cnpj,
    NULL, NULL,
    v_valor, v_valor,
    'pendente', 'em_aberto', 'aguardando_aprovacao', 'pendente',
    'manual', v_tipo, v_forma, 'credito',
    1, 'Custo Logístico',
    v_data, v_data, v_data, v_data, v_data,
    false, true, true, v_obs, false
  ) RETURNING id INTO v_pp_id;

  -- 7. FP — obrigação contábil (os_id NULL; vínculo via os_vinculada = pp.id)
  INSERT INTO public.financeiro_pagar (
    os_id, os_vinculada, descricao, valor, data_emissao, data_vencimento, status,
    prestador, fornecedor_id, fornecedor_nome, categoria, observacoes
  ) VALUES (
    NULL, v_pp_id::text, v_desc, v_valor, v_data, v_data, 'aberto',
    v_prestador.nome_completo, v_prestador.id, v_prestador.nome_completo,
    'Custo Logístico', v_obs
  ) RETURNING id INTO v_fp_id;

  RETURN QUERY SELECT true, 'LANCAMENTO_CRIADO', v_pp_id, v_fp_id, false;
END;
$function$;

REVOKE ALL ON FUNCTION public.f_criar_lancamento_manual_prestador(uuid, text, date, numeric, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_criar_lancamento_manual_prestador(uuid, text, date, numeric, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_criar_lancamento_manual_prestador(uuid, text, date, numeric, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_criar_lancamento_manual_prestador(uuid, text, date, numeric, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.f_criar_lancamento_manual_prestador(uuid, text, date, numeric, text, text, text, text) IS
  'FIN-PP-FUNC-01 — Cria obrigação manual de prestador (PP + FP) de forma atômica, autenticada e idempotente.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 2 — f_aprovar_pagamento_prestadores (habilita lançamento manual)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Única alteração vs. versão vigente: base inclui origem_lancamento e a
-- classificação SEM_TENANT não se aplica a registros origem 'manual' (os_id NULL).

CREATE OR REPLACE FUNCTION public.f_aprovar_pagamento_prestadores(p_ids uuid[])
 RETURNS TABLE(solicitados integer, aprovados integer, ja_aprovados integer, bloqueados integer, detalhes jsonb)
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
  v_aprovaveis uuid[];
  v_bloqueados int;
  v_ja int;
  v_detalhes jsonb;
  v_papeis_autorizados text[] := ARRAY['super_admin','admin_tenant','financeiro'];
BEGIN
  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_ids, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL);
  v_total := COALESCE(cardinality(v_ids), 0);

  IF v_uid IS NULL THEN
    RETURN QUERY SELECT v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','USUARIO_NAO_AUTENTICADO'));
    RETURN;
  END IF;

  SELECT tu.tenant_id, tu.papel INTO v_tenant, v_papel
    FROM public.tenant_usuarios tu
   WHERE tu.user_id = v_uid AND tu.status = 'ativo'
   LIMIT 1;

  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','USUARIO_SEM_TENANT_ATIVO'));
    RETURN;
  END IF;

  IF NOT (COALESCE(v_papel,'') = ANY(v_papeis_autorizados)) THEN
    RETURN QUERY SELECT v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','PAPEL_NAO_AUTORIZADO','papel',COALESCE(v_papel,'')));
    RETURN;
  END IF;

  IF v_total = 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 0, '[]'::jsonb;
    RETURN;
  END IF;

  DROP TABLE IF EXISTS tmp_class;
  DROP TABLE IF EXISTS tmp_missing;
  CREATE TEMP TABLE tmp_class ON COMMIT DROP AS
  WITH base AS (
    SELECT p.id,
           p.os_id,
           p.origem_lancamento,
           p.prestador_id,
           COALESCE(p.valor_liquido, 0) AS valor_liquido,
           p.status,
           p.status_pagamento,
           p.status_conferencia,
           p.status_aprovacao,
           p.elegivel_lote,
           p.is_teste,
           public.f_pp_tenant_id(p.os_id) AS row_tenant,
           (SELECT o.status FROM public.ordens_servico o WHERE o.id = p.os_id) AS os_status,
           (SELECT a.status FROM public.alocacoes_escala a WHERE a.id = p.os_id) AS aloc_status,
           EXISTS (SELECT 1 FROM public.entregas_protocolo e
                    WHERE (e.alocacao_id = p.os_id OR e.ordem_servico_id = p.os_id)
                      AND e.status = 'nao_entregue') AS pod_nao_entregue
      FROM public.pagamentos_prestadores p
     WHERE p.id = ANY(v_ids)
  )
  SELECT b.id,
    CASE
      WHEN b.row_tenant IS NULL AND COALESCE(b.origem_lancamento,'') <> 'manual' THEN 'SEM_TENANT'
      WHEN b.row_tenant IS NOT NULL AND b.row_tenant <> v_tenant THEN 'CROSS_TENANT'
      WHEN COALESCE(b.os_status,'') = 'cancelada' OR COALESCE(b.aloc_status,'') = 'cancelada' THEN 'OPERACAO_CANCELADA'
      WHEN COALESCE(b.status_pagamento,'') = 'pago' OR COALESCE(b.status,'') = 'pago' THEN 'PAGO'
      WHEN COALESCE(b.status_pagamento,'') = 'cancelado' OR COALESCE(b.status_conferencia,'') = 'cancelado' OR COALESCE(b.status,'') = 'cancelado' THEN 'CANCELADO'
      WHEN COALESCE(b.status_aprovacao,'') = 'rejeitado' THEN 'REJEITADO'
      WHEN b.prestador_id IS NULL THEN 'SEM_PRESTADOR'
      WHEN b.valor_liquido <= 0 THEN 'VALOR_INVALIDO'
      WHEN b.is_teste IS TRUE THEN 'TESTE'
      WHEN b.pod_nao_entregue THEN 'POD_NAO_ENTREGUE'
      WHEN COALESCE(b.status_aprovacao,'') = 'aprovado' AND b.elegivel_lote IS TRUE THEN 'JA_APROVADO'
      WHEN COALESCE(b.status_aprovacao,'') = 'aprovado' AND b.elegivel_lote IS NOT TRUE THEN 'APROVADO_NAO_ELEGIVEL'
      ELSE 'APROVAVEL'
    END AS resultado
  FROM base b;

  CREATE TEMP TABLE tmp_missing ON COMMIT DROP AS
  SELECT x AS id, 'NAO_ENCONTRADO'::text AS resultado
    FROM unnest(v_ids) x
   WHERE NOT EXISTS (SELECT 1 FROM tmp_class c WHERE c.id = x);

  SELECT count(*)::int INTO v_ja FROM tmp_class WHERE resultado = 'JA_APROVADO';
  SELECT count(*)::int INTO v_bloqueados
    FROM (SELECT resultado FROM tmp_class WHERE resultado NOT IN ('APROVAVEL','JA_APROVADO')
          UNION ALL SELECT resultado FROM tmp_missing) z;
  v_aprovaveis := ARRAY(SELECT id FROM tmp_class WHERE resultado = 'APROVAVEL');

  v_detalhes := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'resultado', resultado,
      'motivo', CASE resultado
        WHEN 'SEM_TENANT' THEN 'Tenant do vinculo (os_id) nao resolvivel'
        WHEN 'CROSS_TENANT' THEN 'Registro pertence a outro tenant'
        WHEN 'OPERACAO_CANCELADA' THEN 'Operacao/OS vinculada cancelada'
        WHEN 'PAGO' THEN 'Pagamento ja efetuado'
        WHEN 'CANCELADO' THEN 'Pagamento cancelado'
        WHEN 'REJEITADO' THEN 'Aprovacao rejeitada (reaprovacao nao permitida)'
        WHEN 'SEM_PRESTADOR' THEN 'Sem prestador vinculado'
        WHEN 'VALOR_INVALIDO' THEN 'Valor liquido <= 0'
        WHEN 'TESTE' THEN 'Registro de teste/HML'
        WHEN 'POD_NAO_ENTREGUE' THEN 'Entrega registrada como nao entregue'
        WHEN 'APROVADO_NAO_ELEGIVEL' THEN 'Estado inconsistente: aprovado mas nao elegivel'
        WHEN 'JA_APROVADO' THEN 'Ja aprovado (no-op)'
        WHEN 'NAO_ENCONTRADO' THEN 'Registro nao encontrado'
        ELSE 'Erro desconhecido'
      END)) FROM (SELECT id, resultado FROM tmp_class UNION ALL SELECT id, resultado FROM tmp_missing) d
  ), '[]'::jsonb);

  IF v_bloqueados > 0 THEN
    RETURN QUERY SELECT v_total, 0, v_ja, v_bloqueados, v_detalhes;
    RETURN;
  END IF;

  UPDATE public.pagamentos_prestadores p
     SET status_conferencia = 'conferido',
         status_aprovacao   = 'aprovado',
         elegivel_lote      = true,
         data_conferencia   = COALESCE(p.data_conferencia, now()),
         data_aprovacao     = COALESCE(p.data_aprovacao, now())
   WHERE p.id = ANY(v_aprovaveis)
     AND COALESCE(p.status_pagamento,'') NOT IN ('pago','cancelado')
     AND COALESCE(p.status_conferencia,'') <> 'cancelado'
     AND COALESCE(p.status_aprovacao,'') <> 'rejeitado';

  RETURN QUERY SELECT v_total, cardinality(v_aprovaveis), v_ja, 0, v_detalhes;
END;
$function$;

REVOKE ALL ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEÇÃO 3 — f_gerar_lote_pagamentos (habilita lançamento manual)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Única alteração vs. versão vigente: base inclui origem_lancamento e a
-- classificação SEM_TENANT não se aplica a registros origem 'manual' (os_id NULL).

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
$function$;

REVOKE ALL ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM — FIN-PP-FUNC-01
-- ═══════════════════════════════════════════════════════════════════════════════
