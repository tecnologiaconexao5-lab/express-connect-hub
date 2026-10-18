-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 108-I — NOC / TORRE DE CONTROLE ENTERPRISE
--
-- CORREÇÕES:
--   1. Fix FK operacao_localizacao: escala_operacional → alocacoes_escala
--   2. Add colunas faltantes (os_id, prestador_id, tenant_id, velocidade)
--   3. View consolidada para NOC (vw_noc_operacional)
--   4. Trigger para popular portal_tracking_realtime via RPC
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — Fix operacao_localizacao FK e colunas
-- =============================================================================
ALTER TABLE public.operacao_localizacao
  ADD COLUMN IF NOT EXISTS alocacao_id UUID;

ALTER TABLE public.operacao_localizacao
  ADD COLUMN IF NOT EXISTS os_id UUID;

ALTER TABLE public.operacao_localizacao
  ADD COLUMN IF NOT EXISTS prestador_id UUID;

ALTER TABLE public.operacao_localizacao
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe();

ALTER TABLE public.operacao_localizacao
  ADD COLUMN IF NOT EXISTS velocidade NUMERIC DEFAULT 0;

ALTER TABLE public.operacao_localizacao
  ADD COLUMN IF NOT EXISTS precisao NUMERIC DEFAULT 0;

-- Drop FK antiga para escala_operacional (deprecated)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operacao_localizacao_escala_id_fkey'
      AND conrelid = 'operacao_localizacao'::regclass
  ) THEN
    ALTER TABLE public.operacao_localizacao DROP CONSTRAINT operacao_localizacao_escala_id_fkey;
  END IF;
END $$;

