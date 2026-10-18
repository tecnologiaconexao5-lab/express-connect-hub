# Checklist Cloudflare — Go Live

## 1. DNS

- [ ] `tms.conexaoexpress.com.br` — CNAME → `express-connect-hub.vercel.app`
- [ ] `www.conexaoexpress.com.br` — CNAME → `express-connect-hub.vercel.app` (opcional)
- [ ] `portal.conexaoexpress.com.br` — CNAME → Vercel
- [ ] `api.conexaoexpress.com.br` — A → IP Oracle
- [ ] `prestador.conexaoexpress.com.br` — CNAME → `prestador-app.pages.dev`
- [ ] Proxy laranja (☁️) ativo em todos os subdomínios
- [ ] TTL DNS ≥ 120s (ou Auto)

## 2. SSL/TLS

- [ ] Modo SSL: **Full (strict)**
- [ ] Always Use HTTPS: **ON**
- [ ] Minimum TLS Version: **1.2**
- [ ] Automatic HTTPS Rewrites: **ON**
- [ ] HTTP/3: **ON**
- [ ] 0-RTT Connection Resumption: **OFF**

## 3. Proxy

- [ ] IP real da Oracle protegido (proxy laranja)
- [ ] Origin Certificate emitido (se Oracle expor APIs)
- [ ] Browser Integrity Check: **ON**
- [ ] Security Level: **Medium**

## 4. WAF

- [ ] Bot Fight Mode: **ON**
- [ ] WAF Managed Rules: **ON** (plano Pro+)
- [ ] Rate Limiting rule para `/api/*`: 100 req/min
- [ ] Rate Limiting rule para `/login`: 10 req/60s

## 5. Cache Rules

- [ ] Assets (`/assets/*`): Edge TTL 7 dias, Browser TTL 1 ano
- [ ] API (`/api/*`): Bypass cache (dinâmico)
- [ ] HTML (`/`): Edge TTL padrão (Vercel gerencia)

## 6. Performance

- [ ] Auto Minify: **ON** (HTML/CSS/JS)
- [ ] Rocket Loader: **OFF** (quebra React SPA)
- [ ] Mirage: **OFF**
- [ ] Polish: **OFF**
- [ ] Brotli: **ON** (padrão)

## 7. Workers/Pages

- [ ] Worker `tight-truth-4707` mantido (app prestador)
- [ ] Page `prestador-app.pages.dev` ativa
- [ ] Domínio `prestador.conexaoexpress.com.br` configurado

## 8. R2 (Storage)

- [ ] Bucket `pub-bb2e103a...` ativo (imagens preview)

## 9. Verificação

- [ ] `nslookup tms.conexaoexpress.com.br` — IP Cloudflare
- [ ] `curl -sI https://tms.conexaoexpress.com.br` — `server: cloudflare`
- [ ] SSL válido (não expirado)
- [ ] WAF não bloqueia tráfego legítimo
