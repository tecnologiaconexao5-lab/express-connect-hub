# RELATORIO TMS-027 — TORRE DE CONTROLE INTELIGENTE
## Especificacao Integrada App Prestador ↔ Torre de Controle

**Versao:** 1.0 — 2026-08-01
**Dependencia:** TMS-026 (complemento direto)
**Status:** Diagnostico e documentacao (read-only)
**Regra Central:** Nada sera projetado apenas na Torre de Controle. Cada funcionalidade mapeada ponta a ponta.

---

## SUMARIO EXECUTIVO

Este relatorio complementa o TMS-026 com a matriz especifica de integracao entre o **App Motorista (Flutter PWA)** e a **Torre de Controle (TMS web)**. Audita 25 funcionalidades obrigatorias, mapeia 23 lacunas, define 7 contratos formais e propoe um roadmap seguro com zero retrabalho.

### Descoberta Central

O fluxo ponta a ponta ja existe — App Flutter → Supabase → TMS → Torre de Controle → Financeiro — mas com **gaps criticos de integracao**:

| Camada | Nota | Maior Gap |
|--------|:----:|-----------|
| App Motorista (Flutter) | **6/10** | `delivery_proofs` nao sincroniza fotos/assinatura automaticamente com `entregas_protocolo` |
| Supabase / RPCs | **8/10** | RPC `f_avancar_etapa_app_motorista` marcada STABLE mas executa UPDATE |
| TMS Frontend (Torre) | **5/10** | TorreControle.tsx consulta `ordens_servico` diretamente, sem join com `alocacoes_escala` |
| Integracao (Web ↔ Flutter) | **4/10** | Nenhum contrato formal de eventos; TMS e Flutter escrevem nas mesmas tabelas por caminhos diferentes |
| Financeiro | **7/10** | Triggers M66+M80 propagam mas `composicao_financeira_os` tem formulas divergentes |

---

## 1. MATRIZ APP PRESTADOR ↔ TORRE DE CONTROLE

### Legenda

| Simbolo | Significado |
|:-------:|------------|
| ✅ | Funcional — implementado e operante |
| ⚠️ | Parcial — implementado mas com gaps documentados |
| ❌ | Ausente — nao implementado em producao |
| 🔶 | Bloqueado — requer autorizacao (migration/RLS/RPC) |

### 1.1 Rastreamento GPS

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala` — o TMS cria a alocacao com `prestador_id` e `ordem_servico_id` | ✅ |
| **Tabela/view/RPC** | `portal_tracking_realtime` — INSERT via RPC `registrar_posicao_motorista()` (SECURITY DEFINER) | ✅ |
| **Modelo Flutter** | Objeto JSON: `{ alocacao_id, latitude, longitude, velocidade, precisao, direcao, bateria, captured_at }` | ✅ |
| **Tela no App** | Tela de Rota Ativa — botao "Iniciar Navegacao" ativa o GPS nativo (geolocator) | ✅ |
| **Evento gerado** | Timer de 10s → `supabase.rpc("registrar_posicao_motorista", { ... })` | ✅ |
| **Dados enviados** | `p_alocacao_id`, `p_latitude`, `p_longitude`, `p_velocidade`, `p_precisao`, `p_direcao`, `p_bateria`, `p_captured_at` | ✅ |
| **Persistencia e idempotencia** | INSERT em `portal_tracking_realtime`. Dedup: mesma coordenada nos ultimos 10s rejeitada pela RPC (fix 2026-07-31). CHECK: coordenadas != 0,0 e dentro de [-90,90] × [-180,180] | ✅ |
| **Atualizacao da Timeline** | Trigger `f_trg_tracking_iniciado` dispara evento `tracking.iniciado` no Event Bus na primeira posicao. Trigger `f_trg_atualizar_status_alocacao_tracking` atualiza `alocacoes_escala.metadata` com ultima posicao | ✅ |
| **Atualizacao do mapa** | `TorreControle.tsx:233` — canal Realtime `torre-realtime-tracking` escuta INSERT em `portal_tracking_realtime` e atualiza `trackingPositions`. `MapboxMap` recebe markers com `liveLat`/`liveLng` da posicao em tempo real | ✅ |
| **Exibicao no painel OS** | `selectedOSData` nao mostra posicao atual do motorista — apenas coordenadas estaticas da OS | ❌ |
| **Alertas derivados** | `gerarAcoesPrioritarias()` NAO usa dados de tracking — apenas status e previsao de OS | ❌ |
| **Reflexos no financeiro** | Nenhum — tracking e somente leitura | — |
| **Suporte offline** | `registrarPosicaoViaRPC()` falha sem rede. `trackingService.registrarPosicao()` faz INSERT direto como fallback | ⚠️ |
| **Lacunas** | (1) Posicao atual do motorista nao visivel no painel detalhado da OS na Torre. (2) Sem alerta de motorista parado (>15min). (3) Offline: posicoes sao perdidas — sem fila local no Flutter | |
| **Arquivos a alterar** | `TorreControle.tsx` (exibir posicao no painel), `acoesPrioritarias.ts` (alerta parado), Flutter (fila offline) | |

### 1.2 Posicao Atual do Motorista

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `portal_tracking_realtime` — ultima linha para `alocacao_id` | ✅ |
| **Tabela/view/RPC** | `trackingService.obterPosicaoAtualPorAlocacao()` → SELECT `*` FROM `portal_tracking_realtime` WHERE `alocacao_id = ?` ORDER BY `captured_at DESC` LIMIT 1 | ✅ |
| **Modelo Flutter** | `lat`, `lng`, `heading` do `geolocator` | ✅ |
| **Tela no App** | Overlay "Sua posicao" no mapa da rota | ✅ |
| **Evento gerado** | N/D — posicao e enviada no ciclo de 10s (ver 1.1) | ✅ |
| **Dados enviados** | Ver 1.1 | ✅ |
| **Persistencia** | Ver 1.1 | ✅ |
| **Atualizacao da Timeline** | Ver 1.1 | ✅ |
| **Atualizacao do mapa** | `TorreControle.tsx:478-484` — se existe `trackingPosition` com `os_id` correspondente, o marker usa `liveLat`/`liveLng` em vez das coordenadas estaticas da OS | ✅ |
| **Exibicao no painel OS** | Nao exibido | ❌ |
| **Alertas derivados** | Nao implementado | ❌ |
| **Suporte offline** | Sem fila offline no Flutter | ❌ |
| **Lacunas** | (1) Painel operacional da Torre nao mostra "Ultima posicao: ha X min". (2) Sem indicador no mapa de ha quanto tempo a posicao foi atualizada | |
| **Arquivos a alterar** | `TorreControle.tsx` (painel OS + info "ultima atualizacao" nos markers) | |

### 1.3 Historico de Rota

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `portal_tracking_realtime` — todas as linhas para `alocacao_id` ordenadas por tempo | ✅ |
| **Tabela/view/RPC** | `trackingService.buscarUltimasPosicoes()` — busca ultimas 200 posicoes, deduplica por `alocacao_id` | ⚠️ |
| **Modelo Flutter** | Array de `PositionRecord` acumulado localmente durante a viagem | ✅ |
| **Tela no App** | "Historico" — linha do tempo de posicoes com trajeto no mapa | ✅ |
| **Evento gerado** | Nenhum evento especifico — cada registro de posicao e um INSERT silencioso | — |
| **Dados enviados** | Cada posicao enviada individualmente (ver 1.1) | ✅ |
| **Persistencia** | `portal_tracking_realtime` acumula todas as posicoes | ✅ |
| **Atualizacao da Timeline** | Nao — so a primeira posicao gera evento `tracking.iniciado` | ⚠️ |
| **Atualizacao do mapa** | `MapboxMap` recebe array `locations` mas NAO renderiza linha de rota (`routeGeometry`) — apenas pontos | ❌ |
| **Exibicao no painel OS** | Nao ha como ver o historico completo da rota no painel da Torre | ❌ |
| **Alertas derivados** | Nenhum | ❌ |
| **Suporte offline** | Flutter pode acumular posicoes localmente mas nao ha fila de envio | ❌ |
| **Lacunas** | (1) `MapboxMap` nao renderiza polilinha de rota (route line). (2) `buscarUltimasPosicoes()` deduplica por alocacao — retorna apenas 1 posicao por alocacao, nao o historico completo. (3) Torre nao tem visualizacao de replay de rota | |
| **Arquivos a alterar** | `MapboxMap.tsx` (routeGeometry layer), `trackingService.ts` (nova funcao `buscarHistoricoRota()`), `TorreControle.tsx` (replay) | |

### 1.4 Etapa Atual

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.metadata->'app_motorista'->>'etapa_atual'` — atualizado pela RPC `f_avancar_etapa_app_motorista()` | ✅ |
| **Tabela/view/RPC** | `f_avancar_etapa_app_motorista(p_alocacao_id, p_etapa, p_payload, p_idempotency_key, p_auth_user_id)` — 15 etapas, 14 transicoes validas, idempotente por `p_idempotency_key` | ⚠️ |
| **Modelo Flutter** | Enum `OperationStep`: `viagem_aceita`, `cheguei_coleta`, `carregamento_iniciado`, `carregamento_finalizado`, `romaneio_informado`, `foto_romaneio`, `km_inicial_informado`, `saiu_em_rota`, `chegou_entrega`, `descarregamento_iniciado`, `descarga_finalizada`, `km_final_informado`, `assinatura_capturada`, `pod_registrado`, `servico_finalizado` | ✅ |
| **Tela no App** | "Etapas" — checklist vertical com 15 etapas, botao "Avancar" em cada uma | ✅ |
| **Evento gerado** | Cada avanco de etapa → `eventos_oficiais` (INSERT) + `operation_timeline_events` (INSERT) | ✅ |
| **Dados enviados** | `{ p_alocacao_id, p_etapa, p_payload: { km_inicial, km_final, foto_romaneio_url, etc }, p_idempotency_key }` | ✅ |
| **Persistencia e idempotencia** | `p_idempotency_key` armazenado em `metadata->'app_motorista'->>'ultima_idempotency'`. Reenvio com mesma key retorna `idempotent: true` sem reexecutar | ✅ |
| **Atualizacao da Timeline** | Evento publicado no Event Bus com `event_type` mapeado (ex: `saiu_em_rota` → `route_started`). `TorreControle.tsx:355-403` consome `eventos_oficiais` e exibe na Timeline Operacional | ✅ |
| **Atualizacao do mapa** | Nao — mapa so reage a coordenadas de tracking, nao a etapas | — |
| **Exibicao no painel OS** | Nao — painel operacional mostra `selectedOSData.status` (status da OS, nao etapa do App) | ❌ |
| **Alertas derivados** | Nenhum alerta por etapa (ex: "ha 30min em carregamento_iniciado") | ❌ |
| **Suporte offline** | A RPC precisa de rede. Sem fila offline no Flutter | ❌ |
| **Lacunas** | (1) RPC marcada como `STABLE` mas executa UPDATE — anomalia A01 (133-D.3). (2) Correcao `STABLE→VOLATILE` pronta em `m133d4_fix_rpc_app_security.sql` mas NAO aplicada (🔶 bloqueado). (3) Torre nao mostra etapa atual do App no painel | |
| **Arquivos a alterar** | `TorreControle.tsx` (exibir etapa atual no painel), migration `20260722_m133d4` (aplicar fix STABLE→VOLATILE) | |

