-- ===================================================================
-- ETAPA 3 — Remoção de Policies Fiscais Vulneráveis
--
-- Problema: 13 policies em 7 tabelas fiscais estavam com
-- roles={public} e/ou qual=true, permitindo acesso anônimo.
-- As policies scoped corretas (fcte_*, fnfse_*, fmdfe_*) já existem.
--
-- Solução: DROP das policies vulneráveis, mantendo apenas
-- as policies scoped (authenticated + tenant_usuarios guard).
-- ===================================================================

-- ===================================================================
-- 1. fiscal_ctes
-- ===================================================================
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.fiscal_ctes;

-- ===================================================================
-- 2. fiscal_documentos_vinculados (5 policies públicas)
-- ===================================================================
DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_documentos_vinculados;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.fiscal_documentos_vinculados;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.fiscal_documentos_vinculados;
DROP POLICY IF EXISTS "Enable select for authenticated" ON public.fiscal_documentos_vinculados;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.fiscal_documentos_vinculados;

-- ===================================================================
-- 3. fiscal_events (2 policies públicas)
-- ===================================================================
DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_events;
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.fiscal_events;

-- ===================================================================
-- 4. fiscal_historico_status (1 policy pública)
-- ===================================================================
DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_historico_status;

-- ===================================================================
-- 5. fiscal_logs (2 policies públicas)
-- ===================================================================
DROP POLICY IF EXISTS "Allow all operations" ON public.fiscal_logs;
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.fiscal_logs;

-- ===================================================================
-- 6. fiscal_mdfes
-- ===================================================================
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.fiscal_mdfes;

-- ===================================================================
-- 7. fiscal_nfse
-- ===================================================================
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.fiscal_nfse;

-- ===================================================================
-- 8. CRIAR POLICIES MÍNIMAS PARA TABELAS SEM COBERTURA
--    (fiscal_documentos_vinculados, fiscal_events,
--     fiscal_historico_status, fiscal_logs)
--    Apenas SELECT para authenticated com tenant_usuarios guard.
-- ===================================================================
-- fiscal_documentos_vinculados — SELECT scoped
DROP POLICY IF EXISTS fdv_select_tms ON public.fiscal_documentos_vinculados;
CREATE POLICY fdv_select_tms ON public.fiscal_documentos_vinculados
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_usuarios
            WHERE tenant_usuarios.user_id = auth.uid()
        )
    );

-- fiscal_events — SELECT scoped
DROP POLICY IF EXISTS fe_select_tms ON public.fiscal_events;
CREATE POLICY fe_select_tms ON public.fiscal_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_usuarios
            WHERE tenant_usuarios.user_id = auth.uid()
        )
    );

-- fiscal_historico_status — SELECT scoped
DROP POLICY IF EXISTS fhs_select_tms ON public.fiscal_historico_status;
CREATE POLICY fhs_select_tms ON public.fiscal_historico_status
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_usuarios
            WHERE tenant_usuarios.user_id = auth.uid()
        )
    );

-- fiscal_logs — SELECT scoped
DROP POLICY IF EXISTS fl_select_tms ON public.fiscal_logs;
CREATE POLICY fl_select_tms ON public.fiscal_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_usuarios
            WHERE tenant_usuarios.user_id = auth.uid()
        )
    );

-- fiscal_documentos_vinculados — INSERT/UPDATE para TMS autenticado
DROP POLICY IF EXISTS fdv_insert_tms ON public.fiscal_documentos_vinculados;
CREATE POLICY fdv_insert_tms ON public.fiscal_documentos_vinculados
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_usuarios
            WHERE tenant_usuarios.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS fdv_update_tms ON public.fiscal_documentos_vinculados;
CREATE POLICY fdv_update_tms ON public.fiscal_documentos_vinculados
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_usuarios
            WHERE tenant_usuarios.user_id = auth.uid()
        )
    );
