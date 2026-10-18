# RELATÓRIO — ENV-QA-04: Build QA Local + Baseline Aplicado

**Data:** 2026-09-20
**Status:** ✅ CONCLUÍDO
**Operador:** opencode (MIMO v2.5)

---

## Resumo Executivo

Ambiente QA local criado com sucesso using `postgres:15-alpine` (Docker). Baseline estrutural `full_production_schema_20260920.sql` (SHA-256 `4b384522`) aplicado e validado. Guard anti-produção com hostname parsing implementado e testado (4/4 cenários).

---

## PRECHECKs Executados

| # | Precheck | Status | Detalhes |
|---|----------|--------|----------|
| 1 | Docker Engine | ✅ | Docker Desktop v29.4.1, daemon rodando |
| 2 | SHA-256 Baseline | ✅ | `4b384522c336038417334806f610f810775a85c2414cb12cff8060505ae6449f` — MATCH |
| 3 | Production Guard | ✅ | Hostname parsing adicionado a `apply_baseline_to_qa.ts` |
| 4 | Supabase Local | ✅ | Container `supabase-db-qa` rodando (postgres:15-alpine, port 54322) |
| 5 | Local DB Target | ✅ | `127.0.0.1:54322` confirmado via `inet_server_addr()` |
| 6 | Apply Baseline | ✅ | 221 tabelas, 13 views, 184 functions, 866 indexes |
| 7 | Validate Objects | ✅ | `pagamentos_prestadores` = 50 colunas, RLS "Allow all" confirmado |
| 8 | Anti-Production Guard | ✅ | 4/4 cenários passam (localhost ALLOWED, production BLOCKED) |

---

## Objetos Validados Localmente

### Tabelas-Alvo (6)

| Tabela | Colunas | RLS | Policies | Status |
|--------|:-------:|:---:|:--------:|:------:|
| `pagamentos_prestadores` | 50 | ON | 1 (Allow all ALL → public) | ⚠️ WIDE OPEN |
| `financeiro_pagar` | 43 | ON | 0 | 🔒 Trancado |
| `financeiro_baixas` | 19 | ON | 0 | 🔒 Trancado |
| `composicao_financeira_os` | 21 | ON | 0 | 🔒 Trancado |
| `prestadores` | 81 | ON | 0 | 🔒 Trancado |
| `tenant_usuarios` | 7 | ON | 0 | 🔒 Trancado |

### Constraints em `pagamentos_prestadores`

| Constraint | Tipo |
|-----------|------|
| `pagamentos_prestadores_pkey` | PRIMARY KEY (id) |
| `pagamentos_prestadores_prestador_id_fkey` | FK → prestadores.id |
| `fk_fechamento_pai` | FK → pagamentos_prestadores.id (self-ref) |
| `uq_pp_os_id` | UNIQUE (os_id) |
| `chk_classificacao_dado` | CHECK |

### Funções-Chave

| Função | Security | Status |
|--------|----------|:------:|
| `f_confirmar_pagamento_prestador` | INVOKER | ⚠️ Afetada por RLS |
| `f_confirmar_pagamento_fechamento` | DEFINER | ✅ Bypassa RLS |
| `f_trg_propagar_financeiro_os` | DEFINER | ✅ Bypassa RLS |
| `current_tenant_id_safe` | INVOKER | ✅ OK |

---

## Guard Anti-Produção (atualizado)

### Alteração em `scripts/qa/apply_baseline_to_qa.ts`

**Antes:** `includes(PROD_REF)` string match
**Depois:** URL parsing + hostname validation

```typescript
const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function extractHostname(connStr: string): string | null {
  try { return new URL(connStr).hostname; }
  catch { const m = connStr.match(/@([^:/\s]+)(?::\d+)?/); return m ? m[1] : null; }
}

function validateHostname(hostname: string | null): { ok: boolean; reason: string } {
  if (!hostname) return { ok: false, reason: "..." };
  if (ALLOWED_HOSTNAMES.has(hostname)) return { ok: true, reason: "Local" };
  return { ok: false, reason: "BLOCKED: " + hostname };
}
```

### Testes (4/4 PASS)

| Cenário | URL | Hostname | Resultado |
|---------|-----|----------|:---------:|
| Localhost IP | `127.0.0.1:54322` | `127.0.0.1` | ✅ ALLOWED |
| Localhost name | `localhost:54322` | `localhost` | ✅ ALLOWED |
| Supabase production | `db.uwrvzsjtpgaifkktpepn.supabase.co` | `db.uwrvzsjtpgaifkktpepn...` | ✅ BLOCKED |
| Pooler production | `aws-1-sa-east-1.pooler.supabase.com` | `aws-1-sa-east-1...` | ✅ BLOCKED |

---

## Ambiente Local

| Item | Valor |
|------|-------|
| Container | `supabase-db-qa` |
| Image | `postgres:15-alpine` (15.17) |
| Port | 54322 → 5432 |
| User | `postgres` |
| Password | `postgres` |
| Database | `postgres` |
| Connection | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

---

## Próximos Passos

1. **02M.8-B** — Aplicar RLS FIX em `pagamentos_prestadores` (local)
2. **02M.8-C** — Validar triggers M66/M80 em ambiente isolado
3. **02M.9** — QA Validation (agora viável via localhost:54322)
4. **02M.10** — Reconciliação CESAR (banco local com dados sintéticos)

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `scripts/qa/apply_baseline_to_qa.ts` | Guard: hostname parsing (URL + regex fallback) |
| `RELATORIO_ENV_QA_04_LOCAL_BUILD.md` | Este relatório |
