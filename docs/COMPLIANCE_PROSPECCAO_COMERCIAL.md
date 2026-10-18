# Compliance em Prospeccao Comercial

## Regras Obrigatorias

### 1. Nao fazer scraping proibido
- Nunca automatizar login em sites de terceiros
- Nunca burlar termos de uso (ToS) de plataformas
- Nunca usar bots para extrair dados de redes sociais
- Respeitar robots.txt de sites publicos

### 2. Nao automatizar redes sociais
- LinkedIn: scraping automatizado viola os termos de uso
- Instagram: scraping automatizado viola os termos
- Facebook: scraping automatizado viola os termos
- Use APENAS APIs oficiais com autorizacao

### 3. Origem dos dados
- Toda prospeccao deve ter origem identificavel
- Nunca criar lead sem saber de onde veio
- Leads sem origem devem ser descartados ou marcados como baixa confianca
- Nunca usar IA para "inventar" empresas como se fossem reais

### 4. Dados sensiveis
- Nao salvar dados pessoais sem consentimento
- Nao expor chaves de API no frontend
- Secrets devem ficar no backend (Supabase Secrets)
- Respeitar a LGPD

### 5. Providers que respeitam as regras

| Provider | Como respeita |
|----------|--------------|
| Manual | Dados inseridos explicitamente pelo usuario |
| Mock | Claramente marcado como simulado |
| WebSearch | Usa API oficial (SerpAPI/Google CSE) |
| GoogleMaps | Usa Google Places API oficial |
| Catalogos | So sugere fontes — usuario consulta manualmente |
| Social | So sugere buscas — usuario faz manualmente |

## Anti-Invencao

Regra implementada no codigo:

```
Se provider_origem vazio → NAO criar lead
Se fonte_nome ausente → NAO criar lead
Se confianca = simulada → NAO criar lead
Se confianca = baixa && sem fonte_url → NAO criar lead
```

Toda tentativa de criar lead sem origem e logada como alerta.