### 1.5 Aceite

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.aceite_prestador` (bool) + `data_aceite` (timestamp) | ✅ |
| **Tabela/view/RPC** | TMS: `escalaService.aceitarAlocacao(id, prestador_id)`. App: `f_avancar_etapa_app_motorista(p_etapa='viagem_aceita')`. Rede: `f_aceitar_oportunidade_rede(p_oportunidade_id, p_prestador_uuid, p_auth_user_id)` | ✅ |
| **Modelo Flutter** | Botao "Aceitar" → RPC → transicao `viagem_aceita` | ✅ |
| **Tela no App** | Card de operacao com botoes "Aceitar" / "Recusar" | ✅ |
| **Evento gerado** | `eventos_oficiais`: `operation_accepted`. `operation_timeline_events`: `operation_accepted` | ✅ |
| **Dados enviados** | `p_idempotency_key` (UUID gerado no Flutter) | ✅ |
| **Persistencia** | UPDATE `alocacoes_escala`: `aceite_prestador=true`, `data_aceite=NOW()`, `status=aceita` | ✅ |
| **Atualizacao da Timeline** | Torre consome `eventos_oficiais` e exibe na timeline | ✅ |
| **Atualizacao do mapa** | Nao | — |
| **Exibicao no painel OS** | `stats.aguardandoAceite` KPI — conta OS com status `aguardando parceiro` | ⚠️ |
| **Alertas derivados** | `acoesPrioritarias.ts` — OS `aguardando_aceite` sem previsao gera alerta de prioridade media/baixa | ⚠️ |
| **Suporte offline** | Sem RPC offline | ❌ |
| **Lacunas** | (1) AppPrestador.tsx (TMS admin) aceita via `useEscala().aceitarAlocacaoHook()` — flow diferente do App Flutter (que usa RPC). Duas implementacoes do mesmo fluxo. (2) KPI `aguardandoAceite` usa `status === "aguardando parceiro"` (status OS), nao `alocacoes_escala.status = 'aguardando_aceite'`. Status divergentes entre OS e escala | |
| **Arquivos a alterar** | Unificar fluxo de aceite (TMS admin vs App Flutter). `TorreControle.tsx:334` (corrigir KPI para usar `alocacoes_escala.status`) | |

### 1.6 Chegada e Saida

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.horario_inicio_real` (saida) e `metadata->'app_motorista'` (chegadas) | ⚠️ |
| **Tabela/view/RPC** | `f_avancar_etapa_app_motorista(p_etapa='saiu_em_rota')` → `horario_inicio_real=NOW()`. `p_etapa='chegou_entrega'` → apenas metadata | ⚠️ |
| **Modelo Flutter** | Check-in no local: botao "Cheguei" → RPC `chegou_coleta` / `chegou_entrega` | ✅ |
| **Tela no App** | Tela de etapa com botao "Registrar Chegada" | ✅ |
| **Evento gerado** | `arrived_pickup` / `arrived_delivery` no Event Bus | ✅ |
| **Dados enviados** | `p_etapa`, `p_payload: { timestamp_checkin }` | ✅ |
| **Persistencia** | `alocacoes_escala.metadata->'app_motorista'` atualizado. `horario_inicio_real` so e setado em `cheguei_coleta` (inicio da coleta = saida da base). `horario_fim_real` so em `servico_finalizado` | ⚠️ |
| **Atualizacao da Timeline** | Eventos no Event Bus consumidos pela Torre | ✅ |
| **Atualizacao do mapa** | Nao | — |
| **Exibicao no painel OS** | Nao — painel nao mostra horarios de chegada/saida | ❌ |
| **Alertas derivados** | Nao — sem alerta de atraso na chegada vs previsao | ❌ |
| **Suporte offline** | Sem fila offline | ❌ |
| **Lacunas** | (1) `horario_chegada_destino` nao existe como coluna dedicada — so em metadata JSONB. (2) Torre nao compara horario previsto × realizado. (3) `cheguei_coleta` seta `horario_inicio_real` — mas a semantica e "chegada na coleta", nao "saida". Nome do campo ambiguo | |
| **Arquivos a alterar** | `alocacoes_escala` (adicionar colunas `horario_chegada_coleta`, `horario_saida_coleta`, `horario_chegada_destino`), `TorreControle.tsx` (painel com timeline de horarios) | |

### 1.7 Inicio e Conclusao de Coleta

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | RPC `f_avancar_etapa_app_motorista(p_etapa='carregamento_iniciado')` e `('carregamento_finalizado')` | ✅ |
| **Tabela/view/RPC** | Ver 1.4 — mesma RPC, etapas 3 e 4 da maquina de estados | ✅ |
| **Modelo Flutter** | Botoes "Iniciar Carregamento" / "Finalizar Carregamento" | ✅ |
| **Tela no App** | Checklist de itens de conferencia (conferencia de romaneio, contagem de volumes) | ✅ |
| **Evento gerado** | `loading_started` / `loading_finished` no Event Bus | ✅ |
| **Dados enviados** | `p_payload: { qtd_volumes_coleta, observacao_coleta }` | ✅ |
| **Persistencia** | `alocacoes_escala.metadata->'app_motorista'` | ⚠️ |
| **Atualizacao da Timeline** | Eventos no Event Bus | ✅ |
| **Atualizacao do mapa** | Nao | — |
| **Exibicao no painel OS** | Nao visivel | ❌ |
| **Alertas derivados** | Nao | ❌ |
| **Suporte offline** | Sem fila | ❌ |
| **Lacunas** | (1) Quantidade de volumes carregados so em metadata JSONB, nao em coluna dedicada. (2) Sem validacao volumes carregados × volumes OS. (3) Torre nao mostra status de carregamento | |
| **Arquivos a alterar** | `alocacoes_escala` (adicionar `qtd_volumes_coleta`), `TorreControle.tsx` | |

### 1.8 Inicio e Conclusao de Entrega

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | RPC `f_avancar_etapa_app_motorista(p_etapa='descarregamento_iniciado')` e `('descarga_finalizada')` | ✅ |
| **Tabela/view/RPC** | Ver 1.4 — etapas 11 e 12 | ✅ |
| **Modelo Flutter** | Botoes "Iniciar Descarga" / "Descarga Concluida" | ✅ |
| **Tela no App** | Checklist de entrega (conferencia com recebedor) | ✅ |
| **Evento gerado** | `unloading_started` / `unloading_finished` | ✅ |
| **Dados enviados** | `p_payload: { qtd_volumes_entregues, avarias, nome_recebedor }` | ✅ |
| **Persistencia** | `alocacoes_escala.metadata->'app_motorista'` + posterior POD em `entregas_protocolo` | ⚠️ |
| **Atualizacao da Timeline** | Eventos no Event Bus | ✅ |
| **Exibicao no painel OS** | Nao visivel | ❌ |
| **Alertas derivados** | Nao | ❌ |
| **Suporte offline** | Sem fila | ❌ |
| **Lacunas** | (1) `qtd_volumes_entregues` em metadata, nao em coluna. (2) `avarias` sem validacao estruturada. (3) Sem trigger de alerta se `qtd_volumes_entregues < qtd_volumes_coleta` (extravio) | |
| **Arquivos a alterar** | `alocacoes_escala` (adicionar `qtd_volumes_entregues`, `qtd_avarias`), trigger de alerta, `TorreControle.tsx` | |

### 1.9 Baixa de Operacao

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | RPC `f_avancar_etapa_app_motorista(p_etapa='servico_finalizado')` | ✅ |
| **Tabela/view/RPC** | Ver 1.4 — ultima etapa. Exige `pod_registrado=true` no metadata (validacao na RPC linha 114-119) | ✅ |
| **Modelo Flutter** | Botao "Finalizar Servico" — so habilitado apos POD completo | ✅ |
| **Tela no App** | Resumo final: km, fotos, assinatura, checklists OK → Confirmar | ✅ |
| **Evento gerado** | `operation_finished` no Event Bus | ✅ |
| **Dados enviados** | `p_payload: { km_final, resumo }` | ✅ |
| **Persistencia** | UPDATE `alocacoes_escala`: `status=concluida`, `finalizada=true`, `data_finalizacao=NOW()`, `horario_fim_real=NOW()` | ✅ |
| **Atualizacao da Timeline** | Evento `operation_finished` → Torre exibe na timeline | ✅ |
| **Atualizacao do mapa** | Nao diretamente — mas alocacao concluida sai do filtro ativo de tracking | ✅ |
| **Exibicao no painel OS** | `stats.concluidasHoje` conta OS com status `finalizada` | ⚠️ |
| **Alertas derivados** | Nao — conclusao e evento positivo, sem alerta | — |
| **Reflexos no financeiro** | Trigger M66 `f_trg_propagar_financeiro_alocacao` dispara na conclusao → propaga para `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os` | ✅ |
| **Suporte offline** | Sem fila | ❌ |
| **Lacunas** | (1) Sem validacao de que o POD foi sincronizado para `entregas_protocolo` ANTES de concluir. RPC so verifica `pod_registrado=true` no metadata, nao em `entregas_protocolo`. (2) `stats.concluidasHoje` usa status OS, nao status alocacao — pode divergir | |
| **Arquivos a alterar** | `f_avancar_etapa_app_motorista` (validar `entregas_protocolo` antes de permitir `servico_finalizado`), `TorreControle.tsx` (corrigir KPI) | |

