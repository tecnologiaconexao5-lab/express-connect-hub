# DIAGNÓSTICO — F2-A1 RLS ordens_servico

**Data:** 2026-07-23
**Missão:** 136-C.2-F2-A1 — Correção Controlada da RLS de ordens_servico

---

## 1. CAUSA RAIZ

| Componente | Causa raiz | Evidência |
|------------|------------|-----------|
| Policy `os_select_tenant` | `USING (tenant_id = current_tenant_id_safe())` — `tenant_id` é TEXT, `current_tenant_id_safe()` retorna UUID. Comparação causa cast implícito TEXT→UUID. | Migration `20260626_missao16_multitenant_rls_p0.sql:123` |
| `tenant_id` column | Tipo TEXT (tabela criada antes da convenção UUID). Algumas linhas contêm "M43_2026-06-29_18-27-54 Cliente" — não-UUID. | Script `qa04_debug_os.ts`: 6/49 OS IDs falham com `invalid input syntax for type uuid` |
| Policy expõe anon | `os_select_tenant` concede SELECT a `anon`. `current_tenant_id_safe()` retorna fallback `00000000-0000-0000-0000-000000000001` para anon, expondo OS desse tenant. | Migration `20260626_missao16_multitenant_rls_p0.sql:123` — `TO anon, authenticated` |

## 2. POLÍTICA ATUAL

```sql
CREATE POLICY "os_select_tenant" ON ordens_servico
FOR SELECT TO anon, authenticated
USING (tenant_id = current_tenant_id_safe());
```

## 3. POLÍTICA PROPOSTA

```sql
CREATE POLICY "os_select_authenticated" ON ordens_servico
FOR SELECT TO authenticated
USING (
  (
    tenant_id IS NOT NULL
    AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND tenant_id::uuid = current_tenant_id_safe()
  )
  OR
  f_usuario_pode_acessar_cliente(cliente_id)
);
```

## 4. DIFERENÇAS

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Anon | Acesso via policy | **Bloqueado** (sem policy para anon) |
| Cast inseguro | `tenant_id = current_tenant_id_safe()` (cast implícito) | `tenant_id ~ regex AND tenant_id::uuid = ...` (safe cast) |
| Registro legado | Causa `invalid input syntax for type uuid` | **Filtrado** (regex retorna false, linha invisível) |
| Cliente (Portal) | Apenas por tenant_id | **Também por cliente_id** via `f_usuario_pode_acessar_cliente` |

## 5. MIGRATION CRIADA

`supabase/migrations/20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql`

## 6. NENHUMA OUTRA TABELA ALTERADA

A migration modifica exclusivamente `public.ordens_servico`.

## 7. NENHUM DADO MODIFICADO

A migration não contém UPDATE, INSERT ou DELETE em dados.
