# PLANO DE ROLLBACK — F2-A1 RLS ordens_servico

**Migration:** `20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql`
**Risco:** Baixo (apenas policies, sem alteração de dados)

---

## Procedimento de Rollback

Caso a migration cause problemas, executar no SQL Editor do Supabase:

```sql
BEGIN;

-- Remover policies criadas pela migration F2-A1
DROP POLICY IF EXISTS "os_select_authenticated" ON ordens_servico;

-- Restaurar policies originais (pré-F2-A1)
-- ATENÇÃO: Isso re-expõe anon e mantém cast inseguro
CREATE POLICY "os_select_tenant" ON ordens_servico
FOR SELECT TO anon, authenticated
USING (tenant_id = current_tenant_id_safe());

CREATE POLICY "os_insert_tenant" ON ordens_servico
FOR INSERT TO authenticated
WITH CHECK (tenant_id = current_tenant_id_safe());

CREATE POLICY "os_update_tenant" ON ordens_servico
FOR UPDATE TO authenticated
USING (tenant_id = current_tenant_id_safe());

CREATE POLICY "os_delete_tenant" ON ordens_servico
FOR DELETE TO authenticated
USING (tenant_id = current_tenant_id_safe());

COMMIT;
```

## Verificação pós-rollback

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'ordens_servico';
-- EXPECT: os_select_tenant, os_insert_tenant, os_update_tenant, os_delete_tenant
-- EXPECT: os_select_authenticated NÃO deve existir
```

## Tempo estimado de rollback: < 1 minuto

## Risco do rollback

Restaurar a policy `os_select_tenant` com `TO anon` re-expõe os dados a usuários anônimos (comportamento original). Se o motivo do rollback for outro, avaliar se essa re-exposição é aceitável temporariamente.
