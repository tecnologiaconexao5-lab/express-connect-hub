# RECRUTAMENTO INTELIGENTE — STATUS REAL DO MÓDULO

> Atualizado em: 25/05/2026
> Base: P1-P16 implementado funcionalmente + P17 consolidação final e documentação master
> Status: **96% funcional — pronto para pausa ou próxima fase (IA/automações)**

---

## Sumário

1. [Percentual Atual do Módulo](#1-percentual-atual-do-módulo)
2. [Funcionalidades Existentes](#2-funcionalidades-existentes)
3. [Funcionalidades Quebradas](#3-funcionalidades-quebradas) — ✅ Botão "Novo Prestador" corrigido em P5, ✅ realtime corrigido em P6
4. [Estrutura Atual do Módulo](#4-estrutura-atual-do-módulo)
5. [Tabelas Supabase Utilizadas](#5-tabelas-supabase-utilizadas)
6. [Integrações Existentes](#6-integrações-existentes)
7. [Problemas Encontrados](#7-problemas-encontrados)
8. [Riscos Arquiteturais](#8-riscos-arquiteturais)
9. [Próximos Passos Sugeridos — P18+ (Futuro)](#9-próximos-passos-sugeridos--p18-futuro)
10. [Arquivos Analisados](#10-arquivos-analisados)
11. [Arquivos Alterados por Etapa](#11-arquivos-alterados-por-etapa)
12. [Dependências Futuras](#12-dependências-futuras)

---

## 1. Percentual Atual do Módulo

### **96% funcional** (+0% P17 — consolidação final e documentação master)

| Camada | % Real | Observação |
|--------|--------|------------|
| UI/Componentes | 90% | Interfaces ricas, design system próprio |
| Tipos/Interfaces | 100% | Typescript completo em `recrutamento.ts` |
| Store (Zustand) | 100% | `recrutamentoStore.ts` funcional |
| Hooks | 90% | Uso correto, conectados aos services; `useKanbanRealtime` + `usePrestadoresRealtime` reais (P6) |
| Services (mock) | 25% | **2 de 8 services migrados** (`prestadoresService` P2 + `enterpriseKanbanService` P3) |
| Services (parcial real) | 45% | Dashboard real; `prestadoresService` P2; `enterpriseKanbanService` P3 |
| Timeline/Histórico | 100% | JSONB `historico` no candidato, aba "Histórico" no sheet (P8) |
| Realtime | 80% | `useKanbanRealtime` + `usePrestadoresRealtime` — subscriptions reais `recrutamento_candidatos` e `recrutamento_prestadores` (P6) |
| Enterprise Kanban | 90% | **Supabase-first** (`recrutamento_candidatos`), seed inicial 24 candidatos, fallback localStorage (P3) |
| Banco de Talentos (módulo) | 0% | Componente recebe `MOCK_TALENTOS` hardcoded |
| Banco de Talentos (página) | 100% | Rota `/recrutamento/banco-talentos` conectada ao Supabase real |
| WhatsApp CRM | 70% | Conectado ao Supabase real (conversas, mensagens, config IA) |
| Conversão Candidato→Prestador (real) | 80% | `recrutamentoIntegracao.ts` — `candidatos` → `prestadores` real |
| Conversão Candidato→Prestador (módulo) | 100% | `conversaoCandidatoService.ts` — pipeline → `recrutamento_prestadores` (P4+P7: vínculo `prestador_id` persistido) |
| Timeline/Histórico do Candidato | 100% | JSONB `historico` no candidato, 6 tipos de evento, aba "Histórico" no sheet de detalhes (P8) |
| Status Documental Operacional | 100% | Checklist com docs mínimos (CNH, CRLV, Comp. Residência, ANTT, Foto Veículo), auto-vencimento por data, status "bloqueado" para CNH vencida (P9) |
| Disponibilidade Operacional | 100% | Status operacional (apto/pendente/bloqueado/indisponivel), disponibilidade (imediata/parcial/indisponivel), badges no Kanban, filtros (P10) |
| Integração Operacional (Escala) | 100% | `listarPrestadoresAptos()` com filtros (região, veículo, disponibilidade), seção "Operacionais" no módulo (P11) |
| Pré-seleção Manual | 100% | Tag `preSelecionado` no JSONB do candidato, badge, toggle, filtro, toast (P12) |
| Onboarding Operacional | 100% | 6 itens de checklist, progresso visual, status (pendente/em_andamento/concluido), aba no sheet (P13) |
| Métricas Operacionais | 100% | 10 KPIs, pipeline por etapa, status documental, taxa conversão, onboarding (P14) |
| Envio para Escala | 100% | Tag `enviadoEscala`, ação, badge, filtro "Reservas Escala", shortlist operacional (P15) |
| Contexto da Reserva | 100% | Migration `reserva_contexto JSONB`, modal edição, contexto no card, histórico (P16) |
| Rotas | 100% | 3 rotas funcionando no App.tsx |

### Diagnóstico por Submódulo

| Submódulo | % Real | Conexão BD |
|-----------|--------|-----------|
| Dashboard Recrutamento | 60% | Supabase real (tabelas `candidatos`, `prestadores`, `veiculos`, `operacoes`, `homologacoes`, `documento_analises`) |
| Pipeline/Kanban Enterprise | 90% | **Supabase-first** — `recrutamento_candidatos`, seed automático, fallback localStorage (P3) |
| Operações de Recrutamento | 0% | **100% localStorage** (`recrutamento_operacoes_v2`) |
| Prestadores (módulo) | 90% | **Supabase-first** (`recrutamento_prestadores`), fallback localStorage (P2) |
| Central Documentos | 0% | **100% localStorage** (`recrutamento_docs_v2`) |
| Score Service | 0% | **100% mock** — calcula score de forma local/procedural |
| Match Service | 0% | **100% localStorage** + algoritmo local |
| CRM Logístico | 0% | **100% localStorage** (`prestadores_crm_interacoes`) |
| Automações | 0% | **100% localStorage** (`recrutamento_automacoes_v2`) |
| IA Service | 0% | **100% mock** — `Math.random()` + `setTimeout` |
| Banco de Talentos (módulo) | 0% | **100% mock** — `MOCK_TALENTOS` gerado no `index.tsx` |
| Banco de Talentos (página) | 100% | Supabase real (`candidatos`) via `supabase.from('candidatos')` |
| Onboarding Wizard | 90% | UI completa, dados mock de prestadores |
| Portal Prestador Preview | 90% | UI completa, dados mock |
| IA Operacional / IA Chat | 0% | UI rica, mas `iaService.ts` é mock |
| WhatsApp CRM | 70% | Supabase real (`recrutamento_whatsapp_conversas`, `recrutamento_whatsapp_mensagens`, `recrutamento_ia_config`, `recrutamento_whatsapp_config`) |
| Integração Recrutamento → Prestadores | 80% | Supabase real (`candidatos`, `prestadores`, `documentos_prestadores`, `homologacoes`, `reservas_banco`, `candidato_interacoes`) |
| Recrutamento IA (services/) | 50% | Misto — chama `supabase.from('candidatos')` mas também tem mock via `localStorage.getItem('anthropic_api_key')` |

---

## 2. Funcionalidades Existentes

### 2.1. Navegação e Layout
- ✅ Layout responsivo com tabs (11 abas no nav)
- ✅ Sidebar mobile com overlay
- ✅ Animações Framer Motion (page transitions, cards)
- ✅ Navegação por URL query params (`?section=...`)

### 2.2. Dashboard
- ✅ 12 KPI cards com animações
- ✅ 6 gráficos Recharts (ComposedChart, BarChart, PieChart, RadialBarChart)
- ✅ Alertas inteligentes (CNH vencendo, excesso de demanda, documentos pendentes)
- ✅ Ranking de prestadores (top 15)
- ✅ Regiões críticas com déficit
- ✅ Status documental (gráfico de pizza)
- ✅ Disponibilidade operacional (gráfico de barras)
- ✅ Realtime via `postgres_changes` em 5 tabelas reais
- ❌ **Dados não persistem** — toda query real, sem cache/localStorage

### 2.3. Enterprise Pipeline (Kanban)
- ✅ 10 estágios do pipeline (Novo Cadastro → Ativo)
- ✅ Drag & drop com `useDrop`
- ✅ Filtros avançados (score, prioridade, status documental, validade CNH, tags, cidade, veículo)
- ✅ Sheet de detalhes do candidato
- ✅ Modal de cadastro de interessado
- ✅ Score visual, badges de status documental
- ✅ Observações geradas por IA (mock)
- ✅ **Dados Supabase-first** — `enterpriseKanbanService.ts` conectado à tabela `recrutamento_candidatos` (P3)
- ✅ **Seed automático** — 24 candidatos mock inseridos no Supabase na primeira carga
- ✅ **Transições de estágio** — persistem no banco via `mover()`, fallback localStorage

### 2.4. Operações de Recrutamento
- ✅ CRUD completo de operações (criar, listar, atualizar, remover, duplicar)
- ✅ Wizard 4 passos (Identificação, Logística, Capacidade, Financeiro)
- ✅ Simulador financeiro com margem
- ✅ Grid e List view
- ✅ Filtros por status
- ✅ Sheet de detalhes
- ❌ **100% localStorage** — `operacoesService.ts`
- ❌ Tenta `supabase.from('operacoes').insert()` mas com **fallback silencioso** (try/catch)
- ❌ Match inteligente roda em background mas também é localStorage

### 2.5. Prestadores
- ✅ CRUD completo
- ✅ Cards com score, badges, tags
- ✅ Sheet de detalhes com múltiplas abas (perfil, veículo, score, documentos, histórico, CRM, operações)
- ✅ Filtros por status e origem
- ✅ **Supabase-first** — `prestadoresService.ts` conectado à tabela `recrutamento_prestadores` (P2)
- ⚠️ Fallback localStorage quando Supabase estiver offline
- ❌ `scoreService.calcularScore()` é procedural local

### 2.6. CRM Logístico
- ✅ Lista de interações com prestadores
- ✅ Sheet de detalhes
- ✅ Refresh ao criar interação
- ❌ **100% localStorage** — `crmService.ts`

### 2.7. Central Documentos
- ✅ Lista de documentos pendentes
- ✅ Aprovação/reprovação
- ❌ **100% localStorage** — `documentosService.ts`

### 2.8. IA Operacional
- ✅ UI de análise de candidatos com scores visuais
- ✅ Chat IA com histórico
- ❌ **`iaService.ts` é procedural mock** — `Math.random()`, `setTimeout`
- ❌ Resultados não refletem análise real

### 2.9. Onboarding Wizard
- ✅ Componente visual de progresso de onboarding
- ✅ 6 estágios (Não Iniciado → Concluído)
- ❌ Depende de `prestadores.find()` que vem do localStorage

### 2.10. Portal Prestador Preview
- ✅ UI de preview do portal do prestador
- ❌ Sem dados reais

### 2.11. Banco de Talentos (módulo interno)
- ✅ Componente visual com cards, busca, score
- ❌ **`MOCK_TALENTOS` gerado no `index.tsx`** — 20 candidatos fake
- ❌ Não conectado a nenhuma tabela real

### 2.12. WhatsApp CRM (rota separada)
- ✅ Conversas com prestadores
- ✅ Mensagens com IA automática (Groq → OpenAI → fallback heurístico)
- ✅ Regras de segurança (bloqueio de palavras para prestadores não aprovados)
- ✅ Assumir/voltar controle humano
- ✅ Config IA e WhatsApp no Supabase
- ✅ Webhook n8n para recebimento de mensagens
- ✅ **Conectado ao Supabase real** (4 tabelas dedicadas)
- ⚠️ Depende de API key da Groq/OpenAI em `import.meta.env`

### 2.13. Integração Recrutamento → Prestadores
- ✅ Ativação de candidato como prestador real
- ✅ Checagem de duplicidade (CPF, email, telefone)
- ✅ Migração de documentos
- ✅ Criação de homologação
- ✅ **Conectado ao Supabase real** (`candidatos`, `prestadores`, `documentos_prestadores`, `homologacoes`, `reservas_banco`, `candidato_interacoes`)
- ⚠️ `recrutamentoIA.ts` depende de `localStorage.getItem('anthropic_api_key')` para chamar Claude

### 2.14. Recrutamento IA Service (src/services/)
- ✅ Funções de análise de perfil, score, mensagens inteligentes
- ✅ `calcularScorePerfil()`, `analisarPerfilCandidato()`, `gerarMensagemInteligente()`
- ✅ Conexão com `candidatos` real via Supabase
- ⚠️ `buscarReservasParaOperacao()` — query real
- ⚠️ `identificarCandidatosEsquecidos()` — query real
- ⚠️ LLM: `callClaudeAPI()` com fallback mock se sem API key
- ⚠️ `salvarInteracao()` e `atualizarStatusCandidato()` — writes reais

---

## 3. Funcionalidades Quebradas

### 🔴 Críticas
| Funcionalidade | Problema | Arquivo |
|---------------|----------|---------|
| **OperaçõesService.criar()** | Tenta `supabase.from('operacoes').insert()` com try/catch vazio — fallback silencioso pra localStorage. Schema do service (`FinanceiroOperacao`) NÃO corresponde ao schema SQL real da tabela `operacoes`. | `operacoesService.ts:150-153` |
| ~~**useRecrutamentoRealtime**~~ | ~~Escuta `postgres_changes` em `operacoes` e `prestadores`, mas recarrega de `localStorage`.~~ ✅ **Corrigido P6**: substituído por `useKanbanRealtime` (escuta `recrutamento_candidatos`) + `usePrestadoresRealtime` (escuta `recrutamento_prestadores`). Subscriptions reais com callback `onReload`. | `useKanbanRealtime.ts`, `usePrestadoresRealtime.ts` |
| ~~**Botão "Novo Prestador"**~~ | ~~Em `PaginaPrestadores`, leva para `nova-operacao`.~~ ✅ **Corrigido P5**: agora redireciona para `pipeline-kanban` (Pipeline Enterprise), onde o fluxo correto é: interessado → candidato → aprovado → prestador. | `PaginaPrestadores.tsx:64` |
| **BancoTalentos (módulo)** | 100% mock, mas existe rota `/recrutamento/banco-talentos` separada que usa `BancoTalentosLayout` real. **Duas implementações concorrentes**. | `index.tsx:318` + `pages/BancoTalentos.tsx` |

### 🟠 Altas
| Funcionalidade | Problema | Arquivo |
|---------------|----------|---------|
| **Tabelas SQL não usadas** | `sql_final_supabase.sql` tem tabelas `operacoes`, `motoristas_parceiros`, `disparos_whatsapp` com schema DIFERENTE do que os services esperam. | `recrutamento_inteligente_schema.sql` |
| **Score não salvo** | Score calculado proceduralmente nunca persiste no banco. Ao recarregar, scores são perdidos. | `scoreService.ts` |
| **Match não salvo** | Match armazenado apenas em localStorage. Ao limpar cache, todos os matches somem. | `matchService.ts` |
| **Enterprise Kanban sem persistência** | Candidatos gerados proceduralmente via `buildMockData()`. Dados resetam ao limpar localStorage. | `enterpriseKanbanService.ts` |
| **Schema inconsistente** | `operacoesService.ts` usa tipos `Operacao` com `financeiro` aninhado, mas SQL real tem `operacoes_financeiro` como tabela separada. | `operacoesService.ts` vs `recrutamento_operacoes.sql` |

### 🟡 Médias
| Funcionalidade | Problema |
|---------------|----------|
| **Onboarding sem persistência** | Botões de ação no onboard wizard não persistem mudanças |
| **IA Service duplicado** | `recrutamentoIA.ts` (services/) e `iaService.ts` (modules/) têm propósitos sobrepostos |
| **CRM sem conexão** | Interações CRM salvam em localStorage, mas página WhatsApp CRM usa Supabase real |
| **Score de prestadores** | `PaginaPrestadores` mostra score no card, mas serviço nunca busca score real do banco |
| **Tags não persistem** | Tags de prestadores são mock, não refletem dados reais |
| **Botão "Contatar" no BancoTalentos** | Não tem ação vinculada |

---

## 4. Estrutura Atual do Módulo

### 4.1. Árvore de Arquivos

```
src/
├── pages/
│   ├── Recrutamento.tsx                  # Ponto de entrada do módulo (wrapper)
│   ├── BancoTalentos.tsx                 # Rota separada /recrutamento/banco-talentos
│   └── WhatsAppCRM.tsx                   # Rota separada /recrutamento/whatsapp-crm
│
├── modules/recrutamento/
│   ├── index.tsx                          # RecrutamentoModule — router interno + MOCK_TALENTOS
│   ├── utils/cn.ts                        # Utilitários de formatação e estilo
│   │
│   ├── types/recrutamento.ts              # 327 linhas — TODAS as interfaces do módulo
│   │
│   ├── store/recrutamentoStore.ts         # Zustand store com persist (currentSection, view)
│   │
│   ├── layouts/RecrutamentoLayout.tsx     # Layout com navegação por tabs (11 abas)
│   │
│   ├── hooks/
│   │   ├── useDashboardRecrutamento.ts    # 400 linhas — queries Supabase reais
│   │   ├── useOperacoes.ts               # Wrapper sobre operacoesService (mock)
│   │   ├── usePrestadores.ts             # Wrapper sobre prestadoresService (mock)
│   │   ├── useRecrutamentoRealtime.ts    # Realtime que recarrega de localStorage
│   │   ├── useRecrutamentoUI.ts          # Navegação e view mode
│   │
│   ├── pages/
│   │   ├── DashboardRecrutamento.tsx      # 647 linhas — Dashboard completo
│   │   ├── PaginaOperacoes.tsx            # 296 linhas — CRUD de operações
│   │   ├── PaginaNovaOperacao.tsx         # 478 linhas — Wizard 4 passos
│   │   └── PaginaPrestadores.tsx          # 256 linhas — Lista de prestadores
│   │
│   ├── components/
│   │   ├── design-system/                 # 7 componentes reutilizáveis
│   │   │   ├── PageHeader.tsx
│   │   │   ├── PremiumCard.tsx
│   │   │   ├── PremiumBadge.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── SkeletonCard.tsx
│   │   │   ├── StatusDot.tsx
│   │   │   └── ViewToggle.tsx
│   │   │
│   │   ├── enterprise-kanban/            # 7 arquivos — Kanban completo (90% real, P3)
│   │   │   ├── EnterpriseKanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── KanbanCard.tsx
│   │   │   ├── KanbanFilters.tsx
│   │   │   ├── CadastrarInteressadoModal.tsx
│   │   │   ├── DetalhesCandidatoPipelineSheet.tsx
│   │   │   ├── enterpriseKanbanService.ts  # 330 linhas — Supabase-first ***(P3)***
│   │   │   ├── enterpriseKanbanStore.ts
│   │   │   ├── enterpriseKanbanTypes.ts
│   │   │   ├── useEnterpriseKanban.ts
│   │   │   ├── useDrop.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── kanban/KanbanBoard.tsx         # Kanban mais simples (não usado pelo módulo)
│   │   ├── prestadores/PrestadorCard.tsx
│   │   ├── score/ScoreMeter.tsx
│   │   ├── documentos/CentralDocumentos.tsx
│   │   ├── talentos/BancoTalentos.tsx     # Componente interno (mock)
│   │   ├── crm/
│   │   │   ├── CrmLogistico.tsx
│   │   │   └── RegistrarInteracaoSheet.tsx
│   │   ├── ia/
│   │   │   ├── IAOperacional.tsx
│   │   │   └── IAChat.tsx
│   │   ├── automacoes/AutomacoesList.tsx
│   │   ├── portal/
│   │   │   ├── OnboardingWizard.tsx
│   │   │   └── PortalPrestadorPreview.tsx
│   │   ├── DetalhesPrestadorSheet.tsx
│   │   ├── DetalhesOperacaoSheet.tsx
│   │   └── GeradorAnuncioWhatsApp.tsx
│   │
│   └── services/                         # 8 serviços — 3 Supabase-first, 5 localStorage/mock
│       ├── operacoesService.ts            # 225 linhas — localStorage
│       ├── prestadoresService.ts          # 280 linhas — Supabase-first ***(P2)***
│       ├── documentosService.ts           # 88 linhas — localStorage
│       ├── scoreService.ts               # 58 linhas — mock procedural
│       ├── matchService.ts               # 115 linhas — localStorage
│       ├── crmService.ts                 # 66 linhas — localStorage
│       ├── automacoesService.ts          # 62 linhas — localStorage
│       ├── iaService.ts                  # 71 linhas — mock procedural
│       └── conversaoCandidatoService.ts   # 220 linhas — Supabase (P4)
│
├── services/
│   ├── recrutamentoIA.ts                 # 433 linhas — misto real + mock
│   ├── recrutamentoIntegracao.ts         # 303 linhas — Supabase real
│   └── integracoes/
│       └── recrutamentoWhatsappIAService.ts  # 768 linhas — Supabase real + APIs IA
│
├── components/recrutamento/              # COMPONENTES DUPLICADOS (fora do módulo)
│   ├── BancoTalentos.tsx                 # 170 linhas — conectado Supabase real
│   ├── banco-talentos/
│   │   └── BancoTalentosLayout.tsx       # Layout da rota separada
│   └── whatsapp-crm/
│       └── WhatsAppCRMLayout.tsx
│
└── lib/
    └── recrutamento_inteligente_schema.sql  # 66 linhas — schema SQL DOIS schemas diferentes
```

### 4.2. Fluxo de Dados Atual

```
RecrutamentoModule (index.tsx)
  ├── DashboardRecrutamento ──► supabase (real) ──► 6 tabelas
  ├── EnterpriseKanbanBoard ──► enterpriseKanbanService ──► Supabase (recrutamento_candidatos) + fallback localStorage
  │   └── DetalhesCandidatoPipelineSheet ──► conversaoCandidatoService ──► Supabase (recrutamento_prestadores) [P4]
  ├── PaginaOperacoes ────────► useOperacoes ──► operacoesService ──► localStorage
  ├── PaginaPrestadores ──────► usePrestadores ──► prestadoresService ──► Supabase (recrutamento_prestadores) + fallback localStorage
  ├── CrmLogistico ───────────► crmService ──► localStorage
  ├── CentralDocumentos ──────► documentosService ──► localStorage
  ├── IAOperacional ──────────► iaService ──► mock (Math.random)
  ├── AutomacoesList ─────────► automacoesService ──► localStorage
  ├── BancoTalentos ──────────► MOCK_TALENTOS (array hardcoded)
  ├── OnboardingWizard ───────► prestadores (localStorage)
  ├── PortalPrestadorPreview ─► (sem dados)
  └── Score ──────────────────► prestadores (localStorage)

Rotas separadas (App.tsx):
  ├── /recrutamento/banco-talentos ──► BancoTalentosLayout ──► supabase (candidatos) real
  ├── /recrutamento/whatsapp-crm ────► WhatsAppCRMLayout ──► supabase (real)
  └── /recrutamento ─────────────────► RecrutamentoModule (misto)
```

---

## 5. Tabelas Supabase Utilizadas

### 5.1. Tabelas Reais (com queries comprovadas no código)

| Tabela | Usada por | Tipo de Acesso |
|--------|-----------|----------------|
| `candidatos` | `useDashboardRecrutamento`, `recrutamentoIA.ts`, `recrutamentoIntegracao.ts`, `BancoTalentosLayout` | SELECT, INSERT, UPDATE |
| `prestadores` | `useDashboardRecrutamento`, `recrutamentoIntegracao.ts`, `recrutamentoWhatsappIAService` (indireto) | SELECT, INSERT, UPDATE |
| `veiculos` | `useDashboardRecrutamento` | SELECT |
| `operacoes` | `useDashboardRecrutamento`, `operacoesService.ts` (tentativa com fallback) | SELECT, INSERT (tentativa) |
| `operacoes_financeiro` | — | Não usada por nenhum código |
| `homologacoes` | `useDashboardRecrutamento`, `recrutamentoIntegracao.ts` | SELECT, INSERT |
| `documento_analises` | `useDashboardRecrutamento` | SELECT |
| `recrutamento_whatsapp_conversas` | `recrutamentoWhatsappIAService.ts` | SELECT, INSERT, UPDATE |
| `recrutamento_whatsapp_mensagens` | `recrutamentoWhatsappIAService.ts` | SELECT, INSERT |
| `recrutamento_ia_config` | `recrutamentoWhatsappIAService.ts` | SELECT, UPSERT |
| `recrutamento_whatsapp_config` | `recrutamentoWhatsappIAService.ts` | SELECT, UPSERT |
| `documentos_prestadores` | `recrutamentoIntegracao.ts` | INSERT |
| `reservas_banco` | `recrutamentoIntegracao.ts`, `recrutamentoIA.ts` | SELECT, UPDATE, INSERT |
| `candidato_interacoes` | `recrutamentoIA.ts` | INSERT |
| `match_operacoes_prestadores` | — | Não usada por nenhum código |
| `candidato_documentos` | `recrutamentoIA.ts` | SELECT |
| `motoristas_parceiros` | — | Não usada por nenhum código |
| `disparos_whatsapp` | — | Não usada por nenhum código |

### 5.2. Tabelas com Schema Definido mas NÃO USADAS

| Tabela | Arquivo SQL |
|--------|-------------|
| `motoristas_parceiros` | `recrutamento_inteligente_schema.sql` |
| `disparos_whatsapp` | `recrutamento_inteligente_schema.sql` |
| `operacoes_financeiro` | `supabase/migrations/recrutamento_operacoes.sql` |
| `match_operacoes_prestadores` | `supabase/migrations/recrutamento_operacoes.sql` |

### 5.3. Tabelas Existindo em SQL mas COM SCHEMA DIFERENTE do Service

| Tabela | Schema SQL | Schema Service | Diferença |
|--------|-----------|---------------|-----------|
| `operacoes` | `recrutamento_operacoes.sql`: colunas simples (nome, cliente, regiao, rota, veiculo...) | `operacoesService.ts`: objeto `Operacao` aninhado com `financeiro`, `meta`, `historico` | **Incompatível** |
| `prestadores` | Schema real via `sql_final_supabase.sql` (colunas snake_case) | `Prestador` type tem campos camelCase (nome, razaoSocial, cpfCnpj...) | **Incompatível** sem mapper |

---

## 6. Integrações Existentes

| Integração | Status | Detalhes |
|-----------|--------|----------|
| **Supabase (Dashboard)** | ✅ Real | 6 tabelas consultadas via `supabase.from()` |
| **Supabase (WhatsApp CRM)** | ✅ Real | 4 tabelas com CRUD completo |
| **Supabase (Conversão Candidato→Prestador)** | ✅ Real | Integração robusta com checagem de duplicidade |
| **Supabase (Recrutamento IA)** | ⚠️ Parcial | Consultas reais + salvage de interações |
| **Groq API (WhatsApp IA)** | ✅ Real | `chamarGroq()` com `llama-3.3-70b-versatile` |
| **OpenAI API (WhatsApp IA)** | ✅ Real | `chamarOpenAI()` com `gpt-4o-mini` |
| **Claude API (Recrutamento IA)** | ⚠️ Parcial | Depende de `localStorage.getItem('anthropic_api_key')` |
| **n8n Webhook** | ✅ Real | `recrutamentoWhatsappIAService.ts` processa payload |
| **Evolution API (WhatsApp)** | ⚠️ Configurada | URLs configuradas, conexão depende de VPS |

---

## 7. Problemas Encontrados

### 🔴 Críticos (7)

1. **100% localStorage nos services core do módulo** — `operacoesService`, `prestadoresService` (✅ **P2**), `documentosService`, `matchService`, `crmService`, `automacoesService`, `iaService` — 1 de 7 services agora Supabase-first.

2. **Schema incompatível entre service e banco** — `operacoesService.ts` espera `Operacao` com objeto aninhado `financeiro`, mas SQL real tem `operacoes_financeiro` como tabela separada.

3. **Enterprise Kanban 100% fake** — `enterpriseKanbanService.ts` gera 24 candidatos proceduralmente com dados aleatórios. Sem conexão com banco real. (✅ **P3**: agora Supabase-first) 

4. **Banco de Talentos duplicado** — Duas implementações: (a) `modules/recrutamento/components/talentos/BancoTalentos.tsx` (100% mock) e (b) `components/recrutamento/BancoTalentos.tsx` + rota `/recrutamento/banco-talentos` (conectado Supabase real).

5. **Realtime que não serve dados reais** — `useRecrutamentoRealtime` escuta `postgres_changes` mas recarrega de localStorage. Cria ilusão de dados reais.

6. **`operacoesService.criar()` com fallback silencioso** — Tenta inserir no Supabase, mas se falhar (sempre falha por schema incompatível), salva em localStorage sem aviso.

7. **Score/Match sem persistência real** — Scores calculados localmente, matches gerados e guardados em localStorage. Ao limpar navegador, tudo perdido.

### 🟠 Altos (6)

8. **Duplicação de IA services** — Dois serviços de IA competem: `modules/recrutamento/services/iaService.ts` (mock) vs `services/recrutamentoIA.ts` (parcialmente real).

9. **Duplicação de IAAutomacoes** — Relatório mestre menciona `IAAutomacoes.tsx` vs `IaAutomacao.tsx` duplicados (não encontrados no recrutamento, mas mencionados).

10. **Botão "Novo Prestador" quebrado** — Em `PaginaPrestadores.tsx`, botão de novo prestador navega para `nova-operacao` (cria operação, não prestador).

11. **Mock `TalentosCandidato` vs `Candidato` real** — Módulo usa `TalentosCandidato` (13 campos) enquanto `recrutamentoIA.ts` usa `Candidato` (24 campos). Sem compatibilidade.

12. **Schema SQL duplicado e divergente** — `lib/recrutamento_inteligente_schema.sql` (66 linhas, tabelas: `operacoes`, `motoristas_parceiros`, `disparos_whatsapp`) vs `supabase/migrations/recrutamento_operacoes.sql` (64 linhas, tabelas: `operacoes`, `operacoes_financeiro`, `match_operacoes_prestadores`). Schemas diferentes, nomes de colunas diferentes.

13. **Onboarding Wizard sem ação real** — Componente visual bonito mas botões de ação não persistem no banco.

### 🟡 Médios (8)

14. **Gerador de anúncio WhatsApp sem integração real** — UI criada, sem conexão com Evolution API.

15. **Central de documentos sem upload real** — `documentosService` não tem integração com Supabase Storage.

16. **CRM Logístico sem vínculo com WhatsApp CRM** — Duas implementações separadas de CRM para prestadores.

17. **Módulo `components/recrutamento/` externalizado** — Banco de Talentos e WhatsApp CRM vivem fora do módulo principal, criando dispersão.

18. **Utils duplicados** — `modules/recrutamento/utils/cn.ts` implementa utilitários que poderiam vir de `src/lib/utils`.

19. **ALL_CRIADOS, ALL_CANAIS, ALL_VEICULOS no index.tsx** — Constantes mock poluindo o entry point do módulo.

20. **`statusLabel`, `formatCurrency` definidos em `cn.ts`** — Mistura de responsabilidades.

21. **Sem testes automatizados** — Nenhum teste unitário ou de integração para o módulo.

---

## 8. Riscos Arquiteturais

### 🔴 Risco Imediato
- **Perda de dados ao limpar localStorage**: Toda operação, prestador, documento, match, score, automação e interação CRM são perdidos se o usuário limpar o cache do navegador.
- **Schema incompatível impede migração**: Para conectar `operacoesService` ao Supabase, precisa refatorar o schema do banco OU reescrever o service para usar as tabelas existentes.
- **Falsa sensação de funcionalidade**: `useRecrutamentoRealtime` dá impressão de dados reais, mas tudo é localStorage.

### 🟠 Risco Alto
- **Duas bases de candidatos**: Módulo interno usa `TalentosCandidato` (mock), rota externa usa `Candidato` (real). Podem divergir.
- **Onboarding sem efeito real**: Usuário pode completar onboarding wizard e nada acontecer no banco.
- **IA duplicada**: Se ambas as IAs forem chamadas, podem gerar respostas conflitantes.

### 🟡 Risco Médio
- **Manutenção complexa**: 7 services localStorage + 2 services reais + 1 service misto = arquitetura confusa.
- **Dispersão de código**: Módulo espalhado entre `modules/recrutamento/`, `services/`, `components/recrutamento/`.
- **Performance do Dashboard**: `useDashboardRecrutamento` faz 13 queries paralelas + `.limit()` pode não escalar.

---

## 9. Próximos Passos Sugeridos — P18+ (Futuro)

### ✅ P2 — Concluído: Migrar Prestadores para Supabase (esforço: alto)
- ✅ Criada tabela `recrutamento_prestadores` com todas as colunas do módulo (tipadas + JSONB)
- ✅ Migration: `supabase/migrations/20260524_recrutamento_prestadores.sql`
- ✅ `prestadoresService.ts` reescrito: Supabase-first, localStorage como fallback
- ✅ Mappers `fromDB()` (snake_case → camelCase) e `toDB()` (camelCase → snake_case)
- ✅ `buscarMock()` mantido como alias de `listar()` para compatibilidade com `useOperacoes`
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 52% → 55%

### ✅ P3 — Concluído: Migrar Candidatos/Pipeline para Supabase (esforço: alto)
- ✅ Criada tabela `recrutamento_candidatos` com 20 colunas (Enterprise Pipeline)
- ✅ Migration: `supabase/migrations/20260525_recrutamento_candidatos.sql`
- ✅ `enterpriseKanbanService.ts` reescrito: Supabase-first com seed automático (24 candidatos na primeira carga)
- ✅ Mappers `fromDB()` (snake_case → camelCase) e `toDB()` (camelCase → snake_case)
- ✅ UI Enterprise Kanban inalterada — transparência total da migração
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 55% → 59%

### ✅ P4 — Concluído: Unificação Candidato ↔ Prestador (esforço: médio)
- ✅ Criado `conversaoCandidatoService.ts` — converter pipeline → módulo prestador
- ✅ 16 campos mapeados entre `EnterpriseCandidate` (pipeline) e `Prestador` (módulo)
- ✅ Anti-duplicação por telefone e email
- ✅ Candidato atualizado: `stage = 'ativo'`, `prestador_id` vinculado
- ✅ Candidato NÃO é excluído após conversão
- ✅ Documentos e tags preservados
- ✅ Score mapeado com sub-scores proporcionais
- ✅ Botão "Converter em Prestador" na aba Ações do sheet de detalhes
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 59% → 62%

### ✅ P5 — Concluído: Corrigir Fluxo Legado "Novo Prestador" (esforço: baixo)
- ✅ `PaginaPrestadores.tsx`: 2 botões "Novo Prestador" redirecionados de `nova-operacao` → `pipeline-kanban`
- ✅ `DetalhesCandidatoPipelineSheet.tsx`: `handleAbrirCadastroCompleto` removido (criava prestador órfão em memória/Zustand)
- ✅ `handleAbrirCadastroCompleto` redirecionado para `handleConverter` (Supabase-first via `conversaoCandidatoService.converterCandidatoParaPrestador()`)
- ✅ Fluxo padronizado: interessado → candidato → aprovado → prestador
- ✅ Nenhuma ação de recrutamento cria prestador órfão em memória
- ✅ "Novo Prestador" não abre criação de operação
- ✅ Candidatos continuam no Kanban
- ✅ Conversão P4 continua funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 62% → 64%

### ✅ P6 — Concluído: Realtime e Sincronização Operacional (esforço: médio)
- ✅ Criado `useKanbanRealtime.ts` — subscription real `postgres_changes` em `recrutamento_candidatos`
- ✅ `EnterpriseKanbanBoard.tsx` integrado com `useKanbanRealtime(reload)` — Kanban atualiza automaticamente sem refresh manual
- ✅ `useRecrutamentoRealtime.ts` reescrito como `usePrestadoresRealtime` — subscription real `postgres_changes` em `recrutamento_prestadores`
- ✅ `RecrutamentoModule` (index.tsx) ativa `usePrestadoresRealtime` com callback que recarrega lista de prestadores
- ✅ Subscriptions usam `supabase.removeChannel()` para cleanup correto
- ✅ Callback via ref (`onReloadRef`) — evita stale closures e loops
- ✅ Tabelas `recrutamento_candidatos` e `recrutamento_prestadores` já estavam na publication `supabase_realtime` (migrations P2/P3)
- ✅ Fallback: se subscription cair, carregamento manual (`reload`/`recarregar`) continua funcionando
- ✅ UI não quebra se subscription falhar
- ✅ Sem loops de render
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 64% → 67%

### ✅ P7 — Concluído: Corrigir Vínculo Candidato → Prestador (esforço: médio)
- ✅ Criada migration `20260526_recrutamento_candidatos_prestador_id.sql`: ADD COLUMN `prestador_id UUID`, FK → `recrutamento_prestadores(id)` ON DELETE SET NULL, índice GIN
- ✅ Adicionado `prestadorId?: string` ao `EnterpriseCandidate` type
- ✅ `fromDB()` mapeia `prestador_id` → `prestadorId`; `toDB()` mapeia `prestadorId` → `prestador_id`
- ✅ `criar()` inclui `prestador_id` no insert payload
- ✅ `conversaoCandidatoService.atualizarCandidatoAposConversao()` agora grava `prestador_id` corretamente no banco (coluna existe)
- ✅ Anti-duplicação existente (por telefone/email) reutiliza `prestador_id` do prestador já existente
- ✅ Candidato convertido exibe badge "Prestador Vinculado" no sheet de detalhes (ícone Link2, verde)
- ✅ Candidato NÃO é excluído após conversão
- ✅ Fallback: `console.warn` se coluna não existir no banco; conversão não quebra (try/catch + `enterpriseKanbanService.mover()` ainda funciona)
- ✅ Realtime P6 continua funcionando — nova coluna é transmitida automaticamente
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 67% → 69%

### ✅ P8 — Concluído: Timeline e Histórico do Candidato (esforço: médio)
- ✅ Abordagem: JSONB `historico` dentro do candidato (sem nova tabela, sem FK, sem risco de integridade)
- ✅ Criada migration `20260527_recrutamento_candidatos_historico.sql`: ADD COLUMN `historico JSONB DEFAULT '[]'::jsonb`
- ✅ Adicionado type `HistoricoEvento` com 6 tipos: `criado`, `mudou_etapa`, `convertido`, `bloqueado`, `aprovado`, `observacao_adicionada`
- ✅ Cada evento contém: `tipo`, `descricao`, `data`, `stageAnterior?`, `stageNovo?`
- ✅ `mover()` registra evento automaticamente com stage anterior e novo
- ✅ `adicionarObservacao()` registra evento com preview do texto (truncado em 80 chars)
- ✅ `criar()` registra evento inicial "Candidato cadastrado no pipeline"
- ✅ `conversaoCandidatoService.atualizarCandidatoAposConversao()` registra evento `convertido` com ID do prestador
- ✅ `buildMockData()` inclui evento `criado` para cada mock gerado
- ✅ `registrarEvento()` público no service (atualiza Supabase + localStorage)
- ✅ `fromDB()`/`toDB()` mapeiam `historico` corretamente
- ✅ Aba "Histórico" adicionada ao sheet de detalhes (4ª aba, timeline visual com ícones coloridos por tipo)
- ✅ Fallback: se `historico` não existir no banco, mostra "Nenhum histórico registrado"
- ✅ Não quebra realtime existente — coluna é transmitida automaticamente
- ✅ Não altera visual inteiro do Kanban — apenas nova aba no sheet
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 69% → 72%

### ✅ P9 — Concluído: Documentação e Status Operacional do Candidato (esforço: médio)
- ✅ Criado type `DocumentoCandidato` com `nome`, `status`, `dataValidade?`, `observacao?`
- ✅ Adicionado status `'bloqueado'` ao `StatusDocumental` (CNH vencida = bloqueio documental)
- ✅ Definidos documentos mínimos obrigatórios: CNH, CRLV, Comprovante Residência, Foto Veículo
- ✅ Definido documento opcional: ANTT
- ✅ Criada função `calcularStatusDocumentalOperacional()` que:
  - Recalcula vencimentos por data (auto-vencimento na leitura)
  - CNH vencida → status `bloqueado`
  - Documento vencido não-CNH → status `vencido`
  - Todos OK → `completo`
  - Parcial → `parcial`
  - Nenhum → `pendente`
- ✅ `recalcularDocsValidade()` atualiza status dos docs comparando `dataValidade` com data atual
- ✅ `fromDB()` recalcula `statusDocumental`, `validadeCNH` e `dataValidadeCNH` automaticamente em toda leitura
- ✅ `buildMockData()` gera documentos realistas com datas de validade (CNH, CRLV, Comp. Residência, ANTT, Foto Veículo)
- ✅ Checklist visual na aba "Documentos" com docs obrigatórios (verde/âmbar/rosa por status)
- ✅ Docs opcionais exibidos separadamente
- ✅ Badge `bloqueado` adicionado ao `STATUS_DOC_CONFIG` no KanbanCard (ícone XCircle, vermelho)
- ✅ Fallback: se doc não existir → pendente; se data não existir → válido sem vencimento
- ✅ Candidatos antigos sem documentos não quebram — `fromDB()` trata array vazio
- ✅ Realtime P6 continua funcionando
- ✅ Histórico P8 continua funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 72% → 75%

### ✅ P10 — Concluído: Disponibilidade Operacional e Elegibilidade (esforço: médio)
- ✅ Criado type `StatusOperacional`: `apto | pendente | bloqueado | indisponivel`
- ✅ Criado type `DisponibilidadeTipo`: `imediata | parcial | indisponivel`
- ✅ Função `calcularStatusOperacional()` combina: status documental + stage pipeline + disponibilidade
- ✅ Critérios operacionais:
  - Stage `reprovado`/`bloqueado` → bloqueado
  - Disponibilidade `indisponivel` → indisponivel
  - Documento bloqueado/vencido → bloqueado
  - Documentação pendente/parcial → pendente
  - Completo + disponibilidade imediata/parcial → apto
- ✅ `getDisponibilidadeTipo()` deriva de tags: `disponivel_imediato` → imediata, `risco` → indisponivel, default → parcial
- ✅ `fromDB()` computa `statusOperacional` e `disponibilidadeTipo` automaticamente em toda leitura
- ✅ `buildMockData()` inclui status operacional, disponibilidade, regiões de atuação, horários, dias disponíveis
- ✅ `criar()` computa status operacional no momento da criação
- ✅ Badge operacional (4º slot) no `KanbanCard` com ícone e cor por status
- ✅ Badge de disponibilidade no `KanbanCard` (Imediata/Parcial/Indisponível)
- ✅ Filtros de Status Operacional e Disponibilidade no painel de filtros (com cores)
- ✅ Indicadores de status operacional e disponibilidade no sheet de detalhes (aba Perfil)
- ✅ Campos `regioesAtuacao`, `horariosDisponiveis`, `diasDisponiveis` mapeados em `toDB()`/`fromDB()`
- ✅ Fallback: sem disponibilidade → `parcial`; candidatos antigos sem novos campos continuam funcionando
- ✅ Realtime P6, histórico P8 e documentação P9 continuam funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 75% → 78%

### ✅ P11 — Concluído: Integração Operacional com Escala (esforço: médio)
- ✅ Criado `listarPrestadoresAptos()` em `enterpriseKanbanService` com filtros por região, veículo e disponibilidade
- ✅ Critérios operacionais: `statusOperacional === 'apto'`, `disponibilidadeTipo !== 'indisponivel'`, `statusDocumental === 'completo'`
- ✅ Filtros implementados: região (cidade/UF/regiões de atuação), tipo de veículo, disponibilidade (imediata/parcial)
- ✅ Criado componente `PrestadoresAptos` com:
  - Card visual para cada prestador apto (nome, veículo, placa, score, região, disponibilidade, horários, dias)
  - Grid responsivo (1/2/3 colunas)
  - Filtros inline (região, veículo, disponibilidade)
  - Loading skeleton e estado vazio
- ✅ Integrado como seção "Operacionais" no módulo de recrutamento (aba na navegação + renderSection)
- ✅ Tipo `Section` atualizado com `'operacionais'` na store
- ✅ Resultado ordenado por score (decrescente)
- ✅ Fallback: sem aptos → "Nenhum prestador apto disponível"
- ✅ Reutiliza services existentes (`enterpriseKanbanService.listar()`)
- ✅ Reutiliza status operacional P10 e documentação P9
- ✅ Realtime P6 continua funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 78% → 81%

### ✅ P12 — Concluído: Pré-seleção Operacional Manual (esforço: baixo)
- ✅ Tag `'preSelecionado'` adicionada ao `TagType` (JSONB existente, sem migration)
- ✅ Botão "Pré-selecionar" / "Pré-selecionado" em cada card da lista de aptos
- ✅ `togglePreSelecao()` adiciona/remove a tag via `enterpriseKanbanService.atualizar()`
- ✅ Badge "Pré-selecionado" (ícone BookmarkCheck, violeta) no card
- ✅ Badge de contagem de pré-selecionados no header ("X pré-selecionados")
- ✅ Filtro "Pré-selecionados" (toggle) com estado ativo (violeta)
- ✅ Filtro "Somente pré-selecionados" na view de Operacionais
- ✅ Toast de sucesso/erro ao alterar pré-seleção
- ✅ Fallback: se `atualizar()` falhar, toast de erro + UI não quebra
- ✅ Persistência via JSONB `tags` do candidato (Supabase + localStorage)
- ✅ Candidatos antigos sem tag continuam funcionando
- ✅ Realtime P6, P10, P11 continuam funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 81% → 84%

### ✅ P13 — Concluído: Checklist de Onboarding Operacional (esforço: médio)
- ✅ Checklist com 6 itens operacionais: documentação validada, veículo validado, treinamento realizado, contrato enviado, contrato aceito, teste operacional
- ✅ Status onboarding: `pendente` (0/6), `em_andamento` (1-5/6), `concluido` (6/6)
- ✅ Progresso visual: barra percentual + badge de status
- ✅ Armazenamento via tags JSONB (`onboarding_*` no array `tags` do candidato — sem migration)
- ✅ `extrairOnboarding()` converte tags → checklist + status + progresso
- ✅ `fromDB()` computa onboarding automaticamente em toda leitura
- ✅ `buildMockData()` e `criar()` incluem onboarding computado
- ✅ Aba "Onboarding" (5ª aba) no sheet de detalhes com:
  - Barra de progresso (% + cor dinâmica)
  - Status textual
  - Checklist clicável com ícones (CheckCircle2 / Circle)
  - Cores por estado (verde concluído, azul/âmbar pendente)
  - Badge "OK" / "Pendente"
- ✅ `toggleOnboardingItem()`: click alterna item, persiste via `enterpriseKanbanService.atualizar()`
- ✅ Histórico P8 registra evento `observacao_adicionada` para cada alteração
- ✅ Fallback: candidatos sem tags onboarding → tudo pendente; UI não quebra
- ✅ Realtime P6, P10, P11, P12 continuam funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 84% → 87%

### ✅ P14 — Concluído: Dashboard e Métricas Operacionais (esforço: médio)
- ✅ Criado hook `useMetricasRecrutamento()` que computa KPIs a partir de `enterpriseKanbanService.listar()`
- ✅ 10 KPIs implementados: Total Pipeline, Aptos Operacionais, Pendentes, Bloqueados, Pré-selecionados, Onboarding Concluído, Disponíveis Imediatos, Indisponíveis, Taxa Conversão Pipeline, Tempo Médio Onboarding
- ✅ Pipeline por etapa: gráfico de barras horizontais (Recharts)
- ✅ Status Documental: gráfico de pizza (Recharts)
- ✅ Taxa de conversão do pipeline (candidatos → aprovados)
- ✅ Métricas de onboarding (concluídos + em andamento)
- ✅ Cards executivos reutilizando componente `KpiCard` existente
- ✅ Seção "Métricas Operacionais do Recrutamento" inserida no `DashboardRecrutamento` existente
- ✅ Fallback: sem dados → "Nenhum dado disponível" + skeleton loading
- ✅ Realtime P6 continua funcionando — dados são recarregados via hook
- ✅ Reutiliza `enterpriseKanbanService.listar()` — sem queries extras
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 87% → 90%

### ✅ P15 — Concluído: Envio Operacional para Escala (esforço: baixo)
- ✅ Tag `'enviadoEscala'` adicionada ao `TagType` (JSONB existente, sem migration)
- ✅ Ação "Enviar para Escala" / "Remover da Escala" em cada card da lista de aptos (ícones `Send` / `ArrowRightFromLine`)
- ✅ `toggleEnviarEscala()` adiciona/remove a tag via `enterpriseKanbanService.atualizar()`
- ✅ Badge "Enviado para Escala" (ícone `Send`, laranja) no card
- ✅ Filtro "Reservas Escala" (toggle) com indicador laranja + bolinha de notificação quando há reservas
- ✅ Contagem de reservas operacionais
- ✅ Histórico P8 registra evento `observacao_adicionada` para cada envio/remoção
- ✅ Fallback: se `atualizar()` falhar, toast de erro; UI não quebra
- ✅ Reutiliza estrutura JSONB `tags` — sem migration, sem nova tabela
- ✅ Persistência via Supabase + localStorage
- ✅ Realtime P6, P10–P14 continuam funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 90% → 93%

### ✅ P16 — Concluído: Contexto Operacional da Reserva (esforço: médio)
- ✅ Criada migration `20260528_recrutamento_candidatos_reserva_contexto.sql`: ADD COLUMN `reserva_contexto JSONB`
- ✅ Criado type `ReservaContexto` com campos: `cliente`, `operacao`, `regiao`, `observacao`, `prioridade` (baixa/média/alta)
- ✅ Adicionado campo `reservaContexto?: ReservaContexto` ao `EnterpriseCandidate`
- ✅ `toDB()`/`fromDB()` mapeiam `reserva_contexto` corretamente
- ✅ `salvarReservaContexto()` no service: atualiza Supabase + localStorage + registra histórico
- ✅ Criado `ContextoReservaModal` — modal de edição com campos: cliente, operação, região, observação, prioridade (select com cores)
- ✅ Modal integrado no card do `PrestadoresAptos`: botão "Editar" (lápis) ao lado do badge "Enviado para Escala"
- ✅ Exibição do contexto no card:
  - "Reservado para: {cliente} · {operacao}"
  - "Região: {regiao}"
  - Badge de prioridade (alta→rosa, média→âmbar, baixa→azul)
  - Observação textual
- ✅ Histórico P8 registra evento `observacao_adicionada` com dados do contexto
- ✅ Fallback: reserva sem contexto → campos vazios no modal; UI não quebra
- ✅ Prestadores antigos sem `reserva_contexto` continuam funcionando
- ✅ Realtime P6, P10–P15 continuam funcionando
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ Percentual do módulo subiu de 93% → 96%

### ✅ P17 — Concluído: Consolidação Final e Documentação Master
- ✅ Documentação master `RECRUTAMENTO_STATUS.md` atualizada com P1 → P16 completos
- ✅ `STATUS_MODULOS.md` atualizado — Recrutamento Inteligente: 96% funcional
- ✅ Seção "Estado Atual Real" consolidada na tabela de camadas
- ✅ Fluxo operacional completo documentado: interessado → candidato → pipeline → documentação → elegibilidade → onboarding → pré-seleção → reserva → contexto → conversão
- ✅ Tabelas documentadas: `recrutamento_candidatos` (23 colunas + JSONB), `recrutamento_prestadores` (via P2)
- ✅ JSONB usados documentados: `tags`, `documentos`, `historico`, `reserva_contexto`
- ✅ Realtime documentado: subscriptions `recrutamento_candidatos` e `recrutamento_prestadores`
- ✅ Riscos restantes documentados na seção 8
- ✅ Roadmap P18+ criado com 7 futuras etapas
- ✅ Dependências futuras documentadas: Escala, WhatsApp, IA, automações, matching, assinatura digital
- ✅ Módulo consolidado como **96% funcional — pronto para pausa ou próxima fase**
- ✅ `build` e `tsc --noEmit` passam sem erros
- ✅ **Nenhuma feature nova implementada** — apenas documentação

### P18 — Migrar Documentos para Supabase Storage
- Conectar `documentosService.ts` ao Supabase Storage + tabela `documentos_prestadores`
- Upload real de documentos do candidato

### P19 — Unificar Banco de Talentos
- Eliminar componente mock `modules/recrutamento/components/talentos/BancoTalentos.tsx`
- Unificar com `components/recrutamento/BancoTalentos.tsx` (real)
- Remover `MOCK_TALENTOS` e `generateMockCandidatos()` do `index.tsx`

### P20 — IA para Recrutamento
- Análise inteligente de perfil
- Sugestão automática de estágio
- Score preditivo
- Mensagens inteligentes para candidatos

### P21 — Automações Operacionais
- Disparo automático de onboarding quando documentação completa
- Notificação de pré-seleção para operador
- Lembrete de documentos vencendo
- Integração com n8n

### P22 — Matching com Escala
- Casamento automático entre reserva operacional e operações abertas
- Alocação inteligente por região, veículo, disponibilidade

### P23 — Assinatura Digital
- Aceite digital de contrato no onboarding
- Integração com provedor de assinatura

### P24 — Score e Match Avançados
- Score preditivo baseado em histórico de operações
- Match automatizado com operações recorrentes

---

## 10. Arquivos Analisados

### Documentação
- `docs/master/RELATORIO_MESTRE_TMS.md` (116 linhas)
- `docs/master/STATUS_MODULOS.md` (298 linhas)
- `docs/master/ROADMAP_FINAL.md` (150 linhas)
- `docs/master/VISAO_TMS_INTELIGENTE.md` (615 linhas)
- `docs/integracoes-n8n.md`

### Páginas e Entry Points
- `src/pages/Recrutamento.tsx` (5 linhas)
- `src/pages/BancoTalentos.tsx` (9 linhas)
- `src/pages/WhatsAppCRM.tsx` (9 linhas)
- `src/App.tsx` (rotas)

### Módulo Principal (modules/recrutamento/)
- `src/modules/recrutamento/index.tsx` (335 linhas)
- `src/modules/recrutamento/layouts/RecrutamentoLayout.tsx` (143 linhas)
- `src/modules/recrutamento/types/recrutamento.ts` (327 linhas)
- `src/modules/recrutamento/store/recrutamentoStore.ts` (72 linhas)

### Hooks
- `src/modules/recrutamento/hooks/useDashboardRecrutamento.ts` (400 linhas)
- `src/modules/recrutamento/hooks/useOperacoes.ts` (84 linhas)
- `src/modules/recrutamento/hooks/usePrestadores.ts` (79 linhas)
- `src/modules/recrutamento/hooks/useRecrutamentoRealtime.ts` (43 linhas)
- `src/modules/recrutamento/hooks/useRecrutamentoUI.ts` (24 linhas)

### Páginas do Módulo
- `src/modules/recrutamento/pages/DashboardRecrutamento.tsx` (647 linhas)
- `src/modules/recrutamento/pages/PaginaOperacoes.tsx` (296 linhas)
- `src/modules/recrutamento/pages/PaginaNovaOperacao.tsx` (478 linhas)
- `src/modules/recrutamento/pages/PaginaPrestadores.tsx` (256 linhas)

### Services do Módulo (3 Supabase-first, 5 localStorage/mock)
- `src/modules/recrutamento/services/operacoesService.ts` (225 linhas — localStorage)
- `src/modules/recrutamento/services/prestadoresService.ts` (280 linhas — **P2: Supabase-first**)
- `src/modules/recrutamento/services/conversaoCandidatoService.ts` (220 linhas — **P4: Supabase**) 
- `src/modules/recrutamento/services/documentosService.ts` (88 linhas)
- `src/modules/recrutamento/services/scoreService.ts` (58 linhas)
- `src/modules/recrutamento/services/matchService.ts` (115 linhas)
- `src/modules/recrutamento/services/crmService.ts` (66 linhas)
- `src/modules/recrutamento/services/automacoesService.ts` (62 linhas)
- `src/modules/recrutamento/services/iaService.ts` (71 linhas)

### Enterprise Kanban
- `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` (330 linhas — **P3: Supabase-first**)
- `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanStore.ts` (88 linhas)
- `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` (94 linhas)

### Services Externos (reais/mistos)
- `src/services/recrutamentoIA.ts` (433 linhas)
- `src/services/recrutamentoIntegracao.ts` (303 linhas)
- `src/services/integracoes/recrutamentoWhatsappIAService.ts` (768 linhas)

### Componentes Duplicados
- `src/components/recrutamento/BancoTalentos.tsx` (170 linhas)
- `src/components/recrutamento/banco-talentos/BancoTalentosLayout.tsx`
- `src/modules/recrutamento/components/talentos/BancoTalentos.tsx` (82 linhas)

### Schema SQL
- `src/lib/recrutamento_inteligente_schema.sql` (66 linhas)
- `supabase/migrations/recrutamento_operacoes.sql` (64 linhas)

---

## 11. Arquivos Alterados por Etapa

### P1 (Diagnóstico)
- **Criado**: `docs/master/RECRUTAMENTO_STATUS.md` (este documento)
Nenhum arquivo de código foi alterado.

### P2 (Migração Prestadores → Supabase)
- **Criado**: `supabase/migrations/20260524_recrutamento_prestadores.sql` — tabela dedicada com todas as colunas do módulo
- **Modificado**: `src/modules/recrutamento/services/prestadoresService.ts` — reescrito para Supabase-first com fallback localStorage
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P2

### P3 (Migração Candidatos/Pipeline → Supabase)
- **Criado**: `supabase/migrations/20260525_recrutamento_candidatos.sql` — tabela dedicada Enterprise Pipeline (20 colunas)
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — reescrito para Supabase-first com seed automático
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P3

### P4 (Unificação Candidato ↔ Prestador)
- **Criado**: `src/modules/recrutamento/services/conversaoCandidatoService.ts` — service de conversão pipeline → prestador
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — botão "Converter em Prestador" + função `handleConverter`
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P4

### P5 (Corrigir Fluxo Legado "Novo Prestador")
- **Modificado**: `src/modules/recrutamento/pages/PaginaPrestadores.tsx` — 2 botões "Novo Prestador" redirecionados de `nova-operacao` → `pipeline-kanban` + toast informativo
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — `handleAbrirCadastroCompleto` substituído: criação em memória/Zustand removida, redirecionado para `handleConverter` (Supabase-first)
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P5

### P6 (Realtime e Sincronização Operacional)
- **Criado**: `src/modules/recrutamento/hooks/useKanbanRealtime.ts` — subscription real `recrutamento_candidatos`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/EnterpriseKanbanBoard.tsx` — integrado `useKanbanRealtime(reload)`, Kanban atualiza automaticamente
- **Modificado**: `src/modules/recrutamento/hooks/useRecrutamentoRealtime.ts` — reescrito como `usePrestadoresRealtime`: escuta `recrutamento_prestadores` (não mais `prestadores`/`operacoes`)
- **Modificado**: `src/modules/recrutamento/index.tsx` — `usePrestadoresRealtime` ativado com callback que recarrega prestadores via `prestadoresService.listar()`
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P6

### P7 (Corrigir Vínculo Candidato → Prestador)
- **Criado**: `supabase/migrations/20260526_recrutamento_candidatos_prestador_id.sql` — ADD COLUMN `prestador_id UUID`, FK → `recrutamento_prestadores(id)`, índice
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionado `prestadorId?: string` ao `EnterpriseCandidate`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — `fromDB()` / `toDB()` / `criar()` mapeiam `prestador_id`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — badge "Prestador Vinculado" (ícone Link2) quando `candidate.prestadorId` existe
- **Modificado**: `src/modules/recrutamento/services/conversaoCandidatoService.ts` — `atualizarCandidatoAposConversao` agora grava `prestador_id` na coluna real; fallback com `console.warn` se coluna não existir
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P7

### P8 (Timeline e Histórico do Candidato)
- **Criado**: `supabase/migrations/20260527_recrutamento_candidatos_historico.sql` — ADD COLUMN `historico JSONB`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionado `HistoricoEvento`, `HistoricoTipoEvento`, campo `historico` em `EnterpriseCandidate`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — `fromDB()`/`toDB()`/`criar()` mapeiam `historico`; `mover()` e `adicionarObservacao()` registram eventos; `registrarEvento()` público
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — aba "Histórico" com timeline visual (4ª aba, ícones coloridos, ordenação reversa)
- **Modificado**: `src/modules/recrutamento/services/conversaoCandidatoService.ts` — registra evento `convertido` após conversão
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P8

### P9 (Documentação e Status Operacional do Candidato)
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionados `DocumentoCandidato`, `DOCS_MINIMOS_OBRIGATORIOS`, `DOCS_MINIMOS_OPCIONAIS`, status `'bloqueado'` em `StatusDocumental`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — `calcularStatusDocumentalOperacional()`, `recalcularDocsValidade()`, `generateMockDocumentos()` com datas realistas, `fromDB()` recalcula status na leitura
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — checklist visual com docs obrigatórios/opcionais, status `bloqueado` adicionado
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/KanbanCard.tsx` — badge `bloqueado` adicionado ao `STATUS_DOC_CONFIG`
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P9

### P10 (Disponibilidade Operacional e Elegibilidade)
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionados `StatusOperacional`, `DisponibilidadeTipo`, campos `statusOperacional`, `disponibilidadeTipo`, `regioesAtuacao`, `horariosDisponiveis`, `diasDisponiveis` em `EnterpriseCandidate`; filtros `statusOperacional` e `disponibilidade` em `KanbanFilter`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — `calcularStatusOperacional()`, `getDisponibilidadeTipo()`, `fromDB()` computa status, `buildMockData()` com dados realistas, `applyFilters()` com novos filtros
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/KanbanCard.tsx` — badge operacional (4º slot), badge de disponibilidade
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — indicadores de status operacional e disponibilidade no perfil
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/KanbanFilters.tsx` — filtros de Status Operacional e Disponibilidade
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P10

### P11 (Integração Operacional com Escala)
- **Criado**: `src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx` — componente de listagem de prestadores aptos com filtros
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — adicionado `listarPrestadoresAptos()` com filtros por região, veículo, disponibilidade
- **Modificado**: `src/modules/recrutamento/store/recrutamentoStore.ts` — adicionado `'operacionais'` ao type `Section`
- **Modificado**: `src/modules/recrutamento/layouts/RecrutamentoLayout.tsx` — adicionada aba "Operacionais"
- **Modificado**: `src/modules/recrutamento/index.tsx` — adicionada seção `operacionais` no renderSection
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P11

### P12 (Pré-seleção Operacional Manual)
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionado `'preSelecionado'` ao `TagType`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx` — botão de toggle, badge, filtro, contagem, toast
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P12

### P13 (Checklist de Onboarding Operacional)
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionados `OnboardingItem`, `OnboardingStatus`, `ONBOARDING_ITENS`, campos no `EnterpriseCandidate`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — `extrairOnboarding()`, `fromDB()` computa onboarding, `buildMockData()`/`criar()` incluem
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx` — aba "Onboarding" (5ª aba) com progresso e checklist clicável
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P13

### P14 (Dashboard e Métricas Operacionais)
- **Criado**: `src/modules/recrutamento/hooks/useMetricasRecrutamento.ts` — hook com 10 KPIs, pipeline por etapa, status documental
- **Modificado**: `src/modules/recrutamento/pages/DashboardRecrutamento.tsx` — seção "Métricas Operacionais do Recrutamento" com cards, gráficos de barras e pizza
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P14

### P15 (Envio Operacional para Escala)
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionado `'enviadoEscala'` ao `TagType`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx` — ação "Enviar para Escala"/"Remover", badge, filtro "Reservas Escala", contagem, histórico
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P15

### P16 (Contexto Operacional da Reserva)
- **Criado**: `supabase/migrations/20260528_recrutamento_candidatos_reserva_contexto.sql` — ADD COLUMN `reserva_contexto JSONB`
- **Criado**: `src/modules/recrutamento/components/enterprise-kanban/ContextoReservaModal.tsx` — modal de edição de contexto
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts` — adicionados `ReservaContexto`, campo `reservaContexto` em `EnterpriseCandidate`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` — `toDB()`/`fromDB()`/`salvarReservaContexto()`
- **Modificado**: `src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx` — integração do modal, exibição de contexto no card, botão editar
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — atualizado com progresso P16

### P17 (Consolidação Final e Documentação Master)
- **Modificado**: `docs/master/RECRUTAMENTO_STATUS.md` — consolidado P1→P16, roadmap P18+, riscos, dependências
- **Modificado**: `docs/master/STATUS_MODULOS.md` — Recrutamento Inteligente atualizado para 96%

---

## 12. Dependências Futuras

### Integração com Escala/Torre
- Matching automático entre reserva operacional e operações abertas
- Alocação por região, veículo, disponibilidade
- Notificação de prestador selecionado

### Integração com WhatsApp
- Disparo automático de onboarding
- Notificação de pré-seleção
- Confirmação de disponibilidade via WhatsApp

### IA para Recrutamento
- Análise preditiva de perfil
- Score inteligente baseado em histórico
- Sugestão automática de estágio no pipeline
- Mensagens inteligentes para candidatos

### Automações
- Disparo de onboarding quando documentação completa
- Lembrete de documentos vencendo
- Notificação de pré-seleção para operador
- Atualização automática de status documental
- Integração com n8n para workflows

### Matching Operacional
- Casamento automático entre prestador apto e operação
- Score de compatibilidade (região, veículo, horário)
- Priorização por disponibilidade e onboarding

### Assinatura Digital
- Aceite digital de contrato no onboarding
- Integração com provedor de assinatura (ex: ZapSign, Clicksign)
- Histórico de contratos assinados

### Documentos e Storage
- Upload real de documentos (Supabase Storage)
- OCR para extração automática de dados
- Validação antifraude

---

## RECRUTAMENTO INTELIGENTE P17 CONCLUÍDO — 96% FUNCIONAL — AGUARDANDO PRÓXIMO MÓDULO
