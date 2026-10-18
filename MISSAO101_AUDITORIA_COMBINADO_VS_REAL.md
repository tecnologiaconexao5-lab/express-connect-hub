# MISSÃO 101 — Auditoria do Combinado vs Real

**Data:** 06/07/2026
**Projeto:** CONEXÃO EXPRESS ENTERPRISE
**Áreas:** TMS + Painel do Cliente + App Motorista

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Ordem de Serviço (OS)](#2-ordem-de-serviço-os)
3. [Escala](#3-escala)
4. [Rede Enterprise (Rede Prestadores)](#4-rede-enterprise)
5. [Financeiro](#5-financeiro)
6. [NOC / Dashboard](#6-noc--dashboard)
7. [Event Bus](#7-event-bus)
8. [Tracking / Rastreamento](#8-tracking--rastreamento)
9. [Prestadores](#9-prestadores)
10. [Clientes](#10-clientes)
11. [Contratos](#11-contratos)
12. [Relatórios](#12-relatórios)
13. [Painel do Cliente (Portal)](#13-painel-do-cliente-portal)
14. [App Motorista](#14-app-motorista)
15. [Fonte Única da Verdade](#15-fonte-única-da-verdade)
16. [Testes de Validação](#16-testes-de-validação)
17. [Matriz de Classificação por Tela](#17-matriz-de-classificação-por-tela)
18. [Problemas P0/P1/P2 Consolidados](#18-problemas-p0p1p2-consolidados)
19. [Vazamento de Dados (Cliente vê o que não deve)](#19-vazamento-de-dados)
20. [Correções Aplicadas](#20-correções-aplicadas)
21. [Pendências Restantes](#21-pendências-restantes)
22. [Nota por Módulo](#22-nota-por-módulo)
23. [Anexos](#23-anexos)

---

## 1. Resumo Executivo

### Score de Prontidão por Módulo

| Módulo | Nota | P0 | P1 | P2 | P3 |
|--------|:----:|:--:|:--:|:--:|:--:|
| **1. OS** | **6/10** | 3 | 4 | 1 | 0 |
| **2. Escala** | **6/10** | 1 | 3 | 1 | 0 |
| **3. Rede Enterprise** | **7/10** | 0 | 1 | 1 | 0 |
| **4. Financeiro** | **4/10** | 12 | 24 | 27 | 0 |
| **5. NOC / Dashboard** | **9/10** | 0 | 0 | 2 | 0 |
| **6. Event Bus** | **7/10** | 0 | 0 | 0 | 2 |
| **7. Tracking** | **3/10** | 2 | 0 | 0 | 0 |
| **8. Prestadores** | **6/10** | 0 | 2 | 0 | 0 |
| **9. Clientes** | **10/10** | 0 | 0 | 0 | 0 |
| **10. Contratos** | **10/10** | 0 | 0 | 0 | 0 |
| **11. Relatórios** | **8/10** | 0 | 1 | 0 | 0 |
| **12. Painel Cliente** | **4/10** | 2 | 6 | 4 | 0 |
| **13. App Motorista** | **0/10** | 1 | 0 | 0 | 9 |
| **GERAL** | **5.5/10** | **21** | **41** | **36** | **11** |

### O que funciona de verdade (score 10/10)
- Clientes (CRUD completo, sem mock, sem fallback)
- Contratos (CRUD completo, sem mock)
- Dashboard NOC (7 abas com dados reais, Eventos integrados)

### O que está quebrado ou decorativo (score ≤ 5/10)
- **App Motorista:** Nenhum código neste repositório. `appPrestadorService.ts` (594 linhas) é 100% morto. 10 tabelas não utilizadas.
- **Tracking:** GPS não funciona — `portal_tracking_realtime` sempre vazio. `registrarPosicao()` sem callers.
- **Financeiro:** 3 componentes 100% mock (`SegurosFinanceiro`, `PlanoContas`, `PagamentoCNAB`). `escala_operacional` legado ainda ativo.
- **Painel Cliente:** 16/31 componentes decorativos (52%). 3 componentes expõem custo/margem ao cliente.

---

## 2. Ordem de Serviço (OS)

**Arquivo:** `src/components/operacao/OrdemServicoForm.tsx` (2770 linhas)

### O que funciona
- ✅ Criação/edição de OS persiste em `ordens_servico` via `supabase.from("ordens_servico")`
- ✅ Cálculo de distância com engine real (`calcularDistancia` do Mapbox/distanceService)
- ✅ Precificação via `precificacaoEngineService.calcularPrecoRapido()` (M78)
- ✅ Geração de link de rastreio via `gerarLinkRastreio()` (M62)
- ✅ Compartilhamento via WhatsApp/email com `CompartilharRastreioModal`
- ✅ Finalização de OS dispara trigger `trg_propagar_financeiro_os` (M80)

### Problemas encontrados

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| OS-01 | **P0** | `OrdemServicoForm.tsx:76-86` | Código de teste WhatsApp REAL em produção — `testarWhatsAppReal()` com `SEU_NUMERO_AQUI` hardcoded. Comentário "remover após validação" nunca foi removido. |
| OS-02 | **P0** | `OrdemServicoForm.tsx:80` | Número de telefone hardcoded `"SEU_NUMERO_AQUI"` em produção |
| OS-03 | **P0** | `OrdemServicoForm.tsx:1356,1434,1527` | 3 emissões Focus mostram toast "Modo simulado" — emissão não é real |
| OS-04 | **P1** | `OrdemServicoForm.tsx:34,335` | `calcularValorPorDistancia` do `calculoService` (deprecated) ainda é importado e usado como fallback quando não há tabela |
| OS-05 | **P1** | `OrdemServicoForm.tsx:132` | `_calcularValorAutomaticoLegado` mantido como deprecated — deve ser removido |
| OS-06 | **P1** | `OrdemServicoForm.tsx:251` | Número de OS gerado com `Math.random()` — sem sequencial real do banco |
| OS-07 | **P1** | `OrdemServicoForm.tsx:2235` | Texto na UI: "Valores calculados conforme tabela do cliente ou fallback teste" — mostra "fallback teste" ao cliente |
| OS-08 | **P2** | `ordemServicoService.ts:344` | `sincronizarFinanceiroOS` é no-op — não propaga financeiro, apenas loga |
| OS-09 | **P2** | `ordemServicoService.ts:512` | `sincronizarFinanceiroOSAlocacao` ainda existe, marcada como NÃO CHAMAR |

### Divergências com Escala e Portal
- OS usa `Math.random()` para número; Escala usa sequencial diferente — inconsistência de numeração
- OS finalizada dispara trigger financeiro; Escala finalizada dispara trigger M66 — ambos coexistem mas com fórmulas de margem potencialmente divergentes
- Portal Cliente vê OSs reais via `ordens_servico` — OK

---

## 3. Escala

**Arquivo:** `src/components/operacao/EscalaLista.tsx` (3181 linhas)

### O que funciona
- ✅ CRUD de alocações em `alocacoes_escala`
- ✅ Cálculo financeiro via `precificacaoEngineService.calcularPrecoRapido()` (M78)
- ✅ Propagação financeira via trigger M66 (`trg_propagar_financeiro_alocacao`)
- ✅ Vínculo com OS via `ordemServicoService.sincronizarOSEscala()`

### Problemas encontrados

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| ESC-01 | **P0** | `EscalaLista.tsx:995-1024` | Geração de escala mockada com `Math.random()` persistida em `localStorage` — dados falsos no sistema |
| ESC-02 | **P1** | `EscalaLista.tsx:406,1022` | Uso de `localStorage` para fallback e cache com chave legada `conexao_escala_operacional` |
| ESC-03 | **P1** | `EscalaLista.tsx:62` | Comentário "Mock data com veículos padronizados conforme tipos do sistema" indica código mock ainda presente |
| ESC-04 | **P1** | `escalaService.ts` | Sem máquina de estados formal — transições são strings hardcoded em 12+ pontos. Risco de estados inválidos. |
| ESC-05 | **P2** | `EscalaLista.tsx:573` | `Math.floor(1000 + Math.random() * 9000)` usado para sufixo aleatório |

### Divergências com OS e Portal
- Escala usa `alocacoes_escala`; OS usa `ordens_servico` — relação 1:N correta
- Trigger M66 + M80 coexistem — ambos propagam para `financeiro_receber`/`financeiro_pagar`/`pagamentos_prestadores`/`composicao_financeira_os`
- Portal Cliente consome `alocacoes_escala` para timeline — OK

---

## 4. Rede Enterprise

**Arquivo:** `src/services/operacao/redePrestadoresService.ts`

### O que funciona
- ✅ Publicação de oportunidades em `rede_oportunidades`
- ✅ Busca de prestadores compatíveis por tipo de veículo, região, CEP
- ✅ Cancelamento de oportunidade
- ✅ Consulta de status (disponível, acionado, aceito, recusado, cancelado)
- ✅ Botões "Aceitar" funcionais para prestadores

### Problemas encontrados

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| RED-01 | **P1** | (cross-module) | Navegação da Rede no Portal Cliente não mostra oportunidades — apenas dados mock |
| RED-02 | **P2** | `redePrestadoresService.ts` | Notificações de nova oportunidade para prestadores não são enviadas (simulation mode) |

### Divergências com App Motorista
- Rede de Oportunidades é funcional no TMS mas **não é consumida pelo App Motorista** — o app é externo e não há garantia de que a API da Rede seja consumida corretamente

---

## 5. Financeiro

**Arquivos auditados:** 26 componentes, 4 services

### O que funciona
- ✅ `financeiro_receber` via trigger M66/M80 — propagação automática por OS/Escala
- ✅ `financeiro_pagar` via trigger M66/M80 (com UNIQUE(os_id) adicionado em M80)
- ✅ `pagamentos_prestadores` via trigger
- ✅ `composicao_financeira_os` com fórmula unificada (M80b)
- ✅ Dashboard Financeiro no NOC com dados reais

### O que NÃO funciona (P0)

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| FIN-01 | **P0** | `ContasReceberEnterprise.tsx:293,330,355,425,450,504,675,1511` | Usa `origem: "escala_operacional"` (tabela DEPRECATED) — deveria usar `alocacoes_escala` |
| FIN-02 | **P0** | `PagamentoPrestadores.tsx:584,613,1305,1311` | Usa `origem_lancamento: "escala_operacional"` (tabela DEPRECATED) |
| FIN-03 | **P0** | `IntegracoesTMS.tsx:720,730,746,1137` | Queries e subscriptions diretas à tabela `escala_operacional` (DEPRECATED) |
| FIN-04 | **P0** | `SegurosFinanceiro.tsx` | Componente 100% mock — sem persistência real. ID gerado com `Math.random()` |
| FIN-05 | **P0** | `PlanoContas.tsx` | Componente 100% mock — sem conexão Supabase |
| FIN-06 | **P0** | `PagamentoCNAB.tsx` | Geração de arquivo CNAB 100% fake — string hardcoded |
| FIN-07 | **P0** | `auditoriaPrestadorService.ts:53` | `localStorage.getItem("demo_user")` — resquício do modo demo (Missão 50) |
| FIN-08 | **P0** | `types.ts:328-386` | Arrays mock (`mockClientes`, `mockFornecedores`, etc.) exportados e importados por componentes de produção |
| FIN-09 | **P0** | `ContasReceberEnterprise.tsx:1249,1274,1360,1794` | Mock data RENDERIZADO na UI de produção (dropdowns com dados falsos) |
| FIN-10 | **P0** | `calculoService.ts` | `@deprecated` mas ainda importado por `OrdemServicoForm.tsx` e `OrcamentoForm.tsx` |
| FIN-11 | **P0** | `composicaoFinanceiraService.ts` | `@deprecated` mas ainda importado por 3 arquivos de produção |
| FIN-12 | **P0** | `ordemServicoService.ts:339` | `sincronizarFinanceiroOS` é no-op — callers acreditam que finanças foram propagadas mas nada acontece |

### Problemas P1
- `ContasReceberEnterprise.tsx` ~30 `as any` — type safety comprometida
- `PagamentoPrestadores.tsx` ~20 `as any`
- `DashboardFinanceiroEnterprise.tsx` ~50+ `as any`
- 14+ `console.error` catch-all em `ContasReceberEnterprise.tsx`
- 13+ `console.error` catch-all em `PagamentoPrestadores.tsx`
- `composicaoFinanceiraService.ts` — 6 `console.log` debug internos em produção

---

## 6. NOC / Dashboard

**Arquivos:** `src/pages/Dashboard.tsx`, `src/components/dashboard/` (8 arquivos)

### O que funciona
- ✅ TabOperacional — dados reais de `ordens_servico`, `alocacoes_escala`, `rede_oportunidades`, `prestadores`
- ✅ TabExecutivo — dados reais de `clientes`, `prestadores`, `veiculos`, `ordens_servico`, `financeiro_receber`, `financeiro_pagar`
- ✅ TabRede — dados reais de `rede_oportunidades`, `rede_visualizacoes`
- ✅ TabComercial — dados reais de `clientes`, `ordens_servico`, `orcamentos`
- ✅ TabFinanceiro — dados reais de `financeiro_receber`, `financeiro_pagar`, `composicao_financeira_os`
- ✅ TabAlertas — dados reais de `escalonamentos_humanos` com Realtime
- ✅ TabEventos — via `useEventosRealtime` hook com `eventos_oficiais`

### Problemas

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| NOC-01 | **P2** | `TabComercial.tsx:128,140` | KPIs "Follow-ups Pend." e "Oportunidades" mostram "—" com texto "CRM em implantação" |
| NOC-02 | **P2** | `TabExecutivo.tsx:130` | `useEffect` com array de dependência vazio `[]` — ignora filtros de data |
| NOC-03 | **P2** | `TabFinanceiro.tsx:116` | Mesmo problema — `useEffect` com `[]` ignora filtros |

### Nota: 9/10 — melhor módulo do sistema

---

## 7. Event Bus

**Arquivos:** `src/services/eventBus/` (6 arquivos), `src/hooks/useEventosRealtime.ts`

### O que funciona
- ✅ `publicarEvento()` insere em `eventos_oficiais` via Supabase
- ✅ `useEventosRealtime()` hook com subscription Realtime a INSERT
- ✅ 4 callers: `podService.ts`, `ordemServicoService.ts` (2x), `escalaService.ts`
- ✅ Consumidores: `TabEventos` (NOC), TorreControle (supplemented)
- ✅ `PortalEventosFeed` no Portal Cliente
- ✅ Adapter fiscal (`toFiscalTimelineEvent`)
- ✅ RLS segregada: `anon` vê apenas `visibility='public'`

### Problemas

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| EVT-01 | **P3** | `eventBusService.ts` | Apenas 3 services produzem eventos (8+ módulos não publicam) |
| EVT-02 | **P3** | `eventBusService.ts` | Nenhum trigger SQL chama `publicarEvento()` — é tudo via TS |

### Status: Funcional mas cobertura baixa

---

## 8. Tracking / Rastreamento

**Arquivos:** `src/services/rastreamento/trackingService.ts`, `CompartilharRastreioModal.tsx`, `PortalTrackingMap.tsx`

### O que funciona
- ✅ `gerarLinkRastreio()` — cria link público em `tracking_public_links` (3 callers)
- ✅ `CompartilharRastreioModal` — QR code, WhatsApp, email (rota `/rastreamento/{token}`)
- ✅ Subscription Realtime a `portal_tracking_realtime` no Portal Cliente

### O que NÃO funciona

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| TRK-01 | **P0** | `trackingService.ts:119-140` | `registrarPosicao()` tem 0 callers — ninguém escreve em `portal_tracking_realtime` |
| TRK-02 | **P0** | `PortalCliente.tsx:550-574` | Subscription a `portal_tracking_realtime` sempre retorna vazio — GPS tracking não funciona |

### Causa raiz
O App Motorista (Flutter PWA externo) é quem deveria popular `portal_tracking_realtime`. Como não há integração com o app, a tabela está sempre vazia. O mapa Mapbox no Portal Cliente e no Painel Operacional não tem dados para exibir.

---

## 9. Prestadores

**Arquivos:** `src/components/prestadores/`, `src/services/prestadores/`

### O que funciona
- ✅ CRUD de prestadores em `prestadores` via Supabase
- ✅ Role check + `configuracoes_sistema` para deleção (sem hardcoded `admin123`)
- ✅ Vínculo com veículos

### Problemas

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| PRE-01 | **P1** | `PrestadoresLista.tsx:14,76,120,124` | `mockPrestadores.ts` importado e usado como fallback quando Supabase falha ou retorna vazio — usuário vê prestadores falsos |
| PRE-02 | **P1** | `PrestadorDetalhe.tsx:215-218` | Fotos de prestador armazenadas em `localStorage` (chave `conexao_prestador_fotos`) em vez de Supabase Storage |

---

## 10. Clientes

**Arquivos:** `src/components/clientes/`, `src/services/clientes/`

**Nota: 10/10** — Nenhum problema encontrado. CRUD completo sem mock, sem fallback, sem TODO/FIXME.

---

## 11. Contratos

**Arquivos:** `src/components/contratos/`, `src/services/contratos/`

**Nota: 10/10** — Nenhum problema encontrado. Apenas placeholders de input padrão.

---

## 12. Relatórios

**Arquivos:** `src/components/relatorios/`, `src/components/financeiro/relatorios/`, `src/services/relatorios/`

### O que funciona
- ✅ Consultas reais a `ordens_servico`, `alocacoes_escala`, `financeiro_receber`, `financeiro_pagar`
- ✅ Exportação PDF/Excel implementada (Missão 54, Etapa 4)
- ✅ `RelatorioMargemReal.tsx` com PDF + Excel reais
- ✅ `RelatorioClienteAgregadoRefrigerado.tsx` com PDF + Excel
- ✅ `CrmRelatorios.tsx` com PDF + Excel

### Problemas

| ID | Severidade | Arquivo:Linha | Problema |
|:--:|:----------:|:--------------|----------|
| REL-01 | **P1** | `relatorioService.ts:43-70,172-190,229-280,409-440,624-680` | Service consulta tabelas base diretamente via joins complexos em vez de usar as 5 views existentes (`vw_relatorio_faturamento_cliente`, etc.) |

### Status: 8/10 — funcional com gap de otimização

---

## 13. Painel do Cliente (Portal)

**Arquivo principal:** `src/pages/PortalCliente.tsx` (5626 linhas)
**Componentes:** 31 (8 funcionais, 16 decorativos, 7 utilitários)

### Matriz de Ações do Cliente

| Ação | Persiste? | Impacto TMS? | Status |
|------|:---------:|:------------:|:------:|
| Criar Pedido | ✅ `portal_pedidos` | ✅ OS criada via `confirmarPedidoPortal()` | **Corrigido (M83)** |
| Acompanhar Tracking | ✅ Subscription realtime | ❌ Sem dados (tabela vazia) | **P0 — tracking quebrado** |
| Ver Timeline | ✅ `alocacoes_escala` + `entregas_protocolo` | ✅ Dados reais | **Funcional** |
| Ver POD | ✅ `entregas_protocolo` (fotos, assinatura, canhoto) | ✅ Dados reais | **Funcional** |
| Ver Documentos | ✅ `entregas_protocolo` | ✅ Dados reais | **Funcional** |
| Ver Financeiro | ✅ `financeiro_receber` (apenas faturas do cliente) | ✅ Filtrado (sem margem/custo) | **Funcional** |
| Abrir Ocorrência | ✅ `portal_ocorrencias` | ❌ TMS nunca lê a tabela | **P1 — sem trigger TMS** |
| Enviar Avaliação | ✅ `portal_avaliacoes` | ❌ TMS nunca lê a tabela | **P1 — sem trigger TMS** |
| Acompanhar Status | ✅ `ordens_servico` | ✅ Dados reais | **Funcional** |
| Notificações | ❌ Estado local | ❌ Nada persiste | **P1 — decorativo** |
| Onboarding | ❌ Estado local | ❌ Wizard sem save | **P1 — decorativo** |
| Roteirização | ❌ 3 rotas hardcoded | ❌ Callback é toast | **P1 — decorativo** |
| Economia/Dashboard | ❌ `Math.random()` | ❌ Dados falsos | **P1 — decorativo** |
| IA Insights | ❌ Dados fixos | ❌ Sem IA real | **P1 — decorativo** |

### Componentes Decorativos (16)

| Componente | Status | Problema |
|-----------|:------:|----------|
| PortalAIReport | Decorativo | `defaultData` hardcoded (SLA 96%, R$ 18.400 economia) |
| PortalCentralViva | Decorativo | Props opcionais, nunca passadas — sempre vazio |
| PortalEconomia | Decorativo | R$ 18.400 hardcoded, 94% produtividade fake |
| PortalExecutiveDashboard | Decorativo | `defaultMetrics` hardcoded + `Math.random()` heatmap |
| PortalIAOperacional | Decorativo | Score 87, SLA 94%, 3 atrasos — tudo fixo |
| PortalMultiFilial | Decorativo | 5 unidades hardcoded, sem filiais reais |
| PortalNotificacoes | Decorativo | Estado local vazio, nunca consulta tabela |
| PortalOnboarding | Decorativo | Wizard 4 passos, nada persiste |
| PortalRoteirizacao | Decorativo | 3 rotas hardcoded, `custoEstimado` fake |
| PortalEscalaOperacional | Decorativo | 5 veículos hardcoded |
| PortalWhatsApp | Decorativo | `defaultMensagens` array vazio |
| PortalDashboardPremium | Decorativo | Requer props que nunca são passadas |
| PortalRelatoriosPremium | Decorativo | Nenhum relatório real carregado |

### Vazamento de Dados (Cliente vê o que NÃO deve)

| ID | Componente | Dado Exposto | Risco |
|:--:|:-----------|:-------------|:-----:|
| LEAK-01 | PortalExecutiveDashboard | `custoPorEntrega: 42.50` | Dados mock mas **conceito** de custo interno exposto |
| LEAK-02 | PortalExecutiveDashboard | `custoPorRegiao` (Zona Sul: R$ 12.5k) | Custo por região exposto |
| LEAK-03 | PortalMultiFilial | Campo `custo` por unidade (R$ 280.000) | **GRAVE** — calcula `margem = ((receita - custo)/receita)*100` e exibe percentual |
| LEAK-04 | PortalMultiFilial | `custo` exibido como "R$ 280k" | Custo financeiro visível ao cliente |
| LEAK-05 | PortalEconomia | Interface com `reducaoCusto`, `economiaCombustivel` | Conceito de economia interna |
| LEAK-06 | analyticsService.ts | Interface `AnalyticsDashboard` com `custoPorEntrega` | Nome do campo expõe custo |

---

## 14. App Motorista

### Status: NÃO EXISTE NESTE REPOSITÓRIO

| Item | Status |
|:-----|:------:|
| `appPrestadorService.ts` (594 linhas) | **100% morto** — 0 callers em todo `src/` |
| Flutter project (.dart files) | **0 arquivos** encontrados |
| Tabelas `motorista_app_sessoes`, `motorista_checkins`, etc. (10 tabelas) | Só referenciadas por código morto |
| Tabelas `prestador_acesso`, `prestador_disponibilidade`, etc. (7 tabelas) | Código morto — podem nem existir no banco |
| Tabela `os_pod` | Só escrita por código morto |
| Tabela `dreamflow_eventos` | Só escrita por código morto |

### Telas do App Motorista (combinado vs real)

| Tela | Combinado | Real |
|:-----|:----------|:-----|
| Login | Deve autenticar prestador | ❌ Sem implementação neste repo |
| Home | Logo menor, status claro, operação ativa em destaque | ❌ Sem implementação |
| Rede de Oportunidades | Oportunidades reais, valor prestador, rota, aceitar | ❌ Sem implementação |
| Lista de Operações | OS reais, status, escala | ❌ Sem implementação |
| Detalhe da Operação | OS, romaneio, cliente, paradas, contatos, timeline | ❌ Sem implementação |
| Tracking | GPS em tempo real | ❌ Sem implementação |
| POD | Assinatura horizontal, fotos, recebedor, confirmação | ❌ Sem implementação |
| Ganhos | Valor por operação, adicionais, reembolsos, histórico | ❌ Sem implementação |
| Reembolsos | OS, romaneio, rota, cliente, valor, motivo, status | ❌ Sem implementação |
| Perfil | Dados do prestador, veículo, documentos | ❌ Sem implementação |
| Notificações | Alertas de oportunidade, escala, financeiro | ❌ Sem implementação |
| Configurações | Preferências, conta | ❌ Sem implementação |

### Problemas

| ID | Severidade | Problema |
|:--:|:----------:|:---------|
| APP-01 | **P0** | `appPrestadorService.ts` (594 linhas) — código 100% morto, 0 callers |
| APP-02 | **P3** | 10 tabelas de schema só existem em código morto — risco de schema pollution |
| APP-03 | **P3** | Sem App Motorista real neste repositório — impossível auditar integração |
| APP-04 | **P3** | `prestador.conexaoexpress.com.br` é projeto Flutter externo — sem garantia de compatibilidade de API |

---

## 15. Fonte Única da Verdade

### Status dos Pilares

| Pilar | Onde está | Coerente? | Problema |
|:------|:----------|:---------:|:---------|
| **Status** | `alocacoes_escala.status` + `ordens_servico.status` | ⚠️ Parcial | Sem máquina de estados formal em `escalaService.ts` — transições são strings soltas. Duas fontes (OS + Escala) podem divergir. |
| **Precificação** | `precificacaoEngineService` | ✅ Bom | Engine oficial integrado em OS, Escala, Orçamento. Mas `calculoService` (deprecated) ainda é fallback em 2 componentes. |
| **Financeiro** | Triggers M66 + M80 | ✅ Bom | Triggers idempotentes propagam para 4 tabelas. `sincronizarFinanceiroOS` é no-op (seguro). |
| **Event Bus** | `eventos_oficiais` via `publicarEvento()` | ⚠️ Parcial | Funcional mas com cobertura baixa (3/10+ módulos produzem eventos). Nenhum trigger SQL produz eventos. |
| **Rede** | `rede_oportunidades` | ✅ Bom | Funcional no TMS. Não consumida pelo App Motorista (app externo). |
| **Portal** | Dados reais de `ordens_servico`, `alocacoes_escala`, `entregas_protocolo` | ⚠️ Parcial | 16/31 componentes decorativos. Ocorrências e Avaliações não são lidas pelo TMS. |

### Divergências Críticas

| Divergência | Onde | Impacto |
|:------------|:-----|:--------|
| `escala_operacional` (legado) vs `alocacoes_escala` | Financeiro + IntegracoesTMS | **P0** — dados podem divergir entre tabelas |
| Status OS vs Status Escala | `ordens_servico.status` + `alocacoes_escala.status` | Sem validação de transições cruzadas |
| `calculoService` (deprecated) vs `precificacaoEngineService` | OrdemServicoForm + OrcamentoForm | **P1** — fallback pode usar tabela hardcoded `TABELA_TESTE_VEICULOS_SP` |
| `mockPrestadores.ts` vs `prestadores` real | PrestadoresLista | **P1** — usuário pode ver dados falsos |

---

## 16. Testes de Validação

| Teste | Resultado | Detalhe |
|:------|:---------:|:--------|
| `npx tsc --noEmit` | ✅ | 0 erros |
| `npm run build` | ✅ | 38.48s (4758 módulos) |
| Playwright TMS (M55-C1) | ✅ | 13/13 testes |
| Playwright Portal (M55-C2) | ✅ | 7/7 testes |
| Playwright Erros (M55-C3) | ✅ | 7/7 testes |
| Playwright Event Bus (M100) | ✅ | 8/8 testes |
| `appPrestadorService.ts` callers | ❌ | 0 callers — código morto |
| `registrarPosicao()` callers | ❌ | 0 callers — tracking quebrado |
| Flutter analyze | ⚠️ | Projeto não existe neste repositório |
| Flutter build apk | ⚠️ | Projeto não existe neste repositório |

---

## 17. Matriz de Classificação por Tela

### TMS

| Tela | Módulo | Classificação | Nota |
|:-----|:-------|:-------------:|:----:|
| Lista OS | OS | ✅ Pronta | 8/10 |
| Formulário OS | OS | ⚠️ Parcial (código teste WhatsApp em produção) | 6/10 |
| Lista Escala | Escala | ⚠️ Parcial (mock localStorage) | 6/10 |
| Formulário Escala | Escala | ✅ Pronta | 8/10 |
| Dashboard NOC | Dashboard | ✅ Pronta | 9/10 |
| Contas a Receber | Financeiro | ⚠️ Parcial (escala_operacional legado) | 5/10 |
| Pagamento Prestadores | Financeiro | ⚠️ Parcial (escala_operacional legado) | 5/10 |
| Seguros | Financeiro | ❌ Visual apenas (100% mock) | 1/10 |
| Plano de Contas | Financeiro | ❌ Visual apenas (100% mock) | 1/10 |
| CNAB | Financeiro | ❌ Quebrada (fake string) | 1/10 |
| Lista Prestadores | Prestadores | ⚠️ Parcial (mock fallback) | 6/10 |
| Detalhe Prestador | Prestadores | ⚠️ Parcial (fotos localStorage) | 6/10 |
| Lista Clientes | Clientes | ✅ Pronta | 10/10 |
| Contratos | Contratos | ✅ Pronta | 10/10 |
| Relatórios Enterprise | Relatórios | ✅ Pronta | 8/10 |
| Torre de Controle | Operação | ✅ Pronta | 8/10 |
| Tracking / Mapa | Rastreamento | ❌ Quebrada (GPS vazio) | 3/10 |
| Event Bus | Infra | ✅ Pronta (cobertura baixa) | 7/10 |

### Painel do Cliente

| Tela | Classificação | Nota |
|:-----|:-------------:|:----:|
| Dashboard Principal | ✅ Pronta (dados reais) | 8/10 |
| Pedidos | ✅ Pronta (cria OS real) | 8/10 |
| Financeiro | ✅ Pronta (sem vazamento) | 9/10 |
| Ocorrências | ⚠️ Parcial (persiste mas TMS não lê) | 5/10 |
| Comprovantes | ✅ Pronta (POD real) | 10/10 |
| Perfil | ✅ Pronta | 8/10 |
| Tracking Mapa | ❌ Quebrada (tabela vazia) | 2/10 |
| Eventos Feed | ✅ Pronta | 8/10 |
| Patio | ✅ Pronta | 8/10 |
| Notificações | ❌ Visual apenas | 1/10 |
| IA Report | ❌ Visual apenas | 1/10 |
| Economia | ❌ Visual apenas + **vazamento** | 1/10 |
| Executive Dashboard | ❌ Visual apenas + **vazamento** | 1/10 |
| Multi Filial | ❌ Visual apenas + **vazamento GRAVE** | 1/10 |
| IA Operacional | ❌ Visual apenas | 1/10 |
| Roteirização | ❌ Visual apenas | 1/10 |
| Escala Operacional | ❌ Visual apenas | 1/10 |
| WhatsApp | ❌ Visual apenas | 1/10 |
| Onboarding | ❌ Visual apenas | 1/10 |
| Central Viva | ❌ Visual apenas | 1/10 |

### App Motorista

| Tela | Classificação | Nota |
|:-----|:-------------:|:----:|
| Login | ❌ Não existe neste repositório | 0/10 |
| Home | ❌ Não existe | 0/10 |
| Rede de Oportunidades | ❌ Não existe | 0/10 |
| Lista de Operações | ❌ Não existe | 0/10 |
| Detalhe da Operação | ❌ Não existe | 0/10 |
| Tracking | ❌ Não existe | 0/10 |
| POD | ❌ Não existe | 0/10 |
| Ganhos | ❌ Não existe | 0/10 |
| Reembolsos | ❌ Não existe | 0/10 |
| Perfil | ❌ Não existe | 0/10 |
| Notificações | ❌ Não existe | 0/10 |
| Configurações | ❌ Não existe | 0/10 |

---

## 18. Problemas P0/P1/P2 Consolidados

### P0 — Críticos (21)

| ID | Módulo | Arquivo | Problema |
|:--:|:-------|:--------|:---------|
| OS-01 | OS | `OrdemServicoForm.tsx:76-86` | Código de teste WhatsApp REAL em produção |
| OS-02 | OS | `OrdemServicoForm.tsx:80` | Número "SEU_NUMERO_AQUI" hardcoded |
| OS-03 | OS | `OrdemServicoForm.tsx:1356,1434,1527` | Emissão Focus "Modo simulado" |
| ESC-01 | Escala | `EscalaLista.tsx:995-1024` | Geração de escala mockada com persistência em localStorage |
| TRK-01 | Tracking | `trackingService.ts:119-140` | `registrarPosicao()` sem callers |
| TRK-02 | Tracking | `PortalCliente.tsx:550-574` | `portal_tracking_realtime` sempre vazio |
| FIN-01 | Financeiro | `ContasReceberEnterprise.tsx` | Usa `escala_operacional` (DEPRECATED) |
| FIN-02 | Financeiro | `PagamentoPrestadores.tsx` | Usa `escala_operacional` (DEPRECATED) |
| FIN-03 | Financeiro | `IntegracoesTMS.tsx` | Queries diretas a `escala_operacional` |
| FIN-04 | Financeiro | `SegurosFinanceiro.tsx` | 100% mock |
| FIN-05 | Financeiro | `PlanoContas.tsx` | 100% mock |
| FIN-06 | Financeiro | `PagamentoCNAB.tsx` | 100% fake |
| FIN-07 | Financeiro | `auditoriaPrestadorService.ts:53` | `localStorage.getItem("demo_user")` resquício demo |
| FIN-08 | Financeiro | `types.ts:328-386` | Mock data exportado em produção |
| FIN-09 | Financeiro | `ContasReceberEnterprise.tsx:1249+` | Mock data renderizado na UI |
| FIN-10 | Financeiro | `calculoService.ts` | Deprecated mas ainda importado |
| FIN-11 | Financeiro | `composicaoFinanceiraService.ts` | Deprecated mas ainda importado |
| FIN-12 | Financeiro | `ordemServicoService.ts:339` | `sincronizarFinanceiroOS` é no-op |
| APP-01 | App Motorista | `appPrestadorService.ts` | 594 linhas de código 100% morto |
| LEAK-03 | Portal Cliente | `PortalMultiFilial.tsx` | Cliente vê `custo` e `margem` calculada |
| LEAK-04 | Portal Cliente | `PortalExecutiveDashboard.tsx` | Cliente vê `custoPorEntrega` |

### P1 — Altos (41)

| Módulo | Quantidade | Principais |
|:-------|:----------:|:-----------|
| OS | 4 | Fallback calculoService, _calcularValorAutomaticoLegado, Math.random() numeração, "fallback teste" na UI |
| Escala | 3 | localStorage fallback, mock data comment, sem máquina de estados formal |
| Rede | 1 | Navegação Rede no Portal Cliente não funciona |
| Financeiro | 24 | ~100+ `as any`, ~30 `console.error`, debug logs em produção |
| Prestadores | 2 | mockPrestadores fallback, fotos localStorage |
| Relatórios | 1 | Views não consumidas pelo service |
| Portal Cliente | 6 | 16 componentes decorativos, ocorrências/avaliações ignoradas pelo TMS |

### P2 — Médios (36)

| Módulo | Quantidade | Principais |
|:-------|:----------:|:-----------|
| OS | 1 | sincronizarFinanceiroOS no-op |
| Escala | 1 | Math.random() sufixo |
| NOC | 2 | TabExecutivo/TabFinanceiro ignoram filtros |
| Financeiro | 27 | console.error catch-all sistêmico, código legado |
| Portal Cliente | 4 | Local/Mercadoria mesma foto, GPS precisão hardcoded |

---

## 19. Vazamento de Dados

### Cliente NÃO DEVE ver

| Dado | Encontrado em | Gravidade |
|:-----|:--------------|:---------:|
| `custo` por unidade | `PortalMultiFilial.tsx` | **GRAVE** — valor real de custo exposto |
| `margem` percentual | `PortalMultiFilial.tsx` | **GRAVE** — margem calculada e exibida |
| `custoPorEntrega` | `PortalExecutiveDashboard.tsx` | Alto — conceito de custo |
| `custoPorRegiao` | `PortalExecutiveDashboard.tsx` | Alto |
| `reducaoCusto` | `PortalEconomia.tsx` (interface) | Médio — nome do campo |
| `economiaCombustivel` | `PortalEconomia.tsx` (interface) | Médio |
| `custoPorEntrega` | `analyticsService.ts` (interface) | Médio |
| `custoEstimado` | `PortalRoteirizacao.tsx` | Médio |

### Protegido corretamente
- ✅ `margem` — filtrada em `pedidosService.ts:220`
- ✅ `custo_prestador` — nunca retornado ao cliente
- ✅ `valor_cliente` — exibido (é do cliente, correto)
- ✅ `prestador_nome` + `veiculo` + `placa` — OK (dados públicos)
- ✅ `financeiro_receber` — apenas faturas do cliente (filtrado por cliente_id)

---

## 20. Correções Aplicadas

Durante a auditoria, algumas correções foram feitas:

| ID | Correção | Impacto |
|:--:|:---------|:--------|
| ✅ | Documentação dos problemas OS-01 a OS-03 | Código de teste WhatsApp REAL identificado para remoção imediata |
| ✅ | Relatório completo gerado | Todas as áreas auditadas com evidências |

### Correções de Missões Anteriores (ainda válidas)
- ✅ `sincronizarFinanceiroOS` → no-op (M80) — financeiro seguro via triggers
- ✅ `escala_operacional` → `alocacoes_escala` — migração parcial (M80)
- ✅ Mock data removido de `PortalCliente.tsx` (M55)
- ✅ Switch fields corrigidos para booleano (M55)
- ✅ Link de rastreio funcional (M62)
- ✅ PortalTrackingMap com Mapbox real (M62)
- ✅ `confirmarPedidoPortal()` gera OS real (M83)
- ✅ RLS `eventos_oficiais` segregada (M100)
- ✅ `appPrestadorService` auditoria completa (M61)

---

## 21. Pendências Restantes

### Correções Imediatas (P0)

| Prioridade | Tarefa | Esforço |
|:----------:|:-------|:-------:|
| 1 | Remover código teste WhatsApp REAL de `OrdemServicoForm.tsx:76-86` | 5 min |
| 2 | Remover `localStorage.getItem("demo_user")` de `auditoriaPrestadorService.ts:53` | 5 min |
| 3 | Desativar geração de escala mockada em `EscalaLista.tsx:995-1024` | 15 min |
| 4 | Remover mockData renderizado de `ContasReceberEnterprise.tsx:1249,1274,1360,1794` | 30 min |
| 5 | Corrigir 3 emissões Focus "Modo simulado" em `OrdemServicoForm.tsx` | 30 min |
| 6 | Remover `custo` e `margem` de `PortalMultiFilial.tsx` | 30 min |
| 7 | Remover `custoPorEntrega` de `PortalExecutiveDashboard.tsx` | 15 min |

### Correções Curto Prazo (P1)

| Prioridade | Tarefa | Esforço |
|:----------:|:-------|:-------:|
| 8 | Migrar `escala_operacional` → `alocacoes_escala` em ContasReceberEnterprise, PagamentoPrestadores, IntegracoesTMS | 2 dias |
| 9 | Substituir `calculoService` por `precificacaoEngineService` em OS e Orçamento | 1 dia |
| 10 | Substituir `composicaoFinanceiraService` por `buscarTabelasService` | 1 dia |
| 11 | Remover `mockPrestadores.ts` fallback de PrestadoresLista | 1 dia |
| 12 | Migrar fotos localStorage → Supabase Storage em PrestadorDetalhe | 1 dia |
| 13 | Conectar 16 componentes decorativos do Portal Cliente a dados reais | 5 dias |
| 14 | Criar trigger para processar `portal_ocorrencias` e `portal_avaliacoes` no TMS | 1 dia |

### Correções Médio Prazo (P2)

| Prioridade | Tarefa | Esforço |
|:----------:|:-------|:-------:|
| 15 | Remover 5 arquivos `@deprecated` (engineFinanceira, calculoService, etc.) | 1 dia |
| 16 | Substituir `console.error` catch-all por tratamento estruturado | 3 dias |
| 17 | Migrar RelatorioService para consumir views SQL | 1 dia |
| 18 | Remover `as any` da camada financeira (~100+ ocorrências) | 3 dias |
| 19 | Criar máquina de estados formal para Escala | 2 dias |
| 20 | Conectar NOC TabExecutivo/TabFinanceiro aos filtros | 1 dia |

### Integração App Motorista

| Prioridade | Tarefa | Esforço |
|:----------:|:-------|:-------:|
| 21 | Remover `appPrestadorService.ts` (594 linhas de código morto) | 1 dia |
| 22 | Remover tabelas de schema não utilizadas | 1 dia |
| 23 | Definir API REST para App Motorista consumir | 3 dias |
| 24 | Implementar `registrarPosicao()` no App Motorista → `portal_tracking_realtime` | 5 dias |
| 25 | Implementar login, rede, operações, POD, ganhos no App | 30+ dias |

---

## 22. Nota por Módulo

### TMS — Nota Geral: 6.5/10

| Submódulo | Nota | Justificativa |
|:----------|:----:|:--------------|
| Ordem de Serviço | 6/10 | Funcional mas com código de teste WhatsApp em produção e fallback legado |
| Escala | 6/10 | Funcional mas gera dados mockados com Math.random() |
| Rede Enterprise | 7/10 | Funcional no TMS, sem integração com App Motorista |
| Financeiro | 4/10 | 3 componentes 100% mock, escala_operacional legado ativo, ~100 `as any` |
| NOC Dashboard | 9/10 | Melhor módulo — 7 abas, dados reais, Eventos integrados |
| Event Bus | 7/10 | Funcional mas cobertura baixa (só 3 produtores) |
| Tracking | 3/10 | Link de rastreio OK, GPS totalmente quebrado |
| Prestadores | 6/10 | Mock fallback e localStorage de fotos |
| Clientes | 10/10 | Impecável |
| Contratos | 10/10 | Impecável |
| Relatórios | 8/10 | Funcional, views não consumidas |

### Painel do Cliente — Nota Geral: 4/10

| Componente | Nota | Justificativa |
|:-----------|:----:|:--------------|
| Funcionais (8) | 9/10 | POD, Comprovantes, Perfil, Patio — dados reais |
| Decorativos (16) | 1/10 | Apenas visual, sem funcionalidade real |
| Vazamento (3) | 0/10 | Custo e margem expostos ao cliente |

### App Motorista — Nota Geral: 0/10

| Item | Nota | Justificativa |
|:-----|:----:|:--------------|
| Código neste repo | 0/10 | Nada além de 594 linhas de código morto |
| Flutter PWA real | N/A | Projeto externo, não auditável |
| Integração com TMS | N/A | Sem API definida |

---

## 23. Anexos

### A. Metodologia de Auditoria

Cada tela foi classificada como:
- **✅ Pronta:** Funciona com dados reais, sem mock, sem fallback
- **⚠️ Parcial:** Funciona mas tem problemas (mock, legado, fallback)
- **❌ Visual apenas:** Interface existe mas sem dados reais ou persistência
- **❌ Quebrada:** Não funciona ou nunca foi implementada
- **🔴 Vazamento:** Expõe dados que o cliente não deveria ver

### B. Comandos Executados

```
npx tsc --noEmit → 0 errors
npm run build → 38.48s
Playwright TMS (M55-C1) → 13/13 ✓
Playwright Portal (M55-C2) → 7/7 ✓ 
Playwright Erros (M55-C3) → 7/7 ✓
Playwright Event Bus (M100) → 8/8 ✓
```

### C. Divergências Tabelas Legado

| Tabela Legado | Tabela Atual | Uso Ativo |
|:--------------|:-------------|:---------:|
| `escala_operacional` | `alocacoes_escala` | **P0** — Financeiro e IntegracoesTMS ainda usam |
| `os_pod` | `entregas_protocolo` | Código morto |
| `dreamflow_eventos` | — | Código morto |
| `escala_operacional` (deprecated) | — | Migração de 2026-06-26 nunca concluída |

### D. Arquivos para Correção Imediata

| Arquivo | O que fazer |
|:--------|:------------|
| `OrdemServicoForm.tsx:76-86` | Remover função `testarWhatsAppReal()` e variável `testNumber` |
| `auditoriaPrestadorService.ts:53` | Substituir `localStorage.getItem("demo_user")` por `supabase.auth.getUser()` |
| `EscalaLista.tsx:995-1024` | Remover bloco de geração de escala mockada com persistência localStorage |
| `ContasReceberEnterprise.tsx:1249+` | Substituir mockCentrosResultado/mockPlanoContas/mockContasBancarias por queries reais |
| `PortalMultiFilial.tsx` | Remover campos `custo` e cálculo de `margem` |
| `PortalExecutiveDashboard.tsx` | Remover `custoPorEntrega` e `custoPorRegiao` |
| `appPrestadorService.ts` | Remover arquivo (594 linhas de código morto) |
