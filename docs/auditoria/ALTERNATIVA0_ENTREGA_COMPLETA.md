# ALTERNATIVA 0 — Entrega Completa

## Migration: `20260807_alternativa0_minimo_p0_alocacoes_escala.sql`

---

## 1. Migration completa

Arquivo: `supabase/migrations/20260807_alternativa0_minimo_p0_alocacoes_escala.sql`

**DDL puro.** Nenhum INSERT/UPDATE/DELETE.

---

## 2. Diff em relação à versão anterior (v1)

A migration v1 (`20260726_auditoria_fix_rls_alocacoes_escala.sql`) propunha:

- 3 policies `ae_select/insert/update_own` TO `public` (ainda permitia anon)
- Policies TMS usando `current_tenant_id_safe()` (bug do parâmetro)
- `ae_select_cliente` usando `f_obter_cliente_id_do_usuario()` (ok)
- REVOKE apenas INSERT/UPDATE/DELETE de anon (SELECT permanecia)

A Alternativa 0 corrige:

| Item | v1 | Alternativa 0 |
|------|:--:|:-------------:|
| Policies TO public | 3 criadas (mesmo role public) | **0** — NENHUMA |
| TMS policies | `current_tenant_id_safe()` | **Subquery tenant_usuarios** |
| REVOKE anon | Parcial (só INSERT/UPDATE/DELETE) | **ALL** (inclui SELECT) |
| Prestador policies | Drop + recria | **Preservada intocada** |
| Linhas SQL | 151 | **~140** |
| TS alterado | ❌ | ❌ |

---

## 3. Rollback completo

Arquivo: `supabase/migrations/20260807_alternativa0_rollback.sql`

Sequência:
1. DROP das 5 novas policies TMS + cliente
2. GRANT SELECT/INSERT/UPDATE/DELETE de volta a anon
3. Recria as 4 policies inseguras originais
4. DO block de validação

Tempo estimado: **2 minutos**.

---

## 4. Lista exata das policies

### Removidas (4)

| Policy | Role | USING | WITH CHECK |
|--------|:----:|:-----:|:----------:|
| `alocacoes_escala_select_anon` | public | `true` | — |
| `alocacoes_escala_insert_anon` | public | `true` | `true` |
| `alocacoes_escala_update_anon` | public | `true` | `true` |
| `alocacoes_escala_update_authenticated` | public | `true` | `true` |

### Preservadas (2)

| Policy | Role | Scopo |
|--------|:----:|-------|
| `"Prestador can view own alocacoes"` | authenticated | `prestador_id IN (SELECT id FROM prestadores WHERE auth_user_id = auth.uid())` |
| `"Prestador can update own alocacoes"` | authenticated | `prestador_id IN (SELECT id FROM prestadores WHERE auth_user_id = auth.uid())` |

### Criadas (5)

| Policy | Role | Scopo |
|--------|:----:|-------|
| `ae_select_tms` | authenticated | `EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid() AND tenant_id = alocacoes_escala.tenant_id AND status = 'ativo')` |
| `ae_insert_tms` | authenticated | (mesmo) |
| `ae_update_tms` | authenticated | (mesmo) |
| `ae_delete_tms` | authenticated | (mesmo) |
| `ae_select_cliente` | authenticated | `cliente_id = f_obter_cliente_id_do_usuario()` |

### Total pós-migration: **7 policies**

---

## 5. Grants antes e depois

### Antes

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|:------:|:------:|:------:|:------:|
| `anon` | ✅ | ✅ | ✅ | ✅ |
| `authenticated` | ✅ | ✅ | ✅ | ✅ |
| `public` (herdado) | — | — | — | — |

### Depois

| Grantee | SELECT | INSERT | UPDATE | DELETE |
|---------|:------:|:------:|:------:|:------:|
| `anon` | ❌ | ❌ | ❌ | ❌ |
| `authenticated` | ✅ (via RLS) | ✅ (via RLS) | ✅ (via RLS) | ✅ (via RLS) |
| `public` (herdado) | — | — | — | — |

---

## 6. Confirmação: NÃO usa `current_tenant_id_safe()`

A migration usa exclusivamente subquery direta:

```sql
EXISTS (
  SELECT 1 FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid()
    AND tu.tenant_id = alocacoes_escala.tenant_id
    AND tu.status = 'ativo'
)
```

Zero referências a `current_tenant_id_safe()` ou `current_setting()` no migration.

---

## 7. Validação sintática

O migration tem um `DO $$` block final que valida:
- Número total de policies (≥ 7)
- Policies com role public = 0
- Grants anon = 0
- Policies prestador preservadas = 2
- Policies TMS criadas = 4
- Policy cliente criada = 1

Se qualquer asserção falhar, o `DO` block lança `RAISE EXCEPTION` e a migration é revertida.

---

## 8. DDL puro — sem DML

| Operação | Presente? |
|----------|:---------:|
| DROP POLICY | ✅ |
| CREATE POLICY | ✅ |
| REVOKE | ✅ |
| INSERT/UPDATE/DELETE | ❌ |
| ALTER TABLE | ❌ |
| CREATE FUNCTION | ❌ |
| CREATE TRIGGER | ❌ |

---

## 9. Planos de Teste

### 9A. Teste anônimo (P0 corrigido)

```sql
-- 1. Conectar com anon key pública
-- 2. Executar:
SELECT COUNT(*) FROM alocacoes_escala;
-- Resultado esperado: ERROR: permission denied for table alocacoes_escala

-- 3. Tentar INSERT anônimo:
INSERT INTO alocacoes_escala (status) VALUES ('pendente');
-- Resultado esperado: ERROR: permission denied for table alocacoes_escala

-- 4. Tentar UPDATE anônimo:
UPDATE alocacoes_escala SET status = 'pendente' WHERE id = 'algum-uuid';
-- Resultado esperado: ERROR: permission denied for table alocacoes_escala
```

