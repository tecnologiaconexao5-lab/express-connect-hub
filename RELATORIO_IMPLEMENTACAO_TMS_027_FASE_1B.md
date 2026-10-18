# RELATORIO DE IMPLEMENTACAO — TMS-027 FASE 1B
## Integracao Real App Prestador → Torre de Controle

**Data:** 2026-08-01
**Versao:** 1.0
**Dependencias:** RELATORIO_TMS_027_TORRE_APP.md, RELATORIO_IMPLEMENTACAO_TMS_027_FASE_1A.md

---

## 1. RESUMO

Fase 1B conclui a integracao dos eventos gerados pelo App Conexao Prestador com a Torre de Controle.
Todos os 15 event_types do App agora sao consumidos, mapeados e exibidos corretamente na Timeline.
KPIs foram corrigidos para usar `alocacoes_escala` como fonte primaria.
Pendencias foram revisadas para eliminar falsos positivos.
GPS ganhou estados visuais contextuais.

### Metricas de Validacao

| Item | Resultado |
|------|-----------|
| `npx tsc --noEmit` | 0 erros |
| `npm run build` | OK (44.21s) |
| `npx vitest run` | 31/31 testes passando |
| Queries de escrita | 0 (apenas SELECT / leitura) |
| Migrations SQL | 0 |
| Alteracoes de RPC | 0 |
| Alteracoes de RLS | 0 |

---

## 2. ARQUIVOS CRIADOS / MODIFICADOS

### Criados

| Arquivo | Linhas | Descricao |
|---------|:------:|-----------|
| `src/components/torre-controle/eventAdapter.ts` | 212 | Adaptador universal de eventos — normaliza eventos de 3 fontes para formato unico |

### Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/torre-controle/types.ts` | +9 novos `TipoEventoTimeline` (app_aceite, app_chegada, app_coleta, app_deslocamento, app_entrega, app_finalizacao, app_evidencia, app_assinatura, app_documento, app_gps, app_generico). +4 campos em `TimelineEvent` (source, stage, locationText, evidenceUrl) |
| `src/pages/TorreControle.tsx` | +import eventAdapter, +15 App event_types no filtro `fetchTimeline()`, +tipoMap expandido com App events, +icons/labels/cores para novos tipos, +query `alocacoes_escala` para KPIs corretos, +filtro de status em comprovantes |
| `src/components/torre-controle/DetalhesOperacaoSheet.tsx` | Pendencias: logica condicional (so em operacoes ativas, respeita `comprovanteObrigatorio`). GPS: 4 estados visuais. Ocorrencias: diferenciacao resolvida × aberta |

---

## 3. ADAPTADOR UNIVERSAL DE EVENTOS (`eventAdapter.ts`)

### Arquitetura

```
Fontes brutas (eventos_oficiais / operation_timeline_events / ocorrencias)
        │
        ▼
┌──────────────────────────────────────────────┐
│  eventAdapter.ts                              │
│                                               │
│  normalizarEvento(raw) → EventoNormalizado    │
│  isAppEventType(type) → boolean               │
│  isTMSEventType(type) → boolean               │
│  eventTypeToCategory(type) → CategoriaEvento  │
│  eventTypeToLabel(type) → string (pt-BR)      │
│  deduplicarEventos(eventos) → EventoNormalizado[] │
└──────────────────────────────────────────────┘
        │
        ▼
Torre de Controle (Timeline, Sheet, KPIs)
```

### 15 event_types do App mapeados

| event_type | Categoria | Label pt-BR | Tipo na Timeline |
|-----------|-----------|-------------|------------------|
| `operation_accepted` | aceite | Viagem aceita | `app_aceite` |
| `arrived_pickup` | chegada | Chegou na coleta | `app_chegada` |
| `loading_started` | coleta | Carregamento iniciado | `app_coleta` |
| `loading_finished` | coleta | Carregamento finalizado | `app_coleta` |
| `romaneio_informado` | documento | Romaneio informado | `app_documento` |
| `romaneio_foto` | evidencia | Foto do romaneio | `app_evidencia` |
| `km_registered` | deslocamento | KM registrado | `app_deslocamento` |
| `route_started` | deslocamento | Saiu em rota | `app_deslocamento` |
| `arrived_delivery` | chegada | Chegou na entrega | `app_chegada` |
| `unloading_started` | entrega | Descarga iniciada | `app_entrega` |
| `unloading_finished` | entrega | Descarga finalizada | `app_entrega` |
| `km_final` | deslocamento | KM final | `app_deslocamento` |
| `signature_captured` | assinatura | Assinatura capturada | `app_assinatura` |
| `pod_sent` | evidencia | POD enviado | `app_evidencia` |
| `operation_finished` | finalizacao | Servico finalizado | `app_finalizacao` |

