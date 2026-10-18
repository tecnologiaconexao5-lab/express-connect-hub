# RELATORIO DE IMPLEMENTACAO — TMS-027 FASE 2
## Monitoramento Operacional em Tempo Real

**Data:** 2026-08-01
**Versao:** 1.0
**Dependencias:** RELATORIO_TMS_027_TORRE_APP.md, RELATORIO_IMPLEMENTACAO_TMS_027_FASE_1A.md, RELATORIO_IMPLEMENTACAO_TMS_027_FASE_1B.md

---

## 1. RESUMO

Fase 2 transforma o mapa e os paineis da Torre de Controle em uma visao operacional completa.
Marcadores agora refletem o estado real de cada operacao (deslocamento, coleta, entrega, parado, ocorrencia).
O popup do mapa foi enriquecido com dados operacionais e botao de acesso direto ao Painel Detalhado da OS.
Filtros de GPS foram adicionados. Indicadores do mapa mostram contagens em tempo real.
A legenda foi expandida para 8 estados visuais.

### Metricas de Validacao

| Item | Resultado |
|------|-----------|
| `npx tsc --noEmit` | 0 erros |
| `npm run build` | OK (53.85s) |
| `npx vitest run` | 31/31 testes passando |
| Queries de escrita | 0 (apenas SELECT / leitura) |
| Migrations SQL | 0 |
| Canais Realtime novos | 0 (reutilizados os 5 existentes) |

---

## 2. ARQUIVOS CRIADOS / MODIFICADOS

### Criados

| Arquivo | Linhas | Descricao |
|---------|:------:|-----------|
| `src/components/torre-controle/markerAdapter.ts` | 167 | Modelo `EnrichedMarker` + funcoes de normalizacao (GPS, status operacional, SLA) |

### Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/MapboxMap.tsx` | `MapLocation` expandido (+10 campos), +3 novos status (`em_coleta`, `em_entrega`, `parado`), popup enriquecido (driver, veiculo, etapa, GPS state, velocidade, precisao, origem, destino, botao "Ver detalhes"), legenda expandida (8 estados), cluster colors novos |
| `src/pages/TorreControle.tsx` | +import markerAdapter, markers computados com `EnrichedMarker`, +9 filtros (GPS ativo, GPS antigo, sem GPS, parados), +indicadores do mapa (6 badges), `handleOpenDetails` no mapa→Sheet |

---

## 3. MODELO ENRIQUECIDO DE MARCADORES

### `EnrichedMarker` — 32 campos

| Campo | Origem | Descricao |
|-------|--------|-----------|
| `id` | `ordens_servico.id` | ID da OS |
| `operationId` | `alocacoes_escala.id` | ID da alocacao (quando disponivel) |
| `orderServiceId` | `ordens_servico.id` | ID da OS |
| `allocationId` | `alocacoes_escala.id` | ID da alocacao |
| `driverId` | `prestador_id` | ID do motorista |
| `driverName` | `ordens_servico.prestador` | Nome do prestador |
| `vehicleType` | `alocacoes_escala.tipo_veiculo` ou `osForm.veiculoTipo` | Tipo de veiculo |
| `plate` | `alocacoes_escala.placa` | Placa |
| `latitude` / `longitude` | GPS ao vivo (`trackingPositions`) ou coordenada estatica da OS | Coordenadas |
| `accuracy` | `trackingPosition.precisao` | Precisao GPS em metros |
| `speed` | `trackingPosition.velocidade` | Velocidade em km/h |
| `heading` | `trackingPosition.direcao` | Direcao em graus |
| `lastLocationAt` | `trackingPosition.captured_at` | Data/hora da ultima posicao |
| `operationalStatus` | `computeOperationalStatus()` | Estado operacional (ver tabela abaixo) |
| `currentStage` | `metadata->app_motorista->etapa_atual` | Etapa atual no App |
| `clientName` | `ordens_servico.cliente` | Nome do cliente |
| `origin` / `destination` | `alocacoes_escala.origem` / `destino` | Origem e destino |
| `nextStop` | — | Proxima parada (reservado) |
| `gpsState` | `computeGpsState()` | Qualidade do GPS |
| `occurrenceState` | `ocorrencias` | Se ha ocorrencia ativa |
| `slaState` | `computeSlaState()` | Estado do SLA |
| `previsaoTermino` | `ordens_servico.previsaoTermino` | Previsao de termino |
| `osNumero` | `ordens_servico.numero` | Numero da OS |
| `osStatus` / `alocStatus` | Status da OS / alocacao | |

