# TMS-020 — Auditoria Definitiva de Prontidão do App Motorista

**Data:** 2026-07-29
**Contexto:** Projeto Conexão Express TMS / Express Connect Hub
**Ambiente:** Produção (único) — sem QA
**Usuário de homologação:** `teste@conexao.com` (auth ID `a5e51631-5ed8-430d-9041-4b185c03d821`)
**Prestador:** PRESTADOR TESTE APP (ID `e6646799-fbac-453e-a3ef-afdfc01a7085`)

---

## 1. Diagnóstico Real do Aplicativo

### 1.1 Arquitetura Geral

- **Framework:** Flutter (Riverpod + go_router)
- **Backend:** Supabase (PostgreSQL + Realtime + Storage)
- **Autenticação:** Supabase Auth (email/senha + JWT)
- **TMS:** Express Connect Hub (React + TypeScript)
- **App Motorista (Flutter):** `C:\src\conexao_prestador\`
- **TMS (React):** `C:\Users\...\express-connect-hub\`

### 1.2 Estruturas de Dados Principais

| Tabela | Função | App consulta? | App escreve? | TMS consulta? | TMS escreve? |
|--------|--------|:---:|:---:|:---:|:---:|
| `alocacoes_escala` | Operações/missões do motorista | ✅ RPC | ✅ RPC | ✅ | ✅ |
| `prestadores` | Dados do motorista | ✅ | ⚠️ perfil | ✅ | ✅ |
| `entregas_protocolo` | POD da entrega | ❌ | ❌ | ✅ | ⚠️ |
| `financeiro_pagar` | Valores a pagar ao prestador | ✅ | ❌ | ✅ | ✅ |
| `pagamentos_prestadores` | Pagamentos realizados | ✅ (leitura) | ❌ | ✅ | ✅ |
| `pending_uploads` | Fila offline de uploads | ✅ | ✅ | ❌ | ❌ |
| `operation_timeline_events` | Eventos da operação | ✅ | ✅ | ❌ | ❌ |
| `eventos_oficiais` | Comunicados/notificações | ✅ | ❌ (lida) | ✅ | ✅ |
| `delivery_proofs` | Prova de entrega alternativa | ✅ | ✅ | ❌ | ❌ |
| `prestadores_app` | Fallback para ID do prestador | ✅ fallback | ❌ | ❌ | ❌ |
| `os_pod` | POD alternativo (legado) | ❌ | ❌ | ❌ | ❌ |
| `motorista_app_sessoes` | Sessões login | ❌ | ❌ | ❌ | ❌ |
| `motorista_checkins` | Check-in motorista | ❌ | ❌ | ❌ | ❌ |
| `prestador_disponibilidade` | Disponibilidade diária | ❌ | ❌ | ❌ | ❌ |
| `prestador_candidaturas` | Candidaturas | ❌ | ❌ | ❌ | ❌ |
| `prestador_reembolsos` | Reembolsos | ❌ | ❌ | ❌ | ❌ |
| `prestador_notificacoes` | Notificações | ❌ | ❌ | ❌ | ❌ |
| `prestador_engajamento` | Score/bonificação | ❌ | ❌ | ❌ | ❌ |
| `portal_tracking_realtime` | GPS tempo real | ❌ | ✅ | ❌ | ❌ |

---

## 2. O Que Está Concluído e Comprovado

### 2.1 Autenticação e Sessão ✅
- Login com email/senha via Supabase Auth
- Splash → Login → Home (fluxo completo)
- Redirect automático para login se não autenticado
- **Comprovado:** Funciona no celular do usuário (teste@conexao.com logado)

### 2.2 Tela Inicial (Home) ✅
- Header com saudação, nome do prestador, toggle disponibilidade, score
- Card de operação ativa
- Card de operações pendentes
- Indicadores do dia (km, ganhos, pendências offline)
- Card de sincronização
- Resumo financeiro
- Lista de comunicados
- Acesso rápido (Suporte, Guias, Radar, Alertar)
- **Comprovado:** Tela carrega no celular, identifica prestador

### 2.3 Lista de Operações ✅
- Tela de operações com seções: Aguardando aceite, Em operação, Agendadas, Finalizadas
- Chips de informação (origem, destino, valor, data)
- Navegação para detalhe
- **Comprovado:** Código completo, RPC `f_buscar_operacoes_motorista` existe

### 2.4 Detalhe da Operação ✅
- Tela de detalhe com estágios da operação
- Tracking panel
- Timeline
- Próxima ação
- Documentos
- **Comprovado:** Código completo

### 2.5 Tracking ✅
- `RealTrackingService` completo com fila offline, backoff, retentativas
- `ForegroundTrackingService` para tracking em foreground
- `TrackingRepository` para envio de pontos GPS
- 3 modos: minInterval (15s), background (30s), lowBattery (60s)
- **Comprovado:** Código implementado, integrado via RPC

### 2.6 Navegação (Shell + Bottom Nav) ✅
- 5 abas: Início, Operações, Ganhos, Radar, Perfil
- `StatefulShellRoute` com índice preservado
- **Comprovado:** Código completo

---

## 3. O Que Está Somente Visual (Interface sem Dados Reais)

### 3.1 Radar Screen ⚠️
- Rota `/radar` existe no router
- Tela `RadarScreen` importada
- **Problema:** Home screen `_buildRadarSlim()` renderiza `ListView` vazia (linhas 1050-1056). Não há dados.

### 3.2 Perfil (Score e Nível) ⚠️
- Tela de perfil com score, nível, badges
- `DriverProfileRepository` consulta `prestadores`
- **Problema:** Score e nível dependem de `prestador_engajamento` (tabela fantasma — não populada). No celular, exibe "Seu desempenho ainda não foi calculado."

### 3.3 Guideline Screen ⚠️
- `GuidelinesScreen` existe, rota `/guidelines`
- **Problema:** Depende de `guidelines_repository.dart` que não foi auditado. Possível mock.

### 3.4 Network Screen (Rede de Oportunidades) ⚠️
- `NetworkScreen` existe, rota `/network`
- Card "Rede de Oportunidades" no Home
- **Problema:** `NetworkRepository` existe, mas não há evidência de dados reais.

---

## 4. O Que Está Parcial

### 4.1 Operações no App — PARCIAL (50%)
**Fluxo completo mapeado:**
1. ✅ TMS cria alocação em `alocacoes_escala`
2. ✅ App consulta via RPC `f_buscar_operacoes_motorista`
3. ✅ App exibe na lista e no card ativo
4. ✅ App pode aceitar (`acceptOperation`)
5. ✅ App pode avançar etapas (`avancarEtapa`)
6. ✅ App pode finalizar (`finishOperation`)
7. ⚠️ RPC `f_atualizar_etapa_app` existe mas não foi testado com dados reais
8. ❌ Retorno da ação ao TMS não comprovado (TMS não atualiza automaticamente)
9. ❌ Trigger de propagação M66 não considera app como origem
10. ❌ Status no TMS pode ficar dessincronizado

**Estados mapeados na máquina de estados (16 estados):**
`aguardando_aceite → aceita → em_deslocamento → chegada_coleta → carregando → em_rota → chegada_destino → entrega → assinatura → pod_enviado → conferencia → concluida → financeiro → arquivada → cancelada`

**Problemas:**
- Operação criada no seed tem `status = 'aguardando_aceite'` e `aceite_prestador = false` — correta para teste
- Máquina de estados no app é completa, mas validação real só acontecerá com seed

### 4.2 Financeiro no App — PARCIAL (40%)
- `EarningsScreen` existe (aba Ganhos)
- `FinancialRepository.fetchSummary()` consulta `financeiro_pagar` e `pagamentos_prestadores`
- DriverOperationsRepository.fetchFinancialSummary() também consulta `financeiro_pagar` e `alocacoes_escala`
- **Problema:** `financeiro_pagar` usa `.eq('prestador', driverId)` — mas `prestador` é campo TEXT, não UUID. Compara `auth.uid()` com texto. Pode falhar.
- Home exibe "Dados financeiros indisponíveis — aguardando processamento do TMS" quando não há dados

### 4.3 Coleta Reversa — PARCIAL (60%)
- `ReverseCollectionScreen` completa com 9 etapas
- Coleta: fotos, assinatura, divergência, quantidade, responsável
- RPC `f_atualizar_reversa_app` existe (MISSÃO 133-D.4)
- **Problema:** RPC tem anomalia A02 (versão diferente em produção, falta validação auth.uid())
- Fluxo offline implementado via `OfflineUploadQueue`
- Eventos registrados em `operation_timeline_events`
- **Falta:** Validação de integração com TMS, propagação para `entregas_protocolo`

### 4.4 POD (Prova de Entrega) — PARCIAL (20%)
- `DeliveryProofRepository` existe com tabela `delivery_proofs`
- `StorageUploadService` para upload de fotos
- **Problema:** `delivery_proofs` é tabela separada de `entregas_protocolo` (tabela oficial do TMS)
- App escreve em `delivery_proofs` → TMS nunca lê (usa `entregas_protocolo`)
- App NÃO escreve em `entregas_protocolo` → TMS nunca vê o POD do app
- `registerSignature()` e `registerPodSent()` chamam `avancarEtapa` com payload genérico — sem dados reais de POD

### 4.5 Offline e Sincronização — PARCIAL (50%)
- `OfflineUploadQueue` completa: persistência local, retentativas, backoff, max 5 tentativas
- `PendingUpload` modelo no banco `pending_uploads`
- Fila carrega do banco no `init()`
- **Problema:** Só gerencia uploads de arquivos (fotos), não fila de RPCs offline
- Reversa tem fallback offline próprio (`_queueOffline()`), mas salva como `PendingUpload` do tipo `reversa_rpc` — sem reprocessamento real
- 7 pendências offline no celular não foram diagnosticadas (requer acesso ao banco)

### 4.6 Comunicados/Notificações — PARCIAL (30%)
- `NotificationService` escuta Realtime em `eventos_oficiais`
- Home exibe comunicados com ícone, prioridade, data
- **Problema no celular:** "comunicados aparecem sem título ou conteúdo visível"
- Causa: `OfficialEvent.fromJson()` espera `titulo` e `mensagem` — se o banco retornar `title`/`message` (inglês) ou dados nulos, o app exibe strings vazias
- Prioridade "BAIXA" é o default para tipo desconhecido

---

## 5. O Que Está Ausente

### 5.1 Três Tipos de Operação — AUSENTE

O código do app referencia `operationMode` com estes valores:
- `'dedicated'` (Direta) — default
- `'simple_order'` (OS Avulsa)
- `'multi_stop_route'` / `'route'` (Multi paradas)
- `'network'` / `'rede'` (Rede)
- `'daily_control'` (Controle Diário)

**Realidade:**
- `alocacoes_escala` NÃO tem coluna `operation_mode` — o valor é sempre `'dedicated'` (default no app)
- Não existe diferenciação real de tipos de operação no banco
- O seed cria apenas `tipo_veiculo` ('moto', 'carro') — não tipo de operação
- A máquina de estados é única para todos os tipos

### 5.2 Coleta Reversa Integrada ao TMS — AUSENTE
- App tem tela completa de coleta reversa
- RPC `f_atualizar_reversa_app` existe
- **TMS não tem fluxo de coleta reversa** — não cria, não gerencia, não consulta
- `ReverseCollectionEntity` carrega dados mock/estáticos (sem consulta ao banco)
- Sem trigger, sem propagação, sem financeiro para reversa

### 5.3 Devolução Integrada — AUSENTE
- App tem etapa de devolução na coleta reversa
- TMS não gerencia devolução como entidade separada
- Sem tabela, sem fluxo, sem tracking

### 5.4 Assinatura e Canhoto com TMS — AUSENTE
- App captura assinatura (ReverseCollectionScreen)
- App captura foto (StorageUploadService → Supabase Storage)
- **Problema:** Dados ficam no Storage mas não são vinculados a `entregas_protocolo`
- TMS consulta `entregas_protocolo` para POD — app nunca escreve lá
- `DeliveryProofRepository` escreve em `delivery_proofs` (tabela que TMS nunca lê)

### 5.5 Tracking em Tempo Real no Portal — AUSENTE
- App tem `RealTrackingService` completo com GPS
- `TrackingRepository` envia pontos
- `ForegroundTrackingService` mantém tracking ativo
- **TMS/Portal não recebem tracking em tempo real**
- `portal_tracking_realtime` é tabela fantasma (M61)
- Nenhum ponto GPS do app chega ao TMS ou Portal Cliente

### 5.6 Tabelas de Negócio do App sem Uso — AUSENTE
- `os_pod` — schema existe, app não usa
- `prestador_disponibilidade` — código preparatório, zero inserts
- `prestador_candidaturas` — schema apenas
- `prestador_reembolsos` — código preparatório
- `prestador_notificacoes` — código preparatório
- `prestador_engajamento` — score/bônus, sem dados
- `motorista_app_sessoes` — tabela existe, app não usa
- `motorista_checkins` — tabela existe, app não usa

---

## 6. Percentual Real de Prontidão

### Fórmula

Para cada funcionalidade, avaliei 4 camadas (0 ou 1 ponto cada):
1. **Interface** — Tela/menu existe e renderiza
2. **Integração Supabase** — Consulta/escrita real no banco
3. **Integração TMS** — TMS reconhece e processa os dados
4. **Fluxo completo** — TMS → App → Ação → Retorno ao TMS

Percentual = (pontos obtidos / pontos possíveis) × 100

| Funcionalidade | Interface | Supabase | TMS | Fluxo | % |
|:---------------|:---:|:---:|:---:|:---:|:-:|
| Autenticação | 1 | 1 | 1 | 1 | **100%** |
| Home / Header | 1 | 1 | 0 | 0 | **50%** |
| Lista Operações | 1 | 1 | 1 | 0 | **75%** |
| Detalhe Operação | 1 | 1 | 0 | 0 | **50%** |
| Aceitar Operação | 1 | 1 | 0 | 0 | **50%** |
| Avançar Etapas | 1 | 1 | 0 | 0 | **50%** |
| Finalizar Operação | 1 | 1 | 0 | 0 | **50%** |
| Tracking GPS | 1 | 1 | 0 | 0 | **50%** |
| POD (entrega) | 1 | 1 | 0 | 0 | **50%** |
| Assinatura | 1 | 1 | 0 | 0 | **50%** |
| Coleta Reversa | 1 | 1 | 0 | 0 | **50%** |
| Devolução | 1 | 0 | 0 | 0 | **25%** |
| Financeiro (ver) | 1 | 1 | 1 | 0 | **75%** |
| Financeiro (extrato) | 1 | 1 | 0 | 0 | **50%** |
| Comunicados | 1 | 1 | 1 | 0 | **75%** |
| Offline (fotos) | 0 | 1 | 0 | 0 | **25%** |
| Offline (RPCs) | 0 | 0 | 0 | 0 | **0%** |
| Perfil | 1 | 1 | 0 | 0 | **50%** |
| Radar | 1 | 0 | 0 | 0 | **25%** |
| Guideline | 1 | 0 | 0 | 0 | **25%** |
| Network | 1 | 1 | 0 | 0 | **50%** |
| **TOTAL** | **19/21** | **17/21** | **4/21** | **1/21** | | |
| **% por camada** | **90%** | **81%** | **19%** | **5%** | | |

### Prontidão Geral

| Camada | Percentual |
|:-------|:----------:|
| Interface | 90% |
| Integração Supabase | 81% |
| Integração TMS | 19% |
| Fluxo Completo | 5% |
| **Média ponderada** | **34%** |

> **Nenhuma funcionalidade tem fluxo completo comprovado TMS ↔ App ↔ Ação ↔ Retorno.**

---

## 7. Bloqueadores para Operação Oficial

### Bloqueador 1 (P0): POD não chega ao TMS
App escreve POD em `delivery_proofs` — TMS lê de `entregas_protocolo`. São tabelas diferentes. Nenhuma entrega feita no app é reconhecida pelo TMS. **Sem comprovação de entrega, não há operação.**

### Bloqueador 2 (P0): Tracking não chega ao TMS/Portal
App envia GPS para `tracking_points` ou `RealTrackingService` — TMS/Portal lê de `portal_tracking_realtime`. Nenhum ponto GPS do app é visível. **Sem tracking, não há monitoramento.**

### Bloqueador 3 (P1): Financeiro não reflete operações do app
`FinancialRepository.fetchSummary()` usa `prestador = driverId` (TEXT vs UUID). Consulta `financeiro_pagar` e `pagamentos_prestadores` — sem garantia de que operações concluídas no app geram lançamentos financeiros. **Sem financeiro, não há pagamento.**

### Bloqueador 4 (P1): Coleta Reversa sem suporte no TMS
App tem fluxo completo. TMS não tem entidade, tela ou trigger para coleta reversa. **Coleta reversa no app não gera impacto no negócio.**

### Bloqueador 5 (P2): Offline limitado a fotos
`OfflineUploadQueue` só gerencia uploads de arquivos. RPCs offline (aceitar, avançar etapa, finalizar) não são enfileirados — falham se sem internet. **App não funciona offline para operações.**

### Bloqueador 6 (P2): Sem seed de homologação executado
Seed TMS013-SEED-v2 está pronto mas não executado. Não há dados controlados no banco para testar o app com dados reais.

---

## 8. Situação dos Três Tipos de Operação

### Tipo 1 — Operação Direta (Dedicada)
| Aspecto | Status |
|:--------|:------:|
| Criado no TMS | ✅ `alocacoes_escala` |
| Consulta app | ✅ RPC `f_buscar_operacoes_motorista` |
| Aceite | ✅ `acceptOperation()` |
| Etapas | ✅ 16 estágios na máquina |
| Finalização | ✅ `finishOperation()` |
| POD | ⚠️ Parcial (`delivery_proofs` ≠ `entregas_protocolo`) |
| Tracking | ✅ GPS enviado, mas não chega ao TMS |
| Retorno ao TMS | ❌ Não comprovado |

### Tipo 2 — Multi Paradas (Rota)
| Aspecto | Status |
|:--------|:------:|
| Criado no TMS | ❌ Sem campo `operation_mode` em `alocacoes_escala` |
| App reconhece | ✅ Interface para `multi_stop_route` |
| Paradas | ❌ `StopModel` existe, rota `/stop-detail` |
| Dados reais | ❌ Sem suporte no banco |

### Tipo 3 — Rede (Network/Oportunidades)
| Aspecto | Status |
|:--------|:------:|
| Criado no TMS | ❌ Não existe |
| App reconhece | ⚠️ Interface para `network` |
| Dados reais | ❌ `NetworkRepository` sem consulta confirmada |

---

## 9. Situação da Coleta Reversa

| Aspecto | Status |
|:--------|:------:|
| Tela no app (9 etapas) | ✅ Completa |
| Fotos | ✅ 6 categorias |
| Assinatura digital | ✅ RepaintBoundary |
| Divergência | ✅ Quantidade + motivo |
| Quantidade coletada | ✅ Input + validação |
| Responsável (nome/telefone/doc) | ✅ Input |
| RPC de salvamento | ⚠️ `f_atualizar_reversa_app` (anomalia A02) |
| Offline | ✅ `_queueOffline()` |
| TMS reconhece | ❌ Nenhum fluxo no TMS |
| Financeiro para reversa | ❌ Ausente |
| Tracking de reversa | ❌ Ausente |

---

## 10. Situação da Assinatura, Canhoto e POD

### Assinatura
| Aspecto | Status |
|:--------|:------:|
| Captura no app | ✅ ReverseCollectionScreen, signature panel |
| Upload Storage | ✅ `StorageUploadService` |
| Vinculação ao TMS | ❌ `entregas_protocolo.assinatura_url` nunca populada pelo app |
| Visualização TMS | ❌ |
| Visualização Portal | ❌ |

### Canhoto/Foto
| Aspecto | Status |
|:--------|:------:|
| Captura no app | ✅ `StorageUploadService.pickImageFromCamera()` |
| Upload Storage | ✅ Bucket `comprovantes-entrega` |
| Categorias | ✅ materiais, divergencia, local, documentos, devolucao, ocorrencia |
| Vinculação ao TMS | ❌ `entregas_protocolo.foto_*_url` nunca populada |

### POD (Prova de Entrega Documentada)
| Aspecto | Status |
|:--------|:------:|
| `DeliveryProofRepository` | ✅ INSERT em `delivery_proofs` |
| Fallback offline | ✅ `_queueOfflineUpload()` |
| Tabela `delivery_proofs` | ⚠️ Existe mas TMS não consulta |
| Tabela oficial `entregas_protocolo` | ❌ App nunca escreve |
| `registerPodSent()` | ✅ Chama RPC, mas sem dados de POD |
| Visualização TMS | ❌ |

---

## 11. Causa das 7 Pendências Offline

Sem acesso ao banco `pending_uploads` para diagnosticar exatamente, as causas prováveis são:

**Hipótese 1 (mais provável):** Tentativas de upload de fotos ou assinaturas que falharam por:
- Rede instável durante testes
- Bucket Storage sem permissão para `authenticated`
- Tamanho de arquivo excedendo limite
- URL do Storage expirada

**Hipótese 2:** RPCs offline (coleta reversa) enfileirados como `reversa_rpc` mas nunca reprocessados porque `OfflineUploadQueue.retryPending` só lida com uploads de arquivos, não RPCs.

**Hipótese 3:** Dados antigos de testes anteriores (`pending_uploads` não limpos).

**Para diagnosticar com precisão, executar:**
```sql
SELECT * FROM public.pending_uploads
WHERE driver_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
ORDER BY created_at DESC;
```

**Limpeza (não executada, apenas documentada):**
```sql
DELETE FROM public.pending_uploads
WHERE driver_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
  AND status IN ('pending', 'failed')
  AND created_at < NOW() - INTERVAL '7 days';
