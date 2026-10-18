# Teste Real do Supervisor IA — Missão 33

## Pré-requisitos

- Chaves de API configuradas no Supabase Secrets:
  ```bash
  supabase secrets set GROQ_API_KEY=sua_chave
  supabase secrets set GEMINI_API_KEY=sua_chave
  supabase secrets set OPENROUTER_API_KEY=sua_chave
  ```
- Edge Function `proxy-ia` publicada:
  ```bash
  npx supabase functions deploy proxy-ia
  ```
- Tabela `ia_custos_ia` criada no banco:
  ```bash
  npx supabase db query --linked --file supabase/migrations/20260801_m31_custos_ia.sql
  ```
- `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## Teste Automatizado

```bash
npx tsx scripts/f33_missao33_teste_real_supervisor_ia.ts
```

Testa:
1. proxy-ia Edge Function (autenticação, resposta, segurança)
2. Groq (resumo, atendimento, classificação)
3. Gemini (análise, resposta comercial, triagem, documento)
4. OpenRouter (tarefa complexa)
5. Supervisor (econômico, balanceado, premium, cache, fallback)
6. Custos (registro em ia_custos_ia)
7. Segurança (VITE_*_API_KEY no frontend)

## Passo a Passo Manual

### Testar Groq

```bash
npx tsx scripts/debug_groq_models.ts
```

Modelos funcionais: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`

Exemplo de chamada direta:
```javascript
const res = await fetch(`${SUPABASE_URL}/functions/v1/proxy-ia`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    provider: "groq",
    model: "llama-3.1-8b-instant",
    prompt: "Resuma em uma frase: A logística reversa é essencial.",
  }),
});
const data = await res.json();
console.log(data.resposta);
```

### Testar Gemini

```bash
npx tsx scripts/debug_gemini_v2.ts
```

Modelo funcional: `gemini-2.0-flash` (pode retornar 429 se quota excedida)

> **Nota:** Se receber HTTP 429 (quota exceeded), é necessário configurar billing no Google Cloud para a chave usada.

### Testar OpenRouter

```bash
npx tsx scripts/debug_openrouter_models.ts
```

Modelos funcionais: `openrouter/auto`, `openai/gpt-4o`, `openai/gpt-4o-mini`

### Verificar Logs

```sql
SELECT provedor, modelo, status, custo_estimado, tempo_resposta_ms, created_at
FROM ia_custos_ia
ORDER BY created_at DESC
LIMIT 20;
```

### Verificar Custos

```sql
SELECT 
  provedor, 
  modelo, 
  COUNT(*) as chamadas,
  SUM(custo_estimado) as custo_total,
  AVG(tempo_resposta_ms) as tempo_medio,
  SUM(tokens_entrada + tokens_saida) as tokens_total
FROM ia_custos_ia
GROUP BY provedor, modelo
ORDER BY custo_total DESC;
```

### Identificar Fallback

Quando um provedor falha, o Supervisor tenta o próximo na fila. Para identificar:

```sql
SELECT provedor, modelo, status, erro_resumido, created_at
FROM ia_custos_ia
WHERE status IN ('falha', 'fallback')
ORDER BY created_at DESC
LIMIT 10;
```

No código, o fallback aparece nos logs:
```
[aiSupervisor] groq/llama-3.1-8b-instant falhou: ... Tentando próximo...
```

## Arquitetura

```
Frontend → proxyIaClient.ts → proxy-ia (Edge Function) → API do provedor (Groq/Gemini/OpenRouter)
                                    ↓
                             aiSupervisor.ts → aiProviderManager.ts → proxyIaClient.ts
                                    ↓
                             ia_custos_ia (tabela de custos)
```

## Modelos Atualizados (2026)

### Groq
| Obsoleto | Substituído por |
|----------|----------------|
| `llama3-8b-8192` | `llama-3.1-8b-instant` |
| `llama3-70b-8192` | `llama-3.3-70b-versatile` |
| `mixtral-8x7b-32768` | `llama-3.1-8b-instant` |

### Gemini
| Obsoleto | Substituído por |
|----------|----------------|
| `gemini-1.5-flash` | `gemini-2.0-flash` |
| `gemini-1.5-pro` | `gemini-2.0-flash` |

### OpenRouter
| Obsoleto | Correto |
|----------|---------|
| `openrouter/gpt-4o` | `openai/gpt-4o` |
| `openrouter/gpt-4o-mini` | `openai/gpt-4o-mini` |
| `openrouter/claude-sonnet` | `openrouter/auto` (rota automática) |

## Modos do Supervisor

| Modo | Complexidade | Provider Principal | Custo Estimado |
|------|-------------|-------------------|----------------|
| Econômico | 1_economico | Groq (llama-3.1-8b-instant) | ~$0.000002/k |
| Balanceado | 2_intermediario | Gemini 2.0 Flash → Groq | ~$0.0001/k |
| Premium | 3_complexo | OpenRouter (GPT-4o) | ~$0.003/k |

## Cache

- TTL: 5 minutos
- Máximo: 500 entradas
- Tipos SENSÍVEIS que NÃO são cacheados: auditoria, decisao_critica, diagnostico_operacional, analise_financeira, analise_documentos
- Cache é verificado antes de qualquer chamada externa

## Segurança

- Chaves de API nunca saem do backend (Supabase Secrets)
- proxy-ia Edge Function exige `Authorization: Bearer <anon_key>` (ou JWT de usuário)
- Nenhum prompt completo é logado (truncado em 2000 chars)
- Nenhuma chave de API é exposta nas respostas
- `VITE_*_API_KEY` não existem em `src/`

## Problemas Conhecidos

1. **Gemini quota (429)**: Chave configurada mas sem billing. Modelos 2.0 existem e funcionam, mas a cota gratuita foi excedida.
2. **OpenRouter lento**: Tarefas complexas no modo `openrouter/auto` podem levar até 18s. Considere usar `openai/gpt-4o-mini` para tarefas mais rápidas.
3. **Custos**: Tabela `ia_custos_ia` foi criada manualmente (via `db query`). A migration completa requer `current_tenant_id_safe()` que não existe no banco atual.

## Resultado da Missão 33

```
✅ proxy-ia Edge Function: Publicada e funcional com auth via anon key
✅ Groq: Funcional (llama-3.1-8b-instant, llama-3.3-70b-versatile)
⚠️ Gemini: Modelo reconhecido mas quota excedida (429) - configurar billing
✅ OpenRouter: Funcional (openrouter/auto, openai/gpt-4o)
✅ aiSupervisor: Econômico, Balanceado, Premium funcionando com fallback
✅ Cache: Funcional (hit em 0ms, tipos sensíveis respeitados)
✅ Fallback: Funcional (tenta próximo provedor automaticamente)
✅ Custos: Registro funcional (tabela ia_custos_ia)
✅ Segurança: Sem VITE_*_API_KEY no frontend, secrets não expostos
```
