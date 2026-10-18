# MISSÃO 20 — Auditoria Auth Atual

## Login.tsx
- Formulario de email + senha com submit handler
- Tenta `loginSupabaseAuth()` (Supabase Auth real) primeiro
- Se falha, cai no fallback `login()` (demo localStorage com setTimeout de 600ms)
- Salva `tms_user` e `tms_cliente_id` no localStorage
- Redireciona via `getRedirectPath(role)`
- Link para /forgot-password
- Sem indicacao do modo (demo/producao) para o usuario

## AuthProvider
- Nao existe — auth e gerenciado diretamente pelo auth.ts

## auth.ts (lib)
- `DEMO_USERS`: 4 usuarios hardcoded (admin, operador, cliente, prestador)
- `loginViaSupabase()`: tenta signInWithPassword, le usuario_role de DEMO_USERS como fallback
- `login()`: verifica DEMO_USERS, salva no localStorage
- `getUser()`: le do localStorage
- `logout()`: remove localStorage + signOut supabase
- `getRedirectPath()`: mapeia role para rota
- `getSessaoSupabase()`: retorna sessao atual (nao usado em lugar nenhum)

## Hooks de autenticacao
- Nao existe hook useAuth — components chamam `getUser()` diretamente

## ProtectedRoute
- Nao existe — protecao feita diretamente no AppLayout

## AppLayout.tsx
- `const user = useMemo(() => getUser(), []);` — le do localStorage
- `if (!user) return <Navigate to="/login" replace />;`
- Efeito colateral: `useEffect(() => { const u = getUser(); if (!u) window.location.href = "/login"; }, [location.pathname]);`
- Dupla verificacao (Navigate + redirect forçado)

## Permissoes
- `permissoes.ts`: 4 perfis (admin/operador/cliente/prestador)
- Modulo `admin_tenants` adicionado na Missao 19
- Baseado no `user.role` lido de localStorage via `getUser()`

## TenantProvider
- Carrega tenants via `tenant_usuarios` + `auth.getSession()`
- Fallback para tenant padrao "conexao-express" se sem sessao
- Persiste tenant ativo em localStorage (`tms_tenant_id`)
- Usa queryClient.clear() ao trocar de tenant

## AdminTenantsPage
- Verifica `user.role === "admin"` via `getUser()` do localStorage
- CRUD de tenants via supabase anon key
- Vinculos de usuarios com user_id manual
- Sem resolucao de email -> user_id

## Pontos de Melhoria Identificados
1. Nao ha AuthProvider/unica fonte de verdade para estado de auth
2. getUser() do localStorage NAO e reativo — components nao re-renderizam quando muda
3. AppLayout faz verificacao duplicada de auth
4. Login.tsx tem fallback silencioso para demo mesmo em producao
5. Nao ha indicacao visual do modo (demo vs producao)
6. Nao ha onAuthStateChange listener
7. Nao ha ProtectedRoute component reutilizavel
8. AdminTenantsPage usa getUser() em vez de useAuth()
9. Nao ha RPC para resolver user_id por email
