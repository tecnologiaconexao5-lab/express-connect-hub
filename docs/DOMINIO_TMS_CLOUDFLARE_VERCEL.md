# Domínio TMS — Cloudflare + Vercel

## Arquitetura

```
Usuário → https://tms.conexaoexpress.com.br
                ↓
          Cloudflare (DNS + proxy ☁️)
                ↓
          Vercel (SPA React)
                ↓
          Supabase (Auth + API + Edge Functions)
```

## Registros DNS no Cloudflare

| Registro | Tipo | Valor | Proxy | Função |
|----------|------|-------|:-----:|--------|
| `tms` | CNAME | `express-connect-hub.vercel.app` | ☁️ Laranja | Frontend TMS |
| `portal` | CNAME | `express-connect-hub.vercel.app` | ☁️ Laranja | Portal Cliente (mesma SPA) |
| `www` | CNAME | `express-connect-hub.vercel.app` | ☁️ Laranja | Redirect opcional para tms |

## Configuração no Vercel

No dashboard Vercel:
1. Project → Settings → Domains
2. Adicionar `tms.conexaoexpress.com.br`
3. Vercel exibe o valor CNAME esperado (tipicamente `cname.vercel-dns.com`)
4. Apontar CNAME no Cloudflare para `express-connect-hub.vercel.app`
5. Vercel verifica automaticamente e emite SSL

## SSL/TLS no Cloudflare

| Configuração | Valor |
|-------------|-------|
| SSL Mode | **Full (strict)** |
| Always Use HTTPS | **ON** |
| Minimum TLS Version | 1.2 |
| Certificate | Cloudflare Edge CA (automático) |

## Performance

| Recurso | Ativo? | Observação |
|---------|:------:|------------|
| Brotli | ✅ ON | Melhor compressão |
| HTTP/3 | ✅ ON | Mais rápido em redes móveis |
| Auto Minify | ✅ ON | HTML/CSS/JS |
| Rocket Loader | ❌ OFF | Quebra React SPA |
| Mirage | ❌ OFF | Apenas sites estáticos |

## Cache

```
Regra: tms.conexaoexpress.com.br/assets/*
Cache Level: Standard
Edge TTL: 7 dias
Browser TTL: 1 ano
```

## WAF (Web Application Firewall)

| Recurso | Ativo? |
|---------|:------:|
| Bot Fight Mode | ✅ ON |
| Browser Integrity Check | ✅ ON |
| Security Level | Medium |
| Rate Limiting `/api/*` | 100 req/min |
| Rate Limiting `/login` | 10 req/min (anti brute-force) |
