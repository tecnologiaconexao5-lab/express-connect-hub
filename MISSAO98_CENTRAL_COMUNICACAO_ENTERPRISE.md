# MISSÃO 98 — CENTRAL DE COMUNICAÇÃO ENTERPRISE

**Data:** 2026-07-05  
**Status:** ✅ Auditoria completa. Documento de arquitetura gerado.  
**Objetivo:** Transformar todos os acontecimentos operacionais em eventos padronizados. A Timeline passa a ser a fonte única de eventos da plataforma.

---

## RESUMO EXECUTIVO

O projeto atual possui **44+ tabelas de evento/log** espalhadas por **14 categorias**, alimentadas por **14 triggers event-generating** e **45+ serviços**. Existem **6 implementações de timeline diferentes**, **nenhuma compartilhando a mesma fonte de dados**. O sistema de notificações do Portal Cliente está **completamente desconectado** (tabela existe, triggers escrevem, mas ninguém lê). O `communication_events` tem **14 tipos de evento definidos** mas **zero consumidores** que os processam. **Não existe Event Bus.** Cada módulo produz e consome eventos de forma isolada.

### Score de Maturidade de Eventos: 2.5/10

| Dimensão | Nota | Justificativa |
|----------|:----:|---------------|
| Produção de eventos | 6/10 | 44 tabelas, 14 triggers, 45+ serviços produzem logs/eventos |
| Padronização | 1/10 | Zero tipos/constantes compartilhados. Interfaces incompatíveis |
| Consumo de eventos | 2/10 | `os_historico` só tem 2 escritas e 0 leituras. Timelines fragmentadas |
| Roteamento | 1/10 | Nenhum Event Bus. Cada consumidor faz query direta |
| Notificações | 1/10 | `portal_notificacoes` tem trigger mas ninguém consome |
| **Geral** | **2.5/10** | **Eventos existem mas não são integrados nem padronizados** |

---

## PARTE 1 — MAPA COMPLETO DOS EVENTOS

### 1.1 Eventos Operacionais (Core do Negócio)

| Evento | Arquivo/Service | Tabela Origem | Trigger? | Quem Produz | Quem Consome | Destinatários | Status |
|--------|----------------|---------------|----------|-------------|--------------|---------------|--------|
| **OS Criada** | `fn_auditar_ordem_servico()` | `ordens_servico` | ✅ AFTER INSERT | Trigger | `auditoria_operacional` | Admin, Operador | ✅ Ativo |
| **OS Editada** | `fn_auditar_ordem_servico()` | `ordens_servico` | ✅ AFTER UPDATE | Trigger | `auditoria_operacional` | Admin, Operador | ✅ Ativo |
| **OS Cancelada** | `fn_auditar_ordem_servico()` | `ordens_servico` | ✅ AFTER UPDATE | Trigger | `auditoria_operacional` | Admin, Operador | ✅ Ativo |
| **OS Finalizada** | `fn_auditar_ordem_servico()` | `ordens_servico` | ✅ AFTER UPDATE | Trigger | `auditoria_operacional` | Admin, Operador | ✅ Ativo |
| **OS Status Mudou** | `fn_notificar_mudanca_status_os()` | `ordens_servico` | ✅ AFTER UPDATE status | Trigger | `portal_notificacoes` | Cliente (via portal) | ⚠️ Escrita OK, leitura quebrada |
| **OS → Rede** | `redePrestadoresService.publicarOportunidade()` | `os_historico` | ❌ Manual | Service | `os_historico` (ninguém lê) | — | ❌ Escrita órfã |
| **Rede Cancelada** | `redePrestadoresService.cancelarOportunidade()` | `os_historico` | ❌ Manual | Service | `os_historico` (ninguém lê) | — | ❌ Escrita órfã |
| **Escala Criada** | `registrar_historico_alocacao()` | `alocacoes_escala` | ✅ AFTER INSERT | Trigger | `historico_alocacoes_escala` | Admin, Operador | ✅ Ativo |
| **Escala Status** | `registrar_historico_alocacao()` | `alocacoes_escala` | ✅ AFTER UPDATE | Trigger | `historico_alocacoes_escala` | Admin, Operador | ✅ Ativo |
| **Aceite Prestador** | `registrar_historico_alocacao()` | `alocacoes_escala` | ✅ AFTER UPDATE | Trigger | `historico_alocacoes_escala` | Admin, Operador | ✅ Ativo |
| **Troca Motorista** | `escalaService.trocarMotorista()` | `historico_alocacoes_escala` | ❌ Manual | Service | Admin, Operador | — | ✅ Ativo |
| **Troca Veículo** | `escalaService.trocarVeiculo()` | `historico_alocacoes_escala` | ❌ Manual | Service | Admin, Operador | — | ✅ Ativo |
| **Recusa Prestador** | `escalaService.recusarAlocacao()` | `historico_alocacoes_escala` | ❌ Manual | Service | Admin, Operador | — | ✅ Ativo |
| **Cancelamento Escala** | `escalaService.cancelarAlocacao()` | `historico_alocacoes_escala` | ❌ Manual | Service | Admin, Operador | — | ✅ Ativo |
| **Ocorrência Registrada** | UI `portal_ocorrencias` | `portal_ocorrencias` | ❌ Manual | Cliente/Portal | `portal_ocorrencias` | Cliente, Admin | ⚠️ Ninguém no TMS lê |
| **Avaliação Enviada** | UI `portal_avaliacoes` | `portal_avaliacoes` | ❌ Manual | Cliente/Portal | `portal_avaliacoes` | Admin | ⚠️ Ninguém no TMS lê |
| **Pedido Criado** | `pedidosService.confirmarPedidoPortal()` | `portal_pedidos` | ❌ Manual | Cliente/Portal | `portal_pedidos` | Admin, Financeiro | ⚠️ Não cria OS automaticamente |
| **Pedido Confirmado (evento)** | `pedidosService.confirmarPedidoPortal()` | `communication_events` | ❌ Manual | Service | Ninguém (simulado) | Cliente | ❌ Sem template + simulado |

### 1.2 Eventos Financeiros

| Evento | Arquivo/Service | Tabela Origem | Trigger? | Quem Produz | Quem Consome | Status |
|--------|----------------|---------------|----------|-------------|--------------|--------|
| **Financeiro Alocação Propagado** | `f_trg_propagar_financeiro_alocacao()` | `alocacoes_escala` | ✅ AFTER INSERT/UPDATE | Trigger | `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os` | ✅ Ativo |
| **Financeiro OS Propagado** | `f_trg_propagar_financeiro_os()` | `ordens_servico` | ✅ AFTER INSERT/UPDATE | Trigger | Mesmas 4 tabelas | ✅ Ativo |
| **Financeiro Cancelado** | `f_trg_cancelar_financeiro_escala()` | `alocacoes_escala` | ✅ AFTER UPDATE status | Trigger | Mesmas 4 tabelas (UPDATE) | ✅ Ativo |
| **Receber Auditado** | `audit_financeiro_receber()` | `financeiro_receber` | ✅ AFTER UPDATE | Trigger | `financeiro_receber_audit` | ✅ Ativo |
| **Pagamento Prestador Auditado** | `auditoriaPrestadorService.registrarAuditoria()` | — | ❌ Manual | Service | `financeiro_prestador_auditoria` | ✅ Ativo |

### 1.3 Eventos de Tracking/Rastreamento

