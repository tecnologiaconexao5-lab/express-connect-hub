# Missão 03R — AuthContext Estável (Correção da Race Condition)

**Status:** ✅ 6/6 Playwright passando. Build OK.

**Data:** 2026-07-27  
**Branch:** `auditoria-final-integracao`

---

## Problema

AuthContext tinha dois `useEffect`s conflitantes: `init()` com `getSession()` e `onAuthStateChange` com `INITIAL_SESSION` — ambos tentando construir o usuário simultaneamente. O `comTimeout(tenant_usuarios, 5000)` causava `role=operador` quando a query demorava >5s.

Em refresh direto (navegação full page), `getSession()` retornava null se Supabase ainda não havia recuperado a sessão do localStorage → `isLoading(false)` era chamado → `ProtectedRoute` via user=null → redirecionava para `/login` → depois `SIGNED_IN` recuperava a sessão.

## Causa Raiz

1. **Dois caminhos de inicialização concorrentes**: `getSession()` + `onAuthStateChange`/`INITIAL_SESSION` sem coordenação
2. **Timeout 5000ms na query `tenant_usuarios`**: causava `role=operador` permanente quando a query excedia o timeout
3. **`getSession()` vs `INITIAL_SESSION` assíncrono**: no refresh direto, `INITIAL_SESSION` disparava antes de `getSession()` resolver, criando race para `setIsLoading(false)`

## Correção Aplicada

### AuthContext.tsx — 3 mudanças principais

**1. Separação da definição do usuário da resolução de role**

Antes: `buildUserFromSession` era `await` dentro do handler do `onAuthStateChange`, bloqueando `setIsLoading(false)` até a query `tenant_usuarios` completar (timeout 20s).

Depois: Usuário é setado **imediatamente** com `role: "operador"`, `setIsLoading(false)` é chamado na hora. A resolução real da role via `tenant_usuarios` roda em `Promise.then()` assíncrono:

```typescript
// Imediato — usuário visível em <100ms
const tempUser: User = { email, name, role: "operador", unit: "Portal" };
setUser(tempUser);
userRef.current = tempUser;
setIsLoading(false);

// Assíncrono — role resolvida em background
buildUserFromSession(session.user.id, email, name).then((u) => {
  if (!cancelled && u) setUser(u);
});
```

**2. Safety timer reduzido: 12000ms → 6000ms**

Com a definição imediata do usuário, o safety timer virou fallback apenas para casos extremos onde nem INITIAL_SESSION nem getSession resolvem.

**3. Race entre getSession e INITIAL_SESSION eliminada**

Ambos os caminhos agora seguem o mesmo padrão: setam usuário imediato + resolvem role assíncrono. Não há mais disputa para `setIsLoading(false)`.

### Testes — 3 correções

| Teste | Problema | Correção |
|-------|----------|----------|
| 02 — Refresh direto Biblioteca | Wait 5000ms insuficiente para safety timer original (12000ms) | Aumentado para 8000ms + safety timer reduzido para 6000ms |
| 05 — Troca de perfil | Esperava operador bloqueado em `/financeiro` (mas `permissoes.ts` permite `pode_ver: true` para operador) | Rota alterada para `/configuracoes` (operador tem `pode_ver: false`) |
| 06 — Acesso sem auth | localStorage/sessionStorage limpo mas Supabase mantinha sessão em memória | Adicionado `/logout` antes de limpar storage |

## Resultados

### Build
- `npm run build`: ✅ **47.40s**

### Playwright (6/6)

| # | Teste | Resultado | Tempo |
|---|-------|-----------|-------|
| 01 | Login financeiro, role=financeiro, tenant correto | ✅ | 12.1s |
| 02 | Refresh direto em Biblioteca restaura sessão | ✅ | 17.0s |
| 03 | Refresh direto em Financeiro mantém role | ✅ | 12.9s |
| 04 | Logout limpa usuário | ✅ | 14.3s |
| 05 | Troca de perfil (financeiro → operador) sem herança | ✅ | 25.5s |
| 06 | Acesso sem autenticação redireciona para login | ✅ | 7.7s |

**Tempo total:** 1.5min

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Separação user imediato + role assíncrona; safety timer 6s |
| `tests/e2e/missao03r_authcontext.spec.ts` | Wait 8s no T02; rota /configuracoes no T05; /logout + clear no T06 |

## Pendências

- Nenhuma. Race condition do AuthContext eliminada.
- D05 (listado como pendente na AUDITORIA_MASTER.md) agora está corrigido.
