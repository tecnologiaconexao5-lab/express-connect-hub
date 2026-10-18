# MISSÃO 109-A — Ambiente

## Identificação do Ambiente

| Item | Valor |
|------|-------|
| Caminho repositório TMS | `C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub` |
| Branch atual | `main` |
| Último commit | `fec252d` - "Atualizacoes TMS 02-06" |
| Arquivos modificados | ~200+ arquivos modificados (não commitados) |
| Node version | v24.14.1 |
| npm version | 11.11.0 |
| Playwright version | 1.58.2 |

## Servidor

| Item | Valor |
|------|-------|
| Comando dev | `npm run dev` → `vite` (porta 8800) |
| URL | `http://localhost:8800` |
| Status | ✅ Rodando |
| Vite config | host `::`, port `8800`, HMR overlay disabled |

## Supabase

| Item | Valor |
|------|-------|
| Projeto | `uwrvzsjtpgaifkktpepn.supabase.co` |
| Modo | **Produção remota** (não local) |
| Anon key | Configurada no `.env` |
| Service role | Configurada (parcialmente) |
| Tenant | `00000000-0000-0000-0000-000000000001` - Conexao Express |

## Credenciais de Teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin/Super | `tamiris.castilho@conexaoexpress.com.br` | `__CONEXAO2026_TAMIRIS__` (placeholder) / `Conexao@2026` (real) |
| Financeiro | `financeiro@conexaoexpress.com.br` | `Conexao@2026` |
| Comercial | `comercial@conexaoexpress.com.br` | `Conexao@2026` |
| Operacional | `operacional@conexaoexpress.com.br` | `Conexao@2026` |
| Atendimento | `contato@conexaoexpress.com.br` | `Conexao@2026` |

**Nota**: As senhas reais foram descobertas empiricamente. Os placeholders da Missão 50 nunca foram substituídos.

## Playwright

| Item | Valor |
|------|-------|
| Config | `playwright.config.ts` |
| TestDir | `./tests/e2e` |
| baseURL | `http://localhost:8800` |
| Browser | Chromium (headed/headless) |
| Workers | 1 |
| Timeout | 120s |
| Comando headed | `npx playwright test --headed` |
| Comando headless | `npx playwright test` |
| Storage state | Não configurado |
| Auth helper | `tests/e2e/helpers/auth.ts` - login via formulário |

## Bloqueios Conhecidos

1. **"Carregando sessão..."** em rotas lazy-loaded via `page.goto()`: navegação direta para `/financeiro`, `/relatorios`, `/contratos`, `/frota` causa "Carregando sessão..." infinito. Contorno: navegação via sidebar (SPA).
2. **Senhas placeholder**: as senhas no código são placeholders (`__CONEXAO2026_TAMIRIS__`). As senhas reais foram descobertas e configuradas via env var `PLAYWRIGHT_TAMIRIS_PASSWORD`.
3. **Sem storageState**: cada teste precisa fazer login individualmente.
