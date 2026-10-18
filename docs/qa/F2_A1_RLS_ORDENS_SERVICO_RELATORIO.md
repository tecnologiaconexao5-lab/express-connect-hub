# GATE — F2-A1 RLS ordens_servico

**Status:** 🔶 AGUARDANDO APROVAÇÃO HUMANA
**Migration:** `20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql`
**Impacto:** Exclusivo em `public.ordens_servico`. Nenhuma outra tabela alterada. Nenhum dado modificado.

---

## 1. Causa raiz

`tenant_id` é do tipo TEXT (tabela criada antes da convenção UUID). A policy `os_select_tenant` faz `tenant_id = current_tenant_id_safe()` — comparação TEXT = UUID que causa cast implícito. Seis registros legados têm "M43_2026-06-29_18-27-54 Cliente" em `tenant_id`, causando `invalid input syntax for type uuid`.

## 2. Policy atual

```sql
CREATE POLICY "os_select_tenant" ON ordens_servico
FOR SELECT TO anon, authenticated
USING (tenant_id = current_tenant_id_safe());
```

## 3. Policy proposta

```sql
CREATE POLICY "os_select_authenticated" ON ordens_servico
FOR SELECT TO authenticated
USING (
  (tenant_id IS NOT NULL
   AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND tenant_id::uuid = current_tenant_id_safe())
  OR f_usuario_pode_acessar_cliente(cliente_id)
);
```

## 4. Diff da migration

```
- os_select_tenant (SELECT TO anon, authenticated — cast inseguro)
+ os_select_authenticated (SELECT TO authenticated — safe cast + cliente check)
- os_insert_tenant (recriada com safe cast — mesmo comportamento)
- os_update_tenant (recriada com safe cast — mesmo comportamento)
- os_delete_tenant (recriada com safe cast — mesmo comportamento)
```

## 5. Testes preparados

| Arquivo | Tipo | Testes |
|---------|------|--------|
| `tests/e2e/m136c2-f2-a1-rls-ordens-servico.spec.ts` | Playwright | 8 |
| `tests/database/m136c2-f2-a1-rls-ordens-servico.sql` | SQL conceitual | 10 |

## 6. Impacto por perfil

| Perfil | Antes | Depois | Impacto |
|--------|-------|--------|---------|
| Anon | Acessa OS do tenant default | **Bloqueado** ⚠️ | Pode afetar scripts que dependem de anon |
| Super admin | Vê OS do tenant (com erro UUID em 6 linhas) | Vê OS do tenant + cliente (sem erro) | ✅ Melhora |
| Admin | Vê OS do tenant (com erro UUID) | Vê OS do tenant (sem erro) | ✅ Melhora |
| Operador | Vê OS do tenant (com erro UUID) | Vê OS do tenant (sem erro) | ✅ Melhora |
| Financeiro | Vê OS do tenant (com erro UUID) | Vê OS do tenant (sem erro) | ✅ Melhora |
| Comercial | Vê OS do tenant (com erro UUID) | Vê OS do tenant (sem erro) | ✅ Melhora |
| Cliente | Vê OS por tenant (quando same tenant) | Vê OS por cliente_id também | ✅ Melhora |
| Atendimento | Vê OS do tenant (com erro UUID) | Vê OS do tenant (sem erro) | ✅ Melhora |

## 7. Risco

| Risco | Severidade | Probabilidade | Mitigação |
|-------|-----------|:-------------:|-----------|
| Cliente do Portal perder acesso a OS | Alta | Baixa | Policy tem OR f_usuario_pode_acessar_cliente(cliente_id) |
| Super admin perder acesso a OS sem cliente_id | Média | Média | super_admin retorna true em f_usuario_pode_acessar_cliente mesmo com NULL |
| Script legado que usa anon para ler OS quebra | Média | Alta | Anon precisa de conta de serviço ou autenticação |
| 6 registros legados ficam invisíveis | Baixa | Alta | Comportamento esperado — dados corrompidos |

## 8. Rollback

Ver `docs/qa/F2_A1_RLS_ORDENS_SERVICO_ROLLBACK.md`. Rollback em < 1 minuto via SQL Editor.

## 9. Confirmações

- ✅ Nenhuma outra tabela será alterada
- ✅ Nenhum dado será modificado
- ✅ Apenas policies de `ordens_servico` são afetadas
- ✅ INSERT/UPDATE/DELETE recriados com safe cast (idênticos exceto segurança)
- ✅ Migration é idempotente (DROP IF EXISTS + CREATE)

## 10. Classificação

| Critério | Valor |
|----------|-------|
| Migration segura para aplicação controlada? | **SIM** |
| Migration deve ser aplicada automaticamente? | **NÃO** — aguardar aprovação humana |
| Risco de regressão | Baixo |
| Risco de perda de dados | Zero |
| Complexidade | Baixa |
| Rollback rápido? | Sim (< 1 min) |
