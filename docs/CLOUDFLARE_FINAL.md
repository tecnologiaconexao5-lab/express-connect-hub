# Cloudflare — Configuração Final

## 1. DNS — Registros

### Domínios Gerenciados
- `conexaoexpress.com.br` (principal)
- `conexaoexpress.app` (app download)

### Subdomínios TMS

| Registro | Tipo | Valor | Proxy | Função |
|----------|------|-------|-------|--------|
| `tms` | CNAME | `express-connect-hub.vercel.app` | ☁️ Laranja | Frontend TMS |
| `www` | CNAME | `express-connect-hub.vercel.app` | ☁️ Laranja | Site institucional (ou TMS) |
| `portal` | CNAME | `express-connect-hub.vercel.app` | ☁️ Laranja | Portal Cliente (SPA mesmo) |
| `api` | A | `<IP_ORACLE>` | ☁️ Laranja | API Oracle (n8n/workers) |
| `n8n` | A | `<IP_ORACLE>` | ☁️ Laranja | n8n (se exposto) |
| `evolution` | A | `<IP_ORACLE>` | ☁️ Laranja | Evolution API (se exposto) |
| `prestador` | CNAME | `prestador-app.pages.dev` | ☁️ Laranja | App Prestador PWA |
| `motorista` | CNAME | (DreamFlow) | ☁️ Laranja | App Motorista |
| `app` | CNAME | (conexaoexpress.app) | DNS Only | Link download |

> ⚠️ **Regra:** Sempre usar proxy laranja (☁️) para proteger IP real da Oracle.

## 2. SSL/TLS

| Configuração | Valor Recomendado |
|-------------|------------------|
| Modo SSL | **Full (strict)** |
| Always Use HTTPS | **ON** |
| Minimum TLS Version | **1.2** |
| Automatic HTTPS Rewrites | **ON** |
| Certificate | **Cloudflare Edge CA** |
| HTTP/3 (QUIC) | **ON** (padrão) |
| Brotli Compression | **ON** (padrão) |
| 0-RTT Connection Resumption | **OFF** (segurança) |

### Origin Certificate (para Oracle)
Se a Oracle precisar de certificado válido:
```
Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
```
Usar no nginx da Oracle se expor APIs diretamente.

## 3. Performance

| Recurso | Ativar? | Observação |
|---------|---------|------------|
| Brotli | ✅ ON | Melhor compressão que gzip |
| HTTP/3 | ✅ ON | Mais rápido em redes móveis |
| Auto Minify | ✅ ON | HTML/CSS/JS |
| Rocket Loader | ❌ OFF | Quebra React SPA |
| Mirage | ❌ OFF | Apenas para sites estáticos |
| Polish | ❌ OFF | Sem imagens no origin |

## 4. Cache

### Cache Rules para o Vercel
```
Rule: tms.conexaoexpress.com.br/assets/*
Cache Level: Standard
Edge TTL: 7 days
Browser TTL: 1 year
```

### Cache Rules para API Oracle
```
Rule: api.conexaoexpress.com.br/*
Cache Level: Bypass (dinâmico)
```

## 5. WAF — Web Application Firewall

| Recurso | Ativar? | Observação |
|---------|---------|------------|
| Bot Fight Mode | ✅ ON | Bloqueia bots maliciosos |
| WAF Managed Rules | ✅ ON (plano Pro+) | Proteção OWASP |
| Rate Limiting | ✅ ON | 100 req/min por IP |
| IP Geolocation | ✅ ON | Para logs de segurança |
| Browser Integrity Check | ✅ ON | Bloqueia requests sem JS |
| Security Level | Medium | Equilíbrio segurança/usabilidade |

### Rate Limiting Rules
```
Path: /api/*
Threshold: 100 requests per 60 seconds
Action: Block for 10 minutes

Path: /login
Threshold: 10 requests per 60 seconds
Action: Block for 30 minutes (anti-brute-force)
```

## 6. Transform Rules

### Redirect HTTP → HTTPS (se não automático)
```
When: incoming request scheme equals "http"
Then: redirect to "https://" + host + path
Status: 301
```

### Redirect www → apex (se desejado)
```
When: hostname equals "www.conexaoexpress.com.br"
Then: redirect to "https://tms.conexaoexpress.com.br" + path
Status: 301
```

## 7. Workers existentes

| Worker | URL | Status | Ação |
|--------|-----|--------|------|
| `tight-truth-4707` | `...workers.dev` | Ativo | Manter até app prestador migrar |

## 8. Pages existentes

| Page | URL | Status | Ação |
|------|-----|--------|------|
| `prestador-app` | `prestador-app.pages.dev` | Ativo | Migrar para `prestador.conexaoexpress.com.br` |

## 9. R2 — Object Storage

| Bucket | Uso | Status |
|--------|-----|--------|
| `pub-bb2e103a...` | Imagens preview | Ativo |

## 10. Verificação Final

```bash
# DNS propagation
nslookup tms.conexaoexpress.com.br
dig tms.conexaoexpress.com.br

# SSL
curl -vI https://tms.conexaoexpress.com.br 2>&1 | grep "SSL"
openssl s_client -connect tms.conexaoexpress.com.br:443 -servername tms.conexaoexpress.com.br

# Headers
curl -sI https://tms.conexaoexpress.com.br | grep -i "cf-"

# Proxy check
curl -sI https://tms.conexaoexpress.com.br | grep -i "server: cloudflare"
```
