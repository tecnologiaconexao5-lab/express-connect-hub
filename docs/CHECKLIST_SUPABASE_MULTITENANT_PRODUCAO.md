# CHECKLIST — Supabase Multi-Tenant Producao

## Pre-requisitos

- [ ] Acesso ao Supabase Dashboard (https://supabase.com/dashboard)
- [ ] SQL Editor aberto
- [ ] Service Role Key disponivel (apenas para operacoes pontuais)

---

## Passo 1: Aplicar Migrations

```bash
# Se usar Supabase CLI:
supabase db push --include-all

# Ou copiar/colar manualmente no SQL Editor cada migration na ordem:
# 1. 20260626_missao15_multitenant_fundacao.sql
# 2. 20260626_missao16_multitenant_rls_p0.sql
# 3. 20260626_missao18_multitenant_rls_p1.sql
# 4. 20260626_missao19_admin_tenants_rls.sql
# 5. 20260626_missao20_auth_helper_rpc.sql
# 6. 20260727_missao21_set_tenant_context.sql
```

- [ ] Migration M15 aplicada sem erros
- [ ] Migration M16 aplicada sem erros
- [ ] Migration M18 aplicada sem erros
- [ ] Migration M19 aplicada sem erros
- [ ] Migration M20 aplicada sem erros
- [ ] Migration M21 aplicada sem erros

---

## Passo 2: Verificar Tabela `tenants`

```sql
SELECT id, nome, slug, plano, status, criado_em
FROM tenants
ORDER BY criado_em;
```

- [ ] Tabela existe
- [ ] Tenant padrao "Conexao Express" presente (slug: `conexao-express`)
- [ ] Pelo menos 1 tenant ativo

---

## Passo 3: Verificar Tenant Padrao

```sql
SELECT * FROM tenants WHERE slug = 'conexao-express';
```

- [ ] ID = `00000000-0000-0000-0000-000000000001`
- [ ] Status = `ativo`

---

## Passo 4: Criar Usuario no Supabase Auth

> **IMPORTANTE**: Nao expor service_role_key no frontend.

Opcao A — Via Supabase Dashboard:
1. Acessar Authentication → Users → Add User
2. Preencher email e senha
3. Anotar o `User UID` gerado

Opcao B — Via SQL (requer service_role):
```sql
-- Apenas se tiver service_role_key habilitada no SQL Editor
SELECT * FROM auth.users WHERE email = 'admin@seudominio.com.br';
```

- [ ] Usuario existe em `auth.users`

---

## Passo 5: Vincular Usuario ao Tenant Padrao

```sql
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
SELECT 
  id,
  '<UUID_do_usuario_auth>',
  'super_admin',
  'ativo'
FROM tenants 
WHERE slug = 'conexao-express'
ON CONFLICT (tenant_id, user_id) DO NOTHING;
```

- [ ] Vinculo criado (1 linha inserida)

---

## Passo 6: Promover Usuario a Super Admin

Se o passo 5 ja usou `super_admin`, esta etapa ja foi cumprida.

Para verificar:
```sql
SELECT tu.*, t.nome as tenant_nome, au.email
FROM tenant_usuarios tu
JOIN tenants t ON t.id = tu.tenant_id
LEFT JOIN auth.users au ON au.id = tu.user_id
WHERE tu.papel = 'super_admin';
```

- [ ] Usuario aparece com papel `super_admin`
- [ ] Status = `ativo`

---

## Passo 7: Validar RLS

### 7.1 Verificar RLS ativo nas tabelas P0

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'clientes','prestadores','veiculos','ordens_servico',
    'financeiro_receber','financeiro_pagar','pagamentos_prestadores'
  );
```

- [ ] Todas as 7 tabelas P0 com `rowsecurity = true`

### 7.2 Verificar RLS ativo nas tabelas P1

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'alocacoes_escala','orcamentos','crm_leads','portal_pedidos',
    'fiscal_ctes','fiscal_nfse','fiscal_mdfes',
    'despesas_operacionais','financeiro_baixas','auditoria_operacional',
    'portal_notificacoes'
  );
```

- [ ] Todas as 18 tabelas P1 com `rowsecurity = true`

### 7.3 Testar current_tenant_id_safe()

```sql
-- Login como usuario real, depois executar:
SELECT current_tenant_id_safe();
```

- [ ] Retorna o UUID do tenant ao qual o usuario esta vinculado

### 7.4 Testar set_tenant_context()

```sql
-- Login como usuario real, depois executar:
SELECT set_tenant_context('00000000-0000-0000-0000-000000000001');
SELECT current_tenant_id_safe();
```

- [ ] `current_tenant_id_safe()` retorna o tenant configurado

---

## Passo 8: Validar Reset de Senha

- [ ] Configurar `VITE_APP_URL` corretamente no .env de producao
- [ ] Acessar `/forgot-password`
- [ ] Inserir email
- [ ] Clicar em enviar
- [ ] Verificar email recebido
- [ ] Clicar no link de reset
- [ ] Definir nova senha
- [ ] Login com nova senha
- [ ] Confirmar que sessao funciona

---

## Passo 9: Validar Tracking Publico

- [ ] Acessar `/rastrear/<codigo_os>` sem estar logado
- [ ] Dados da OS sao exibidos corretamente
- [ ] RLS permite SELECT anon (politica de tracking)

---

## Passo 10: Validar Notificacoes

- [ ] Login como usuario
- [ ] Criar notificacao em `portal_notificacoes` com `tenant_id` correto
- [ ] Apenas usuarios do mesmo tenant veem a notificacao
- [ ] Usuarios de outro tenant NAO veem

---

## Resumo Final

| Passo | Descricao | Status |
|-------|-----------|--------|
| 1 | Migrations aplicadas | [ ] |
| 2 | Tabela tenants OK | [ ] |
| 3 | Tenant padrao OK | [ ] |
| 4 | Usuario auth criado | [ ] |
| 5 | Vinculo tenant_usuarios | [ ] |
| 6 | Super admin promovido | [ ] |
| 7 | RLS validado | [ ] |
| 8 | Reset de senha OK | [ ] |
| 9 | Tracking OK | [ ] |
| 10 | Notificacoes OK | [ ] |

---

## Troubleshooting

| Problema | Causa | Solucao |
|----------|-------|---------|
| `auth.users` vazio | Usuario nunca fez login | Ir em `/login` para criar sessao |
| RLS bloqueia SELECT anon | Politica faltando | Executar migration M16/M18 |
| `set_tenant_context` erro 404 | Migration M21 nao aplicada | Executar M21 |
| `buscar_usuario_por_email` erro | Migration M20 nao aplicada | Executar M20 |
| UNIQUE violation em tenant_usuarios | Ja existe vinculo | Usar `ON CONFLICT DO UPDATE` |