### 1.10 Fotos por Etapa

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `entregas_protocolo.foto_entrega_url`, `foto_canhoto_url`. `delivery_proofs.photo_url` (Flutter). `alocacoes_escala.fotos_entrega[]` (array legado) | ⚠️ |
| **Tabela/view/RPC** | `delivery_proofs` (App Flutter) → trigger `f_sync_delivery_proof_to_entregas` → `entregas_protocolo`. Fotos do romaneio: `f_avancar_etapa_app_motorista(p_etapa='foto_romaneio')` com `p_payload.foto_romaneio_url` | ✅ |
| **Modelo Flutter** | `image_picker` → upload para bucket `comprovantes-entrega` → URL publica | ✅ |
| **Tela no App** | Camera integrada em cada etapa: foto do romaneio, foto da carga, foto da entrega | ✅ |
| **Evento gerado** | `romaneio_foto` no Event Bus. `pod_sent` quando POD completo | ✅ |
| **Dados enviados** | `photo_url` (FOTO UNICA por POD). Etapa `foto_romaneio`: `p_payload.foto_romaneio_url` | ⚠️ |
| **Persistencia** | `delivery_proofs.photo_url` → trigger → `entregas_protocolo.foto_entrega_url`. Fotos do romaneio em `alocacoes_escala.metadata` JSONB | ⚠️ |
| **Atualizacao da Timeline** | Evento `pod_sent` na timeline da Torre | ✅ |
| **Atualizacao do mapa** | Nao | — |
| **Exibicao no painel OS** | Nao — painel nao mostra fotos | ❌ |
| **Alertas derivados** | `comprovante_pendente` — alerta baseado em `alocacoes_escala.comprovante_url IS NULL` (coluna legada) | ⚠️ |
| **Suporte offline** | Flutter pode tirar foto offline, mas upload requer rede | ❌ |
| **Lacunas** | (1) `delivery_proofs` so tem 1 campo `photo_url` — nao suporta multiplas fotos por categoria (local, mercadoria, veiculo). (2) Trigger so copia para `entregas_protocolo` no INSERT — updates no `delivery_proofs` nao propagam. (3) `foto_romaneio` vai para metadata JSONB, nao para `delivery_proofs`. (4) KPI `semComprovante` usa coluna `comprovante_url` legada, nao `entregas_protocolo` | |
| **Arquivos a alterar** | `delivery_proofs` (adicionar array `photos[]` JSONB), trigger `f_sync_delivery_proof_to_entregas` (suportar update), `TorreControle.tsx` (exibir fotos no painel, corrigir KPI) | |

### 1.11 Assinaturas

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `entregas_protocolo.assinatura_url` | ✅ |
| **Tabela/view/RPC** | `delivery_proofs.signature_url` → trigger → `entregas_protocolo.assinatura_url` | ✅ |
| **Modelo Flutter** | Canvas de assinatura digital → PNG base64 → upload para bucket `comprovantes-entrega` | ✅ |
| **Tela no App** | Tela "Assinatura do Recebedor" com canvas + botao "Limpar" / "Confirmar" | ✅ |
| **Evento gerado** | `signature_captured` no Event Bus (via `f_avancar_etapa`) | ✅ |
| **Dados enviados** | `signature_url` (URL publica no bucket) | ✅ |
| **Persistencia** | `delivery_proofs.signature_url` → trigger → `entregas_protocolo.assinatura_url` | ✅ |
| **Atualizacao da Timeline** | Evento na timeline da Torre | ✅ |
| **Exibicao no painel OS** | Nao | ❌ |
| **Alertas derivados** | Nenhum alerta por falta de assinatura | ❌ |
| **Suporte offline** | Flutter pode capturar assinatura offline, mas upload requer rede | ❌ |
| **Lacunas** | (1) Torre nao mostra assinatura no painel. (2) Sem alerta de POD sem assinatura (campo vazio) | |
| **Arquivos a alterar** | `TorreControle.tsx` (exibir assinatura no painel), `acoesPrioritarias.ts` (alerta assinatura ausente) | |

### 1.12 Canhotos

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `entregas_protocolo.foto_canhoto_url` | ✅ |
| **Tabela/view/RPC** | `delivery_proofs.foto_canhoto_url` → trigger → `entregas_protocolo.foto_canhoto_url` | ✅ |
| **Modelo Flutter** | Camera → foto do canhoto fisico → upload | ✅ |
| **Tela no App** | "Foto do Canhoto" com preview e botao "Tirar Foto" | ✅ |
| **Evento gerado** | Dentro do fluxo `pod_sent` | ✅ |
| **Dados enviados** | `foto_canhoto_url` | ✅ |
| **Persistencia** | Trigger `f_sync_delivery_proof_to_entregas` | ✅ |
| **Atualizacao da Timeline** | Evento `pod_sent` | ✅ |
| **Exibicao no painel OS** | Nao | ❌ |
| **Alertas derivados** | KPI `semComprovante` (coluna legada) | ⚠️ |
| **Lacunas** | (1) `delivery_proofs.foto_canhoto_url` adicionado via M108C1 mas sem validacao de obrigatoriedade. (2) Torre nao mostra canhoto no painel, apenas conta "sem comprovante" generico | |
| **Arquivos a alterar** | `TorreControle.tsx` (exibir canhoto no painel) | |

### 1.13 Protocolos (POD Completo)

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `entregas_protocolo` — registro completo com foto, canhoto, assinatura, recebedor, GPS | ✅ |
| **Tabela/view/RPC** | `delivery_proofs` (INSERT Flutter) → trigger `f_sync_delivery_proof_to_entregas` → `entregas_protocolo`. `podService.finalizarComPOD()` (TMS via AppPrestador.tsx) | ⚠️ |
| **Modelo Flutter** | `DeliveryProof` object: `{ stop_id, operation_id, driver_id, receiver_name, receiver_document, receiver_relationship, status, photo_url, signature_url, foto_canhoto_url, latitude, longitude, gps_accuracy, observation, delivered_at }` | ✅ |
| **Tela no App** | "Finalizar Entrega" — formulario completo com todos os campos | ✅ |
| **Evento gerado** | `pod_sent` no Event Bus (via trigger `trg_evento_pod_enviado`) | ✅ |
| **Dados enviados** | Todos os campos do `DeliveryProof` | ✅ |
| **Persistencia e idempotencia** | Trigger `f_sync_delivery_proof_to_entregas` verifica `IF EXISTS (SELECT 1 FROM entregas_protocolo WHERE alocacao_id = v_alocacao_id)` — se ja existe, nao duplica (idempotente) | ✅ |
| **Atualizacao da Timeline** | Evento `entrega.comprovante.pod_enviado` no Event Bus | ✅ |
| **Atualizacao do mapa** | Nao | — |
| **Exibicao no painel OS** | Painel mostra "Comprovante pendente" se `comprovante_url IS NULL` (coluna legada, nao `entregas_protocolo`) | ⚠️ |
| **Alertas derivados** | `comprovantesPendentes` via `gerarAcoesPrioritarias()` | ✅ |
| **Suporte offline** | Flutter pode armazenar POD localmente, mas INSERT requer rede | ❌ |
| **Lacunas** | (1) `podService.finalizarComPOD()` (TMS) e `delivery_proofs` (Flutter) sao DUAS implementacoes diferentes do mesmo fluxo — o TMS admin pode finalizar sem passar pelo `delivery_proofs`. (2) IDEMPOTENCIA: trigger so verifica se `alocacao_id` ja existe em `entregas_protocolo` — se o Flutter envia 2 PODs diferentes para a mesma alocacao, o segundo e ignorado silenciosamente. (3) Torre verifica `comprovante_url` (coluna legada) em vez de `entregas_protocolo` — falso positivo de "pendente" | |
| **Arquivos a alterar** | Unificar `podService.finalizarComPOD()` com `delivery_proofs`. `TorreControle.tsx` (corrigir KPI `semComprovante` para usar `entregas_protocolo`) | |

### 1.14 Checklists

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | Nao existe tabela de checklist | ❌ |
| **Tabela/view/RPC** | Inexistente — `AppPrestador.tsx` tem estado local `checks` (seguro, gerenciadora, rastreio) mas nao persiste | ❌ |
| **Modelo Flutter** | Checklist local no App — itens de seguranca, documentacao, veiculo | ❌ |
| **Tela no App** | Tela "Checklist" antes de iniciar rota — 3 itens hardcoded no TMS admin | ❌ |
| **Persistencia** | Nenhuma — estado volatil no componente | ❌ |
| **Lacunas** | (1) Checklist nao e persistido. (2) Sem tabela `checklists_operacao`. (3) Sem validacao de checklist obrigatorio antes de `saiu_em_rota`. (4) Torre nao tem visibilidade dos checklists | |
| **Arquivos a alterar** | Criar migration `checklists_operacao` (alocacao_id, tipo, itens JSONB, fotos, assinatura). `f_avancar_etapa_app_motorista` (bloquear `saiu_em_rota` sem checklist). `TorreControle.tsx` (exibir status dos checklists) | |

### 1.15 Ocorrencias

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | Tabela `ocorrencias` (19 colunas, 8 indices, RLS, Realtime) | ✅ |
| **Tabela/view/RPC** | `ocorrencias` — `os_id`, `alocacao_id`, `prestador_id`, `cliente_id`, `tipo`, `status`, `severidade`, `visivel_cliente`, `evidencias` JSONB | ✅ |
| **Modelo Flutter** | Objeto `Ocorrencia`: `{ tipo, descricao, severidade, fotos[], latitude, longitude }` | ✅ |
| **Tela no App** | "Reportar Problema" — formulario com tipo (avaria, recusa, transito, acidente, extravio, furto, endereco_incorreto, cliente_ausente), descricao, fotos | ✅ |
| **Evento gerado** | INSERT na tabela `ocorrencias` → Realtime → `TorreControle.tsx:212` canal `torre-realtime-ocorrencias` | ✅ |
| **Dados enviados** | `{ tipo, descricao, severidade, alocacao_id, os_id, evidencias: { fotos[], latitude, longitude } }` | ✅ |
| **Persistencia** | INSERT direto em `ocorrencias` (RLS permite authenticated INSERT) | ✅ |
| **Atualizacao da Timeline** | `fetchTimeline()` (TorreControle.tsx:407-427) le `ocorrencias` e adiciona a Timeline Operacional | ✅ |
| **Atualizacao do mapa** | Nao | — |
| **Exibicao no painel OS** | `selectedOSOcorrencia` — painel mostra tipo e severidade | ✅ |
| **Alertas derivados** | `acoesPrioritarias.ts` — OS com ocorrencia gera alerta de prioridade CRITICA. `stats.ocorrenciasCriticas` no Painel de Risco | ✅ |
| **Suporte offline** | Flutter pode armazenar localmente mas INSERT requer rede | ❌ |
| **Lacunas** | (1) Sem trigger que atualiza `alocacoes_escala.status` para `ocorrencia` automaticamente ao abrir ocorrencia. (2) Fotos da ocorrencia vao para `evidencias` JSONB, nao para bucket padrao. (3) Sem notificacao push ao TMS quando ocorrencia critica e aberta | |
| **Arquivos a alterar** | Trigger `trg_ocorrencia_atualiza_alocacao`, `TorreControle.tsx` (notificacao push), Flutter (upload fotos para bucket) | |

