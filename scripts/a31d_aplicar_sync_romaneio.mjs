// =============================================================================
// A31D — Aplicação controlada da sincronização Romaneio App→OS.
// Executa PARTE 1 (sync retroativa) + PARTE 2 (correção da RPC f_avancar_etapa)
// em PRODUÇÃO, dentro de transação com verificação pré/pós.
//
// NÃO executa a PARTE 3 (view) — mantém a view atual (espelho auto-updatable)
// para não quebrar escrita do App via view.
//
// Aditivo e idempotente: não apaga nada, não altera assinaturas, não cria
// tabelas/colunas. Apenas: (1) preenche ordens_servico.romaneio quando há
// OS vinculada + romaneio App; (2) passa a sincronizar na etapa
// romaneio_informado da RPC.
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const RPC_NOVA = `
CREATE OR REPLACE FUNCTION public.f_avancar_etapa_app_motorista(
  p_alocacao_id uuid,
  p_etapa text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL::text,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_alocacao RECORD;
  v_tenant_id UUID;
  v_os_id UUID;
  v_etapa_atual TEXT;
  v_ultima_idempotency TEXT;
  v_allowed BOOLEAN;
  v_app_meta JSONB;
  v_updated_meta JSONB;
  v_status_update TEXT;
  v_event_id UUID;
  v_evento_tipo TEXT;
  v_romaneio_app TEXT;
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

  SELECT ae.*,
    ae.metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
    ae.metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency
  INTO v_alocacao
  FROM public.alocacoes_escala ae
  WHERE ae.id = p_alocacao_id;

  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;

  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;

  v_tenant_id := v_alocacao.tenant_id;
  v_os_id := v_alocacao.ordem_servico_id;

  IF v_alocacao.status IN ('cancelada', 'recusada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_CANCELADA');
  END IF;

  IF v_alocacao.status = 'concluida' OR (v_alocacao.metadata->'app_motorista'->>'servico_finalizado')::BOOLEAN = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_FINALIZADA');
  END IF;

  v_etapa_atual := COALESCE(v_alocacao.etapa_atual, '');
  v_ultima_idempotency := COALESCE(v_alocacao.ultima_idempotency, '');

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' AND p_idempotency_key = v_ultima_idempotency THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Etapa já registrada (idempotente).',
      'etapa', p_etapa,
      'idempotent', true
    );
  END IF;

  v_allowed := false;

  IF v_etapa_atual = '' AND p_etapa = 'viagem_aceita' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'viagem_aceita' AND p_etapa = 'cheguei_coleta' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'cheguei_coleta' AND p_etapa = 'carregamento_iniciado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'carregamento_iniciado' AND p_etapa = 'carregamento_finalizado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'carregamento_finalizado' AND p_etapa IN ('romaneio_informado', 'foto_romaneio', 'km_inicial_informado', 'saiu_em_rota') THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'romaneio_informado' AND p_etapa IN ('foto_romaneio', 'km_inicial_informado') THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'foto_romaneio' AND p_etapa = 'km_inicial_informado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'km_inicial_informado' AND p_etapa = 'saiu_em_rota' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'saiu_em_rota' AND p_etapa = 'chegou_entrega' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'chegou_entrega' AND p_etapa = 'descarregamento_iniciado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'descarregamento_iniciado' AND p_etapa = 'descarga_finalizada' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'descarga_finalizada' AND p_etapa = 'km_final_informado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'km_final_informado' AND p_etapa = 'assinatura_capturada' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'assinatura_capturada' AND p_etapa = 'pod_registrado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'pod_registrado' AND p_etapa = 'servico_finalizado' THEN v_allowed := true; END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'TRANSICAO_INVALIDA',
      'message', format('Transição inválida: de "%s" para "%s"', v_etapa_atual, p_etapa),
      'etapa_atual', v_etapa_atual,
      'etapa_solicitada', p_etapa
    );
  END IF;

  IF p_etapa = 'servico_finalizado' THEN
    IF NOT (v_alocacao.metadata->'app_motorista'->>'pod_registrado')::BOOLEAN = true THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'FINALIZACAO_SEM_POD',
        'message', 'Operação não pode ser finalizada sem POD registrado.'
      );
    END IF;
  END IF;

  v_app_meta := COALESCE(v_alocacao.metadata->'app_motorista', '{}'::JSONB);
  v_app_meta := jsonb_set(v_app_meta, '{etapa_atual}', to_jsonb(p_etapa));
  v_app_meta := jsonb_set(v_app_meta, '{ultima_acao}', to_jsonb(p_etapa));
  v_app_meta := jsonb_set(v_app_meta, '{atualizado_por_app}', 'true'::JSONB);

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    v_app_meta := jsonb_set(v_app_meta, '{ultima_idempotency}', to_jsonb(p_idempotency_key));
  END IF;

  IF p_payload IS NOT NULL AND p_payload <> '{}'::JSONB THEN
    v_app_meta := v_app_meta || p_payload;
  END IF;

  v_updated_meta := COALESCE(v_alocacao.metadata, '{}'::JSONB);
  v_updated_meta := jsonb_set(v_updated_meta, '{app_motorista}', v_app_meta);

  v_status_update := NULL;
  IF p_etapa = 'viagem_aceita' THEN v_status_update := 'aceita';
  ELSIF p_etapa = 'cheguei_coleta' THEN v_status_update := 'em_rota';
  ELSIF p_etapa = 'servico_finalizado' THEN v_status_update := 'concluida';
  END IF;

  -- 10.1 A31-C/A31-D — Sincronizar romaneio para ordens_servico.romaneio
  v_romaneio_app := NULLIF(BTRIM(COALESCE(p_payload->>'romaneio', '')), '');
  IF p_etapa = 'romaneio_informado' AND v_os_id IS NOT NULL AND v_romaneio_app IS NOT NULL THEN
    UPDATE public.ordens_servico
    SET romaneio = v_romaneio_app,
        updated_at = NOW()
    WHERE id = v_os_id;
  END IF;

  UPDATE public.alocacoes_escala SET
    metadata = v_updated_meta,
    status = COALESCE(v_status_update, status),
    aceite_prestador = CASE WHEN p_etapa = 'viagem_aceita' THEN true ELSE aceite_prestador END,
    data_aceite = CASE WHEN p_etapa = 'viagem_aceita' THEN NOW() ELSE data_aceite END,
    horario_inicio_real = CASE WHEN p_etapa = 'cheguei_coleta' THEN NOW() ELSE horario_inicio_real END,
    horario_fim_real = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE horario_fim_real END,
    finalizada = CASE WHEN p_etapa = 'servico_finalizado' THEN true ELSE finalizada END,
    data_finalizacao = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE data_finalizacao END,
    updated_at = NOW()
  WHERE id = p_alocacao_id
    AND prestador_id = v_prestador_id;

  v_evento_tipo := CASE
    WHEN p_etapa = 'viagem_aceita' THEN 'operation_accepted'
    WHEN p_etapa = 'cheguei_coleta' THEN 'arrived_pickup'
    WHEN p_etapa = 'carregamento_iniciado' THEN 'loading_started'
    WHEN p_etapa = 'carregamento_finalizado' THEN 'loading_finished'
    WHEN p_etapa = 'romaneio_informado' THEN 'romaneio_informado'
    WHEN p_etapa = 'foto_romaneio' THEN 'romaneio_foto'
    WHEN p_etapa = 'km_inicial_informado' THEN 'km_registered'
    WHEN p_etapa = 'saiu_em_rota' THEN 'route_started'
    WHEN p_etapa = 'chegou_entrega' THEN 'arrived_delivery'
    WHEN p_etapa = 'descarregamento_iniciado' THEN 'unloading_started'
    WHEN p_etapa = 'descarga_finalizada' THEN 'unloading_finished'
    WHEN p_etapa = 'km_final_informado' THEN 'km_final'
    WHEN p_etapa = 'assinatura_capturada' THEN 'signature_captured'
    WHEN p_etapa = 'pod_registrado' THEN 'pod_sent'
    WHEN p_etapa = 'servico_finalizado' THEN 'operation_finished'
    ELSE p_etapa
  END;

  v_event_id := gen_random_uuid();
  INSERT INTO public.eventos_oficiais (
    id, tenant_id, event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility, payload, metadata,
    created_at, processed_at, version, retry_count
  ) VALUES (
    v_event_id,
    v_tenant_id,
    v_evento_tipo,
    'alocacao',
    p_alocacao_id,
    v_os_id::TEXT,
    COALESCE(v_status_update, 'em_andamento'),
    'app_motorista',
    v_prestador_id,
    'internal',
    jsonb_build_object(
      'etapa', p_etapa,
      'etapa_anterior', v_etapa_atual,
      'payload', p_payload,
      'idempotency_key', p_idempotency_key
    ),
    jsonb_build_object(
      'app_motorista', v_app_meta,
      'prestador_id', v_prestador_id
    ),
    NOW(),
    NULL,
    '1.0',
    0
  );

  INSERT INTO public.operation_timeline_events (
    id, operation_id, driver_id, type, title, metadata, event_time, created_at
  ) VALUES (
    v_event_id,
    p_alocacao_id::TEXT,
    v_prestador_id::TEXT,
    v_evento_tipo,
    p_etapa,
    jsonb_build_object('etapa', p_etapa, 'payload', p_payload),
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Etapa avançada com sucesso.',
    'etapa', p_etapa,
    'etapa_anterior', v_etapa_atual,
    'status', COALESCE(v_status_update, v_alocacao.status),
    'event_id', v_event_id,
    'idempotent', false,
    'romaneio_sync', CASE WHEN p_etapa = 'romaneio_informado' AND v_os_id IS NOT NULL AND v_romaneio_app IS NOT NULL THEN true ELSE false END
  );
END;
$function$;

COMMENT ON FUNCTION public.f_avancar_etapa_app_motorista IS
  'M133-D.4 + A31-D — Máquina de estados do App Motorista. VOLATILE. Romaneio sincronizado para ordens_servico.romaneio quando há OS vinculada.';

REVOKE EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista(uuid, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista(uuid, text, jsonb, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_avancar_etapa_app_motorista(uuid, text, jsonb, text, uuid) TO authenticated, service_role;
`;

