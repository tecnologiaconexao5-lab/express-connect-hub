# Mapa de Deploy — Vercel + Cloudflare + Supabase + Oracle

## 1. Vercel — Frontend TMS

**Status:** ✅ Já configurado

### URLs
| Ambiente | URL |
|----------|-----|
| Produção | `https://express-connect-hub.vercel.app` |
| Futuro domínio | `https://tms.conexaoexpress.com.br` (via Cloudflare proxy) |

### Configuração
- `vercel.json` com SPA rewrite → já existe
- Framework: Vite + React + TypeScript
- Build: `npm run build` (já configurado no Vercel)
- Variáveis: adicionar no dashboard Vercel → Project Settings → Environment Variables

### Deploy
```bash
git push origin main
# Vercel detecta e faz deploy automático
```

### Variáveis necessárias no Vercel
Todas as `VITE_*` públicas do `.env.production`. Ver `docs/VARIAVEIS_AMBIENTE_HIBRIDAS.md` para a lista completa.

---

## 2. Cloudflare — Domínio e Proteção

**Status:** ✅ Já configurado parcialmente

### DNS
Registrar no Cloudflare:
```
tms.conexaoexpress.com.br  CNAME  express-connect-hub.vercel.app  (proxy: laranja ☁️)
portal.conexaoexpress.com.br  CNAME  express-connect-hub.vercel.app  (proxy: laranja ☁️)
prestador.conexaoexpress.com.br  → Cloudflare Pages (prestador-app.pages.dev)
api.conexaoexpress.com.br  → Oracle VM IP (proxy: laranja ☁️)
```

### SSL
- Cloudflare Full (strict) — certificado automático
- Origin Certificate para o Oracle se necessário

### Workers existentes
| Worker | URL | Função |
|--------|-----|--------|
| `tight-truth-4707` | `tight-truth-4707.emailconexao218.workers.dev` | App prestador temporário |

### Pages existentes
| Page | URL | Função |
|------|-----|--------|
| `prestador-app` | `prestador-app.pages.dev` | App prestador Flutter PWA |

### Regras de Page Rule / Redirect
- `tms.conexaoexpress.com.br/*` → proxy para Vercel
- `prestador.conexaoexpress.com.br/*` → proxy para Cloudflare Pages

---

## 3. Supabase — Banco e Auth

**Status:** ✅ Já configurado

```
Project: conexao-express-tms
Ref: uwrvzsjtpgaifkktpepn
URL: https://uwrvzsjtpgaifkktpepn.supabase.co
```

### Migrations: 87 arquivos aplicados
### Edge Functions: 7 ativas
### RPCs: 40+ funções PostgreSQL

---

## 4. Oracle — Serviços 24h

**Status:** ⏳ Pendente de configuração

### VM
- Tipo: VM.Standard.E2.1.Micro (sempre-free)
- RAM: 1 GB
- OS: Ubuntu 22.04+
- IP: Fixo público

### Serviços
```
Porta 8080 → Evolution API (container Docker)
Porta 5678 → n8n (container Docker)
Porta 6379 → Redis (container Docker)
```

### Deploy dos serviços
```bash
# Evolution API
docker compose -f docker/evolution-api/docker-compose.yml up -d

# n8n
docker compose -f docker/n8n/docker-compose.yml up -d

# Redis
docker run -d --name redis --restart always -p 6379:6379 redis:7-alpine
```
