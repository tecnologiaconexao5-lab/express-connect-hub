# Onboarding de Novo Tenant (Nova Transportadora)

## 1. Criar Empresa

Acessar `Administração > Empresas` ou `/admin/tenants`.

Preencher:
- **Nome**: Razão social da transportadora
- **Slug**: Identificador unico sem espacos (ex: `transportadora-x`)
- **Documento**: CNPJ
- **Plano**: starter / professional / enterprise
- **Status**: ativo (para uso imediato) ou trial (periodo de teste)

Clicar em "Criar".

## 2. Vincular Usuario Administrador

Na aba "Usuários por Empresa", selecionar a empresa criada e clicar em "Vincular".

Preencher:
- **User ID**: UUID do usuario no Supabase Auth (`auth.uid()`)
- **Papel**: `admin_tenant` (gestor da empresa) ou `gestor` (visualizacao)
- **Status**: ativo

> **Nota**: O User ID so existe apos o usuario fazer login via Supabase Auth. Enquanto o sistema usa login demo (localStorage), o vinculo pode ser feito manualmente no SQL.

## 3. Configurar Logo, Cor e Dominio

### Via UI de Configuracoes
1. Ir em `Configurações > Identidade Visual`
2. Fazer upload do logo (PNG/SVG, max 2MB)
3. Definir cor primaria e secundaria
4. Selecionar onde o logo aparece (login, sidebar, relatorios, etc.)

### Via SQL Direto
```sql
UPDATE tenants
SET logo_url = 'url-do-logo',
    cor_primaria = '#FF6600',
    dominio_customizado = 'tms.transportadorax.com.br'
WHERE slug = 'transportadora-x';
```

## 4. Criar Dados Iniciais

Apos a empresa criada, os dados iniciais necessarios sao:

1. **Cadastros Base**: clientes, prestadores, veiculos (via UI Cadastros)
2. **Financeiro**: plano de contas, centro de resultado (via Financeiro)
3. **Operacao**: tabela de valores, regras de frete (via Comercial)
4. **Usuarios**: vincular usuarios da transportadora (via Admin > Empresas)
5. **Configuracoes**: numeracao de documentos, notificacoes (via Configuracoes)

Os dados serao automaticamente isolados por `tenant_id` nas 25 tabelas com RLS ativo.

## 5. Validar Acesso

1. Fazer login com o usuario vinculado
2. Verificar se apenas os dados da empresa aparecem
3. Testar CRUD em clientes, OS, financeiro
4. Confirmar que dados de outras empresas nao aparecem

## 6. Testar Isolamento

Cenarios para validar:

| # | Cenario | Resultado Esperado |
|---|---------|-------------------|
| 1 | Usuario A ve dados da Empresa A | OK |
| 2 | Usuario A NAO ve dados da Empresa B | Isolado |
| 3 | Usuario B NAO ve dados da Empresa A | Isolado |
| 4 | Criar cliente na Empresa A fica na Empresa A | tenant_id correto |
| 5 | Relatorio financeiro mostra so dados da empresa | Filtrado |
| 6 | Exportacao respeita tenant | Filtrado |

## 7. Liberar Operacao

Apos validacao:

1. Alterar status da empresa para `ativo` (se estava trial)
2. Confirmar que RLS esta ativo para todas as tabelas P0 e P1
3. Verificar logs de auditoria para detectar vazamentos
4. Liberar acesso para os usuarios conforme papel

## Script de Exemplo

```sql
-- 1. Criar tenant
INSERT INTO tenants (nome, slug, plano, status, email_contato, cor_primaria)
VALUES ('Transportadora X Ltda', 'transportadora-x', 'professional', 'ativo', 'admin@tx.com', '#0055FF');

-- 2. Vincular usuario (apos auth.uid() existir)
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
VALUES (
    (SELECT id FROM tenants WHERE slug = 'transportadora-x'),
    '<auth_uid>',
    'admin_tenant',
    'ativo'
);
```
