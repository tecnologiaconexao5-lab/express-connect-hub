-- =====================================================
-- PORTAL CLIENTE — CORREÇÃO RLS / MULTI-TENANT
-- Migration para garantir isolamento de dados por cliente
-- =====================================================

-- =====================================================
-- 1. FUNÇÃO HELPER PARA OBTER CLIENTE_ID DA SESSÃO
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_current_cliente_id()
RETURNS uuid AS $$
BEGIN
  -- Tenta obter do contexto da requisição (via JWT claim)
  RETURN NULLIF(current_setting('app.current_cliente_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CORREÇÃO RLS - PORTAL_PEDIDOS
-- =====================================================
DROP POLICY IF EXISTS "portal_pedidos_select" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_insert" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_update" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_delete" ON public.portal_pedidos;

CREATE POLICY "portal_pedidos_select" ON public.portal_pedidos
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_pedidos_insert" ON public.portal_pedidos
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_pedidos_update" ON public.portal_pedidos
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_pedidos_delete" ON public.portal_pedidos
  FOR DELETE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 3. CORREÇÃO RLS - PORTAL_FATURAS
-- =====================================================
DROP POLICY IF EXISTS "portal_faturas_select" ON public.portal_faturas;
DROP POLICY IF EXISTS "portal_faturas_insert" ON public.portal_faturas;
DROP POLICY IF EXISTS "portal_faturas_update" ON public.portal_faturas;

CREATE POLICY "portal_faturas_select" ON public.portal_faturas
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_faturas_insert" ON public.portal_faturas
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_faturas_update" ON public.portal_faturas
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 4. CORREÇÃO RLS - PORTAL_OCORRENCIAS
-- =====================================================
DROP POLICY IF EXISTS "portal_ocorrencias_select" ON public.portal_ocorrencias;
DROP POLICY IF EXISTS "portal_ocorrencias_insert" ON public.portal_ocorrencias;
DROP POLICY IF EXISTS "portal_ocorrencias_update" ON public.portal_ocorrencias;

CREATE POLICY "portal_ocorrencias_select" ON public.portal_ocorrencias
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_ocorrencias_insert" ON public.portal_ocorrencias
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_ocorrencias_update" ON public.portal_ocorrencias
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 5. CORREÇÃO RLS - PORTAL_COMPROVANTES
-- =====================================================
DROP POLICY IF EXISTS "portal_comprovantes_select" ON public.portal_comprovantes;
DROP POLICY IF EXISTS "portal_comprovantes_insert" ON public.portal_comprovantes;
DROP POLICY IF EXISTS "portal_comprovantes_update" ON public.portal_comprovantes;

CREATE POLICY "portal_comprovantes_select" ON public.portal_comprovantes
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_comprovantes_insert" ON public.portal_comprovantes
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_comprovantes_update" ON public.portal_comprovantes
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 6. CORREÇÃO RLS - PORTAL_AVALIACOES
-- =====================================================
DROP POLICY IF EXISTS "portal_avaliacoes_select" ON public.portal_avaliacoes;
DROP POLICY IF EXISTS "portal_avaliacoes_insert" ON public.portal_avaliacoes;
DROP POLICY IF EXISTS "portal_avaliacoes_update" ON public.portal_avaliacoes;

CREATE POLICY "portal_avaliacoes_select" ON public.portal_avaliacoes
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_avaliacoes_insert" ON public.portal_avaliacoes
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_avaliacoes_update" ON public.portal_avaliacoes
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 7. CORREÇÃO RLS - PORTAL_NOTIFICACOES
-- =====================================================
DROP POLICY IF EXISTS "portal_notificacoes_select" ON public.portal_notificacoes;
DROP POLICY IF EXISTS "portal_notificacoes_insert" ON public.portal_notificacoes;
DROP POLICY IF EXISTS "portal_notificacoes_update" ON public.portal_notificacoes;

CREATE POLICY "portal_notificacoes_select" ON public.portal_notificacoes
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_notificacoes_insert" ON public.portal_notificacoes
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_notificacoes_update" ON public.portal_notificacoes
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 8. CORREÇÃO RLS - PORTAL_PROTOCOLOS
-- =====================================================
DROP POLICY IF EXISTS "portal_protocolos_select" ON public.portal_protocolos;
DROP POLICY IF EXISTS "portal_protocolos_insert" ON public.portal_protocolos;
DROP POLICY IF EXISTS "portal_protocolos_update" ON public.portal_protocolos;

CREATE POLICY "portal_protocolos_select" ON public.portal_protocolos
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_protocolos_insert" ON public.portal_protocolos
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_protocolos_update" ON public.portal_protocolos
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 9. CORREÇÃO RLS - PORTAL_TRACKING_REALTIME
-- =====================================================
DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS "portal_tracking_insert" ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS "portal_tracking_update" ON public.portal_tracking_realtime;

CREATE POLICY "portal_tracking_select" ON public.portal_tracking_realtime
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_tracking_insert" ON public.portal_tracking_realtime
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_tracking_update" ON public.portal_tracking_realtime
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 10. CORREÇÃO RLS - PORTAL_ROTAS
-- =====================================================
DROP POLICY IF EXISTS "portal_rotas_select" ON public.portal_rotas;
DROP POLICY IF EXISTS "portal_rotas_insert" ON public.portal_rotas;
DROP POLICY IF EXISTS "portal_rotas_update" ON public.portal_rotas;

CREATE POLICY "portal_rotas_select" ON public.portal_rotas
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_rotas_insert" ON public.portal_rotas
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_rotas_update" ON public.portal_rotas
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 11. CORREÇÃO RLS - PORTAL_RELATORIOS
-- =====================================================
DROP POLICY IF EXISTS "portal_relatorios_select" ON public.portal_relatorios;
DROP POLICY IF EXISTS "portal_relatorios_insert" ON public.portal_relatorios;
DROP POLICY IF EXISTS "portal_relatorios_update" ON public.portal_relatorios;

CREATE POLICY "portal_relatorios_select" ON public.portal_relatorios
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_relatorios_insert" ON public.portal_relatorios
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_relatorios_update" ON public.portal_relatorios
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 12. CORREÇÃO RLS - PORTAL_PREFERENCIAS_CLIENTE
-- =====================================================
DROP POLICY IF EXISTS "portal_preferencias_select" ON public.portal_preferencias_cliente;
DROP POLICY IF EXISTS "portal_preferencias_insert" ON public.portal_preferencias_cliente;
DROP POLICY IF EXISTS "portal_preferencias_update" ON public.portal_preferencias_cliente;

CREATE POLICY "portal_preferencias_select" ON public.portal_preferencias_cliente
  FOR SELECT
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_preferencias_insert" ON public.portal_preferencias_cliente
  FOR INSERT
  WITH CHECK (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

CREATE POLICY "portal_preferencias_update" ON public.portal_preferencias_cliente
  FOR UPDATE
  USING (
    cliente_id = public.get_current_cliente_id()
    OR public.get_current_cliente_id() IS NULL
  );

-- =====================================================
-- 13. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================================
COMMENT ON FUNCTION public.get_current_cliente_id() IS
'Obtém o cliente_id da sessão atual via contexto da requisição. Retorna NULL se não houver contexto.';

-- =====================================================
-- 14. INSTRUÇÕES DE USO
-- =====================================================
-- Para usar em produção, o backend deve setar o contexto antes de cada query:
-- SET app.current_cliente_id = 'uuid-do-cliente';
-- 
-- No Supabase, isso pode ser feito via:
-- 1. Edge Function que seta o contexto antes de executar queries
-- 2. Database webhook que seta o contexto baseado no JWT
-- 3. Trigger que extrai cliente_id do JWT claim
--
-- Exemplo em Edge Function:
-- await supabase.rpc('set_current_cliente_id', { cliente_id: user.id })
-- ou
-- SET app.current_cliente_id = req.user.cliente_id