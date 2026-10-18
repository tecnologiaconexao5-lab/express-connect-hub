# Criar Super Admin

## Estrategia

O primeiro super_admin deve ser criado manualmente via SQL no console do Supabase, apos o usuario existir no `auth.users`.

## Requisitos

1. Usuario ja deve ter feito login ao menos 1 vez (para existir em `auth.users`)
2. Conhecer o email do usuario que sera super_admin
3. Acesso ao SQL Editor do Supabase Dashboard

## Passo a Passo

### 1. Encontrar o user_id no auth.users

Conecte-se ao SQL Editor do Supabase e execute:

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'admin@minhaempresa.com.br';
```

Anote o `id` retornado.

> Se o usuario nao existir, peca para ele fazer login 1 vez no sistema (qualquer tela que use Supabase Auth, como Login ou esqueci senha).

### 2. Inserir na tabela tenant_usuarios

```sql
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
SELECT id, '<UUID_do_auth.users>', 'super_admin', 'ativo'
FROM tenants
WHERE slug = 'conexao-express'
   OR slug = 'SEU_TENANT';
```

### 3. Verificar

```sql
SELECT tu.*, t.nome as tenant_nome, au.email
FROM tenant_usuarios tu
JOIN tenants t ON t.id = tu.tenant_id
JOIN auth.users au ON au.id = tu.user_id
WHERE tu.papel = 'super_admin';
```

## Via RPC (se deploy da migration M20 estiver aplicada)

Se a migration `20260626_missao20_auth_helper_rpc.sql` estiver aplicada, um super_admin existente pode buscar outros usuarios por email:

```sql
SELECT * FROM buscar_usuario_por_email('novo@email.com');
```

E entao vincular via `tenant_usuarios`.

## Seguranca

- NUNCA colocar senha em codigo ou documentacao
- NUNCA expor service_role_key no frontend
- Apenas super_admin pode criar outro super_admin (RLS na Missao 19 bloqueia admin_tenant)
- A funcao `buscar_usuario_por_email` so funciona para usuarios com papel super_admin

## Troubleshooting

| Problema | Solucao |
|----------|---------|
| auth.users vazio | Usuario nunca fez login — peca para acessar /login |
| "permission denied for schema auth" | Usuario nao tem acesso — use service role no SQL Editor |
| tenant_usuarios UNIQUE violation | Ja existe vinculo — use ON CONFLICT DO UPDATE |
