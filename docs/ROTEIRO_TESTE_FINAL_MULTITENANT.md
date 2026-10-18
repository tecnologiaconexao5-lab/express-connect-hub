# ROTEIRO DE TESTE FINAL — Multi-Tenant

## Pre-condicoes

- [ ] Supabase com todas as migrations aplicadas (M15–M21)
- [ ] `VITE_AUTH_DEMO_MODE=false`
- [ ] Pelo menos 1 usuario super_admin criado e vinculado
- [ ] Sistema rodando (local ou producao)

---

## Setup: Criar 2 Tenants e Usuarios

### 1. Login como admin

- [ ] Acessar `/login`
- [ ] Inserir email/senha do super_admin
- [ ] Dashboard carrega sem erros
- [ ] Nao ha indicacao de "Modo demo"

### 2. Criar Tenant A — "Transportadora Alpha"

- [ ] Acessar `/admin/tenants`
- [ ] Clicar "Nova Empresa"
- [ ] Preencher: Nome = "Transportadora Alpha Ltda", Slug = "alpha-transportes"
- [ ] Plano = "enterprise", Status = "ativo"
- [ ] Salvar
- [ ] Tenant A aparece na lista

### 3. Criar Tenant B — "Beta Logistica"

- [ ] Clicar "Nova Empresa"
- [ ] Preencher: Nome = "Beta Logistica SA", Slug = "beta-log"
- [ ] Plano = "professional", Status = "ativo"
- [ ] Salvar
- [ ] Tenant B aparece na lista

### 4. Criar Usuario A (email: user.a@teste.com)

Usar Supabase Dashboard:
- [ ] Authentication → Users → Add User
- [ ] Email: user.a@teste.com
- [ ] Senha: `Teste@123`
- [ ] Anotar o UUID gerado

### 5. Criar Usuario B (email: user.b@teste.com)

- [ ] Authentication → Users → Add User
- [ ] Email: user.b@teste.com
- [ ] Senha: `Teste@123`
- [ ] Anotar o UUID gerado

### 6. Vincular Usuario A ao Tenant A

- [ ] Em `/admin/tenants`, aba "Usuarios por Empresa"
- [ ] Selecionar "Transportadora Alpha"
- [ ] Clicar "Vincular"
- [ ] Inserir email: user.a@teste.com
- [ ] Clicar "Resolver"
- [ ] Confirmar que o UUID foi encontrado
- [ ] Papel: "admin_tenant"
- [ ] Salvar

### 7. Vincular Usuario B ao Tenant B

- [ ] Selecionar "Beta Logistica"
- [ ] Clicar "Vincular"
- [ ] Inserir email: user.b@teste.com
- [ ] Clicar "Resolver"
- [ ] Papel: "admin_tenant"
- [ ] Salvar

---

## Testes de Isolamento

### 8. Usuario A cria cliente no Tenant A

- [ ] Logout (se logado como super_admin)
- [ ] Login como user.a@teste.com / Teste@123
- [ ] Acessar `/cadastros/clientes`
- [ ] Criar cliente: "Cliente Alpha 1"
- [ ] Salvar
- [ ] Confirmar que o cliente aparece na lista

### 9. Usuario B cria cliente no Tenant B

- [ ] Logout
- [ ] Login como user.b@teste.com / Teste@123
- [ ] Acessar `/cadastros/clientes`
- [ ] Criar cliente: "Cliente Beta 1"
- [ ] Salvar
- [ ] Confirmar que o cliente aparece na lista

### 10. Confirmar que Usuario A NAO ve cliente de B

- [ ] Logout
- [ ] Login como user.a@teste.com / Teste@123
- [ ] Acessar `/cadastros/clientes`
- [ ] **Verificar**: "Cliente Beta 1" NAO aparece
- [ ] **Verificar**: "Cliente Alpha 1" aparece

### 11. Confirmar que Usuario B NAO ve cliente de A

- [ ] Logout
- [ ] Login como user.b@teste.com / Teste@123
- [ ] Acessar `/cadastros/clientes`
- [ ] **Verificar**: "Cliente Alpha 1" NAO aparece
- [ ] **Verificar**: "Cliente Beta 1" aparece

