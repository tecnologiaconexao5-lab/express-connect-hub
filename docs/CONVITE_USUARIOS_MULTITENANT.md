# Convite de Usuarios Multi-Tenant

## Fluxo de Convite

```
Admin → Aba "Convites" em /admin/tenants
   ↓
Preenche email + papel
   ↓
Sistema gera token seguro (32 bytes hex)
   ↓
Link copiado para area de transferencia
   ↓
Admin envia link para o usuario (email, WhatsApp, etc.)
   ↓
Usuario acessa o link
   ├── Se ja tem conta → faz login
   └── Se nao tem conta → cria conta (signUp)
   ↓
Sistema valida token + email + validade (7 dias)
   ↓
Vinculo criado em tenant_usuarios
   ↓
Convite marcado como usado
```

## Seguranca

| Item | Descricao |
|------|-----------|
| Token | 32 bytes aleatorios (64 chars hex) via `gen_random_bytes()` |
| Validade | 7 dias configurados na migration |
| Unico | UNIQUE(tenant_id, email) — apenas 1 convite pendente por par |
| RLS | Apenas admin_tenant/super_admin do tenant pode criar convites |
| Consumo | Funcao `consumir_convite()` verifica token + email + validade |
| Reuso | Token unico, usado = true apos consumo |

## Como usar

### 1. Criar convite

Acessar `/admin/tenants` → Aba "Convites" → "Convidar Usuario"

Preencher:
- **Email**: email do usuario a ser convidado
- **Papel**: papel que o usuario tera no tenant

### 2. Compartilhar link

O link de convite e automaticamente copiado para a area de transferencia.

Formato: `https://seudominio.com.br/convite?token=<token>`

### 3. Usuario aceita

O usuario abre o link e:
- Se ja tem conta no Supabase: faz login
- Se nao tem conta: preenche nome + senha e cria conta

Apos autenticacao, o vinculo e criado automaticamente.

## Estrutura do Banco

### Tabela `convites`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| email | TEXT | Email do convidado |
| papel | TEXT | Papel no tenant |
| token | TEXT | Token seguro (UNIQUE) |
| criado_por | UUID | auth.uid() de quem criou |
| usado | BOOLEAN | false = pendente, true = consumido |
| expira_em | TIMESTAMPTZ | now() + 7 dias |
| criado_em | TIMESTAMPTZ | Data de criacao |

### RPC `consumir_convite(p_token TEXT)`

Funcao segura (SECURITY DEFINER) que:
1. Busca convite pelo token
2. Valida se nao expirou
3. Valida se email do usuario logado confere
4. Verifica se ja existe vinculo (se sim, apenas marca como usado)
5. Cria vinculo em `tenant_usuarios`
6. Marca convite como usado

## Permissoes RLS

| Operacao | Quem pode |
|----------|-----------|
| SELECT convites | Apenas o proprio email ou super_admin |
| INSERT convites | admin_tenant ou super_admin do tenant |
| UPDATE (consumir) | Usuario autenticado com o email do convite |
| DELETE convites | admin_tenant ou super_admin |

## Troubleshooting

| Problema | Causa | Solucao |
|----------|-------|---------|
| "Convite nao encontrado" | Token invalido | Gerar novo convite |
| "Convite ja foi usado" | Ja consumido | Vincular manualmente |
| "Convite expirou" | >7 dias | Gerar novo convite |
| "Este convite e para outro email" | Email nao confere | Login com o email correto |
| Migration Nao Aplicada | Tabela convites nao existe | Executar migration M22 |