**Critério de aceite:** 0 linhas retornadas / 0 inserções / 0 atualizações para anon.

### 9B. Teste TMS (authenticated com tenant_usuarios)

```sql
-- 1. Autenticar como tamiris.castilho@conexaoexpress.com.br (super_admin)
-- 2. Garantir que app.tenant_id está configurado (via set_tenant_context)

-- 3. SELECT:
SELECT COUNT(*) FROM alocacoes_escala;
-- Resultado esperado: N linhas (apenas do tenant Conexao Express)

-- 4. SELECT de outro tenant (se existir):
SELECT COUNT(*) FROM alocacoes_escala WHERE tenant_id != current_tenant_id_safe();
-- Resultado esperado: 0 (RLS bloqueia)

-- 5. UPDATE operacional:
UPDATE alocacoes_escala SET observacoes = 'teste' WHERE id = 'algum-uuid';
-- Resultado esperado: 1 row affected

-- 6. DELETE:
DELETE FROM alocacoes_escala WHERE id = 'uuid-inexistente';
-- Resultado esperado: 0 rows affected (apenas não encontra, não erro de permissão)
```

### 9C. Teste Portal Cliente

```sql
-- 1. Autenticar como cliente do Portal (usuarios_cliente)
-- 2. SELECT:
SELECT COUNT(*) FROM alocacoes_escala;
-- Resultado esperado: N linhas (apenas alocações onde cliente_id = f_obter_cliente_id_do_usuario())

-- 3. Attempt UPDATE (não deve ter policy):
UPDATE alocacoes_escala SET observacoes = 'teste' WHERE cliente_id = f_obter_cliente_id_do_usuario();
-- Resultado esperado: ERROR (sem policy UPDATE para cliente)

-- 4. Verificar que cliente NÃO vê alocações de outros clientes:
SELECT COUNT(*) FROM alocacoes_escala WHERE cliente_id != f_obter_cliente_id_do_usuario();
-- Resultado esperado: 0
```

### 9D. Teste Prestador

```sql
-- 1. Autenticar como prestador (prestadores.auth_user_id = auth.uid())
-- 2. SELECT:
SELECT COUNT(*) FROM alocacoes_escala;
-- Resultado esperado: N linhas (apenas alocações onde prestador_id = seu id)

-- 3. UPDATE (mesmo fluxo de antes):
UPDATE alocacoes_escala SET status = 'aceita' WHERE id = 'alocacao-do-prestador';
-- Resultado esperado: 1 row affected (policy preservada)

-- 4. UPDATE de alocação de OUTRO prestador:
UPDATE alocacoes_escala SET status = 'aceita' WHERE id = 'alocacao-de-outro';
-- Resultado esperado: 0 rows affected (RLS bloqueia)

-- 5. INSERT:
INSERT INTO alocacoes_escala (prestador_id, status) VALUES ('seu-id', 'pendente');
-- Resultado esperado: depende — se ae_insert_tms não permite (prestador não tem tenant_usuarios), erro. Se ae_insert_prestador não existe, erro. OK — prestador cria via RPC f_aceitar_oportunidade_rede.
```

### 9E. Teste Console (browser, TMS)

1. Navegar para `/operacao/escala` como TMS admin
2. Abas: Deve carregar normalmente
3. Abrir DevTools > Console: **0 erros de permissão** (`permission denied` ou `401`)
4. Filtrar `alocacoes_escala` no Network: requisições `PATCH /rest/v1/alocacoes_escala` retornam `200`
5. Botão "Aceitar"/"Recusar"/"Iniciar"/"Finalizar" devem funcionar

### 9F. Teste Network

Monitorar no DevTools > Network:
- Requisições `GET /rest/v1/alocacoes_escala?id=eq.*` → `200` (TMS)
- Requisições `PATCH /rest/v1/alocacoes_escala?id=eq.*` → `200` (prestador)
- Tentativa anônima via URL direta → `401` ou `permission denied`

### 9G. Teste Banco (consultas diretas)

```sql
-- Verificar policies ativas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'alocacoes_escala'
ORDER BY policyname;

-- Verificar grants anon (deve ser vazio)
SELECT * FROM information_schema.table_privileges
WHERE table_name = 'alocacoes_escala'
  AND table_schema = 'public'
  AND grantee = 'anon';

-- Verificar que TMS consegue ler (simular):
-- (requer conexão autenticada)
SET LOCAL ROLE authenticated;
SELECT current_tenant_id_safe(); -- (opcional, só para referência)
SELECT COUNT(*) FROM alocacoes_escala;
```

---

## 10. Riscos residuais

| Risco | Tipo | Gravidade | Mitigação |
|-------|------|:---------:|-----------|
| Policy `"Prestador can update own alocacoes"` permanece | Segurança | **Média** | Prestador só altera próprias alocações, colunas operacionais. Não é P0. Documentado para correção futura. |
| `f_aceitar_oportunidade_rede` sem GRANT continua quebrado | Funcional | **Média** | Bug pré-existente, não é P0. Migration separada. |
| `current_tenant_id_safe()` continua com nome de parâmetro errado | Funcional | **Média** | Bug pré-existente. Migration separada para corrigir a função. |
| TMS policies usam subquery — pode ser mais lento que `current_setting` | Performance | **Baixa** | Tabela `tenant_usuarios` tem ~5 registros. Impacto negligível. |
| Portal Cliente sem tenant_usuarios — `ae_select_cliente` é a única via | Arquitetura | **Baixa** | Comportamento esperado. |
