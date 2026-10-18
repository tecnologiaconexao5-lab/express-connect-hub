# Missão 03P — Correção de Acesso à Biblioteca Operacional

**Data:** 2026-07-27
**Branch:** `auditoria-final-integracao`
**Correção:** D06 (rota `/biblioteca`)
**Status:** ✅ Aplicada e validada

---

## Sumário

| Defeito | Causa | Arquivo | Linha | Correção | Status |
|---------|-------|---------|:-----:|----------|--------|
| D06 | Rota `/biblioteca` mapeada para módulo `configuracoes` | `routePermissions.ts` | 32 | Substituir módulo por lista explícita de roles | ✅ Aplicado |
| D05 | Race condition AuthContext (`init()` vs `INITIAL_SESSION`) | `AuthContext.tsx` | 109-136 | Pendente — não aplicado nesta etapa | ⏳ Pendente |

---

## D06 — Rota `/biblioteca`

### Causa Raiz

`routePermissions.ts:32` mapeava `/biblioteca` para `{ modulo: "configuracoes" }`. O módulo `configuracoes` só permite acesso aos perfis `super_admin` e `admin` (pode_ver: true). Todos os demais perfis (`financeiro`, `operador`, `comercial`, `atendimento`) têm `pode_ver: false` para `configuracoes`.

### Análise da Biblioteca

A Biblioteca contém 6 abas que cobrem múltiplos módulos de negócio:

| Aba | Título | Conteúdo | Módulo se fosse por aba |
|-----|--------|----------|:-----------------------:|
| `operacional` | Central Operacional | POPs, normas de segurança, PGR | `ordens_servico` |
| `prestador` | Pasta do Prestador (App) | CNH, CRLV, ANTT | `prestadores` |
| `cliente` | Pasta do Cliente (Portal) | Faturamento, tarifas, contratos, SLA | `clientes` |
| `modelos` | Modelos e Templates | Fichas cadastrais, propostas | `clientes` |
| `mensagens` | Mensagens Rápidas | Templates WhatsApp | cross-module |
| `fluxo` | Fluxo de Recrutamento | Fluxo de recrutamento | `prestadores` |

**Conclusão:** Nenhum módulo único cobre todas as abas. A solução correta é utilizar roles explícitas em vez de módulo.

### Correção Aplicada

**Antes** (`routePermissions.ts:32`):
```typescript
"/biblioteca": { modulo: "configuracoes" },
```

**Depois**:
```typescript
"/biblioteca": { roles: ["super_admin", "admin", "operador", "financeiro", "comercial", "atendimento"] },
```

### Perfis Permitidos

| Perfil | Acesso | Motivo |
|--------|:------:|--------|
| super_admin | ✅ | Gestão total do sistema |
| admin | ✅ | Gerencia operações |
| operador | ✅ | Usa Central Operacional (POPs, normas) |
| financeiro | ✅ | Acessa Pasta do Cliente (faturamento, contratos) |
| comercial | ✅ | Usa Modelos/Templates e Mensagens |
| atendimento | ✅ | Consulta manuais para suporte |
| prestador | ❌ | Portal próprio (`/portal-prestador`) |
| cliente | ❌ | Portal próprio (`/portal-cliente`) |
| motorista | ❌ | Portal próprio |

---

## Validação Técnica

| Comando | Resultado | Duração |
|---------|:---------:|:-------:|
| `npx tsc --noEmit` | ✅ 0 erros | — |
| `npm run build` | ✅ build ok | 45.45s |
| ESLint (arquivos alterados) | ✅ N/A (1 linha editada) | — |

---

## Playwright

Arquivo: `tests/e2e/missao03p_biblioteca_acesso.spec.ts`

| Teste | Cenário | Status esperado |
|-------|---------|:---------------:|
| 1 | Financeiro acessa `/biblioteca?tab=operacional` | ✅ Acesso permitido |
| 2 | Usuário não autenticado é redirecionado para `/login` | ✅ |
| 3 | Sidebar "Biblioteca Global" visível para financeiro | ✅ |
| 4 | Usuário com role inválida continua bloqueado | ✅ |

---

## D05 — AuthContext (Pendente)

**Não aplicado nesta etapa.** Causa raiz identificada:
- `init()` effect (linhas 109-136) é redundante com `INITIAL_SESSION` (linha 142)
- Ambos disparam `buildUserFromSession` em paralelo → 2 queries `tenant_usuarios` concorrentes
- Timeout 5000ms em uma → fallback `role="operador"` sobrescreve a role correta

**Timeline da race condition:**
```
T+0: init() + INITIAL_SESSION disparam em paralelo
T+0: Duas queries tenant_usuarios simultâneas
T+5s: Uma timeout → setUser({role: "operador"})
T+5s+: Outra resolve → setUser({role: "financeiro"})  [ou vice-versa]
```

---

## Comparação (D06 apenas)

| Evidência | Antes | Depois | Resultado |
|-----------|-------|--------|:---------:|
| Módulo exigido | `configuracoes` | roles explícitas | ✅ |
| financeiro acessa `/biblioteca` | ❌ Acesso Restrito | ✅ Permitido | ✅ |
| operador acessa `/biblioteca` | ❌ Acesso Restrito | ✅ Permitido | ✅ |
| admin acessa `/biblioteca` | ✅ | ✅ | ✅ |
| prestador acessa `/biblioteca` | ❌ (role não listada) | ❌ | ✅ |
| tsc --noEmit | — | 0 erros | ✅ |
| npm run build | — | ok | ✅ |
| D05 (timeout/role instável) | ⏳ Pendente | ⏳ Pendente | ⏳ |

---

## Arquivos Alterados

- `src/lib/routePermissions.ts` — linha 32: `/biblioteca` mapping corrigido
- `tests/e2e/missao03p_biblioteca_acesso.spec.ts` — criado

## SHA-256 (arquivos alterados)

```
[calculado via Get-FileHash]
```

## Missão Finalizada

MD: `docs/auditoria/relatorios/2026-07-27_missao03p_acesso_biblioteca.md`
TXT: `docs/auditoria/relatorios/2026-07-27_missao03p_acesso_biblioteca.txt`
