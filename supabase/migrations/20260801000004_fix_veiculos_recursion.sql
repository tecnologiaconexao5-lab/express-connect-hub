-- ===================================================================
-- HOTFIX — Infinite recursion no RLS de veiculos
--
-- Causa raiz:
--   veiculos_select_portal → subconsulta em prestadores →
--   prestadores_select_portal → subconsulta em alocacoes_escala →
--   alocacoes_escala RLS → clientes RLS → f_usuario_pode_acessar_cliente() →
--   clientes → veiculos (loop fechado via função)
--
-- Solução:
--   Simplificar veiculos_select_portal para usar f_obter_cliente_id_do_usuario()
--   diretamente, sem subconsulta cruzada que fecha o ciclo.
-- ===================================================================

DROP POLICY IF EXISTS veiculos_select_portal ON public.veiculos;

CREATE POLICY veiculos_select_portal ON public.veiculos
    FOR SELECT
    TO authenticated
    USING (
        f_obter_cliente_id_do_usuario() IS NOT NULL
    );

-- prestadores_select_portal tinha mesma subconsulta cruzada
DROP POLICY IF EXISTS prestadores_select_portal ON public.prestadores;

CREATE POLICY prestadores_select_portal ON public.prestadores
    FOR SELECT
    TO authenticated
    USING (
        f_obter_cliente_id_do_usuario() IS NOT NULL
    );
