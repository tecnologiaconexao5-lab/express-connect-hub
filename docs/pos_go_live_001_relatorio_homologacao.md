# PÓS GO-LIVE 001 — Relatório de Homologação Operacional

**Data:** 2026-08-01 | **Ambiente:** PRODUÇÃO (uwrvzsjtpgaifkktpepn.supabase.co)  
**Base:** 92 ✅ | 1 ❌ | 17 ⚠️ | **Status:** 🟡 HOMOLOGAÇÃO PARCIAL

---

## Sumário

1. [Resumo Executivo](#1-resumo-executivo)
2. [Score de Prontidão por Etapa](#2-score-de-prontidão-por-etapa)
3. [Detalhamento por Etapa do Fluxo](#3-detalhamento-por-etapa-do-fluxo)
4. [Falha Crítica — Cancel Trigger Ausente](#4-falha-crítica)
5. [Riscos e Warnings](#5-riscos-e-warnings)
6. [Recomendações](#6-recomendações)

---

## 1. Resumo Executivo

A homologação operacional ponta a ponta foi realizada contra PRODUÇÃO. **A infraestrutura (tabelas, triggers, RPCs, RLS) está sólida — 92/92 verificações de schema aprovadas.** No entanto, os dados reais revelam gaps operacionais significativos:

| Dimensão | Nota | Status |
|----------|:----:|:------:|
| Infraestrutura (tabelas, triggers, RPCs) | 10/10 | 🟢 |
| RLS / Segurança | 9/10 | 🟢 |
| Pedido → OS | 2/10 | 🔴 |
| Escala + Alocação | 5/10 | 🟡 |
| Aceite + Início (Prestador) | 4/10 | 🟡 |
| Tracking GPS | 1/10 | 🔴 |
| POD / Finalização | 3/10 | 🔴 |
| Financeiro (Propagação) | 8/10 | 🟢 |
| Event Bus | 8/10 | 🟢 |
| **GERAL** | **5/10** | **🟡** |

**Veredito:** Sistema tem infraestrutura excelente mas dados operacionais de baixa qualidade. Necessário corrigir fluxo de conversão pedido→OS, captura de POD, e alimentação de tracking antes de considerar "GO LIVE OPERACIONAL".

---

## 2. Score de Prontidão por Etapa

### Etapas 1-2: Portal Pedidos → portal_pedidos (🔴 2/10)

| Item | Resultado |
|------|:---------:|
| Tabela portal_pedidos existe | ✅ |
| Coluna os_vinculada_id | ✅ |
| Trigger trg_evento_portal_pedido_criado | ✅ |
| RPC gerar_numero_pedido | ✅ |
| **Dados: 9 pedidos criados** | ✅ |
| **Dados: Apenas 1/9 convertido em OS** | ❌ |
| 8 pedidos em "enviado" — nunca confirmados | ❌ |
| Fluxo auto-confirm não disparou | ❌ |

**Problema:** O frontend `PortalCliente.tsx` chama `confirmarPedidoPortal()` após criar pedido, mas 8/9 pedidos não passaram por essa etapa. Possível causa: criação por script de teste que só fez INSERT direto em `portal_pedidos`, sem chamar `confirmarPedidoPortal()`.

### Etapa 3: Pedido → OS (🔴 3/10)

| Item | Resultado |
|------|:---------:|
| RPC converter_pedido_para_os existe | ✅ |
| RPC retorna JSONB com success/ordem_servico_id | ✅ |
| Trigger trg_evento_os_criada | ✅ |
| Trigger trg_evento_os_finalizada | ✅ |
| OS criada vincula pedido_portal_id | ✅ |
| **1 OS de pedido convertido com sucesso** | ✅ |
| Evento `portal.order.converted_to_service_order` (1 evento) | ✅ |
| **8 pedidos sem conversão — gap crítico** | ❌ |

### Etapas 4-5: Escala + Alocação (🟡 5/10)

| Item | Resultado |
|------|:---------:|
| Tabela alocacoes_escala com todas as colunas | ✅ |
| Trigger trg_propagar_financeiro_alocacao (EXCEPTION + ON CONFLICT) | ✅ |
| Trigger trg_evento_prestador_aceitou | ✅ |
| Trigger trg_evento_operacao_finalizada | ✅ |
| **176 alocações totais** | ✅ |
| **113/176 (64%) sem OS vinculada** | ❌ |
| 66 alocações em "aguardando_aceite" — nunca aceitas | ⚠️ |
| 53 concluídas, 34 planejadas, 11 em_rota, 6 aceitas, 4 canceladas | — |
| 89/172 com valor_frete > 0 | ✅ |

### Etapa 6-7-8: Prestador Aceita, Inicia, Finaliza (🟡 4/10)

| Item | Resultado |
|------|:---------:|
| aceite_prestador, data_aceite, horario_inicio_real, horario_fim_real existem | ✅ |
| 46 alocações aceitas | ✅ |
| 7 eventos `escala.alocacao.aceita` | ✅ |
| 18 alocações com horario_inicio_real | ⚠️ |
| 8 alocações com horario_fim_real | ❌ |
| 46 alocações aceitas mas apenas 7 eventos de aceite | ❌ |
| **Muitas alocações com dados de finalização ausentes** | ❌ |

### Etapa 9: Tracking GPS (🔴 1/10)

| Item | Resultado |
|------|:---------:|
| Tabela portal_tracking_realtime com todas as colunas | ✅ |
| RPC registrar_posicao_motorista existe | ✅ |
| Trigger trg_tracking_iniciado | ✅ |
| Trigger trg_atualizar_status_alocacao_tracking | ✅ |
| 6 RLS policies | ✅ |
| **Apenas 2 pontos de GPS — 1 alocação** | ❌ |
| 0 pontos com captured_at (timestamp do aparelho) | ❌ |
| **App Motorista Flutter não está enviando GPS** | ❌ |
| Nenhum dado de tracking utilizável para o Portal Cliente | ❌ |

### Etapa 10: POD / Entregas Protocolo (🔴 3/10)

| Item | Resultado |
|------|:---------:|
| Tabela entregas_protocolo com todas as colunas | ✅ |
| 44 registros de POD | ✅ |
| **Apenas 3 das 53 alocações concluídas têm POD** | ❌ |
| 50/53 concluídas sem nome_recebedor, sem foto, sem assinatura | ❌ |
| Muitas alocações concluídas sem dados reais de finalização | ❌ |

### Etapas 12-13: Financeiro + Pagamento (🟢 8/10)

| Item | Resultado |
|------|:---------:|
| Trigger propagação financeira com EXCEPTION + ON CONFLICT | ✅ |
| Fórmula unificada (outros_custos = adicionais + ajudante - descontos) | ✅ |
| Inclui reversa nos totais | ✅ |
| Calcula margens (bruta/líquida) | ✅ |
| UNIQUE(os_id) em todas as tabelas financeiras | ✅ |
| 85 financeiro_receber (R$ 163.720,25) | ✅ |
| 78 financeiro_pagar (R$ 65.989,00) | ✅ |
| 54 composicao_financeira_os (margem média 15,78%) | ✅ |
| Alocações canceladas sem financeiro órfão | ✅ |
| **Status:** Propagação funcionando com dados reais | ✅ |

### Event Bus (🟢 8/10)

| Item | Resultado |
|------|:---------:|
| Tabela eventos_oficiais existe e populada | ✅ |
| 155 eventos, 13 tipos diferentes | ✅ |
| Cobertura: pedido, OS, alocação, aceite, conclusão, tracking, POD | ✅ |
| Tipos mais frequentes: escala.alocacao.criada (46), financeiro.receber.criado (35) | ✅ |
| Tracking.iniciado: apenas 2 eventos | ⚠️ |
| **Gap:** Nenhum consumidor de eventos implementado (são apenas produtores) | ⚠️ |

---

## 4. Falha Crítica

### 🔴 `trg_cancelar_financeiro_escala` AUSENTE

**O que falta:** O trigger `trg_cancelar_financeiro_escala` em `alocacoes_escala` não existe em produção. Ele deveria cancelar os registros financeiros (financeiro_receber, financeiro_pagar, pagamentos_prestadores) quando uma alocação é cancelada.

**O que existe no lugar:** `trg_evento_alocacao_cancelada` — que APENAS publica um evento no Event Bus, mas NÃO cancela o financeiro.

**Risco:** Se uma alocação com financeiro já propagado for cancelada, os registros financeiros ficam órfãos ("abertos" ou "pendentes"). Atualmente 4 alocações canceladas — nenhuma com financeiro ativo (por sorte, não por proteção).

**Localização original:** `supabase/migrations/20260626_missao021_fechamento_financeiro.sql` (M021)

---

## 5. Riscos e Warnings

| ID | Severidade | Descrição | Impacto |
|:--:|:----------:|-----------|---------|
| W1 | 🟡 | 8/9 portal_pedidos em "enviado" sem conversão | Fluxo de criação de pedido incompleto |
| W2 | 🟡 | 113/176 alocações sem OS vinculada | Rastreabilidade operacional quebrada |
| W3 | 🟡 | 66 alocações "aguardando_aceite" nunca processadas | Prestadores podem não estar vendo alocações |
| W4 | 🟡 | 50/53 concluídas sem POD | Entrega sem comprovação documental |
| W5 | 🔴 | Tracking: apenas 2 pontos GPS | App Motorista não envia posição |
| W6 | ⚠️ | M07: policies antigas "Allow all operations" em 7 tabelas fiscais | Risco de acesso irrestrito a dados fiscais |
| W7 | ⚠️ | 1 financeiro_pagar com status 'cancelada' mas valor R$ 999,00 | Pode ser registro órfão |
| W8 | ⚠️ | 1 financeiro_receber com status NULL | Registro inconsistente |
| W9 | ⚠️ | INSERT policies com qual=NULL em várias tabelas (comportamento normal) | Falso positivo — verificado como seguro |
| W10 | ⚠️ | Muitas alocações de 2026-06-29 a 2026-07-23 parecem ser carga de teste | Dados de homologação misturados com reais |

---

## 6. Recomendações

### 🔴 PRIORIDADE MÁXIMA — CORRIGIR EM PRODUÇÃO

1. **Criar trigger de cancelamento financeiro** — Aplicar função + trigger equivalente ao M021 para que alocações canceladas propaguem `status_pagamento='cancelado'` nas tabelas financeiras
2. **Corrigir fluxo de tracking** — App Motorista (Flutter) precisa chamar `registrar_posicao_motorista()` RPC
3. **Fluxo de confirmação de pedido** — Revisar `PortalCliente.tsx:1222` para garantir que `confirmarPedidoPortal()` é chamado após criação do pedido

### 🟡 PRIORIDADE ALTA

4. **Pipeline de carga de alocações sem OS** — Investigar origem das 113 alocações sem OS (App Motorista direto? Script de teste?)
5. **Fluxo de POD** — Garantir que `podService.finalizarComPOD()` está sendo chamado nas finalizações
6. **Auditar alocações "aguardando_aceite"** — 66 alocações paradas podem ser lixo operacional

### 🟢 MONITORAMENTO

7. **Criar dashboard de saúde do fluxo** — Métricas: pedidos convertidos/dia, alocações com OS, PODs capturados, pontos GPS/dia
8. **Configurar alertas** — Quando pedido ficar >1h em "enviado", ou alocação >24h em "aguardando_aceite"

---

## Apêndice: Mapa Fluxo → Tabela → Trigger → Service → Página

```
Etapa                    Tabela                Trigger                  Service/Função              Página/Componente
──────────────────────────────────────────────────────────────────────────────────────────────────────────────
1. Criar Pedido          portal_pedidos        trg_evento_pedido        criarPedidoPortal()         PortalCliente.tsx
2. Confirmar Pedido      portal_pedidos        —                        confirmarPedidoPortal()      PortalCliente.tsx
3. Converter → OS        ordens_servico        trg_evento_os_criada     RPC converter_pedido_para_os pedidosService.ts
4. Vincular OS→Escala    alocacoes_escala       trg_propagar_financeiro  sincronizarComEscala()       OrdemServicoForm.tsx
5. Prestador Aceita      alocacoes_escala       trg_evento_aceitou       aceitarAlocacao()            AppPrestador.tsx
6. Prestador Inicia      alocacoes_escala       —                        iniciarRota()                AppPrestador.tsx
7. Tracking GPS          portal_tracking_realtime trg_tracking_iniciado  RPC registrar_posicao       App Motorista (Flutter)
8. POD/Finaliza          entregas_protocolo     trg_evento_finalizada    finalizarComPOD()            podService.ts
9. Propaga Financeiro    financeiro_receber     trg_propagar_financeiro  trigger automático           (automático)
                         financeiro_pagar       trg_propagar_financeiro
                         pagamentos_prestadores trg_propagar_financeiro
10. Calcula Margem       composicao_financeira_os trg_propagar_financeiro trigger (só na conclusão)   (automático)
11. Portal Cliente lê    portal_pedidos         —                        portalClienteService         PortalCliente.tsx
                         alocacoes_escala       Realtime channel         portalClienteService
                         entregas_protocolo     —                        portalClienteService
                         portal_tracking_realtime Realtime channel       trackingService
```

---

*Relatório gerado em 2026-08-01 às 12:45 UTC. 92 verificações ✅, 1 falha ❌, 17 warnings ⚠️.*
