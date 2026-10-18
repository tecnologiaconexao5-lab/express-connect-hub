-- ===================================================================
-- ETAPA 3b — Correção de role nas policies de portal_tracking_realtime
--
-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SUPERSEDED by TMS-023B                                         ║
-- ║                                                                 ║
-- ║  Esta migration foi incorporada diretamente no script único     ║
-- ║  TMS-023_TRACKING_INCREMENTAL.sql.                               ║
-- ║                                                                 ║
-- ║  NÃO EXECUTAR ESTE ARQUIVO ISOLADAMENTE.                         ║
-- ║  As policies com TO authenticated já estão no incremental.      ║
-- ║  Se executado após o incremental, será redundante e seguro.     ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- ===================================================================

ALTER POLICY portal_tracking_insert ON public.portal_tracking_realtime
    TO authenticated;

DROP POLICY IF EXISTS tracking_insert_prestador ON public.portal_tracking_realtime;
CREATE POLICY tracking_insert_prestador ON public.portal_tracking_realtime
    FOR INSERT
    TO authenticated
    WITH CHECK (
        prestador_id IN (
            SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS tracking_prestador_select ON public.portal_tracking_realtime;
CREATE POLICY tracking_prestador_select ON public.portal_tracking_realtime
    FOR SELECT
    TO authenticated
    USING (
        prestador_id IN (
            SELECT id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
        OR tenant_id IN (
            SELECT tenant_id FROM public.prestadores WHERE auth_user_id = auth.uid()
        )
    );