const SYNC_RETROATIVA = `
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH romaneios AS (
    SELECT
      a.ordem_servico_id AS os_id,
      NULLIF(BTRIM(COALESCE(a.metadata->'app_motorista'->>'romaneio', '')), '') AS romaneio
    FROM public.alocacoes_escala a
    WHERE a.ordem_servico_id IS NOT NULL
      AND a.metadata ? 'app_motorista'
  ),
  alvo AS (
    SELECT DISTINCT ON (r.os_id)
      r.os_id,
      r.romaneio
    FROM romaneios r
    JOIN public.ordens_servico os ON os.id = r.os_id
    WHERE r.romaneio IS NOT NULL
      AND (os.romaneio IS NULL OR os.romaneio = '')
    ORDER BY r.os_id, r.romaneio
  ),
  atualizado AS (
    UPDATE public.ordens_servico os
    SET romaneio = a.romaneio,
        updated_at = NOW()
    FROM alvo a
    WHERE os.id = a.os_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated FROM atualizado;
  RAISE NOTICE 'A31-D: % OS atualizadas com romaneio do App', v_updated;
END $$;
`;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('=== VERIFICAÇÃO PRÉVIA ===');
  const antes = await c.query(`SELECT COUNT(*) AS n FROM public.ordens_servico WHERE NULLIF(BTRIM(romaneio),'') IS NOT NULL`);
  console.log('OS com romaneio antes:', antes.rows[0].n);
  const assinatura = await c.query(`SELECT pg_get_function_arguments(p.oid) AS args, prosecdef, provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_avancar_etapa_app_motorista'`);
  console.log('Assinatura RPC antes:', assinatura.rows[0].args);

  console.log('\n=== APLICANDO (transação) ===');
  await c.query('BEGIN');
  try {
    await c.query(SYNC_RETROATIVA);
    await c.query(RPC_NOVA);
    await c.query('COMMIT');
    console.log('COMMIT OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
    process.exit(1);
  }

  console.log('\n=== VERIFICAÇÃO PÓS ===');
  const depois = await c.query(`SELECT COUNT(*) AS n FROM public.ordens_servico WHERE NULLIF(BTRIM(romaneio),'') IS NOT NULL`);
  console.log('OS com romaneio depois:', depois.rows[0].n);
  const rpcDepois = await c.query(`SELECT pg_get_functiondef(p.oid) AS def, provolatile, prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_avancar_etapa_app_motorista'`);
  const def = rpcDepois.rows[0].def;
  console.log('RPC VOLATILE:', rpcDepois.rows[0].provolatile, '| SECURITY_DEFINER:', rpcDepois.rows[0].prosecdef);
  console.log('RPC contém bloco 10.1 (romaneio_sync)?', def.includes('romaneio_sync'));
  const grants = await c.query(`SELECT grantee FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='f_avancar_etapa_app_motorista' ORDER BY grantee`);
  console.log('Grants pós:', grants.rows.map(g => g.grantee).join(', '));
  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });