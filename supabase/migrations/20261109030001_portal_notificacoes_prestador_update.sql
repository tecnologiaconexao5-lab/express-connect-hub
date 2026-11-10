-- ============================================================================
-- PUSH MOTORISTA — RLS: prestador pode marcar as suas notificações como lidas
-- Data: 2026-11-09
--
-- `portal_notificacoes` já permite SELECT das notificações do próprio
-- prestador (`pn_select_own`), mas o UPDATE só existia para clientes.
-- Sem esta policy, o app não consegue marcar a notificação como lida.
-- ============================================================================

DROP POLICY IF EXISTS "pn_update_prestador_own" ON public.portal_notificacoes;

CREATE POLICY "pn_update_prestador_own" ON public.portal_notificacoes
  FOR UPDATE TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
