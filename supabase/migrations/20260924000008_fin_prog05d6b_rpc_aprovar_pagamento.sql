-- ============================================================================
-- TMS-FIN-PROG-05D.6B — RPC f_aprovar_pagamento_prestadores(uuid[])
-- ----------------------------------------------------------------------------
-- OBJETIVO: transformar pagamentos_prestadores JA existentes (provisao) em
--           APROVADOS/ELEGIVEIS PARA PAGAMENTO. NAO cria lote, NAO paga,
--           NAO gera baixa, NAO altera financeiro_pagar.
--
-- BASE: 05D.4 (SELECT TMS por tenant) e 05D.6A (UPDATE TMS por tenant) = PASS.
--       tenant derivado por public.f_pp_tenant_id(os_id) -> ordens_servico/
--       alocacoes_escala.tenant_id.
--
-- SEGURANCA:
--   * SECURITY DEFINER (necessario p/ operacao consistente), search_path fixo.
--   * Valida auth.uid() e tenant DENTRO da funcao (nao confia apenas na RLS).
--   * REVOKE PUBLIC/anon; GRANT EXECUTE somente a authenticated.
--   * Nao aprova cross-tenant nem linha sem tenant resolvivel.
--
-- ATOMICIDADE (explicita, sem parcial silencioso):
--   Se QUALQUER id solicitado for bloqueado, NENHUM e aprovado; a funcao
--   retorna o resumo com os motivos. Todos validos => aprova todos.
--
-- IDEMPOTENCIA:
--   Reexecucao de ids ja aprovados => aprovados=0, ja_aprovados=N, sem alterar
--   datas (data_conferencia/data_aprovacao preservadas via COALESCE).
--
-- POD (regra encontrada, sem inventar taxonomia):
--   Fonte oficial = entregas_protocolo (alocacao_id / ordem_servico_id, status).
--   O sistema (Conferencia/semaforo) trata POD ausente/'pendente' como ATENCAO
--   (nao bloqueio) e SOMENTE status='nao_entregue' como BLOQUEIO. Portanto o
--   guard e NEGATIVO: bloqueia apenas quando existe entrega explicita
--   'nao_entregue' vinculada; POD ausente NAO bloqueia (opcional por operacao).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.f_aprovar_pagamento_prestadores(p_ids uuid[])
RETURNS TABLE(
  solicitados int,
  aprovados int,
  ja_aprovados int,
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
  v_ids uuid[];
  v_total int;
  v_aprovaveis uuid[];
  v_bloqueados int;
  v_ja int;
  v_detalhes jsonb;
BEGIN
  -- Normaliza entrada (dedup, remove NULL)
  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_ids, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL);
  v_total := COALESCE(cardinality(v_ids), 0);

  IF v_uid IS NULL THEN
    RETURN QUERY SELECT v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','USUARIO_NAO_AUTENTICADO'));
    RETURN;
  END IF;

  SELECT tu.tenant_id INTO v_tenant
    FROM public.tenant_usuarios tu
   WHERE tu.user_id = v_uid AND tu.status = 'ativo'
   LIMIT 1;

  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT v_total, 0, 0, v_total,
      jsonb_build_array(jsonb_build_object('resultado','BLOQUEADO','motivo','USUARIO_SEM_TENANT_ATIVO'));
    RETURN;
  END IF;

  IF v_total = 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 0, '[]'::jsonb;
    RETURN;
  END IF;

  -- Classificacao por id (uma passada)
  DROP TABLE IF EXISTS tmp_class;
  DROP TABLE IF EXISTS tmp_missing;
  CREATE TEMP TABLE tmp_class ON COMMIT DROP AS
  WITH base AS (
    SELECT p.id,
           p.os_id,
           p.prestador_id,
           COALESCE(p.valor_liquido, 0) AS valor_liquido,
           p.status,
           p.status_pagamento,
           p.status_conferencia,
           p.status_aprovacao,
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
      WHEN b.row_tenant IS NULL THEN 'SEM_TENANT'
      WHEN b.row_tenant <> v_tenant THEN 'CROSS_TENANT'
      WHEN COALESCE(b.os_status,'') = 'cancelada' OR COALESCE(b.aloc_status,'') = 'cancelada' THEN 'OPERACAO_CANCELADA'
      WHEN COALESCE(b.status_pagamento,'') = 'pago' OR COALESCE(b.status,'') = 'pago' THEN 'PAGO'
      WHEN COALESCE(b.status_pagamento,'') = 'cancelado' OR COALESCE(b.status_conferencia,'') = 'cancelado' OR COALESCE(b.status,'') = 'cancelado' THEN 'CANCELADO'
      WHEN COALESCE(b.status_aprovacao,'') = 'rejeitado' THEN 'REJEITADO'
      WHEN b.prestador_id IS NULL THEN 'SEM_PRESTADOR'
      WHEN b.valor_liquido <= 0 THEN 'VALOR_INVALIDO'
      WHEN b.is_teste IS TRUE THEN 'TESTE'
      WHEN b.pod_nao_entregue THEN 'POD_NAO_ENTREGUE'
      WHEN COALESCE(b.status_aprovacao,'') = 'aprovado' THEN 'JA_APROVADO'
      ELSE 'APROVAVEL'
    END AS resultado
  FROM base b;

  -- Ids inexistentes
  CREATE TEMP TABLE tmp_missing ON COMMIT DROP AS
  SELECT x AS id, 'NAO_ENCONTRADO'::text AS resultado
    FROM unnest(v_ids) x
   WHERE NOT EXISTS (SELECT 1 FROM tmp_class c WHERE c.id = x);

  SELECT count(*)::int INTO v_ja FROM tmp_class WHERE resultado = 'JA_APROVADO';
  SELECT count(*)::int INTO v_bloqueados
    FROM (SELECT resultado FROM tmp_class WHERE resultado NOT IN ('APROVAVEL','JA_APROVADO')
          UNION ALL SELECT resultado FROM tmp_missing) z;
  v_aprovaveis := ARRAY(SELECT id FROM tmp_class WHERE resultado = 'APROVAVEL');

  -- detalhes (motivo legivel)
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
        WHEN 'JA_APROVADO' THEN 'Ja aprovado (no-op)'
        WHEN 'NAO_ENCONTRADO' THEN 'Registro nao encontrado'
        ELSE 'Erro desconhecido'
      END)) FROM (SELECT id, resultado FROM tmp_class UNION ALL SELECT id, resultado FROM tmp_missing) d
  ), '[]'::jsonb);

  -- ATOMICIDADE: se houver qualquer bloqueio, nao aprova nada
  IF v_bloqueados > 0 THEN
    RETURN QUERY SELECT v_total, 0, v_ja, v_bloqueados, v_detalhes;
    RETURN;
  END IF;

  -- Aplica aprovacao somente no conjunto validado
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

  RETURN QUERY SELECT v_total,
                      cardinality(v_aprovaveis),
                      v_ja,
                      0,
                      v_detalhes;
END;
$fn$;

REVOKE ALL ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.f_aprovar_pagamento_prestadores(uuid[]) IS
 'TMS-FIN-PROG-05D.6B: aprova pagamentos_prestadores (provisao->conferido/aprovado/elegivel) do proprio tenant. Atomica e idempotente. Nao cria lote/paga/baixa.';

COMMIT;
