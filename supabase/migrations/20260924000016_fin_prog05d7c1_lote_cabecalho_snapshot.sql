-- ============================================================================
-- TMS-FIN-PROG-05D.7C.1 — Lote com CABECALHO + SNAPSHOT de destino
-- ----------------------------------------------------------------------------
-- Cria lotes_pagamento (cabecalho) e lotes_pagamento_itens (snapshot por item),
-- FK pagamentos_prestadores.lote_id -> lotes_pagamento.id, RLS de leitura para o
-- TMS (tenant + papel financeiro/admin/super_admin) e atualiza a RPC
-- f_gerar_lote_pagamentos para, atomicamente: validar destino bancario,
-- criar cabecalho, gravar snapshots e marcar em_lote.
-- SEM iFi/CNAB/envio/baixa. Nao duplica pagamentos_prestadores/financeiro_*.
-- ============================================================================

BEGIN;

-- 1) CABECALHO
CREATE TABLE IF NOT EXISTS public.lotes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'preparado'
    CHECK (status IN ('preparado','enviado','processando','processado','erro','cancelado')),
  quantidade_pagamentos integer NOT NULL,
  valor_total numeric NOT NULL,
  provider text,
  id_externo_provider text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  enviado_at timestamptz,
  processado_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lotes_pagamento_tenant ON public.lotes_pagamento(tenant_id);

-- 2) ITENS (SNAPSHOT IMUTAVEL)
CREATE TABLE IF NOT EXISTS public.lotes_pagamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes_pagamento(id) ON DELETE CASCADE,
  pagamento_prestador_id uuid NOT NULL REFERENCES public.pagamentos_prestadores(id) ON DELETE CASCADE,
  prestador_id uuid,
  valor numeric NOT NULL,
  forma_destino text,
  banco text,
  agencia text,
  conta text,
  digito text,
  tipo_conta text,
  favorecido text,
  documento_favorecido text,
  chave_pix text,
  tipo_chave_pix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lote_item UNIQUE (lote_id, pagamento_prestador_id)
);
CREATE INDEX IF NOT EXISTS idx_lotes_pagamento_itens_lote ON public.lotes_pagamento_itens(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_pagamento_itens_pag ON public.lotes_pagamento_itens(pagamento_prestador_id);

-- 3) FK lote_id -> lotes_pagamento (preserva valores existentes)
ALTER TABLE public.pagamentos_prestadores DROP CONSTRAINT IF EXISTS fk_pp_lote;
ALTER TABLE public.pagamentos_prestadores
  ADD CONSTRAINT fk_pp_lote FOREIGN KEY (lote_id)
  REFERENCES public.lotes_pagamento(id) ON DELETE SET NULL;

-- 4) RLS (somente SELECT para o TMS do tenant; sem policy de escrita/DELETE pela UI)
ALTER TABLE public.lotes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_pagamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lotes_select_tms ON public.lotes_pagamento;
CREATE POLICY lotes_select_tms ON public.lotes_pagamento
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
    WHERE tu.user_id = auth.uid() AND tu.status = 'ativo'
      AND tu.tenant_id = lotes_pagamento.tenant_id
      AND tu.papel IN ('super_admin','admin_tenant','financeiro')
  ));

DROP POLICY IF EXISTS lotes_itens_select_tms ON public.lotes_pagamento_itens;
CREATE POLICY lotes_itens_select_tms ON public.lotes_pagamento_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lotes_pagamento l
    JOIN public.tenant_usuarios tu ON tu.tenant_id = l.tenant_id
    WHERE l.id = lotes_pagamento_itens.lote_id
      AND tu.user_id = auth.uid() AND tu.status = 'ativo'
      AND tu.papel IN ('super_admin','admin_tenant','financeiro')
  ));

REVOKE ALL ON public.lotes_pagamento FROM PUBLIC, anon;
REVOKE ALL ON public.lotes_pagamento_itens FROM PUBLIC, anon;
GRANT SELECT ON public.lotes_pagamento TO authenticated;
GRANT SELECT ON public.lotes_pagamento_itens TO authenticated;

-- 5) RPC: cria cabecalho + snapshots + marca em_lote (ALL-OR-NOTHING)
CREATE OR REPLACE FUNCTION public.f_gerar_lote_pagamentos(p_ids uuid[])
RETURNS TABLE(
  lote_id uuid, solicitados int, incluidos int, ja_em_lote int, bloqueados int, detalhes jsonb
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
      WHEN b.row_tenant IS NULL THEN 'SEM_TENANT'
      WHEN b.row_tenant <> v_tenant THEN 'CROSS_TENANT'
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
$fn$;

REVOKE ALL ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_gerar_lote_pagamentos(uuid[]) TO authenticated;

COMMIT;
