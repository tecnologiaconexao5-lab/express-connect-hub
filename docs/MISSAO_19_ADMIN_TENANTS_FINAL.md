# MISSÃO 19 — Multi-Tenant Fase 5: Admin Tenants

## Status: CONCLUIDA

---

## 1. Arquivos Criados

| Arquivo | Descricao |
|---------|-----------|
| `supabase/migrations/20260626_missao19_admin_tenants_rls.sql` | RLS forte para tenants + tenant_usuarios, funcoes auxiliares |
| `src/services/adminTenantsService.ts` | CRUD de tenants e vinculos via Supabase |
| `src/pages/admin/AdminTenantsPage.tsx` | Pagina de administracao de empresas e vinculos |
| `docs/MISSAO_19_ADMIN_TENANTS_AUDITORIA.md` | Auditoria pre-missao |
| `docs/ONBOARDING_NOVO_TENANT.md` | Guia de onboarding de nova transportadora |

## 2. Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Rota `/admin/tenants` adicionada (lazy) |
| `src/lib/sidebarData.ts` | Item "Empresas" adicionado em "Governanca e TI" com modulo admin_tenants |
| `src/lib/permissoes.ts` | Modulo `admin_tenants` adicionado para perfil admin |

## 3. Rotas Criadas

- `/admin/tenants` — pagina de administracao de empresas

## 4. Telas Criadas

- **AdminTenantsPage** — 2 abas:
  - **Empresas**: tabela com busca, criar/editar/ativar/desativar/excluir
  - **Usuarios por Empresa**: tabela de vinculos + formulario rapido para vincular usuario a empresa

## 5. Permissoes Aplicadas

| Perfil | admin_tenants |
|--------|--------------|
| admin | ver, editar, excluir |
| operador | negado |
| cliente | negado |
| prestador | negado |

Regras de negocio na pagina:
- Apenas usuarios com `role === "admin"` podem acessar (frontend)
- Admin pode criar, editar, ativar/desativar e excluir tenants
- Admin pode vincular/editar/remover usuarios de qualquer tenant
- Admin NAO pode criar super_admin via UI (apenas SQL)

## 6. RLS no Banco

| Tabela | Operacao | Regra |
|--------|----------|-------|
| tenants | SELECT | anon + authenticated: true (publico) |
| tenants | INSERT | authenticated: `user_is_super_admin()` |
| tenants | UPDATE | authenticated: `user_is_super_admin()` OR `user_tenant_role(id) = 'admin_tenant'` |
| tenants | DELETE | authenticated: `user_is_super_admin()` |
| tenant_usuarios | SELECT | anon + authenticated: true (publico) |
| tenant_usuarios | INSERT | authenticated: `user_is_super_admin()` OR (`user_tenant_role(tenant_id) = 'admin_tenant'` AND papel != 'super_admin') |
| tenant_usuarios | UPDATE | authenticated: `user_is_super_admin()` OR (`user_tenant_role(tenant_id) = 'admin_tenant'` AND papel != 'super_admin') |
| tenant_usuarios | DELETE | authenticated: `user_is_super_admin()` OR (`user_tenant_role(tenant_id) = 'admin_tenant'` AND papel != 'super_admin') |

### Funcoes Criadas
- `user_can_manage_tenants()` — usuario tem papel super_admin ou admin_tenant
- `user_is_super_admin()` — usuario tem papel super_admin

## 7. Funcionalidades

- Listar todas as empresas com busca (nome/slug/documento)
- Criar empresa com validacao (nome e slug obrigatorios, slug sem espacos)
- Editar empresa (todos os campos)
- Ativar/desativar empresa (toggle rapido)
- Excluir empresa (com confirmacao)
- Listar vinculos de usuarios por empresa
- Vincular usuario a empresa (user_id + papel + status)
- Editar vinculo (papel + status)
- Remover vinculo (com confirmacao)
- Protecao de acesso: usuarios nao-admin veem "Acesso Restrito"

## 8. Limitacoes

- User ID e inserido manualmente (nao ha seletor de usuarios do Supabase Auth)
- Vinculo super_admin nao pode ser criado pela UI (apenas SQL)
- Admin_tenant nao pode criar/editar/remover outro admin_tenant ou super_admin (RLS protege)
- RLS com `auth.uid()` so funciona plenamente apos implementacao do Supabase Auth real
- Migracao depende de `user_tenant_role()` que usa `auth.uid()`

## 9. Validacao

```
TypeScript: 0 erros
Build:      OK
```

## 10. Riscos Restantes

1. **Auth demo**: RLS de authenticated nao tem efeito enquanto o login for localStorage. Dados de tenant_usuarios ficam expostos via anon key (SELECT publico).
2. **Super_admin seed**: Nao ha super_admin pre-cadastrado — precisa ser inserido manualmente via SQL apos configurar Supabase Auth.
3. **Admin_tenant sem seletor**: UI pede user_id manual — sem Supabase Auth ativo, nao ha como listar usuarios.
4. **Delecao de tenant**: Excluir um tenant remove em cascata todos os dados relacionados (CASCADE nas FKs) — usar com moderacao.
5. **slug unico**: Tentativa de criar slug duplicado causa erro 409 no Supabase.

## 11. Proxima Fase Recomendada

**Multi-Tenant Fase 6 — Migracao + Go Live**
- Implementar Supabase Auth real (signInWithPassword, etc.)
- Criar trigger para auto-vincular usuario ao criar conta
- Migrar dados existentes do tenant padrao para o schema correto
- Validar RLS com usuarios reais
- Testar isolamento com 2+ tenants em producao
- Remover login demo (localStorage)
