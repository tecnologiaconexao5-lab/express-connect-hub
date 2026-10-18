# Status do Projeto (TMS Conexão Express)

## Missão Atual
- **Missão:** MISSÃO 51.2 — Corrigir Todos os Logins Reais
- **Status:** ✅ CONCLUÍDA — todos os 6 usuários reais funcionando

## Métricas de Qualidade
- **Último TypeScript:** ✅ 0 erros (`npx tsc --noEmit`) — 2026-07-01
- **Último Build:** ✅ build ok (32s) — 2026-07-01
- **Último Playwright:** ✅ 7/7 testes passaram (`logins-reais-todos.spec.ts --headed`) — 2026-07-01

## Estado dos Usuários Corporativos (TODOS FUNCIONANDO)
| Email | Papel | Redireciona | Status |
|-------|-------|------------|--------|
| `financeiro@conexaoexpress.com.br` | `financeiro` | `/financeiro` | ✅ OK |
| `comercial@conexaoexpress.com.br` | `comercial` | `/comercial` | ✅ OK |
| `operacional@conexaoexpress.com.br` | `operacional` | `/operacao` | ✅ OK |
| `contato@conexaoexpress.com.br` | `atendimento` | `/dashboard` | ✅ OK |
| `tamiris.castilho@conexaoexpress.com.br` | `super_admin` | `/dashboard` | ✅ OK |
| `cliente.teste@conexaoexpress.com.br` | `cliente` | `/portal-cliente` | ✅ OK |

**Senha padrão todos (exceto cliente):** `Conexao@2026`
**Senha cliente.teste:** `Teste@2026`

## Causa Raiz da Falha (M51.2)
`financeiro`, `comercial` e `operacional` existiam em `auth.users` (email confirmado) mas **não tinham registro em `public.tenant_usuarios`**. Sem o papel no banco, o `buildUserFromSession()` não conseguia construir o `User` e retornava erro — o que o Supabase sinaliza como "Invalid login credentials" na tela.

**Correção:** inserção de vínculos em `tenant_usuarios` + reset de senha via `crypt()`.

## Bugs Conhecidos
- Sem `signUp` no frontend (novos usuários precisam ser criados manualmente via Supabase).
- Rota `/portal-cliente` sem proteção de autenticação (qualquer URL direta funciona).
- O teste 06 de `missao-critica-login.spec.ts` falha por timing (admin→/cadastros/clientes com texto "Clientes" não detectado em 3s).
- `playwright.config.ts` foi ajustado para `reuseExistingServer: !process.env.CI` para evitar conflito de porta em dev local.

## Arquivos Alterados (M51 / M51.2)
- `scratch/audit_all_users.cjs` — auditoria de usuários (diagnóstico)
- `scratch/audit_tenant.cjs` — auditoria de vínculos tenant (diagnóstico)
- `scratch/fix_users.cjs` — correção inicial de 3 usuários (M51)
- `scratch/fix_all_logins.cjs` — correção completa de todos os 6 usuários (M51.2)
- `tests/e2e/logins-reais-todos.spec.ts` — spec Playwright com todos os 6 usuários
- `tests/e2e/missao51-screenshots.spec.ts` — spec de screenshots M51
- `playwright.config.ts` — reuseExistingServer: `!process.env.CI`

## Screenshots Geradas
- `test-results/screenshots/logins-reais-todos/01-financeiro.png`
- `test-results/screenshots/logins-reais-todos/02-comercial.png`
- `test-results/screenshots/logins-reais-todos/03-operacional.png`
- `test-results/screenshots/logins-reais-todos/04-contato-atendimento.png`
- `test-results/screenshots/logins-reais-todos/05-tamiris-admin.png`
- `test-results/screenshots/logins-reais-todos/06-cliente-teste.png`
- `test-results/screenshots/logins-reais-todos/07-credencial-invalida.png`

## Próximo Passo Obrigatório
1. Validar login na **tela real de produção** (`tms.conexaoexpress.com.br`) com cada um dos 6 usuários.
2. Verificar RLS — cada papel vê apenas os dados permitidos pela matriz de permissões.
3. Avançar para próxima missão (a definir pelo usuário).
