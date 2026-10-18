# TMS-021 — Correção dos Bloqueadores P0 (Antes do Seed)

**Data:** 2026-07-29
**Contexto:** Auditoria TMS-020 concluída. Prontidão 34%. Três bloqueadores P0 identificados.

---

## 1. POD — Fonte Única de Verdade

### Decisão

**FONTE ÚNICA DE VERDADE DO POD = `entregas_protocolo`**

### Justificativa Técnica

| Critério | `entregas_protocolo` | `delivery_proofs` |
|:---------|:--------------------:|:-----------------:|
| Usada pelo TMS (`podService.ts`) | ✅ `buscarPOD()` lê daqui | ❌ Nunca consultada |
| Usada pelo Portal Cliente | ✅ `portalClienteService.ts` consulta | ❌ Nunca consultada |
| Usada pelo Event Bus (M104) | ✅ Trigger `trg_evento_pod_enviado` | ❌ Sem trigger |
| Usada pelo Tracking de POD | ✅ Relacionada via `alocacao_id` | ❌ Apenas `stop_id` |
| Modelo mais completo | ✅ 15+ colunas (recebedor, docs, fotos, GPS) | ⚠️ 12 colunas |
| FK para `alocacoes_escala` | ✅ `alocacao_id` UUID | ❌ `operation_id` TEXT |
| FK para `prestadores` | ✅ `prestador_id` UUID | ❌ `driver_id` TEXT |
| Já integrada a triggers M66/M80/M99 | ✅ Propagação financeira | ❌ Isolada |
| RLS configurada | ✅ Múltiplas policies | ✅ Básica |

### Fluxo Correto Esperado

```
App Flutter (delivery_proofs INSERT)
       ↓
Trigger trg_sync_delivery_proof_to_entregas (se aplicado)
  OU App escreve direto em entregas_protocolo
       ↓
entregas_protocolo (fonte oficial única)
       ↓
Trigger trg_evento_pod_enviado (M104) → Event Bus
       ↓
TMS lê (podService.ts) → OK
       ↓
Portal Cliente lê (portalClienteService.ts) → OK
```

### Causa Exata do POD Não Aparecer no TMS

**O App Motorista escreve POD em `delivery_proofs`, mas o TMS lê de `entregas_protocolo`.** São tabelas diferentes, sem sincronização ativa.

A migration `20260710_m108c1_pod_unico_entregas_protocolo.sql` já foi criada para resolver isso — cria um trigger `trg_sync_delivery_proof_to_entregas` que copia dados de `delivery_proofs` para `entregas_protocolo` automaticamente. **Esta migration PRECISA SER APLICADA** para que o POD do app seja visível no TMS.

### Tabelas e Arquivos Envolvidos

| Componente | Caminho |
|:-----------|:--------|
| Migration trigger | `supabase/migrations/20260710_m108c1_pod_unico_entregas_protocolo.sql` |
| TMS podService | `src/services/podService.ts` |
| App DeliveryProofRepository | `C:\src\conexao_prestador\lib\core\repositories\delivery_proof_repository.dart` |
| App DeliveryProofEntity | `C:\src\conexao_prestador\lib\core\models\delivery_proof_entity.dart` |
| App DeliveryProof model | `C:\src\conexao_prestador\lib\features\operations\models\delivery_proof_model.dart` |
| App StopDetailScreen | `C:\src\conexao_prestador\lib\features\operations\screens\stop_detail_screen.dart` |
| App OperationDetailScreen | `C:\src\conexao_prestador\lib\features\operations\operation_detail_screen.dart` |
| Portal Cliente POD | `src/services/portalCliente/portalClienteService.ts` |
| Portal Cliente Comprovantes | `src/components/portal-cliente/PortalComprovantesPremium.tsx` |

### Recomendação

1. **Aplicar migration** `20260710_m108c1_pod_unico_entregas_protocolo.sql` (cria trigger)
2. **Corrigir app** para enviar também `foto_canhoto_url` no `DeliveryProofEntity`
3. **Validar**: app faz POD → trigger dispara → `entregas_protocolo` populado → TMS/Portal veem

---

## 2. Tracking — Fluxo Completo

### Causa Exata do Tracking Não Aparecer no TMS/Portal

