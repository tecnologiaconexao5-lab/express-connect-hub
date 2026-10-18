# ROLLBACK — F2-A0-QA1

## Rollback do provisionamento QA (caso necessário)

### Supabase local
```bash
supabase stop
# Remove containers, volumes e dados locais
# Não afeta produção
```

### Supabase remoto QA
1. Dashboard > Project > Settings > General > **Delete project**
2. Confirmar exclusão (digitar nome do projeto)
3. Limpar credenciais de CI/CD

---

## Rollback da migration F2-A1 (já documentado em F2_A1_RLS_ORDENS_SERVICO_ROLLBACK.md)

```sql
BEGIN;
DROP POLICY IF EXISTS "os_select_authenticated" ON ordens_servico;
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

## Rollback de seed

Para limpar dados de seed do QA:
```sql
DELETE FROM ordens_servico WHERE observacoes LIKE 'QA-F2-A0-%';
DELETE FROM alocacoes_escala WHERE observacoes LIKE 'QA-F2-A0-%';
DELETE FROM clientes WHERE nome_fantasia LIKE 'QA-F2-A0-%';
DELETE FROM prestadores WHERE nome LIKE 'QA-F2-A0-%';
DELETE FROM veiculos WHERE placa LIKE 'QA-%';
DELETE FROM tenant_usuarios WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'qa-%');
DELETE FROM tenants WHERE slug LIKE 'qa-%';
```
