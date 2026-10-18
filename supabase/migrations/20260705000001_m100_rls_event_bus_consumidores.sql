-- ============================================================
-- M100 — RLS Correção: Event Bus Consumidores
-- Data: 2026-07-05
-- 
-- Corrige RLS de eventos_oficiais:
-- 1. anon: SELECT apenas com visibility='public', sem INSERT
-- 2. authenticated: SELECT tudo do tenant, INSERT permitido
-- ============================================================

-- Remove policies permissivas da M99
DROP POLICY IF EXISTS "eventos_oficiais_admin_select" ON public.eventos_oficiais;
DROP POLICY IF EXISTS "eventos_oficiais_admin_insert" ON public.eventos_oficiais;

-- Policy 1: anon pode SELECT apenas eventos públicos
CREATE POLICY "eventos_oficiais_anon_select_public"
    ON public.eventos_oficiais FOR SELECT
    TO anon
    USING (visibility = 'public');

-- Policy 2: authenticated pode SELECT tudo do seu tenant
CREATE POLICY "eventos_oficiais_auth_select"
    ON public.eventos_oficiais FOR SELECT
    TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- Policy 3: authenticated pode INSERT (qualquer tenant — processo confiável)
CREATE POLICY "eventos_oficiais_auth_insert"
    ON public.eventos_oficiais FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy 4 (mantida): UPDATE apenas do mesmo tenant
-- (já existe: eventos_oficiais_admin_update)

-- Policy 5 (mantida): DELETE apenas do mesmo tenant
-- (já existe: eventos_oficiais_admin_delete)
