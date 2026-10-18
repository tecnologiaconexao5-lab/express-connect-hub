-- BACKUP HOTFIX CLIENTES RLS (pré-alteração) — restauração manual em caso de rollback
-- Gerado automaticamente. Estado anterior a aplicar 20260817_hotfix_clientes_rls_insert.sql
-- 2026-08-17T14:05:27.914Z

-- ══ ESTADO ANTERIOR (f_usuario_pode_acessar_cliente / clientes_insert_own) ══
CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_cliente(p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
        DECLARE v_tenant_id uuid; v_papel text;
        BEGIN
          SELECT tu.tenant_id, COALESCE(tu.papel, '') INTO v_tenant_id, v_papel
          FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid();
          IF v_tenant_id IS NULL THEN RETURN false; END IF;
          IF v_papel IN ('super_admin', 'admin') THEN RETURN true; END IF;
          IF EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p_cliente_id AND c.tenant_id = v_tenant_id)
          THEN RETURN true; END IF;
          RETURN false;
        END; $function$
;
-- policy clientes_insert_own cmd=INSERT roles="{authenticated}" with_check=f_usuario_pode_acessar_cliente(id)
