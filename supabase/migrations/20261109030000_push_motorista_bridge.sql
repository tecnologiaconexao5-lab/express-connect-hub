-- ============================================================================
-- PUSH MOTORISTA — PONTE TMS → APP (FCM)
-- Data: 2026-11-09
--
-- Contexto: o app Flutter (C:\src\conexao_prestador) lê `eventos_oficiais`
-- (Comunicados) e NÃO lê `portal_notificacoes`; além disso não possui
-- firebase_messaging/OneSignal. Esta migration prepara o lado Supabase:
--   1) tabela de tokens FCM por prestador + RPC de registo (app chama);
--   2) fila de push (outbox) alimentada por INSERT em portal_notificacoes;
--   3) títulos/mensagens de "Novo chamado em aberto"/"Nova OS disponível".
--
-- O envio real é feito pela Edge Function `enviar-push` (FCM HTTP v1).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tokens FCM por prestador
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.motorista_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  app_version text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT motorista_push_tokens_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_prestador_ativo
  ON public.motorista_push_tokens (prestador_id)
  WHERE ativo = true;

ALTER TABLE public.motorista_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON public.motorista_push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_own" ON public.motorista_push_tokens;
DROP POLICY IF EXISTS "push_tokens_update_own" ON public.motorista_push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own" ON public.motorista_push_tokens;

CREATE POLICY "push_tokens_select_own" ON public.motorista_push_tokens
  FOR SELECT TO authenticated
  USING (prestador_id IN (SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()));

CREATE POLICY "push_tokens_insert_own" ON public.motorista_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (prestador_id IN (SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()));

CREATE POLICY "push_tokens_update_own" ON public.motorista_push_tokens
  FOR UPDATE TO authenticated
  USING (prestador_id IN (SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()))
  WITH CHECK (prestador_id IN (SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()));

CREATE POLICY "push_tokens_delete_own" ON public.motorista_push_tokens
  FOR DELETE TO authenticated
  USING (prestador_id IN (SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_push_tokens TO authenticated;
GRANT ALL ON public.motorista_push_tokens TO service_role;

-- RPC chamada pelo app após obter o token FCM.
CREATE OR REPLACE FUNCTION public.f_registrar_push_token(
  p_token text,
  p_platform text DEFAULT 'android',
  p_app_version text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prestador_id uuid;
  v_id uuid;
  v_token text := btrim(COALESCE(p_token, ''));
BEGIN
  IF length(v_token) < 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Token FCM inválido.');
  END IF;

  SELECT id INTO v_prestador_id
    FROM public.prestadores
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Prestador não identificado.');
  END IF;

  INSERT INTO public.motorista_push_tokens (prestador_id, token, platform, app_version, ativo, updated_at)
  VALUES (
    v_prestador_id,
    v_token,
    COALESCE(NULLIF(btrim(p_platform), ''), 'android'),
    NULLIF(btrim(p_app_version), ''),
    true,
    now()
  )
  ON CONFLICT (token) DO UPDATE
     SET prestador_id = EXCLUDED.prestador_id,
         platform = EXCLUDED.platform,
         app_version = EXCLUDED.app_version,
         ativo = true,
         updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'prestador_id', v_prestador_id);
END;
$$;

REVOKE ALL ON FUNCTION public.f_registrar_push_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_registrar_push_token(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.f_remover_push_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_atualizados integer;
BEGIN
  UPDATE public.motorista_push_tokens t
     SET ativo = false,
         updated_at = now()
   WHERE t.token = btrim(COALESCE(p_token, ''))
     AND t.prestador_id IN (SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid());

  GET DIAGNOSTICS v_atualizados = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'desativados', v_atualizados);
END;
$$;

REVOKE ALL ON FUNCTION public.f_remover_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_remover_push_token(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fila de push (outbox) — alimentada por portal_notificacoes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_notificacoes_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid REFERENCES public.portal_notificacoes(id) ON DELETE SET NULL,
  prestador_id uuid NOT NULL,
  titulo text,
  mensagem text,
  tipo text NOT NULL DEFAULT 'nova_os',
  os_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviando', 'enviado', 'erro', 'sem_token')),
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_fila_status_created
  ON public.push_notificacoes_fila (status, created_at);

ALTER TABLE public.push_notificacoes_fila ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role (Edge Function) acede.
GRANT ALL ON public.push_notificacoes_fila TO service_role;

CREATE OR REPLACE FUNCTION public.f_trg_enfileirar_push_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.push_notificacoes_fila (
    notificacao_id, prestador_id, titulo, mensagem, tipo, os_id, payload
  ) VALUES (
    NEW.id,
    NEW.prestador_id,
    NEW.titulo,
    NEW.mensagem,
    COALESCE(NULLIF(NEW.tipo, ''), 'nova_os'),
    COALESCE(NEW.os_id, CASE WHEN NEW.origem_tipo = 'ordens_servico' THEN NEW.origem_id END),
    COALESCE(NEW.metadata, '{}'::jsonb)
      || jsonb_build_object('routing', COALESCE(NEW.metadata ->> 'routing', '/notifications'))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enfileirar_push_notificacao ON public.portal_notificacoes;
CREATE TRIGGER trg_enfileirar_push_notificacao
  AFTER INSERT ON public.portal_notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_enfileirar_push_notificacao();

-- ---------------------------------------------------------------------------
-- 3. Notificação ao alocar diretamente o prestador — "Novo chamado em aberto"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_trg_notificar_os_para_app()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero text := COALESCE(NEW.numero, SUBSTRING(NEW.id::TEXT, 1, 8));
BEGIN
  IF NEW.prestador IS NOT NULL AND (OLD IS NULL OR OLD.prestador IS DISTINCT FROM NEW.prestador) THEN
    INSERT INTO public.portal_notificacoes (
      prestador_id, os_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at, metadata
    ) VALUES (
      NEW.prestador,
      NEW.id,
      'Novo chamado em aberto',
      format('Nova OS %s disponível para você.', v_numero),
      'nova_os',
      NEW.id,
      'ordens_servico',
      false,
      NOW(),
      jsonb_build_object(
        'os_id', NEW.id,
        'numero', v_numero,
        'rota', concat_ws(' → ', NULLIF(NEW.origem, ''), NULLIF(NEW.destino, '')),
        'click_action', 'FLUTTER_NOTIFICATION_CLICK'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Oportunidade publicada na Rede — "Nova OS disponível"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_trg_notificar_oportunidade_rede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'publicada' THEN
    INSERT INTO public.portal_notificacoes (
      prestador_id, os_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at, metadata
    ) SELECT
      p.id,
      NEW.os_id,
      'Nova OS disponível',
      format('Nova oportunidade #%s disponível na sua região.', UPPER(SUBSTRING(NEW.os_id::TEXT, 1, 8))),
      'nova_oportunidade',
      NEW.id,
      'rede_oportunidades',
      false,
      NOW(),
      jsonb_build_object(
        'regiao', NEW.regiao,
        'valor', NEW.valor_prestador,
        'os_id', NEW.os_id,
        'click_action', 'FLUTTER_NOTIFICATION_CLICK'
      )
    FROM public.prestadores p
    WHERE p.status = 'ativo'
      AND (NEW.regiao IS NULL OR p.regiao_principal ILIKE '%' || COALESCE(NEW.regiao, '') || '%')
    LIMIT 50;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