**O App Motorista JÁ envia tracking para a tabela correta.** O `RealTrackingService` chama a RPC `registrar_posicao_motorista` que, se a migration `20260709_m106_tracking_real_go_live.sql` foi aplicada, escreve em `portal_tracking_realtime`.

**Possíveis causas do tracking não aparecer:**

1. **Migration M106 não aplicada** — a RPC `registrar_posicao_motorista` e suas policies podem não existir em produção
2. **RLS bloqueando INSERT** — se a policy `tracking_insert_prestador` não permite INSERT via `authenticated` com `auth.uid()` vinculado a `prestadores.auth_user_id`
3. **Tracking não iniciado** — o app só inicia tracking quando o motorista clica "Sair em rota" (`registerRouteDeparture` → inicia sessão)
4. **Portal Cliente não inscrito** — `PortalTrackingMap` pode não estar inscrito no canal Realtime

### Fluxo Correto Esperado

```
App: ForegroundTrackingService (GPS 15-30s)
       ↓
RealTrackingService.sendPosition()
       ↓
RPC registrar_posicao_motorista (via TrackingRepository)
       ↓
INSERT em portal_tracking_realtime
       ↓
Trigger trg_sync_tracking_to_oper_localizacao (M108I)
       ↓
Realtime subscription no Portal Cliente (portal_tracking_realtime)
       ↓
PortalTrackingMap exibe posição
```

### Pendências

1. Verificar se as migrations `20260709_m106_tracking_real_go_live.sql` e `20260731_fix_registrar_posicao_motorista.sql` foram aplicadas em produção
2. Verificar RLS: `tracking_insert_prestador` permite INSERT para `authenticated` onde `prestadores.auth_user_id = auth.uid()`
3. Verificar `PortalTrackingMap` subscription Realtime em `PortalCliente.tsx`

---

## 3. Sete Pendências Offline

### Arquitetura Real

| Componente | Armazenamento | Finalidade |
|:-----------|:-------------|:-----------|
| `OfflineUploadQueue` | `pending_uploads` (Supabase) | Upload de fotos/arquivos offline |
| `RealTrackingService` | `SharedPreferences` (JSON) | Pontos GPS offline |
| `ReverseCollectionScreen` | `pending_uploads` (tipo `reversa_rpc`) | RPC de coleta reversa offline |

### Procedimento Seguro para Inspecionar

Para inspecionar as 7 pendências sem deletá-las, executar no SQL Editor:

```sql
-- Diagnóstico completo
SELECT id, type, status, attempts, last_error, created_at,
       operation_id, storage_path
FROM public.pending_uploads
WHERE driver_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
ORDER BY created_at DESC;

-- Contagem por tipo
SELECT type, status, COUNT(*)
FROM public.pending_uploads
WHERE driver_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
GROUP BY type, status
ORDER BY type, status;
```

Também verificar SharedPreferences no celular (requer debug Flutter):
```bash
cd C:\src\conexao_prestador
flutter logs --grep "tracking_offline_queue"
```

---

## 4. Financeiro — TEXT vs UUID

### Causa Exata

A tabela `financeiro_pagar` (core_baseline.sql:404) possui:

```sql
prestador text,                -- ← TEXT, usado pelo app
fornecedor_id uuid,            -- ← UUID, usado pelo TMS
```

O App Motorista em `financial_repository.dart:39` faz:

```dart
.eq('prestador', driverId)   -- driverId = auth.uid() (UUID)
```

**Problema:** `prestador` é TEXT. Comparar UUID com TEXT:
- Se `prestador` contém o UUID como string → funciona acidentalmente
- Se `prestador` contém nome/CNPJ → falha silenciosa (0 resultados)

### Correção Necessária

**Opção A (recomendada, sem migration):** Adicionar fallback no app Flutter:
```dart
// 1. Buscar prestador_id pelo auth.uid()
final prestadorUuid = await _findPrestadorUuid(driverId);
// 2. Usar prestador_id (UUID) se disponível
if (prestadorUuid != null) {
  .eq('fornecedor_id', prestadorUuid)  // UUID column
} else {
  .eq('prestador', driverId)           // TEXT column (fallback)
}
```

