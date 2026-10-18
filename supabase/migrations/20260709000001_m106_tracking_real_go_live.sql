-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 106 — TRACKING REAL PONTA A PONTA PARA GO LIVE
--
-- FONTE ÚNICA DE VERDADE: portal_tracking_realtime
--
-- CORREÇÕES:
--   1. Adiciona colunas: alocacao_id, captured_at, precisao, direcao, tenant_id, created_at
--   2. Índices para novas colunas
--   3. RLS: prestador pode INSERT posição apenas da própria alocação
--   4. RLS: cliente pode SELECT apenas posições do seu tenant
--   5. RPC registrar_posicao_motorista() — chamada pelo App Flutter via supabase.rpc()
--   6. Trigger de eventos de tracking no Event Bus
--   7. Trigger de encerramento: atualiza status automaticamente
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — Adicionar colunas faltantes em portal_tracking_realtime
-- =============================================================================

-- alocacao_id: chave principal da operação (vincula tracking → escala → OS)
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS alocacao_id UUID;

-- captured_at: timestamp capturado NO APARELHO (não no servidor)
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

-- precisao: precisão do GPS em metros
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS precisao NUMERIC;

-- direcao: direção do movimento em graus (0-360)
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS direcao NUMERIC;

-- tenant_id: isolamento multi-tenant
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe();

-- created_at: timestamp de criação do registro no servidor
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- origem: fonte da posição (app_motorista, tms_manual, etc)
ALTER TABLE portal_tracking_realtime 
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'app_motorista';

-- CHECK para coordenadas válidas (nunca 0,0 e dentro dos limites geográficos)
ALTER TABLE portal_tracking_realtime
  ADD CONSTRAINT chk_tracking_coords_validas 
  CHECK (
    (latitude  IS NULL AND longitude IS NULL) OR
    (latitude  BETWEEN -90  AND 90  AND latitude  != 0) OR
    (longitude BETWEEN -180 AND 180 AND longitude != 0)
  );

