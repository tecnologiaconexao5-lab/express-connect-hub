-- ============================================================================
-- TMS-FIN-PROG-05D.7B.1 — RPC f_gerar_lote_pagamentos(uuid[])
-- ----------------------------------------------------------------------------
-- OBJETIVO: agrupar pagamentos JA conferidos/aprovados/elegiveis em um lote
--           LOGICO usando a coluna EXISTENTE lote_id. NAO cria tabela nova.
--           NAO paga, NAO baixa, NAO toca financeiro_pagar/baixas.
--
-- BASE: 05D.6B.1 (papeis), 05D.6A/05D.4 (RLS/tenant), 05D.7A (mapa).
--
-- SEGURANCA: SECURITY DEFINER + search_path fixo; valida auth.uid(), tenant
--   ativo e papel (super_admin | admin_tenant | financeiro) internamente.
--   REVOKE PUBLIC/anon; GRANT EXECUTE a authenticated.
--
-- ATOMICIDADE: ALL-OR-NOTHING. Se qualquer ID for bloqueado, nada muda.
-- IDEMPOTENCIA: reexecucao dos mesmos IDs ja no MESMO lote -> retorna o lote
--   existente (no-op). Misturar sem-lote + ja-em-lote -> BLOQUEIA (nao move).
--   Lotes diferentes -> BLOQUEIA. Pagamento ja em lote nunca recebe novo lote.
-- CONCORRENCIA: SELECT ... FOR UPDATE nas linhas candidatas antes de validar.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.f_gerar_lote_pagamentos(p_ids uuid[])
RETURNS TABLE(
  lote_id uuid,
  solicitados int,
  incluidos int,
  ja_em_lote int,
  bloqueados int,
  detalhes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
    FROM public.tenant_usuarios tu
   WHERE tu.user_id = v_uid AND tu.status = 'ativo'
   LIMIT 1;

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

  -- Locking pessimista das linhas candidatas (anti dupla atribuicao)
  PERFORM 1 FROM public.pagamentos_prestadores WHERE id = ANY(v_ids) FOR UPDATE;

  DROP TABLE IF EXISTS tmp_lote_class;
  DROP TABLE IF EXISTS tmp_lote_missing;
  CREATE TEMP TABLE tmp_lote_class ON COMMIT DROP AS
  WITH base AS (
    SELECT p.id, p.lote_id, p.prestador_id, COALESCE(p.valor_liquido,0) AS valor_liquido,
           p.status, p.status_pagamento, p.status_conferencia, p.status_aprovacao,
           p.elegivel_lote, p.is_teste, p.tipo_pagamento,
           public.f_pp_tenant_id(p.os_id) AS row_tenant,
           (SELECT o.status FROM public.ordens_servico o WHERE o.id = p.os_id) AS os_status,
           (SELECT a.status FROM public.alocacoes_escala a WHERE a.id = p.os_id) AS aloc_status
      FROM public.pagamentos_prestadores p
     WHERE p.id = ANY(v_ids)
  )
  SELECT b.id, b.lote_id AS lote_atual,
    CASE
      WHEN b.row_tenant IS NULL THEN 'SEM_TENANT'
      WHEN b.row_tenant <> v_tenant THEN 'CROSS_TENANT'
      WHEN COALESCE(b.os_status,'') = 'cancelada' OR COALESCE(b.aloc_status,'') = 'cancelada' THEN 'OPERACAO_CANCELADA'
      WHEN COALESCE(b.status_pagamento,'') = 'pago' OR COALESCE(b.status,'') = 'pago' THEN 'PAGO'
      WHEN COALESCE(b.status_pagamento,'') = 'cancelado' OR COALESCE(b.status_conferencia,'') = 'cancelado' OR COALESCE(b.status,'') = 'cancelado' THEN 'CANCELADO'
      WHEN b.is_teste IS TRUE THEN 'TESTE'
      WHEN b.prestador_id IS NULL THEN 'SEM_PRESTADOR'
      WHEN b.valor_liquido <= 0 THEN 'VALOR_INVALIDO'
      WHEN COALESCE(b.tipo_pagamento,'') = 'fechamento' THEN 'AGREGADO'
      WHEN b.lote_id IS NOT NULL THEN 'JA_EM_LOTE'
      WHEN NOT (COALESCE(b.status_conferencia,'')='conferido' AND COALESCE(b.status_aprovacao,'')='aprovado' AND b.elegivel_lote IS TRUE) THEN 'NAO_ELEGIVEL'
      ELSE 'APROVAVEL'
    END AS resultado
  FROM base b;

  CREATE TEMP TABLE tmp_lote_missing ON COMMIT DROP AS
  SELECT x AS id, NULL::uuid AS lote_atual, 'NAO_ENCONTRADO'::text AS resultado
    FROM unnest(v_ids) x
   WHERE NOT EXISTS (SELECT 1 FROM tmp_lote_class c WHERE c.id = x);

  SELECT count(*)::int INTO v_aprovaveis FROM tmp_lote_class WHERE resultado = 'APROVAVEL';
  SELECT count(*)::int INTO v_ja FROM tmp_lote_class WHERE resultado = 'JA_EM_LOTE';
  SELECT count(DISTINCT lote_atual)::int INTO v_lotes FROM tmp_lote_class WHERE resultado = 'JA_EM_LOTE';
  SELECT lote_atual INTO v_lote_existente FROM tmp_lote_class WHERE resultado = 'JA_EM_LOTE' LIMIT 1;
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
        WHEN 'VALOR_INVALIDO' THEN 'Valor liquido <= 0'
        WHEN 'AGREGADO' THEN 'Registro agregado (fechamento)'
        WHEN 'JA_EM_LOTE' THEN 'Ja pertence a um lote'
        WHEN 'NAO_ELEGIVEL' THEN 'Nao conferido/aprovado/elegivel'
        WHEN 'NAO_ENCONTRADO' THEN 'Registro nao encontrado'
        ELSE 'Erro desconhecido' END))
    FROM (SELECT id, resultado FROM tmp_lote_class UNION ALL SELECT id, resultado FROM tmp_lote_missing) d
  ), '[]'::jsonb);

  -- ALL-OR-NOTHING: qualquer bloqueio -> nada muda
  IF v_bloqueados > 0 THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, v_ja, v_bloqueados, v_detalhes;
    RETURN;
  END IF;

  -- CASO B: mistura sem-lote + ja-em-lote -> bloqueia atomicamente
  IF v_ja > 0 AND v_aprovaveis > 0 THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, v_ja, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','MISTURA_JA_EM_LOTE_E_SEM_LOTE'));
    RETURN;
  END IF;

  -- CASO C: lotes diferentes -> bloqueia
  IF v_lotes > 1 THEN
    RETURN QUERY SELECT NULL::uuid, v_total, 0, v_ja, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','LOTES_DIFERENTES'));
    RETURN;
  END IF;

  -- CASO A: todos ja no mesmo lote -> no-op idempotente
  IF v_ja > 0 AND v_aprovaveis = 0 THEN
    RETURN QUERY SELECT v_lote_existente, v_total, 0, v_ja, 0, v_detalhes;
    RETURN;
  END IF;

  -- Formacao do lote (somente APROVAVEL; guardas no UPDATE)
  v_novo := gen_random_uuid();
  UPDATE public.pagamentos_prestadores p
     SET lote_id = v_novo,
         status_pagamento = 'em_lote'
    FROM tmp_lote_class t
   WHERE p.id = t.id
     AND t.resultado = 'APROVAVEL'
     AND p.lote_id IS NULL
     AND COALESCE(p.status_pagamento,'') NOT IN ('pago','cancelado')
     AND COALESCE(p.status_conferencia,'') = 'conferido'
     AND COALESCE(p.status_aprovacao,'') = 'aprovado'
     AND p.elegivel_lote IS TRUE;

  RETURN QUERY SELECT v_novo, v_total, v_aprovaveis, 0, 0, v_detalhes;
END;
$fn$;

REVOKE ALL ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) IS
 'TMS-FIN-PROG-05D.7B.1: forma lote logico (lote_id + status_pagamento=em_lote) a partir de pagamentos conferidos/aprovados/elegiveis do proprio tenant. Atomica, idempotente, tenant-safe. NAO cria tabela, nao paga, nao baixa.';

COMMIT;
