# MISSÃO 19 — Auditoria Admin Tenants

## Rotas Administrativas Existentes
- Nenhuma rota `/admin/*` existe atualmente
- Página de Configurações em `/configuracoes` com abas: empresa, identidade visual, usuarios, permissoes, notificacoes
- Painel de Governança em `/governanca` com abas: auditoria, historico, permissoes, LGPD

## Telas de Configuração
- `Configuracoes.tsx` — dados da empresa, identidade visual, usuarios e perfis, notificacoes
- `Governanca.tsx` — logs de auditoria, snapshots, matriz de acesso, LGPD

## Permissões Existentes
- `auth.ts` — 4 roles: admin, operador, cliente, prestador (demo localStorage)
- `permissoes.ts` — controle granular por modulo (ver/editar/excluir)
- 8 modulos: dashboard, clientes, prestadores, ordens_servico, financeiro, cadastros_auxiliares, relatorios, configuracoes

## Tabela Tenants
- `tenants` — id, nome, slug (UNIQUE), documento, plano (starter/professional/enterprise), status (ativo/inativo/suspenso/trial), email_contato, telefone_contato, logo_url, cor_primaria, dominio_customizado, config JSONB
- RLS atual: SELECT anon true, INSERT/UPDATE authenticated true (Missao 15)

## Tabela Tenant Usuarios
- `tenant_usuarios` — id, tenant_id (FK), user_id, papel (super_admin/admin_tenant/gestor/operacional/financeiro/comercial/cliente/prestador/motorista), status (ativo/inativo/convidado), UNIQUE(tenant_id, user_id)
- RLS atual: SELECT anon true, INSERT/UPDATE authenticated true (Missao 15)

## Tipos Existentes
- `Tenant` em `TenantContext.tsx` — id, nome, slug, plano, status, logo_url, cor_primaria
- `User` em `auth.ts` — email, name, role (admin/operador/cliente/prestador), unit

## AppSidebar
- Sidebar colapsavel com search, items do `sidebarItems` filtrados por permissao
- "Governança e TI" tem: Auditoria, Histórico, Permissões, LGPD, Central de Robôs
- "Configurações" tem: Geral, Empresa, Acessos, Integrações, etc.

## App.tsx
- 38 rotas lazy-loaded dentro do AppLayout
- Nenhuma rota `/admin/*`

## Auth/TenantProvider
- `TenantContext.tsx` — carrega tenants via tenant_usuarios, persiste em localStorage, limpa query cache ao trocar
- Fallback para tenant padrao "conexao-express" quando sem auth
