# Teste Multi-Tenant com 2 Empresas

## Cenarios para Validar Isolamento

Apos configurar 2 tenants no sistema, executar os seguintes testes.

### Setup

```sql
-- Tenant A
INSERT INTO tenants (nome, slug, plano, status)
VALUES ('Transportadora Alpha Ltda', 'alpha-transportes', 'enterprise', 'ativo');

-- Tenant B
INSERT INTO tenants (nome, slug, plano, status)
VALUES ('Beta Logistica SA', 'beta-log', 'professional', 'ativo');

-- Vincular usuarios (cada admin ao seu tenant)
-- Assumindo auth.users existentes:
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
VALUES
  ((SELECT id FROM tenants WHERE slug = 'alpha-transportes'), '<user_id_admin_a>', 'admin_tenant', 'ativo'),
  ((SELECT id FROM tenants WHERE slug = 'beta-log'), '<user_id_admin_b>', 'admin_tenant', 'ativo');
```

## Testes

### 1. Tenant A ve apenas dados A

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 1.1 | Login como admin A | Dashboard carrega |
| 1.2 | Acessar clientes | Ve apenas clientes com `tenant_id = tenant_a` |
| 1.3 | Acessar ordens_servico | Ve apenas OS do tenant A |
| 1.4 | Acessar financeiro | Ve apenas financeiro do tenant A |
| 1.5 | Criar cliente novo | `tenant_id` do novo registro = tenant A |

### 2. Tenant B ve apenas dados B

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 2.1 | Login como admin B | Dashboard carrega |
| 2.2 | Acessar clientes | Ve apenas clientes do tenant B |
| 2.3 | Lista de OS | Nao contem OS do tenant A |
| 2.4 | Relatorio financeiro | So dados do tenant B |

### 3. Admin A nao ve dados de B (cross-tenant bloqueado)

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 3.1 | Admin A tenta acessar rota /admin/tenants | Lista apenas seu tenant OU acesso negado |
| 3.2 | Query direta no console: `SELECT * FROM ordens_servico` | RLS filtra apenas tenant A |

### 4. Cliente A nao ve dados de B

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 4.1 | Login como cliente do tenant A | Ve apenas OS associadas ao seu cliente |
| 4.2 | Nao ve financeiro do tenant B | Dados nao aparecem |

### 5. Trocar tenant limpa cache

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 5.1 | Admin A alterna entre tenants no seletor | `queryClient.clear()` e chamado |
| 5.2 | Dados do tenant anterior nao aparecem apos troca | Cache limpo |

### 6. Query keys usam tenant correto

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 6.1 | Verificar `useEnterpriseQueries` | Chaves React Query contem `tenantId` |
| 6.2 | Mutacao apos troca de tenant | Usa tenant_id correto |

### 7. RLS bloqueia cross-tenant

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 7.1 | `current_tenant_id_safe()` retorna tenant correto | Nao retorna tenant de outro usuario |
| 7.2 | Tentativa de UPDATE com tenant_id errado via SQL console | RLS do authenticated bloqueia |

### 8. Notificacoes nao misturam tenants

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 8.1 | `portal_notificacoes` | SELECT filtra por tenant_id |

### 9. Tracking nao expoe outra empresa

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 9.1 | Tracking publico por codigo | So mostra OS do tenant correto |

### 10. Financeiro nao mistura tenants

| # | Acao | Resultado Esperado |
|---|------|--------------------|
| 10.1 | DRE Gerencial | So considera dados do tenant atual |
| 10.2 | Contas a Receber | Lista apenas do tenant ativo |

## Validacao Tecnica (SQL)

```sql
-- Verificar se RLS esta ativo para tabelas P0 e P1
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true
  AND tablename IN (
    'clientes','prestadores','veiculos','ordens_servico',
    'financeiro_receber','financeiro_pagar','pagamentos_prestadores',
    'alocacoes_escala','orcamentos','crm_leads','portal_pedidos',
    'fiscal_ctes','fiscal_nfse','fiscal_mdfes'
  );

-- Contar registros por tenant (deve mostrar isolamento)
SELECT tenant_id, COUNT(*) as total
FROM ordens_servico
GROUP BY tenant_id;

-- Verificar se existe registro com tenant_id NULL (devem ser migrados)
SELECT COUNT(*) FROM clientes WHERE tenant_id IS NULL;
```
