# Testes Pós-Deploy — Vercel + Cloudflare

## 1. Teste de Build

```bash
npm run typecheck
npm run build
```

**Esperado:** 0 erros de typecheck, build concluído em ~30s.

## 2. Teste de Rota SPA (refresh)

Navegar diretamente para cada URL no browser:

| Rota | Tipo | Esperado |
|------|:----:|----------|
| `https://tms.conexaoexpress.com.br/login` | Pública | Página de login |
| `https://tms.conexaoexpress.com.br/rastrear/ABC123` | Pública | Tracking público |
| `https://tms.conexaoexpress.com.br/portal-cliente` | Pública | Portal cliente |
| `https://tms.conexaoexpress.com.br/dashboard` | Protegida | Redireciona para /login → após login, dashboard |
| `https://tms.conexaoexpress.com.br/torre-controle` | Protegida | Carrega após login |
| `https://tms.conexaoexpress.com.br/cadastros/prestadores` | Protegida | Carrega após login |
| `https://tms.conexaoexpress.com.br/central-ia` | Protegida | Carrega após login |
| `https://tms.conexaoexpress.com.br/inexistente` | Qualquer | Página 404 |

## 3. Teste de Login

- [ ] Login com credenciais reais (não demo)
- [ ] Token JWT armazenado
- [ ] Refresh preserva sessão
- [ ] Logout funcional

## 4. Teste de IA (proxy-ia)

No browser (F12 → Console):
```js
fetch('https://uwrvzsjtpgaifkktpepn.supabase.co/functions/v1/proxy-ia', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <anon_key>' },
  body: JSON.stringify({ provider: 'groq', model: 'llama-3.1-8b-instant', prompt: 'Ping', max_tokens: 10 })
}).then(r => r.json()).then(console.log)
```

**Esperado:** `{ sucesso: true, resposta: "Ping" }` (ou similar)

## 5. Teste de DNS + Cloudflare

```bash
# DNS propagation
nslookup tms.conexaoexpress.com.br

# SSL
curl -vI https://tms.conexaoexpress.com.br 2>&1 | grep -i "SSL"

# Cloudflare headers
curl -sI https://tms.conexaoexpress.com.br | grep -i "cf-"

# Proxy check
curl -sI https://tms.conexaoexpress.com.br | grep -i "server: cloudflare"
```

## 6. Teste de Performance

- [ ] Lighthouse desktop ≥ 80
- [ ] Primeira carga < 3s (3G simulado)
- [ ] Navegação entre páginas < 1s
- [ ] Bundle JS gzipado < 500KB (excluindo mapbox-gl)

## 7. Teste de Segurança

- [ ] Console sem erros de CORS
- [ ] Nenhum `VITE_*_API_KEY` visível no bundle (Sources → search)
- [ ] Headers de segurança presentes (X-Frame-Options, X-Content-Type-Options)

## Checklist Final

- [ ] Typecheck: 0 erros
- [ ] Build: sucesso
- [ ] Rota pública /login carrega
- [ ] Refresh em rota aninhada (/cadastros/prestadores) funcional
- [ ] Login real funcional
- [ ] Proxy-ia responde
- [ ] DNS aponta para Cloudflare
- [ ] SSL ativo (Full strict)
- [ ] Cloudflare proxy laranja ativo
- [ ] Console sem erros