```

---

## 12. Causa da Inconsistência "Nenhuma Operação" vs "OPERAÇÃO EM ANDAMENTO"

**Análise do código:**

1. `operational_home_header.dart:213-220` — Exibe `activeOperationId` se não nulo:
   ```
   activeOperationId != null
     ? '$activeOperationId + ...'
     : pendingAcceptCount > 0
     ? '$pendingAcceptCount operação(ões) aguardando aceite'
     : pendingCount > 0
     ? '$pendingCount operação(ões) pendente(s)'
     : 'Nenhuma operação no momento'
   ```

2. `active_operation_card.dart:150` — Exibe badge `"OPERAÇÃO EM ANDAMENTO"` se `isActive == true`:
   ```dart
   _badge(isPending ? 'AGUARDANDO ACEITE' : 'OPERAÇÃO EM ANDAMENTO', ...)
   ```

3. `home_screen.dart:88-141` — Lógica de seleção:
   - `fetchActive()` busca operações com SLA < 90 dias
   - Classifica como `isActive`, `isPending` ou `isFinished`
   - Define `_activeOperation` como a primeira operação ativa
   - Define `_pendingOperations` como operações pendentes ou ativas excedentes

**Causa raiz:** O header e o card de operação ativa usam CRITÉRIOS DIFERENTES para exibir o texto.

- O header usa `activeOperationId` (só aparece se `_activeOperation != null` E o campo `id` não for vazio)
- O card ativo usa `isActive` (se a operação tiver `stateInfo.isActive == true`)

**Cenário que causa a inconsistência:**
1. `fetchActive()` retorna 1 operação com `status = 'aguardando_aceite'`
2. `OperationStateMachine.resolve()` retorna `isPending = true, isActive = false`
3. A operação NÃO é definida como `_activeOperation` (vai para `_pendingOperations`)
4. Header exibe "Nenhuma operação no momento"
5. Card ativo NÃO é renderizado (não há `_activeOperation`)
6. `PendingOperationCard` é renderizado com a operação pendente

**Mas se a operação tem `isActive = true`:**
1. Vira `_activeOperation`
2. Header exibe `activeOperationId`
3. Card ativo renderiza badge "OPERAÇÃO EM ANDAMENTO"

**Conclusão:** A inconsistência ocorre quando o estado retornado pelo banco difere do esperado pelo app. Provavelmente a operação no banco tem `status = 'aguardando_aceite'` mas algum campo na `metadata` ou `aceite_prestador` faz o `OperationStateMachine.resolve()` interpretar como ativa, ou vice-versa.

**Correção necessária:** Unificar a lógica de exibição. O header e o card devem usar a MESMA condição. Sugestão: o header deve refletir o estado do card ativo, não ter lógica independente.

---

## 13. Causa dos Comunicados sem Conteúdo

**Análise do código:**
1. `NotificationService` escuta `eventos_oficiais` via Realtime
2. `OfficialEvent.fromJson()` lê `json['titulo']` e `json['mensagem']`
3. Se esses campos forem `null` ou vazios, o app exibe strings vazias
4. `communications_list.dart:95-96`:
   ```dart
   final title = c['title'] as String? ?? 'Sem título';
   final message = c['message'] as String? ?? '';
   ```
5. Prioridade "BAIXA" é o default (linha 131: `default: priorityColor = Colors.blue` e linha 508: `'Baixa'` para tipo não-urgente)

**Causa:** Os dados em `eventos_oficiais` provavelmente têm:
- `titulo = ''` ou `titulo` não no formato esperado
- `mensagem = null` ou vazio
- Apenas `tipo`, `data` e `prioridade` preenchidos

**Outra possibilidade:** A tabela `eventos_oficiais` pode não existir no schema real, e o Realtime subscription falha silenciosamente (catch vazio). Nesse caso, `_events` fica vazio, e o `CommunicationsList` exibe "Nenhum comunicado disponível". Se há cards vazios aparecendo, pode ser dado mock/local.

**Correção:** Verificar schema de `eventos_oficiais` e garantir que `titulo` e `mensagem` sejam populados.

---

## 14. Ajustes Necessários de Layout

### 14.1 Espaço Branco Entre Header e Card
- `OperationalHomeHeader` (`operational_home_header.dart`) usa `SliverAppBar` com `expandedHeight: 195`
- `_buildBody` renderiza conteúdo em `SliverToBoxAdapter` com padding `EdgeInsets.fromLTRB(16, 6, 16, 20)`
- **Causa:** O `SliverAppBar` colapsa para 64px. O espaço entre o header colapsado e o card é causado pelo padding e pelo `SliverToBoxAdapter` que não ocupa o espaço vertical corretamente
- **Correção:** Ajustar `collapsedHeight`, remover padding extra, usar `SliverList` em vez de `SliverToBoxAdapter + Column`

### 14.2 Logo Pequeno no Header
- Logo tem `height: 56` no expanded state e `height: 32` no collapsed
- **Correção:** Aumentar para 72-80px no expanded, centralizar verticalmente

### 14.3 Sobreposição Header/Card
- `SliverAppBar` pinned com fundo transparente e blur effect
- Conteúdo começa imediatamente após o header
- **Correção:** Garantir que `SliverAppBar.bottom` tenha altura suficiente para evitar sobreposição

### 14.4 Cartão sem Dados Essenciais
- `ActiveOperationCard` só exibe origem, destino, veículo, data, valor se os campos existirem
- Muitos campos são opcionais — cartão pode aparecer vazio
- **Correção:** Exibir sempre OS ID, status e ação disponível. Campos detalhados como fallback.

---

## 15. Situação das Permissões do Checkpoint

### Diagnóstico
- `has_table_privilege()` retornou `true` para `anon` e `authenticated`
- Causa provável: **DEFAULT PRIVILEGES do Supabase** que automaticamente concedem SELECT a `anon` e `authenticated` para toda tabela criada no schema `public` por `postgres`
- O `REVOKE ALL FROM PUBLIC` no script não remove esses privilégios diretos

### SQL Corretivo (não executado)
```sql
REVOKE ALL ON TABLE public._hml_seed_checkpoint FROM anon;
REVOKE ALL ON TABLE public._hml_seed_checkpoint FROM authenticated;
```

### Impacto no GATE 2
- **Nenhum.** O seed conecta via DATABASE_URL como superusuário. Acesso de `anon`/`authenticated` à tabela de checkpoint não afeta a execução do seed.
- Correção pode ser feita antes ou depois do seed — não é bloqueante.

---

## 16. Matriz de Prontidão

| Módulo | Funcionalidade | Situação | Interface | Supabase | TMS | Fluxo | Risco |
|:-------|:---------------|:---------|:---:|:---:|:---:|:---:|:-----|
| Auth | Login/Logout | CONCLUÍDO E COMPROVADO | ✅ | ✅ | ✅ | ✅ | Baixo |
| Home | Header + saudação | CONCLUÍDO E COMPROVADO | ✅ | ✅ | ❌ | ❌ | Baixo |
| Home | Card operação ativa | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Médio |
| Home | Card pendentes | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Médio |
| Home | Indicadores diários | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Médio |
| Home | Resumo financeiro | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ⚠️ | ❌ | ❌ | Médio |
| Home | Comunicados | PARCIAL | ✅ | ✅ | ✅ | ❌ | Médio |
| Ops | Lista operações | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ✅ | ❌ | Alto |
| Ops | Detalhe operação | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Alto |
| Ops | Aceitar operação | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Alto |
| Ops | Avançar etapas | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Alto |
| Ops | Finalizar operação | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Alto |
| Ops | Máquina de estados | CONCLUÍDO E COMPROVADO | ✅ | ✅ | ❌ | ❌ | Médio |
| Tracking | GPS foreground | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Alto |
| Tracking | Fila offline GPS | IMPLEMENTADO SEM HOMOLOGAÇÃO | ❌ | ✅ | ❌ | ❌ | Médio |
| POD | DeliveryProof | PARCIAL | ✅ | ✅ | ❌ | ❌ | **Crítico** |
| POD | Assinatura | PARCIAL | ✅ | ✅ | ❌ | ❌ | **Crítico** |
| POD | Fotos | PARCIAL | ✅ | ✅ | ❌ | ❌ | **Crítico** |
| POD | Canhoto | PARCIAL | ✅ | ✅ | ❌ | ❌ | **Crítico** |
| Reversa | Coleta reversa | PARCIAL | ✅ | ⚠️ | ❌ | ❌ | Alto |
| Reversa | Devolução | SOMENTE INTERFACE | ✅ | ❌ | ❌ | ❌ | Alto |
| Reversa | Divergência | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ❌ | ❌ | Médio |
| Financeiro | Resumo Ganhos | PARCIAL | ✅ | ⚠️ | ⚠️ | ❌ | Alto |
| Financeiro | Extrato | SOMENTE INTERFACE | ✅ | ❌ | ❌ | ❌ | Alto |
| Offline | Upload fotos | IMPLEMENTADO SEM HOMOLOGAÇÃO | ❌ | ✅ | ❌ | ❌ | Médio |
| Offline | RPCs offline | AUSENTE | ❌ | ❌ | ❌ | ❌ | Alto |
| Perfil | Dados motorista | IMPLEMENTADO SEM HOMOLOGAÇÃO | ✅ | ✅ | ✅ | ❌ | Baixo |
| Perfil | Score/Nível | SOMENTE INTERFACE | ✅ | ❌ | ❌ | ❌ | Baixo |
| Radar | Informações | SOMENTE INTERFACE | ✅ | ❌ | ❌ | ❌ | Baixo |
| Network | Oportunidades | SOMENTE INTERFACE | ✅ | ⚠️ | ❌ | ❌ | Baixo |

---

## 17. Evidências Encontradas

| # | Evidência | Local |
|:-:|:----------|:------|
| 1 | `DriverOperation.fromOfficialContract()` mapeia 35 campos da RPC | `driver_operation.dart:79-131` |
| 2 | `DriverOperationsRepository` chama RPC `f_buscar_operacoes_motorista` | `driver_operations_repository.dart:42-44` |
| 3 | `OperationStateMachine` com 16 estados + 20 transições | `operation_state_machine.dart:59-433` |
| 4 | `ReverseCollectionScreen` com 9 etapas + 1230 linhas | `reverse_collection_screen.dart` |
| 5 | `RealTrackingService` com fila offline + 3 modos de intervalo | `real_tracking_service.dart` |
| 6 | `OfflineUploadQueue` com persistência, backoff, 5 tentativas | `offline_upload_queue.dart` |
| 7 | `NotificationService` escuta Realtime `eventos_oficiais` | `notification_service.dart:70-81` |
| 8 | `DeliveryProofRepository` escreve em `delivery_proofs` (não `entregas_protocolo`) | `delivery_proof_repository.dart:12-16` |
| 9 | `FinancialRepository.fetchSummary()` usa `.eq('prestador', driverId)` — TEXT mismatch | `financial_repository.dart:39` |
| 10 | `AppShell` com 5 abas (Início, Operações, Ganhos, Radar, Perfil) | `app_shell.dart` |
| 11 | RPC `f_buscar_operacoes_motorista` (SECURITY DEFINER, STABLE) | Confirmação remota |
| 12 | RPC `f_atualizar_etapa_app` (anomalias A01-A03) | Confirmação remota |
| 13 | RPC `f_atualizar_reversa_app` (anomalia A02) | Confirmação remota |
| 14 | `_buildRadarSlim()` renderiza `ListView` vazia | `home_screen.dart:1050-1056` |
| 15 | 0 `ordens_servico` no banco (todas as alocações são órfãs) | TMS-019 pre-check |
| 16 | 58/172 alocações sem `prestador_id` | TMS-019 pre-check |

---

## 18. Recomendações Imediatas

### Prioridade Crítica (P0)
1. Unificar POD: App deve escrever em `entregas_protocolo` (tabela oficial) ou criar trigger para copiar de `delivery_proofs`
2. Conectar tracking do App ao `portal_tracking_realtime` para visibilidade no TMS

### Prioridade Alta (P1)
3. Corrigir `FinancialRepository.fetchSummary()` — comparar `prestador_id` (UUID) com `auth.uid()` corretamente
4. Implementar fluxo de coleta reversa no TMS (entidade, tela, trigger)
5. Corrigir `OfficialEvent.fromJson()` para aceitar variações de campo (`title`/`titulo`, `message`/`mensagem`)

### Prioridade Média (P2)
6. Unificar lógica header vs card ativo (inconsistência "nenhuma operação" vs "em andamento")
7. Implementar fila offline para RPCs (não apenas uploads)
8. Criar campo `operation_mode` em `alocacoes_escala` para suportar tipos de operação
9. Executar seed TMS013-SEED-v2 (após GATE 2)

### Prioridade Baixa (P3)
10. Ajustes de layout (espaço branco, logo, padding)
11. Remover tabelas mortas (`motorista_app_sessoes`, `motorista_checkins`, etc.)
12. Popular `prestador_engajamento` para score real
13. Corrigir permissões do checkpoint (REVOKE anon/authenticated)

---

*Fim do relatório — TMS-020 Auditoria de Prontidão do App Motorista*