-- =============================================================================
-- SEÇÃO 2 — Índices operacao_localizacao
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_alocacao ON public.operacao_localizacao(alocacao_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_prestador ON public.operacao_localizacao(prestador_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_os ON public.operacao_localizacao(os_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_tenant ON public.operacao_localizacao(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_created ON public.operacao_localizacao(created_at DESC);

-- =============================================================================
-- SEÇÃO 3 — RLS operacao_localizacao
-- =============================================================================
ALTER TABLE public.operacao_localizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oper_localizacao_select" ON public.operacao_localizacao;
CREATE POLICY "oper_localizacao_select" ON public.operacao_localizacao FOR SELECT
  TO authenticated USING (tenant_id = public.current_tenant_id_safe() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "oper_localizacao_insert" ON public.operacao_localizacao;
CREATE POLICY "oper_localizacao_insert" ON public.operacao_localizacao FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- =============================================================================
-- SEÇÃO 4 — View consolidada NOC
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_noc_operacional AS
SELECT
  ae.id as alocacao_id,
  ae.status as status_operacao,
  ae.prestador_id,
  COALESCE(p.nome_completo, 'N/I') as motorista_nome,
  COALESCE(p.telefone, '') as motorista_telefone,
  ae.tipo_veiculo,
  ae.placa,
  ae.cliente_id,
  COALESCE(c.nome_fantasia, c.razao_social, 'N/I') as cliente_nome,
  ae.origem,
  ae.destino,
  ae.data_escala,
  ae.km_previstos,
  ae.valor_frete as valor_cliente,
  ae.valor_repasse as valor_prestador,
  ae.valor_total,
  ae.aceite_prestador,
  ae.data_aceite,
  ae.finalizada,
  ae.data_finalizacao,
  ae.ordem_servico_id,
  os.numero as os_numero,
  os.tipo_operacao,
  os.tipo_reversa,
  ae.reversa_valor_cliente,
  ae.reversa_valor_prestador,
  ae.tipo_reversa as aloc_tipo_reversa,
  ae.reversa_status,
  ae.reversa_pod_url,
  ae.comprovante_url,
  ae.assinatura_url,
  CASE WHEN ae.comprovante_url IS NOT NULL OR ae.assinatura_url IS NOT NULL THEN true ELSE false END as tem_pod,
  ae.metadata,
  ae.created_at,
  ae.updated_at,
  ae.tenant_id,
  -- Tracking (última posição conhecida)
  ol.latitude as tracking_lat,
  ol.longitude as tracking_lng,
  ol.velocidade as tracking_velocidade,
  ol.precisao as tracking_precisao,
  ol.created_at as tracking_ultima_atualizacao,
  -- SLA
  CASE
    WHEN ae.status = 'em_rota' AND ae.data_escala IS NOT NULL
         AND ae.data_escala < CURRENT_DATE THEN 'atrasado'
    WHEN ae.status = 'em_rota' THEN 'em_dia'
    WHEN ae.status IN ('planejada', 'aguardando_aceite') AND ae.data_escala IS NOT NULL
         AND ae.data_escala < CURRENT_DATE THEN 'urgente'
    WHEN ae.status IN ('planejada', 'aguardando_aceite') THEN 'pendente'
    WHEN ae.status = 'aceita' THEN 'confirmado'
    WHEN ae.status = 'concluida' THEN 'concluido'
    ELSE ae.status
  END as sla_status,
  -- Alertas
  CASE
    WHEN ae.reversa_valor_cliente > 0 AND ae.reversa_status IS NULL THEN 'reversa_pendente'
    WHEN ae.finalizada = true AND ae.comprovante_url IS NULL AND ae.assinatura_url IS NULL THEN 'pod_pendente'
    WHEN ae.status = 'em_rota' AND ol.id IS NULL THEN 'sem_sinal_gps'
    ELSE NULL
  END as alerta
FROM public.alocacoes_escala ae
LEFT JOIN public.prestadores p ON p.id = ae.prestador_id
LEFT JOIN public.clientes c ON c.id = ae.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = ae.ordem_servico_id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, velocidade, precisao, created_at
  FROM public.operacao_localizacao
  WHERE alocacao_id = ae.id
  ORDER BY created_at DESC
  LIMIT 1
) ol ON true
WHERE ae.status NOT IN ('cancelada', 'recusada');

COMMENT ON VIEW public.vw_noc_operacional IS
  'M108I — View consolidada do NOC com alocacoes, tracking, SLA e alertas.';

-- =============================================================================
-- SEÇÃO 5 — Trigger: atualizar operacao_localizacao quando portal_tracking_realtime receber INSERT
-- (App Motorista envia para portal_tracking_realtime, este trigger replica para operacao_localizacao)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_sync_tracking_to_oper_localizacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prestador_id UUID;
  v_os_id UUID;
BEGIN
  -- Buscar prestador_id e os_id da alocacao
  SELECT ae.prestador_id, ae.ordem_servico_id
  INTO v_prestador_id, v_os_id
  FROM public.alocacoes_escala ae
  WHERE ae.id = NEW.alocacao_id;

  INSERT INTO public.operacao_localizacao (
    alocacao_id, os_id, prestador_id,
    latitude, longitude, velocidade, precisao,
    tenant_id, created_at
  ) VALUES (
    NEW.alocacao_id, v_os_id, v_prestador_id,
    NEW.latitude, NEW.longitude,
    NEW.velocidade, NEW.precisao,
    COALESCE(NEW.tenant_id, public.current_tenant_id_safe()),
    COALESCE(NEW.captured_at, NOW())
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tracking_to_oper_localizacao ON public.portal_tracking_realtime;
CREATE TRIGGER trg_sync_tracking_to_oper_localizacao
  AFTER INSERT ON public.portal_tracking_realtime
  FOR EACH ROW
  EXECUTE FUNCTION public.f_sync_tracking_to_oper_localizacao();

COMMENT ON FUNCTION public.f_sync_tracking_to_oper_localizacao IS
  'M108I — Sincroniza portal_tracking_realtime → operacao_localizacao para compatibilidade com PainelOperacionalMapa.';
