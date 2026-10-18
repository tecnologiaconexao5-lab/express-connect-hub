-- ═══════════════════════════════════════════════════════════════════════════════
-- APP-E2E-08 — F3/GAP-F3-03: BLOQUEIO DE POD VAZIO (validação server-side)
--
-- Problema: f_atualizar_etapa_app('pod_registrado') e
--           f_avancar_etapa_app_motorista('pod_registrado') aceitavam a etapa
--           apenas com a flag/payload, sem exigir delivery_proofs válido.
--
-- Solução: validação COMPARTILHADA (uma única regra) chamada pelas DUAS RPCs,
--          antes de persistir pod_registrado e também na finalização.
--          O modo é DERIVADO do banco (alocacoes_escala.operation_mode).
--
-- Regras reais (conferidas no APP):
--   EXPRESS  (operation_mode='express' ou metadata tipo/jornada express):
--       photo_url (foto entrega) + foto_canhoto_url (canhoto), remotos.
--   PADRÃO   (demais modos):
--       signature_url (assinatura) remota + receiver_name não vazio.
--   Em ambos: status != 'not_delivered'; remoto = POD-05 (não local/vazio).
--
-- GAP-F2-04 (unificação total das 2 máquinas de estado) permanece ABERTO.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Helper: referência de mídia remota (não local/vazia) — alinhado ao POD-05.
CREATE OR REPLACE FUNCTION public.f_pod_referencia_remota(p_valor text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_valor IS NOT NULL
     AND btrim(p_valor) <> ''
     AND p_valor NOT LIKE 'file://%'
     AND p_valor NOT LIKE 'data:%'
     AND left(btrim(p_valor), 1) <> '/'
     AND p_valor !~ '^[A-Za-z]:[\\/]'
$$;

-- 2) Validação COMPARTILHADA: existe POD válido para a alocação/prestador?
CREATE OR REPLACE FUNCTION public.f_validar_pod_operacao(
  p_alocacao_id uuid,
  p_auth_uid uuid,
  p_prestador_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_express boolean;
  v_ok boolean;
BEGIN
  SELECT (
      lower(coalesce(ae.operation_mode,'')) = 'express'
      OR lower(coalesce(ae.metadata->>'tipo','')) IN ('express','motoboy','avulso','avulsa')
      OR lower(coalesce(ae.metadata->'app_motorista'->>'tipo_jornada','')) = 'express'
    )
  INTO v_is_express
  FROM public.alocacoes_escala ae
  WHERE ae.id = p_alocacao_id;

  IF v_is_express IS NULL THEN
    RETURN false;
  END IF;

  IF v_is_express THEN
    SELECT EXISTS (
      SELECT 1 FROM public.delivery_proofs dp
      WHERE dp.operation_id = p_alocacao_id::text
        AND (dp.driver_id = p_auth_uid::text OR dp.driver_id = p_prestador_id::text)
        AND coalesce(dp.status,'') <> 'not_delivered'
        AND public.f_pod_referencia_remota(dp.photo_url)
        AND public.f_pod_referencia_remota(dp.foto_canhoto_url)
    ) INTO v_ok;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.delivery_proofs dp
      WHERE dp.operation_id = p_alocacao_id::text
        AND (dp.driver_id = p_auth_uid::text OR dp.driver_id = p_prestador_id::text)
        AND coalesce(dp.status,'') <> 'not_delivered'
        AND public.f_pod_referencia_remota(dp.signature_url)
        AND btrim(coalesce(dp.receiver_name,'')) <> ''
    ) INTO v_ok;
  END IF;

  RETURN coalesce(v_ok, false);
END;
$$;

