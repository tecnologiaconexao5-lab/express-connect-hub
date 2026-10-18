# Arquitetura Autônoma Híbrida — TMS Conexão Express

## Visão Geral

```
                   Cloudflare (DNS + SSL + Proteção)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Vercel       Supabase      Oracle VM
        (Frontend)     (Banco/Auth)   (Serviços 24h)
```

## Componentes

| Camada | Provedor | Função |
|--------|----------|--------|
| **DNS + SSL + Proteção** | Cloudflare | Domínio `*.conexaoexpress.com.br`, certificado SSL, proteção DDoS, Workers/Pages para apps leves |
| **Frontend SPA** | Vercel | TMS principal, Portal Cliente, todas as telas React |
| **Banco + Auth + RLS** | Supabase | PostgreSQL, Auth (login/register), RLS multi-tenant, Storage, Edge Functions |
| **Serviços 24h** | Oracle Cloud | n8n (automação), Evolution API (WhatsApp), Redis, workers/robôs contínuos |

## Fluxo de Dados

```
Usuário → navegador → Cloudflare DNS → Vercel (SPA)
                                         │
                                    Supabase Auth (login)
                                         │
                                    Supabase DB (dados)
                                         │
                                    Edge Functions (operações sensíveis)
                                         │
              ┌──────────────────────────┘
              ▼
         Oracle VM
         ├── n8n → webhooks → APIs externas
         ├── Evolution API → WhatsApp
         ├── Redis → cache/fila
         └── Robôs workers → processamento contínuo
```

## Por que não Oracle para o TMS?

| Fator | Vercel | Oracle (VM.Standard.E2.1.Micro) |
|-------|--------|--------------------------------|
| Custo | Gratuito (Hobby) | Grátis (sempre-free) |
| Build/Deploy | `git push` automático | `docker build` manual |
| SSL | Automático (Let's Encrypt) | Certbot manual |
| CDN Global | Sim (100+ PoPs) | Não (1 VM em sa-east-1) |
| Manutenção | Zero | Atualizações SO + Docker |
| RAM disponível | Ilimitado (serverless) | 1 GB (para n8n+Evolution+Redis) |

## Serviços que PERMANECEM na Vercel

- `https://express-connect-hub.vercel.app` → TMS principal
- Portal Cliente (dentro do mesmo SPA, rota `/portal-cliente`)
- Futuro site institucional

## Serviços que FICAM na Oracle

- n8n (automação + webhooks)
- Evolution API (WhatsApp)
- Redis (cache + fila de execução)
- Workers contínuos (robôs, conectores, processamento)
- **Não hospedar o frontend TMS**

## Comunicação entre camadas

```
Vercel (SPA) ──HTTPS──→ Supabase (direto, via @supabase/supabase-js)
Vercel (SPA) ──HTTPS──→ Oracle n8n (webhooks, via fetch)
Vercel (SPA) ──fetch──→ Supabase Edge Functions
Oracle n8n   ──SQL──→ Supabase (via service_role)
Oracle n8n   ──fetch──→ Evolution API (localhost)
```