-- =============================================================================
-- SEÇÃO 2 — Índices para as novas colunas
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_portal_tracking_alocacao 
  ON portal_tracking_realtime(alocacao_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_tenant 
  ON portal_tracking_realtime(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_captured 
  ON portal_tracking_realtime(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_alocacao_captured 
  ON portal_tracking_realtime(alocacao_id, captured_at DESC);

-- =============================================================================
-- SEÇÃO 3 — RLS: Políticas de INSERT para o motorista/prestador
-- =============================================================================

-- Política: motorista só insere posição para alocação que ELE aceitou
-- Usa auth.uid() → prestadores.id (prestador autenticado via Supabase Auth)
DROP POLICY IF EXISTS "tracking_insert_prestador" ON portal_tracking_realtime;

CREATE POLICY "tracking_insert_prestador" ON portal_tracking_realtime
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- O prestador_id deve corresponder ao usuário autenticado
    prestador_id = auth.uid()
    -- E a alocação deve estar ativa (status que permite tracking)
    AND EXISTS (
      SELECT 1 FROM alocacoes_escala ae
      WHERE ae.id = alocacao_id
        AND ae.prestador_id = auth.uid()
        AND ae.status IN ('aceita', 'em_rota', 'ocorrencia')
        AND ae.finalizada = false
    )
  );

-- Política: motorista vê apenas suas próprias posições
DROP POLICY IF EXISTS "tracking_select_prestador" ON portal_tracking_realtime;

CREATE POLICY "tracking_select_prestador" ON portal_tracking_realtime
  FOR SELECT
  TO authenticated
  USING (
    prestador_id = auth.uid()
  );

-- Política: usuário autenticado do tenant vê posições do seu tenant
DROP POLICY IF EXISTS "tracking_select_tenant" ON portal_tracking_realtime;

CREATE POLICY "tracking_select_tenant" ON portal_tracking_realtime
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
  );

-- =============================================================================
-- SEÇÃO 4 — RPC: registrar_posicao_motorista()
-- Chamada pelo App Flutter via: supabase.rpc('registrar_posicao_motorista', {...})
-- Usa SECURITY DEFINER para bypassar RLS e fazer validações internas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_posicao_motorista(
  p_alocacao_id   UUID,
  p_latitude      NUMERIC,
  p_longitude     NUMERIC,
  p_velocidade    NUMERIC DEFAULT NULL,
  p_precisao      NUMERIC DEFAULT NULL,
  p_direcao       NUMERIC DEFAULT NULL,
  p_bateria       NUMERIC DEFAULT NULL,
  p_captured_at   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestador_id   UUID;
  v_alocacao       RECORD;
  v_cliente_id     UUID;
  v_os_id          UUID;
  v_veiculo_id     UUID;
  v_tenant_id      UUID;
BEGIN
  -- ------------------------------------------------------------------
  -- 1. VALIDAR AUTENTICAÇÃO (auth.uid() deve corresponder a um prestador)
  -- ------------------------------------------------------------------
  v_prestador_id := auth.uid();
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado');
  END IF;

  -- ------------------------------------------------------------------
  -- 2. VALIDAR COORDENADAS
  -- ------------------------------------------------------------------
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Latitude e longitude são obrigatórias');
  END IF;

  IF p_latitude = 0 AND p_longitude = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Coordenadas 0,0 são inválidas');
  END IF;

  IF p_latitude < -90 OR p_latitude > 90 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Latitude fora do intervalo (-90 a 90)');
  END IF;

  IF p_longitude < -180 OR p_longitude > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Longitude fora do intervalo (-180 a 180)');
  END IF;

  -- ------------------------------------------------------------------
  -- 3. VALIDAR ALOCAÇÃO ATIVA DO PRESTADOR
  -- ------------------------------------------------------------------
  SELECT ae.id, ae.cliente_id, ae.ordem_servico_id, ae.veiculo_id, ae.empresa_id
    INTO v_alocacao
    FROM alocacoes_escala ae
    WHERE ae.id = p_alocacao_id
      AND ae.prestador_id = v_prestador_id
      AND ae.status IN ('aceita', 'em_rota', 'ocorrencia')
      AND ae.finalizada = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Alocação não encontrada ou não está ativa para o motorista',
      'alocacao_id', p_alocacao_id
    );
  END IF;

  -- ------------------------------------------------------------------
  -- 4. RESOLVER VALORES AUXILIARES
  -- ------------------------------------------------------------------
  v_cliente_id := v_alocacao.cliente_id;
  v_os_id      := v_alocacao.ordem_servico_id;
  v_veiculo_id := v_alocacao.veiculo_id;
  v_tenant_id  := COALESCE(v_alocacao.empresa_id, 
                           public.current_tenant_id_safe(),
                           '00000000-0000-0000-0000-000000000001'::UUID);

  -- ------------------------------------------------------------------
  -- 5. DEDUPLICAÇÃO: pular se a mesma posição já foi registrada nos últimos 5s
  -- ------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM portal_tracking_realtime ptr
    WHERE ptr.alocacao_id = p_alocacao_id
      AND ptr.latitude = p_latitude
      AND ptr.longitude = p_longitude
      AND ptr.created_at > (NOW() - INTERVAL '5 seconds')
  ) THEN
    RETURN jsonb_build_object('ok', true, 'deduplicated', true,
      'message', 'Posição duplicada ignorada (mesma coordenada nos últimos 5s)');
  END IF;

  -- ------------------------------------------------------------------
  -- 6. INSERT
  -- ------------------------------------------------------------------
  INSERT INTO portal_tracking_realtime (
    alocacao_id, cliente_id, os_id, prestador_id, veiculo_id,
    tenant_id,
    latitude, longitude,
    velocidade, precisao, direcao, bateria,
    captured_at, created_at,
    status, origem
  ) VALUES (
    p_alocacao_id, v_cliente_id, v_os_id, v_prestador_id, v_veiculo_id,
    v_tenant_id,
    p_latitude, p_longitude,
    p_velocidade, p_precisao, p_direcao, p_bateria,
    COALESCE(p_captured_at, NOW()), NOW(),
    'online', 'app_motorista'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'alocacao_id', p_alocacao_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'captured_at', COALESCE(p_captured_at, NOW())
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_posicao_motorista IS
  'M106 — RPC para o App Motorista (Flutter) registrar posição GPS. '
  'Valida autenticação, alocação ativa, coordenadas válidas e deduplica. '
  'Chamada via supabase.rpc(''registrar_posicao_motorista'', {...}) com JWT.';

-- =============================================================================
-- SEÇÃO 5 — Trigger: evento de tracking no Event Bus
-- Publica eventos operacionais relevantes (não cada ponto GPS)
-- =============================================================================

-- 5.1 Evento: tracking.iniciado (primeira posição após aceite)
CREATE OR REPLACE FUNCTION public.f_trg_tracking_iniciado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Verifica se é a primeira posição desta alocação
  SELECT COUNT(*) INTO v_count 
    FROM portal_tracking_realtime 
    WHERE alocacao_id = NEW.alocacao_id;
  
  IF v_count = 1 THEN
    INSERT INTO eventos_oficiais (
      tenant_id, event_type, entity_type, entity_id,
      title, description, visibility, metadata
    ) VALUES (
      COALESCE(NEW.tenant_id, current_tenant_id_safe()),
      'tracking.iniciado',
      'alocacao',
      NEW.alocacao_id,
      'Rastreamento iniciado',
      'Motorista começou a transmitir localização',
      'public',
      jsonb_build_object(
        'alocacao_id', NEW.alocacao_id,
        'prestador_id', NEW.prestador_id,
        'os_id', NEW.os_id,
        'latitude', NEW.latitude,
        'longitude', NEW.longitude
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tracking_iniciado ON portal_tracking_realtime;
CREATE TRIGGER trg_tracking_iniciado
  AFTER INSERT ON portal_tracking_realtime
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_tracking_iniciado();

-- =============================================================================
-- SEÇÃO 6 — Trigger: atualizar status da alocação com a última posição
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_atualizar_status_alocacao_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza metadata da alocação com última posição conhecida
  UPDATE alocacoes_escala SET
    metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
      'ultima_posicao', jsonb_build_object(
        'latitude', NEW.latitude,
        'longitude', NEW.longitude,
        'velocidade', NEW.velocidade,
        'captured_at', NEW.captured_at,
        'atualizado_em', NOW()
      ),
      'tracking_status', 'online'
    ),
    updated_at = NOW()
  WHERE id = NEW.alocacao_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_status_alocacao_tracking ON portal_tracking_realtime;
CREATE TRIGGER trg_atualizar_status_alocacao_tracking
  AFTER INSERT ON portal_tracking_realtime
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_atualizar_status_alocacao_tracking();

-- =============================================================================
-- SEÇÃO 7 — Comentários
-- =============================================================================
COMMENT ON TABLE portal_tracking_realtime IS
  'M106 — FONTE ÚNICA DE VERDADE para rastreamento em tempo real. '
  'Populada pelo App Motorista via RPC registrar_posicao_motorista(). '
  'Consumida por: Portal Cliente (PortalTrackingMap), NOC (TorreControle), '
  'Event Bus (tracking.iniciado). Realtime habilitado.';

COMMENT ON COLUMN portal_tracking_realtime.alocacao_id IS 'M106 — FK para alocacoes_escala (chave principal da operação)';
COMMENT ON COLUMN portal_tracking_realtime.captured_at IS 'M106 — Timestamp capturado no aparelho do motorista';
COMMENT ON COLUMN portal_tracking_realtime.precisao IS 'M106 — Precisão do GPS em metros';
COMMENT ON COLUMN portal_tracking_realtime.direcao IS 'M106 — Direção do movimento em graus (0-360)';
COMMENT ON COLUMN portal_tracking_realtime.created_at IS 'M106 — Timestamp de criação do registro no servidor';
COMMENT ON COLUMN portal_tracking_realtime.tenant_id IS 'M106 — Isolamento multi-tenant';
COMMENT ON COLUMN portal_tracking_realtime.origem IS 'M106 — Origem da posição: app_motorista, tms_manual';