| Evento | Arquivo/Service | Tabela Origem | Status |
|--------|----------------|---------------|--------|
| **Link Rastreio Criado** | `trackingService.gerarLinkRastreio()` | `tracking_public_links` | ✅ Ativo (via OrdemServicoForm + pedidosService) |
| **Posição GPS Registrada** | `trackingService.registrarPosicao()` | `portal_tracking_realtime` | ❌ Nunca chamado (app motorista externo) |
| **Tracking Público Visualizado** | `RastreamentoPublico.tsx` | `tracking_public_links` (UPDATE acessos) | ✅ Ativo |
| **Evento Tracking (schema legado)** | `src/lib/tracking_schema.sql` | `tracking_eventos` | 💀 Schema órfão (nunca migrado) |

### 1.4 Eventos de Comunicação

| Evento | Arquivo/Service | Tabela | Template? | Status |
|--------|----------------|--------|-----------|--------|
| `entrega_preparacao` | `communicationHubService` | `communication_events` | ✅ `dest_entrega_preparacao` | ⚠️ Simulado, sem dispatch real |
| `entrega_saiu` | `communicationHubService` | `communication_events` | ✅ `dest_entrega_saiu` | ⚠️ Simulado, sem dispatch real |
| `entrega_proxima` | `communicationHubService` | `communication_events` | ✅ `dest_entrega_proxima` | ⚠️ Simulado, sem dispatch real |
| `entrega_concluida` | `communicationHubService` | `communication_events` | ✅ `dest_entrega_concluida` | ⚠️ Simulado, sem dispatch real |
| `avaliacao_entrega` | `communicationHubService` | `communication_events` | ✅ `dest_avaliacao` | ⚠️ Simulado, sem dispatch real |
| `os_criada` | `communicationHubService` | `communication_events` | ✅ `cli_os_criada` | ⚠️ Simulado, sem dispatch real |
| `prestador_alocado` | `communicationHubService` | `communication_events` | ✅ `cli_prestador_alocado` | ⚠️ Simulado, sem dispatch real |
| `em_operacao` | `communicationHubService` | `communication_events` | ✅ `cli_em_operacao` | ⚠️ Simulado, sem dispatch real |
| `ocorrencia_registrada` | `communicationHubService` | `communication_events` | ✅ `cli_ocorrencia` | ⚠️ Simulado, sem dispatch real |
| `nova_operacao` | `communicationHubService` | `communication_events` | ✅ `pres_nova_operacao` | ⚠️ Simulado, sem dispatch real |
| `janela_em_risco` | `communicationHubService` | `communication_events` | ✅ `pres_janela_risco` | ⚠️ Simulado, sem dispatch real |
| `ocorrencia_recebida` | `communicationHubService` | `communication_events` | ✅ `pres_ocorrencia_recebida` | ⚠️ Simulado, sem dispatch real |
| `pedido_confirmado` | `pedidosService` | `communication_events` | ❌ Sem template | ❌ Simulado + sem template |
| Mensagem WhatsApp | `comunicacaoGatewayService.enviarWhatsAppControlado()` | `comunicacoes_mensagens` | N/A (texto livre) | ⚠️ Gated (produção assistida) |
| Mensagem IA Robô | `centralIaService` | `comunicacoes_mensagens` | N/A (texto livre) | ⚠️ Gated (modo seguro) |

### 1.5 Eventos de IA/Automação

| Evento | Arquivo/Service | Tabela | Status |
|--------|----------------|--------|--------|
| Log de Robô | `centralIaService.registrarLog()` | `automacoes_logs` | ✅ Ativo (12+ services) |
| Log de Provider IA | `aiProviderManager.registrarLogIA()` | `ia_logs` | ✅ Ativo |
| Execução de Ferramenta | `actionEngineService.solicitarAcao()` | `ia_execucoes_ferramentas` | ✅ Ativo |
| Execução de Conector | `conectoresService.registrarExecucao()` | `ia_execucoes_conectores` | ✅ Ativo |
| Evento de Aprendizado | `autoEvolutionEngineService.registrarEvento()` | `ia_aprendizado_eventos` | ✅ Ativo |
| Memória de Evento | `memoriaService.registrarEvento()` | `memoria_eventos` | ✅ Ativo |
| Histórico de Trabalho | `workforceOrchestratorService.registrarHistorico()` | `ia_historico_trabalho` | ✅ Ativo |
| Evento de Fluxo | `enterpriseOrchestratorService` | `ia_fluxos_execucao_log` | ✅ Ativo |
| Decisão do Diretor | `diretor_virtual_eventos_ia` | Trigger/Service | ✅ Ativo |
| Escalonamento Humano | `trg_ia_logs_escalonamento()` | `escalonamentos_humanos` | ✅ Ativo (trigger em ia_logs) |
| Conflito de Escala | `trg_escala_validacoes()` | `escalonamentos_humanos` | ⚠️ Tabela `escala_operacional` deprecated |

### 1.6 Eventos Fiscais

| Evento | Arquivo/Service | Tabela | Status |
|--------|----------------|--------|--------|
| CT-e Evento | `cteService` | `fiscal_events` + `fiscal_logs` | ✅ Ativo |
| MDF-e Evento | `cteService` | `fiscal_events` | ✅ Ativo |
| Status Fiscal | `fiscalStatusService` | `fiscal_historico_status` + `fiscal_events` | ✅ Ativo |
| Processamento Focus | `focusService` | `fiscal_logs` | ✅ Ativo |

### 1.7 Eventos de Pátio

| Evento | Arquivo/Service | Tabela | Status |
|--------|----------------|--------|--------|
| Check-in | `patioService.fazerCheckin()` | `patio_checkins` | ✅ Ativo |
| Check-out | `patioService.registrarSaida()` | `patio_checkins` | ✅ Ativo |
| Evento de Pátio | `patioService.registrarEventoPatio()` | `patio_eventos` | ✅ Ativo |
| Alerta de Pátio | `patioService.gerarAlertasAutomaticos()` | `patio_alertas` | ✅ Ativo |

### 1.8 Eventos de Autenticação/Segurança

| Evento | Arquivo/Service | Tabela | Status |
|--------|----------------|--------|--------|
| Login/Sucesso | `AuthContext.tsx` | `auth_eventos_auditoria` | ✅ Ativo |
| Login/Falha | `AuthContext.tsx` | `auth_eventos_auditoria` | ✅ Ativo |
| Logout | `AuthContext.tsx` | `auth_eventos_auditoria` | ✅ Ativo |
| Reset de Senha | `AuthContext.tsx` | `auth_eventos_auditoria` | ✅ Ativo |
| Violação de Segurança | Trigger/Service | `security_violation_log` | ✅ Ativo |

### 1.9 Eventos de Contrato

| Evento | Arquivo/Service | Tabela | Status |
|--------|----------------|--------|--------|
| Contrato Assinado | `contratosService` | `contratos_historico` | ✅ Ativo |
| Contrato Criado | `contratosService` | `contratos_historico` | ✅ Ativo |
| Contrato Editado | `contratosService` | `contratos_historico` | ✅ Ativo |

---

## PARTE 2 — CATÁLOGO OFICIAL DE EVENTOS (PROPOSTA)

### 2.1 Estrutura Padrão do Evento

