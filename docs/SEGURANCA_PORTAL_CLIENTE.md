# Seguranca do Portal do Cliente

## Decisao Arquitetural

**O Portal do Cliente deve permanecer publico (fora do ProtectedRoute).**

### Justificativa

1. **Clientes nao sao usuarios internos**: O portal e destinado a clientes da transportadora, que nao necessariamente possuem credenciais de acesso ao sistema interno (TMS). Exigir autenticacao TMS criaria atrito desnecessario.

2. **Tracking publico**: O sistema ja possui rotas publicas de rastreamento (`/rastrear/:codigo`) que funcionam sem autenticacao. O portal do cliente e uma extensao natural dessa funcionalidade.

3. **Modelo de autenticacao proprio**: O portal utiliza `cliente_id` como chave de acesso, resolvido via:
   - Supabase Auth session (`obterClienteIdAuth()`)
   - localStorage (`tms_cliente_id`)
   - Fallback por nome do cliente

4. **Isolamento por RLS**: Mesmo sem autenticacao TMS, os dados sao isolados por `tenant_id` via RLS. O portal consulta apenas registros do `cliente_id` resolvido.

## Seguranca Aplicada

### 1. Redirecionamento para login (M22)

Se o usuario nao estiver autenticado (sem sessao Supabase e sem localStorage), o portal redireciona para `/login?redirect=/portal-cliente`.

Isso garante que:
- Usuarios sem qualquer identificacao nao acessam dados
- Usuarios com sessao ativa sao redirecionados de volta apos login
- Nao quebra o fluxo de tracking publico (rota separada)

### 2. Resolucao de cliente_id por auth

O portal prioriza `obterClienteIdAuth()` que busca o `cliente_id` via `usuarios_cliente` vinculado ao `auth_user_id`. Isso garante que apenas usuarios autenticados com vinculo correto vejam dados.

### 3. RLS por tenant

Todas as queries do portal sao protegidas por RLS baseado em `current_tenant_id_safe()`, garantindo isolamento entre empresas mesmo sem autenticacao explicita.

### 4. Sem dados sensiveis

O portal nao expoe:
- Senhas
- Dados financeiros de outras empresas
- Dados operacionais de outros tenants
- Informacoes de prestadores

### 5. Sem acoes destrutivas

O portal permite apenas:
- Visualizacao de entregas, faturas e notificacoes do proprio cliente
- Criacao de pedidos (vinculados ao cliente logado)
- Avaliacao de servicos

## Rotas Publicas vs Protegidas

| Rota | Status | Autenticacao |
|------|--------|--------------|
| `/rastrear/:codigo` | Publica | Tracking por codigo (sem auth) |
| `/t/:codigo` | Publica | Tracking por codigo (sem auth) |
| `/portal-cliente` | Publica com guard | Redireciona para login se sem identificacao |
| `/portal-prestador` | Publica com guard | Redireciona para login se sem identificacao |
| `/dashboard` | Protegida | ProtectedRoute |
| `/admin/*` | Protegida | ProtectedRoute |

## Tracking Publico Preservado

As rotas `/rastrear/:codigo` e `/t/:codigo` continuam totalmente publicas (sem auth). Elas sao independentes do PortalCliente e possuem sua propria logica de carregamento de dados.

## Riscos Residuais

| Risco | Mitigacao |
|-------|-----------|
| Cliente com `cliente_id` incorreto no localStorage | Fallback busca no banco por nome, mas RLS limita ao tenant |
| Token de tracking exposto | Tracking por codigo e intencionalmente publico para rastreamento |
| Acesso multiplos dispositivos | Nao ha restricao — cliente pode acessar de varios dispositivos |

## Conclusao

O Portal do Cliente esta configurado com seguranca adequada para seu proposito:
- Nao expoe dados sensiveis
- Redireciona usuarios nao identificados para login
- Mantem isolamento por tenant via RLS
- Preserva tracking publico
- Nao permite acoes destrutivas