### 11 event_types do TMS ja existentes mantidos

| event_type | Tipo na Timeline |
|-----------|------------------|
| `os.ordem_servico.criada` | `os_criada` |
| `os.ordem_servico.finalizada` | `os_concluida` |
| `os.ordem_servico.cancelada` | `os_atrasada` |
| `os.ordem_servico.status_changed` | `os_em_rota` |
| `escala.alocacao.aceita` | `os_em_rota` |
| `escala.alocacao.concluida` | `alocacao_concluida` |
| `escala.alocacao.cancelada` | `os_atrasada` |
| `escala.alocacao.recusada` | `os_atrasada` |
| `escala.alocacao.criada` | `os_criada` |
| `entrega.comprovante.pod_enviado` | `alocacao_concluida` |
| `portal.ocorrencia.aberta` | `ocorrencia_aberta` |

### Eventos desconhecidos

Qualquer event_type nao reconhecido recebe categoria `sistema` e tipo `app_generico` — nunca e descartado.

---

## 4. CORRECAO DE KPIs

| KPI | Antes (Fase 1A) | Depois (Fase 1B) |
|-----|-----------------|-------------------|
| **Em Rota** | `status OS === "saiu para rota"` / `"em operacao"` | `alocacoes_escala.status = "em_rota"` (fallback: status OS) |
| **Aguard. Aceite** | `status OS === "aguardando parceiro"` | `alocacoes_escala.status = "aguardando_aceite"` (fallback: status OS) |
| **Com Ocorrencia** | `status OS === "com ocorrencia"` | `alocacoes_escala.status = "ocorrencia"` (fallback: status OS) |
| **Atrasadas** | `previsaoTermino < Date.now()` | Mantido (ja correto) |
| **Concluidas Hoje** | `status OS === "finalizada"` | `alocacoes_escala.status = "concluida"` + `data_finalizacao` hoje (fallback: status OS) |
| **Sem Comprovante** | `comprovante_url IS NULL` | `comprovante_url IS NULL` + filtro por status ativos (`aceita`, `em_rota`, `concluida`, `ocorrencia`) |

### Metodo

Adicionada uma query leve em `fetchData()`:
```ts
supabase.from("alocacoes_escala").select("status, finalizada, data_finalizacao")
  .not("status", "in", '("cancelada","recusada")')
```
Os contadores de status da alocacao sao usados como fonte primaria, com fallback para os status da OS (compatibilidade com dados antigos).

---

## 5. CORRECAO DE PENDENCIAS

### Falsos positivos eliminados

| Pendencia | Antes (Fase 1A) | Depois (Fase 1B) |
|-----------|-----------------|-------------------|
| **Foto de entrega** | Sempre sinalizada se nao finalizada | So em operacoes `em_rota`/`ocorrencia`/`concluida`, respeita `comprovanteObrigatorio` |
| **Assinatura** | Sempre sinalizada se nao finalizada | Idem |
| **Canhoto** | Sempre sinalizado | So em operacoes ativas com evidencias |
| **Nome recebedor** | Sinalizado se vazio | Ignora "Motorista" (default do trigger) |
| **Ocorrencia** | Sinalizada se existir | Nao sinaliza se `status === "resolvida"/"concluida"/"fechada"` |
| **GPS** | Sinalizado em qualquer operacao | So em `status === "em_rota"` (motorista ativo) |

### Nova logica condicional

```ts
const exigeEvidencias = alocAtiva &&
  (status === "em_rota" || status === "ocorrencia" || status === "concluida" || finalizada);
const comprovanteObrigatorio = osForm?.comprovanteObrigatorio;
```

---

## 6. ESTADOS VISUAIS DE GPS

Implementados 4 estados no Sheet:

| Estado | Condicao | Cor | Icone |
|--------|----------|-----|-------|
| **Atualizado** | Ultima posicao ≤ 15 min | Verde (emerald) | CheckCircle |
| **Desatualizado** | 16-60 min | Ambar (amber) | Clock |
| **Muito antigo** | > 60 min | Vermelho (rose) | AlertTriangle |
| **Desconhecido** | Sem timestamp de captura | Cinza (slate) | AlertCircle |