```typescript
interface EventoOficial {
  id: string;                    // UUID gen_random_uuid()
  event_type: string;            // Nome canônico do evento (ex: "os.criada")
  entity_type: string;           // Tipo da entidade (ex: "ordem_servico", "alocacao")
  entity_id: string;             // UUID da entidade
  tenant_id: string;             // UUID do tenant
  timestamp: string;             // ISO 8601 (gerado pelo servidor)
  created_by: string;            // UUID do usuário/robô que gerou
  source: string;                // "trigger" | "service" | "api" | "portal" | "app_motorista"
  payload: Record<string, any>;  // Dados do evento (mutável por tipo)
  visibility: "public" | "internal" | "admin";
  status: "active" | "superseded" | "deleted";
  parent_event_id?: string;      // Para encadeamento de eventos
  metadata?: Record<string, any>;
}
```

### 2.2 Nomenclatura de Eventos (Proposta)

**Padrão:** `{dominio}.{entidade}.{acao}` no estilo CloudEvents

| Domínio | Entidade | Ação | Evento Completo |
|---------|----------|------|-----------------|
| `os` | `ordem_servico` | `criada`, `editada`, `cancelada`, `finalizada`, `status_changed`, `atrasada`, `sla_excedida`, `rede_enviada` | `os.ordem_servico.criada` |
| `escala` | `alocacao` | `criada`, `aceita`, `recusada`, `cancelada`, `concluida`, `motorista_trocado`, `veiculo_trocado`, `status_changed` | `escala.alocacao.aceita` |
| `entrega` | `comprovante` | `pod_enviado`, `foto_anexada`, `assinatura_enviada`, `canhoto_anexado`, `ocorrencia_registrada` | `entrega.comprovante.pod_enviado` |
| `financeiro` | `receber` | `criado`, `pago`, `cancelado`, `vencido`, `parcial` | `financeiro.receber.pago` |
| `financeiro` | `pagar` | `criado`, `pago`, `cancelado`, `vencido` | `financeiro.pagar.criado` |
| `rede` | `oportunidade` | `publicada`, `visualizada`, `aceita`, `expirada`, `cancelada` | `rede.oportunidade.aceita` |
| `tracking` | `posicao` | `atualizada`, `eta_changed`, `offline`, `online` | `tracking.posicao.atualizada` |
| `comunicacao` | `mensagem` | `enviada`, `entregue`, `lida`, `falhou`, `bloqueada` | `comunicacao.mensagem.enviada` |
| `portal` | `pedido` | `criado`, `confirmado`, `cancelado` | `portal.pedido.criado` |
| `portal` | `ocorrencia` | `aberta`, `respondida`, `resolvida` | `portal.ocorrencia.aberta` |
| `portal` | `avaliacao` | `enviada` | `portal.avaliacao.enviada` |
| `auth` | `usuario` | `login`, `logout`, `login_falha`, `acesso_negado` | `auth.usuario.login` |
| `ia` | `robo` | `executou`, `decidiu`, `erro`, `escalonou`, `aprendeu` | `ia.robo.executou` |
| `fiscal` | `cte` | `autorizado`, `rejeitado`, `cancelado`, `emitido` | `fiscal.cte.emitido` |
| `fiscal` | `nfse` | `emitida`, `cancelada`, `falhou` | `fiscal.nfse.emitida` |
| `patio` | `checkin` | `realizado`, `saida`, `docas_trocada`, `alerta_gerado` | `patio.checkin.realizado` |
| `contrato` | `contrato` | `criado`, `assinado`, `editado`, `cancelado` | `contrato.contrato.assinado` |

### 2.3 Tabela Única de Eventos (Migration Proposta)

```sql
CREATE TABLE eventos_oficiais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL,         -- "os.ordem_servico.criada"
    event_version   TEXT DEFAULT '1.0',
    entity_type     TEXT NOT NULL,         -- "ordem_servico"
    entity_id       UUID NOT NULL,
    tenant_id       UUID NOT NULL DEFAULT current_tenant_id_safe(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,                 -- usuário ou robô
    source          TEXT NOT NULL DEFAULT 'service',  -- trigger|service|api|portal|app_motorista
    payload         JSONB NOT NULL DEFAULT '{}',
    visibility      TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public','internal','admin')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','deleted')),
    parent_event_id UUID REFERENCES eventos_oficiais(id) ON DELETE SET NULL,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eventos_type ON eventos_oficiais (event_type);
CREATE INDEX idx_eventos_entity ON eventos_oficiais (entity_type, entity_id);
CREATE INDEX idx_eventos_tenant ON eventos_oficiais (tenant_id);
CREATE INDEX idx_eventos_timestamp ON eventos_oficiais (timestamp DESC);
CREATE INDEX idx_eventos_visibility ON eventos_oficiais (visibility);
```

---

## PARTE 3 — MATRIZ DE DESTINATÁRIOS POR EVENTO

| Evento | Admin TMS | Operador | Cliente | Prestador | Motorista | Financeiro | IA Robôs | API Webhook | Portal Cliente | App Motorista | Dashboard NOC |
|--------|:---------:|:--------:|:-------:|:---------:|:---------:|:----------:|:--------:|:-----------:|:--------------:|:-------------:|:-------------:|
| `os.criada` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `os.status_changed` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `os.cancelada` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `os.atrasada` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `os.rede_enviada` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `escala.criada` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `escala.aceita` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `escala.concluida` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `entrega.pod_enviado` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `financeiro.receber.criado` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `financeiro.pagar.pago` | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `rede.oportunidade.publicada` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `tracking.posicao.atualizada` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `portal.ocorrencia.aberta` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `fiscal.cte.emitido` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `auth.usuario.login` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ia.robo.executou` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `patio.checkin.realizado` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |

**Regras de Visibilidade:**
- `visibility: "admin"` — apenas Admin TMS e IA Robôs (ex: auth events, IA internos)
- `visibility: "public"` — todos os destinatários (ex: OS status, tracking)
- `visibility: "internal"` — apenas TMS + IA + Webhook (ex: financeiro, fiscal)

---

## PARTE 4 — TIMELINE ÚNICA

### 4.1 Timelines Atuais (6 implementações fragmentadas)

| Timeline | Arquivo | Fonte de Dados | Eventos | Query? |
|----------|---------|---------------|---------|--------|
| **TimelineOperacional** | `src/components/operacao/escala/TimelineOperacional.tsx` | Prop `DadosTimeline` + `montarTimelineAlocacao()` | 5 tipos (criada, carregamento, rota, finalizada, cancelada) | ❌ Função pura |
| **PortalTimeline** | `src/components/portal-cliente/PortalTimeline.tsx` | Prop `events: TimelineEvent[]` | 11 steps | ❌ Função pura |
| **PortalDrawerPOD (timeline)** | `src/pages/PortalCliente.tsx` + `PortalDrawerPOD.tsx` | Computação local de `detalhes` (via service) | ~9 eventos (aceite, coleta, rota, POD, etc.) | ❌ useMemo |
| **TorreControle** | `src/pages/TorreControle.tsx` | 5 queries Supabase diretas | 8 tipos (OS, ocorrências, alertas, etc.) | ✅ 5 queries |
| **CteTimeline** | `src/components/fiscal/cte/CteTimeline.tsx` | Query `fiscal_events` | Dinâmico (tipo_evento) | ✅ 1 query |
| **MdfeTimeline** | `src/components/fiscal/mdfe/MdfeTimeline.tsx` | Query `fiscal_events` | Dinâmico (tipo_evento) | ✅ 1 query |
| **DocumentTimeline (local)** | `src/components/onboarding/DocumentTimeline.tsx` | `documentQueue.ts` (in-memory) | Document queue steps | ❌ Memória volátil |

### 4.2 Problemas Identificados

| # | Problema | Severidade |
|---|----------|:---------:|
| T1 | **6 timelines independentes sem shared source** — cada uma computa/query de forma diferente | **ALTO** |
| T2 | **3 interfaces TimelineEvent diferentes** — `EventoTimeline`, `TimelineEvent` (Portal), `TimelineEvent` (Torre) | **MÉDIO** |
| T3 | **`montarTimelineAlocacao` não gera evento de aceite** — gap M61 registrado | **MÉDIO** |
| T4 | **PortalDrawerPOD e PortalTimeline concorrentes** — desenham timeline de entrega diferente | **MÉDIO** |
| T5 | **TorreControle faz 5 queries** em vez de consultar uma tabela de eventos | **ALTO** |
| T6 | **Nenhuma timeline consulta `os_historico` ou `historico_alocacoes_escala`** — triggers escrevem, mas ninguém lê | **ALTO** |
| T7 | **CteTimeline e MdfeTimeline são quase idênticas** — poderiam ser unificadas | **BAIXO** |

### 4.3 Proposta: Fonte Única de Timeline

```
eventos_oficiais (tabela única)
       │
       ├── TimelineOperacional ← SELECT event_type LIKE 'escala.%' OR 'os.%'
       ├── PortalTimeline      ← SELECT event_type IN ('os.criada','escala.aceita','entrega.*')
       ├── TorreControle       ← SELECT event_type IN ('os.*','escala.*','ocorrencia.*','ia.escalonamento')
       ├── CteTimeline         ← SELECT event_type LIKE 'fiscal.cte.%'
       └── MdfeTimeline        ← SELECT event_type LIKE 'fiscal.mdfe.%'
