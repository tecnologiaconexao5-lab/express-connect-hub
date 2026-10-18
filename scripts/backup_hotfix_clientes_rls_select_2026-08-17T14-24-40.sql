-- BACKUP clientes_select_own (pré-correção) — 2026-08-17T14:24:40.483Z

-- roles="{anon,authenticated}" cmd=SELECT
-- qual=(f_usuario_pode_acessar_cliente(id) OR (id = f_obter_cliente_id_do_usuario()) OR ((CURRENT_USER = 'authenticated'::name) AND (tenant_id IS NOT NULL) AND f_usuario_pode_acessar_tenant(tenant_id)))
-- with_check=null
