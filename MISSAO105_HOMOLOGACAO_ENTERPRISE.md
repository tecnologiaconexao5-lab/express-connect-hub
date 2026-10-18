# MISSÃO 105 — HOMOLOGAÇÃO OPERACIONAL ENTERPRISE (GO LIVE)

**Data:** 2026-07-09
**Auditor:** Missão 105 (QA Enterprise)
**Status:** ⚠️ **CONDICIONAL — 6.2/10**

---

## SUMÁRIO EXECUTIVO

O sistema está **funcional para operação real** no core (OS, Escala, Financeiro, Comprovantes, NOC), mas possui **7 gaps P0/P1** que precisam ser resolvidos antes do Go Live.

**Playwright:** 27/27 testes passam (M55-C1: 13, M55-C2: 7, M55-C3: 7).
**Build:** `npm run build` OK. `npx tsc --noEmit` 0 erros.

---

## 1. AUDITORIA COMPLETA — Integrações

### 1.1 Cliente → Pedido → OS → Escala → Alocação → Financeiro

| Etapa | Status | Evidência |
|-------|--------|-----------|
| Cliente cria pedido (Portal) | ✅ OK | `handleCriarPedido()` → `criarPedidoPortal()` → INSERT `portal_pedidos` |
| Pedido → OS | ✅ OK | M83: `confirmarPedidoPortal()` → `criarOrdemServico()` → INSERT `ordens_servico` |
| OS → Escala | ⚠️ PARCIAL | `OrdemServicoForm.tsx` chama `sincronizarComEscala()`. OS via Portal **não** cria alocação automática — TMS operador precisa alocar manualmente |
| Escala → Alocação | ✅ OK | `EscalaLista.tsx` → Edge Function `criar-alocacao-escala` → INSERT `alocacoes_escala` |
| Alocação → Financeiro | ✅ OK | M104A trigger dispara no INSERT: cria `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores` com status `pendente` |
| Conclusão → Composição | ✅ OK | M104A atualiza status para `aberto` e cria `composicao_financeira_os` |

### 1.2 Event Bus

| Componente | Status | Detalhes |
|-----------|--------|----------|
| SQL Triggers | ✅ **9/10** | 16 triggers em 2 migrations publicam eventos em `eventos_oficiais` |
| Consumer Trigger | ✅ OK | Cria `portal_notificacoes` e `escalonamentos_humanos` |
| TypeScript `publicarEvento()` | ❌ **1/10** | Comentado em 3 services (escalaService, ordemServicoService, podService) |
| Event Processor Worker | ⚠️ **2/10** | 12/14 case handlers são `{ break; }` — não executam ação alguma |
| Adapters (timeline, notificacao, fiscal) | ❌ **0/10** | 3 de 4 adapters têm zero importers em `src/` |

### 1.3 NOC / Torre de Controle

| Funcionalidade | Status |
|----------------|--------|
| Realtime OS updates | ✅ 4 canais Realtime ativos |
| Timeline via Event Bus | ✅ Lê `eventos_oficiais` |
| Ocorrências | ✅ JOIN com `ordens_servico` |
| Mapa Mapbox | ✅ Marcadores reais |
| Escalonamentos humanos | ✅ Realtime subscription |
| **Nota: 9/10** | |

### 1.4 Dashboard

| Aba | Fonte | Realtime? |
|-----|-------|-----------|
| TabOperacional | `ordens_servico`, `alocacoes_escala`, `prestadores` | ❌ Snapshot |
| TabExecutivo | `clientes`, `prestadores`, `financeiro_receber/pagar` | ❌ Snapshot |
| TabComercial | `clientes`, `ordens_servico`, `orcamentos` | ❌ Snapshot |
| TabFinanceiro | `financeiro_receber/pagar`, `composicao_financeira_os` | ❌ Snapshot |
| TabRede | `rede_oportunidades` | ❌ Snapshot |
| TabAlertas | `escalonamentos_humanos` | ✅ Realtime |
| TabEventos | `eventos_oficiais` | ✅ Realtime |

**Nota: 6/10** — Dados reais, mas 5/7 abas são snapshot (requer F5 para atualizar).

### 1.5 Portal Cliente

| Tab | Fonte | Dados Reais? |
|-----|-------|:------------:|
| Dashboard | `buscarDashboardMetrics()` | ✅ 9/10 |
| Pedidos | `ordens_servico` + `alocacoes_escala` | ✅ 8/10 |
| Financeiro | `financeiro_receber` | ✅ 8/10 |
| Comprovantes | `entregas_protocolo` | ✅ 9/10 |
| Ocorrências | `portal_ocorrencias` | ✅ 7/10 |
| Perfil | `clientes` | ✅ 6/10 |
| Fiscal | `portal_protocolos` | ✅ 7/10 |
| Relatórios | In-memory state | ⚠️ 5/10 |
| Rastreamento | `portal_tracking_realtime` | ❌ **2/10** |
| CentralViva | Placeholder | ❌ 0/10 |
| Roteirização | Placeholder | ❌ 0/10 |
| EscalaOperacional | Placeholder | ❌ 0/10 |
| IA Insights | Placeholder | ❌ 0/10 |
| Economia | Placeholder | ❌ 0/10 |
| **Geral** | | **4.5/10** |

---

## 2. TESTES OPERACIONAIS — 13 Cenários

### CENÁRIO 1: Operação simples (Cliente → Pedido → OS → Escala → Motorista → POD → Financeiro)

**Diagnóstico:**
- `handleCriarPedido()` → `criarPedidoPortal()` ✅ pedido em `portal_pedidos`
- `confirmarPedidoPortal()` → `criarOrdemServico()` ✅ OS criada
- M80b trigger → `financeiro_receber` criado (status `pendente`)
- TMS operador acessa Escala → cria alocação com OS vinculada
- Edge Function cria alocação → M104A trigger dispara
- `financeiro_pagar` + `pagamentos_prestadores` criados (status `pendente`)
- Motorista aceita → status muda
- POD enviado → `entregas_protocolo` populado
- Alocação concluída → M104A atualiza status para `aberto` + `composicao_financeira_os`
- Portal Cliente vê comprovantes via `entregas_protocolo`
- NOC recebe evento via `eventos_oficiais`

**✅ FUNCIONAL — Caminho crítico completo**

**Gaps:**
1. OS criada via Portal não tem `custo_prestador` (é 0) — `financeiro_pagar` só é criado quando operador aloca na escala
2. Sem mecanismo de retry se `confirmarPedidoPortal()` falhar (rede, timeout)

### CENÁRIO 2: Múltiplas entregas
**✅ SUPORTADO** — `alocacoes_escala.quantidade_entregas` + `quantidade_coletas` + `quantidade_paradas` tracking. M104A propaga normalmente.

### CENÁRIO 3: Cancelamento antes da coleta
**✅ SUPORTADO** — Alocação `status='cancelada'` → M104A NÃO dispara (WHEN exclui cancelada). Trigger M021 (`trg_cancelar_financeiro_escala`) zera valores em `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`.

### CENÁRIO 4: Cancelamento após aceite
**✅ SUPORTADO** — Mesmo fluxo do C3. Trigger M021 zera financeiro independente do status anterior. Event Bus trigger `trg_evento_os_cancelada` publica `os.ordem_servico.cancelada`.

### CENÁRIO 5: Troca de motorista
**✅ SUPORTADO** — `alocacoes_escala.prestador_id` é atualizável. M104A re-propaga com novo prestador (ON CONFLICT atualiza `fornecedor_id`).

### CENÁRIO 6: Troca de veículo
**✅ SUPORTADO** — `alocacoes_escala.placa` + `tipo_veiculo` atualizáveis. Nenhuma dependência financeira do veículo.

### CENÁRIO 7: Reembolso de pedágio
**⚠️ PARCIAL** — Pedágio é armazenado em `alocacoes_escala.valor_pedagio` e propaga para `pagamentos_prestadores.pedagio`. Mas:
- Tabela `prestador_reembolsos` **não foi migrada** (existe apenas em `src/lib/app_prestador_schema.sql`)
- `appPrestadorService.solicitarReembolso()` é **código morto** (594 linhas, zero callers)
- Único caminho: ajuste manual em `PagamentoPrestadores.tsx`

### CENÁRIO 8: Reembolso de abastecimento
**⚠️ PARCIAL** — Combustível em `alocacoes_escala.valor_combustivel`, mas não há schema dedicado de reembolso de abastecimento. A aba `Combustiveis.tsx` compartilha "Abastecimentos / Reembolsos" mas sem workflow formal.

### CENÁRIO 9: Operação enviada para Rede Enterprise
**✅ SUPORTADO** — `rede_oportunidades` + `rede_visualizacoes` com RLS. Integração via `IntegracoesTMS.tsx` e `DashboardRede`.

