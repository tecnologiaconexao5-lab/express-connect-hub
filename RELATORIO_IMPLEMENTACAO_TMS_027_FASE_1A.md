# RELATORIO DE IMPLEMENTACAO — TMS-027 FASE 1A
## Painel Detalhado da Ordem de Servico — Torre de Controle

**Data:** 2026-08-01
**Versao:** 1.0
**Dependencias:** RELATORIO_FINAL_TMS_026.md, RELATORIO_TMS_027_TORRE_APP.md

---

## 1. RESUMO

Implementada a primeira versao funcional do Painel Detalhado da Ordem de Servico dentro da Torre de Controle. O operador agora pode clicar em qualquer acao prioritaria e abrir um Sheet lateral completo com 8 abas de informacoes consolidadas.

### Metricas de Validacao

| Item | Resultado |
|------|-----------|
| `npx tsc --noEmit` | 0 erros |
| `npm run build` | OK (44.09s) |
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
| `src/components/torre-controle/DetalhesOperacaoSheet.tsx` | 540 | Componente principal do painel detalhado |
| `src/components/torre-controle/types.ts` | 18 | Tipos compartilhados (TimelineEvent, TipoEventoTimeline) |

### Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/TorreControle.tsx` | +2 imports, +1 state (`sheetOpen`), ActionItem onClick abre o Sheet, painel inline substituido por card compacto com botao "Ver detalhes", +`<DetalhesOperacaoSheet>` no final |

---

## 3. ARQUITETURA DO COMPONENTE

```
DetalhesOperacaoSheet
├── Sheet (shadcn/ui slide-in direita)
│   ├── SheetHeader (OS numero, status, prioridade, cliente, prestador, placa)
│   └── Tabs (8 abas)
│       ├── Geral (status, prestador, veiculo, datas, km, pendencias)
│       ├── Detalhes (origem, destino, enderecos, carga, instrucoes)
│       ├── Escala (cards de cada alocacao vinculada)
│       ├── GPS (posicao, velocidade, precisao, bateria)
│       ├── Evidencias (fotos, assinatura, canhoto, recebedor)
│       ├── Ocorrencias (tipo, severidade, status)
│       ├── Financeiro (valor cliente, repasse, pedagio, composicao)
│       └── Timeline (eventos filtrados por OS)
```

### Dados exibidos por aba

| Aba | Campos | Origem dos dados |
|-----|--------|-----------------|
| **Geral** | OS#, status OS, status escala, etapa App, prioridade, responsavel, previsao termino, prestador, veiculo, placa, data programada, inicio/fim real, km previsto/realizado, pendencias, observacoes | `selectedOSData`, `selectedActionItem`, `alocacoes_escala`, `metadata->app_motorista`, `pod`, `liveTracking`, `entregas_protocolo` |
| **Detalhes** | Origem, destino, enderecos (cards por parada com tipo, logradouro, cep, contato, janela), tipo carga, descricao, volumes, peso, cubagem, pallets, notas fiscais, flags (refrigerada, ajudante, fragil, empilhavel, risco), instrucoes operacionais | `osFull`, `osForm.enderecos` |
| **Escala** | Cards por alocacao: ID, status, veiculo, placa, km, origem, destino, data escala, aceite, inicio/fim real, data finalizacao | `alocacoes_escala` (query por `ordem_servico_id`) |
| **GPS** | Latitude, longitude, velocidade, precisao, direcao, bateria, origem dados, capturado em, ultima atualizacao | `trackingService.obterPosicaoAtual()` + `trackingPositions` (realtime) |
| **Evidencias** | Nome recebedor, documento, data/hora entrega, status POD, foto entrega (thumbnail), foto canhoto (thumbnail), assinatura (thumbnail), observacao motorista | `podService.buscarPOD()` → `entregas_protocolo` |
| **Ocorrencias** | Tipo, severidade, status, descricao, data abertura | `selectedOSOcorrencia` (da Torre) |
| **Financeiro** | Valor cliente (frete), valor prestador (repasse), pedagio, ajudante, adicional, desconto. Composicao: margem bruta %, margem liquida %, impostos, seguro, custos operacionais | `alocacoes_escala.valor_*` + `composicao_financeira_os` |
| **Timeline** | Eventos filtrados por OS com descricao, timestamp relativo | `contextualTimelineEvents` (da Torre) |

### Pendencias detectadas automaticamente

| Pendencia | Condicao | Severidade |
|-----------|----------|:----------:|
| Foto de entrega | `!pod?.foto_entrega_url` | Alta |
| Assinatura do recebedor | `!pod?.assinatura_url` | Alta |
| Canhoto | `!pod?.foto_canhoto_url` | Media |
| Nome do recebedor | `!pod?.nome_recebedor` | Media |
| KM realizado | `!alocacaoAtiva.km_realizados && finalizada` | Media |
| Ocorrencia aberta | `selectedOSOcorrencia !== null` | Alta |
| GPS atualizado (>60min) | `lastUpdate > 60min` | Alta |
| GPS desatualizado (30-60min) | `30min < lastUpdate <= 60min` | Media |
| GPS indisponivel | `alocacaoAtiva.status === "em_rota" && !liveTracking` | Alta |

---

## 4. COMPONENTES REUTILIZADOS

