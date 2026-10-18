# Topologia Final — Express Connect Hub

## Visão Geral

```
                  🌐 Usuários
                      │
                      ▼
          ┌───────────────────────┐
          │    Cloudflare (CDN)   │
          │  ☁️ Proxy / WAF / SSL  │
          │  tms.conexaoexpress    │
          └──────┬────────────────┘
                 │
          ┌──────┴────────────────┐
          │    Vercel (Frontend)   │
          │   React SPA + Vite    │
          │  express-connect-hub   │
          │  dist/ → index.html    │
          │  /assets/* → estático  │
          └──────┬────────────────┘
                 │
          ┌──────┴────────────────┐
          │ Supabase (Backend)    │
          │ PostgreSQL + Auth +   │
          │ Realtime + Storage    │
          │ uwrvzsjt...pn.supabase│
          └───────────────────────┘
```

## Infraestrutura Oracle

```
          ┌─────────────────────┐
          │   Oracle Cloud VM   │
          │  (serviços internos) │
          ├─────────────────────┤
          │  Evolution API :8080│ ← WhatsApp Gateway
          │  Redis :6379        │ ← Cache/Fila
          │  n8n :5678          │ ← Automação
          │  Watchtower         │ ← Auto-update
          └─────────────────────┘
```

## Fluxo de Requisição

```
Browser → Cloudflare (proxy laranja) → Vercel (index.html)
                                        │
                                    React SPA
                                        │
                              ┌──────┬──┴──┬──────┐
                              ▼      ▼     ▼      ▼
                          Supabase  APIs  n8n  Evolution
                          (direto)   (via   (webhooks)
                                     n8n)
```

## Domínios

| Domínio | Provedor | Função |
|---------|----------|--------|
| `conexaoexpress.com.br` | Cloudflare DNS | Principal |
| `tms.conexaoexpress.com.br` | Vercel | Frontend TMS |
| `prestador.conexaoexpress.com.br` | Cloudflare Pages | App Prestador |
| `conexaoexpress.app` | Cloudflare DNS | Download app |
| `api.conexaoexpress.com.br` | Oracle | APIs (futuro) |

## Redes Docker Oracle

```
oracle_network (bridge)
├── oracle_redis     :6379
├── evolution_postgres :5432
├── evolution_redis  :6379
├── evolution_api    :8080
├── n8n              :5678
└── watchtower       (monitora)
```

## Segurança

| Camada | Proteção |
|--------|----------|
| DNS | Cloudflare proxy laranja |
| Edge | WAF + Rate Limiting + Bot Fight Mode |
| HTTP | SSL/TLS Full Strict + Always HTTPS |
| Código | Source maps em produção: ❌ (Vite desabilita por padrão) |
| API | Supabase RLS + JWT |
| Secrets | .env + Vercel Environment Variables |
| Container | Watchtower auto-update |
