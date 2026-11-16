-- ============================================================================
-- LOTE 3 — APP PRESTADOR x TMS
--
-- BUG 1: ao aceitar o serviço no App, `f_atualizar_etapa_app` grava
--        `aceite_prestador = true` e `alocacoes_escala.status = 'aceita'`,
--        mas NÃO atualiza o status da OS (`ordens_servico.status`), que
--        continuava "Pendente" na Torre/lista de OS.
--
-- CORREÇÃO: trigger idempotente em `alocacoes_escala`. Sempre que o aceite do
-- prestador transicionar para TRUE, a OS vinculada passa de
-- rascunho/em_analise/pendente para 'agendada' (rótulo "Alocado" no TMS).
-- Não sobrescreve estados posteriores (em_andamento, em_rota, finalizada etc.).
--
-- BUG 2: o App exibia "Veículo não especificado" quando
--        `alocacoes_escala.tipo_veiculo` estava vazio, embora a OS já tivesse
--        `ordens_servico.veiculo_tipo`/`tipo_veiculo` gravado.
--
-- CORREÇÃO: `f_buscar_operacoes_motorista` passa a devolver o tipo de veículo
-- da OS como fallback, além do tipo da alocação.
--
-- IMPORTANTE: migration NÃO executada por este lote. Aplicar somente com
-- autorização explícita de produção.
-- Rollback: 20261109010000_lote3_aceite_os_alocado_veiculo_rollback.sql
-- ============================================================================

-- ============================================================================
-- 1. Sincronização de status da OS no aceite do prestador
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_lote3_sync_os_status_on_aceite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.aceite_prestador IS TRUE
     AND (OLD.aceite_prestador IS DISTINCT FROM TRUE)
     AND NEW.ordem_servico_id IS NOT NULL THEN
    UPDATE public.ordens_servico
       SET status = CASE
             WHEN status IN ('rascunho', 'em_analise', 'pendente') THEN 'agendada'
             ELSE status
           END,
           updated_at = NOW()
     WHERE id = NEW.ordem_servico_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lote3_sync_os_status_on_aceite
  ON public.alocacoes_escala;

CREATE TRIGGER trg_lote3_sync_os_status_on_aceite
  AFTER UPDATE OF aceite_prestador ON public.alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_lote3_sync_os_status_on_aceite();

-- ============================================================================
-- 2. f_buscar_operacoes_motorista — fallback do tipo de veículo da OS
--    (base: 20260926000002_app_e2e04_contrato_os_romaneio_cliente.sql)
-- ============================================================================
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
  WHERE auth_user_id = v_authenticated_uid;
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
      'tipo_veiculo', COALESCE(
        NULLIF(ae.tipo_veiculo, ''),
        NULLIF(os.veiculo_tipo, ''),
        NULLIF(os.tipo_veiculo, '')
      ),
      'placa', COALESCE(NULLIF(ae.placa, ''), NULLIF(os.placa_alocada, '')),
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
      'os_id', ae.ordem_servico_id,
      'os_numero', os.numero,
      'romaneio', ae.metadata -> 'app_motorista' ->> 'romaneio',
      'cliente_id', ae.cliente_id,
      'cliente_nome', COALESCE(c.nome_fantasia, c.razao_social),
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
  LEFT JOIN public.ordens_servico os ON os.id = ae.ordem_servico_id
  LEFT JOIN public.clientes c ON c.id = ae.cliente_id
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

REVOKE EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista(uuid) TO authenticated, service_role;
