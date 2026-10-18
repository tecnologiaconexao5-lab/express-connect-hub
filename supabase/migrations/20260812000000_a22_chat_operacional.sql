-- =================================================================================
-- MISSÃO A22 — CHAT OPERACIONAL APP PRESTADOR ⇄ TORRE DE CONTROLE / TMS
-- Migration dedicada e mínima. PRODUÇÃO: uwrvzsjtpgaifkktpepn.
--
-- CONTEÚDO:
--   1. CREATE TABLE public.operacao_mensagens  (chat bidirecional por operação)
--   2. Índices + UNIQUE idempotência parcial
--   3. RLS: prestador (auth_user_id) lê SOMENTE as próprias operações;
--           TMS/Torre (tenant_usuarios) lê todas as mensagens operacionais.
--      SEM políticas INSERT/UPDATE/DELETE diretas -> escrita apenas via RPC
--      SECURITY DEFINER (nunca confia em prestador_id vindo do cliente).
--   4. RPCs:
--        f_enviar_mensagem_torre(p_alocacao_id, p_mensagem, p_idempotency_key)
--        f_responder_mensagem_torre(p_alocacao_id, p_mensagem, p_idempotency_key)
--        f_marcar_mensagens_lidas_app(p_alocacao_id)
--        f_marcar_mensagens_lidas_torre(p_alocacao_id)
--        f_contar_mensagens_nao_lidas_torre()
--   5. Realtime: operacao_mensagens na publication supabase_realtime (mecanismo
--      de atualização; a tabela continua sendo a fonte persistente).
--   6. Fix RLS portal_notificacoes (gap de isolamento entre prestadores):
--      remove policy SELECT-true e escopa pn_select_own ao prestador REAL
--      (prestadores.auth_user_id = auth.uid()).
--
-- Regra: não mexe em crm_conversas / crm_mensagens / operation_timeline_events.
-- Reversível: ver arquivo de rollback A22.
-- =================================================================================

