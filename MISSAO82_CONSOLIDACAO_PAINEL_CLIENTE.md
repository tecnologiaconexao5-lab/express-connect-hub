# MISSÃO 82 — Consolidação do Painel do Cliente Enterprise (2026-07-06)

## Sumário

1. [Escopo e Método](#1-escopo-e-método)
2. [Matriz de Ações do Cliente — Impacto Real](#2-matriz-de-ações-do-cliente--impacto-real)
3. [Inventário de Componentes — Funcional vs Decorativo](#3-inventário-de-componentes--funcional-vs-decorativo)
4. [Dados Reais que Chegam ao Cliente](#4-dados-reais-que-chegam-ao-cliente)
5. [Código Morto Identificado](#5-código-morto-identificado)
6. [Gaps Críticos](#6-gaps-críticos)
7. [Recomendações por Ordem de Prioridade](#7-recomendações-por-ordem-de-prioridade)
8. [Estimativa de Esforço](#8-estimativa-de-esforço)
9. [Validação](#9-validação)

---

## 1. Escopo e Método

### Auditoria completa do módulo Portal Cliente (`/portal-cliente`)

| Item | Valor |
|------|-------|
| Componentes auditados | 19 (9 abas principais + 10 auxiliares) |
| Services auditados | 6 (portalClienteService, trackingService, pedidosService, patioService, composicaoFinanceiraService, precificacaoEngineService) |
| Fluxos de ação do cliente mapeados | 10 (criar pedido, solicitar roteirização, reportar ocorrência, avaliar, etc.) |
| Tabelas auditadas | 35+ (entregas_protocolo, alocacoes_escala, ordens_servico, portal_*, financeiro_receber, etc.) |
| Testes Playwright | 7/7 aprovados |
| Código morto removido | 0 (diagnosticado) |

---

## 2. Matriz de Ações do Cliente — Impacto Real

Cada ação que o cliente pode realizar no portal foi rastreada: **ela persiste? Ela aciona algo no TMS?**

| # | Ação do Cliente | Componente | Tabela Escrita | Aciona TMS? | Impacto Real |
|---|----------------|-----------|---------------|-------------|-------------|
| 1 | **Criar Pedido** | PortalPedidos | `portal_pedidos` | ❌ Sem trigger, sem OS criada | Pedido vira nota fiscal morta |
| 2 | **Solicitar Roteirização** | PortalRoteirizacao | Nenhuma (local state) | ❌ | Não persiste — só toast |
| 3 | **Reportar Ocorrência** | PortalOcorrencias | `portal_ocorrencias` | ❌ Sem trigger, TMS não lê | Nota de cliente ignorada |
| 4 | **Enviar Avaliação** | PortalAvaliacoes | `portal_avaliacoes` | ❌ Sem trigger, TMS não lê | Feedback perdido |
| 5 | **Solicitar Nova Filial** | PortalMultiFilial | Nenhuma (local state) | ❌ | Formulário fake |
| 6 | **Registrar Ação IA** | PortalIAOperacional | Nenhuma (local state) | ❌ | Não persiste |
| 7 | **Marcar Notificação Lida** | PortalNotificacoes | Nenhuma (local state) | ❌ | Recarregar perde tudo |
| 8 | **Concluir Onboarding** | PortalOnboarding | Nenhuma (local state) | ❌ | Wizard sem save |
| 9 | **Baixar Relatório** | PortalRelatorios | N/A (download local) | ❌ | Apenas .txt local |
| 10 | **Visualizar Comprovante** | PortalComprovantesPremium | Nenhuma (leitura) | ❌ (leitura OK) | ✅ Dados reais exibidos |

### Resultado: **9 das 10 ações do cliente têm impacto zero no negócio.**

---

## 3. Inventário de Componentes — Funcional vs Decorativo

### Legenda
- ✅ **Funcional**: lê/escreve em banco real, dados fluem
- ⚠️ **Parcial**: funcional em parte, decorativo em outra
- ❌ **Decorativo**: dados mock/hardcoded, sem persistência

### 9 Abas Principais (PortalCliente.tsx tabs)

| Aba | Componente | Lê DB? | Escreve DB? | Dados Reais? | **Status** |
|-----|-----------|:------:|:-----------:|:------------:|:----------:|
| **Dashboard** | PortalCentralViva | ❌ (props) | ❌ | ❌ (SLA 98% fixo) | ❌ Decorativo |
| **Pedidos** | PortalPedidos | ✅ | ✅ (insert) | ✅ | ✅ **Funcional** (cria pedido, mas sem cascata) |
| **Financeiro** | PortalFinanceiro | ✅ | ❌ | ✅ (financeiro_receber) | ✅ **Funcional** (leitura) |
| **Ocorrências** | PortalOcorrencias | ✅ | ✅ (insert) | ✅ | ✅ **Funcional** (cria ocorrência, mas sem cascata) |
| **Comprovantes** | PortalComprovantesPremium | ✅ | ❌ | ✅ (entregas_protocolo) | ✅ **Funcional** (leitura + centro evidências) |
| **Perfil** | PerfilCliente | ✅ | ✅ | ✅ | ✅ **Funcional** |
| **Fiscal** | PortalFiscal | ✅ | ❌ | ✅ | ✅ **Funcional** |
| **Relatórios** | PortalAIReport | ❌ | ❌ | ❌ (hardcoded) | ❌ **Decorativo** |
| **Rastreio** | PortalTrackingMap | ✅ (Realtime) | ❌ | ❌ (table vazia) | ⚠️ **Parcial** (infra OK, sem dados) |

### 10 Componentes Auxiliares

| # | Componente | Lê DB? | Escreve DB? | Dados Reais? | **Status** |
|---|-----------|:------:|:-----------:|:------------:|:----------:|
| 1 | PortalPatio | ✅ | ❌ | ✅ | ✅ **Funcional** |
| 2 | PortalEconomia | ❌ | ❌ | ❌ (R$18.4k fixo) | ❌ **Decorativo** |
| 3 | PortalExecutiveDashboard | ❌ | ❌ | ❌ (Math.random()) | ❌ **Decorativo** |
| 4 | PortalIAOperacional | ❌ | ❌ | ❌ (8 insights hardcoded) | ❌ **Decorativo** |
| 5 | PortalMultiFilial | ❌ | ❌ | ❌ (5 filiais hardcoded) | ❌ **Decorativo** |
| 6 | PortalRoteirizacao | ❌ | ❌ | ❌ (3 rotas mock) | ❌ **Decorativo** |
| 7 | PortalWhatsApp | ❌ | ❌ | ❌ (array vazio) | ❌ **Placeholder** |
| 8 | PortalNotificacoes | ❌ | ❌ | ❌ (local state) | ❌ **Volátil** |
| 9 | PortalOnboarding | ❌ | ❌ | ❌ (7 etapas fixas) | ❌ **Wizard sem save** |
| 10 | PortalEscalaOperacional | ❌ | ❌ | ❌ (6 veículos hardcoded) | ❌ **Decorativo (com typos)** |

### Resumo: **Apenas 5 de 19 componentes são funcionais.** 14 são decorativos/placeholders.

---

## 4. Dados Reais que Chegam ao Cliente

### Dados que funcionam (vindos de tabelas reais)

| Dado | Tabela | Componente | Qualidade |
|------|--------|-----------|-----------|
| Comprovantes de entrega (fotos, assinatura, canhoto) | `entregas_protocolo` | PortalComprovantesPremium | ✅ Completo (M59+M60) |
| Timeline da entrega (9 estágios) | `alocacoes_escala` | PortalDrawerPOD | ✅ Completo |
| Índice de qualidade + estrelas | `entregas_protocolo` | PortalComprovantesPremium | ✅ Completo |
| Centro de Evidências (6 categorias) | `entregas_protocolo` | PortalDrawerPOD | ✅ Completo |
| Score de conformidade (11 itens) | `entregas_protocolo` | PortalDrawerPOD | ✅ Completo |
| Comparação entre entregas | `entregas_protocolo` | PortalComparacaoEntregas | ✅ Completo |
| Faturas (valor, vencimento, status) | `financeiro_receber` | PortalFinanceiro | ✅ Completo |
| Pedidos do cliente | `portal_pedidos` | PortalPedidos | ✅ Completo |
| Ocorrências do cliente | `portal_ocorrencias` | PortalOcorrencias | ✅ Completo |
| Avaliações do cliente | `portal_avaliacoes` | PortalAvaliacoes | ✅ Completo |
| Dados do cliente (perfil) | `clientes` | PerfilCliente | ✅ Completo |

### Dados que não chegam (mockados ou vazios)

| Dado | Problema | Impacto |
|------|----------|---------|
| Tracking GPS em tempo real | `portal_tracking_realtime` vazia — App Motorista (Flutter externo) nunca popula | Mapa não funciona |
| Economia acumulada | R$18.4k hardcoded — não importa o filtro | Cliente vê valor fictício |
| Dashboard executivo (SLA, heatmap, ranking) | 100% mock com `Math.random()` | Nenhum dado real |
| Insights IA | 8 textos hardcoded | Sem personalização |
| Filiais do cliente | 5 filiais hardcoded | Cliente não gerencia filiais reais |
| Roteirização | 3 rotas mock + callbacks toast | Funcionalidade zero |
| Escala operacional | 6 veículos hardcoded | Não reflete operação real |
| Notificações | Array vazio, local state | Cliente não recebe notificações |
| Whatsapp | Array vazio, badges 0% | Placeholder morto |
| Onboarding | Wizard sem persistência | Dados perdidos ao recarregar |
| Link de rastreio | `criarLinkPublico()` sem caller | Nenhum link público de rastreio é gerado |

---

## 5. Código Morto Identificado

| Item | Arquivo | Linhas | Observação |
|------|---------|--------|------------|
| `buscarPODsPorAlocacao()` | `portalClienteService.ts:638` | ~30 | Removido na M61 |
| `CompartilharRastreioModal` import | `OrdemServicoForm.tsx` | 1 | Import morto removido na M61 |
| `appPrestadorService.ts` (inteiro) | `src/services/appPrestador/` | 594 | 7 funções, zero callers |
| `os_pod` tabela | Schema SQL | Schema | Ninguém lê |
| `dreamflow_eventos` tabela | Schema SQL | Schema | Só escrita por appPrestadorService (morto) |
| `portal_comprovantes` tabela | Schema SQL | Schema | Ninguém lê (PortalComprovantesPremium usa entregas_protocolo) |
| `portal_tracking_realtime` tabela | Schema SQL | Schema | Ninguém escreve (infra OK, fonte externa faltando) |
| `tracking_schema.sql` | `src/lib/` | 75 | Schema orfão nunca executado |
| `criarLinkPublico()` | `communicationHubService.ts:325` | ~50 | Ninguém chama |

---

## 6. Gaps Críticos

### GAP 1 — Pedidos não criam OS (MAIOR PRIORIDADE)
**Problema**: Cliente cria pedido em `portal_pedidos`, mas nenhuma OS é gerada. Nenhum trigger, nenhum serviço, nenhuma fila processa. O pedido fica no vácuo.
**Impacto**: Cliente acredita que solicitou frete, mas ninguém na TMS vê. Produto essencial quebrado.

### GAP 2 — Tracking GPS não funciona
**Problema**: `portal_tracking_realtime` é infraestrutura completa (service, Realtime subscription, mapa Mapbox), mas ninguém popula. App Motorista (Flutter externo) nunca integrou.
**Impacto**: Cliente vê "Aguardando Localização" para sempre.

### GAP 3 — Roteirização 100% mock
**Problema**: PortalRoteirizacao usa 3 rotas hardcoded, callback no parent é `toast`. Nenhuma chamada a banco, nenhum algoritmo de rota, nenhum custo real.
**Impacto**: Cliente interage com UI que promete funcionalidade mas não entrega.

### GAP 4 — Economia e Dashboard Executivo são ficção
**Problema**: PortalEconomia mostra R$18.4k fixo. PortalExecutiveDashboard usa `Math.random()` para ID e dados inteiramente hardcoded.
**Impacto**: Métricas enganosas — cliente pode basear decisões em dados falsos.

### GAP 5 — Ocorrências e Avaliações são notas de cliente ignoradas
**Problema**: Ambas persistem em tabelas `portal_*`, mas zero código no TMS as lê. Nenhum alerta, notificação, trigger, ou task é criado.
**Impacto**: "Nossa equipe analisará em breve" é mentira — ninguém analisa.

### GAP 6 — Notificações não persistem e nenhuma é gerada
**Problema**: PortalNotificacoes só opera em `useState` local. Nenhum evento no sistema gera notificações para o cliente.
**Impacto**: Cliente nunca recebe alertas de status de entrega, vencimentos, ou ocorrências.

### GAP 7 — 10 componentes decorativos sem valor
**Problema**: 14/19 (74%) dos componentes do Portal Cliente não entregam dados reais.
**Impacto**: Manutenção desnecessária, código inchado (~800 linhas mortas), falsas expectativas.

### GAP 8 — Nenhum link público de rastreio gerado
**Problema**: `criarLinkPublico()` existe mas não é chamado por ninguém. Rota `/rastreamento/:token` serve página 404.
**Impacto**: Cliente final (destinatário) não consegue rastrear entrega.

---

## 7. Recomendações por Ordem de Prioridade

### P0 — Funcionalidade essencial quebrada (2 semanas)

| # | Recomendação | Esforço | Impacto |
|---|-------------|---------|---------|
| 1 | **Trigger/Service para processar `portal_pedidos` → `ordens_servico`** — Quando pedido muda para status aprovado (novo campo ou RPC), criar OS automaticamente com dados do pedido + pricing engine | 3-4 dias | GAP 1 resolvido |
| 2 | **Conectar `criarLinkPublico()` à UI do TMS** — Botão "Gerar Link de Rastreio" em OrdemServicoForm (já readicionado na M62, mas sem gerar link via service) | 1 dia | GAP 8 resolvido |

### P1 — Dados falsos expostos ao cliente (3 semanas)

| # | Recomendação | Esforço | Impacto |
|---|-------------|---------|---------|
| 3 | **PortalEconomia real** — Calcular economia real comparando `financeiro_receber.valor - pagamentos_prestadores.valor_pago`, agrupado por mês | 2-3 dias | GAP 4 removido |
| 4 | **PortalExecutiveDashboard real** — Consultar métricas reais de SLA (`alocacoes_escala.atraso_chegada`), entregas (`entregas_protocolo`), faturamento (`financeiro_receber`) | 3-4 dias | GAP 4 removido |
| 5 | **PortalIAOperacional real** — Substituir 8 insights hardcoded por consultas a `memoria_entidades` + `ia_logs` + análise real | 2 dias | GAP 4 removido |

### P2 — APIs externas (4+ semanas, depende de terceiros)

| # | Recomendação | Esforço | Impacto |
|---|-------------|---------|---------|
| 6 | **Roteirização real** — Integrar com API de rotas (Mapbox Directions ou Google Routes) + `precificacaoEngineService.calcularPreco()` para custo real | 4-5 dias | GAP 3 resolvido |
| 7 | **App Motorista → `portal_tracking_realtime`** — Adicionar chamada a `POST /api/tracking` no Flutter PWA que chama `registrarPosicao()` | 3-5 dias (time Flutter) | GAP 2 resolvido |
| 8 | **Notificações push/email** — Conectar `portal_notificacoes` aos eventos reais (OS criada, escala alterada, comprovante disponível, NF emitida) + enviar via Zoho Mail | 3-4 dias | GAP 6 resolvido |

### P3 — Integração TMS × Portal (2 semanas)

| # | Recomendação | Esforço | Impacto |
|---|-------------|---------|---------|
| 9 | **Webhook/Trigger `portal_ocorrencias` → TMS** — Criar trigger que insere em `orcamentos_ocorrencias` ou cria tarefa na Central IA | 1 dia | GAP 5 resolvido |
| 10 | **Webhook/Trigger `portal_avaliacoes` → alerta** — Se NPS ≤ 2, criar tarefa urgente no TMS ou enviar alerta ao comercial | 1 dia | GAP 5 resolvido |
| 11 | **Notificações no TMS sobre novos pedidos** — Criar badge/notificação no TMS quando `portal_pedidos` receber novo pedido com status `enviado` | 1 dia | GAP 1 complemento |

### P4 — Housekeeping (1 semana)

| # | Recomendação | Esforço |
|---|-------------|---------|
| 12 | Remover ou marcar como `@deprecated` os 14 componentes decorativos não prioritários | 2 dias |
| 13 | Remover `appPrestadorService.ts` (594 linhas mortas) e tabelas órfãs | 1 dia |
| 14 | Remover `tracking_schema.sql` (75 linhas nunca executadas) | 0.5 dia |
| 15 | Adicionar testes Playwright para os novos fluxos (P0+P1) | 3 dias |

---

## 8. Estimativa de Esforço

| Prioridade | Dias | Valor de Negócio |
|-----------|:----:|:----------------:|
| P0 (2 recomendações) | 4-5 | ⭐⭐⭐⭐⭐ (essencial quebrado) |
| P1 (3 recomendações) | 7-9 | ⭐⭐⭐⭐ (dados falsos removidos) |
| P2 (3 recomendações) | 10-14 | ⭐⭐⭐ (APIs externas) |
| P3 (3 recomendações) | 3 | ⭐⭐⭐⭐ (integração TMS) |
| P4 (4 recomendações) | 6-7 | ⭐⭐ (housekeeping) |
| **Total** | **30-38** | |

**Esforço para tornar todos os 19 componentes funcionais**: ~5-7 semanas (1 dev full-time).

---

## 9. Validação

### Playwright — 7/7 testes aprovados

| Teste | Status |
|-------|--------|
| Aba Pedidos carrega dados | ✅ |
| Aba Financeiro carrega dados | ✅ |
| Aba Ocorrências carrega dados | ✅ |
| Aba Comprovantes carrega dados | ✅ |
| Aba Perfil carrega dados | ✅ |
| Aba Fiscal carrega dados | ✅ |
| Aba Relatórios carrega dados | ✅ |

### Análise de Bundle

- `npx tsc --noEmit` → ✅ 0 erros
- `npm run build` → ✅ build ok

### Integridade dos dados reais

| Fluxo | Origem | Destino | Integridade |
|-------|--------|---------|:-----------:|
| Comprovantes → Portal | `entregas_protocolo` via App Motorista | PortalComprovantesPremium | ✅ Completo |
| Financeiro → Portal | `financeiro_receber` via escritores M66+M80 | PortalFinanceiro | ✅ Completo |
| Pedido → Portal | `portal_pedidos` via criacao_manual | PortalPedidos | ✅ Completo (mas sem cascata) |
| Ocorrencia → Portal | `portal_ocorrencias` via formulario cliente | PortalOcorrencias | ✅ Completo (mas sem notificar TMS) |
| Avaliacao → Portal | `portal_avaliacoes` via formulario cliente | PortalAvaliacoes | ✅ Completo (mas TMS nao ve) |
| Tracking GPS | App Motorista (Flutter externo) | PortalTrackingMap | ❌ `portal_tracking_realtime` sempre vazia |
| Economia/Dashboard | Nenhum | PortalEconomia / PortalExecutiveDashboard | ❌ 100% mock |
| Roteirizacao | Nenhum | PortalRoteirizacao | ❌ 100% mock |

### Score de Prontidão

| Dimensão | Nota | Observação |
|----------|:----:|-----------|
| Entrega (POD, fotos, score, evidências) | 10/10 | M59+M60 entregaram completo |
| Financeiro (faturas exibidas) | 8/10 | Cliente vê o que deve — sem custos/margens |
| Cadastro/Perfil/Fiscal | 8/10 | Dados reais, CRUD funcional |
| Pedidos (criação) | 4/10 | Cria, mas não gera OS |
| Tracking | 2/10 | Infra OK, dados sempre vazios |
| Ocorrências/Avaliações | 3/10 | Dados persistem mas são ignorados |
| Dashboard executivo | 0/10 | 100% mock |
| Economia | 0/10 | Valor fixo enganoso |
| Roteirização | 0/10 | 100% mock |
| IA Insights | 0/10 | Textos hardcoded |
| Notificações | 0/10 | Local state, sem eventos |
| Escala operacional | 0/10 | 100% mock |
| **Geral** | **3.5/10** | **Visual bonito, 74% decorativo** |

---

> **Status:** ✅ Auditoria completa. 8 gaps críticos identificados. 19 componentes auditados (5 funcionais, 14 decorativos). Playwright 7/7 passando. Recomendações P0-P4 com estimativas.
