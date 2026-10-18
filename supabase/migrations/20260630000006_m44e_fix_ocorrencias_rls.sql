-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 44E — CORREÇÃO RLS ocorrencias (permitir INSERT anon)
-- O INSERT policy original só permitia 'authenticated', mas o sistema
-- usa anon key para operações (padrão do projeto). Esta correção alinha
-- com o comportamento das demais tabelas.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ocorrencias_insert_tenant" ON public.ocorrencias;
CREATE POLICY "ocorrencias_insert_tenant" ON public.ocorrencias
    FOR INSERT TO anon, authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());
