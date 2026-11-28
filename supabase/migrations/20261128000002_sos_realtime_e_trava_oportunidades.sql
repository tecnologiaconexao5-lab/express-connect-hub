-- ============================================================================
-- CONEXÃO EXPRESS 2027 — COMPLEMENTO DE GOVERNANÇA ANTI-ABUSO SOS
-- Migration idempotente: Realtime nativo, evidências de distância e trava de
-- novas oportunidades para prestador parceiro com ocorrência de segurança ativa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Realtime nativo para SOS, volumes e protocolos de divergência
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ocorrencias_seguranca_app;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.os_volumes;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.protocolos_divergencia;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2) Auditoria de distância e parecer da Torre
-- ----------------------------------------------------------------------------
ALTER TABLE public.ocorrencias_seguranca_app
  ADD COLUMN IF NOT EXISTS parecer_torre text;
ALTER TABLE public.ocorrencias_seguranca_app
  ADD COLUMN IF NOT EXISTS distancia_proxima_parada_km numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ocorrencias_seguranca_app_parecer_torre_check'
  ) THEN
    ALTER TABLE public.ocorrencias_seguranca_app
      ADD CONSTRAINT ocorrencias_seguranca_app_parecer_torre_check
      CHECK (
        parecer_torre IS NULL OR parecer_torre IN (
          'comprovada_forca_maior', 'acionamento_indevido', 'acionamento_acidental'
        )
      );
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3) Trava anti-abuso: prestador com SOS/ocorrência ativa não recebe novas
--    oportunidades (f_buscar_oportunidades_para_prestador retorna []).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_buscar_oportunidades_para_prestador(p_prestador_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestador_id uuid := COALESCE(p_prestador_id, public.f_app_prestador_id());
  v_prestador public.prestadores%ROWTYPE;
  v_veiculos_tipos text[];
  v_max_capacidade numeric;
  v_oportunidades jsonb;
BEGIN
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRESTADOR_NAO_INFORMADO',
      'oportunidades', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_prestador
  FROM public.prestadores
  WHERE id = v_prestador_id
    AND LOWER(COALESCE(status, 'ativo')) = 'ativo';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRESTADOR_NAO_ENCONTRADO',
      'oportunidades', '[]'::jsonb
    );
  END IF;

  -- ANTI-ABUSO: bloqueia a listagem enquanto houver ocorrência de segurança
  -- aberta ou em atendimento. O prestador parceiro deve aguardar a liberação
  -- da Torre de Controle antes de assumir uma nova oportunidade.
  IF EXISTS (
    SELECT 1
    FROM public.ocorrencias_seguranca_app o
    WHERE o.prestador_id = v_prestador_id
      AND o.status IN ('aberta', 'em_atendimento')
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'oportunidades', '[]'::jsonb,
      'total', 0,
      'bloqueado', true,
      'motivo', 'OCORRENCIA_SEGURANCA_ATIVA'
    );
  END IF;

  SELECT
    COALESCE(
      array_agg(DISTINCT v.tipo_veiculo)
        FILTER (WHERE v.tipo_veiculo IS NOT NULL AND v.tipo_veiculo <> ''),
      '{}'::text[]
    ),
    COALESCE(MAX(v.capacidade_kg), 0)
  INTO v_veiculos_tipos, v_max_capacidade
  FROM public.veiculos v
  WHERE v.prestador_vinculado = v_prestador_id
    AND LOWER(COALESCE(v.status, 'ativo')) = 'ativo';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ro.id,
        'os_id', ro.os_id,
        'status', ro.status,
        'valor_prestador', ro.valor_prestador,
        'veiculo_necessario', ro.veiculo_necessario,
        'tipo_veiculo', ro.tipo_veiculo,
        'regiao', ro.regiao,
        'requisitos', ro.requisitos,
        'prazo_expiracao', ro.prazo_expiracao,
        'aceite_em', ro.aceite_em,
        'created_at', ro.created_at,
        'numero', os.numero,
        'tipo_operacao', os.tipo_operacao,
        'tipo_reversa', os.tipo_reversa,
        'data_programada', os.data_programada,
        'peso', os.peso,
        'volumes', os.volumes,
        'cubagem', os.cubagem,
        'carga_refrigerada', os.carga_refrigerada,
        'origem', os.origem,
        'destino', os.destino,
        'origem_endereco',
          CASE WHEN coleta.logradouro IS NOT NULL THEN
            CONCAT_WS(', ',
              NULLIF(coleta.logradouro, ''),
              NULLIF(coleta.numero, ''),
              NULLIF(coleta.bairro, ''),
              NULLIF(coleta.cidade, ''),
              NULLIF(coleta.uf, '')
            )
          ELSE NULL END,
        'cidade_coleta', coleta.cidade,
        'latitude_coleta', coleta.latitude,
        'longitude_coleta', coleta.longitude,
        'destino_endereco',
          CASE WHEN entrega.logradouro IS NOT NULL THEN
            CONCAT_WS(', ',
              NULLIF(entrega.logradouro, ''),
              NULLIF(entrega.numero, ''),
              NULLIF(entrega.bairro, ''),
              NULLIF(entrega.cidade, ''),
              NULLIF(entrega.uf, '')
            )
          ELSE NULL END,
        'cidade_destino', entrega.cidade,
        'observacoes', os.observacoes_gerais,
        'distancia_km', os.distancia_km
      )
      ORDER BY ro.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_oportunidades
  FROM public.rede_oportunidades ro
  JOIN public.ordens_servico os ON os.id = ro.os_id
  LEFT JOIN LATERAL (
    SELECT
      e->>'logradouro' AS logradouro,
      e->>'numero'    AS numero,
      e->>'bairro'    AS bairro,
      e->>'cidade'    AS cidade,
      e->>'uf'        AS uf,
      NULLIF(e->>'latitude', '')::numeric  AS latitude,
      NULLIF(e->>'longitude', '')::numeric AS longitude
    FROM jsonb_array_elements(COALESCE(os.enderecos, '[]'::jsonb)) AS e
    WHERE e->>'tipo' = 'coleta'
    ORDER BY COALESCE(NULLIF(e->>'sequencia', ''), '0')
    LIMIT 1
  ) coleta ON true
  LEFT JOIN LATERAL (
    SELECT
      e->>'logradouro' AS logradouro,
      e->>'numero'     AS numero,
      e->>'bairro'     AS bairro,
      e->>'cidade'     AS cidade,
      e->>'uf'         AS uf
    FROM jsonb_array_elements(COALESCE(os.enderecos, '[]'::jsonb)) AS e
    WHERE e->>'tipo' = 'entrega'
    ORDER BY COALESCE(NULLIF(e->>'sequencia', ''), '0')
    LIMIT 1
  ) entrega ON true
  WHERE ro.status IN ('publicada', 'visualizada', 'interessada')
    AND ro.prestador_aceite_id IS NULL
    AND (ro.prazo_expiracao IS NULL OR ro.prazo_expiracao >= now())
    AND (
      ro.regiao IS NULL OR ro.regiao = ''
      OR v_prestador.regiao_principal IS NULL
      OR v_prestador.regiao_principal ILIKE '%todas as capitais%'
      OR v_prestador.regiao_principal ILIKE '%' || ro.regiao || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(v_prestador.regioes_secundarias) rs
        WHERE rs ILIKE '%' || ro.regiao || '%'
      )
    )
    AND (
      COALESCE((ro.veiculo_necessario->>'tipo'), '') = ''
      OR EXISTS (
        SELECT 1 FROM unnest(v_veiculos_tipos) vt
        WHERE LOWER(vt) = LOWER((ro.veiculo_necessario->>'tipo'))
      )
    )
    AND (
      COALESCE((ro.veiculo_necessario->>'capacidade_kg')::numeric, 0) <= 0
      OR v_max_capacidade >= (ro.veiculo_necessario->>'capacidade_kg')::numeric
    )
    AND (
      COALESCE((ro.veiculo_necessario->>'termica'), '') <> 'refrigerado'
      OR v_prestador.aceita_refrigerada = true
    );

  RETURN jsonb_build_object(
    'success', true,
    'oportunidades', v_oportunidades,
    'total', jsonb_array_length(v_oportunidades)
  );
END;
$$;

COMMENT ON FUNCTION public.f_buscar_oportunidades_para_prestador(uuid) IS
  'CONEXAO-2027 3A/3B — Oportunidades abertas compatíveis. Bloqueia (retorna []) quando o prestador possui ocorrência de segurança aberta/em atendimento.';

GRANT EXECUTE ON FUNCTION public.f_buscar_oportunidades_para_prestador(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