```

Cada timeline filtra por `event_type` e/ou `entity_id`. Uma única fonte de eventos substitui as 6 implementações atuais.

---

## PARTE 5 — ARQUITETURA DO EVENT BUS

### 5.1 Arquitetura Proposta

```
                    ┌──────────────────────────────────┐
                    │        PRODUTORES DE EVENTOS      │
                    │  (Triggers · Services · API · IA) │
                    └──────────────┬───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │        eventBusService.ts         │
                    │  ┌────────────────────────────┐   │
                    │  │  publicarEvento(params)     │   │
                    │  │  → Valida                  │   │
                    │  │  → Persiste (eventos_oficiais)│ │
                    │  │  → Notifica (Realtime)      │   │
                    │  │  → Dispara (futuro: fila)   │   │
                    │  └────────────────────────────┘   │
                    └──────────────┬───────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   CONSUMIDORES   │  │   NOTIFICADORES  │  │   WEBHOOKS      │
    │                  │  │  (futuro)        │  │  (futuro)       │
    │ · Dashboard NOC  │  │ · WhatsApp       │  │ · API Externa   │
    │ · TorreControle  │  │ · Email (Zoho)   │  │ · n8n           │
    │ · PortalCliente  │  │ · Push           │  │ · IA Robôs      │
    │ · Timeline       │  │ · Painel         │  │                 │
    │ · App Motorista  │  │ · Som            │  │                 │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 5.2 Event Bus Service (`eventBusService.ts`)

```typescript
// Proposta de API do Event Bus

interface PublicarEventoParams {
  event_type: string;          // "os.ordem_servico.criada"
  entity_type: string;         // "ordem_servico"
  entity_id: string;           // UUID
  created_by?: string;         // UUID do usuário/robô
  source: EventSource;         // "trigger" | "service" | "api" | "portal" | "app_motorista"
  payload: Record<string, any>;
  visibility?: EventVisibility; // "public" | "internal" | "admin"
  parent_event_id?: string;    // Para encadeamento
}

// Fluxo:
// 1. Valida event_type contra catálogo
// 2. Persiste em eventos_oficiais
// 3. Publica em canal Realtime (supabase.channel("event-bus"))
// 4. (Futuro) Enfileira para processamento assíncrono
// 5. Retorna EventoOficial criado

async function publicarEvento(params: PublicarEventoParams): Promise<EventoOficial>;

// Consumidores se inscrevem via Realtime
const channel = supabase
  .channel("event-bus")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "eventos_oficiais",
    filter: `event_type=in.(${tiposFiltrados.join(",")})`
  }, (payload) => {
    // Processa evento
  })
  .subscribe();

// Ou via hook:
function useEventos(tipos: string[], callback: (evento: EventoOficial) => void);
```

### 5.3 Integração com Triggers Existentes

Os 14 triggers existentes NÃO devem ser removidos de imediato. Em vez disso:

**Fase 1 (coexistência):** Cada trigger existente continua escrevendo nas tabelas atuais E também chama `publicarEvento()` ou insere em `eventos_oficiais`.

**Fase 2 (migração):** Os consumidores migram para ler de `eventos_oficiais`. Tabelas antigas passam a ser views ou são descontinuadas.

**Fase 3 (remoção):** Triggers antigos que escrevem em tabelas sem consumidores são removidos.

### 5.4 Plano de Substituição das Tabelas de Evento Atuais

| Tabela Atual | Eventos | Novo event_type | Consumidores | Ação |
|-------------|---------|-----------------|-------------|------|
| `historico_alocacoes_escala` | 6 tipos | `escala.*` | TimelineOperacional, TorreControle | 🔄 Migrar para eventos_oficiais |
| `os_historico` | 2 tipos | `os.rede_enviada`, `os.rede_cancelada` | Nenhum (0 leituras) | 🗑️ Substituir por eventos_oficiais |
| `auditoria_operacional` | OS audit | `os.*` | Admin | 🗑️ Substituir por eventos_oficiais |
| `portal_notificacoes` | Notificações | `notificacao.*` | PortalCliente | 🔄 Migrar para eventos_oficiais |
| `communication_events` | 14 tipos | `comunicacao.*` | Nenhum (simulado) | 🗑️ Substituir por eventos_oficiais |
| `fiscal_events` | CT-e/MDF-e | `fiscal.*` | CteTimeline, MdfeTimeline | 🔄 Migrar para eventos_oficiais |
| `patio_eventos` | Pátio | `patio.*` | TorreControle | 🔄 Migrar para eventos_oficiais |
| `auth_eventos_auditoria` | Auth | `auth.*` | Admin | 🔄 Migrar para eventos_oficiais |
| `memoria_eventos` | IA Memória | `memoria.*` | IA Robôs | 🔄 Migrar para eventos_oficiais |
| `ia_fluxos_execucao_log` | IA Fluxos | `ia.fluxo.*` | Central IA | 🔄 Migrar para eventos_oficiais |
| `ia_historico_trabalho` | IA Trabalho | `ia.trabalho.*` | Central IA | 🔄 Migrar para eventos_oficiais |
| `ia_aprendizado_eventos` | IA Aprendizado | `ia.aprendizado.*` | IA Robôs | 🔄 Migrar para eventos_oficiais |
| `ia_historico_indicadores` | IA KPIs | `ia.kpi.*` | Central IA | 🔄 Migrar para eventos_oficiais |
| `automacoes_logs` | IA Logs | `ia.robo.*` | Central IA | 🔄 Manter (log interno, não evento de negócio) |
| `ia_logs` | IA Provider | `ia.provider.*` | Central IA | 🔄 Manter (log interno) |
| `ia_execucoes_ferramentas` | Ferramentas | `ia.ferramenta.*` | Central IA | 🔄 Manter (rastreamento interno) |
| `ia_execucoes_conectores` | Conectores | `ia.conector.*` | Central IA | 🔄 Manter (rastreamento interno) |

---