-- 3) Inserir o gate nas DUAS RPCs, sem transcrever os corpos (evita drift).
DO $blk$
DECLARE
  v_def text := (
    SELECT pg_get_functiondef(pp.oid) FROM pg_proc pp
    WHERE pp.proname = 'f_atualizar_etapa_app' AND pp.pronamespace = 'public'::regnamespace
    LIMIT 1);
  v_new text;
  v_anchor text := 'v_app_meta := COALESCE(v_alocacao.metadata->''app_motorista'', ''{}''::JSONB);';
  v_gate text :=
    'IF p_etapa = ''pod_registrado'' AND NOT public.f_validar_pod_operacao(p_alocacao_id, v_authenticated_uid, v_prestador_id) THEN' || chr(10) ||
    '  RETURN jsonb_build_object(''success'', false, ''error'', ''POD_EVIDENCIA_OBRIGATORIA'', ''message'', ''POD exige evidencia valida (fotos/assinatura/recebedor) para esta operacao.'');' || chr(10) ||
    'END IF;' || chr(10) ||
    'IF p_etapa = ''servico_finalizado'' AND NOT public.f_validar_pod_operacao(p_alocacao_id, v_authenticated_uid, v_prestador_id) THEN' || chr(10) ||
    '  RETURN jsonb_build_object(''success'', false, ''error'', ''POD_EVIDENCIA_OBRIGATORIA'', ''message'', ''Finalizacao exige POD valido.'');' || chr(10) ||
    'END IF;' || chr(10) || '    ';
BEGIN
  IF v_def IS NULL THEN RAISE EXCEPTION 'f_atualizar_etapa_app nao encontrada'; END IF;
  IF position('POD_EVIDENCIA_OBRIGATORIA' in v_def) > 0 THEN
    RAISE NOTICE 'f_atualizar_etapa_app ja contem o gate';
  ELSE
    IF position(v_anchor in v_def) = 0 THEN RAISE EXCEPTION 'anchor nao encontrado em f_atualizar_etapa_app'; END IF;
    v_new := replace(v_def, v_anchor, v_gate || v_anchor);
    EXECUTE v_new;
  END IF;
END $blk$;

DO $blk2$
DECLARE
  v_def text := (
    SELECT pg_get_functiondef(pp.oid) FROM pg_proc pp
    WHERE pp.proname = 'f_avancar_etapa_app_motorista' AND pp.pronamespace = 'public'::regnamespace
    LIMIT 1);
  v_new text;
  v_anchor text := 'v_app_meta := COALESCE(v_alocacao.metadata->''app_motorista'', ''{}''::JSONB);';
  v_gate text :=
    'IF p_etapa = ''pod_registrado'' AND NOT public.f_validar_pod_operacao(p_alocacao_id, v_authenticated_uid, v_prestador_id) THEN' || chr(10) ||
    '  RETURN jsonb_build_object(''success'', false, ''error'', ''POD_EVIDENCIA_OBRIGATORIA'', ''message'', ''POD exige evidencia valida (fotos/assinatura/recebedor) para esta operacao.'');' || chr(10) ||
    'END IF;' || chr(10) ||
    'IF p_etapa = ''servico_finalizado'' AND NOT public.f_validar_pod_operacao(p_alocacao_id, v_authenticated_uid, v_prestador_id) THEN' || chr(10) ||
    '  RETURN jsonb_build_object(''success'', false, ''error'', ''POD_EVIDENCIA_OBRIGATORIA'', ''message'', ''Finalizacao exige POD valido.'');' || chr(10) ||
    'END IF;' || chr(10) || '  ';
BEGIN
  IF v_def IS NULL THEN RAISE EXCEPTION 'f_avancar_etapa_app_motorista nao encontrada'; END IF;
  IF position('POD_EVIDENCIA_OBRIGATORIA' in v_def) > 0 THEN
    RAISE NOTICE 'f_avancar_etapa_app_motorista ja contem o gate';
  ELSE
    IF position(v_anchor in v_def) = 0 THEN RAISE EXCEPTION 'anchor nao encontrado em f_avancar_etapa_app_motorista'; END IF;
    v_new := replace(v_def, v_anchor, v_gate || v_anchor);
    EXECUTE v_new;
  END IF;
END $blk2$;