O método `_findPrestadorUuid()` já existe em `driver_operations_repository.dart:328-355`.

**Opção B (futura, exige migration):** Adicionar `prestador_id UUID` em `financeiro_pagar` e popular com dados existentes.

**Exige:**
- ✅ Alteração somente no app (Opção A)
- ⚠️ Migration futura para normalização (Opção B)

---

## 5. Três Tipos de Operação

### Situação Real

**Os três tipos não possuem definição técnica suficiente formalizada no projeto.**

### Nomes Encontrados no Código

Da migration `20260713_m111_app_integracao_tms.sql` (linhas 129-134):

| Nome técnico | Exibição | Critério de determinação |
|:-------------|:---------|:-------------------------|
| `standard_delivery` | Entrega Padrão | Default (qualquer `tipo_operacao` que não seja multiparada ou reversa) |
| `multi_stop_route` | Rota Multi Paradas | `tipo_operacao` ILIKE '%multiparada%' ou '%e-commerce%' ou '%distribuição%' |
| `reverse_logistics` | Coleta Reversa | `tipo_operacao` ILIKE '%reversa%' |

### Onde Estão Críticos

| Local | Referência |
|:------|:-----------|
| App: `driver_operation.dart:98` | `operationMode` com fallback `'dedicated'` |
| App: `active_operation_card.dart:48-73` | Labels: Direta, Multi paradas, OS Avulsa, Rede, Controle Diário |
| App: `operation_type.dart` | Arquivo dedicado de tipos |
| Migration: `m111_app_integracao.sql:129-134` | Lógica de determinação do tipo |
| Tabela: `alocacoes_escala.operation_mode` | DEFAULT `'standard_delivery'` |
| Tabela: `rotas.operation_mode` | DEFAULT `'standard_delivery'` |

### Inconsistência

O app Flutter reconhece 5 modos (`dedicated`, `simple_order`, `multi_stop_route`, `network`, `daily_control`), mas o banco só suporta 3 (`standard_delivery`, `multi_stop_route`, `reverse_logistics`). Os modos `network` e `daily_control` do app não têm correspondente no banco.

---

## 6. SQL Correção Permissões Checkpoint

Arquivo salvo em:
`supabase/scripts/TMS-021_CORRIGIR_PERMISSOES_CHECKPOINT.sql`

Inclui:
- Pré-validação (5 verificações)
- `REVOKE ALL FROM anon` + `REVOKE ALL FROM authenticated`
- Pós-validação (4 verificações)
- Resumo final

**Não executado.** Aguardando autorização.

---

## 7. Resumo das Correções Locais Realizadas (código, sem escrita em produção)

| Item | Status | Descrição |
|:-----|:------:|:----------|
| SQL permissões checkpoint | ✅ Criado | `supabase/scripts/TMS-021_CORRIGIR_PERMISSOES_CHECKPOINT.sql` |
| Análise POD | ✅ Concluída | Migration M108C1 existe, precisa ser aplicada |
| Análise Tracking | ✅ Concluída | RPC `registrar_posicao_motorista` existe, M106 precisa ser verificada |
| Análise Financeiro | ✅ Concluída | Corrigir app para usar `fornecedor_id` via `_findPrestadorUuid()` |
| Análise 3 tipos | ✅ Concluída | 3 tipos no banco, app reconhece 5 |

## 8. Alterações Remotas que Continuam Bloqueadas

| Item | Bloqueio |
|:-----|:---------|
| Aplicar migration M108C1 (POD trigger) | ❌ Aguardando autorização |
| Aplicar migration M106/Fix (Tracking RPC) | ❌ Aguardando autorização |
| REVOKE permissões checkpoint | ❌ Aguardando autorização |
| Executar seed TMS013-SEED-v2 (GATE 2) | ❌ Bloqueado |
| Limpar 7 pendências offline | ❌ Aguardando autorização |
| Alterar código Flutter (financeiro) | ✅ Pode fazer localmente (sem escrita em produção) |
| Alterar código TMS | ✅ Pode fazer localmente (sem escrita em produção) |

## 9. Seed Não Executado

**Confirmado: GATE 2 não foi executado. Nenhum dado de homologação foi inserido.**

---

*Fim — TMS-021 Bloqueadores P0*
