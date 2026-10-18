# Rollback: Auth Real + Multi-Tenant

## Emergencia: Voltar ao modo anterior sem perder dados

### 1. Desativar AuthProvider

Substituir em `App.tsx`:

```tsx
// Atual (com AuthProvider):
<AuthProvider>
<TenantProvider>
...
</TenantProvider>
</AuthProvider>

// Rollback (sem AuthProvider):
<TenantProvider>
...
</TenantProvider>
```

Comentar/remover:
- `import { AuthProvider } from "@/contexts/AuthContext";`
- `import ProtectedRoute from "@/components/ProtectedRoute";`
- `{/* <AuthProvider>...</AuthProvider> */}` e `{/* </AuthProvider> */}`

### 2. Restaurar AppLayout.tsx

```tsx
import { getUser } from "@/lib/auth";
const user = useMemo(() => getUser(), []);
if (!user) return <Navigate to="/login" replace />;
```

### 3. Restaurar Login.tsx

Voltar ao fluxo anterior com `login()` + `loginSupabaseAuth()` + setTimeout fallback.

### 4. Modo demo forçado

No `.env`:
```
VITE_AUTH_DEMO_MODE=true
```

### 5. Reverter ProtectedRoute

Remover o wrapper `ProtectedRoute` das rotas em App.tsx:
```tsx
// Antes:
<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
// Depois:
<Route element={<AppLayout />}>
```

### 6. Reverter migrations SQL

Se precisar reverter as migrations da Missao 20:

```sql
-- Reverter RPCs
DROP FUNCTION IF EXISTS buscar_usuario_por_email(TEXT);
DROP FUNCTION IF EXISTS listar_usuarios_tenant(UUID);

-- Reverter RLS (voltar ao estado da Missao 19)
DROP POLICY IF EXISTS "tenants_select_anon" ON tenants;
DROP POLICY IF EXISTS "tenants_select_auth" ON tenants;
DROP POLICY IF EXISTS "tenants_insert_admin" ON tenants;
DROP POLICY IF EXISTS "tenants_update_admin" ON tenants;
DROP POLICY IF EXISTS "tenants_delete_admin" ON tenants;
-- Recriar politicas originais da Missao 15:
CREATE POLICY "tenants_select_anon" ON tenants FOR SELECT TO anon USING (true);
CREATE POLICY "tenants_insert_auth" ON tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tenants_update_auth" ON tenants FOR UPDATE TO authenticated USING (true);
```

### 7. Nao perder dados

- `AuthProvider` nao modifica dados do banco — apenas como o usuario e autenticado
- `ProtectedRoute` nao altera dados — apenas controla acesso
- RLS das tabelas de negocio continua ativo independente do AuthProvider
- `tenant_id` nos registros existentes permanece intacto

### 8. Impacto do rollback

| Item | Impacto |
|------|---------|
| Login demo | Restaurado |
| onAuthStateChange | Perdido (sessao nao persiste) |
| ProtectedRoute | Removido |
| RLS auth.uid() | Continua funcionando para quem tem auth |
| Dados existentes | Nenhuma perda |
| Supabase Auth | Continua disponivel mas nao obrigatorio |

## Rollback rapido (1 comando git)

```bash
# Ver arquivos alterados na missao 20
git log --oneline --all --grep="missao20\|M20\|auth_real"

# Reverter apenas arquivos criticos
git checkout HEAD~1 -- src/App.tsx src/components/AppLayout.tsx src/pages/Login.tsx

# Reverter migrations (ja aplicadas)
# Executar SQL de reversao manualmente no Supabase
```