| Componente | Origem | Uso |
|-----------|--------|-----|
| `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` | `@/components/ui/sheet` | Container do painel |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` | Navegacao entre abas |
| `Badge` | `@/components/ui/badge` | Status, prioridade, flags |
| `Card`, `CardContent` | `@/components/ui/card` | Cards de endereco e alocacao |
| `Button` | `@/components/ui/button` | Botao "Ver detalhes" |
| `fromOSRow`, `OSRow` | `src/lib/dbMappers` | Mapeamento OS |
| `obterLabelStatus` | `src/components/operacao/escalaStatus` | Labels de status |
| `obterPosicaoAtual`, `TrackingPosition` | `src/services/rastreamento/trackingService` | GPS |
| `buscarPOD`, `PODData` | `src/services/podService` | Evidencias |
| `ActionItem`, `ComprovantePendente` | `src/lib/acoesPrioritarias` | Tipos |
| `TimelineEvent`, `TipoEventoTimeline` | `src/components/torre-controle/types` | Timeline |

---

## 5. CAMPOS AINDA INDISPONIVEIS

Estes campos estao previstos no contrato TMS-027 mas ainda nao podem ser exibidos porque:

| Campo | Motivo | Acao futura |
|-------|--------|-------------|
| Nome do prestador (texto) | `alocacoes_escala` so tem `prestador_id` (UUID). JOIN com `prestadores.nome_completo` requer query adicional | Adicionar JOIN na query de alocacoes |
| Nome do cliente (texto) | Mesmo caso — `cliente_id` (UUID) sem JOIN | Adicionar JOIN |
| Progresso da operacao (barra) | Sem suporte no backend atual | Feature futura |
| Historico de rota (polilinha) | `MapboxMap` nao renderiza `routeGeometry` | Fase 2 do roadmap TMS-027 |
| Checklist do motorista | Tabela `checklists_operacao` nao existe | Fase 4 (migration pendente) |
| Tempo parado | Nao implementado no backend | Fase 4 |
| Atraso vs previsao (minutos) | `previsaoTermino` e da OS, nao da alocacao | Feature futura |
| Status SLA persistido | SLA calculado no frontend (nao persiste) | Trigger `trg_atualizar_sla` |
| Telefone do prestador | JOIN com `prestadores` necessario | Adicionar JOIN |

---

## 6. ESTADOS VALIDADOS

| Estado | Comportamento |
|--------|---------------|
| Operacao completa (com alocacao, POD, GPS, financeiro) | Todas as 8 abas populadas com dados reais |
| Operacao com poucos dados (sem alocacao) | Abas Escala/GPS/Evidencias mostram estado vazio profissional |
| Operacao sem GPS | Aba GPS mostra "Nenhuma posicao GPS registrada" |
| Operacao sem evidencias | Aba Evidencias mostra estado vazio |
| Operacao sem financeiro | Aba Financeiro mostra "Nao informado" nos campos |
| Operacao com ocorrencia | Aba Ocorrencias mostra card destacado em rosa |
| Operacao finalizada | Badge "Concluida" verde no cabecalho |
| Operacao atrasada | Badge "Atrasada" vermelho no cabecalho |
| Sem alocacao vinculada | Aba Escala mostra estado vazio; dados veiculo/placa omitidos |
| Sheet fechado | State `sheetOpen=false`, `selectedActionOsId=null`, sem queries pendentes |

---

## 7. LIMITACOES ATUAIS

1. **Nomes de prestador/cliente**: Exibidos como UUIDs ou valores da tabela `ordens_servico` (que armazena nomes como texto livre). Para exibir nomes corretos de `prestadores.nome_completo` e `clientes.nome_fantasia`, seria necessario JOIN na query de alocacoes.

2. **Foto do motorista**: Nao disponivel na aba Geral — `prestadores.foto` requer JOIN.

3. **Fotos multiplas por etapa**: `podService.buscarPOD()` retorna `foto_entrega_url` unica. Fotos do romaneio e outras etapas estao em `metadata->app_motorista` mas nao sao consultadas.

4. **Replay de rota**: Mapa nao incluido no Sheet — apenas coordenadas textuais.

5. **Comunicacao bidirecional**: Nao ha chat/enviar mensagem ao motorista pelo Sheet.

6. **Edicao inline**: Sheet e somente leitura — nao permite alterar status, reatribuir prestador, etc.

---

## 8. RISCOS IDENTIFICADOS

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:------------:|:-------:|-----------|
| Query `alocacoes_escala` sem JOIN pode retornar dados incompletos | Alta | Baixo | Nomes exibidos como fallback do `ordens_servico` |
| `composicao_financeira_os` pode nao existir para OS antigas | Media | Baixo | Tratado com `maybeSingle()` + estado vazio |
| RLS pode bloquear queries se usuario nao tem permissao | Baixa | Medio | Mesmo padrao de queries da Torre (ja funcionando) |
| Sheet muito pesado em dispositivos moveis | Baixa | Baixo | `sm:max-w-xl lg:max-w-2xl` responsivo |

---

## 9. RECOMENDACAO PARA FASE 1B

### Prioridade Alta
1. **Adicionar JOIN na query de alocacoes**: `prestadores(nome_completo, telefone), clientes(nome_fantasia)` — resolve nomes como UUID
2. **Mini-mapa no Sheet**: Incluir `MapboxMap` com a ultima posicao conhecida (componente ja existe)
3. **Timeline enriquecida**: Mapear os 7 `event_types` do App Flutter que estao no Event Bus mas nao aparecem na timeline

### Prioridade Media
4. **Aba "Documentos"**: Exibir CT-e, NFSe, contratos vinculados (dados em `fiscal_ctes`, `fiscal_nfse`)
5. **Link de rastreio publico**: Botao "Copiar link de rastreio" usando `gerarLinkRastreio()`
6. **Fotos por etapa**: Consultar `metadata->app_motorista` para mostrar foto do romaneio

### Sem autorizacao necessaria
Todas as acoes acima sao apenas TypeScript/React — zero SQL, zero RPC, zero migration.

---

**Fim do relatorio.**
