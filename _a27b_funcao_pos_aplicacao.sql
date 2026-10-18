-- Evidencia A27-B: f_buscar_oportunidades_para_prestador (pos-aplicacao)
CREATE OR REPLACE FUNCTION public.f_buscar_oportunidades_para_prestador(p_prestador_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prestador public.prestadores%ROWTYPE;
  v_veiculos_tipos text[];
  v_max_capacidade numeric;
  v_oportunidades jsonb;
BEGIN
  -- Valida o prestador requisitante (cadastro real).
  SELECT * INTO v_prestador
  FROM public.prestadores
  WHERE id = p_prestador_uuid AND status = 'ativo';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRESTADOR_NAO_ENCONTRADO',
      'oportunidades', '[]'::jsonb
    );
  END IF;

  -- Veículos ativos do prestador (compatibilidade de tipo e capacidade).
  SELECT
    COALESCE(
      array_agg(DISTINCT v.tipo_veiculo)
        FILTER (WHERE v.tipo_veiculo IS NOT NULL AND v.tipo_veiculo <> ''),
      '{}'::text[]
    ),
    COALESCE(MAX(v.capacidade_kg), 0)
  INTO v_veiculos_tipos, v_max_capacidade
  FROM public.veiculos v
  WHERE v.prestador_vinculado = p_prestador_uuid
    AND v.status = 'Ativo';

  -- Oportunidades abertas compatíveis + dados exibíveis da OS.
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
        -- Dados da OS (somente exibíveis — NUNCA valor_cliente/margem/custos).
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
    -- Compatibilidade de região (quando a oportunidade define região).
    -- "Todas as capitais" no cadastro é tratado como curinga. Região do
    -- prestador ausente também não restringe (cadastro incompleto).
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
    -- Compatibilidade de veículo (tipo exigido pertence aos veículos do
    -- prestador). Taxonomia única compartilhada (TIPOS_VEICULO no TMS);
    -- comparação case-insensitive (dados reais têm "VUC"/"vuc"/"fiorino").
    AND (
      COALESCE((ro.veiculo_necessario->>'tipo'), '') = ''
      OR EXISTS (
        SELECT 1 FROM unnest(v_veiculos_tipos) vt
        WHERE LOWER(vt) = LOWER((ro.veiculo_necessario->>'tipo'))
      )
    )
    -- Capacidade suportada.
    AND (
      COALESCE((ro.veiculo_necessario->>'capacidade_kg')::numeric, 0) <= 0
      OR v_max_capacidade >= (ro.veiculo_necessario->>'capacidade_kg')::numeric
    )
    -- Carga refrigerada.
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
$function$

