# Auditoria de Segredos IA — Missão 31

## Variáveis Sensíveis Encontradas

### ❌ NÃO PODE FICAR NO FRONTEND — Remover do bundle

| Variável | Provider | Risco | Onde é usada |
|----------|----------|-------|-------------|
| `VITE_GROQ_API_KEY` | Groq | Alto | `aiProviderManager.ts`, `iaService.ts`, `automacao.ts`, `recrutamentoWhatsappIAService.ts` |
| `VITE_GEMINI_API_KEY` | Gemini | Alto | `aiProviderManager.ts`, `iaService.ts`, `MensagensWhatsApp.tsx`, `CentralIntegracoes.tsx` |
| `VITE_OPENAI_API_KEY` | OpenAI | Alto | `aiProviderManager.ts`, `recrutamentoWhatsappIAService.ts` |
| `VITE_OPENROUTER_API_KEY` | OpenRouter | Alto | `aiProviderManager.ts` |
| `VITE_ANTHROPIC_API_KEY` | Anthropic/Claude | Alto | `ai.ts`, `comunicacaoLote.ts`, `recrutamentoIA.ts`, `documentAnalysis.ts`, `iaService.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **Crítico** | `supabase.ts` (createServiceClient) |
| `VITE_EVOLUTION_API_KEY` | Evolution | Alto | `WhatsAppProvider.ts`, `ConectoresTab.tsx` |
| `VITE_EVOLUTION_API_URL` | Evolution | Médio | `WhatsAppProvider.ts` |
| `VITE_ZOHO_CLIENT_ID` | Zoho | Alto | `ZohoMailProvider.ts` |
| `VITE_ZOHO_CLIENT_SECRET` | Zoho | **Crítico** | `ZohoMailProvider.ts` |
| `VITE_ZOHO_REFRESH_TOKEN` | Zoho | **Crítico** | `ZohoMailProvider.ts` |

### ✅ PODE FICAR NO FRONTEND

| Variável | Motivo |
|----------|--------|
| `VITE_SUPABASE_URL` | URL pública do projeto |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (RLS protege) |
| `VITE_MAPBOX_ACCESS_TOKEN` | Token público (domain-restricted) |
| `VITE_MAPBOX_TOKEN` | Token público |
| `VITE_APP_URL` | URL pública |
| `VITE_AUTH_DEMO_MODE` | Flag booleana |
| `VITE_WHATSAPP_MODE` | Flag de modo |
| `VITE_ZOHO_MODE` | Flag de modo |
| `VITE_AI_PROVIDER` | Nome do provider |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto |

## Arquivos com Chamadas Diretas a APIs IA

### Frontend (19 arquivos — TODOS com chaves no bundle)

| Arquivo | Providers | Endpoint |
|---------|-----------|----------|
| `src/services/ia/aiProviderManager.ts` | Groq, Gemini, OpenRouter, OpenAI | `api.groq.com`, `generativelanguage.googleapis.com`, `openrouter.ai`, `api.openai.com` |
| `src/services/ia/iaService.ts` | Groq, Gemini, Anthropic | `api.groq.com`, `generativelanguage.googleapis.com`, `api.anthropic.com` |
| `src/services/ai.ts` | Anthropic/Claude | `api.anthropic.com` |
| `src/services/comunicacaoLote.ts` | Anthropic/Claude | `api.anthropic.com` |
| `src/services/recrutamentoIA.ts` | Anthropic/Claude | `api.anthropic.com` |
| `src/services/documentAnalysis.ts` | Anthropic/Claude | `api.anthropic.com` |
| `src/services/automacao.ts` | Groq | `api.groq.com` |
| `src/services/integracoes/recrutamentoWhatsappIAService.ts` | Groq, OpenAI | `api.groq.com`, `api.openai.com` |
| `src/pages/MensagensWhatsApp.tsx` | Groq, Gemini | + `localStorage` (risco adicional) |
| `src/components/configuracoes/CentralIntegracoes.tsx` | Groq, Gemini | Teste de conexão |

### Edge Functions (backend seguro — ✅ correto)

| Arquivo | Provider | Endpoint |
|---------|----------|----------|
| `supabase/functions/whatsapp-recrutamento-webhook/index.ts` | Groq | `api.groq.com` |

## Riscos Identificados

1. **Chaves IA no bundle Vite**: Todas as `VITE_*_API_KEY` são embutidas no JS do frontend. Qualquer usuário pode inspecionar o bundle e extrair as chaves.

2. **localStorage**: `MensagensWhatsApp.tsx` lê `groq_api_key` e `gemini_api_key` do localStorage (documentado em auditorias anteriores como risco).

3. **Service Role Key**: `SUPABASE_SERVICE_ROLE_KEY` está no `.env.example` e referenciada em `src/lib/supabase.ts` — mas não tem prefixo VITE_*, então não entra no bundle. Porém o script `scripts/seed-usuarios-cliente.ts` usa `VITE_SUPABASE_SERVICE_ROLE_KEY` (com VITE_ prefix) — risco crítico.

4. **Múltiplos paths de chamada IA**: 5 arquivos (ai.ts, comunicacaoLote.ts, recrutamentoIA.ts, documentAnalysis.ts, iaService.ts) chamam Anthropic/Claude DIRETAMENTE sem passar pelo aiProviderManager — bypassando fallback, logs e custos.

## Ações Tomadas

1. **Criado `aiSupervisor.ts`** — Serviço central de roteamento que gerencia custo/qualidade/velocidade/segurança
2. **Criado `cacheIAService.ts`** — Cache inteligente para respostas simples
3. **Criado migration `20260801_m31_custos_ia.sql`** — Tabela `ia_custos_ia` para custos por tenant/provedor
4. **Criado Edge Function `proxy-ia`** — Proxy seguro para chamadas IA (backend mantém chaves)
5. **Criado `docs/SEGURANCA_CHAVES_IA.md`** — Documentação de segurança
6. **Modificado `cognitivoPlannerService.ts`** — Routing through Supervisor
7. **Modificado `MensagensWhatsApp.tsx`** — Removido localStorage API keys

## Pendências Pós-Missão 31

1. **Migrar todas as `VITE_*_API_KEY` para Edge Functions** completo (substituir chamadas diretas)
2. **Remover `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY`, etc. do .env.production** (manter apenas no backend)
3. **Consolidar services legados** (ai.ts, comunicacaoLote.ts, recrutamentoIA.ts, documentAnalysis.ts) para usarem aiSupervisor
4. **Remover `VITE_SUPABASE_SERVICE_ROLE_KEY`** do script de seed
