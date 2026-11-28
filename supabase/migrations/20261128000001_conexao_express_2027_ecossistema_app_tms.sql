-- ============================================================================
-- CONEXÃO EXPRESS 2027 — PARTE 3A
-- CONTRATO DE DADOS INTEGRADO (SUPABASE: TMS ↔ APP PRESTADOR)
--
-- Migration idempotente de alinhamento App Flutter ↔ Supabase sem quebrar o TMS.
-- NÃO aplicar automaticamente: validar em transação (BEGIN; ... ROLLBACK;).
--
-- PRINCÍPIOS APLICADOS
--   * Nenhuma coluna/tabela existente é renomeada ou removida.
--   * Estruturas novas com RLS habilitada e políticas restritivas:
--       - staff interno  -> f_app_is_staff()
--       - prestador      -> prestadores.auth_user_id = auth.uid() (f_app_prestador_id())
--       - cliente portal -> usuarios_cliente.auth_user_id = auth.uid() (f_app_cliente_id())
--   * Compatibilidade com o TMS Web: RPCs já usadas por operacaoChatService.ts
--     (f_enviar_mensagem_torre / f_marcar_mensagens_lidas_app com p_alocacao_id)
--     são PRESERVADAS; os contratos do App entram como OVERLOADS.
--   * Compatibilidade com triggers existentes (ex.: trg_rp_derivar_prestador e
--     trg_eventos_oficiais_updated_at) é respeitada.
--
-- Referências de auditoria:
--   docs/auditoria_conexao_express_2027/AUDITORIA_TMS.md
--   AUDITORIA_APP_PRESTADOR.md (não presente no repositório no momento da
--   geração; a especificação técnica desta missão foi usada como contrato).
-- ============================================================================

-- ============================================================================
-- 0. HELPERS DE IDENTIDADE DO APP (SECURITY DEFINER, sem RLS recursiva)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_app_prestador_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.prestadores p
  WHERE p.auth_user_id = auth.uid()
    AND LOWER(COALESCE(p.status, 'ativo')) = 'ativo'
  ORDER BY p.created_at NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.f_app_cliente_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT uc.cliente_id
  FROM public.usuarios_cliente uc
  WHERE uc.auth_user_id = auth.uid()
    AND uc.ativo = true
  ORDER BY uc.created_at NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.f_app_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_usuarios tu
    WHERE tu.user_id = auth.uid()
      AND tu.status = 'ativo'
      AND tu.papel NOT IN ('cliente', 'prestador', 'motorista')
  );
$$;

COMMENT ON FUNCTION public.f_app_prestador_id() IS 'CONEXAO-2027 3A — prestador do usuário autenticado (auth_user_id) para RLS do App.';
COMMENT ON FUNCTION public.f_app_cliente_id() IS 'CONEXAO-2027 3A — cliente do usuário autenticado (Portal Cliente) para RLS.';
COMMENT ON FUNCTION public.f_app_is_staff() IS 'CONEXAO-2027 3A — staff TMS interno (tenant_usuarios ativo, exceto cliente/prestador/motorista).';

GRANT EXECUTE ON FUNCTION public.f_app_prestador_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_app_cliente_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_app_is_staff() TO authenticated, service_role;

