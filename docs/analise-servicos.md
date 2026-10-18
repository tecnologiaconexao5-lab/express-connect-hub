# Análise de Serviços — Express Connect Hub / TMS

> Auditoria: 2026-06-26 | ~130 serviços | 34 serviços IA | 5 providers

---

## 1. God Objects (P0)

### 1.1 `centralIaService.ts` — 1685 linhas (P0)
**6+ domínios em um arquivo:**
- Tipos e interfaces (L1-200)
- CRUD de robôs
- CRUD de tarefas
- CRUD de aprovações
- Logs e auditoria
- Comunicação entre robôs
- Triggers e gatilhos
- Mensagens e templates

**Plano de split:**
```
src/services/ia/
├── roboService.ts          (~200 linhas)
├── tarefaService.ts        (~300 linhas)
├── aprovacaoService.ts     (~250 linhas)
├── logService.ts           (~200 linhas)
├── triggerService.ts       (~250 linhas)
├── comunicacaoService.ts   (~200 linhas)
└── centralIaService.ts     (~285 linhas — facade)
```

### 1.2 `ordemServicoService.ts` — 647 linhas (P0)
**5 responsabilidades misturadas:**
- Sincronização OS → Escala (`sincronizarComEscala`)
- Sincronização financeira OS (`sincronizarFinanceiroOS`)
- Sincronização financeira Alocação (`sincronizarFinanceiroOSAlocacao`)
- Finalização de OS (`finalizarOrdemServico` — código morto)
- Verificação de duplicidade (`verificarDuplicidadeFinanceira`)

---

## 2. Código Duplicado

### 2.1 Zoho Email Service — 3 cópias (P0)
| Arquivo | Linhas | Importado por |
|---------|--------|--------------|
| `services/zohoEmailService.ts` | 189 | CrmPipeline, ConversasHub |
| `services/email/zohoEmailService.ts` | 475 | emailAutomationService, ZohoEmailStatus |
| `services/integracoes/zohoEmailService.ts` | 34 | propostaService, followUpService |

### 2.2 Evolution API Service — 2 cópias (P1)
| Arquivo | Linhas | Status |
|---------|--------|--------|
| `services/evolutionApiService.ts` | 195 | **SEM importers — código morto** |
| `services/integracoes/evolutionApiService.ts` | 206 | Canônico |

### 2.3 Sincronização Financeira Duplicada (P1)
- `sincronizarFinanceiroOS()` — `ordemServicoService.ts:149` (~120 linhas)
- `sincronizarFinanceiroOSAlocacao()` — `ordemServicoService.ts:524` (~80 linhas)
- Lógica 90% idêntica (select → exists ? update : insert)

### 2.4 Cálculo de Margem — 5 locais (P1)
| Local | Usa custos reais? | Salva no banco? |
|-------|-------------------|-----------------|
| `composicaoFinanceiraService.ts:232` | NÃO | SIM |
| `calculoService.ts:12` | NÃO | NÃO |
| `engineFinanceira.ts:272` | SIM | NÃO |
| `calculateOperationFinances.ts:192` | NÃO | NÃO |
| `osTypes.ts:173` | NÃO | NÃO |

### 2.5 Validação de Mensagens — 2 locais (P2)
- `comunicacaoGatewayService.ts:149`
- `whatsappHomologService.ts:49`

### 2.6 `criarAlocacao` / `cancelarAlocacao` — 2 locais (P2)
- `escalaService.ts:262` (camada de serviço)
- `useEscala.ts:138` (hook — reimplementa com tipo diferente)

---

## 3. Código Morto

### 3.1 Funções sem callers (P0)
| Função/Arquivo | Linhas | Callers |
|----------------|--------|---------|
| `finalizarOrdemServico()` | `ordemServicoService.ts:386` (264 linhas) | **0** |
| `automacao.ts` | 255 linhas | **0** |
| `automacaoWhatsapp.ts` | 269 linhas | **0** |
| `evolutionApiService.ts` (raiz) | 195 linhas | **0** |

### 3.2 Arquivos 100% mock (P1)
| Arquivo | Linhas | Situação |
|---------|--------|----------|
| `externalIntegrationEngine.ts` | 337 | 100% `{status: "simulado"}` |
| `GoogleAdsProvider.ts` | 95 | `execute()` simulado |
| `SocialMediaProvider.ts` | 71 | `execute()` simulado |
| `VagasProvider.ts` | 82 | `execute()` simulado |