### CENÁRIO 10: Tracking com perda temporária de GPS
**❌ NÃO FUNCIONAL** — `portal_tracking_realtime` **nunca é populado**. Nenhum serviço chama `trackingService.registrarPosicao()`. Mapa sempre mostra "Aguardando Localização".

### CENÁRIO 11: Motorista offline e retorno
**✅ SUPORTADO** — App Motorista (Flutter externo) gerencia o estado de conexão. TMS não depende de GPS em tempo real para operação (apenas para tracking visual).

### CENÁRIO 12: POD recusado
**⚠️ PARCIAL** — Sistema registra POD em `entregas_protocolo`. Se motorista não envia foto/assinatura, o status da alocação permanece não-finalizado. Portal mostra "NÃO ENVIADA". Mas não há workflow automático de alerta/re-tentativa.

### CENÁRIO 13: POD aprovado
**✅ SUPORTADO** — `entregas_protocolo.foto_entrega_url`, `assinatura_url`, `foto_canhoto_url`, `nome_recebedor`, `documento_recebedor`, GPS são todos exibidos no PortalDrawerPOD com Centro de Evidências (6 categorias), Timeline Enterprise, Índice de Qualidade com estrelas.

---

## 3. GAPS CRÍTICOS (P0/P1)

| # | Gap | Severidade | Impacto | Solução |
|---|-----|:----------:|---------|---------|
| **G1** | **Trigger financeiro pode estar incorreta** — P0 (regressiva) vs M104A (correta) | **P0** | Se P0 estiver ativa, financeiro só propaga na conclusão | Verificar no Supabase qual função está ativa. Se não tiver EXCEPTION handler, aplicar M104A |
| **G2** | **`portal_tracking_realtime` nunca populado** — GPS tracking não funciona | **P1** | Mapa do Portal Cliente sempre vazio. Rastreamento em tempo real inoperante | App Motorista precisa enviar GPS para a tabela, ou criar worker TMS que injete posições |
| **G3** | **Ganhos do prestador são mock** — Portal Prestador com `ganhosMes=12450` hardcoded | **P1** | Prestador não vê receita real | Substituir por consulta `SUM(valor_liquido)` de `pagamentos_prestadores` |
| **G4** | **Event Processor Worker é no-op** — 12/14 handlers vazios | **P1** | Eventos são registrados mas nenhuma ação automatizada ocorre | Implementar handlers para os 12 tipos de evento vazios |
| **G5** | **Sem trigger de cancelamento OS direta** — M021 cobre alocação mas não OS | **P1** | OS cancelada deixa `financeiro_receber` aberto | Criar trigger análogo ao M021 para `ordens_servico` |
| **G6** | **`useEscalaRealtime` é código morto** — Hook existe mas não é importado | **P2** | Nenhum componente recebe atualizações Realtime de escala | Importar hook nos componentes de escala |
| **G7** | **`appPrestadorService.ts` 594 linhas de código morto** | **P2** | Confusão e manutenção desnecessária | Remover ou marcar `@deprecated` |

---

## 4. NOTAS POR MÓDULO

| Módulo | Nota | Status |
|--------|:----:|--------|
| **TMS (OS, Escala, Cadastros)** | **8.5/10** | Core operacional funcional. 13/13 Playwright |
| **Financeiro** | **7.5/10** | M104A + M80b + M021 cobrem todos os cenários. Risco: trigger incorreta |
| **Portal Cliente** | **4.5/10** | 6 abas funcionais, 1 parcial (tracking), 6 decorativas |
| **App Motorista** | **1/10** | Flutter PWA externo. `appPrestadorService.ts` é código morto. Só API TMS-side |
| **Tracking** | **2/10** | Infraestrutura pronta (tabela, subscription, mapa), pipeline de dados vazia |
| **Event Bus** | **5/10** | SQL triggers 9/10, TypeScript 1/10, Worker 2/10 |
| **NOC / Torre de Controle** | **9/10** | Único módulo com Realtime completo. 4 canais ativos |
| **Dashboard** | **6/10** | Dados reais, mas 5/7 abas sem Realtime |
| **Playwright (E2E)** | **9/10** | 27/27 testes passando (M55) |
| **Supabase (migrations/triggers)** | **7/10** | M104A correta, P0 com data futura é risco |
| **Integrações (TMS↔Portal↔App)** | **4/10** | TMS→Portal funcional. Portal→TMS gaps. App motorista não validável |

## NOTA GERAL: **6.2/10** ⚠️

---

## 5. ARQUIVOS AUDITADOS

