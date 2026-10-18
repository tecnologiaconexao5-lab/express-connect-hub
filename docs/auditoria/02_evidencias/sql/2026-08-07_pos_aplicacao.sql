-- EVIDÊNCIA PÓS-APLICAÇÃO (2026-07-27T04:57:58Z)
-- Capturado por consulta SELECT-only via pg service_role

-- POLICIES (7):
-- 1. ae_delete_tms       {authenticated} DELETE  (tenant_usuarios subquery)
-- 2. ae_insert_tms       {authenticated} INSERT  (tenant_usuarios subquery)
-- 3. ae_select_cliente   {authenticated} SELECT  (f_obter_cliente_id_do_usuario)
-- 4. ae_select_tms       {authenticated} SELECT  (tenant_usuarios subquery)
-- 5. ae_update_tms       {authenticated} UPDATE  (tenant_usuarios subquery)
-- 6. Prestador can update own alocacoes  {authenticated} UPDATE (prestador check)
-- 7. Prestador can view own alocacoes    {authenticated} SELECT  (prestador check)

-- GRANTS anon: 0 (nenhum)

-- RLS: true | FORCE RLS: false

-- TOTAL: 176 registros (INALTERADO)
-- aceita:6  aguardando_aceite:66  cancelada:4  concluida:53
-- em_rota:11  planejada:34  recusada:2
-- (TODOS os status inalterados)

-- ANON REST API TEST: HTTP 401 (bloqueado)
-- AUTHENTICATED grants: mantidos (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER)
