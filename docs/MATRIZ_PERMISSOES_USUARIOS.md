# Matriz de Permissões de Usuários

## Roles (Papeis)

| Role (Frontend) | Papel no Banco (`tenant_usuarios.papel`) | Descrição |
|-----------------|------------------------------------------|-----------|
| `super_admin` | `super_admin` | Acesso total ao sistema, inclusive multi-tenant |
| `admin` | `admin_tenant`, `gestor`, `admin` | Administração do tenant, sem acesso a outros tenants |
| `operador` | `operacional`, `operador` | Operação diária (OS, escala, ocorrências) |
| `financeiro` | `financeiro` | Financeiro (receber, pagar, relatórios) |
| `comercial` | `comercial` | Comercial (clientes, orçamentos, propostas) |
| `cliente` | `cliente` | Portal do cliente (consultar OS, financeiro) |
| `prestador` | `prestador` | App prestador (OS designadas, financeiro) |
| `motorista` | `motorista` | App motorista (OS, rota) |

## Matriz de Permissões por Módulo

### super_admin

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ |
| Clientes | ✅ | ✅ | ✅ |
| Prestadores | ✅ | ✅ | ✅ |
| Ordens de Serviço | ✅ | ✅ | ✅ |
| Financeiro | ✅ | ✅ | ✅ |
| Frota | ✅ | ✅ | ✅ |
| Cadastros Auxiliares | ✅ | ✅ | ✅ |
| Relatórios | ✅ | ✅ | ✅ |
| Configurações | ✅ | ✅ | ✅ |
| Admin Tenants | ✅ | ✅ | ✅ |

### admin

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ |
| Clientes | ✅ | ✅ | ✅ |
| Prestadores | ✅ | ✅ | ✅ |
| Ordens de Serviço | ✅ | ✅ | ✅ |
| Financeiro | ✅ | ✅ | ✅ |
| Frota | ✅ | ✅ | ✅ |
| Cadastros Auxiliares | ✅ | ✅ | ✅ |
| Relatórios | ✅ | ✅ | ✅ |
| Configurações | ✅ | ✅ | ✅ |
| Admin Tenants | ❌ | ❌ | ❌ |

### operador

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ❌ | ❌ |
| Clientes | ✅ | ✅ | ❌ |
| Prestadores | ✅ | ✅ | ❌ |
| Ordens de Serviço | ✅ | ✅ | ❌ |
| Financeiro | ✅ | ❌ | ❌ |
| Frota | ✅ | ✅ | ❌ |
| Cadastros Auxiliares | ✅ | ❌ | ❌ |
| Relatórios | ✅ | ❌ | ❌ |
| Configurações | ❌ | ❌ | ❌ |

### financeiro

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ❌ | ❌ |
| Clientes | ✅ | ❌ | ❌ |
| Prestadores | ✅ | ❌ | ❌ |
| Ordens de Serviço | ✅ | ❌ | ❌ |
| Financeiro | ✅ | ✅ | ✅ |
| Frota | ❌ | ❌ | ❌ |
| Cadastros Auxiliares | ❌ | ❌ | ❌ |
| Relatórios | ✅ | ✅ | ❌ |
| Configurações | ❌ | ❌ | ❌ |

### comercial

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ❌ | ❌ |
| Clientes | ✅ | ✅ | ❌ |
| Prestadores | ✅ | ❌ | ❌ |
| Ordens de Serviço | ✅ | ❌ | ❌ |
| Financeiro | ✅ | ❌ | ❌ |
| Frota | ❌ | ❌ | ❌ |
| Cadastros Auxiliares | ✅ | ❌ | ❌ |
| Relatórios | ✅ | ❌ | ❌ |
| Configurações | ❌ | ❌ | ❌ |

### cliente

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ❌ | ❌ |
| Ordens de Serviço | ✅ | ❌ | ❌ |
| Financeiro | ✅ | ❌ | ❌ |
| Demais | ❌ | ❌ | ❌ |

### prestador

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ❌ | ❌ |
| Ordens de Serviço | ✅ | ❌ | ❌ |
| Financeiro | ✅ | ❌ | ❌ |
| Demais | ❌ | ❌ | ❌ |

### motorista

| Módulo | Ver | Editar | Excluir |
|--------|:---:|:------:|:-------:|
| Dashboard | ✅ | ❌ | ❌ |
| Ordens de Serviço | ✅ | ❌ | ❌ |
| Financeiro | ✅ | ❌ | ❌ |
| Demais | ❌ | ❌ | ❌ |

## Como as permissões são aplicadas

1. **Backend (SQL/RPC):** as funções RPC usam `tenant_usuarios.papel` para autorizar operações (ex: `auth.is_super_admin()`, `auth.is_admin_tenant(p_tenant_id)`).
2. **Frontend (UI):** o sidebar e componentes usam `getPermissoes(role)` do `permissoes.ts` para mostrar/esconder módulos e ações.
3. **Mapeamento DB→Frontend:** `mapPapelToUserRole()` em `auth.ts` e `AuthContext.tsx` converte o papel do banco para o role do frontend.

## Compatibilidade Retroativa

As roles antigas (`admin`, `operador`, `cliente`, `prestador`) continuam funcionando. O mapeamento é:

| Papel DB antigo | Role Frontend |
|-----------------|---------------|
| `admin_tenant` → | `admin` |
| `gestor` → | `admin` |
| `operacional` → | `operador` |
| `prestador` → | `prestador` |
| `motorista` → | `motorista` |
| `financeiro` → | `financeiro` |
| `comercial` → | `comercial` |
| `super_admin` → | `super_admin` |
