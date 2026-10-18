# Variáveis de Ambiente — Vercel (Go Live)

## Arquitetura de Segredos (pós-Missão 32)

Chaves de IA **NUNCA** devem ser configuradas como `VITE_*` no Vercel. Elas ficam apenas no Supabase Secrets, acessadas via Edge Function `proxy-ia`. O frontend chama o proxy-ia com a anon key, que o backend usa para rotear para os providers.

### Fluxo
```
Frontend → proxyIaClient.fetch(PROXY_IA_URL) → Supabase API Gateway → Edge Function proxy-ia → Provider IA
               │                                       │
           anon key (JWT)                         chaves reais (Supabase Secrets)
```

---

## Grupo A — Obrigatórias (Públicas — seguras no bundle)

| Variável | Valor | Obrigatória? | Notas |
|----------|-------|:---:|-------|
| `VITE_SUPABASE_URL` | `https://uwrvzsjtpgaifkktpepn.supabase.co` | ✅ | ID do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon key do projeto | ✅ | Pública por design — RLS protege os dados |
| `VITE_MAPBOX_ACCESS_TOKEN` | token público Mapbox | ✅ | Restrito por URL no dashboard Mapbox |
| `VITE_MAPBOX_TOKEN` | mesmo valor do ACCESS_TOKEN | ✅ | Duplicado por compatibilidade |
| `VITE_APP_URL` | `https://tms.conexaoexpress.com.br` | ✅ | URL de produção |
| `VITE_AUTH_DEMO_MODE` | `false` | ✅ | Desabilita modo demo |
| `VITE_AI_PROVIDER` | `groq` | ✅ | Provider IA padrão (fallback via proxy-ia) |
| `VITE_ZOHO_MODE` | `assistido` | ⚠️ | Modo Zoho Mail |
| `VITE_WHATSAPP_MODE` | `assistido` | ⚠️ | Modo WhatsApp |

## Grupo B — Sensíveis no Bundle (NÃO colocar — exceto se estritamente necessário)

**NÃO configurar no Vercel.** As chaves de IA foram migradas para Supabase Secrets (Missão 32).
Variáveis como `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_OPENROUTER_API_KEY` devem ficar vazias ou ausentes.

Se o `.env.production` contiver `VITE_GROQ_API_KEY=`, o Vite compila com string vazia — não quebra, mas o proxy-ia precisa das chaves reais no backend.

## Grupo C — Privadas (NUNCA no Vercel)

| Variável | Onde usar | Risco |
|----------|-----------|:-----:|
| `SUPABASE_SERVICE_ROLE_KEY` | Apenas em scripts backend / Edge Functions | **Crítico** — acesso total ao banco |
| `TMS_EDGE_INTERNAL_TOKEN` | Edge Functions internas | Alto |
| `FOCUS_API_KEY` | Edge Functions (Focus NFe) | Crítico |

Essas variáveis nunca entram no bundle do Vite (não têm prefixo `VITE_`). Não adicionar ao Vercel.

---

## Configuração no Dashboard Vercel

1. Acessar: Vercel Dashboard → Project → Settings → Environment Variables
2. Adicionar **todas** as variáveis do Grupo A
3. Para cada variável sensível do Grupo B, marcar `Encrypt` (embora sejam vazias)
4. **NÃO** adicionar `SUPABASE_SERVICE_ROLE_KEY` ou qualquer variável sem prefixo `VITE_`
5. Após configurar, fazer novo deploy para aplicar: `git push origin main`