### 1.16 Insucesso

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `delivery_proofs.status = 'not_delivered'` → trigger → `entregas_protocolo.status = 'nao_entregue'` | ✅ |
| **Tabela/view/RPC** | `f_avancar_etapa_app_motorista(p_etapa='descarga_finalizada')` sem POD → status `ocorrencia`. `delivery_proofs` com `status = 'not_delivered'` | ✅ |
| **Modelo Flutter** | Fluxo "Nao Entregue": motivo (cliente ausente, endereco incorreto, recusa, avaria total), fotos, observacao | ✅ |
| **Tela no App** | "Registrar Insucesso" — radio buttons com motivos + campo observacao | ✅ |
| **Dados enviados** | `status = 'not_delivered'`, `observation` com motivo, `photo_url` (evidencia da tentativa) | ✅ |
| **Persistencia** | `delivery_proofs` → trigger → `entregas_protocolo.status = 'nao_entregue'` | ✅ |
| **Atualizacao da Timeline** | Evento `pod_sent` com status `not_delivered` | ✅ |
| **Exibicao no painel OS** | Nao diferencia "nao entregue" de "entregue" no painel | ❌ |
| **Alertas derivados** | Nao ha alerta especifico de insucesso | ❌ |
| **Suporte offline** | Sem fila | ❌ |
| **Lacunas** | (1) Torre nao tem KPI de taxa de insucesso. (2) Sem fluxo de reentrega automatica. (3) Sem trigger para notificar o cliente sobre insucesso | |
| **Arquivos a alterar** | `TorreControle.tsx` (KPI insucesso, diferenciar no painel), trigger `trg_notificar_cliente_insucesso` | |

### 1.17 Devolucao

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.tipo_reversa` + `reversa_*` (status, qtd_volumes, valor_cliente, valor_prestador, observacoes) | ✅ |
| **Tabela/view/RPC** | `f_atualizar_reversa_app(p_alocacao_id, p_reversa_status, p_qtd_volumes, p_motivo, ...)` — RPC dedicada com validacao de divergencia, calculo de valores cliente/prestador | ⚠️ |
| **Modelo Flutter** | Tela "Coleta Reversa": status, fotos, qtd volumes, motivo da devolucao | ✅ |
| **Tela no App** | "Registrar Devolucao" — formulario com contagem de volumes, fotos, motivo | ✅ |
| **Dados enviados** | `p_alocacao_id`, `p_reversa_status`, `p_qtd_volumes`, `p_motivo`, `p_fotos`, `p_valor_adicional`, `p_observacao` | ✅ |
| **Persistencia** | UPDATE `alocacoes_escala`: `reversa_status`, `reversa_qtd_volumes`, `reversa_valor_cliente`, `reversa_valor_prestador`, `reversa_observacoes` | ✅ |
| **Reflexos no financeiro** | `f_calcular_financeiro_operacao()` inclui `reversa_valor_cliente` e `reversa_valor_prestador` no calculo total. Trigger M66 propaga | ✅ |
| **Exibicao no painel OS** | Nao visivel | ❌ |
| **Lacunas** | (1) `f_atualizar_reversa_app` tem versao divergente em producao (M119 sobrescreveu M133-D.2). Assinatura: `p_reversa_fotos=jsonb` (era `text[]`), `p_reversa_data_realizada=date` (era `timestamptz`). (2) Grants: PUBLIC + anon EXECUTE — anomalia A03 (133-D.3). (3) Correcao pronta em `m133d4_fix_rpc_app_security.sql` mas NAO aplicada (🔶 bloqueado). (4) Torre nao mostra status de devolucao/reversa no painel | |
| **Arquivos a alterar** | Migration `20260722_m133d4` (aplicar fix), `TorreControle.tsx` (exibir reversa no painel) | |

### 1.18 Quilometragem

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.km_previstos` e `km_realizados` | ✅ |
| **Tabela/view/RPC** | `f_avancar_etapa_app_motorista(p_etapa='km_inicial_informado')` e `('km_final_informado')` com `p_payload: { km_inicial, km_final }` | ✅ |
| **Modelo Flutter** | Input numerico em cada etapa | ✅ |
| **Tela no App** | "Informar KM Inicial" (antes de sair) / "Informar KM Final" (ao finalizar) | ✅ |
| **Dados enviados** | `p_payload.km_inicial`, `p_payload.km_final` | ✅ |
| **Persistencia** | `alocacoes_escala.metadata->'app_motorista'->>'km_inicial'` e `km_final`. Coluna `km_realizados` NAO e atualizada pela RPC | ❌ |
| **Reflexos no financeiro** | `f_calcular_financeiro_operacao()` calcula `km_adicional = (km_realizados - km_previstos) * valor_km` — mas `km_realizados` nao e populado pela RPC! | ❌ |
| **Exibicao no painel OS** | Nao | ❌ |
| **Lacunas** | (1) `f_avancar_etapa_app_motorista` NAO atualiza a coluna `km_realizados` — so grava no metadata JSONB. (2) `f_calcular_financeiro_operacao` usa `v_rec.km_realizados` (coluna), que fica sempre NULL. KM excedente nunca e cobrado. (3) Torre nao mostra km previsto × realizado | |
| **Arquivos a alterar** | `f_avancar_etapa_app_motorista` (atualizar `km_realizados` na ultima etapa), `TorreControle.tsx` (mostrar km no painel) | |

### 1.19 Datas Previstas e Realizadas

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.data_escala` (prevista), `horario_inicio_real`, `horario_fim_real`, `data_finalizacao` (realizadas) | ✅ |
| **Tabela/view/RPC** | `alocacoes_escala.*_real` populados pela RPC `f_avancar_etapa_app_motorista` | ✅ |
| **Modelo Flutter** | Datas capturadas via `DateTime.now()` no dispositivo | ✅ |
| **Tela no App** | Cada etapa registra timestamp automaticamente | ✅ |
| **Persistencia** | `horario_inicio_real` em `cheguei_coleta`. `horario_fim_real` em `servico_finalizado`. `data_aceite` em `viagem_aceita`. `data_finalizacao` em `servico_finalizado` | ✅ |
| **Atualizacao da Timeline** | Eventos no Event Bus com `created_at` | ✅ |
| **Exibicao no painel OS** | Painel mostra `selectedOSData.previsaoTermino` (data prevista da OS) | ⚠️ |
| **Alertas derivados** | `isOSAtrasada()` — compara `previsaoTermino` com `Date.now()`. `calcularRiscoOperacional()` — alerta se <= 60min da previsao | ✅ |
| **Lacunas** | (1) `previsaoTermino` vem da OS (`ordens_servico`), nao da alocacao. (2) `horario_inicio_real` e `horario_fim_real` sao populados mas nunca usados para calcular duracao real × prevista. (3) `data_finalizacao` nao e exibida no painel da Torre | |
| **Arquivos a alterar** | `TorreControle.tsx` (calcular `duracao_real = horario_fim_real - horario_inicio_real`), `acoesPrioritarias.ts` (usar `horario_fim_real` para calcular atraso) | |

### 1.20 Tempo Parado

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | Nao implementado | ❌ |
| **Tabela/view/RPC** | Inexistente | ❌ |
| **Modelo Flutter** | `geolocator` pode detectar parada (velocidade < 1 km/h por > X min) | ❌ |
| **Tela no App** | Nao implementado | ❌ |
| **Persistencia** | Nao implementado | ❌ |
| **Lacunas** | (1) Sem deteccao de tempo parado. (2) Sem alerta de motorista parado > 15min. (3) Sem impacto financeiro (espera cobravel). (4) `f_calcular_financeiro_operacao` tem variavel `v_espera` mas valor sempre 0 | |
| **Arquivos a alterar** | Flutter (timer de parada), `portal_tracking_realtime` (coluna `tempo_parado_segundos` ou evento `parada_iniciada/parada_finalizada`), `f_calcular_financeiro_operacao` (calcular espera), `TorreControle.tsx` (alerta parado) | |

### 1.21 SLA e Atraso

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `TorreControle.tsx` — calculo local baseado em `ordens_servico.previsaoTermino` | ✅ |
| **Tabela/view/RPC** | Calculo puramente frontend: `isOSAtrasada()`, `calcularStatusSLA()`, `calcularRiscoOperacional()` | ✅ |
| **Atualizacao da Timeline** | Timestamp de cada evento permite calcular SLA real a posteriori | ✅ |
| **Exibicao no painel OS** | Painel Operacional mostra SLA (No prazo / Em risco / Atrasada / Concluida / Sem previsao) | ✅ |
| **Alertas derivados** | `acoesPrioritarias` gera alertas CRITICOS para atrasadas, ALTOS para em risco | ✅ |
| **Reflexos no financeiro** | Nao ha multa/desconto automatico por atraso | ❌ |
| **Lacunas** | (1) SLA calculado no frontend — nao persiste. Se a pagina recarregar, recalcula. (2) `previsaoTermino` e da OS, nao da alocacao — se a OS tem 3 alocacoes, todas usam a mesma previsao. (3) Sem historico de SLA (quando entrou em atraso, quanto tempo atrasada). (4) Sem notificacao pro cliente quando OS entra em atraso | |
| **Arquivos a alterar** | `ordens_servico` (adicionar `sla_status` calculado por trigger), trigger `trg_atualizar_sla`, `TorreControle.tsx` (consumir coluna em vez de calcular) | |

### 1.22 Compatibilidade de Veiculo

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.tipo_veiculo`, `placa`, `veiculo_id` | ✅ |
| **Tabela/view/RPC** | `escalaService.verificarConflitoPlaca()` — valida se veiculo ja esta em outra alocacao na mesma data. `criarAlocacao()` verifica `prestador_id` bloqueado/inativo e CNH vencida | ✅ |
| **Modelo Flutter** | App mostra placa e tipo de veiculo da alocacao | ✅ |
| **Tela no App** | Card da operacao mostra "Veiculo: VUC - ABC1234" | ✅ |
| **Persistencia** | `alocacoes_escala.placa`, `tipo_veiculo`, `veiculo_id` | ✅ |
| **Exibicao no painel OS** | Nao visivel | ❌ |
| **Lacunas** | (1) Validacao de compatibilidade veiculo × carga (ex: carga refrigerada × veiculo sem bau refrigerado) nao implementada. (2) `tipo_veiculo` e texto livre — sem enum. (3) Torre nao mostra veiculo alocado no painel | |
| **Arquivos a alterar** | `alocacoes_escala` (enum `tipo_veiculo` ou CHECK constraint), validacao de compatibilidade em `criarAlocacao()`, `TorreControle.tsx` | |

### 1.23 Comunicacao Torre → App

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `escalonamentos_humanos` (prioridade, titulo, descricao) + `portal_notificacoes` (prestador_id, titulo, mensagem, tipo) | ✅ |
| **Tabela/view/RPC** | `f_registrar_notificacao_app(p_prestador_id, p_titulo, p_mensagem, p_tipo)` → INSERT em `portal_notificacoes`. Trigger `trg_notificar_os_para_app` → notifica prestador sobre nova OS | ✅ |
| **Modelo Flutter** | Lista de notificacoes: `GET /portal_notificacoes?prestador_id=X&lida=false` | ✅ |
| **Tela no App** | Tela "Notificacoes" — lista com badge de nao lidas | ✅ |
| **Exibicao na Torre** | Canal Realtime `torre-realtime-escalonamentos` → Timeline Operacional | ✅ |
| **Confirmacao de leitura** | Nao implementada — `portal_notificacoes.lida` nunca e atualizado para `true` | ❌ |
| **Lacunas** | (1) Sem confirmacao de leitura pelo motorista. (2) Sem push notification (Firebase/APNs) — apenas polling. (3) Sem canal de chat bidirecional Torre ↔ Motorista | |
| **Arquivos a alterar** | Flutter (marcar `lida=true` ao abrir notificacao), Firebase Cloud Messaging integration, `TorreControle.tsx` (chat) | |