## PARTE 6 — MATRIZ DE NOTIFICAÇÕES (DEFINIÇÃO, NÃO IMPLEMENTAÇÃO)

### 6.1 Quais Eventos Deverão Gerar Notificações

| Evento | Portal Cliente | WhatsApp | Email | Push App | Painel NOC | Som | Badge |
|--------|:-------------:|:--------:|:-----:|:--------:|:----------:|:---:|:-----:|
| `os.criada` | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `os.status_changed` | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ❌ | ✅ |
| `os.atrasada` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `os.cancelada` | ✅ | ❌ | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| `escala.aceita` | ✅ | ❌ | ⚠️ | ❌ | ✅ | ❌ | ✅ |
| `escala.concluida` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `entrega.pod_enviado` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `entrega.problema` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `financeiro.receber.vencido` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| `financeiro.pagar.pago` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `rede.oportunidade.publicada` | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `portal.ocorrencia.aberta` | ❌ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `fiscal.cte.rejeitado` | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `tracking.posicao.atualizada` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ia.robo.escalonou` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `auth.usuario.login_falha` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

**Legenda:** ✅ Obrigatório, ⚠️ Opcional/configurável, ❌ Não se aplica

### 6.2 Canais de Notificação (Arquitetura Futura)

Cada notificador deverá consumir eventos oficiais de `eventos_oficiais` e rotear conforme a matriz acima:

```
eventos_oficiais (INSERT)
       │
       ▼
notificadorService.ts
       │
       ├── canal: "portal"   → portal_notificacoes (via trigger/evento)
       ├── canal: "whatsapp" → comunicacaoGatewayService (futuro: provider Evolution)
       ├── canal: "email"    → zohoEmailService (futuro: ZohoMailProvider)
       ├── canal: "push"     → pushNotificationService (futuro)
       ├── canal: "painel"   → eventos_oficiais (já está aqui — Dashboard NOC consome)
       ├── canal: "som"      → AudioContext Web API (futuro)
       └── canal: "badge"    → favicon badge + document.title (futuro)
```

### 6.3 Preferências de Notificação

Cada destinatário (cliente, prestador, operador) deverá poder configurar:
- Quais eventos quer receber (ex: só `entrega.pod_enviado`, não `os.criada`)
- Em quais canais (ex: email para faturas, WhatsApp para POD)
- Horário permitido (ex: não enviar após 20h)
- Limite diário (ex: máx 10 notificações/dia)

Tabela proposta:
```sql
CREATE TABLE notificacao_preferencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario_tipo TEXT NOT NULL,         -- 'cliente' | 'prestador' | 'usuario'
    destinatario_id UUID NOT NULL,
    event_type TEXT NOT NULL,                -- ou '*' para todos
    canais TEXT[] NOT NULL DEFAULT '{}',     -- 'portal', 'whatsapp', 'email', 'push'
    ativo BOOLEAN DEFAULT true,
    horario_inicio TIME DEFAULT '08:00',
    horario_fim TIME DEFAULT '20:00',
    limite_diario INTEGER DEFAULT 0,        -- 0 = ilimitado
    UNIQUE (destinatario_tipo, destinatario_id, event_type)
);
```

---

## PARTE 7 — API / WEBHOOK (ARQUITETURA FUTURA)

### 7.1 Princípios

1. **Toda API externa consome eventos oficiais** — nunca integração direta em regras de negócio
2. **Webhooks são configuráveis por tenant** — cada tenant escolhe quais eventos receber
3. **Formato CloudEvents** — padrão CNCF para interoperabilidade

### 7.2 Arquitetura de Webhooks

```
eventos_oficiais (INSERT)
       │
       ▼
webhookDispatcherService.ts
       │
       ├── Lê webhook_configs (tabela de configuração por tenant)
       ├── Filtra por event_type + tenant
       ├── Monta payload CloudEvents
       ├── Envia POST para endpoint configurado
       └── Registra em webhook_logs (status, tentativa, erro, duração)