| Arquivo | Linhas | Papel |
|---------|:------:|-------|
| `src/pages/PortalCliente.tsx` | 5695 | Componente principal do Portal Cliente |
| `src/services/portalCliente/pedidosService.ts` | 453 | Criação de pedidos no portal |
| `src/services/ordemServicoService.ts` | 625 | CRUD de OS + sincronização escala |
| `src/components/operacao/EscalaLista.tsx` | 3195 | Criação/gestão de alocações |
| `src/components/operacao/OrdemServicoForm.tsx` | 2200 | Formulário de OS |
| `src/services/escala/escalaService.ts` | 520 | Serviço de escala |
| `supabase/functions/criar-alocacao-escala/index.ts` | 230 | Edge Function criação alocação |
| `supabase/migrations/20260707_m104a_correcao_propagacao_financeira_m66.sql` | 459 | M104A — trigger financeira correta |
| `supabase/migrations/20260731_p0_propagacao_financeira_trigger.sql` | 254 | P0 — trigger REGRESSIVA (risco) |
| `supabase/migrations/20260705_m80b_fix_trigger_columns.sql` | 320 | M80b — trigger OS direta |
| `src/services/eventBus/eventBusService.ts` | — | Event Bus TS (comentado) |
| `src/services/ia/eventProcessorWorker.ts` | — | Worker de eventos (12/14 no-op) |
| `src/components/torre-controle/TorreControle.tsx` | — | NOC com Realtime |
| `src/services/rastreamento/trackingService.ts` | 221 | Serviço de tracking |
| `src/stores/portalPrestadorStore.ts` | — | Store portal (ganhos mock) |
| `src/services/appPrestadorService.ts` | 594 | **Código morto** — zero callers |

---

## 6. RECOMENDAÇÕES PRÉ-GO LIVE

### Immediatas (antes de colocar em produção):
1. **Verificar trigger ativa no Supabase** — `SELECT tgname, proname FROM pg_trigger JOIN pg_proc ON tgfoid=oid WHERE tgrelid='alocacoes_escala'::regclass AND tgname='trg_propagar_financeiro_alocacao'`
2. **Verificar UNIQUE constraints** — `SELECT conname FROM pg_constraint WHERE conname IN ('uq_fr_os_id','uq_fp_os_id','uq_pp_os_id')`
3. **Aplicar M104A** se P0 estiver ativa

### Pós-Go Live (primeira semana):
4. **Criar trigger de cancelamento OS** direta (análogo M021)
5. **Substituir ganhos mock** por dados reais de `pagamentos_prestadores`
6. **Populate `portal_tracking_realtime`** — worker que injete posições a partir de coordenas em `entregas_protocolo`

### Médio prazo (30 dias):
7. **Implementar handlers do Event Processor Worker** para 12 tipos de eventos
8. **Ativar `useEscalaRealtime`** nos componentes de escala
9. **Dashboard com polling automático** (30s) para 5 abas snapshot
10. **Remover `appPrestadorService.ts`** (código morto)

---

## 7. EVIDÊNCIAS

**Playwright Screenshots (27 capturas):**
- `test-results/e2e/m55-c1-dashboard.png` — Dashboard carregado
- `test-results/e2e/m55-c1-clientes.png` — Clientes carregado
- `test-results/e2e/m55-c1-financeiro.png` — Financeiro carregado
- `test-results/e2e/m55-c1-escala.png` — Escala carregada
- `test-results/e2e/m55-c2-portal-comprov.png` — Portal comprovantes
- `test-results/e2e/m55-c2-portal-financeiro.png` — Portal financeiro
- `test-results/e2e/m55-c3-all-routes.png` — Navegação sem erros
- (21 mais no diretório `test-results/e2e/`)

**Build/TypeCheck:**
- `npx tsc --noEmit` → ✅ 0 erros
- `npm run build` → ✅ OK (1m27s)

**Testes:**
- M55-C1 Fluxo Operacional: 13/13 ✅ (3.9 min)
- M55-C2 Portal Cliente: 7/7 ✅ (2.5 min)
- M55-C3 Erros: 7/7 ✅ (2.0 min)

---

> **Veredito Final:** Sistema **pronto para operação real com ressalvas**. Core operacional (OS, Escala, Financeiro, NOC) funciona ponta-a-ponta. Portal Cliente tem 6/15 tabs funcionais. GPS tracking não funciona. Ganhos do prestador são mock. Event Bus Worker não executa ações. Nota geral: **6.2/10 — GO LIVE CONDICIONAL**.
