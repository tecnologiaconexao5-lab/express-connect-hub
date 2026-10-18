-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 108-A
-- Fix: Criar RPC set_tenant_context que estava faltando
-- Causando erro 404 no TenantProvider
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_tenant_context(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', p_tenant_id::TEXT, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_tenant_context TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_context TO anon;