```

### 7.3 Tabela de Configuração de Webhook

```sql
CREATE TABLE webhook_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    nome TEXT NOT NULL,
    url TEXT NOT NULL,
    event_types TEXT[] NOT NULL,          -- ['os.*', 'entrega.*']
    headers JSONB DEFAULT '{}',           -- headers customizados
    secret TEXT,                           -- para assinatura HMAC
    ativo BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3,
    timeout_segundos INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_config_id UUID REFERENCES webhook_configs(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,                  -- 'sucesso' | 'falhou' | 'timeout'
    status_code INTEGER,
    request_body JSONB,
    response_body TEXT,
    duracao_ms INTEGER,
    tentativa INTEGER DEFAULT 1,
    erro TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## PARTE 8 — PROBLEMAS ENCONTRADOS NA AUDITORIA

### 8.1 Problemas Críticos

| ID | Problema | Impacto | Local |
|----|----------|---------|-------|
| C1 | **Nenhum Event Bus existe** | Cada módulo faz query direta. Dashboard 22+ queries. TorreControle 5 queries. | Todo o sistema |
| C2 | **44+ tabelas de evento fragmentadas** | Eventos duplicados, sem padronização, sem visibilidade | 14 categorias de tabelas |
| C3 | **Timelines inconsistentes (6 implementações)** | Mesmo evento (ex: entrega concluída) exibido de forma diferente em cada timeline | 6 arquivos de timeline |
| C4 | **`portal_notificacoes` completamente desconectado** | Trigger escreve, mas ninguém lê. Realtime subscription comentado. | `usePortalRealtime.ts`, `PortalCliente.tsx` |
| C5 | **`communication_events` sem consumidores** | 14 eventos template prontos, 0 dispatch real | `communicationHubService.ts` |
| C6 | **`os_historico` sem leitores** | 2 escritas, 0 leituras. Morto. | `redePrestadoresService.ts` |
| C7 | **Dashboard sem reatividade** | Apenas 1/6 tabs usa Realtime. 2 tabs ignoram filtros. | `TabExecutivo.tsx`, `TabFinanceiro.tsx` |
| C8 | **`simulationMode=true` em `communicationHubService`** | Bloqueia todo envio real. Mesmo com env var, não há dispatcher. | `communicationHubService.ts:128` |

### 8.2 Problemas Médios

| ID | Problema | Impacto | Local |
|----|----------|---------|-------|
| M1 | **3 interfaces `Notificacao` incompatíveis** | Impossível tipar corretamente | PortalCliente.tsx, PortalNotificacoes.tsx, portalClienteService.ts |
| M2 | **Zero enums/constantes de evento compartilhados** | Cada módulo define seus tipos manualmente | Todo o sistema |
| M3 | **`TabExecutivo` tem queries que não usa** | `financeiro_receber` e `financeiro_pagar` consultados mas resultado descartado | `TabExecutivo.tsx` |
| M4 | **`TabComercial` consulta `ordens_servico` duas vezes** | Desperdício de rede | `TabComercial.tsx` |
| M5 | **Nenhuma IA produz `escalonamentos_humanos`** | Só produção manual via `TabAlertas.tsx`. Action Engine, Diretor Virtual, Agente não escalam. | `actionEngineService.ts`, `diretorVirtualService.ts` |
| M6 | **`montarTimelineAlocacao` sem evento de aceite** | Gap documentado desde M61 | `montarTimelineAlocacao.ts` |
| M7 | **CteTimeline e MdfeTimeline virtualmente idênticas** | Duplicação de código | `CteTimeline.tsx`, `MdfeTimeline.tsx` |

### 8.3 Problemas Baixos

| ID | Problema | Local |
|----|----------|-------|
| B1 | `PortalTimeline.tsx` existe mas não é usado por `PortalDrawerPOD` | Duplicação de timeline de entrega |
| B2 | `dreamflow_eventos` tabela só escrita por `appPrestadorService.ts` (594 linhas mortas) | Código legado |
| B3 | `tracking_schema.sql` (3 tabelas) nunca migrado | Schema órfão |
| B4 | `fiscal_events` e `fiscal_logs` poderiam ser unificados | Tabelas gêmeas |

---

## PARTE 9 — EVENTOS DUPLICADOS, ÓRFÃOS E MORTOS

### 9.1 Eventos Duplicados

| Evento | Onde é Produzido | Duplicata em |
|--------|-----------------|-------------|
| OS criada | `fn_auditar_ordem_servico()` → `auditoria_operacional` | `f_trg_propagar_financeiro_os()` também lê OS |
| Escala criada | `registrar_historico_alocacao()` → `historico_alocacoes_escala` | `f_trg_propagar_financeiro_alocacao()` também lê alocação |
| Entrega concluída | `PortalDrawerPOD` (useMemo local) | `PortalTimeline` (recebe events prop) — mesma entrega, implementações diferentes |

### 9.2 Eventos Órfãos (Produzidos mas Nunca Lidos)

| Tabela | Escritas | Leituras | Status |
|--------|:--------:|:--------:|:------:|
| `os_historico` | 2 (redePrestadoresService) | **0** | 🗑️ Órfão |
| `portal_notificacoes` | 1+ (trigger `fn_notificar_mudanca_status_os`) | **0** (subscription comentada) | 🗑️ Órfão |
| `portal_ocorrencias` | Várias (Portal Cliente) | **0** pelo TMS | ⚠️ Órfão parcial |
| `portal_avaliacoes` | Várias (Portal Cliente) | **0** pelo TMS | ⚠️ Órfão parcial |
| `dreamflow_eventos` | Várias (appPrestadorService) | **0** | 🗑️ Órfão |
| `communication_events` | 3 (pedidosService + hub) | **Apenas UI CentralComunicacao** | ⚠️ Órfão parcial |

### 9.3 Eventos Mortos (Código que Não Executa)

| Código | Linhas | Motivo |
|--------|:------:|--------|
| `dispararComunicacaoOperacao()` em `communicationHubService.ts` | ~50 | Zero callers externos |
| `buscarNotificacoesPortal()` em `portalClienteService.ts` | ~30 | Zero callers |
| `criarNotificacaoPortal()` em `portalClienteService.ts` | ~30 | Zero callers |
| `marcarNotificacaoLida()` em `portalClienteService.ts` | ~30 | Zero callers |
| `buscarPODsPorAlocacao()` removido M61 | — | Já removido |
| `tracking_schema.sql` (3 tabelas) | 75 linhas | Nunca migrado |
| `appPrestadorService.ts` | 594 linhas | Zero importers em src/ |

### 9.4 Eventos Apenas Visuais

| Componente | Dados | Status |
|-----------|-------|--------|
| `PortalNotificacoes.tsx` | Local state `[]` | ❌ Nunca recebe dados reais |
| `PortalEconomia.tsx` | `Math.random()` | ❌ Placeholder |
| `PortalExecutiveDashboard.tsx` | Valores fixos | ❌ Placeholder |
| `PortalIAOperacional.tsx` | Dados mock | ❌ Placeholder |

---

## PARTE 10 — PLANO DE MIGRAÇÃO (5 FASES)

### Fase 1 — Fundação (Missão 99, ~5 dias)

**Objetivo:** Criar o Event Bus + tabela única de eventos + migrar primeiros produtores.

| Tarefa | Esforço | Depende |
|--------|:-------:|---------|
| 1.1 Criar migration `eventos_oficiais` + índices + RLS | 1 dia | — |
| 1.2 Criar `eventBusService.ts` com `publicarEvento()` + validação | 1 dia | 1.1 |
| 1.3 Criar tipos/constantes de evento compartilhados (`src/types/events.ts`) | 0.5 dia | — |
| 1.4 Adaptar trigger `registrar_historico_alocacao()` para também publicar em `eventos_oficiais` | 1 dia | 1.1, 1.2 |
| 1.5 Adaptar trigger `fn_auditar_ordem_servico()` para também publicar em `eventos_oficiais` | 1 dia | 1.1, 1.2 |
| 1.6 Adaptar trigger `fn_notificar_mudanca_status_os()` para publicar em `eventos_oficiais` | 0.5 dia | 1.1, 1.2 |
| 1.7 Validar com `npx tsc --noEmit` + Playwright | 0.5 dia | 1.1-1.6 |

### Fase 2 — Consumidores (Missão 100, ~5 dias)

**Objetivo:** Migrar as timelines para consumir `eventos_oficiais`.

| Tarefa | Esforço | Depende |
|--------|:-------:|---------|
| 2.1 Criar hook `useEventos(tipos, filtros)` com Realtime subscription | 1 dia | 1.2 |
| 2.2 Migrar TorreControle para usar `useEventos` (remove 5 queries) | 1.5 dias | 2.1 |
| 2.3 Migrar TabOperacional NOC para usar `useEventos` (remove OR query) | 1 dia | 2.1 |
| 2.4 Unificar `CteTimeline` e `MdfeTimeline` em `FiscalTimeline` único | 0.5 dia | 1.2 |
| 2.5 Migrar `PortalDrawerPOD` para usar `eventos_oficiais` + `PortalTimeline` | 1 dia | 2.1 |

### Fase 3 — Notificações (Missão 101, ~5 dias)

**Objetivo:** Conectar `portal_notificacoes` + `communication_events` ao Event Bus.

| Tarefa | Esforço | Depende |
|--------|:-------:|---------|
| 3.1 Ativar Realtime subscription de `portal_notificacoes` | 0.5 dia | — |
| 3.2 Criar `notificadorService.ts` que lê `eventos_oficiais` e escreve em `portal_notificacoes` | 1 dia | 1.2 |
| 3.3 Conectar `PortalNotificacoes.tsx` ao service | 0.5 dia | 3.2 |
| 3.4 Remover `simulationMode` do `communicationHubService` | 0.5 dia | — |
| 3.5 Criar tabela `notificacao_preferencias` + CRUD | 1 dia | — |
| 3.6 Remover `portal_notificacoes` trigger antigo (duplicado pelo notificador) | 0.5 dia | 3.2 |
| 3.7 Validar com Playwright (7 testes do Portal Cliente + notificações) | 1 dia | 3.1-3.6 |

### Fase 4 — Limpeza (Missão 102, ~5 dias)

**Objetivo:** Remover tabelas órfãs, código morto, componentes placeholders.

| Tarefa | Esforço |
|--------|:-------:|
| 4.1 Remover `os_historico` (migrar 2 escritas para eventos_oficiais primeiro) | 0.5 dia |
| 4.2 Remover `dreamflow_eventos` (tabela + código em appPrestadorService) | 0.5 dia |
| 4.3 Remover `tracking_schema.sql` (schema órfão) | 0.5 dia |
| 4.4 Remover código morto do `communicationHubService` (`dispararComunicacaoOperacao`) | 0.5 dia |
| 4.5 Remover 3 funções mortas em `portalClienteService` | 0.5 dia |
| 4.6 Remover/`@deprecated` componentes placeholders (PortalEconomia, PortalExecutiveDashboard, PortalIAOperacional, etc.) | 1 dia |
| 4.7 Remover `appPrestadorService.ts` (594 linhas mortas) | 0.5 dia |
| 4.8 Remover queries mortas no TabExecutivo | 0.5 dia |
| 4.9 Consolidar timeline do Drawer com PortalTimeline | 1 dia |
| 4.10 Validar com `npx tsc --noEmit` + full Playwright regression | 1 dia |

### Fase 5 — Webhooks + API Externa (Missão 103, ~5 dias)

**Objetivo:** Preparar para consumo externo.

| Tarefa | Esforço |
|--------|:-------:|
| 5.1 Criar tabela `webhook_configs` + CRUD | 1 dia |
| 5.2 Criar `webhookDispatcherService.ts` com retry + log | 1.5 dias |
| 5.3 Criar UI de configuração de webhooks | 1.5 dias |
| 5.4 Criar endpoint público de eventos (Edge Function ou API Route) | 1 dia |

---

## PARTE 11 — RECOMENDAÇÃO PARA MISSÃO 99

### Prioridade Máxima: Fase 1 — Fundação do Event Bus

**Missão 99** deve focar exclusivamente em:

1. **Migration SQL:** Criar `eventos_oficiais` + índices + RLS + trigger de updated_at
2. **`src/types/events.ts`:** Tipos compartilhados (`EventoOficial`, `EventSource`, `EventVisibility`, enum `EventType`)
3. **`src/services/ia/eventBusService.ts`:** `publicarEvento()` com validação, persistência, e notificação Realtime
4. **Adaptar trigger `registrar_historico_alocacao()`** para publicar em `eventos_oficiais`
5. **Adaptar trigger `fn_auditar_ordem_servico()`** para publicar em `eventos_oficiais`
6. **Adaptar trigger `fn_notificar_mudanca_status_os()`** para publicar em `eventos_oficiais`
7. **Validar:** `npx tsc --noEmit` (0 erros) + `npm run build` + Playwright (regressão completa)

### Não Fazer em M99

- ❌ Não modificar timelines ainda (Fase 2)
- ❌ Não conectar notificações ainda (Fase 3)
- ❌ Não remover tabelas antigas ainda (Fase 4)
- ❌ Não criar webhooks ainda (Fase 5)

Apenas criar a fundação. Coexistência total com o sistema atual. Nada é removido — apenas adicionado.

---

## PARTE 12 — PLAYWRIGHT (VALIDAÇÃO)

### 12.1 Testes para Missão 98 (Auditoria)

Nenhum teste novo é necessário para a missão 98 — é uma missão de auditoria e arquitetura.

### 12.2 Testes para Missão 99 (Event Bus)

Os seguintes testes deverão ser criados em M99:

| Teste | Cenário | O que validar |
|-------|---------|--------------|
| 1 | OS criada → evento publicado | `eventos_oficiais` contém registro |
| 2 | Escala aceita → evento publicado | `eventos_oficiais` contém evento `escala.alocacao.aceita` |
| 3 | OS status change → evento publicado | `eventos_oficiais` contém `os.ordem_servico.status_changed` |
| 4 | Realtime subscription recebe evento | Callback dispara via `useEventos` |
| 5 | Payload do evento contém dados corretos | entity_id, event_type, timestamp, source |
| 6 | Evento sem tenant não é criado | RLS valida tenant_id |
| 7 | Regressão: Dashboard continua funcionando | 27/27 testes M55 passam |
| 8 | Regressão: Portal Cliente continua funcionando | 7/7 testes M55-C2 passam |

---

## APÊNDICE A — INVENTÁRIO COMPLETO DE TABELAS DE EVENTO

| # | Tabela | Categoria | Migração | Status |
|---|--------|-----------|----------|--------|
| 1 | `historico_alocacoes_escala` | Operacional | `20260522_alocacoes_escala.sql` | ✅ Ativo |
| 2 | `os_historico` | Operacional | `supabase_schema.sql` (sem migration dedicada) | ⚠️ Órfão |
| 3 | `contratos_historico` | Contrato | `contratos_enterprise.sql` | ✅ Ativo |
| 4 | `fiscal_historico_status` | Fiscal | `20260531_fiscal_historico_status.sql` | ✅ Ativo |
| 5 | `crm_historico` | CRM | `20260517000001_correcao_3_crm_real.sql` | ✅ Ativo |
| 6 | `portal_notificacoes` | Portal | `portal_cliente_enterprise.sql` | ⚠️ Órfão |
| 7 | `portal_ocorrencias` | Portal | `portal_cliente_enterprise.sql` | ⚠️ Órfão parcial |
| 8 | `portal_avaliacoes` | Portal | `portal_cliente_enterprise.sql` | ⚠️ Órfão parcial |
| 9 | `portal_tracking_realtime` | Tracking | `portal_cliente_enterprise.sql` | 💀 Fantasma |
| 10 | `tracking_eventos` | Tracking | `src/lib/tracking_schema.sql` | 💀 Schema órfão |
| 11 | `tracking_links` | Tracking | `src/lib/tracking_schema.sql` | 💀 Schema órfão |
| 12 | `tracking_notificacoes_destinatario` | Tracking | `src/lib/tracking_schema.sql` | 💀 Schema órfão |
| 13 | `tracking_public_links` | Tracking | `20260630000010_m46` | ✅ Ativo |
| 14 | `communication_events` | Comunicação | `20260630000010_m46` | ⚠️ Sem consumidores |
| 15 | `comunicacoes_mensagens` | Comunicação | `20260622_central_ia_modo_seguro.sql` | ✅ Ativo |
| 16 | `comunicacao_destinatarios` | Comunicação | `src/lib/comunicacao_schema.sql` | 💀 Schema órfão |
| 17 | `aniversarios_log` | Comunicação | `src/lib/comunicacao_schema.sql` | 💀 Schema órfão |
| 18 | `ia_logs` | IA | `20260517000005_correcao_6_central_automacoes.sql` | ✅ Ativo |
| 19 | `automacoes_logs` | IA | `20260622_central_ia_modo_seguro.sql` | ✅ Ativo |
| 20 | `ia_decisoes_logs` | IA | `sql/ia_automacao_central.sql` | 🔴 Script standalone |
| 21 | `raciocinio_auditoria` | IA | `20260709_f303` | ✅ Ativo |
| 22 | `ia_governanca_log` | IA | `20260717_f35` | ✅ Ativo |
| 23 | `ia_integracoes_externas_logs` | IA | `202607200003_f37` | ✅ Ativo |
| 24 | `ia_auditoria_performance` | IA | `202607210001_f38` | ✅ Ativo |
| 25 | `ia_fluxos_execucao_log` | IA | `202607220001_f39` | ✅ Ativo |
| 26 | `memoria_eventos` | IA | `20260715_f33` | ✅ Ativo |
| 27 | `ia_aprendizado_eventos` | IA | `202607230001_f40` | ✅ Ativo |
| 28 | `ia_historico_indicadores` | IA | `20260713_f31` | ✅ Ativo |
| 29 | `ia_historico_trabalho` | IA | `20260714_f32` | ✅ Ativo |
| 30 | `diretor_virtual_eventos_ia` | IA | `20260704_f27_1` | ✅ Ativo |
| 31 | `ia_comunicacoes_robos` | IA | `20260705_f28` | ✅ Ativo |
| 32 | `auth_eventos_auditoria` | Auth | `20260728000050_missao50_auth_real.sql` | ✅ Ativo |
| 33 | `auditoria_operacional` | Audit | `20260626_missao03_operacao_enterprise.sql` | ✅ Ativo |
| 34 | `security_violation_log` | Security | `20260626_missao01_seguranca_enterprise.sql` | ✅ Ativo |
| 35 | `fiscal_logs` | Fiscal | `20260602_central_fiscal_fundacao.sql` | ✅ Ativo |
| 36 | `fiscal_events` | Fiscal | `20260602_central_fiscal_fundacao.sql` | ✅ Ativo |
| 37 | `patio_eventos` | Pátio | `20260729000053_missao53_controle_patio.sql` | ✅ Ativo |
| 38 | `patio_alertas` | Pátio | `20260729000053_missao53_controle_patio.sql` | ✅ Ativo |
| 39 | `integracoes_logs` | Integração | `20260517000003_correcao_4_comunicacao_real.sql` | ✅ Ativo |
| 40 | `prestador_notificacoes` | App Motorista | `src/lib/app_prestador_schema.sql` | 💀 Schema órfão |
| 41 | `dreamflow_eventos` | App Motorista | `src/lib/app_prestador_schema.sql` | 💀 Órfão |
| 42 | `combustivel_alertas` | Combustível | `src/lib/combustiveis_schema.sql` | 💀 Schema órfão |
| 43 | `combustivel_sync_logs` | Combustível | `src/lib/combustiveis_schema.sql` | 💀 Schema órfão |
| 44 | `ocorrencias` | Operacional | `20260630000001_m44a_tabela_ocorrencias.sql` | ✅ Ativo |
| 45 | `financeiro_receber_audit` | Financeiro | `20260626_enterprise_hardening.sql` | ✅ Ativo |
| 46 | `financeiro_prestador_auditoria` | Financeiro | `auditoriaPrestadorService.ts` (service) | ✅ Ativo |
| 47 | `escalonamentos_humanos` | IA | `20260517000009_correcao_9_torre_operacional.sql` | ✅ Ativo |

---

## APÊNDICE B — TRIGGERS EVENT-GENERATING (14 ATIVOS)

| # | Função | Tabela Fonte | Tabela Destino | Eventos |
|---|--------|-------------|---------------|---------|
| 1 | `trg_ia_logs_escalonamento()` | `ia_logs` | `escalonamentos_humanos` | Escalona IA para humano |
| 2 | `trg_escala_validacoes()` | `escala_operacional` (DEPRECATED) | `escalonamentos_humanos` | Conflito motorista/veículo |
| 3 | `registrar_historico_alocacao()` | `alocacoes_escala` | `historico_alocacoes_escala` | 6 tipos de evento de alocação |
| 4 | `audit_financeiro_receber()` | `financeiro_receber` | `financeiro_receber_audit` | Valor/status audit |
| 5 | `f_trg_propagar_financeiro_alocacao()` | `alocacoes_escala` | 5 tabelas financeiras | Propagação financeira |
| 6 | `f_trg_cancelar_financeiro_escala()` | `alocacoes_escala` | 4 tabelas financeiras | Cancelamento financeiro |
| 7 | `fn_auditar_ordem_servico()` | `ordens_servico` | `auditoria_operacional` | OS audit trail |
| 8 | `fn_notificar_mudanca_status_os()` | `ordens_servico` | `portal_notificacoes` | Notificação de status |
| 9 | `check_automacoes_instrucoes_ativa()` | `automacoes_instrucoes` | `automacoes_instrucoes` (UPDATE) | Desativa instruções concorrentes |
| 10 | `normalizar_os_fks()` | `ordens_servico` | `ordens_servico` (UPDATE) | Normalização UUID↔TEXT |
| 11 | `audit_rotina_alteracao()` | `rotinas_ia` | `ia_logs` | Audit de rotina |
| 12 | `log_rotina_criada()` | `rotinas_ia` | `ia_logs` | Log de criação |
| 13 | `f_trg_propagar_financeiro_os()` | `ordens_servico` | 4 tabelas financeiras | Propagação financeira OS |
| 14 | `f_trg_expiracao_oportunidade()` | `rede_oportunidades` | `rede_oportunidades` (UPDATE) | Expiração automática |

---

## APÊNDICE C — SERVIÇOS PRODUTORES DE EVENTO (45+)

| # | Serviço | Tabela(s) | Eventos |
|---|---------|-----------|---------|
| 1 | `centralIaService` | `automacoes_logs`, `comunicacoes_mensagens` | Logs de robôs IA |
| 2 | `actionEngineService` | `ia_execucoes_ferramentas`, `ia_logs` | Execução de ferramentas |
| 3 | `conectoresService` | `ia_execucoes_conectores` | Execução de conectores |
| 4 | `memoriaService` | `memoria_eventos`, `memoria_entidades`, `memoria_conversas` | Eventos de memória |
| 5 | `escalaService` | `historico_alocacoes_escala` | Eventos de escala |
| 6 | `redePrestadoresService` | `os_historico` | Eventos de rede |
| 7 | `patioService` | `patio_eventos`, `patio_alertas` | Eventos de pátio |
| 8 | `communicationHubService` | `communication_events` | Eventos de comunicação (14 tipos) |
| 9 | `portalClienteService` | `portal_notificacoes` | Notificações do portal |
| 10 | `AuthContext` | `auth_eventos_auditoria` | Eventos de autenticação |
| 11 | `aiProviderManager` | `ia_logs` | Logs de provider IA |
| 12 | `workforceOrchestratorService` | `ia_historico_trabalho`, `ia_trabalhos` | Eventos de orquestrador |
| 13 | `gestaoFuncionariosService` | `ia_indicadores`, `ia_historico_indicadores` | Eventos de KPI |
| 14 | `enterpriseOrchestratorService` | `ia_fluxos_execucao_log` | Eventos de fluxo |
| 15 | `autoEvolutionEngineService` | `ia_aprendizado_eventos` | Eventos de aprendizado |
| 16 | `comunicacaoGatewayService` | `comunicacoes_mensagens` | Mensagens de comunicação |
| 17 | `cteService` | `fiscal_events`, `fiscal_logs` | Eventos fiscais |
| 18 | `fiscalStatusService` | `fiscal_historico_status`, `fiscal_events` | Status fiscal |
| 19 | `focusService` | `fiscal_logs` | Processamento Focus |
| 20 | `contratosService` | `contratos_historico` | Eventos de contrato |
| 21 | `integrationLogger` | `integration_logs` | Logs de integração |
| 22 | `hubComunicacaoService` | `comunicacoes_mensagens`, `integracoes_logs` | Mensagens do hub |
| 23 | `auditoriaPrestadorService` | `financeiro_prestador_auditoria` | Auditoria de prestador |
| 24+ | (+20 outros services IA) | `automacoes_logs`, `ia_logs` | Logs diversos IA |

---

## APÊNDICE D — REGRA DE OURO

> A partir desta missão, qualquer comunicação da plataforma deverá nascer de um evento oficial publicado em `eventos_oficiais`. Nenhum módulo poderá enviar notificações diretamente. Todos deverão consumir a Central de Comunicação Enterprise. A Timeline oficial passa a ser a fonte única de eventos da Conexão Express.
>
> **As 6 timelines existentes serão unificadas em uma única fonte.**
> **As 44+ tabelas de evento serão consolidadas em `eventos_oficiais`.**
> **Os 14 triggers existentes continuarão coexistindo até a migração completa (Fase 4).**
> **Nenhum código novo deverá criar uma segunda timeline ou tabela de evento paralela.**
