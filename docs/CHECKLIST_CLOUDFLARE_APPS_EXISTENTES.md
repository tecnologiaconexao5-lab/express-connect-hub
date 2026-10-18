# Checklist Cloudflare — Apps Existentes e Configuração

## 1. Visão Geral

Conta Cloudflare associada ao domínio `conexaoexpress.com.br`.

## 2. DNS Existente

### Domínios e Subdomínios Mapeados

| Domínio | Destino | Proxy | Status |
|---------|---------|-------|--------|
| `conexaoexpress.com.br` | ? | ? | ⏳ Verificar |
| `www.conexaoexpress.com.br` | Site institucional | ? | ⏳ Verificar |
| `tms.conexaoexpress.com.br` | Planejado: Vercel | ☁️ Laranja | ⏳ Pendente |
| `portal.conexaoexpress.com.br` | Planejado: Vercel | ☁️ Laranja | ⏳ Pendente |
| `prestador.conexaoexpress.com.br` | Planejado: Pages | ☁️ Laranja | ⏳ Pendente |
| `api.conexaoexpress.com.br` | Planejado: Oracle | ☁️ Laranja | ⏳ Pendente |

> ⚠️ **AVISO:** Não alterar registros DNS sem validação manual no dashboard Cloudflare.

## 3. Workers Existentes

### Worker 1 — App Prestador Temporário
- **Nome:** `tight-truth-4707`
- **URL:** `https://tight-truth-4707.emailconexao218.workers.dev`
- **Função:** App prestador temporário (testes E2E)
- **Código:** Deploy manual via dashboard Cloudflare
- **Status:** ⏳ Verificar se ainda está ativo

### Workers Adicionais
- Verificar no dashboard Cloudflare se há outros Workers
- Verificar se há Workers conectados a R2 ou D1

## 4. Pages Existentes

### Page 1 — Prestador App (Flutter PWA)
- **Nome:** `prestador-app`
- **URL:** `https://prestador-app.pages.dev`
- **Função:** App prestador Flutter
- **Framework:** Flutter Web
- **Domínio customizado:** Planejado `prestador.conexaoexpress.com.br`
- **Status:** ✅ Ativo (testes E2E referenciam)

## 5. R2 (Object Storage)

### Bucket Identificado
- **Bucket:** `pub-bb2e103a32db4e198524a2e9ed8f35b4`
- **Domínio:** `pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev`
- **Uso:** Imagens OG/Preview
- **Arquivos:** Pelo menos 1 imagem de preview de documento
- **Status:** ✅ Ativo

> Verificar se há mais buckets em uso.

## 6. Regras de Page Rules / Redirect

Atualmente:
- Sem regras documentadas

Necessário configurar:
- `tms.conexaoexpress.com.br/*` → proxy para Vercel
- `portal.conexaoexpress.com.br/*` → proxy para Vercel
- `prestador.conexaoexpress.com.br/*` → proxy para Cloudflare Pages

## 7. SSL/TLS

| Configuração | Valor |
|-------------|-------|
| Modo SSL | Full (strict) recomendado |
| Always Use HTTPS | ✅ Recomendado |
| Minimum TLS Version | 1.2 |
| Certificate | Automático (Cloudflare Edge) |

## 8. Security / WAF

- Bot Fight Mode: ⏳ Verificar
- Web Application Firewall: ⏳ Verificar (plano Free/Pro)
- Rate Limiting: ⏳ Verificar
- IP Geolocation: ⏳ Verificar (útil para multi-tenant)

## 9. Ações Antes de Alterar

- [ ] Fazer login no dashboard Cloudflare
- [ ] Verificar Workers existentes e código
- [ ] Verificar Pages existentes e builds
- [ ] Verificar R2 buckets e arquivos
- [ ] Verificar Page Rules atuais
- [ ] Verificar configuração SSL atual
- [ ] Verificar registros DNS atuais
- [ ] Documentar tudo ANTES de alterar
- [ ] Fazer backup da configuração DNS (export)
- [ ] Validar com equipe antes de publicar alterações

## 10. Apps Identificados na Arquitetura

| App | Plataforma | URL | Cloudflare? |
|-----|-----------|-----|-------------|
| TMS (frontend) | Vercel | `express-connect-hub.vercel.app` | ⏳ Futuro proxy |
| Portal Cliente | Vercel (mesmo SPA) | `express-connect-hub.vercel.app/portal-cliente` | ⏳ Futuro proxy |
| App Prestador (temporário) | Cloudflare Worker | `tight-truth-4707...workers.dev` | ✅ Sim |
| App Prestador (oficial) | Cloudflare Pages | `prestador-app.pages.dev` | ✅ Sim |
| App Motorista (DreamFlow) | Firebase? | `express-hub.web.app` | ❌ Firebase |
| Site institucional | ? | `www.conexaoexpress.com.br` | ⏳ A confirmar |
| `conexaoexpress.app` | ? | `conexaoexpress.app` (link app download) | ⏳ A confirmar |
