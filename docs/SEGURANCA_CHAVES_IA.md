# Segurança — Chaves de IA

## Princípio Fundamental

> **Nenhuma chave de IA, OpenRouter, Gemini, Groq, DeepSeek, Zoho, Evolution ou Supabase service_role pode ficar no frontend.**

Toda chave sensível deve ficar em backend seguro:
- Supabase Edge Function (`supabase/functions/`)
- Oracle/n8n (serviços internos)
- Variável privada de servidor (.env sem prefixo VITE_)

## O que foi feito na Missão 31

### 1. Auditoria Completa
Arquivo: `docs/AUDITORIA_SEGREDOS_IA.md`

- 19 arquivos de frontend com chamadas diretas a APIs IA
- 5 provedores de IA identificados (Groq, Gemini, OpenRouter, OpenAI, Anthropic)
- 11 variáveis `VITE_*_API_KEY` sensíveis classificadas como **não podem ficar no frontend**
- Service Role Key classificada como **crítica**

### 2. Supervisor Central de IA
Arquivo: `src/services/ia/aiSupervisor.ts`

Serviço central que gerencia:
- Classificação de complexidade (Nível 1/2/3)
- Roteamento por modo do tenant (econômico/balanceado/premium)
- Fallback automático entre provedores
- Registro de custos por tenant/provedor
- Cache inteligente de respostas

### 3. Proxy Seguro (Edge Function)
Arquivo: `supabase/functions/proxy-ia/index.ts`

Edge Function que mantém as chaves de IA no backend:
- Frontend envia requisição para `/functions/v1/proxy-ia`
- Edge Function adiciona a chave e faz a chamada real à API
- Resposta é retornada ao frontend (sem expor a chave)
- Suporta: Groq, Gemini, OpenRouter, OpenAI, Anthropic/Claude

### 4. Cache Inteligente
Arquivo: `src/services/ia/cacheIAService.ts`

- Cache em memória com TTL de 5 minutos
- Chave composta por: hash(prompt + contexto + tenant_id + tipo_tarefa)
- Máximo de 500 entradas
- **NÃO cacheia** tarefas sensíveis (auditoria, decisão crítica, análise financeira)

### 5. Tabela de Custos
Migration: `supabase/migrations/20260801_m31_custos_ia.sql`

Tabela `ia_custos_ia` registra por chamada:
- tenant_id, usuario_id
- provedor, modelo
- tipo_tarefa, complexidade
- tokens entrada/saída, custo estimado
- tempo de resposta
- status (sucesso/falha/fallback/cache)

## Arquitetura Final

```
FRONTEND (SPA)                     BACKEND (Supabase/Oracle)
┌─────────────────┐              ┌──────────────────────────┐
│ aiSupervisor.ts  │ ── POST ──→ │ proxy-ia (Edge Function) │
│ cacheIAService   │              │   ├─ Groq API Key       │
│ ia_custos        │              │   ├─ Gemini API Key     │
└─────────────────┘              │   ├─ OpenRouter Key     │
                                  │   ├─ OpenAI Key         │
                                  │   └─ Anthropic Key      │
                                  └──────────────────────────┘
                                        │
                                  ┌─────┴─────┐
                                  │  API IA    │
                                  │ (externa)  │
                                  └───────────┘
```

## Classificação de Segurança

| Categoria | Exemplos | Localização | Pode ir no frontend? |
|-----------|----------|-------------|---------------------|
| **Público** | `VITE_SUPABASE_URL`, `VITE_MAPBOX_TOKEN` | .env, Vercel env | ✅ Sim |
| **Anônimo** | `VITE_SUPABASE_ANON_KEY` | .env, Vercel env | ✅ Sim (RLS protege) |
| **Config** | `VITE_WHATSAPP_MODE`, `VITE_AI_PROVIDER` | .env, Vercel env | ✅ Sim (flags) |
| **API Key** | `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY` | Edge Function only | ❌ **NÃO** |
| **Crítico** | `SUPABASE_SERVICE_ROLE_KEY` | Backend only | ❌ **NUNCA** |
| **OAuth** | `VITE_ZOHO_CLIENT_SECRET` | Backend only | ❌ **NUNCA** |

## Recomendações

### Imediatas (Missão 31)
- ✅ Supervisor central criado (`aiSupervisor.ts`)
- ✅ Cache inteligente criado (`cacheIAService.ts`)
- ✅ Proxy IA criado (`proxy-ia/index.ts`)
- ✅ Tabela de custos criada (`ia_custos_ia`)
- ✅ Auditoria de segredos documentada
- ✅ `cognitivoPlannerService.ts` já passa pelo aiProviderManager (que será roteado pelo supervisor)

### Curto Prazo (próxima missão)
1. Migrar `VITE_GROQ_API_KEY` do frontend para Edge Function (já há proxy criado)
2. Migrar `VITE_GEMINI_API_KEY` do frontend para Edge Function
3. Migrar `VITE_OPENAI_API_KEY` do frontend para Edge Function
4. Migrar `VITE_OPENROUTER_API_KEY` do frontend para Edge Function
5. Migrar `VITE_ANTHROPIC_API_KEY` do frontend para Edge Function
6. Remover leitura de localStorage de API keys em `MensagensWhatsApp.tsx`

### Médio Prazo
1. Consolidar `ai.ts`, `comunicacaoLote.ts`, `recrutamentoIA.ts`, `documentAnalysis.ts` para usarem `aiSupervisor`
2. Substituir `iaService.ts` (legacy) pelo supervisor
3. Implementar dashboard de custos IA na Central IA
4. Configurar limite de custo diário por tenant

### Longo Prazo
1. Migrar Evolution API Key para Edge Function
2. Migrar Zoho OAuth tokens para backend
3. Implementar provedor DeepSeek no supervisor