### 1.24 Confirmacao de Leitura pelo Motorista

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `portal_notificacoes.lida` (bool, default false) | ❌ |
| **Tabela/view/RPC** | Nenhuma funcao que atualize `lida=true`. RPC `f_registrar_notificacao_app` so insere | ❌ |
| **Modelo Flutter** | Nao implementado — App le notificacoes mas nao confirma | ❌ |
| **Lacunas** | (1) Coluna `lida` existe mas nunca e atualizada. (2) Torre nao sabe se o motorista leu a notificacao. (3) Sem metricas de tempo medio de leitura | |
| **Arquivos a alterar** | Flutter (PATCH `portal_notificacoes` `lida=true`), `f_marcar_notificacao_lida()` RPC, `TorreControle.tsx` (status de leitura) | |

### 1.25 Financeiro da Operacao e do Prestador

| Item | Detalhe | Status |
|------|---------|:------:|
| **Origem no TMS** | `alocacoes_escala.valor_frete`, `valor_repasse`, `valor_total` (GENERATED) + 15+ colunas financeiras | ✅ |
| **Tabela/view/RPC** | `f_calcular_financeiro_operacao(p_alocacao_id, p_modo)` — calculo completo. Triggers M66+M80 propagam para `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os` | ✅ |
| **Modelo Flutter** | App mostra `valor_repasse` (ganho do motorista) + `valor_frete` (total do cliente) na tela de resumo | ✅ |
| **Tela no App** | "Resumo Financeiro" — cards com valor bruto, descontos, adicionais, saldo a receber | ✅ |
| **Reflexos no financeiro** | Trigger M66 na conclusao → 4 tabelas. Trigger M80 na OS direta → 4 tabelas. Cancelamento → `trg_cancelar_financeiro_escala` | ✅ |
| **Exibicao na Torre** | Torre NAO mostra dados financeiros em nenhum painel | ❌ |
| **Lacunas** | (1) Torre sem visao financeira integrada ao painel operacional. (2) `km_realizados` nao populado → `f_calcular_financeiro_operacao` calcula `km_adicional` como 0. (3) `v_espera` sempre 0 → sem cobranca de tempo parado. (4) Formulas divergentes: M66 usa `adicionais` (1 campo), `sincronizarFinanceiroOS` somava `combustivel+ajudante+adicional-desconto` (4 campos) | |
| **Arquivos a alterar** | `TorreControle.tsx` (painel financeiro no detalhe da OS), `f_avancar_etapa_app_motorista` (atualizar `km_realizados`), `f_calcular_financeiro_operacao` (usar `horario_inicio_real` e `horario_fim_real` para calcular espera) | |

---

## 2. CONTRATO DE EVENTOS OPERACIONAIS

### 2.1 Eventos Padronizados (Event Bus)

Cada avanco de etapa no App Flutter gera um evento no Event Bus (`eventos_oficiais`) com os seguintes campos padronizados:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | UUID | Gerado pela RPC via `gen_random_uuid()` |
| `tenant_id` | UUID | `alocacoes_escala.tenant_id` |
| `event_type` | TEXT | Tipo padronizado (ver tabela abaixo) |
| `entity_type` | TEXT | `'alocacao'` (sempre) |
| `entity_id` | UUID | `p_alocacao_id` (ID da alocacao) |
| `entity_number` | TEXT | `v_os_id::TEXT` (ID da OS vinculada) |
| `status` | TEXT | Status resultante (ex: `'em_andamento'`, `'concluida'`) |
| `source` | TEXT | `'app_motorista'` (origem do evento) |
| `created_by` | UUID | `v_prestador_id` (prestador autenticado) |
| `visibility` | TEXT | `'internal'` (visibilidade) |
| `payload` | JSONB | `{ etapa, etapa_anterior, payload, idempotency_key }` |
| `metadata` | JSONB | `{ app_motorista: {...}, prestador_id }` |
| `created_at` | TIMESTAMPTZ | `NOW()` |
| `processed_at` | TIMESTAMPTZ | `NULL` (consumido pela Torre em tempo real) |
| `version` | TEXT | `'1.0'` |
| `retry_count` | INT | `0` |

### 2.2 Mapeamento Etapa → Event Type

| Etapa (App Flutter) | event_type (Event Bus) | Significado Operacional |
|---------------------|------------------------|------------------------|
| `viagem_aceita` | `operation_accepted` | Motorista aceitou a operacao |
| `cheguei_coleta` | `arrived_pickup` | Chegou no local de coleta |
| `carregamento_iniciado` | `loading_started` | Iniciou carregamento |
| `carregamento_finalizado` | `loading_finished` | Finalizou carregamento |
| `romaneio_informado` | `romaneio_informado` | Informou dados do romaneio |
| `foto_romaneio` | `romaneio_foto` | Enviou foto do romaneio |
| `km_inicial_informado` | `km_registered` | Registrou KM inicial |
| `saiu_em_rota` | `route_started` | Saiu para rota de entrega |
| `chegou_entrega` | `arrived_delivery` | Chegou no destino |
| `descarregamento_iniciado` | `unloading_started` | Iniciou descarregamento |
| `descarga_finalizada` | `unloading_finished` | Finalizou descarregamento |
| `km_final_informado` | `km_final` | Registrou KM final |
| `assinatura_capturada` | `signature_captured` | Capturou assinatura do recebedor |
| `pod_registrado` | `pod_sent` | Enviou POD completo |
| `servico_finalizado` | `operation_finished` | Finalizou o servico |

### 2.3 Consumo pela Torre de Controle

`TorreControle.tsx:355-403` — `fetchTimeline()` consulta `eventos_oficiais` com filtro `IN (11 event_types)` e mapeia para `TimelineEvent` na UI:

| event_type | Tipo na Timeline | Severidade |
|-----------|-----------------|:----------:|
| `os.ordem_servico.criada` | `os_criada` | baixa |
| `os.ordem_servico.finalizada` | `os_concluida` | baixa |
| `escala.alocacao.aceita` | `os_em_rota` | baixa |
| `escala.alocacao.concluida` | `alocacao_concluida` | baixa |
| `escala.alocacao.recusada` | `os_atrasada` | alta |
| `escala.alocacao.cancelada` | `os_atrasada` | alta |
| `entrega.comprovante.pod_enviado` | `alocacao_concluida` | baixa |
| `portal.ocorrencia.aberta` | `ocorrencia_aberta` | critica |

**Nota:** Mapeamento atual na Torre NAO inclui todos os `event_types` do App Flutter. Apenas 8 tipos sao consumidos; os demais 7 tipos (`operation_accepted`, `arrived_pickup`, `loading_started`, `loading_finished`, `romaneio_informado`, `romaneio_foto`, `km_registered`, `route_started`, `arrived_delivery`, `unloading_started`, `unloading_finished`, `km_final`, `signature_captured`) NAO aparecem na Timeline Operacional.

---

## 3. CONTRATO DE RASTREAMENTO

### 3.1 Formato da Posicao

```json
{
  "alocacao_id": "uuid",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "velocidade": 45.2,
  "precisao": 10.5,
  "direcao": 270.0,
  "bateria": 85,
  "captured_at": "2026-08-01T14:30:00Z"
}
```

### 3.2 RPC `registrar_posicao_motorista`

**Assinatura (fix 2026-07-31):**
```sql
registrar_posicao_motorista(
  p_alocacao_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_velocidade NUMERIC DEFAULT NULL,
  p_precisao NUMERIC DEFAULT NULL,
  p_direcao NUMERIC DEFAULT NULL,
  p_bateria NUMERIC DEFAULT NULL,
  p_captured_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
```

**Validacoes:**
1. `auth.uid()` existe (autenticado)
2. `p_latitude` e `p_longitude` nao nulos
3. Coordenadas != (0,0)
4. Latitude entre -90 e 90
5. Longitude entre -180 e 180
6. Alocacao ativa (`status IN ('aceita','em_rota','ocorrencia')` e `finalizada=false`)
7. Prestador corresponde ao `auth.uid()` (via `prestadores.auth_user_id`)
8. Dedup: mesma coordenada nos ultimos 10s rejeitada

### 3.3 Frequencia de Envio

- App Flutter: **timer de 10 segundos** (GPS ativo durante rota)
- TMS (Torre): **Realtime** — canal Supabase escuta INSERT

### 3.4 Consumo pela Torre

| Metodo | Descricao |
|--------|-----------|
| `trackingService.buscarUltimasPosicoes()` | Busca inicial — ultimas 200 posicoes, deduplicadas por alocacao |
| Canal `torre-realtime-tracking` | Realtime — INSERT em `portal_tracking_realtime` atualiza `trackingPositions` state |
| `MapboxMap` markers | Se existe `trackingPosition` com `os_id` correspondente, usa coordenadas GPS em tempo real (`liveLat`/`liveLng`) em vez das coordenadas estaticas da OS |

### 3.5 Divergencia da RPC em Producao

A RPC `registrar_posicao_motorista` em producao foi corrigida em 2026-07-31 (`20260731_fix_registrar_posicao_motorista.sql`). A versao anterior (M106) usava `prestador_id = auth.uid()` diretamente — o que nunca funcionava porque `prestadores.id` nunca e igual a `auth.uid()`. A correcao usa `prestadores.auth_user_id = auth.uid()` para fazer o lookup correto.

---

## 4. CONTRATO DE EVIDENCIAS

### 4.1 Tabela `delivery_proofs` (App Flutter → Supabase)

```sql
CREATE TABLE public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id TEXT,                    -- ID da parada (multiparada) ou NULL (unico)
  operation_id TEXT,               -- UUID da alocacao (como TEXT)
  driver_id TEXT,                  -- UUID do prestador (como TEXT)
  receiver_name TEXT NOT NULL,     -- Nome do recebedor
  receiver_document TEXT,          -- CPF/CNPJ do recebedor
  receiver_relationship TEXT,      -- Relacao com o destinatario
  status TEXT NOT NULL DEFAULT 'pending', -- pending/delivered/delivered_with_note/not_delivered
  photo_url TEXT,                  -- URL da foto de entrega
  signature_url TEXT,              -- URL da assinatura digital
  foto_canhoto_url TEXT,           -- URL da foto do canhoto
  latitude DOUBLE PRECISION,       -- GPS da entrega
  longitude DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,   -- Precisao GPS em metros
  observation TEXT,                -- Observacoes
  delivered_at TIMESTAMPTZ,        -- Data/hora da entrega
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

### 4.2 Trigger de Sincronizacao: `f_sync_delivery_proof_to_entregas`

```
App Flutter: INSERT delivery_proofs
    ↓
