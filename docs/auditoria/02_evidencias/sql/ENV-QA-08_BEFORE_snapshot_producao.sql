-- ============================================================
-- ENV-QA-08: BEFORE SNAPSHOT — PRODUCTION STATE (READ-ONLY)
-- Data: 2026-09-20 19:35:43
-- Projeto: uwrvzsjtpgaifkktpepn
-- ============================================================

-- 1. RLS STATUS
SELECT 'RLS_STATUS' as section, schemaname, tablename, rowsecurity as rls_enabled
FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN (
    'alocacoes_escala','ordens_servico','clientes',
    'documentos_prestadores','pagamentos_prestadores','portal_tracking_realtime',
    'portal_pedidos','portal_ocorrencias','entregas_protocolo',
    'portal_avaliacoes','portal_comprovantes','portal_rotas',
    'portal_relatorios','portal_notificacoes','portal_protocolos',
    'portal_preferencias_cliente','portal_faturas'
  )
ORDER BY tablename;

-- 2. ALL POLICIES ON AFFECTED TABLES
SELECT 'POLICIES' as section, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN (
    'alocacoes_escala','ordens_servico','clientes',
    'documentos_prestadores','pagamentos_prestadores','portal_tracking_realtime',
    'portal_pedidos','portal_ocorrencias','entregas_protocolo',
    'portal_avaliacoes','portal_comprovantes','portal_rotas',
    'portal_relatorios','portal_notificacoes','portal_protocolos',
    'portal_preferencias_cliente','portal_faturas'
  )
ORDER BY tablename, policyname;

-- 3. ROLES
SELECT 'ROLES' as section, rolname, rolsuper, rolcanlogin
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','supabase_admin','postgres')
ORDER BY rolname;

-- 4. KEY FUNCTIONS
SELECT 'FUNCTIONS' as section, proname, prosecdef, proconfig
FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('f_obter_cliente_id_do_usuario','f_usuario_pode_acessar_cliente',
    'current_tenant_id_safe','obter_cliente_id_do_usuario','f_usuario_pode_acessar_tenant')
ORDER BY proname;

-- 5. TENANT_USUARIOS COUNTS
SELECT 'TENANT_USUARIOS' as section, COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'ativo') as ativos,
  COUNT(DISTINCT tenant_id) as tenants
FROM tenant_usuarios;

-- 6. PRESTADORES COUNTS
SELECT 'PRESTADORES' as section, COUNT(*) as total,
  COUNT(*) FILTER (WHERE auth_user_id IS NOT NULL) as com_auth_uid
FROM prestadores;

-- 7. USUARIOS_CLIENTE COUNTS
SELECT 'USUARIOS_CLIENTE' as section, COUNT(*) as total,
  COUNT(*) FILTER (WHERE auth_user_id IS NOT NULL) as com_auth_uid
FROM usuarios_cliente;