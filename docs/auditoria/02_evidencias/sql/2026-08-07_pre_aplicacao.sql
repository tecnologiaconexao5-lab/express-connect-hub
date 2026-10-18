-- EVIDÊNCIA PRÉ-APLICAÇÃO (2026-07-27T04:52:58Z)
-- Capturado por consulta SELECT-only via pg service_role

-- POLICIES (6):
-- 1. alocacoes_escala_insert_anon     {public}  INSERT  qual:null         wc:true
-- 2. alocacoes_escala_select_anon     {public}  SELECT  qual:true         wc:null
-- 3. alocacoes_escala_update_anon     {public}  UPDATE  qual:true         wc:true
-- 4. alocacoes_escala_update_authenticated {public} UPDATE qual:auth.role()  wc:auth.role()
-- 5. Prestador can update own alocacoes  {authenticated} UPDATE (prestador check)
-- 6. Prestador can view own alocacoes    {authenticated} SELECT  (prestador check)

-- GRANTS anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE (7)

-- RLS: true | FORCE RLS: false

-- TOTAL: 176 registros
-- aceita:6  aguardando_aceite:66  cancelada:4  concluida:53
-- em_rota:11  planejada:34  recusada:2

-- TENANT DISTRIBUTION: 176/176 com tenant_id
