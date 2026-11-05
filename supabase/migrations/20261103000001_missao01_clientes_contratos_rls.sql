-- MISSÃO 1 — Uploads de documentos existentes.
-- MOTIVO: `public.clientes_contratos` está com RLS habilitada e SEM nenhuma policy
--         em produção (drift em relação a `sql/alter_clientes_flags_comercial.sql`).
--         O SELECT do app retorna vazio e o INSERT do contrato é recusado
--         ("new row violates row-level security policy"), impedindo o vínculo do
--         anexo enviado ao Storage.
-- IMPACTO: apenas libera as operações de contrato para usuários autenticados que
--          já podem acessar o cliente (mesma função usada pelas policies de
--          `clientes`). Não altera dados, colunas, cálculos ou registros existentes.
-- ROLLBACK: DROP POLICY das 4 policies criadas abaixo.
-- Migration ADITIVA (CREATE POLICY), sem DDL destrutivo.

DROP POLICY IF EXISTS "cc_select_access" ON public.clientes_contratos;
DROP POLICY IF EXISTS "cc_insert_access" ON public.clientes_contratos;
DROP POLICY IF EXISTS "cc_update_access" ON public.clientes_contratos;
DROP POLICY IF EXISTS "cc_delete_access" ON public.clientes_contratos;

CREATE POLICY "cc_select_access" ON public.clientes_contratos
  FOR SELECT TO authenticated
  USING (public.f_usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "cc_insert_access" ON public.clientes_contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.f_usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "cc_update_access" ON public.clientes_contratos
  FOR UPDATE TO authenticated
  USING (public.f_usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.f_usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "cc_delete_access" ON public.clientes_contratos
  FOR DELETE TO authenticated
  USING (public.f_usuario_pode_acessar_cliente(cliente_id));

NOTIFY pgrst, 'reload schema';
