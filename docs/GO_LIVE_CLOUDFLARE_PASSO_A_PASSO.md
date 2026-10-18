# Cloudflare — Passo a Passo para Go Live

## Pré-requisitos

- [ ] Domínio `conexaoexpress.com.br` gerenciado pela Cloudflare
- [ ] Deploy Vercel concluído (ver `GO_LIVE_VERCEL_PASSO_A_PASSO.md`)

## Passo 1 — Configurar DNS

No Cloudflare Dashboard → DNS → Records, adicionar:

| Tipo | Nome | Valor | Proxy |
|:----:|:----:|-------|:-----:|
| CNAME | `tms` | `express-connect-hub.vercel.app` | ☁️ Laranja |
| CNAME | `portal` | `express-connect-hub.vercel.app` | ☁️ Laranja |

> Sempre usar proxy laranja (☁️) para proteger IP real e habilitar WAF/SSL.

## Passo 2 — Configurar SSL/TLS

Cloudflare Dashboard → SSL/TLS:

| Configuração | Valor |
|-------------|-------|
| Mode | **Full (strict)** |
| Always Use HTTPS | **ON** |
| Minimum TLS Version | **1.2** |
| Automatic HTTPS Rewrites | **ON** |

## Passo 3 — Configurar Performance

Cloudflare Dashboard → Speed → Optimization:

- [ ] Brotli: ON
- [ ] Auto Minify: ON (HTML/CSS/JS)
- [ ] Rocket Loader: **OFF** (quebra React SPA)
- [ ] Mirage: **OFF**

## Passo 4 — Configurar Cache (opcional)

Cloudflare Dashboard → Caching → Cache Rules:

```
Rule: tms.conexaoexpress.com.br/assets/*
Cache Level: Standard
Edge TTL: 7 days
Browser TTL: 1 year
```

## Passo 5 — Configurar WAF (opcional)

Cloudflare Dashboard → Security → WAF:

- [ ] Bot Fight Mode: ON
- [ ] Browser Integrity Check: ON
- [ ] Security Level: Medium

Rate Limiting (se disponível no plano):

```
Path: /api/*
Threshold: 100 requests per 60 seconds
Action: Block for 10 minutes

Path: /login
Threshold: 10 requests per 60 seconds
Action: Block for 30 minutes
```

## Passo 6 — Verificar

```bash
nslookup tms.conexaoexpress.com.br
# Deve resolver para IPs da Cloudflare

curl -sI https://tms.conexaoexpress.com.br | findstr "cf-"
# Deve conter headers Cloudflare

curl -sI https://tms.conexaoexpress.com.br | findstr "server"
# Deve conter "cloudflare"
```

## Rollback

Para remover o domínio do Cloudflare:
1. Cloudflare Dashboard → DNS → Remover registro `tms` CNAME
2. Vercel Dashboard → Settings → Domains → Remover `tms.conexaoexpress.com.br`
