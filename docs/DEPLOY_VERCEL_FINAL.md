# Deploy Vercel — Final

## Pré-requisitos

- [ ] Conta Vercel conectada ao GitHub (tecnologiaconexao5-lab)
- [ ] Repositório `express-connect-hub` importado
- [ ] `vercel.json` na raiz com SPA rewrite

## Configuração Atual

**Arquivo:** `vercel.json`
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Framework:** Vite + React (auto-detectado pela Vercel)

**Build Command:** `npm run build` (preset Vite)

**Output Directory:** `dist` (preset Vite)

## Variáveis de Ambiente Obrigatórias

Adicionar no dashboard Vercel → Project → Settings → Environment Variables:

### Grupo A — Públicas (seguras no bundle)
| Variável | Valor | Secreta? |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | `https://uwrvzsjtpgaifkktpepn.supabase.co` | ❌ |
| `VITE_SUPABASE_ANON_KEY` | anon key do projeto | ❌ |
| `VITE_MAPBOX_ACCESS_TOKEN` | token público Mapbox | ❌ |
| `VITE_MAPBOX_TOKEN` | token público Mapbox | ❌ |
| `VITE_AUTH_DEMO_MODE` | `false` | ❌ |
| `VITE_APP_URL` | `https://tms.conexaoexpress.com.br` | ❌ |
| `VITE_ZOHO_MODE` | `assistido` | ❌ |
| `VITE_WHATSAPP_MODE` | `assistido` | ❌ |
| `VITE_AI_PROVIDER` | `groq` | ❌ |

### Grupo B — Sensíveis (necessárias no bundle)
| Variável | Secreta? | Risco |
|----------|----------|-------|
| `VITE_GROQ_API_KEY` | ✅ Sim | Médio (rate limit provider) |
| `VITE_GEMINI_API_KEY` | ✅ Sim | Médio |
| `VITE_OPENAI_API_KEY` | ✅ Sim | Médio |
| `VITE_OPENROUTER_API_KEY` | ✅ Sim | Médio |
| `VITE_ANTHROPIC_API_KEY` | ✅ Sim | Médio |
| `VITE_EVOLUTION_API_KEY` | ✅ Sim | Médio (mover para n8n futuro) |
| `VITE_ZOHO_CLIENT_ID` | ✅ Sim | Baixo (OAuth2 público) |
| `VITE_ZOHO_CLIENT_SECRET` | ✅ Sim | Baixo (OAuth2 público) |
| `VITE_ZOHO_REFRESH_TOKEN` | ✅ Sim | Médio (escopo restrito) |
| `VITE_ZOHO_ACCOUNT_ID` | ❌ | Baixo (ID público) |

## Ordem de Criação

1. Fazer deploy inicial (`git push` → Vercel detecta)
2. Configurar domínio customizado no dashboard Vercel
3. Adicionar variáveis de ambiente (grupo A + B)
4. Fazer novo deploy para aplicar variáveis
5. Configurar Cloudflare DNS (CNAME → vercel.app)

## Checklist

- [ ] `vercel.json` presente com SPA rewrite
- [ ] Build command: `npm run build`
- [ ] Output: `dist`
- [ ] Node version: 22.x (ou auto)
- [ ] Variáveis Grupo A configuradas
- [ ] Variáveis Grupo B configuradas
- [ ] Domínio customizado apontado
- [ ] SSL automático ativo
- [ ] Deploy automático via `main` branch
- [ ] Previews automáticos para PRs (opcional)

## Rollback

```bash
# Opção 1 — Dashboard Vercel
Project → Deployments → ⋮ → Promote to Production

# Opção 2 — Git revert
git revert HEAD --no-edit
git push origin main
# Vercel deploy automático
```

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| 404 em rota SPA | vercel.json ausente | Adicionar rewrite |
| Variável não lida | Não adicionada no Vercel | Adicionar em Settings → Environment Variables |
| Build lento | Dependências pesadas | Verificar package.json, usar `npm ci` |
| CSS quebrado | Cache | Fazer hard refresh (Ctrl+Shift+R) |
| Auth não funciona | `VITE_AUTH_DEMO_MODE=true` | Mudar para `false` |
| Chave IA não funciona | Chave inválida/expirada | Renovar no provider e atualizar Vercel |