Trigger: f_sync_delivery_proof_to_entregas
    ↓
1. CAST(NEW.operation_id AS UUID) → v_alocacao_id
2. Busca prestador_id, tenant_id, ordem_servico_id de alocacoes_escala
3. Verifica idempotencia: EXISTS (entregas_protocolo WHERE alocacao_id = v_alocacao_id)
4. INSERT em entregas_protocolo:
   - nome_recebedor ← NEW.receiver_name
   - documento_recebedor ← NEW.receiver_document
   - foto_entrega_url ← NEW.photo_url
   - assinatura_url ← NEW.signature_url
   - foto_canhoto_url ← NEW.foto_canhoto_url
   - data_hora_entrega ← NEW.delivered_at (fallback: NOW())
   - status ← mapeado: delivered→entregue, delivered_with_note→entregue_ressalva, not_delivered→nao_entregue
   - latitude, longitude, gps_accuracy ← NEW.*
```

### 4.3 Fluxos Duplicados (GAP Critico)

Existem **DUAS implementacoes** de finalizacao de POD:

| Caminho | Origem | Tabela | Trigger |
|---------|--------|--------|---------|
| **App Flutter** | `delivery_proofs` INSERT | → `entregas_protocolo` (via trigger) | `f_sync_delivery_proof_to_entregas` |
| **TMS AppPrestador.tsx** | `podService.finalizarComPOD()` | → `alocacoes_escala` + `entregas_protocolo` (direto) | Nenhum trigger |

O TMS admin (`AppPrestador.tsx`) finaliza via `pod.finalizar()` que chama `podService.finalizarComPOD()` — esta funcao atualiza `alocacoes_escala` com `status=concluida` e insere/atualiza `entregas_protocolo` DIRETAMENTE, sem passar por `delivery_proofs`.

**Risco:** Se o TMS admin finalizar um POD via `AppPrestador.tsx`, o `delivery_proofs` nunca recebe o registro — o trigger so dispara no sentido contrario.

---

## 5. CONTRATO DE OCORRENCIAS

### 5.1 Tabela `ocorrencias`

```sql
CREATE TABLE public.ocorrencias (
  id UUID PRIMARY KEY,
  os_id UUID REFERENCES ordens_servico(id),
  alocacao_id UUID REFERENCES alocacoes_escala(id),
  prestador_id UUID REFERENCES prestadores(id),
  cliente_id UUID REFERENCES clientes(id),
  tipo TEXT NOT NULL,
  status TEXT DEFAULT 'aberta',
  severidade TEXT DEFAULT 'media',
  descricao TEXT,
  visivel_cliente BOOLEAN DEFAULT true,
  evidencias JSONB DEFAULT '{}',
  criado_por TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Tipos de Ocorrencia (App Flutter)

| Tipo | Severidade | Impacto |
|------|:---------:|--------|
| `avaria` | alta | Carga danificada |
| `recusa` | alta | Cliente recusou |
| `transito` | media | Congestionamento |
| `acidente` | critica | Sinistro |
| `extravio` | critica | Carga perdida |
| `furto` | critica | Carga roubada |
| `endereco_incorreto` | media | Tentativa frustrada |
| `cliente_ausente` | media | Ninguem para receber |

### 5.3 Fluxo de Ocorrencia

```
App Flutter: Reportar Problema
    ↓
INSERT em ocorrencias (via supabase.from("ocorrencias").insert())
    ↓
1. Realtime: canal torre-realtime-ocorrencias na Torre
2. Timeline: fetchTimeline() na Torre adiciona evento oc-{id}
3. Acoes Prioritarias: OS com ocorrencia vira alerta CRITICO
4. Painel de Risco: stats.ocorrenciasCriticas incrementado
    ↓
LACUNA: Nenhum trigger atualiza alocacoes_escala.status para 'ocorrencia'
```

---

## 6. CONTRATO DE COMUNICACAO TORRE → APP

### 6.1 Tabela `portal_notificacoes`

```sql
CREATE TABLE public.portal_notificacoes (
  id UUID PRIMARY KEY,
  prestador_id UUID REFERENCES prestadores(id),
  titulo TEXT,
  mensagem TEXT,
  tipo TEXT DEFAULT 'operacao',   -- operacao/nova_os/oportunidade_aceita/nova_oportunidade
  origem_id UUID,                 -- ID da entidade de origem
  origem_tipo TEXT,               -- ordens_servico/rede_oportunidades/alocacoes_escala
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6.2 Triggers de Notificacao

| Trigger | Evento | Destino |
|---------|--------|---------|
| `trg_notificar_os_para_app` | INSERT/UPDATE `prestador_id` em `ordens_servico` | Notifica prestador sobre nova OS |
| `trg_notificar_oportunidade_rede` | INSERT em `rede_oportunidades` com `status='publicada'` | Notifica prestadores da regiao |

### 6.3 Funcao `f_registrar_notificacao_app`

Chamada programaticamente para enviar notificacoes pontuais:
```sql
f_registrar_notificacao_app(
  p_prestador_id UUID,
  p_titulo TEXT,
  p_mensagem TEXT,
  p_tipo TEXT DEFAULT 'operacao',
  p_origem_id UUID DEFAULT NULL,
  p_origem_tipo TEXT DEFAULT NULL
) RETURNS UUID
```

### 6.4 Confirmacao de Leitura (GAP)

A coluna `lida` existe mas nunca e atualizada. O App Flutter precisa implementar:
```
PATCH /portal_notificacoes?id=eq.{id}
{ "lida": true }
```

---

## 7. CONTRATO DE TIMELINE

### 7.1 Fontes da Timeline Operacional

A Torre de Controle consolida eventos de **3 fontes**:

| Fonte | Tabela | Filtro | Peso |
|-------|--------|--------|:----:|
| **Event Bus (primaria)** | `eventos_oficiais` | 11 `event_types` | Principal — M104 |
| **Ocorrencias** | `ocorrencias` | Ultimas 50 | Complementar |
| **Escalonamentos Humanos** | `escalonamentos_humanos` | Ultimos 50 | Alertas |

### 7.2 Estrutura do `TimelineEvent` na Torre

```typescript
interface TimelineEvent {
  id: string;                    // "eb-{uuid}" | "oc-{uuid}" | "alerta-{uuid}"
  timestamp: string;             // ISO 8601
  tipoEvento: TipoEventoTimeline; // 8 tipos
  severidade: "baixa" | "media" | "alta" | "critica";
  cliente: string;
  prestador: string;
  os: string;
  descricao: string;
}
```

### 7.3 Tipos de Evento Renderizados

| Tipo | Icone | Cor | Origem |
|------|-------|-----|--------|
| `os_criada` | Play | Azul | Event Bus: `os.ordem_servico.criada` / `escala.alocacao.criada` |
| `os_em_rota` | Truck | Indigo | Event Bus: `os.ordem_servico.status_changed` / `escala.alocacao.aceita` |
| `os_atrasada` | AlertTriangle | Rosa | Event Bus: cancelamentos/recusas |
| `os_concluida` | CheckCircle | Esmeralda | Event Bus: `os.ordem_servico.finalizada` |
| `ocorrencia_aberta` | AlertCircle | Ambar | Ocorrencias (tabela) |
| `alerta_humano` | Bell | Amarelo | Escalonamentos humanos |
| `comprovante_pendente` | FileX | Roxo | Nao renderizado via eventos — KPI separado |
| `alocacao_concluida` | CheckCircle | Verde-agua | Event Bus: `escala.alocacao.concluida` / `entrega.comprovante.pod_enviado` |

### 7.4 Gaps na Timeline

1. **7 eventos do App Flutter nao mapeados**: `operation_accepted`, `arrived_pickup`, `loading_started`, `loading_finished`, `romaneio_informado`, `romaneio_foto`, `km_registered`, `route_started`, `arrived_delivery`, `unloading_started`, `unloading_finished`, `km_final`, `signature_captured` — estao no Event Bus mas nao tem `TipoEventoTimeline` correspondente na Torre.

2. **Filtro `IN` limitado**: Torre so escuta 11 `event_types`. Os demais eventos do App sao persistidos mas nunca exibidos.

---

## 8. CONTRATO DO PAINEL DETALHADO DA OS

### 8.1 Estado Atual

O painel operacional da Torre (`selectedActionItem`) mostra:

| Campo | Origem | Status |
|-------|--------|:------:|
| Prioridade (critica/alta/media/baixa) | `ActionItem.prioridade` | ✅ |
| OS (numero) | `selectedActionItem.os` | ✅ |
| Cliente | `selectedActionItem.cliente` | ✅ |
| Prestador | `selectedActionItem.prestador` | ✅ |
| Previsao | `selectedOSData.previsaoTermino` | ✅ |
| Status SLA | `calcularStatusSLA()` | ✅ |
| Ocorrencia vinculada | `selectedOSOcorrencia` | ✅ |
| Comprovante pendente | `selectedOSComprovante` | ✅ |
| Risco operacional | `calcularRiscoOperacional()` | ✅ |
| Coordenada | `extrairCoordenadasOS()` | ✅ |

### 8.2 Campos AUSENTES no Painel

| Campo | Onde esta | Por que nao aparece |
|-------|-----------|---------------------|
| **Etapa atual do App** | `alocacoes_escala.metadata->'app_motorista'->>'etapa_atual'` | Torre nao consulta `alocacoes_escala` no painel |
| **Posicao GPS ao vivo** | `trackingPositions[alocacao_id]` | Painel nao acessa tracking |
| **Ultima atualizacao GPS** | `trackingPosition.captured_at` | Nao exibido |
| **Horario inicio real** | `alocacoes_escala.horario_inicio_real` | Torre nao consulta alocacao |
| **Horario fim real** | `alocacoes_escala.horario_fim_real` | Nao consultado |
| **KM previsto × realizado** | `alocacoes_escala.km_previstos` / `km_realizados` | Nao consultado |
| **Fotos da entrega** | `entregas_protocolo.foto_entrega_url` | Painel so verifica pendencia, nao exibe |
| **Assinatura** | `entregas_protocolo.assinatura_url` | Nao exibida |
| **Canhoto** | `entregas_protocolo.foto_canhoto_url` | Nao exibido |
| **Nome recebedor** | `entregas_protocolo.nome_recebedor` | Nao exibido |
| **Veiculo alocado** | `alocacoes_escala.placa` / `tipo_veiculo` | Nao consultado |
| **Dados financeiros** | `alocacoes_escala.valor_frete` / `valor_repasse` | Nao consultado |
| **Reversa/Devolucao** | `alocacoes_escala.reversa_*` | Nao consultado |
| **Checklists** | Inexistente | — |
| **Historico completo de etapas** | `operation_timeline_events` | Nao consultado |

### 8.3 Recomendacao

O painel detalhado precisa evoluir de "resumo da OS" para "dossie completo da operacao", integrando dados de:
- `ordens_servico` (ja consultado)
- `alocacoes_escala` (nao consultado no painel)
- `entregas_protocolo` (nao consultado no painel)
- `portal_tracking_realtime` (nao consultado no painel)
- `operation_timeline_events` (nao consultado no painel)

Todas essas tabelas ja tem os dados — o painel so precisa consulta-las.

---

## 9. LISTA DE LACUNAS POR CAMADA

### 9.1 Flutter (App Motorista)

| ID | Lacuna | Severidade |
|:--:|--------|:---------:|
| F01 | Sem fila offline para tracking — posicoes sao perdidas sem rede | Alta |
| F02 | Sem fila offline para avancos de etapa — etapas offline perdidas | Alta |
| F03 | Sem fila offline para POD — POD so e enviado com rede | Alta |
| F04 | Sem confirmacao de leitura de notificacoes (`lida=true`) | Media |
| F05 | `delivery_proofs.photo_url` — apenas 1 foto. Nao suporta multiplas fotos categorizadas | Media |
| F06 | Sem push notification (Firebase) — apenas polling | Media |
| F07 | Sem deteccao de tempo parado (geofence + timer) | Baixa |
| F08 | Checklist nao envia dados para o Supabase | Media |
| F09 | Upload de fotos de ocorrencia usa `evidencias` JSONB, nao bucket padrao | Baixa |

### 9.2 TMS Frontend (Torre de Controle)

| ID | Lacuna | Severidade |
|:--:|--------|:---------:|
| T01 | `fetchData()` consulta apenas `ordens_servico` — sem join com `alocacoes_escala` | Critica |
| T02 | Painel detalhado da OS nao mostra: etapa atual, posicao GPS, fotos, assinatura, veiculo, financeiro | Alta |
| T03 | Timeline nao renderiza 7 `event_types` do App Flutter | Alta |
| T04 | KPI `semComprovante` usa `comprovante_url` (coluna legada), nao `entregas_protocolo` | Media |
| T05 | KPI `aguardandoAceite` usa status OS, nao status alocacao | Media |
| T06 | KPI `concluidasHoje` usa status OS, nao status alocacao | Media |
| T07 | Mapa nao renderiza polilinha de rota (historico de trajeto) | Media |
| T08 | `buscarUltimasPosicoes()` deduplica por alocacao — retorna so 1 posicao | Media |
| T09 | Sem painel financeiro integrado ao detalhe da OS | Baixa |
| T10 | Sem alerta de motorista parado (>15min) | Baixa |
| T11 | Sem KPI de taxa de insucesso/devolucao | Baixa |
| T12 | Sem status de checklist no painel | Baixa |

### 9.3 Integracao (Supabase / RPCs / Triggers)

| ID | Lacuna | Severidade |
|:--:|--------|:---------:|
| I01 | `f_avancar_etapa_app_motorista` marcada como `STABLE` mas executa UPDATE (anomalia A01) | Alta |
| I02 | `f_atualizar_reversa_app` tem versao divergente em producao (M119 sobrescreveu M133-D.2) | Alta |
| I03 | Todas as 3 RPCs do App com `PUBLIC` + `anon` EXECUTE (anomalia A03) | Alta |
| I04 | `f_avancar_etapa_app_motorista` nao atualiza `km_realizados` — so grava em metadata | Alta |
| I05 | Correcoes M133-D.4 prontas mas NAO aplicadas em producao | 🔶 Bloqueado |
| I06 | `podService.finalizarComPOD()` (TMS) e `delivery_proofs` (Flutter) sao fluxos duplicados | Media |
| I07 | Trigger `f_sync_delivery_proof_to_entregas` so dispara no INSERT — updates ignorados | Media |
| I08 | Sem trigger que atualiza `alocacoes_escala.status='ocorrencia'` ao abrir ocorrencia | Media |
| I09 | `f_calcular_financeiro_operacao` usa `km_realizados` (coluna NULL) → km excedente nunca cobrado | Critica |
| I10 | `f_calcular_financeiro_operacao` `v_espera` sempre 0 → sem cobranca de tempo parado | Media |
| I11 | Sem tabela `checklists_operacao` | Media |
| I12 | `entregas_protocolo` criada diretamente no Supabase — schema nao versionado em migration | Baixa |

### 9.4 Banco / RPC (dependente de autorizacao)

| ID | Lacuna | Severidade |
|:--:|--------|:---------:|
| B01 | Migration `m133d4_fix_rpc_app_security.sql` pronta, nao aplicada (STABLE→VOLATILE + grants) | 🔶 Bloqueado |
| B02 | Migration `m133d4_rollback.sql` pronta para rollback seguro | 🔶 Bloqueado |
| B03 | Migration `m133d2_hotfix_recriar_funcoes.sql` pendente | 🔶 Bloqueado |
| B04 | `f_atualizar_reversa_app` em producao difere da migration (assinatura: jsonb vs text[], date vs timestamptz) | Alta |
| B05 | `alocacoes_escala` sem colunas: `horario_chegada_coleta`, `horario_saida_coleta`, `horario_chegada_destino`, `qtd_volumes_coleta`, `qtd_volumes_entregues`, `qtd_avarias` | Media |
| B06 | Sem UNIQUE constraint em `financeiro_pagar.os_id` (corrigido em M80 mas requer verificacao) | Media |

---

## 10. ROADMAP INTEGRADO SEM RETRABALHO

### Fase 0 — Aplicar Correcoes Bloqueadas (🔶)
**Responsavel:** DBA / Supabase Admin
**Estimativa:** 1-2 horas
**Risco:** Baixo (migrations ja validadas com `BEGIN/ROLLBACK` remoto)

| Ordem | Acao | Migration |
|:-----:|------|-----------|
| 0.1 | Aplicar fix STABLE→VOLATILE + grants | `20260722_m133d4_fix_rpc_app_security.sql` |
| 0.2 | Aplicar hotfix recriar funcoes | `20260722_m133d2_hotfix_recriar_funcoes.sql` |
| 0.3 | Validar grants com `has_function_privilege` remoto | — |
| 0.4 | Testar `f_atualizar_reversa_app` com usuario autenticado real | — |

### Fase 1 — Torre de Controle: Painel Completo
**Responsavel:** Dev Frontend (TMS)
**Estimativa:** 3-5 dias
**Dependencia:** Fase 0 concluida

| Ordem | Acao | Arquivo |
|:-----:|------|---------|
| 1.1 | `fetchData()`: adicionar JOIN com `alocacoes_escala` | `TorreControle.tsx` |
| 1.2 | Painel detalhado: exibir etapa atual, posicao GPS, fotos, assinatura, canhoto, recebedor, veiculo, km, financeiro | `TorreControle.tsx` |
| 1.3 | Timeline: adicionar 7 `event_types` do App Flutter ao `tipoMap` | `TorreControle.tsx:377-389` |
| 1.4 | Corrigir KPIs: `semComprovante` usar `entregas_protocolo`, `aguardandoAceite` usar `alocacoes_escala.status`, `concluidasHoje` usar `alocacoes_escala.status` | `TorreControle.tsx:307-342` |
| 1.5 | Adicionar `event_types` do App ao filtro `fetchTimeline()` | `TorreControle.tsx:358-370` |

### Fase 2 — Tracking e Mapa
**Responsavel:** Dev Frontend (TMS)
**Estimativa:** 2-3 dias

| Ordem | Acao | Arquivo |
|:-----:|------|---------|
| 2.1 | `buscarUltimasPosicoes()`: renomear para `buscarUltimasPosicoesPorAlocacao()` + criar `buscarHistoricoRota(alocacaoId)` | `trackingService.ts` |
| 2.2 | `MapboxMap`: adicionar camada de polilinha (`routeGeometry`) para replay de rota | `MapboxMap.tsx` |
| 2.3 | Alerta de motorista parado: usar `trackingPositions` para detectar velocidade < 1 por > 15min | `acoesPrioritarias.ts` |
| 2.4 | Mapa: indicador "ultima atualizacao ha X min" nos markers | `TorreControle.tsx` |

### Fase 3 — App Flutter: Offline + Checklist
**Responsavel:** Dev Flutter
**Estimativa:** 5-8 dias
**Dependencia:** Fase 0 concluida

| Ordem | Acao |
|:-----:|------|
| 3.1 | Fila offline para tracking (SQLite local → sync quando online) |
| 3.2 | Fila offline para avancos de etapa (idempotency key) |
| 3.3 | Fila offline para POD (armazenar localmente, enviar quando online) |
| 3.4 | Confirmacao de leitura: `PATCH portal_notificacoes lida=true` |
| 3.5 | Checklist: enviar `checklists_operacao` INSERT ao concluir |
| 3.6 | Multiplas fotos: enviar array `photos[]` em vez de `photo_url` unica |

### Fase 4 — RPCs e Triggers
**Responsavel:** DBA
**Estimativa:** 2-3 dias
**Dependencia:** Fase 0 concluida

| Ordem | Acao | Migration |
|:-----:|------|-----------|
| 4.1 | `f_avancar_etapa_app_motorista`: atualizar `km_realizados` na etapa `km_final_informado` | Nova |
| 4.2 | `f_calcular_financeiro_operacao`: corrigir para ler `km_realizados` da alocacao | Nova |
| 4.3 | Trigger: `trg_ocorrencia_atualiza_alocacao` — ao abrir ocorrencia, atualizar `alocacoes_escala.status='ocorrencia'` | Nova |
| 4.4 | Trigger: `trg_notificar_cliente_insucesso` — ao registrar `status='not_delivered'`, notificar cliente | Nova |
| 4.5 | Tabela `checklists_operacao`: alocacao_id, tipo, itens JSONB, fotos, assinatura, created_at | Nova |
| 4.6 | Validacao `f_avancar_etapa_app_motorista`: bloquear `saiu_em_rota` sem checklist concluido | Nova |

### Fase 5 — Unificacao e Limpeza
**Responsavel:** Dev Fullstack
**Estimativa:** 3-4 dias

| Ordem | Acao |
|:-----:|------|
| 5.1 | Unificar `podService.finalizarComPOD()` com fluxo `delivery_proofs` |
| 5.2 | Remover `AppPrestador.tsx` da rota de producao (substituir pelo App Flutter) |
| 5.3 | Adicionar colunas em `alocacoes_escala`: `horario_chegada_destino`, `qtd_volumes_coleta`, `qtd_volumes_entregues`, `qtd_avarias`, `sla_status`, `tempo_parado_segundos` |
| 5.4 | Depreciar coluna `comprovante_url` (substituir por `entregas_protocolo`) |
| 5.5 | Documentar schema `entregas_protocolo` em migration versionada |

---

## 11. SEPARACAO: FLUTTER × TMS × INTEGRACAO × BANCO

### 11.1 Responsabilidades

| Camada | Dono | O que pode fazer sem autorizacao |
|--------|------|----------------------------------|
| **Flutter (PWA)** | Time Mobile | Telas, UX, fluxo de etapas, camera, GPS nativo, fila offline |
| **TMS Frontend** | Time Web | Torre de Controle, KPIs, paineis, mapa, timeline |
| **Integracao (services)** | Time Web | `trackingService`, `podService`, `escalaService`, `portalClienteService` — queries e subscriptions |
| **Banco / RPCs** | DBA / Admin | Migrations, RLS, RPCs, triggers, grants, constraints |
| **Edge Functions** | Time Web | `proxy-ia` (ja existe), novas edge functions para push notification |

### 11.2 O que PODE ser feito agora (sem autorizacao)

| Acao | Camada |
|------|--------|
| Reescrever `TorreControle.tsx` para JOIN com `alocacoes_escala` | TMS Frontend |
| Adicionar `event_types` do App a timeline | TMS Frontend |
| Expandir painel detalhado da OS | TMS Frontend |
| Criar `buscarHistoricoRota()` em `trackingService` | Integracao |
| Corrigir KPIs para usar tabelas corretas | TMS Frontend |
| Adicionar polilinha de rota no `MapboxMap` | TMS Frontend |
| Alerta de motorista parado em `acoesPrioritarias.ts` | TMS Frontend |
| Fila offline no Flutter (SQLite) | Flutter |
| Checklist UI no Flutter | Flutter |
| Confirmacao de leitura no Flutter | Flutter |
| Testes E2E para cada novo fluxo | QA |

### 11.3 O que REQUER autorizacao (🔶 bloqueado)

| Acao | Migration | Impacto |
|------|-----------|---------|
| Aplicar fix STABLE→VOLATILE | `m133d4_fix_rpc_app_security.sql` | Altera 3 RPCs em producao |
| Corrigir grants (remover PUBLIC+anon) | `m133d4_fix_rpc_app_security.sql` | App Flutter perde acesso se nao autenticado |
| Criar trigger `trg_ocorrencia_atualiza_alocacao` | Nova | Altera comportamento de INSERT em `ocorrencias` |
| Criar tabela `checklists_operacao` | Nova | Nova tabela em producao |
| Adicionar colunas em `alocacoes_escala` | Nova | Schema change em producao |
| `f_avancar_etapa_app_motorista`: atualizar `km_realizados` | Nova | Altera logica da RPC |
| `f_calcular_financeiro_operacao`: corrigir `km_realizados` | Nova | Altera calculo financeiro |

---

## 12. RECOMENDACAO DA PRIMEIRA IMPLEMENTACAO SEGURA

### Ordem Recomendada

```
Fase 1 (sem autorizacao): Torre de Controle — Painel Completo
  ↓ 3-5 dias, apenas TypeScript/React, zero SQL
  ↓ Entrega: painel detalhado mostra etapa atual, GPS, fotos e financeiro

Fase 0 (com autorizacao): Aplicar correcoes bloqueadas
  ↓ 1-2 horas, 2 migrations ja validadas
  ↓ Entrega: RPCs corretas (VOLATILE + grants seguros)

Fase 4 (com autorizacao): RPCs e Triggers
  ↓ 2-3 dias, migrations novas
  ↓ Entrega: km_realizados populado, financeiro calculado corretamente

Fase 2 (sem autorizacao): Tracking e Mapa
  ↓ 2-3 dias, TypeScript/React
  ↓ Entrega: replay de rota, alerta de motorista parado

Fase 3 (time Flutter): Offline + Checklist
  ↓ 5-8 dias, Dart/Flutter
  ↓ Entrega: App resistente a falhas de rede, checklist funcional

Fase 5 (sem autorizacao): Unificacao e Limpeza
  ↓ 3-4 dias, TypeScript + migrations
  ↓ Entrega: fluxo unico de POD, schema versionado, codigo morto removido
```

### First Safe Step

**Implementar Fase 1.1 + 1.2 + 1.4 primeiro** — zero dependencia de autorizacao, zero SQL, apenas TypeScript no `TorreControle.tsx`:

1. `fetchData()`: adicionar JOIN `alocacoes_escala` com `ordens_servico`
2. Painel detalhado: consumir `alocacoes_escala.metadata->'app_motorista'->>'etapa_atual'`, `trackingPositions`, `entregas_protocolo`
3. Corrigir KPIs para usar `alocacoes_escala` em vez de `ordens_servico` onde apropriado

**Impacto imediato:** A Torre de Controle passara a mostrar o que realmente esta acontecendo em cada operacao, usando dados que ja existem no banco.

---

## ARQUIVOS QUE FUTURAMENTE PRECISARAO SER ALTERADOS

### TMS Frontend (8 arquivos)

| Arquivo | Fase | Alteracao |
|---------|:----:|-----------|
| `src/pages/TorreControle.tsx` | 1, 2 | JOIN alocacoes, painel expandido, KPIs corrigidos, timeline completa |
| `src/lib/acoesPrioritarias.ts` | 1, 2 | Alerta motorista parado, alerta checklist |
| `src/components/MapboxMap.tsx` | 2 | Camada de polilinha (`routeGeometry`) |
| `src/services/rastreamento/trackingService.ts` | 2 | `buscarHistoricoRota()`, corrigir `buscarUltimasPosicoes()` |
| `src/services/escala/escalaService.ts` | 1 | Expor `buscarAlocacaoCompleta()` com JOINs |
| `src/hooks/useEscala.ts` | 1 | Hook `useAlocacaoDetalhe()` para painel |
| `src/services/podService.ts` | 5 | Unificar com `delivery_proofs` ou depreciar |
| `src/pages/AppPrestador.tsx` | 5 | Depreciar (substituir pelo App Flutter) |

### Supabase / Migrations (6 arquivos)

| Arquivo | Fase | Alteracao |
|---------|:----:|-----------|
| `20260722_m133d4_fix_rpc_app_security.sql` | 0 | Aplicar em producao |
| `20260722_m133d2_hotfix_recriar_funcoes.sql` | 0 | Aplicar em producao |
| Nova: `checklists_operacao.sql` | 4 | Criar tabela |
| Nova: `fix_km_realizados_rpc.sql` | 4 | Atualizar `f_avancar_etapa_app_motorista` |
| Nova: `trg_ocorrencia_atualiza_alocacao.sql` | 4 | Criar trigger |
| Nova: `add_colunas_alocacao_v2.sql` | 5 | Adicionar colunas faltantes em `alocacoes_escala` |

### Flutter (3 arquivos estimados)

| Modulo | Fase | Alteracao |
|--------|:----:|-----------|
| `tracking_service.dart` | 3 | Fila offline SQLite + sync |
| `delivery_proof_service.dart` | 3 | Multiplas fotos, fila offline POD |
| `notification_service.dart` | 3 | Confirmacao de leitura, push notifications |

---

## APENDICE: DIAGRAMA DE FLUXO COMPLETO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TMS — CRIA OPERACAO                             │
│                                                                          │
│  OrdemServicoForm.tsx                                                    │
│    ↓ cria OS + alocacao                                                  │
│  ordens_servico ──→ alocacoes_escala (via escalaService)                │
│    ↓                                                                     │
│  Trigger trg_notificar_os_para_app                                       │
│    ↓                                                                     │
│  portal_notificacoes (notifica prestador)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       APP FLUTTER — EXECUTA                              │
│                                                                          │
│  1. Abre App → consulta portal_notificacoes (nova OS)                   │
│  2. Ve operacao → botao "Aceitar"                                        │
│     ↓ RPC: f_avancar_etapa_app_motorista(p_etapa='viagem_aceita')       │
│     ↓ alocacoes_escala: aceite_prestador=true, data_aceite, status=aceita│
│     ↓ eventos_oficiais: operation_accepted                               │
│     ↓ operation_timeline_events: INSERT                                  │
│                                                                          │
│  3. Chegou na coleta → "Cheguei"                                         │
│     ↓ RPC: f_avancar_etapa_app_motorista(p_etapa='cheguei_coleta')      │
│     ↓ alocacoes_escala: horario_inicio_real, status=em_rota              │
│     ↓ eventos_oficiais: arrived_pickup                                   │
│                                                                          │
│  4-6. Carregamento → romaneio → foto → KM inicial → "Saiu para rota"    │
│     ↓ cada etapa via f_avancar_etapa_app_motorista()                     │
│     ↓ eventos_oficiais: loading_started → loading_finished →             │
│        romaneio_informado → romaneio_foto → km_registered → route_started│
│                                                                          │
│  7. GPS ativo: timer 10s → RPC registrar_posicao_motorista()             │
│     ↓ portal_tracking_realtime: INSERT cada 10s                          │
│     ↓ Trigger: f_trg_tracking_iniciado (primeira vez)                    │
│     ↓ Trigger: f_trg_atualizar_status_alocacao_tracking                  │
│                                                                          │
│  8. Chegou no destino → descarregamento → KM final                       │
│     ↓ RPC: f_avancar_etapa_app_motorista (etapas 11-13)                  │
│     ↓ eventos_oficiais: arrived_delivery → unloading_started →           │
│        unloading_finished → km_final                                     │
│                                                                          │
│  9. Coletou assinatura + fotos + canhoto                                 │
│     ↓ RPC: f_avancar_etapa_app_motorista (assinatura_capturada,          │
│        pod_registrado)                                                   │
│     ↓ INSERT delivery_proofs                                             │
│     ↓ Trigger: f_sync_delivery_proof_to_entregas                         │
│     ↓ entregas_protocolo: INSERT                                         │
│     ↓ eventos_oficiais: signature_captured → pod_sent                    │
│                                                                          │
│  10. Finalizar servico                                                   │
│     ↓ RPC: f_avancar_etapa_app_motorista(p_etapa='servico_finalizado')  │
│     ↓ alocacoes_escala: status=concluida, finalizada=true                │
│     ↓ eventos_oficiais: operation_finished                               │
│     ↓ Trigger M66: f_trg_propagar_financeiro_alocacao                    │
│     ↓ financeiro_receber, financeiro_pagar, pagamentos_prestadores,      │
│        composicao_financeira_os: INSERT/UPDATE                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    TORRE DE CONTROLE — MONITORA                          │
│                                                                          │
│  Canais Realtime (5):                                                    │
│    torre-realtime-os → ordens_servico                                    │
│    torre-realtime-ocorrencias → ocorrencias                              │
│    torre-realtime-alocacoes → alocacoes_escala                           │
│    torre-realtime-escalonamentos → escalonamentos_humanos                │
│    torre-realtime-tracking → portal_tracking_realtime                    │
│                                                                          │
│  Timeline: eventos_oficiais + ocorrencias + escalonamentos_humanos       │
│  Mapa: markers com coordenadas staticas + GPS ao vivo (liveLat/liveLng) │
│  KPIs: em rota, aguardando aceite, atrasadas, com ocorrencia,            │
│        sem comprovante, concluidas hoje                                  │
│  Acoes Prioritarias: criticas → altas → medias → baixas                 │
│  Painel de Risco: 5 indicadores                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**Fim do relatorio TMS-027.**
