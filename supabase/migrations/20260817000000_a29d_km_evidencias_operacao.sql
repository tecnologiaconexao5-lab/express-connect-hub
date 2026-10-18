-- ═══════════════════════════════════════════════════════════════════════════════
-- A29-D — CORREÇÃO MÍNIMA + PAINEL KM NO TMS OFICIAL
-- Supabase: uwrvzsjtpgaifkktpepn  |  TMS: express-connect-hub
--
-- AUTORIZADO (somente isto):
--   1. UNIQUE(operation_id) em operation_km (com dedup prévio — produção tem
--      duplicatas: 38 linhas / 18 operation_id distintos).
--   2. RPC f_km_evidencias_operacao(UUID) — leitura de evidências de KM por OS:
--      OS → alocação via alocacoes_escala.ordem_servico_id;
--      operation_km por operation_id (uuid) = alocação;
--      operation_timeline_events.operation_id é TEXT → cast a.id::TEXT.
--
-- NÃO ALTERADO: tipos, FKs, RLS de operation_km/operation_timeline_events.
-- NÃO fabrica KM/foto: apenas leitura; a prova será física no Redmi.
-- Grants no padrão A27/A28 (tms032_hardening_rpc_grants): sem PUBLIC/anon.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DEDUP operation_km (mantém a linha mais completa por operation_id)
--    Critério: foto_km_final > km_final preenchido > updated_at > created_at > id.
--    NÃO insere/não fabrica dados — apenas remove duplicatas de teste/homologação.
-- ═══════════════════════════════════════════════════════════════════════════════
DELETE FROM public.operation_km okm
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY operation_id
           ORDER BY (foto_km_final_url IS NOT NULL) DESC,
                    (km_final IS NOT NULL) DESC,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id
         ) AS rn
  FROM public.operation_km
) r
WHERE r.id = okm.id AND r.rn > 1;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. UNIQUE(operation_id) em operation_km (se ainda não existir)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE UNIQUE INDEX IF NOT EXISTS operation_km_operation_id_key
  ON public.operation_km (operation_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RPC f_km_evidencias_operacao(UUID) — leitura (não fabrica nada)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.f_km_evidencias_operacao(
  p_os_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_os_numero text;
  v_alocacoes jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Guard via tenant_usuarios (usuário TMS ativo). Sem has_role/profiles/user_roles.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
    WHERE tu.user_id = v_uid AND tu.status = 'ativo'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SEM_PERMISSAO');
  END IF;

  IF p_os_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS_INVALIDA');
  END IF;

  SELECT numero INTO v_os_numero
  FROM public.ordens_servico
  WHERE id = p_os_id;

  -- OS → alocação (alocacoes_escala.ordem_servico_id). Cada alocação traz:
  --   km (operation_km por operation_id = alocação), tempos e timeline
  --   (operation_timeline_events.operation_id é TEXT → cast a.id::TEXT).
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'alocacao_id', a.id,
        'status', a.status,
        'finalizada', a.finalizada,
        'placa', a.placa,
        'tipo_veiculo', a.tipo_veiculo,
        'tempos', jsonb_build_object(
          'data_escala', a.data_escala,
          'data_aceite', a.data_aceite,
          'horario_inicio_real', a.horario_inicio_real,
          'horario_fim_real', a.horario_fim_real,
          'data_finalizacao', a.data_finalizacao,
          'tempo_total_minutos', a.tempo_total_minutos,
          'updated_at', a.updated_at
        ),
        'km', (
          SELECT jsonb_build_object(
            'km_inicial', km.km_inicial,
            'km_final', km.km_final,
            'km_rodado', COALESCE(km.km_rodado,
              CASE WHEN km.km_inicial IS NOT NULL AND km.km_final IS NOT NULL
                   THEN km.km_final - km.km_inicial END),
            'km_adicional', km.km_adicional,
            'valor_adicional_estimado', km.valor_adicional_estimado,
            'foto_km_inicial_url', km.foto_km_inicial_url,
            'foto_km_final_url', km.foto_km_final_url,
            'updated_at', km.updated_at
          )
          FROM public.operation_km km
          WHERE km.operation_id = a.id
          LIMIT 1
        ),
        'timeline', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'type', t.type,
                'title', t.title,
                'event_time', t.event_time,
                'metadata', t.metadata
              ) ORDER BY t.event_time ASC NULLS LAST, t.created_at ASC
            )
            FROM public.operation_timeline_events t
            WHERE t.operation_id = a.id::TEXT
          ),
          '[]'::jsonb
        )
      ) ORDER BY a.data_escala ASC, a.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_alocacoes
  FROM public.alocacoes_escala a
  WHERE a.ordem_servico_id = p_os_id;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', p_os_id,
    'os_numero', v_os_numero,
    'total_alocacoes', COALESCE(jsonb_array_length(v_alocacoes), 0),
    'alocacoes', v_alocacoes
  );
END;
$function$;

COMMENT ON FUNCTION public.f_km_evidencias_operacao(uuid) IS
  'A29-D — Evidências de KM (inicial/final/foto/percorrido) + horários/tempos de uma OS, agregadas pelas alocações. Guard via tenant_usuarios; OS→alocação via alocacoes_escala.ordem_servico_id; cast para operation_timeline_events.operation_id (TEXT). Somente leitura. Grants: authenticated + service_role.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Grants seguros (padrão A27/A28 — sem PUBLIC/anon)
-- ═══════════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.f_km_evidencias_operacao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_km_evidencias_operacao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_km_evidencias_operacao(uuid) TO authenticated, service_role;

COMMIT;