Estado vazio tambem diferenciado:
- Operacao `em_rota` sem GPS → "GPS Indisponivel" (alerta)
- Outras operacoes sem GPS → "Nenhuma posicao GPS registrada" (informativo)

---

## 7. TIMELINE COM EVENTOS DO APP

### Antes (Fase 1A)
- Timeline da Torre filtrava apenas 11 event_types do TMS
- 15 event_types do App eram IGNORADOS

### Depois (Fase 1B)
- `fetchTimeline()` agora filtra 26 event_types (11 TMS + 15 App)
- Cada event_type do App e mapeado para um `TipoEventoTimeline` apropriado
- 10 novos icones/cores/labels adicionados aos mapas da Torre
- Eventos do App aparecem com prefixo `[App]` na descricao

---

## 8. REGRAS DE DEDUPLICACAO

O `eventAdapter.deduplicarEventos()` filtra eventos duplicados por:
1. `idempotency_key` no metadata (prioridade)
2. Combinacao `eventType::occurredAt` (fallback)

A deduplicacao e aplicada na camada de apresentacao — nao altera dados no banco.

---

## 9. ATUALIZACAO AUTOMATICA

A Torre ja utiliza 5 canais Realtime Supabase:
- `torre-realtime-os` → ordens_servico
- `torre-realtime-ocorrencias` → ocorrencias
- `torre-realtime-alocacoes` → alocacoes_escala
- `torre-realtime-escalonamentos` → escalonamentos_humanos
- `torre-realtime-tracking` → portal_tracking_realtime

Nenhum canal novo foi adicionado. A infraestrutura existente foi mantida.

O Sheet reflete mudancas via:
- `trackingPositions` (state da Torre atualizado por Realtime)
- `contextualTimelineEvents` (atualizado via `fetchTimeline()` chamado nos canais)
- Queries on-demand ao abrir o Sheet (`fetchAlocacoes`, `fetchOSFull`, `fetchPOD`, `fetchTracking`, `fetchComposicao`)

---

## 10. LIMITACOES AINDA EXISTENTES

| Limitacao | Motivo | Solucao futura |
|-----------|--------|----------------|
| `semComprovante` ainda usa `comprovante_url` | Nao e possivel fazer anti-join eficiente sem view SQL | Migration para criar view `vw_alocacoes_sem_pod` |
| Nomes de prestador/cliente exibidos como UUID | JOIN requer query adicional (ja documentado na Fase 1A) | Adicionar JOIN na query de alocacoes |
| Fotos do romaneio nao aparecem nas evidencias | Estao em `metadata->app_motorista`, nao em `entregas_protocolo` | Consultar metadata no Sheet |
| `operation_timeline_events` nao e consultado | Event Bus (`eventos_oficiais`) ja contem os mesmos eventos | Usar Event Bus como fonte unica |
| Sem playback de rota | Requer alteracao no `MapboxMap` | Fase 2 do roadmap TMS-027 |

---

## 11. DEPENDENCIAS DE BACKEND IDENTIFICADAS

| ID | Dependencia | Impacto |
|:--:|-------------|---------|
| B01 | Migration `m133d4_fix_rpc_app_security.sql` (STABLE→VOLATILE) | RPC `f_avancar_etapa_app_motorista` ainda marcada STABLE — eventos podem falhar em race condition |
| B02 | View `vw_alocacoes_sem_pod` | KPI `semComprovante` 100% preciso sem anti-join manual |
| B03 | Coluna `sla_status` em `ordens_servico` | SLA calculado no frontend — nao persiste entre recargas |
| B04 | Migration RLS fix `m133d4` (remover PUBLIC+anon) | App Flutter pode perder acesso se grants forem restritos sem aviso previo |

---

## 12. RECOMENDACAO PARA PROXIMA FASE (1C ou 2)

1. **Aplicar correcoes bloqueadas** (B01, B04) — requer autorizacao DBA
2. **Adicionar JOIN na query de alocacoes** — nomes de prestador/cliente em vez de UUIDs
3. **Consultar `operation_timeline_events`** como fonte complementar de timeline (eventos com etapa + motorista + coordenadas)
4. **Mapa no Sheet** — incluir miniatura do `MapboxMap` com ultima posicao
5. **Playwright E2E** — criar testes para os 15 cenarios de homologacao listados na spec

---

**Fim do relatorio.**
