-- =================================================================================
-- MISSÃO A22 — ROLLBACK da migration 20260812_a22_chat_operacional.sql
-- Restaura Produção ao estado anterior (inclui os gaps de portal_notificacoes,
-- que foram corrigidos pela migration; o rollback os restaura por fidelidade).
-- Uso SOMENTE se a migration precisar ser revertida.
-- =================================================================================

-- 1. Remover da publication supabase_realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'operacao_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.operacao_mensagens;
  END IF;
END $$;

-- 2. Dropar RPCs
DROP FUNCTION IF EXISTS public.f_enviar_mensagem_torre(uuid, text, text);
DROP FUNCTION IF EXISTS public.f_responder_mensagem_torre(uuid, text, text);
DROP FUNCTION IF EXISTS public.f_marcar_mensagens_lidas_app(uuid);
DROP FUNCTION IF EXISTS public.f_marcar_mensagens_lidas_torre(uuid);
DROP FUNCTION IF EXISTS public.f_contar_mensagens_nao_lidas_torre();

-- 3. Dropar tabela
DROP TABLE IF EXISTS public.operacao_mensagens;

-- 4. Restaurar policies de portal_notificacoes ao estado anterior
DROP POLICY IF EXISTS "pn_select_own" ON public.portal_notificacoes;
CREATE POLICY "pn_select_own" ON public.portal_notificacoes
  FOR SELECT TO anon, authenticated
  USING (
    (cliente_id = public.f_obter_cliente_id_do_usuario())
    OR (prestador_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "notificacoes_select_authenticated" ON public.portal_notificacoes;
CREATE POLICY "notificacoes_select_authenticated" ON public.portal_notificacoes
  FOR SELECT TO authenticated
  USING (true);

-- FIM DO ROLLBACK A22