-- =================================================================================
-- 1. TABELA operacao_mensagens
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.operacao_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alocacao_id uuid NOT NULL REFERENCES public.alocacoes_escala(id) ON DELETE CASCADE,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
  sender_type text NOT NULL DEFAULT 'prestador' CHECK (sender_type IN ('prestador','torre')),
  sender_user_id uuid,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada','lida')),
  read_at timestamptz,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.operacao_mensagens IS
  'A22 — Chat operacional bidirecional App Prestador ⇄ Torre de Controle. Vinculado à alocação (operação). Texto somente.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_operacao_mensagens_alocacao
  ON public.operacao_mensagens (alocacao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operacao_mensagens_prestador
  ON public.operacao_mensagens (prestador_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operacao_mensagens_nao_lidas
  ON public.operacao_mensagens (sender_type, status) WHERE status = 'enviada';

-- Idempotência: mesma chave nunca cria duas mensagens
CREATE UNIQUE INDEX IF NOT EXISTS uq_operacao_mensagens_idempotency
  ON public.operacao_mensagens (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- =================================================================================
-- 2. RLS
-- =================================================================================
ALTER TABLE public.operacao_mensagens ENABLE ROW LEVEL SECURITY;

-- 2.1 Prestador: lê mensagens apenas das operações que pertencem a ele.
DROP POLICY IF EXISTS "operacao_mensagens_select_prestador" ON public.operacao_mensagens;
CREATE POLICY "operacao_mensagens_select_prestador" ON public.operacao_mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.auth_user_id = auth.uid()
        AND p.id = operacao_mensagens.prestador_id
    )
  );

-- 2.2 Torre/TMS: usuário corporativo (tenant_usuarios) lê todas as mensagens
--     operacionais (padrão de acesso atual do TMS, sem USING(true)).
DROP POLICY IF EXISTS "operacao_mensagens_select_torre" ON public.operacao_mensagens;
CREATE POLICY "operacao_mensagens_select_torre" ON public.operacao_mensagens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

-- NÃO há políticas INSERT/UPDATE/DELETE: escrita restrita às RPCs SECURITY DEFINER
-- e à role service_role. Impede cliente/prestador de gravar prestador_id arbitrário.

-- =================================================================================
-- 3. RPCs
-- =================================================================================

-- ---------------------------------------------------------------------------------
-- 3.1 f_enviar_mensagem_torre — APP → TORRE
--     auth.uid() resolve o prestador (prestadores.auth_user_id). NUNCA confia em
--     prestador_id vindo do cliente. Idempotente por idempotency_key.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_enviar_mensagem_torre(
  p_alocacao_id uuid,
  p_mensagem text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_prestador_id uuid;
  v_alocacao record;
  v_mensagem_id uuid;
  v_existente uuid;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Idempotência: mesma chave retorna a mensagem já criada
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existente FROM public.operacao_mensagens
    WHERE idempotency_key = p_idempotency_key AND sender_type = 'prestador'
    LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicada', true, 'mensagem_id', v_existente);
    END IF;
  END IF;

  -- Resolver prestador autenticado
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid
    AND status = 'ativo'
    AND liberado_app = true;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_VINCULADO');
  END IF;

  -- Validar alocação pertence ao prestador
  SELECT id, ordem_servico_id, prestador_id, status
    INTO v_alocacao
  FROM public.alocacoes_escala
  WHERE id = p_alocacao_id;
  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF v_alocacao.status IN ('cancelada', 'recusada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_INATIVA');
  END IF;

  -- Validar mensagem
  IF p_mensagem IS NULL OR btrim(p_mensagem) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_VAZIA');
  END IF;
  IF length(p_mensagem) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_MUITO_LONGA');
  END IF;

  INSERT INTO public.operacao_mensagens (
    alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
    mensagem, status, idempotency_key
  ) VALUES (
    p_alocacao_id,
    v_alocacao.ordem_servico_id,
    v_prestador_id,
    'prestador',
    v_authenticated_uid,
    btrim(p_mensagem),
    'enviada',
    NULLIF(p_idempotency_key, '')
  )
  RETURNING id INTO v_mensagem_id;

  RETURN jsonb_build_object('success', true, 'mensagem_id', v_mensagem_id, 'created_at', now());
END;
$function$;

COMMENT ON FUNCTION public.f_enviar_mensagem_torre IS
  'A22 — App Prestador envia mensagem para a Torre. Resolve prestador via auth.uid(). Idempotente.';

GRANT EXECUTE ON FUNCTION public.f_enviar_mensagem_torre(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------
-- 3.2 f_responder_mensagem_torre — TORRE → APP
--     Somente usuário TMS (tenant_usuarios). Ao responder, gera notificação real
--     para o App via f_registrar_notificacao_app (infra existente).
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_responder_mensagem_torre(
  p_alocacao_id uuid,
  p_mensagem text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_alocacao record;
  v_mensagem_id uuid;
  v_existente uuid;
  v_notificacao_id uuid;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Somente usuário TMS pode responder
  IF NOT EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = v_authenticated_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTORIZADO_TORRE');
  END IF;

  -- Idempotência (resposta da torre)
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existente FROM public.operacao_mensagens
    WHERE idempotency_key = p_idempotency_key AND sender_type = 'torre'
    LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicada', true, 'mensagem_id', v_existente);
    END IF;
  END IF;

  -- Validar alocação (para identificar o prestador e o os_id)
  SELECT id, ordem_servico_id, prestador_id, status INTO v_alocacao
  FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_SEM_PRESTADOR');
  END IF;

  -- Validar mensagem
  IF p_mensagem IS NULL OR btrim(p_mensagem) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_VAZIA');
  END IF;
  IF length(p_mensagem) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_MUITO_LONGA');
  END IF;

  INSERT INTO public.operacao_mensagens (
    alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
    mensagem, status, idempotency_key
  ) VALUES (
    p_alocacao_id,
    v_alocacao.ordem_servico_id,
    v_alocacao.prestador_id,
    'torre',
    v_authenticated_uid,
    btrim(p_mensagem),
    'enviada',
    NULLIF(p_idempotency_key, '')
  )
  RETURNING id INTO v_mensagem_id;

  -- Notificar o App (infra real existente)
  BEGIN
    v_notificacao_id := public.f_registrar_notificacao_app(
      v_alocacao.prestador_id,
      'Nova mensagem da Torre',
      left(btrim(p_mensagem), 120),
      'operacao_mensagem',
      p_alocacao_id,
      'alocacao'
    );
  EXCEPTION WHEN OTHERS THEN
    v_notificacao_id := NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'mensagem_id', v_mensagem_id,
    'notificacao_id', v_notificacao_id,
    'created_at', now()
  );
END;
$function$;

COMMENT ON FUNCTION public.f_responder_mensagem_torre IS
  'A22 — Torre/TMS responde mensagem do prestador. Somente tenant_usuarios. Gera notificação para o App. Idempotente.';

GRANT EXECUTE ON FUNCTION public.f_responder_mensagem_torre(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------
-- 3.3 f_marcar_mensagens_lidas_app — APP marca como lida (mensagens da TORRE)
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_marcar_mensagens_lidas_app(
  p_alocacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_prestador_id uuid;
  v_count integer;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT id INTO v_prestador_id FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_VINCULADO');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.alocacoes_escala
    WHERE id = p_alocacao_id AND prestador_id = v_prestador_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;

  UPDATE public.operacao_mensagens
  SET status = 'lida', read_at = now()
  WHERE alocacao_id = p_alocacao_id
    AND sender_type = 'torre'
    AND status = 'enviada';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'atualizadas', v_count);
END;
$function$;

COMMENT ON FUNCTION public.f_marcar_mensagens_lidas_app IS
  'A22 — App marca como lidas as mensagens da Torre da operação.';

GRANT EXECUTE ON FUNCTION public.f_marcar_mensagens_lidas_app(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------
-- 3.4 f_marcar_mensagens_lidas_torre — TORRE marca como lida (mensagens do PRESTADOR)
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_marcar_mensagens_lidas_torre(
  p_alocacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_count integer;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = v_authenticated_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTORIZADO_TORRE');
  END IF;

  UPDATE public.operacao_mensagens
  SET status = 'lida', read_at = now()
  WHERE alocacao_id = p_alocacao_id
    AND sender_type = 'prestador'
    AND status = 'enviada';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'atualizadas', v_count);
END;
$function$;

COMMENT ON FUNCTION public.f_marcar_mensagens_lidas_torre IS
  'A22 — Torre marca como lidas as mensagens do prestador da operação.';

GRANT EXECUTE ON FUNCTION public.f_marcar_mensagens_lidas_torre(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------
-- 3.5 f_contar_mensagens_nao_lidas_torre — badge REAL da Topbar
--     Conta mensagens do prestador ainda não lidas pela Torre (todas as operações).
--     Somente usuário TMS (tenant_usuarios) obtém o total; demais retornam 0.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_contar_mensagens_nao_lidas_torre()
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()) THEN
    RETURN 0;
  END IF;
  SELECT count(*)::integer INTO v_total
  FROM public.operacao_mensagens
  WHERE sender_type = 'prestador' AND status = 'enviada';
  RETURN v_total;
END;
$function$;

COMMENT ON FUNCTION public.f_contar_mensagens_nao_lidas_torre IS
  'A22 — Total de mensagens do prestador ainda não lidas pela Torre (badge real).';

GRANT EXECUTE ON FUNCTION public.f_contar_mensagens_nao_lidas_torre() TO authenticated, service_role;

-- =================================================================================
-- 4. REALTIME — mecanismo de atualização (a tabela segue sendo a fonte de verdade)
-- =================================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'operacao_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.operacao_mensagens;
  END IF;
END $$;

-- =================================================================================
-- 5. FIX RLS portal_notificacoes — isolamento entre prestadores
-- =================================================================================
-- Gap confirmado em produção (a migration 20260725_missao_rls_fix_priority_tables
-- nunca foi aplicada). Policies antigas ativas:
--   - notificacoes_select_authenticated: SELECT true  (qualquer authenticated lê tudo)
--   - pn_select_own: cliente own OU prestador_id IS NOT NULL (qualquer prestador lê
--     notificações de outros prestadores)
-- Correção: remove a SELECT-true e escopa pn_select_own ao prestador REAL
-- (prestadores.auth_user_id = auth.uid()). Leitura de cliente preservada via
-- f_obter_cliente_id_do_usuario(). Escritas preservadas.
DROP POLICY IF EXISTS "notificacoes_select_authenticated" ON public.portal_notificacoes;

DROP POLICY IF EXISTS "pn_select_own" ON public.portal_notificacoes;
CREATE POLICY "pn_select_own" ON public.portal_notificacoes
  FOR SELECT TO authenticated
  USING (
    cliente_id = public.f_obter_cliente_id_do_usuario()
    OR prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

-- =================================================================================
-- FIM DA MIGRATION A22
-- =================================================================================
