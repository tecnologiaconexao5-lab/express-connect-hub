-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — MISSÃO 133-D.2
--
-- Restaura a função f_buscar_operacoes_motorista com o cast ::text
-- que causava SQLSTATE 42883 (operator does not exist: uuid = text).
--
-- USAR SOMENTE SE a correção quebrar o App Motorista.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista(
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_operacoes JSONB;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
  END IF;
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid::text;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ae.id,
      'prestador_id', ae.prestador_id,
      'status', ae.status,
      'rota', ae.rota,
      'origem', ae.origem,
      'destino', ae.destino,
      'data_escala', ae.data_escala,
      'turno', ae.turno,
      'tipo_veiculo', ae.tipo_veiculo,
      'placa', ae.placa,
      'quantidade_paradas', ae.quantidade_paradas,
      'valor_repasse', ae.valor_repasse,
      'km_previstos', ae.km_previstos,
      'valor_km', ae.valor_km,
      'observacoes', ae.observacoes,
      'operation_mode', ae.operation_mode,
      'coleta_reversa', ae.coleta_reversa,
      'tenant_id', ae.tenant_id,
      'metadata', ae.metadata,
      'endereco_origem', ae.endereco_origem,
      'endereco_destino', ae.endereco_destino,
      'horario_saida', ae.horario_saida,
      'horario_retorno_previsto', ae.horario_retorno_previsto,
      'aceite_prestador', ae.aceite_prestador,
      'data_aceite', ae.data_aceite,
      'horario_inicio_real', ae.horario_inicio_real,
      'horario_fim_real', ae.horario_fim_real,
      'finalizada', ae.finalizada,
      'data_finalizacao', ae.data_finalizacao,
      'created_at', ae.created_at,
      'updated_at', ae.updated_at,
      'paradas', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'parada_id', rp.id,
              'sequencia', rp.sequencia,
              'destinatario', COALESCE(rp.destinatario, rp.cliente_nome, ''),
              'endereco', COALESCE(rp.endereco, ''),
              'logradouro', rp.logradouro,
              'numero', rp.numero,
              'complemento', rp.complemento,
              'bairro', rp.bairro,
              'cidade', rp.cidade,
              'uf', rp.uf,
              'cep', rp.cep,
              'referencia', rp.referencia,
              'latitude', rp.latitude,
              'longitude', rp.longitude,
              'portaria', rp.portaria,
              'doca', rp.doca,
              'procedimento_entrada', rp.procedimento_entrada,
              'procedimento_saida', rp.procedimento_saida,
              'contato_nome', rp.contato_nome,
              'contato_telefone', rp.contato_telefone,
              'pedido', rp.pedido,
              'nota_fiscal', rp.nota_fiscal,
              'peso', rp.peso,
              'volumes', rp.volumes,
              'prioridade', rp.prioridade,
              'janela_inicio', rp.janela_entrega,
              'instrucoes', rp.instrucoes,
              'status', rp.status,
              'data_prevista', rp.data_prevista
            )
            ORDER BY rp.sequencia
          )
          FROM public.rota_paradas rp
          WHERE rp.alocacao_id = ae.id
        ),
        '[]'::JSONB
      )
    )
    ORDER BY ae.data_escala DESC NULLS LAST, ae.created_at DESC
  ), '[]'::JSONB) INTO v_operacoes
  FROM public.alocacoes_escala ae
  WHERE ae.prestador_id = v_prestador_id
    AND (ae.status IS DISTINCT FROM 'cancelada')
    AND (ae.status IS DISTINCT FROM 'recusada');
  RETURN jsonb_build_object(
    'success', true,
    'operacoes', v_operacoes,
    'total', jsonb_array_length(v_operacoes)
  );
END;
$function$;

COMMENT ON FUNCTION public.f_buscar_operacoes_motorista IS
  'ROLLBACK M133-D.2 — Contém ::text que causa SQLSTATE 42883. Aplicar apenas se necessário restaurar comportamento anterior.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ATENÇÃO: Este rollback RESTAURA O BUG. Use apenas em emergência.
-- ═══════════════════════════════════════════════════════════════════════════════