-- ============================================================================
-- BLOCO 1 — CORREÇÃO DOS BLOQUEIOS P0 DE INTEGRAÇÃO COM O APP
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Compatibilidade de notificações do App (eventos_oficiais)
--
-- A tabela eventos_oficiais não possui prestador_id. A derivação usa payload
-- (prestador_id/driver_id), entity_type='prestador' e a alocação da OS.
--
-- IMPORTANTE: o trigger existente trg_eventos_oficiais_updated_at faz
-- NEW.processed_at = now() em QUALQUER UPDATE. Para não remover eventos da
-- fila do eventProcessorWorker, o estado "lida" do App é persistido em tabela
-- dedicada (app_notificacoes_lidas). A view expõe:
--   visualizada = (status = 'lida') OR (existe leitura registrada)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_notificacoes_lidas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id    uuid NOT NULL REFERENCES public.eventos_oficiais(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  lida_em      timestamptz NOT NULL DEFAULT now(),
  tenant_id    uuid DEFAULT public.current_tenant_id_safe()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_notificacoes_lidas_evento_prestador
  ON public.app_notificacoes_lidas (evento_id, prestador_id);
CREATE INDEX IF NOT EXISTS idx_app_notificacoes_lidas_prestador
  ON public.app_notificacoes_lidas (prestador_id, lida_em DESC);

ALTER TABLE public.app_notificacoes_lidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_nl_staff" ON public.app_notificacoes_lidas;
CREATE POLICY "app2027_nl_staff" ON public.app_notificacoes_lidas
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_nl_prestador_own" ON public.app_notificacoes_lidas;
CREATE POLICY "app2027_nl_prestador_own" ON public.app_notificacoes_lidas
  FOR ALL TO authenticated
  USING (prestador_id = public.f_app_prestador_id())
  WITH CHECK (prestador_id = public.f_app_prestador_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_notificacoes_lidas TO authenticated;
GRANT ALL ON public.app_notificacoes_lidas TO service_role;

CREATE OR REPLACE VIEW public.vw_app_notificacoes_prestador
WITH (security_invoker = true) AS
SELECT
  e.id,
  d.prestador_id,
  e.event_type                         AS tipo,
  COALESCE(e.payload->>'titulo', e.payload->>'title', e.event_type)          AS titulo,
  COALESCE(e.payload->>'mensagem', e.payload->>'message', e.payload->>'descricao') AS mensagem,
  d.os_id,
  (e.status = 'lida' OR nl.id IS NOT NULL)                                    AS visualizada,
  e.payload                            AS dados,
  e.created_at
FROM public.eventos_oficiais e
CROSS JOIN LATERAL (
  SELECT
    COALESCE(
      public.try_cast_uuid(e.payload->>'prestador_id'),
      public.try_cast_uuid(e.payload->>'driver_id'),
      CASE WHEN e.entity_type = 'prestador' THEN e.entity_id END,
      (SELECT ae.prestador_id
         FROM public.alocacoes_escala ae
        WHERE e.entity_type IN ('alocacao', 'alocacoes_escala')
          AND ae.id = e.entity_id
        LIMIT 1),
      (SELECT ae.prestador_id
         FROM public.alocacoes_escala ae
        WHERE e.entity_type IN ('ordem_servico', 'os')
          AND ae.ordem_servico_id = e.entity_id
        ORDER BY ae.created_at DESC NULLS LAST
        LIMIT 1)
    ) AS prestador_id,
    COALESCE(
      public.try_cast_uuid(e.payload->>'os_id'),
      CASE WHEN e.entity_type IN ('ordem_servico', 'os') THEN e.entity_id END
    ) AS os_id
) d
LEFT JOIN public.app_notificacoes_lidas nl
  ON nl.evento_id = e.id
 AND nl.prestador_id = d.prestador_id
WHERE d.prestador_id IS NOT NULL
  AND (public.f_app_is_staff() OR d.prestador_id = public.f_app_prestador_id());

COMMENT ON VIEW public.vw_app_notificacoes_prestador IS
  'CONEXAO-2027 3A — Notificações do App derivadas de eventos_oficiais. visualizada = status lida ou leitura registrada em app_notificacoes_lidas.';

GRANT SELECT ON public.vw_app_notificacoes_prestador TO authenticated;
GRANT SELECT ON public.vw_app_notificacoes_prestador TO service_role;

-- RPC: App marca uma notificação como lida (por evento), com verificação de dono.
CREATE OR REPLACE FUNCTION public.f_marcar_notificacao_prestador_lida(p_evento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              uuid := auth.uid();
  v_staff            boolean := public.f_app_is_staff();
  v_prestador_atual  uuid := public.f_app_prestador_id();
  v_evento_prestador uuid;
  v_existe           boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT d.prestador_id
    INTO v_evento_prestador
  FROM public.eventos_oficiais e
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      public.try_cast_uuid(e.payload->>'prestador_id'),
      public.try_cast_uuid(e.payload->>'driver_id'),
      CASE WHEN e.entity_type = 'prestador' THEN e.entity_id END,
      (SELECT ae.prestador_id
         FROM public.alocacoes_escala ae
        WHERE e.entity_type IN ('alocacao', 'alocacoes_escala')
          AND ae.id = e.entity_id
        LIMIT 1),
      (SELECT ae.prestador_id
         FROM public.alocacoes_escala ae
        WHERE e.entity_type IN ('ordem_servico', 'os')
          AND ae.ordem_servico_id = e.entity_id
        ORDER BY ae.created_at DESC NULLS LAST
        LIMIT 1)
    ) AS prestador_id
  ) d
  WHERE e.id = p_evento_id;

  SELECT EXISTS (SELECT 1 FROM public.eventos_oficiais WHERE id = p_evento_id) INTO v_existe;
  IF NOT v_existe THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENTO_NAO_ENCONTRADO');
  END IF;

  IF NOT v_staff AND (v_prestador_atual IS NULL OR v_evento_prestador IS DISTINCT FROM v_prestador_atual) THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENTO_DE_OUTRO_PRESTADOR');
  END IF;

  IF v_evento_prestador IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENTO_SEM_PRESTADOR');
  END IF;

  INSERT INTO public.app_notificacoes_lidas (evento_id, prestador_id)
  VALUES (p_evento_id, v_evento_prestador)
  ON CONFLICT (evento_id, prestador_id) DO NOTHING;

  -- Só promove status para 'lida' quando o evento já foi processado, para não
  -- removê-lo da fila do eventProcessorWorker (trigger seta processed_at).
  UPDATE public.eventos_oficiais
     SET status = 'lida'
   WHERE id = p_evento_id
     AND processed_at IS NOT NULL
     AND status <> 'lida';

  RETURN jsonb_build_object('success', true, 'evento_id', p_evento_id, 'prestador_id', v_evento_prestador);
END;
$$;

COMMENT ON FUNCTION public.f_marcar_notificacao_prestador_lida(uuid) IS
  'CONEXAO-2027 3A — App marca notificação como lida (idempotente, valida dono).';

GRANT EXECUTE ON FUNCTION public.f_marcar_notificacao_prestador_lida(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1.2 Compatibilidade de reembolsos_prestador (despesas operacionais)
--
-- A tabela real usa: prestador (TEXT nome), os_id (uuid), tipo, valor,
-- data_despesa, comprovante_url, status, aprovado_por, data_aprovacao,
-- obs_rejeicao. Existe trigger trg_rp_derivar_prestador BEFORE INSERT que
-- força prestador= nome, status='pendente' e valida tipo legado
-- ('pedagio','ajudante','estadia','diaria','outros').
-- ----------------------------------------------------------------------------

ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS prestador_id uuid;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS alocacao_id uuid;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS driver_id text;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS operation_id text;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS comprovante_path text;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS motivo_rejeicao text;
ALTER TABLE public.reembolsos_prestador ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reembolsos_prestador_categoria_app_check'
  ) THEN
    ALTER TABLE public.reembolsos_prestador
      ADD CONSTRAINT reembolsos_prestador_categoria_app_check
      CHECK (
        categoria IS NULL OR categoria IN (
          'pedagio', 'estacionamento', 'balsa', 'abastecimento', 'extraordinaria'
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_rp_app_prestador_id ON public.reembolsos_prestador (prestador_id);
CREATE INDEX IF NOT EXISTS idx_rp_app_alocacao_id  ON public.reembolsos_prestador (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_rp_app_operation_id ON public.reembolsos_prestador (operation_id);

CREATE OR REPLACE FUNCTION public.f_trg_reembolsos_app2027_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_legacy_tipos text[] := ARRAY['pedagio', 'ajudante', 'estadia', 'diaria', 'outros'];
BEGIN
  -- Sync prestador_id <-> driver_id
  IF NEW.prestador_id IS NULL THEN
    NEW.prestador_id := COALESCE(
      public.try_cast_uuid(NEW.driver_id),
      public.f_app_prestador_id()
    );
  END IF;
  IF NEW.driver_id IS NULL AND NEW.prestador_id IS NOT NULL THEN
    NEW.driver_id := NEW.prestador_id::text;
  END IF;

  -- Sync os_id <-> operation_id
  IF NEW.os_id IS NULL THEN
    NEW.os_id := public.try_cast_uuid(NEW.operation_id);
  END IF;
  IF NEW.operation_id IS NULL AND NEW.os_id IS NOT NULL THEN
    NEW.operation_id := NEW.os_id::text;
  END IF;

  -- Comprovante
  NEW.comprovante_path := COALESCE(NEW.comprovante_path, NEW.comprovante_url);
  NEW.comprovante_url  := COALESCE(NEW.comprovante_url, NEW.comprovante_path);

  -- Rejeição
  NEW.motivo_rejeicao := COALESCE(NEW.motivo_rejeicao, NEW.obs_rejeicao);
  NEW.obs_rejeicao    := COALESCE(NEW.obs_rejeicao, NEW.motivo_rejeicao);
  NEW.aprovado_em     := COALESCE(NEW.aprovado_em, NEW.data_aprovacao);

  IF TG_OP = 'INSERT' THEN
    -- categoria original (aceita o que o App chamou de tipo)
    NEW.categoria := COALESCE(NEW.categoria, NEW.tipo);

    -- O trigger legado exige tipo em ('pedagio','ajudante','estadia','diaria','outros').
    -- Mapeia categorias novas para valores legados compatíveis.
    IF NEW.tipo IS NULL OR NOT (NEW.tipo = ANY (v_legacy_tipos)) THEN
      NEW.tipo := CASE COALESCE(NEW.categoria, '') 
        WHEN 'pedagio'         THEN 'pedagio'
        WHEN 'estacionamento'  THEN 'outros'
        WHEN 'balsa'           THEN 'outros'
        WHEN 'abastecimento'   THEN 'outros'
        WHEN 'extraordinaria'  THEN 'outros'
        ELSE 'outros'
      END;
    END IF;

    NEW.data_despesa := COALESCE(NEW.data_despesa, CURRENT_DATE);
    NEW.valor        := COALESCE(NEW.valor, 0);
    NEW.updated_at   := COALESCE(NEW.updated_at, now());
  ELSE
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reembolsos_app2027_sync ON public.reembolsos_prestador;
CREATE TRIGGER trg_reembolsos_app2027_sync
  BEFORE INSERT OR UPDATE ON public.reembolsos_prestador
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_reembolsos_app2027_sync();

-- RLS aditiva (não remove as policies legadas de tenant)
DROP POLICY IF EXISTS "rp_app2027_staff" ON public.reembolsos_prestador;
CREATE POLICY "rp_app2027_staff" ON public.reembolsos_prestador
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "rp_app2027_prestador_own" ON public.reembolsos_prestador;
CREATE POLICY "rp_app2027_prestador_own" ON public.reembolsos_prestador
  FOR ALL TO authenticated
  USING (prestador_id = public.f_app_prestador_id())
  WITH CHECK (prestador_id = public.f_app_prestador_id());

-- ----------------------------------------------------------------------------
-- 1.3 documentos_prestadores — colunas do App + evidências privadas
-- A tabela JÁ EXISTE (id, prestador_id, tipo, url, status, datas, observações).
-- ----------------------------------------------------------------------------

ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS tipo_documento text;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS numero_documento text;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS categoria_cnh text;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS data_emissao date;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS data_validade date;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS arquivo_path text;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS status_validacao text DEFAULT 'pendente';
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS validado_por uuid;
ALTER TABLE public.documentos_prestadores ADD COLUMN IF NOT EXISTS validado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documentos_prestadores_tipo_documento_app_check'
  ) THEN
    ALTER TABLE public.documentos_prestadores
      ADD CONSTRAINT documentos_prestadores_tipo_documento_app_check
      CHECK (
        tipo_documento IS NULL OR tipo_documento IN (
          'cnh', 'crlv', 'antt', 'seguro', 'comprovante_residencia',
          'certificacao', 'outro'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documentos_prestadores_status_validacao_app_check'
  ) THEN
    ALTER TABLE public.documentos_prestadores
      ADD CONSTRAINT documentos_prestadores_status_validacao_app_check
      CHECK (
        status_validacao IS NULL OR status_validacao IN (
          'pendente', 'aprovado', 'rejeitado', 'vencido'
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_doc_prest_app_prestador
  ON public.documentos_prestadores (prestador_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_doc_prest_app_validade
  ON public.documentos_prestadores (data_validade);

CREATE OR REPLACE FUNCTION public.f_trg_documentos_prestadores_app2027_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Compatibilidade bidirecional com colunas legadas (sem remover/renomear).
  NEW.tipo_documento := COALESCE(NEW.tipo_documento, NEW.tipo, 'outro');
  NEW.tipo           := COALESCE(NEW.tipo, NEW.tipo_documento);

  NEW.arquivo_path := COALESCE(NEW.arquivo_path, NEW.url);
  NEW.url          := COALESCE(NEW.url, NEW.arquivo_path);

  NEW.data_validade    := COALESCE(NEW.data_validade, NEW.data_vencimento, NEW.validade);
  NEW.data_vencimento  := COALESCE(NEW.data_vencimento, NEW.data_validade);
  NEW.validade         := COALESCE(NEW.validade, NEW.data_validade);

  NEW.observacao  := COALESCE(NEW.observacao, NEW.observacoes);
  NEW.observacoes := COALESCE(NEW.observacoes, NEW.observacao);

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_prestadores_app2027_sync ON public.documentos_prestadores;
CREATE TRIGGER trg_documentos_prestadores_app2027_sync
  BEFORE INSERT OR UPDATE ON public.documentos_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_documentos_prestadores_app2027_sync();

-- Buckets privados (idempotente; não altera buckets já existentes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('documentos-prestadores', 'documentos-prestadores', false, 20971520,
   ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('driver-evidence', 'driver-evidence', false, 52428800,
   ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policies de Storage: staff total; prestador apenas a própria pasta.
-- Convenção aceita: prestador id como 1º segmento OU em qualquer segmento.
DROP POLICY IF EXISTS "app2027_storage_docs_staff" ON storage.objects;
CREATE POLICY "app2027_storage_docs_staff" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_is_staff()
  )
  WITH CHECK (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_is_staff()
  );

DROP POLICY IF EXISTS "app2027_storage_docs_prestador_select" ON storage.objects;
CREATE POLICY "app2027_storage_docs_prestador_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_prestador_id() IS NOT NULL
    AND public.f_app_prestador_id()::text = ANY (storage.foldername(name))
  );

DROP POLICY IF EXISTS "app2027_storage_docs_prestador_insert" ON storage.objects;
CREATE POLICY "app2027_storage_docs_prestador_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_prestador_id() IS NOT NULL
    AND public.f_app_prestador_id()::text = ANY (storage.foldername(name))
  );

DROP POLICY IF EXISTS "app2027_storage_docs_prestador_update" ON storage.objects;
CREATE POLICY "app2027_storage_docs_prestador_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_prestador_id() IS NOT NULL
    AND public.f_app_prestador_id()::text = ANY (storage.foldername(name))
  )
  WITH CHECK (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_prestador_id() IS NOT NULL
    AND public.f_app_prestador_id()::text = ANY (storage.foldername(name))
  );

DROP POLICY IF EXISTS "app2027_storage_docs_prestador_delete" ON storage.objects;
CREATE POLICY "app2027_storage_docs_prestador_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('documentos-prestadores', 'documentos_prestadores', 'driver-evidence')
    AND public.f_app_prestador_id() IS NOT NULL
    AND public.f_app_prestador_id()::text = ANY (storage.foldername(name))
  );

-- ----------------------------------------------------------------------------
-- 1.4 RLS de delivery_proofs e operation_km (prestador registra/atualiza)
-- As policies existentes são preservadas; as abaixo são ADITIVAS.
-- ----------------------------------------------------------------------------

ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_km ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_app2027_staff" ON public.delivery_proofs;
CREATE POLICY "dp_app2027_staff" ON public.delivery_proofs
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "dp_app2027_prestador_own" ON public.delivery_proofs;
CREATE POLICY "dp_app2027_prestador_own" ON public.delivery_proofs
  FOR ALL TO authenticated
  USING (
    public.f_app_prestador_id() IS NOT NULL
    AND (
      driver_id = public.f_app_prestador_id()::text
      OR driver_id = auth.uid()::text
      OR operation_id IN (
        SELECT ae.id::text FROM public.alocacoes_escala ae
        WHERE ae.prestador_id = public.f_app_prestador_id()
      )
      OR os_id IN (
        SELECT ae.ordem_servico_id::text FROM public.alocacoes_escala ae
        WHERE ae.prestador_id = public.f_app_prestador_id()
          AND ae.ordem_servico_id IS NOT NULL
      )
    )
  )
  WITH CHECK (
    public.f_app_prestador_id() IS NOT NULL
    AND (
      driver_id = public.f_app_prestador_id()::text
      OR driver_id = auth.uid()::text
      OR operation_id IN (
        SELECT ae.id::text FROM public.alocacoes_escala ae
        WHERE ae.prestador_id = public.f_app_prestador_id()
      )
      OR os_id IN (
        SELECT ae.ordem_servico_id::text FROM public.alocacoes_escala ae
        WHERE ae.prestador_id = public.f_app_prestador_id()
          AND ae.ordem_servico_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "ok_app2027_staff" ON public.operation_km;
CREATE POLICY "ok_app2027_staff" ON public.operation_km
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "ok_app2027_prestador_own" ON public.operation_km;
CREATE POLICY "ok_app2027_prestador_own" ON public.operation_km
  FOR ALL TO authenticated
  USING (
    public.f_app_prestador_id() IS NOT NULL
    AND (
      driver_id = public.f_app_prestador_id()
      OR driver_id = auth.uid()
      OR operation_id IN (
        SELECT ae.id FROM public.alocacoes_escala ae
        WHERE ae.prestador_id = public.f_app_prestador_id()
      )
    )
  )
  WITH CHECK (
    public.f_app_prestador_id() IS NOT NULL
    AND (
      driver_id = public.f_app_prestador_id()
      OR driver_id = auth.uid()
      OR operation_id IN (
        SELECT ae.id FROM public.alocacoes_escala ae
        WHERE ae.prestador_id = public.f_app_prestador_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 1.5 RPCs do App
--
-- (a) f_buscar_oportunidades_para_prestador: a assinatura anterior era
--     (p_prestador_uuid uuid). O App chama p_prestador_id. Como o TMS Web NÃO
--     consome esta RPC (apenas um teste cita o nome), recriamos com o contrato
--     do App e resolução por auth.uid() quando null. Lógica original preservada.
-- (b) f_enviar_mensagem_torre: JÁ EXISTE (p_alocacao_id, p_mensagem,
--     p_idempotency_key) e é usada pelo TMS Web. Mantida intacta; criamos um
--     OVERLOAD de 4 args para o App (p_os_id, p_mensagem, p_anexo_url, p_scope).
-- (c) f_marcar_mensagens_lidas_app: JÁ EXISTE (p_alocacao_id) e é usada pelo
--     TMS Web. Mantida intacta; criamos OVERLOAD (p_os_id, p_scope).
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.f_buscar_oportunidades_para_prestador(uuid);

CREATE FUNCTION public.f_buscar_oportunidades_para_prestador(p_prestador_id uuid DEFAULT NULL)
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
  'CONEXAO-2027 3A — Oportunidades abertas compatíveis. p_prestador_id NULL resolve por auth.uid(). Nunca expõe valor_cliente/margem.';

GRANT EXECUTE ON FUNCTION public.f_buscar_oportunidades_para_prestador(uuid) TO authenticated, service_role;

-- (b) Overload do App para envio de mensagem à Torre (por OS)
CREATE OR REPLACE FUNCTION public.f_enviar_mensagem_torre(
  p_os_id      uuid,
  p_mensagem   text,
  p_anexo_url  text DEFAULT NULL,
  p_scope      text DEFAULT 'os'   -- discriminador de overload; ignorado
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_prestador   uuid := public.f_app_prestador_id();
  v_alocacao_id uuid;
  v_mensagem_id uuid;
  v_texto       text := NULLIF(btrim(COALESCE(p_mensagem, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF v_prestador IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_VINCULADO');
  END IF;
  IF p_os_id IS NULL OR v_texto IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DADOS_INVALIDOS');
  END IF;

  SELECT ae.id
    INTO v_alocacao_id
  FROM public.alocacoes_escala ae
  WHERE ae.ordem_servico_id = p_os_id
    AND ae.prestador_id = v_prestador
    AND ae.status NOT IN ('cancelada', 'recusada')
  ORDER BY ae.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_alocacao_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_SEM_ALOCACAO_NA_OS');
  END IF;

  INSERT INTO public.operacao_mensagens (
    alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
    mensagem, status, metadata
  ) VALUES (
    v_alocacao_id, p_os_id, v_prestador, 'prestador', v_uid,
    v_texto, 'enviada',
    jsonb_build_object('anexo_url', p_anexo_url, 'origem', 'app_prestador')
  )
  RETURNING id INTO v_mensagem_id;

  -- Evento para alerta na Torre. source='app' faz o consumer existente
  -- retornar cedo (não cria portal_notificacoes/escalonamentos indevidos).
  INSERT INTO public.eventos_oficiais (
    tenant_id, event_type, entity_type, entity_id,
    status, source, created_by, visibility, payload
  ) VALUES (
    public.current_tenant_id_safe(), 'app.mensagem_prestador', 'operacao_mensagem', v_mensagem_id,
    'active', 'app', v_uid, 'internal',
    jsonb_build_object(
      'titulo', 'Mensagem do prestador',
      'mensagem', v_texto,
      'os_id', p_os_id,
      'alocacao_id', v_alocacao_id,
      'prestador_id', v_prestador,
      'anexo_url', p_anexo_url
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'mensagem_id', v_mensagem_id,
    'alocacao_id', v_alocacao_id
  );
END;
$$;

COMMENT ON FUNCTION public.f_enviar_mensagem_torre(uuid, text, text, text) IS
  'CONEXAO-2027 3A — Overload App: mensagem do prestador por OS. O overload legado (p_alocacao_id, p_mensagem, p_idempotency_key) do TMS Web permanece intacto.';

GRANT EXECUTE ON FUNCTION public.f_enviar_mensagem_torre(uuid, text, text, text) TO authenticated, service_role;

-- (c) Overload do App para marcar mensagens da Torre como lidas (por OS)
CREATE OR REPLACE FUNCTION public.f_marcar_mensagens_lidas_app(
  p_os_id  uuid,
  p_scope  text DEFAULT 'os'   -- discriminador de overload; ignorado
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_prestador uuid := public.f_app_prestador_id();
  v_count     integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF v_prestador IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_VINCULADO');
  END IF;
  IF p_os_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS_NAO_INFORMADA');
  END IF;

  UPDATE public.operacao_mensagens
     SET status = 'lida', read_at = now()
   WHERE os_id = p_os_id
     AND sender_type = 'torre'
     AND status = 'enviada'
     AND (
       prestador_id = v_prestador
       OR alocacao_id IN (
         SELECT ae.id FROM public.alocacoes_escala ae
         WHERE ae.ordem_servico_id = p_os_id
           AND ae.prestador_id = v_prestador
       )
     );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'atualizadas', v_count);
END;
$$;

COMMENT ON FUNCTION public.f_marcar_mensagens_lidas_app(uuid, text) IS
  'CONEXAO-2027 3A — Overload App: marca mensagens da Torre como lidas por OS. O overload legado (p_alocacao_id) do TMS Web permanece intacto.';

GRANT EXECUTE ON FUNCTION public.f_marcar_mensagens_lidas_app(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- BLOCO 2 — NOVAS ESTRUTURAS DO ECOSSISTEMA 2027
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6. Volumes individuais e cadeia de custódia
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.os_volumes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id  uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  rota_parada_id    uuid REFERENCES public.rota_paradas(id) ON DELETE SET NULL,
  codigo_barras     text,
  qr_code           text,
  sku               text,
  descricao         text,
  lote              text,
  data_validade     date,
  peso_kg           numeric(12,3),
  cubagem_m3        numeric(12,4),
  status_atual      text NOT NULL DEFAULT 'aguardando_coleta',
  recebedor_nome    text,
  tenant_id         uuid DEFAULT public.current_tenant_id_safe(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT os_volumes_status_check CHECK (status_atual IN (
    'aguardando_coleta', 'coletado', 'em_transito', 'entregue',
    'recusado_parcial', 'em_devolucao', 'devolvido_base', 'divergente'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_os_volumes_codigo_por_os
  ON public.os_volumes (ordem_servico_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_os_volumes_qr
  ON public.os_volumes (qr_code)
  WHERE qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_volumes_os ON public.os_volumes (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_volumes_parada ON public.os_volumes (rota_parada_id);
CREATE INDEX IF NOT EXISTS idx_os_volumes_status ON public.os_volumes (status_atual);

ALTER TABLE public.os_volumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_osvol_staff" ON public.os_volumes;
CREATE POLICY "app2027_osvol_staff" ON public.os_volumes
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_osvol_prestador" ON public.os_volumes;
CREATE POLICY "app2027_osvol_prestador" ON public.os_volumes
  FOR ALL TO authenticated
  USING (
    public.f_app_prestador_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.alocacoes_escala ae
      WHERE ae.ordem_servico_id = os_volumes.ordem_servico_id
        AND ae.prestador_id = public.f_app_prestador_id()
    )
  )
  WITH CHECK (
    public.f_app_prestador_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.alocacoes_escala ae
      WHERE ae.ordem_servico_id = os_volumes.ordem_servico_id
        AND ae.prestador_id = public.f_app_prestador_id()
    )
  );

DROP POLICY IF EXISTS "app2027_osvol_cliente" ON public.os_volumes;
CREATE POLICY "app2027_osvol_cliente" ON public.os_volumes
  FOR SELECT TO authenticated
  USING (
    public.f_app_cliente_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_volumes.ordem_servico_id
        AND (
          os.cliente = public.f_app_cliente_id()
          OR os.cliente_id = public.f_app_cliente_id()::text
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_volumes TO authenticated;
GRANT ALL ON public.os_volumes TO service_role;

CREATE TABLE IF NOT EXISTS public.volume_movimentacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id        uuid NOT NULL REFERENCES public.os_volumes(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  prestador_id     uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
  tipo_evento      text NOT NULL,
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  foto_path        text,
  observacao       text,
  client_event_id  text,
  registrado_em    timestamptz NOT NULL DEFAULT now(),
  tenant_id        uuid DEFAULT public.current_tenant_id_safe(),
  CONSTRAINT volume_movimentacoes_tipo_check CHECK (tipo_evento IN (
    'gerado', 'conferencia_coleta', 'carregamento', 'entrega',
    'recusa', 'retorno_base', 'divergencia'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_volume_mov_client_event
  ON public.volume_movimentacoes (client_event_id)
  WHERE client_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volume_mov_volume ON public.volume_movimentacoes (volume_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_volume_mov_os ON public.volume_movimentacoes (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_volume_mov_prestador ON public.volume_movimentacoes (prestador_id);

ALTER TABLE public.volume_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_vm_staff" ON public.volume_movimentacoes;
CREATE POLICY "app2027_vm_staff" ON public.volume_movimentacoes
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_vm_prestador" ON public.volume_movimentacoes;
CREATE POLICY "app2027_vm_prestador" ON public.volume_movimentacoes
  FOR ALL TO authenticated
  USING (
    public.f_app_prestador_id() IS NOT NULL
    AND (
      prestador_id = public.f_app_prestador_id()
      OR EXISTS (
        SELECT 1
        FROM public.os_volumes v
        JOIN public.alocacoes_escala ae ON ae.ordem_servico_id = v.ordem_servico_id
        WHERE v.id = volume_movimentacoes.volume_id
          AND ae.prestador_id = public.f_app_prestador_id()
      )
    )
  )
  WITH CHECK (
    public.f_app_prestador_id() IS NOT NULL
    AND (
      prestador_id = public.f_app_prestador_id()
      OR prestador_id IS NULL
    )
  );

DROP POLICY IF EXISTS "app2027_vm_cliente" ON public.volume_movimentacoes;
CREATE POLICY "app2027_vm_cliente" ON public.volume_movimentacoes
  FOR SELECT TO authenticated
  USING (
    public.f_app_cliente_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.os_volumes v
      JOIN public.ordens_servico os ON os.id = v.ordem_servico_id
      WHERE v.id = volume_movimentacoes.volume_id
        AND (
          os.cliente = public.f_app_cliente_id()
          OR os.cliente_id = public.f_app_cliente_id()::text
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.volume_movimentacoes TO authenticated;
GRANT ALL ON public.volume_movimentacoes TO service_role;

-- Preenche prestador_id e ordem_servico_id a partir do volume quando o App
-- envia apenas o volume + evento.
CREATE OR REPLACE FUNCTION public.f_trg_volume_movimentacoes_app2027()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ordem_servico_id IS NULL THEN
    SELECT v.ordem_servico_id INTO NEW.ordem_servico_id
    FROM public.os_volumes v WHERE v.id = NEW.volume_id;
  END IF;
  IF NEW.prestador_id IS NULL THEN
    NEW.prestador_id := public.f_app_prestador_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_volume_movimentacoes_app2027 ON public.volume_movimentacoes;
CREATE TRIGGER trg_volume_movimentacoes_app2027
  BEFORE INSERT ON public.volume_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_volume_movimentacoes_app2027();

-- ----------------------------------------------------------------------------
-- 7. Protocolo de devolução e divergência
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.protocolos_divergencia_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.protocolos_divergencia (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_protocolo            text NOT NULL DEFAULT (
    'PROT-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.protocolos_divergencia_numero_seq')::text, 5, '0')
  ),
  ordem_servico_id            uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  cliente_id                  uuid,
  prestador_id                uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
  volumes_enviados            integer NOT NULL DEFAULT 0,
  volumes_entregues           integer NOT NULL DEFAULT 0,
  volumes_esperados_retorno   integer NOT NULL DEFAULT 0,
  volumes_recebidos_retorno   integer NOT NULL DEFAULT 0,
  quantidade_divergente       integer GENERATED ALWAYS AS (
    GREATEST(COALESCE(volumes_esperados_retorno, 0) - COALESCE(volumes_recebidos_retorno, 0), 0)
  ) STORED,
  motivo                      text,
  observacoes                 text,
  fotos_paths                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude                    numeric(10,7),
  longitude                   numeric(10,7),
  responsavel_recebimento     text,
  status                      text NOT NULL DEFAULT 'aberta',
  resolucao_notas             text,
  resolvido_por               uuid,
  resolvido_em                timestamptz,
  tenant_id                   uuid DEFAULT public.current_tenant_id_safe(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT protocolos_divergencia_status_check CHECK (status IN (
    'aberta', 'em_analise', 'aguardando_info', 'resolvida'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_protocolos_divergencia_numero
  ON public.protocolos_divergencia (numero_protocolo);
CREATE INDEX IF NOT EXISTS idx_protocolos_divergencia_os
  ON public.protocolos_divergencia (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_divergencia_prestador
  ON public.protocolos_divergencia (prestador_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_divergencia_cliente
  ON public.protocolos_divergencia (cliente_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_divergencia_status
  ON public.protocolos_divergencia (status);

ALTER TABLE public.protocolos_divergencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_prot_staff" ON public.protocolos_divergencia;
CREATE POLICY "app2027_prot_staff" ON public.protocolos_divergencia
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_prot_prestador" ON public.protocolos_divergencia;
CREATE POLICY "app2027_prot_prestador" ON public.protocolos_divergencia
  FOR ALL TO authenticated
  USING (prestador_id = public.f_app_prestador_id())
  WITH CHECK (prestador_id = public.f_app_prestador_id());

DROP POLICY IF EXISTS "app2027_prot_cliente" ON public.protocolos_divergencia;
CREATE POLICY "app2027_prot_cliente" ON public.protocolos_divergencia
  FOR SELECT TO authenticated
  USING (cliente_id = public.f_app_cliente_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolos_divergencia TO authenticated;
GRANT ALL ON public.protocolos_divergencia TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.protocolos_divergencia_numero_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.f_fechar_conferencia_retorno_os(
  p_ordem_servico_id       uuid,
  p_volumes_recebidos      integer,
  p_motivo                 text DEFAULT NULL,
  p_observacoes            text DEFAULT NULL,
  p_latitude               numeric DEFAULT NULL,
  p_longitude              numeric DEFAULT NULL,
  p_responsavel            text DEFAULT NULL,
  p_fotos                  jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_staff          boolean := public.f_app_is_staff();
  v_prestador      uuid := public.f_app_prestador_id();
  v_os             public.ordens_servico%ROWTYPE;
  v_enviados       integer := 0;
  v_entregues      integer := 0;
  v_esperados      integer := 0;
  v_recebidos      integer := GREATEST(COALESCE(p_volumes_recebidos, 0), 0);
  v_divergente     integer := 0;
  v_protocolo_id   uuid;
  v_numero         text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF p_ordem_servico_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS_NAO_INFORMADA');
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_ordem_servico_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS_NAO_ENCONTRADA');
  END IF;

  IF NOT v_staff AND NOT EXISTS (
    SELECT 1 FROM public.alocacoes_escala ae
    WHERE ae.ordem_servico_id = p_ordem_servico_id
      AND ae.prestador_id = v_prestador
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACESSO_NEGADO');
  END IF;

  SELECT COUNT(*) INTO v_enviados
    FROM public.os_volumes WHERE ordem_servico_id = p_ordem_servico_id;
  SELECT COUNT(*) INTO v_entregues
    FROM public.os_volumes
   WHERE ordem_servico_id = p_ordem_servico_id AND status_atual = 'entregue';
  SELECT COUNT(*) INTO v_esperados
    FROM public.os_volumes
   WHERE ordem_servico_id = p_ordem_servico_id
     AND status_atual IN ('em_devolucao', 'divergente', 'em_transito', 'coletado');

  IF v_esperados = 0 THEN
    v_esperados := GREATEST(COALESCE(v_os.reversa_qtd_volumes, 0), 0);
  END IF;

  v_divergente := GREATEST(v_esperados - v_recebidos, 0);

  IF v_divergente > 0 THEN
    INSERT INTO public.protocolos_divergencia (
      ordem_servico_id, cliente_id, prestador_id,
      volumes_enviados, volumes_entregues,
      volumes_esperados_retorno, volumes_recebidos_retorno,
      motivo, observacoes, fotos_paths, latitude, longitude,
      responsavel_recebimento, status
    ) VALUES (
      p_ordem_servico_id,
      COALESCE(v_os.cliente, public.try_cast_uuid(v_os.cliente_id)),
      COALESCE(v_prestador, (
        SELECT ae.prestador_id FROM public.alocacoes_escala ae
        WHERE ae.ordem_servico_id = p_ordem_servico_id
        ORDER BY ae.created_at DESC NULLS LAST LIMIT 1
      )),
      v_enviados, v_entregues, v_esperados, v_recebidos,
      COALESCE(p_motivo, 'Divergência na conferência de retorno'),
      p_observacoes,
      COALESCE(p_fotos, '[]'::jsonb),
      p_latitude, p_longitude, p_responsavel, 'aberta'
    )
    RETURNING id, numero_protocolo INTO v_protocolo_id, v_numero;

    RETURN jsonb_build_object(
      'success', true,
      'divergencia', true,
      'protocolo_id', v_protocolo_id,
      'numero_protocolo', v_numero,
      'volumes_esperados_retorno', v_esperados,
      'volumes_recebidos_retorno', v_recebidos,
      'quantidade_divergente', v_divergente
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'divergencia', false,
    'volumes_esperados_retorno', v_esperados,
    'volumes_recebidos_retorno', v_recebidos,
    'quantidade_divergente', 0
  );
END;
$$;

COMMENT ON FUNCTION public.f_fechar_conferencia_retorno_os(uuid, integer, text, text, numeric, numeric, text, jsonb) IS
  'CONEXAO-2027 3A — Fecha conferência de retorno e abre protocolo de divergência quando recebidos < esperados.';

GRANT EXECUTE ON FUNCTION public.f_fechar_conferencia_retorno_os(uuid, integer, text, text, numeric, numeric, text, jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. Homologação operacional e regras configuráveis por cliente/modalidade
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.prestador_homologacoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id          uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  modalidade            text NOT NULL,
  categoria_veiculo     text,
  status                text NOT NULL DEFAULT 'pendente',
  requisitos_pendentes  jsonb NOT NULL DEFAULT '[]'::jsonb,
  validade_ate          date,
  aprovado_por          uuid,
  tenant_id             uuid DEFAULT public.current_tenant_id_safe(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prestador_homologacoes_modalidade_check CHECK (modalidade IN (
    'entrega_imediata', 'servico_agendado', 'ecommerce_multiparadas',
    'coleta_distribuicao', 'transporte_dedicado', 'operacao_fixa',
    'centro_distribuicao', 'refrigerado'
  )),
  CONSTRAINT prestador_homologacoes_status_check CHECK (status IN (
    'homologado', 'pendente', 'em_analise', 'atualizacao_necessaria'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prestador_homologacoes_geral
  ON public.prestador_homologacoes (prestador_id, modalidade)
  WHERE cliente_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestador_homologacoes_cliente
  ON public.prestador_homologacoes (prestador_id, cliente_id, modalidade)
  WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prestador_homologacoes_prestador
  ON public.prestador_homologacoes (prestador_id, status);
CREATE INDEX IF NOT EXISTS idx_prestador_homologacoes_cliente
  ON public.prestador_homologacoes (cliente_id);

ALTER TABLE public.prestador_homologacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_homolog_staff" ON public.prestador_homologacoes;
CREATE POLICY "app2027_homolog_staff" ON public.prestador_homologacoes
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_homolog_prestador" ON public.prestador_homologacoes;
CREATE POLICY "app2027_homolog_prestador" ON public.prestador_homologacoes
  FOR SELECT TO authenticated
  USING (prestador_id = public.f_app_prestador_id());

DROP POLICY IF EXISTS "app2027_homolog_cliente" ON public.prestador_homologacoes;
CREATE POLICY "app2027_homolog_cliente" ON public.prestador_homologacoes
  FOR SELECT TO authenticated
  USING (cliente_id = public.f_app_cliente_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_homologacoes TO authenticated;
GRANT ALL ON public.prestador_homologacoes TO service_role;

CREATE TABLE IF NOT EXISTS public.regras_operacao_cliente (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id                  uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  modalidade                  text NOT NULL DEFAULT 'todas',
  exige_leitura_volumes       boolean NOT NULL DEFAULT false,
  exige_foto_coleta           boolean NOT NULL DEFAULT false,
  exige_foto_entrega          boolean NOT NULL DEFAULT false,
  exige_assinatura            boolean NOT NULL DEFAULT false,
  exige_pin_entrega           boolean NOT NULL DEFAULT false,
  exige_controle_temperatura  boolean NOT NULL DEFAULT false,
  permite_entrega_parcial     boolean NOT NULL DEFAULT false,
  instrucoes_padrao           text,
  tenant_id                   uuid DEFAULT public.current_tenant_id_safe(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regras_operacao_cliente_modalidade_check CHECK (modalidade IN (
    'todas', 'entrega_imediata', 'servico_agendado', 'ecommerce_multiparadas',
    'coleta_distribuicao', 'transporte_dedicado', 'operacao_fixa',
    'centro_distribuicao', 'refrigerado'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_regras_operacao_cliente_modalidade
  ON public.regras_operacao_cliente (cliente_id, modalidade);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_cliente_cliente
  ON public.regras_operacao_cliente (cliente_id);

ALTER TABLE public.regras_operacao_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_roc_staff" ON public.regras_operacao_cliente;
CREATE POLICY "app2027_roc_staff" ON public.regras_operacao_cliente
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_roc_cliente" ON public.regras_operacao_cliente;
CREATE POLICY "app2027_roc_cliente" ON public.regras_operacao_cliente
  FOR SELECT TO authenticated
  USING (cliente_id = public.f_app_cliente_id());

DROP POLICY IF EXISTS "app2027_roc_prestador" ON public.regras_operacao_cliente;
CREATE POLICY "app2027_roc_prestador" ON public.regras_operacao_cliente
  FOR SELECT TO authenticated
  USING (
    public.f_app_prestador_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.alocacoes_escala ae
      JOIN public.ordens_servico os ON os.id = ae.ordem_servico_id
      WHERE ae.prestador_id = public.f_app_prestador_id()
        AND (
          os.cliente = regras_operacao_cliente.cliente_id
          OR os.cliente_id = regras_operacao_cliente.cliente_id::text
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_operacao_cliente TO authenticated;
GRANT ALL ON public.regras_operacao_cliente TO service_role;

-- ----------------------------------------------------------------------------
-- 9. Segurança (SOS) e dispositivos push
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ocorrencias_seguranca_app (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id     uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  tipo             text NOT NULL,
  severidade       text NOT NULL DEFAULT 'alta',
  descricao        text,
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  fotos_paths      jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text NOT NULL DEFAULT 'aberta',
  atendido_por     uuid,
  tenant_id        uuid DEFAULT public.current_tenant_id_safe(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocorrencias_seguranca_app_tipo_check CHECK (tipo IN (
    'sos_emergencia', 'acidente', 'roubo_furto', 'pane_mecanica',
    'problema_carga', 'atraso_transito'
  )),
  CONSTRAINT ocorrencias_seguranca_app_severidade_check CHECK (severidade IN (
    'critica', 'alta', 'media'
  )),
  CONSTRAINT ocorrencias_seguranca_app_status_check CHECK (status IN (
    'aberta', 'em_atendimento', 'encerrada'
  ))
);

CREATE INDEX IF NOT EXISTS idx_ocorr_seg_app_prestador
  ON public.ocorrencias_seguranca_app (prestador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocorr_seg_app_os
  ON public.ocorrencias_seguranca_app (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_ocorr_seg_app_status
  ON public.ocorrencias_seguranca_app (status, severidade);

ALTER TABLE public.ocorrencias_seguranca_app ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_sos_staff" ON public.ocorrencias_seguranca_app;
CREATE POLICY "app2027_sos_staff" ON public.ocorrencias_seguranca_app
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_sos_prestador" ON public.ocorrencias_seguranca_app;
CREATE POLICY "app2027_sos_prestador" ON public.ocorrencias_seguranca_app
  FOR ALL TO authenticated
  USING (prestador_id = public.f_app_prestador_id())
  WITH CHECK (prestador_id = public.f_app_prestador_id());

DROP POLICY IF EXISTS "app2027_sos_cliente" ON public.ocorrencias_seguranca_app;
CREATE POLICY "app2027_sos_cliente" ON public.ocorrencias_seguranca_app
  FOR SELECT TO authenticated
  USING (
    public.f_app_cliente_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = ocorrencias_seguranca_app.ordem_servico_id
        AND (
          os.cliente = public.f_app_cliente_id()
          OR os.cliente_id = public.f_app_cliente_id()::text
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias_seguranca_app TO authenticated;
GRANT ALL ON public.ocorrencias_seguranca_app TO service_role;

CREATE TABLE IF NOT EXISTS public.prestador_dispositivos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id    uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  fcm_token       text NOT NULL,
  plataforma      text NOT NULL DEFAULT 'android',
  modelo_aparelho text,
  app_versao      text,
  ativo           boolean NOT NULL DEFAULT true,
  ultimo_ping_em  timestamptz,
  tenant_id       uuid DEFAULT public.current_tenant_id_safe(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prestador_dispositivos_plataforma_check CHECK (plataforma IN (
    'android', 'ios', 'web'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prestador_dispositivos_fcm
  ON public.prestador_dispositivos (fcm_token);
CREATE INDEX IF NOT EXISTS idx_prestador_dispositivos_prestador
  ON public.prestador_dispositivos (prestador_id, ativo);

ALTER TABLE public.prestador_dispositivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app2027_dispositivos_staff" ON public.prestador_dispositivos;
CREATE POLICY "app2027_dispositivos_staff" ON public.prestador_dispositivos
  FOR ALL TO authenticated
  USING (public.f_app_is_staff())
  WITH CHECK (public.f_app_is_staff());

DROP POLICY IF EXISTS "app2027_dispositivos_prestador" ON public.prestador_dispositivos;
CREATE POLICY "app2027_dispositivos_prestador" ON public.prestador_dispositivos
  FOR ALL TO authenticated
  USING (prestador_id = public.f_app_prestador_id())
  WITH CHECK (prestador_id = public.f_app_prestador_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_dispositivos TO authenticated;
GRANT ALL ON public.prestador_dispositivos TO service_role;

-- ============================================================================
-- FIM
-- ============================================================================

-- Recarrega o cache de schema do PostgREST (efetivo apenas no COMMIT).
NOTIFY pgrst, 'reload schema';
