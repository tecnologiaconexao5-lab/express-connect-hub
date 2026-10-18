# A23 — Policy RLS: Veículo do Prestador (INSERT autônomo)

**Data:** 2026-08-18
**Escopo:** somente alteração aditiva de RLS na tabela `veiculos` — nenhuma outra alteração.
**Status:** ✅ APLICADA E VALIDADA (15/15 checks read-only OK)

---

## 1. Migration criada

| Item | Valor |
|---|---|
| Arquivo | `supabase/migrations/20260818_a23_veiculos_insert_prestador.sql` |
| Script de aplicação | `scripts/a23_aplicar_policy_veiculos.mjs` (transação + verificação pré/pós) |
| Tipo | ADITIVA — não altera tabelas/colunas/policies existentes |

---

## 2. Project ref confirmado

- `supabase projects list` → **`uwrvzsjtpgaifkktpepn`** (conexao-express-tms, São Paulo)
- `.env` → `VITE_SUPABASE_URL=https://uwrvzsjtpgaifkktpepn.supabase.co`
- `DATABASE_URL` → username `postgres.uwrvzsjtpgaifkktpepn` (validação no script de aplicação aborta se diferente)
- **CONFIRMADO: exatamente `uwrvzsjtpgaifkktpepn`**

---

## 3. SQL exato aplicado

```sql
DROP POLICY IF EXISTS veiculos_insert_prestador ON public.veiculos;

CREATE POLICY veiculos_insert_prestador ON public.veiculos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM prestadores p
            WHERE p.id = veiculos.prestador_vinculado
              AND p.auth_user_id = auth.uid()
        )
    );
```

Aplicado dentro de transação (`BEGIN`/`COMMIT`) no banco oficial — **COMMIT OK**.

---

## 4. Policy criada

| Atributo | Valor |
|---|---|
| Nome | `veiculos_insert_prestador` |
| Comando | `INSERT` |
| Permissividade | `PERMISSIVE` |
| Role | `authenticated` (sem `anon`/`public`) |
| Cláusula | `WITH CHECK` (INSERT usa apenas WITH CHECK; `USING` vazio) |
| Condição | `prestadores.id = veiculos.prestador_vinculado` **E** `prestadores.auth_user_id = auth.uid()` |

Garantias de segurança:

- `prestador_vinculado` **NULL é rejeitado** (`p.id = NULL` nunca satisfaz `EXISTS`).
- **Impossível inserir veículo de outro prestador** — a identidade é fixada por `auth_user_id = auth.uid()`.
- Subquery lê apenas a própria linha do prestador (permitida pela policy existente `prestadores_select_own`).
- Sem `anon`, sem `USING true`, sem `WITH CHECK true`, sem UPDATE/DELETE.
- RLS não desabilitado (`relrowsecurity=true` mantido; `force=false` como antes).

---

## 5. Validação das policies existentes (antes → depois)

| Policy | Antes | Depois |
|---|:---:|:---:|
| `veiculos_select_tms` | ✅ | ✅ preservada |
| `veiculos_insert_tms` | ✅ | ✅ preservada |
| `veiculos_update_tms` | ✅ | ✅ preservada |
| `veiculos_delete_tms` | ✅ | ✅ preservada |
| `veiculos_select_portal` | ✅ | ✅ preservada |
| `veiculos_insert_prestador` | — | ✅ **NOVA** |

Total: 5 → 6 policies. Nenhuma removida ou modificada.

---

## 6. Validação final (read-only) — 15/15 OK

- ✅ RLS continua habilitado em `veiculos`
- ✅ 5 policies antigas preservadas (nenhuma removida)
- ✅ Nova policy `veiculos_insert_prestador` criada (INSERT, PERMISSIVE)
- ✅ Restrita a `authenticated`
- ✅ Condição usa simultaneamente `prestadores.id = prestador_vinculado` e `prestadores.auth_user_id = auth.uid()`
- ✅ Sem `USING true` / `WITH CHECK true`; INSERT só com `WITH CHECK`
- ✅ Nenhuma outra alteração de banco (colunas `veiculos` = 37, inalteradas)

---

## 7. Confirmação de não-alteração

- ❌ Nenhuma tabela/coluna alterada
- ❌ Nenhuma tela do TMS alterada
- ❌ Nenhum cadastro do TMS alterado
- ❌ Nenhum documento/Recrutamento/App Flutter alterado
- ❌ Nenhum RPC criado
- ❌ Nenhum veículo fictício criado em produção (somente leitura nas validações)
- ❌ Build/suíte ampla não executados (conforme escopo)

---

## 8. Teste manual sugerido (QA, fora desta missão)

Com usuário autenticado do App cujo `prestadores.auth_user_id = auth.uid()`:

- `INSERT` em `veiculos` com `prestador_vinculado = <seu prestadores.id>` → deve passar.
- `INSERT` com `prestador_vinculado` de outro prestador ou `NULL` → deve falhar (`row-level security violation`).