### 7 estados operacionais

| Estado | Cor | Condicao | Visual no mapa |
|--------|-----|----------|----------------|
| `em_deslocamento` | Verde (#22c55e) | `em_rota` + etapa de rota | Caminhao verde |
| `em_coleta` | Azul (#0ea5e9) | Etapa de coleta/carregamento | Pacote azul |
| `em_entrega` | Laranja (#f97316) | Etapa de entrega/descarga | Pin laranja |
| `parado` | Ambar (#f59e0b) | Sem movimento detectado | Relogio ambar |
| `com_ocorrencia` | Vermelho (#ef4444) | Ocorrencia ativa | Alerta vermelho |
| `aguardando_aceite` | Roxo (#a855f7) | Aguardando prestador | Caminhao roxo |
| `finalizado` | Cinza (#6b7280) | Concluido/cancelado | Check cinza |

### 5 estados de GPS

| Estado | Condicao | Cor no popup | Indicador |
|--------|----------|-------------|-----------|
| `atualizado` | Ultima posicao ≤ 15 min | Verde | GPS Ativo |
| `antigo` | 16-60 min | Ambar | GPS Antigo |
| `muito_antigo` | > 60 min | Vermelho | GPS Antigo |
| `indisponivel` | Operacao ativa sem GPS | Vermelho | Sem GPS |
| `sem_rastreamento` | Operacao inativa sem GPS | Cinza | — |

---

## 4. POPUP ENRIQUECIDO

Ao clicar em um marcador, o popup agora exibe:

1. **Cabecalho**: OS numero + status badge
2. **Motorista**: nome do prestador (se disponivel)
3. **Veiculo**: tipo + placa (se disponivel)
4. **Cliente**: nome do cliente
5. **Etapa atual**: etapa do App Motorista (se disponivel)
6. **Estado GPS**: atualizado/desatualizado/muito antigo + tempo desde ultima posicao
7. **Velocidade**: km/h (se > 0)
8. **Precisao**: ±metros (se disponivel)
9. **Origem / Destino**: texto (se disponivel)
10. **Previsao**: data/hora formatada
11. **Botao "Ver detalhes da OS"**: abre `DetalhesOperacaoSheet`

---

## 5. INDICADORES DO MAPA

Badges posicionados entre os filtros e o mapa com contagens em tempo real:

| Indicador | Cor | Significado |
|-----------|-----|-------------|
| GPS Ativo | Verde | Operacoes com GPS ≤ 15 min |
| GPS Antigo | Laranja | Operacoes com GPS > 15 min |
| Sem GPS | Vermelho | Operacoes ativas sem GPS |
| Parados | Ambar | Motoristas parados |
| Ocorrencias | Rosa | Operacoes com ocorrencia |
| Total | Cinza | Total de marcadores no mapa |

---

## 6. FILTROS

### Filtros existentes mantidos
- Todas
- Em Rota (agora inclui em_coleta + em_entrega + em_deslocamento)
- Atrasadas
- Ocorrencias
- Concluidas

### Novos filtros adicionados
| Filtro | Descricao |
|--------|-----------|
| GPS Ativo | `gpsState === "atualizado"` |
| GPS Antigo | `gpsState === "antigo"` ou `"muito_antigo"` |
| Sem GPS | `gpsState === "indisponivel"` |
| Parados | `status === "parado"` |

Filtros afetam tanto os marcadores no mapa quanto os indicadores (estes permanecem mostrando totais, nao filtrados).

---

## 7. INTEGRACAO MAPA ↔ PAINEL DETALHADO

### Fluxo
```
Clique no marcador → Popup enriquecido
                        ↓
                [Ver detalhes da OS]
                        ↓
            setSelectedActionOsId(id)
            setSheetOpen(true)
                        ↓
            DetalhesOperacaoSheet abre
```

### Conexao Timeline/Ocorrencias → Mapa

A propriedade `selectedLocationId` do MapboxMap ja suporta `flyTo()` no marcador selecionado. Quando um item da timeline ou ocorrencia e clicado (via acoes prioritarias), o `selectedActionOsId` e setado, e o mapa centraliza no marcador correspondente.

### Navegacao reversa

Ao fechar o Sheet (`onOpenChange`), `selectedActionOsId` e limpo, removendo a selecao do mapa.

---

## 8. ATUALIZACAO AUTOMATICA

Reutilizados os 5 canais Realtime existentes:

| Canal | Tabela | Efeito |
|-------|--------|--------|
| `torre-realtime-tracking` | `portal_tracking_realtime` INSERT | Atualiza `trackingPositions` → markers recalculados via `useMemo` |
| `torre-realtime-alocacoes` | `alocacoes_escala` * | Chama `fetchData()` → markers recalculados |
| `torre-realtime-os` | `ordens_servico` * | Chama `fetchData()` |
| `torre-realtime-ocorrencias` | `ocorrencias` INSERT | Chama `fetchOcorrencias()` + `fetchTimeline()` |
| `torre-realtime-escalonamentos` | `escalonamentos_humanos` * | Chama `fetchTimeline()` |

Nenhum canal novo foi adicionado.

---

## 9. ALERTAS OPERACIONAIS CONSOLIDADOS

Os seguintes alertas sao detectados pelo sistema existente e visiveis na interface:

| Alerta | Onde aparece | Fonte |
|--------|-------------|-------|
| Operacao ativa sem GPS | Indicadores ("Sem GPS") + pendencias no Sheet | `gpsState === "indisponivel"` |
| GPS muito antigo | Indicadores ("GPS Antigo") + popup do mapa | `gpsState === "muito_antigo"` |
| Ocorrencia critica aberta | Acoes Prioritarias + aba Ocorrencias + KPI | `ocorrencias` |
| Operacao atrasada | Acoes Prioritarias + KPI + popup | `slaState === "atrasado"` |
| Evidencia pendente | KPI "Sem Comprovante" + pendencias no Sheet | `alocacoes_escala.comprovante_url IS NULL` |
| Operacao sem prestador | Acoes Prioritarias | OS sem `prestador_id` |
| Baixa incompleta | Pendencias no Sheet | KM realizado ausente |

---

## 10. LIMITACOES ATUAIS

| Limitacao | Motivo |
|-----------|--------|
| `nextStop` sempre null | Dados de paradas nao integrados ao modelo de marcador |
| Sem playback de rota | Requer alteracao no MapboxMap + historico de posicoes |
| Filtro por periodo nao implementado | Sem suporte no backend atual |
| Filtro por tipo de veiculo / prestador / cliente | Campos disponiveis mas filtro UI nao implementado |
| Tempo parado nao calculado | Sem dados suficientes de velocidade sequencial |
| Alertas consolidados sao visuais (sem push/notificacao) | Infra de notificacao nao implementada nesta fase |

---

## 11. DEPENDENCIAS DE BACKEND IDENTIFICADAS

| ID | Dependencia | Impacto |
|:--:|-------------|---------|
| B01 | Colunas `alocacoes_escala.placa` e `tipo_veiculo` precisam ser populadas | Atualmente muitos registros tem esses campos null |
| B02 | JOIN com `prestadores` na query de `osAtivas` | `driverName` usa `ordens_servico.prestador` (texto) em vez de `prestadores.nome_completo` |
| B03 | `metadata->app_motorista->etapa_atual` precisa ser populado pelo App Flutter | Etapa atual so aparece quando o App esta ativo |

---

## 12. RECOMENDACAO PARA PROXIMA FASE

1. **Filtros avancados** — tipo de veiculo, prestador, cliente, periodo
2. **Mini-mapa no Sheet** — incluir `MapboxMap` com a ultima posicao dentro da aba GPS
3. **Playback de rota** — replay do trajeto usando `portal_tracking_realtime` historico
4. **Tempo parado** — implementar deteccao no App Flutter + coluna `tempo_parado_segundos`
5. **Alertas push** — Firebase Cloud Messaging para alertas criticos
6. **Playwright E2E** — testes para os 20 cenarios de homologacao

---

**Fim do relatorio.**