---

## Testes de Funcionalidades Transversais

### 12. Testar OS (Ordem de Servico)

- [ ] Login como user.a
- [ ] Criar uma OS para "Cliente Alpha 1"
- [ ] Salvar
- [ ] Login como user.b
- [ ] **Verificar**: OS do Tenant A NAO aparece
- [ ] Criar OS para "Cliente Beta 1"
- [ ] **Verificar**: Apenas OS do Tenant B aparece

### 13. Testar Financeiro

- [ ] Login como user.a
- [ ] Acessar `/financeiro`
- [ ] **Verificar**: Apenas dados financeiros do Tenant A
- [ ] Login como user.b
- [ ] Acessar `/financeiro`
- [ ] **Verificar**: Apenas dados financeiros do Tenant B
- [ ] **Verificar**: Nao ha dados do Tenant A

### 14. Testar Tracking Publico

- [ ] Anotar o codigo de rastreio de uma OS do Tenant A
- [ ] Fazer logout
- [ ] Acessar `/rastrear/<codigo_os_a>`
- [ ] **Verificar**: OS do Tenant A aparece
- [ ] Anotar o codigo de rastreio de uma OS do Tenant B
- [ ] Acessar `/rastrear/<codigo_os_b>`
- [ ] **Verificar**: OS do Tenant B aparece
- [ ] **Verificar**: Nao ha dados misturados

### 15. Testar Notificacoes

- [ ] Login como user.a
- [ ] Acessar portal de notificacoes
- [ ] **Verificar**: Apenas notificacoes do Tenant A
- [ ] Login como user.b
- [ ] **Verificar**: Apenas notificacoes do Tenant B

---

## Testes de Sessao

### 16. Logout e Login Reverso

- [ ] Login como user.a
- [ ] Confirmar dados do Tenant A
- [ ] Logout
- [ ] Login como user.b
- [ ] Confirmar dados do Tenant B
- [ ] Logout
- [ ] Login como user.a novamente
- [ ] Confirmar dados do Tenant A ainda estao corretos
- [ ] Repetir 3 vezes alternando
- [ ] **Verificar**: Nunca ha vazamento de dados entre tenants

### 17. Reset de Senha

- [ ] Acessar `/forgot-password`
- [ ] Inserir email do user.a
- [ ] Verificar caixa de entrada
- [ ] Clicar no link de reset
- [ ] Definir nova senha: `Novo@123`
- [ ] Login com nova senha
- [ ] **Verificar**: Dados do Tenant A ainda estao corretos
- [ ] **Verificar**: RLS continua funcionando

---

## Resumo de Testes

| # | Teste | Resultado Esperado | Status |
|---|-------|--------------------|--------|
| 1 | Login admin | OK | [ ] |
| 2 | Criar Tenant A | OK | [ ] |
| 3 | Criar Tenant B | OK | [ ] |
| 4 | Criar Usuario A | OK | [ ] |
| 5 | Criar Usuario B | OK | [ ] |
| 6 | Vincular A ao Tenant A | OK | [ ] |
| 7 | Vincular B ao Tenant B | OK | [ ] |
| 8 | A cria cliente | OK | [ ] |
| 9 | B cria cliente | OK | [ ] |
| 10 | A nao ve B | OK | [ ] |
| 11 | B nao ve A | OK | [ ] |
| 12 | OS isolada | OK | [ ] |
| 13 | Financeiro isolado | OK | [ ] |
| 14 | Tracking publico OK | OK | [ ] |
| 15 | Notificacoes isoladas | OK | [ ] |
| 16 | Logout/login reverso | OK | [ ] |
| 17 | Reset de senha | OK | [ ] |

---

## Criterios de Aprovacao

- [ ] **17/17 testes passam** sem erros
- [ ] Nenhum dado de um tenant aparece em outro tenant
- [ ] Login com credenciais de demo NAO funciona (VITE_AUTH_DEMO_MODE=false)
- [ ] Reset de senha funciona e mantem isolamento
- [ ] Tracking publico funciona sem auth
- [ ] Nao ha erros de RLS no console do navegador
- [ ] Nao ha erros 500 no servidor
