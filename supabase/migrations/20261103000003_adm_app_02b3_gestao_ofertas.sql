-- =============================================================================
-- ADM-APP-02B.3 — GESTÃO INTERNA DAS OFERTAS PÚBLICAS
-- Complementa a 02B.2 com disponibilidade interna, status, observações,
-- contato, revisão humana e conversão explícita em candidato.
--
-- IMPORTANTE: este arquivo NÃO foi aplicado em nenhum banco.
-- Todas as gravações internas passam por RPC SECURITY DEFINER com validação
-- de tenant e de usuário TMS. O frontend não faz UPDATE direto.
-- =============================================================================

BEGIN;

-- 1) COLUNAS INTERNAS (não alteram os dados originais do interessado) ---------
ALTER TABLE public.recrutamento_ofertas
  ADD COLUMN IF NOT EXISTS disponibilidade_interna JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ofertas_disponibilidade_interna_object'
       AND conrelid = 'public.recrutamento_ofertas'::regclass
  ) THEN
    ALTER TABLE public.recrutamento_ofertas
      ADD CONSTRAINT ofertas_disponibilidade_interna_object
      CHECK (jsonb_typeof(disponibilidade_interna) = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ofertas_disponibilidade_interna
  ON public.recrutamento_ofertas USING GIN (disponibilidade_interna);

-- 2) COMPATIBILIDADE COM COLUNAS JÁ EXISTENTES NO AMBIENTE -------------------
-- O pipeline já recebe estas colunas do App/Recrutamento. ADD COLUMN IF NOT EXISTS
-- evita falha de conversão em ambientes que ainda não as tenham.
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe();
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS preferencias_operacionais JSONB DEFAULT NULL;
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS respostas_situacionais JSONB DEFAULT NULL;

-- 3) AUTORIZAÇÃO INTERNA ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_oferta_usuario_autorizado(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_tenant_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.tenant_usuarios tu
        WHERE tu.user_id = auth.uid()
          AND tu.tenant_id = p_tenant_id
     );
$$;

REVOKE ALL ON FUNCTION public.f_oferta_usuario_autorizado(UUID)
  FROM PUBLIC, anon, authenticated;

-- 3) TRANSIÇÕES PERMITIDAS ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_oferta_status_transicao_permitida(
  p_status_atual TEXT,
  p_novo_status TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    (p_status_atual = 'nova' AND p_novo_status IN ('em_analise', 'em_contato', 'descartada', 'arquivada'))
    OR (p_status_atual = 'em_analise' AND p_novo_status IN ('em_contato', 'descartada', 'arquivada'))
    OR (p_status_atual = 'em_contato' AND p_novo_status IN ('descartada', 'arquivada'))
    OR (p_status_atual = 'convertida' AND p_novo_status IN ('arquivada'))
    OR (p_status_atual = 'duplicada' AND p_novo_status IN ('arquivada'))
  );
$$;

