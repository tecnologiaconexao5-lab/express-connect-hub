-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 108-C1 — POD OFICIAL ÚNICO: Integração App → TMS → Portal Cliente
--
-- DECISÃO: entregas_protocolo é a fonte oficial única de POD.
-- Estratégia: trigger unidirecional delivery_proofs → entregas_protocolo
--   (1) Sempre que o App Flutter salva POD em delivery_proofs
--   (2) O trigger copia para entregas_protocolo com mapeamento de campos
--   (3) O trigger existente trg_evento_pod_enviado publica evento no Event Bus
--   (4) Portal Cliente e TMS continuam lendo de entregas_protocolo (sem alteração)
--
-- IDEMPOTENTE: Pode executar N vezes no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — Adicionar colunas ausentes em entregas_protocolo
-- (campos que existem em delivery_proofs mas não na tabela oficial)
-- =============================================================================

ALTER TABLE public.entregas_protocolo
  ADD COLUMN IF NOT EXISTS receiver_relationship TEXT;

ALTER TABLE public.entregas_protocolo
  ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC;

-- =============================================================================
-- SEÇÃO 2 — Adicionar coluna ausente em delivery_proofs
-- (foto_canhoto_url existe em entregas_protocolo mas não em delivery_proofs)
-- =============================================================================

ALTER TABLE public.delivery_proofs
  ADD COLUMN IF NOT EXISTS foto_canhoto_url TEXT;

ALTER TABLE public.delivery_proofs
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe();

-- =============================================================================
-- SEÇÃO 3 — Índices para join delivery_proofs → alocacoes_escala
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_operation_id
  ON public.delivery_proofs(operation_id);

CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_alocacao_id_tenant
  ON public.entregas_protocolo(alocacao_id, tenant_id);

-- =============================================================================
-- SEÇÃO 4 — Trigger de sincronização: delivery_proofs → entregas_protocolo
--
-- Fluxo:
--   App Flutter INSERT em delivery_proofs
--     → trigger dispara
--     → busca alocacao_id = CAST(operation_id AS UUID)
--     → busca prestador_id e tenant_id de alocacoes_escala
--     → INSERT em entregas_protocolo (idempotente: skips if alocacao_id exists)
--     → trigger M104 trg_evento_pod_enviado dispara
--     → Event Bus: 'entrega.comprovante.pod_enviado'
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_sync_delivery_proof_to_entregas()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_alocacao_id UUID;
  v_prestador_id UUID;
  v_tenant_id UUID;
  v_ordem_servico_id UUID;
BEGIN
  -- operation_id em delivery_proofs é TEXT contendo o UUID de alocacoes_escala
  BEGIN
    v_alocacao_id := CAST(NEW.operation_id AS UUID);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_alocacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar prestador_id, tenant_id e ordem_servico_id da alocação
  SELECT ae.prestador_id, ae.tenant_id, ae.ordem_servico_id
  INTO v_prestador_id, v_tenant_id, v_ordem_servico_id
  FROM public.alocacoes_escala ae
  WHERE ae.id = v_alocacao_id;

  -- Idempotente: se já existe POD para esta alocação, não duplicar
  IF EXISTS (
    SELECT 1 FROM public.entregas_protocolo
    WHERE alocacao_id = v_alocacao_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Inserir em entregas_protocolo (fonte oficial única)
  INSERT INTO public.entregas_protocolo (
    alocacao_id,
    prestador_id,
    ordem_servico_id,
    nome_recebedor,
    documento_recebedor,
    receiver_relationship,
    observacao,
    foto_entrega_url,
    foto_canhoto_url,
    assinatura_url,
    data_hora_entrega,
    latitude,
    longitude,
    gps_accuracy,
    status,
    tenant_id
  ) VALUES (
    v_alocacao_id,
    v_prestador_id,
    v_ordem_servico_id,
    COALESCE(NEW.receiver_name, 'Motorista'),
    NEW.receiver_document,
    NEW.receiver_relationship,
    NEW.observation,
    NEW.photo_url,
    NEW.foto_canhoto_url,
    NEW.signature_url,
    COALESCE(NEW.delivered_at, NOW()),
    NEW.latitude,
    NEW.longitude,
    NEW.gps_accuracy,
    CASE
      WHEN NEW.status = 'delivered' THEN 'entregue'
      WHEN NEW.status = 'delivered_with_note' THEN 'entregue_ressalva'
      WHEN NEW.status = 'not_delivered' THEN 'nao_entregue'
      ELSE COALESCE(NEW.status, 'entregue')
    END,
    COALESCE(v_tenant_id, NEW.tenant_id, public.current_tenant_id_safe())
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Registrar trigger na tabela delivery_proofs
DROP TRIGGER IF EXISTS trg_sync_delivery_proof_to_entregas ON public.delivery_proofs;

CREATE TRIGGER trg_sync_delivery_proof_to_entregas
  AFTER INSERT ON public.delivery_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.f_sync_delivery_proof_to_entregas();

-- =============================================================================
-- SEÇÃO 5 — RLS: delivery_proofs já tem policies para app motorista.
-- Adicionar policy para authenticated (TMS) poder ler.
-- =============================================================================

DROP POLICY IF EXISTS "delivery_proofs_select_authenticated" ON public.delivery_proofs;

CREATE POLICY "delivery_proofs_select_authenticated"
  ON public.delivery_proofs FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- SEÇÃO 6 — Garantir que entregas_protocolo tenha RLS nativa
-- (já protegida via views portal_cliente_pods_view, mas ter policy direta ajuda)
-- =============================================================================

ALTER TABLE public.entregas_protocolo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entregas_protocolo_select_authenticated" ON public.entregas_protocolo;

CREATE POLICY "entregas_protocolo_select_authenticated"
  ON public.entregas_protocolo FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
    OR tenant_id IS NULL
  );

DROP POLICY IF EXISTS "entregas_protocolo_insert_authenticated" ON public.entregas_protocolo;

CREATE POLICY "entregas_protocolo_insert_authenticated"
  ON public.entregas_protocolo FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_safe()
    OR tenant_id IS NULL
  );

-- =============================================================================
-- SEÇÃO 7 — Garantir que delivery_proofs tenha tenant_id FK opcional
-- e que a tabela exista (segurança para ambientes onde a migration do app
-- pode não ter sido executada ainda)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id TEXT,
  operation_id TEXT,
  driver_id TEXT,
  receiver_name TEXT NOT NULL,
  receiver_document TEXT,
  receiver_relationship TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  photo_url TEXT,
  signature_url TEXT,
  foto_canhoto_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,
  observation TEXT,
  delivered_at TIMESTAMPTZ,
  tenant_id UUID DEFAULT public.current_tenant_id_safe(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- =============================================================================
-- SEÇÃO 8 — GRANTs
-- =============================================================================

GRANT INSERT ON public.delivery_proofs TO anon, authenticated;
GRANT SELECT ON public.delivery_proofs TO anon, authenticated;
GRANT INSERT ON public.entregas_protocolo TO authenticated;
GRANT SELECT ON public.entregas_protocolo TO anon, authenticated;
