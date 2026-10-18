# Vercel — Passo a Passo para Go Live

## Pré-requisitos

- [ ] Repositório conectado ao Vercel via GitHub
- [ ] `vercel.json` na raiz com SPA rewrite (já existe)
- [ ] Build local validado: `npm run build` → sucesso (✅ verificado)

## Passo 1 — Configurar Variáveis no Vercel

1. Acessar: https://vercel.com → Dashboard → `express-connect-hub` → Settings → Environment Variables
2. Adicionar (valores do `.env.production`):

| Variável | Valor | Encrypt? |
|----------|-------|:--------:|
| `VITE_SUPABASE_URL` | `https://uwrvzsjtpgaifkktpepn.supabase.co` | ❌ |
| `VITE_SUPABASE_ANON_KEY` | anon key | ❌ |
| `VITE_MAPBOX_ACCESS_TOKEN` | pk.ey... | ❌ |
| `VITE_MAPBOX_TOKEN` | pk.ey... | ❌ |
| `VITE_APP_URL` | `https://tms.conexaoexpress.com.br` | ❌ |
| `VITE_AUTH_DEMO_MODE` | `false` | ❌ |
| `VITE_AI_PROVIDER` | `groq` | ❌ |
| `VITE_ZOHO_MODE` | `assistido` | ❌ |
| `VITE_WHATSAPP_MODE` | `assistido` | ❌ |
| `VITE_TMS_EDGE_INTERNAL_TOKEN` | token interno | ✅ |

3. **NÃO** adicionar `VITE_GROQ_API_KEY` etc. — chaves IA ficam no Supabase Secrets (proxy-ia)

## Passo 2 — Fazer Deploy

```bash
git add .
git commit -m "deploy: preparacao para producao Vercel"
git push origin main
```

Vercel detecta o push e faz deploy automático.

## Passo 3 — Verificar Deploy

- [ ] Build passa no Vercel (0 erros)
- [ ] Logs de build sem warnings de variáveis ausentes
- [ ] URL `https://express-connect-hub.vercel.app` carrega
- [ ] Login funcional
- [ ] Navegação entre páginas funciona

## Passo 4 — Configurar Domínio Customizado

- [ ] Adicionar `tms.conexaoexpress.com.br` em Settings → Domains
- [ ] Aguardar verificação SSL (automática)
- [ ] Verificar HTTPS funcional

## Passo 5 — Pós-deploy

- [ ] Console browser sem erros (F12)
- [ ] Refresh em rota aninhada não dá 404
- [ ] Login real funcional
- [ ] Proxy-ia testado (chamada IA funcional)

## Rollback

```bash
# Opção 1: Dashboard Vercel
Project → Deployments → ⋮ → Promote to Production (deploy anterior)

# Opção 2: Git revert
git revert HEAD --no-edit
git push origin main
```