REVOKE ALL ON FUNCTION public.f_oferta_status_transicao_permitida(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

-- 4) RPC: ALTERAR STATUS ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_atualizar_status_oferta(
  p_oferta_id UUID,
  p_novo_status TEXT,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id_safe();
  v_oferta public.recrutamento_ofertas%ROWTYPE;
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT public.f_oferta_usuario_autorizado(v_tenant) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'oferta_obrigatoria' USING ERRCODE = '22023';
  END IF;
  IF p_novo_status IS NULL
     OR p_novo_status NOT IN ('nova', 'em_analise', 'em_contato', 'descartada', 'arquivada') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_novo_status = 'convertida' THEN
    RAISE EXCEPTION 'conversao_exige_rpc_propria' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_oferta
    FROM public.recrutamento_ofertas
   WHERE id = p_oferta_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'oferta_nao_encontrada' USING ERRCODE = '22023';
  END IF;
  IF v_oferta.status = p_novo_status THEN
    RAISE EXCEPTION 'status_inalterado' USING ERRCODE = '22023';
  END IF;
  IF NOT public.f_oferta_status_transicao_permitida(v_oferta.status, p_novo_status) THEN
    RAISE EXCEPTION 'transicao_status_invalida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recrutamento_ofertas
     SET status = p_novo_status, updated_at = v_agora
   WHERE id = v_oferta.id;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_oferta.id, v_tenant, 'status_alterado',
    'Status alterado de ' || v_oferta.status || ' para ' || p_novo_status || '.',
    jsonb_build_object(
      'status_anterior', v_oferta.status,
      'status_novo', p_novo_status,
      'motivo', NULLIF(btrim(coalesce(p_motivo, '')), '')
    ),
    auth.uid()::text
  );

  RETURN jsonb_build_object(
    'success', TRUE, 'oferta_id', v_oferta.id,
    'status_anterior', v_oferta.status, 'status', p_novo_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_atualizar_status_oferta(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_atualizar_status_oferta(UUID, TEXT, TEXT)
  TO authenticated;

-- 5) RPC: OBSERVAÇÃO INTERNA -------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_registrar_observacao_oferta(
  p_oferta_id UUID,
  p_texto TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id_safe();
  v_oferta public.recrutamento_ofertas%ROWTYPE;
  v_texto TEXT := NULLIF(regexp_replace(btrim(coalesce(p_texto, '')), '\s+', ' ', 'g'), '');
  v_evento_id UUID;
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT public.f_oferta_usuario_autorizado(v_tenant) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  IF v_texto IS NULL OR char_length(v_texto) < 2 OR char_length(v_texto) > 2000 THEN
    RAISE EXCEPTION 'observacao_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_oferta
    FROM public.recrutamento_ofertas
   WHERE id = p_oferta_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'oferta_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recrutamento_ofertas
     SET updated_at = v_agora
   WHERE id = v_oferta.id;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_oferta.id, v_tenant, 'observacao_interna', v_texto,
    jsonb_build_object('observacao', v_texto), auth.uid()::text
  ) RETURNING id INTO v_evento_id;

  RETURN jsonb_build_object(
    'success', TRUE, 'oferta_id', v_oferta.id, 'evento_id', v_evento_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_registrar_observacao_oferta(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_registrar_observacao_oferta(UUID, TEXT)
  TO authenticated;

-- 6) RPC: DISPONIBILIDADE INTERNA --------------------------------------------
CREATE OR REPLACE FUNCTION public.f_atualizar_disponibilidade_oferta(
  p_oferta_id UUID,
  p_dias JSONB DEFAULT '[]'::jsonb,
  p_horario_inicio TIME DEFAULT NULL,
  p_horario_fim TIME DEFAULT NULL,
  p_modalidades TEXT[] DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id_safe();
  v_oferta public.recrutamento_ofertas%ROWTYPE;
  v_dias JSONB;
  v_modalidades TEXT[];
  v_interna JSONB;
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT public.f_oferta_usuario_autorizado(v_tenant) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'oferta_obrigatoria' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_dias, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'dias_invalidos' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(coalesce(p_dias, '[]'::jsonb)) AS d
     WHERE d.value !~ '^[0-6]$'
  ) THEN
    RAISE EXCEPTION 'dias_invalidos' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(DISTINCT value::int), '[]'::jsonb)
    INTO v_dias
    FROM jsonb_array_elements_text(coalesce(p_dias, '[]'::jsonb)) AS t(value);

  IF p_horario_inicio IS NULL AND p_horario_fim IS NOT NULL THEN
    RAISE EXCEPTION 'horario_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_horario_inicio IS NOT NULL AND p_horario_fim IS NULL THEN
    RAISE EXCEPTION 'horario_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_horario_inicio IS NOT NULL AND p_horario_fim IS NOT NULL
     AND p_horario_fim <= p_horario_inicio THEN
    RAISE EXCEPTION 'horario_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_modalidades IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p_modalidades) AS m
     WHERE m NOT IN ('esporadica', 'urgente', 'fixa', 'recorrente')
  ) THEN
    RAISE EXCEPTION 'modalidades_invalidas' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(DISTINCT m ORDER BY m), '{}'::text[])
    INTO v_modalidades
    FROM unnest(coalesce(p_modalidades, '{}'::text[])) AS m;

  SELECT * INTO v_oferta
    FROM public.recrutamento_ofertas
   WHERE id = p_oferta_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'oferta_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  v_interna := jsonb_build_object(
    'dias', v_dias,
    'horario_inicio', p_horario_inicio,
    'horario_fim', p_horario_fim,
    'modalidades', to_jsonb(v_modalidades),
    'atualizado_em', v_agora,
    'atualizado_por', auth.uid()
  );

  UPDATE public.recrutamento_ofertas
     SET disponibilidade_interna = v_interna, updated_at = v_agora
   WHERE id = v_oferta.id;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_oferta.id, v_tenant, 'disponibilidade_atualizada',
    'Disponibilidade interna atualizada (oferta original preservada).',
    jsonb_build_object('anterior', v_oferta.disponibilidade_interna, 'novo', v_interna),
    auth.uid()::text
  );

  RETURN jsonb_build_object(
    'success', TRUE, 'oferta_id', v_oferta.id, 'disponibilidade_interna', v_interna
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_atualizar_disponibilidade_oferta(UUID, JSONB, TIME, TIME, TEXT[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_atualizar_disponibilidade_oferta(UUID, JSONB, TIME, TIME, TEXT[])
  TO authenticated;

-- 7) RPC: CONTATO REGISTRADO --------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_registrar_contato_oferta(
  p_oferta_id UUID,
  p_canal TEXT,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id_safe();
  v_oferta public.recrutamento_ofertas%ROWTYPE;
  v_canal TEXT := lower(btrim(coalesce(p_canal, '')));
  v_obs TEXT := NULLIF(regexp_replace(btrim(coalesce(p_observacao, '')), '\s+', ' ', 'g'), '');
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT public.f_oferta_usuario_autorizado(v_tenant) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  IF v_canal NOT IN ('whatsapp', 'telefone', 'email') THEN
    RAISE EXCEPTION 'canal_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_oferta
    FROM public.recrutamento_ofertas
   WHERE id = p_oferta_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'oferta_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  IF v_canal IN ('whatsapp', 'telefone') AND coalesce(btrim(v_oferta.telefone_norm), '') = '' THEN
    RAISE EXCEPTION 'contato_indisponivel' USING ERRCODE = '22023';
  END IF;
  IF v_canal = 'email' AND coalesce(btrim(v_oferta.email_norm), '') = '' THEN
    RAISE EXCEPTION 'contato_indisponivel' USING ERRCODE = '22023';
  END IF;
  IF v_obs IS NOT NULL AND char_length(v_obs) > 500 THEN
    RAISE EXCEPTION 'observacao_invalida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recrutamento_ofertas
     SET updated_at = v_agora
   WHERE id = v_oferta.id;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_oferta.id, v_tenant, 'contato_registrado',
    'Contato registrado via ' || v_canal || '.',
    jsonb_build_object('canal', v_canal, 'observacao', v_obs),
    auth.uid()::text
  );

  RETURN jsonb_build_object('success', TRUE, 'oferta_id', v_oferta.id, 'canal', v_canal);
END;
$$;

REVOKE ALL ON FUNCTION public.f_registrar_contato_oferta(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_registrar_contato_oferta(UUID, TEXT, TEXT)
  TO authenticated;

-- 8) RPC: RESOLVER REVISÃO HUMANA --------------------------------------------
CREATE OR REPLACE FUNCTION public.f_resolver_revisao_oferta(
  p_oferta_id UUID,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id_safe();
  v_oferta public.recrutamento_ofertas%ROWTYPE;
  v_obs TEXT := NULLIF(regexp_replace(btrim(coalesce(p_observacao, '')), '\s+', ' ', 'g'), '');
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT public.f_oferta_usuario_autorizado(v_tenant) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_oferta
    FROM public.recrutamento_ofertas
   WHERE id = p_oferta_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'oferta_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  IF v_oferta.revisao_humana = FALSE THEN
    RETURN jsonb_build_object('success', TRUE, 'oferta_id', v_oferta.id, 'revisao_humana', FALSE, 'ja_resolvida', TRUE);
  END IF;
  IF v_obs IS NOT NULL AND char_length(v_obs) > 1000 THEN
    RAISE EXCEPTION 'observacao_invalida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recrutamento_ofertas
     SET revisao_humana = FALSE, updated_at = v_agora
   WHERE id = v_oferta.id;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_oferta.id, v_tenant, 'revisao_resolvida',
    'Revisão humana de conflito de identificadores resolvida.',
    jsonb_build_object('observacao', v_obs), auth.uid()::text
  );

  RETURN jsonb_build_object('success', TRUE, 'oferta_id', v_oferta.id, 'revisao_humana', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.f_resolver_revisao_oferta(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_resolver_revisao_oferta(UUID, TEXT)
  TO authenticated;

-- 9) RPC: CONVERSÃO EXPLÍCITA EM CANDIDATO ------------------------------------
CREATE OR REPLACE FUNCTION public.f_converter_oferta_em_candidato(
  p_oferta_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant UUID := public.current_tenant_id_safe();
  v_oferta public.recrutamento_ofertas%ROWTYPE;
  v_candidato_id UUID;
  v_candidato_relacionado_id UUID;
  v_candidato_relacionado_oferta UUID;
  v_telefone_norm TEXT;
  v_email_norm TEXT;
  v_preferencias JSONB;
  v_questionario JSONB;
  v_historico JSONB;
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT public.f_oferta_usuario_autorizado(v_tenant) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'oferta_obrigatoria' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_oferta
    FROM public.recrutamento_ofertas
   WHERE id = p_oferta_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'oferta_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_candidato_id
    FROM public.recrutamento_candidatos
   WHERE oferta_id = v_oferta.id
   ORDER BY data_entrada ASC NULLS LAST
   LIMIT 1;

  IF v_candidato_id IS NOT NULL THEN
    IF v_oferta.status <> 'convertida' THEN
      IF NOT public.f_oferta_status_transicao_permitida(v_oferta.status, 'convertida') THEN
        RAISE EXCEPTION 'conversao_inconsistente' USING ERRCODE = '22023';
      END IF;
      UPDATE public.recrutamento_ofertas
         SET status = 'convertida', updated_at = v_agora
       WHERE id = v_oferta.id;
    END IF;
    INSERT INTO public.recrutamento_oferta_eventos
      (oferta_id, tenant_id, tipo, descricao, dados, ator)
    VALUES (
      v_oferta.id, v_tenant, 'conversao_idempotente',
      'Tentativa de conversão reconheceu candidato já vinculado.',
      jsonb_build_object('candidato_id', v_candidato_id), auth.uid()::text
    );
    RETURN jsonb_build_object(
      'success', TRUE, 'oferta_id', v_oferta.id, 'protocolo', v_oferta.protocolo,
      'candidato_id', v_candidato_id, 'ja_convertida', TRUE, 'status', 'convertida'
    );
  END IF;

  IF v_oferta.status NOT IN ('em_analise', 'em_contato', 'convertida') THEN
    RAISE EXCEPTION 'status_invalido_para_conversao' USING ERRCODE = '22023';
  END IF;
  IF v_oferta.revisao_humana THEN
    RAISE EXCEPTION 'revisao_humana_pendente' USING ERRCODE = '22023';
  END IF;

  v_telefone_norm := regexp_replace(coalesce(v_oferta.telefone, ''), '\D', '', 'g');
  v_email_norm := lower(btrim(coalesce(v_oferta.email, '')));

  -- Não duplica candidato: reutiliza candidato já relacionado por telefone/e-mail.
  IF v_telefone_norm <> '' OR v_email_norm <> '' THEN
    SELECT c.id, c.oferta_id
      INTO v_candidato_relacionado_id, v_candidato_relacionado_oferta
      FROM public.recrutamento_candidatos c
     WHERE c.tenant_id = v_tenant
       AND (
         (v_telefone_norm <> '' AND regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_telefone_norm)
         OR (v_email_norm <> '' AND lower(btrim(coalesce(c.email, ''))) = v_email_norm)
       )
     ORDER BY c.data_entrada ASC NULLS LAST
     LIMIT 1;

    IF v_candidato_relacionado_id IS NOT NULL THEN
      IF v_candidato_relacionado_oferta IS NOT NULL
         AND v_candidato_relacionado_oferta <> v_oferta.id THEN
        RAISE EXCEPTION 'candidato_duplicado_existente' USING ERRCODE = '22023';
      END IF;

      UPDATE public.recrutamento_candidatos
         SET oferta_id = v_oferta.id,
             data_atualizacao = v_agora::text,
             updated_at = v_agora
       WHERE id = v_candidato_relacionado_id
         AND tenant_id = v_tenant;

      UPDATE public.recrutamento_ofertas
         SET status = 'convertida', updated_at = v_agora
       WHERE id = v_oferta.id;

      INSERT INTO public.recrutamento_oferta_eventos
        (oferta_id, tenant_id, tipo, descricao, dados, ator)
      VALUES (
        v_oferta.id, v_tenant, 'conversao_candidato_existente',
        'Conversão reutilizou candidato já existente por telefone/e-mail; nenhum candidato duplicado foi criado.',
        jsonb_build_object('candidato_id', v_candidato_relacionado_id, 'protocolo', v_oferta.protocolo),
        auth.uid()::text
      );

      RETURN jsonb_build_object(
        'success', TRUE, 'oferta_id', v_oferta.id, 'protocolo', v_oferta.protocolo,
        'candidato_id', v_candidato_relacionado_id, 'ja_convertida', TRUE,
        'ja_existente', TRUE, 'status', 'convertida'
      );
    END IF;
  END IF;

  IF v_oferta.status = 'convertida' THEN
    RAISE EXCEPTION 'conversao_inconsistente' USING ERRCODE = '22023';
  END IF;
  IF v_oferta.status NOT IN ('em_analise', 'em_contato') THEN
    RAISE EXCEPTION 'status_invalido_para_conversao' USING ERRCODE = '22023';
  END IF;

  v_preferencias := jsonb_build_object(
    'origem', 'oferta_publica',
    'oferta_id', v_oferta.id,
    'protocolo', v_oferta.protocolo,
    'tipo_oferta', v_oferta.tipo_oferta,
    'regioes', v_oferta.regioes,
    'dias_disponiveis', v_oferta.dias_disponiveis,
    'horario_inicio', v_oferta.horario_inicio,
    'horario_fim', v_oferta.horario_fim,
    'modalidades', to_jsonb(v_oferta.modalidades),
    'disponibilidade_interna', v_oferta.disponibilidade_interna,
    'veiculo', jsonb_build_object(
      'categoria', v_oferta.veiculo_categoria,
      'tipo', v_oferta.veiculo_tipo,
      'carroceria', v_oferta.carroceria,
      'modelo', v_oferta.veiculo_modelo,
      'placa', v_oferta.veiculo_placa,
      'ano', v_oferta.veiculo_ano,
      'capacidade_kg', v_oferta.capacidade_kg,
      'capacidade_m3', v_oferta.capacidade_m3,
      'dimensoes', v_oferta.dimensoes,
      'caracteristicas', v_oferta.caracteristicas
    ),
    'valores', jsonb_build_object(
      'diaria', v_oferta.valor_diaria,
      'km', v_oferta.valor_km,
      'saida', v_oferta.valor_saida,
      'mensal', v_oferta.valor_mensal,
      'negociavel', v_oferta.valor_negociavel
    ),
    'condicoes', v_oferta.condicoes_comerciais,
    'restricoes', v_oferta.restricoes
  );
  v_questionario := jsonb_build_object(
    'origem', 'oferta_publica',
    'protocolo', v_oferta.protocolo,
    'observacoes', v_oferta.observacoes
  );
  v_historico := jsonb_build_array(jsonb_build_object(
    'tipo', 'criado',
    'descricao', 'Candidato criado a partir da oferta pública ' || v_oferta.protocolo || '.',
    'data', v_agora
  ));

  INSERT INTO public.recrutamento_candidatos (
    tenant_id, nome, telefone, email, cidade, uf, veiculo, placa,
    stage, status_documental, data_entrada, data_atualizacao, tags,
    observacoes_ia, documentos, questionario_respostas, preferencias_operacionais,
    respostas_situacionais, disponibilidade_recrutamento, historico, oferta_id,
    created_at, updated_at
  ) VALUES (
    v_tenant, v_oferta.nome, v_oferta.telefone, v_oferta.email,
    v_oferta.cidade, v_oferta.uf,
    coalesce(v_oferta.veiculo_tipo, ''), coalesce(v_oferta.veiculo_placa, ''),
    'novo_candidato', 'pendente', v_agora::text, v_agora::text, jsonb_build_array('oferta_publica'),
    'Convertido da oferta pública ' || v_oferta.protocolo || '. Oferta original preservada.',
    '[]'::jsonb, v_questionario, v_preferencias, NULL, 'Oferta pública',
    v_historico, v_oferta.id, v_agora, v_agora
  ) RETURNING id INTO v_candidato_id;

  UPDATE public.recrutamento_ofertas
     SET status = 'convertida', updated_at = v_agora
   WHERE id = v_oferta.id;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_oferta.id, v_tenant, 'oferta_convertida',
    'Oferta convertida explicitamente em candidato do Recrutamento.',
    jsonb_build_object('candidato_id', v_candidato_id, 'protocolo', v_oferta.protocolo),
    auth.uid()::text
  );

  RETURN jsonb_build_object(
    'success', TRUE, 'oferta_id', v_oferta.id, 'protocolo', v_oferta.protocolo,
    'candidato_id', v_candidato_id, 'ja_convertida', FALSE, 'status', 'convertida'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_converter_oferta_em_candidato(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_converter_oferta_em_candidato(UUID)
  TO authenticated;

-- 10) GRANTS: SOMENTE LEITURA DIRETA; ESCRITA APENAS VIA RPC -----------------
REVOKE UPDATE ON public.recrutamento_ofertas FROM authenticated;
REVOKE INSERT, DELETE ON public.recrutamento_ofertas FROM authenticated;
GRANT SELECT ON public.recrutamento_ofertas TO authenticated;

-- 11) COMENTÁRIOS ------------------------------------------------------------
COMMENT ON COLUMN public.recrutamento_ofertas.disponibilidade_interna IS
  'Disponibilidade ajustada pela equipe interna. Não sobrescreve dias/horários/modalidades originais do interessado.';
COMMENT ON FUNCTION public.f_atualizar_status_oferta(UUID, TEXT, TEXT) IS
  'ADM-APP-02B.3 — altera status respeitando as transições da 02B.2; conversão não ocorre por aqui.';
COMMENT ON FUNCTION public.f_converter_oferta_em_candidato(UUID) IS
  'ADM-APP-02B.3 — conversão explícita e idempotente em recrutamento_candidatos; não cria prestador/Auth/liberado_app.';

NOTIFY pgrst, 'reload schema';

COMMIT;
