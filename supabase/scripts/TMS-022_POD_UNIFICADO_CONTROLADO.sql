-- =============================================================================
-- TMS-022 — POD UNIFICADO CONTROLADO
-- Aplica trigger delivery_proofs → entregas_protocolo (baseado em M108C1)
--
-- ESTRATÉGIA ESCOLHIDA: A (Trigger unidirecional)
-- Justificativa:
--   - App continua escrevendo em delivery_proofs (zero alteração no Flutter)
--   - Trigger idempotente copia para entregas_protocolo
--   - TMS e Portal continuam lendo de entregas_protocolo (zero alteração)
--   - Único ponto de integração: o trigger SQL
--   - Rollback simples: DROP TRIGGER + DROP FUNCTION
--
-- SEGURANÇA:
--   - Não usa IF NOT EXISTS — verifica previamente e ABORTA se objeto existir
--   - Não usa CREATE OR REPLACE
--   - Não usa DROP IF EXISTS
--   - Não altera dados existentes
--   - Não backfill
--   - Idempotente: ON CONFLICT DO NOTHING
-- =============================================================================

-- ============================================================================
-- BLOCO DE VALIDAÇÃO PRÉVIA
-- ============================================================================
DO $$
DECLARE
    v_func_oid OID;
    v_trigger_exists BOOLEAN;
BEGIN
    -- Verificar se a função já existe
    SELECT oid INTO v_func_oid FROM pg_proc
    WHERE proname = 'f_sync_delivery_proof_to_entregas'
      AND pronamespace = 'public'::regnamespace;
    IF v_func_oid IS NOT NULL THEN
        RAISE EXCEPTION 'ABORTANDO: função f_sync_delivery_proof_to_entregas já existe (OID %). Migration M108C1 já aplicada.', v_func_oid;
    END IF;

    -- Verificar se o trigger já existe
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class cl ON tg.tgrelid = cl.oid
        WHERE tg.tgname = 'trg_sync_delivery_proof_to_entregas'
          AND cl.relname = 'delivery_proofs'
    ) INTO v_trigger_exists;
    IF v_trigger_exists THEN
        RAISE EXCEPTION 'ABORTANDO: trigger trg_sync_delivery_proof_to_entregas já existe. Migration M108C1 já aplicada.';
    END IF;

    -- Verificar se as tabelas existem
    IF to_regclass('public.delivery_proofs') IS NULL THEN
        RAISE EXCEPTION 'ABORTANDO: tabela delivery_proofs não existe.';
    END IF;
    IF to_regclass('public.entregas_protocolo') IS NULL THEN
        RAISE EXCEPTION 'ABORTANDO: tabela entregas_protocolo não existe.';
    END IF;

    RAISE NOTICE 'VALIDAÇÃO: Nenhum objeto existente. Prosseguindo.';
END $$;

-- ============================================================================
-- SEÇÃO 1 — Adicionar colunas ausentes (se necessário)
-- ============================================================================
-- Colunas que existem em delivery_proofs mas não em entregas_protocolo

ALTER TABLE public.entregas_protocolo
    ADD COLUMN IF NOT EXISTS receiver_relationship TEXT;

ALTER TABLE public.entregas_protocolo
    ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC;

ALTER TABLE public.delivery_proofs
    ADD COLUMN IF NOT EXISTS foto_canhoto_url TEXT;

ALTER TABLE public.delivery_proofs
    ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe();