### 3.3 TODOs e Deprecated (P2)
- `src/services/automacao.ts:117` — modo simulation
- `src/services/ia/externalIntegrationEngine.ts:46` — "TODOS SIMULADOS"
- `src/services/ia/conectoresService.ts:101` — `SIMULAR_ACAO` hardcoded

---

## 4. Acoplamento Indevido

### 4.1 Serviços importando de componentes (P1)
| Serviço | Import de componente |
|---------|---------------------|
| `escalaFinanceiroAdapter.ts:1` | `@/components/operacao/escalaStatus` |
| `escalaMapper.ts:1` | `@/components/operacao/escalaStatus` |
| `orcamentoToOSService.ts:7` | `@/components/comercial/types` |
| `composicaoFinanceiraService.ts:2` | `@/components/operacao/osTypes` |

**Correção:** Mover tipos para `src/types/`.

### 4.2 Componentes bypassando serviço (P0)
**80 componentes** acessam `supabase.from()` diretamente:
- `OrdemServicoForm.tsx`, `OrdensServicoLista.tsx`, `EscalaLista.tsx`
- `ContasReceber.tsx`, `ContasPagar.tsx`, `FluxoCaixaEnterprise.tsx`
- `CteTab.tsx`, `NfseTab.tsx`, `MdfeTab.tsx`
- `CrmPipeline.tsx`, `LeadsLista.tsx`, `OrcamentosLista.tsx`

### 4.3 localStorage em serviços (P0)
7 serviços usam `localStorage`:
- `ai.ts`, `documentAnalysis.ts`, `recrutamentoIA.ts`, `comunicacaoLote.ts`, `iaService.ts`, `configuracoesService.ts`, `automacaoWhatsapp.ts`
- Múltiplos leem `"anthropic_api_key"` — chave de API em localStorage

---

## 5. Configurações Hardcoded

### 5.1 URLs hardcoded (P2)
47 ocorrências de URLs em serviços:
- APIs de IA: `api.groq.com`, `api.anthropic.com`, `api.openai.com`, `openrouter.ai`
- APIs externas: `api.efrete.com.br`, `api.sefaz.gov.br`, `viacep.com.br`
- Infra: `api.mapbox.com`, `accounts.zoho.com`

### 5.2 Constantes que deveriam ser configuráveis (P1)
- `TABELA_TESTE_VEICULOS_SP` em `calculoService.ts:53`
- `STATUS_OS_PARA_ESCALA` em `ordemServicoService.ts:5`
- `MAPA_ESCALA_PARA_OS` em `ordemServicoService.ts:653`
- `STATUS_INADIMPLENTES` em `inadimplenciaService.ts:11`

---

## 6. Ausência de Camadas de Abstração

| Camada ausente | Impacto |
|----------------|---------|
| API Client | 80 componentes + 70 serviços chamam `supabase.from()` direto |
| AI Provider | 8+ arquivos com `fetch` raw para providers diferentes |
| Env Config | `localStorage.getItem("anthropic_api_key")` em 7 serviços |
| Validação | `validar*` funções espalhadas em 10+ arquivos |
| Mapper tipado | `snake_case ↔ camelCase` feito inline em cada serviço |

---

## 7. Plano de Refatoração (Top 5 Ações)

| # | Ação | Impacto | Esforço |
|---|------|---------|---------|
| 1 | Split `centralIaService.ts` em 6 serviços | P0 | 4h |
| 2 | Consolidar 3 Zoho Email Services em 1 | P0 | 3h |
| 3 | Remover código morto (4 arquivos, ~1100 linhas) | P0 | 1h |
| 4 | Mover tipos de componentes para `src/types/` | P1 | 2h |
| 5 | Extrair `sincronizarFinanceiro()` unificado | P1 | 2h |

---

## 8. Classificação

| Categoria | P0 | P1 | P2 |
|-----------|----|----|-----|
| God objects (>1000 linhas) | 2 | 0 | 0 |
| Código duplicado | 1 | 3 | 2 |
| Código morto | 4 | 4 | 3 |
| Acoplamento serviço↔componente | 0 | 4 | 0 |
| Bypass da camada de serviço | 1 | 0 | 0 |
| localStorage em serviços | 4 | 0 | 0 |
| Configurações hardcoded | 0 | 4 | 2 |
| Camadas de abstração ausentes | 0 | 5 | 0 |
| **Total** | **12** | **20** | **7** |

---

*Documento gerado por auditoria de serviços automatizada — OpenCode Go Pro*