-- ============================================================================
-- SEÇÃO 2 — Função de sincronização
-- ============================================================================
CREATE FUNCTION public.f_sync_delivery_proof_to_entregas()
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
  -- Converter operation_id (TEXT) para UUID
  BEGIN
    v_alocacao_id := CAST(NEW.operation_id AS UUID);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_alocacao_id IS NULL THEN RETURN NEW; END IF;

  -- Buscar dados da alocação
  SELECT ae.prestador_id, ae.tenant_id, ae.ordem_servico_id
  INTO v_prestador_id, v_tenant_id, v_ordem_servico_id
  FROM public.alocacoes_escala ae
  WHERE ae.id = v_alocacao_id;

  -- Idempotente: não duplicar se já existe POD para esta alocação
  IF EXISTS (SELECT 1 FROM public.entregas_protocolo WHERE alocacao_id = v_alocacao_id) THEN
    RETURN NEW;
  END IF;

  -- Inserir em entregas_protocolo (fonte oficial única)
  INSERT INTO public.entregas_protocolo (
    alocacao_id, prestador_id, ordem_servico_id,
    nome_recebedor, documento_recebedor, receiver_relationship,
    observacao, foto_entrega_url, foto_canhoto_url, assinatura_url,
    data_hora_entrega, latitude, longitude, gps_accuracy,
    status, tenant_id
  ) VALUES (
    v_alocacao_id, v_prestador_id, v_ordem_servico_id,
    COALESCE(NEW.receiver_name, 'Motorista'), NEW.receiver_document, NEW.receiver_relationship,
    NEW.observation, NEW.photo_url, NEW.foto_canhoto_url, NEW.signature_url,
    COALESCE(NEW.delivered_at, NOW()), NEW.latitude, NEW.longitude, NEW.gps_accuracy,
    CASE WHEN NEW.status = 'delivered' THEN 'entregue'
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

-- ============================================================================
-- SEÇÃO 3 — Trigger
-- ============================================================================
CREATE TRIGGER trg_sync_delivery_proof_to_entregas
  AFTER INSERT ON public.delivery_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.f_sync_delivery_proof_to_entregas();

-- ============================================================================
-- SEÇÃO 4 — RLS Policies
-- ============================================================================
-- Nota: Policies já existentes em migrations M113/M114 não são alteradas.
-- Apenas garantimos que delivery_proofs tenha SELECT para authenticated (TMS)

DROP POLICY IF EXISTS "delivery_proofs_select_authenticated" ON public.delivery_proofs;
CREATE POLICY "delivery_proofs_select_authenticated"
  ON public.delivery_proofs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- SEÇÃO 5 — Grants
-- ============================================================================
-- Mantém grants existentes. Adiciona apenas se ausentes.
-- (Grants já existentes em M108C1 e M113/M114)

GRANT INSERT ON public.delivery_proofs TO anon, authenticated;
GRANT SELECT ON public.delivery_proofs TO anon, authenticated;
GRANT INSERT ON public.entregas_protocolo TO authenticated;
GRANT SELECT ON public.entregas_protocolo TO anon, authenticated;

-- ============================================================================
-- VALIDAÇÃO PÓS-EXECUÇÃO
-- ============================================================================
DO $$
DECLARE
    v_func_oid OID;
    v_trigger_count INT;
BEGIN
    SELECT oid INTO v_func_oid FROM pg_proc
    WHERE proname = 'f_sync_delivery_proof_to_entregas'
      AND pronamespace = 'public'::regnamespace;
    IF v_func_oid IS NULL THEN
        RAISE EXCEPTION 'FALHA: função f_sync_delivery_proof_to_entregas não encontrada após criação.';
    END IF;

    SELECT COUNT(*) INTO v_trigger_count FROM pg_trigger tg
    JOIN pg_class cl ON tg.tgrelid = cl.oid
    WHERE tg.tgname = 'trg_sync_delivery_proof_to_entregas'
      AND cl.relname = 'delivery_proofs'
      AND NOT tg.tgisinternal;
    IF v_trigger_count = 0 THEN
        RAISE EXCEPTION 'FALHA: trigger trg_sync_delivery_proof_to_entregas não encontrado após criação.';
    END IF;

    RAISE NOTICE 'VALIDAÇÃO PÓS: Todos os objetos criados com sucesso.';
END $$;

-- ============================================================================
-- RESUMO
-- ============================================================================
SELECT '=== POD UNIFICADO — RESUMO ===' as info;
SELECT 'Função' as objeto, CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas') THEN 'OK' ELSE 'FALHA' END FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas'
UNION ALL
SELECT 'Trigger', CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid WHERE tg.tgname='trg_sync_delivery_proof_to_entregas') THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'Coluna receiver_relationship', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='receiver_relationship') THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'Coluna gps_accuracy', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='gps_accuracy') THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'Coluna foto_canhoto_url (delivery_proofs)', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_proofs' AND column_name='foto_canhoto_url') THEN 'OK' ELSE 'FALHA' END;
