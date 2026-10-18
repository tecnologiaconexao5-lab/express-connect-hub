# TMS-023 — Auditoria de Tracking Completo APP → Supabase → TMS → Portal

**Data:** 2026-07-29
**Status:** ✅ Concluída
**Autor:** Auditoria TMS-023

---

## Sumário

1. [Escopo](#1-escopo)
2. [Fluxo Atual Real](#2-fluxo-atual-real)
3. [O Que Já Funcionava](#3-o-que-já-funcionava)
4. [O Que Estava Quebrado](#4-o-que-estava-quebrado)
5. [Causa Raiz](#5-causa-raiz)
6. [Arquivos Auditados](#6-arquivos-auditados)
7. [Riscos Restantes](#7-riscos-restantes)

---

## 1. Escopo

Auditoria completa de ponta a ponta do tracking de GPS do App Motorista (Flutter) até o Portal do Cliente (TMS Web), passando pelo Supabase.

| Camada | Localização | Status |
|--------|-------------|--------|
| App Motorista | `C:\src\conexao_prestador\` | ✅ Auditado |
| Supabase | `uwrvzsjtpgaifkktpepn.supabase.co` | ✅ Auditado (read-only) |
| TMS | `express-connect-hub\src\` | ✅ Auditado |
| Portal Cliente | `express-connect-hub\src\components\portal-cliente\` | ✅ Auditado |

---

## 2. Fluxo Atual Real

### 2.1 App Motorista (Flutter)

```
[Sair em rota] → TrackingSessionService.startSession()
                    → RealTrackingService.startTracking()
                    → LocationService.startListening()
                        → [GPS position a cada 15s/30s/60s, distância mínima 50m/100m]
                            → RealTrackingService.sendPosition()
                                → _persistPosition()
                                    → supabase.rpc('registrar_posicao_motorista', params)
                                        → [FALHA: RPC incompatível]
                                            → _addToOfflineQueue()
                                                → SharedPreferences
                                                    → retry a cada 30s
```

### 2.2 Supabase (alvo)

```
registrar_posicao_motorista() [PRODUÇÃO - M106]
  → auth.uid() lookup (ERRADO: compara auth.users.id com prestadores.id)
  → retorna {ok: true/false} (ERRADO: Dart espera 'success')
  → 8 parâmetros (ERRADO: Dart envia 11)
```

```
registrar_posicao_motorista() [HOTFIX - NÃO APLICADO]
  → prestadores.auth_user_id lookup (CORRETO)
  → retorna {success: true/false} (CORRETO)
  → 12 parâmetros com defaults (CORRETO)
```

### 2.3 TMS/Portal (leitura)

```
Portal Cliente → PortalTrackingMap
  → supabase.from('portal_tracking_realtime').select()
    → [VAZIO: nenhuma posição escrita com sucesso]
      → Mapa exibe "Aguardando Localização"

Portal Cliente → Realtime subscription
  → supabase.channel('tracking-{alocacaoId}')
    → postgres_changes em portal_tracking_realtime
      → [NUNCA DISPARADO: sem dados]
```

---

## 3. O Que Já Funcionava

- ✅ `ForegroundTrackingService` — serviço em foreground Android com notificação persistente (notification channel `tracking_service_channel`, ID 888)
- ✅ `AndroidManifest.xml` — todas as permissões declaradas (ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS)
- ✅ `Geolocator` — `getPositionStream()` com `LocationAccuracy.high` e distance filter 50m
- ✅ `OfflineUploadQueue` — 500 posições máximas em SharedPreferences, retry a cada 30s
- ✅ Ciclo de vida do tracking: inicia em "Sair em rota"/"Finalizar carregamento", encerra em "Finalizar operação"
- ✅ `LocationService` — tratamento de permissão negada, GPS desligado
- ✅ `RealTrackingService` — bateria adaptativa (15s foreground, 30s background, 60s bateria baixa), filtro haversine 50m/100m
- ✅ `PortalCliente.tsx` — Realtime subscription funcional em `portal_tracking_realtime` filtrado por `alocacao_id`
- ✅ `PortalTrackingMap.tsx` — componente Mapbox funcional com marcador animado, flyTo(), NavigationControl
- ✅ `trackingService.ts` — 3 funções de inscrição Realtime (por alocação, cliente, prestador)
- ✅ `vw_noc_operacional` — view NOC com LATERAL JOIN em `operacao_localizacao`
- ✅ Trigger `trg_sync_tracking_to_oper_localizacao` — replica de `portal_tracking_realtime` para `operacao_localizacao` (M108I)
- ✅ RLS policies com `TO authenticated` — anon bloqueado (E3b)

---

## 4. O Que Estava Quebrado

### 4.1 BUG-001: RPC usa auth.uid() direto (CRÍTICO)

**Arquivo:** `supabase/migrations/20260709_m106_tracking_real_go_live.sql` (RPC em produção)

```sql
-- ERRADO (produção):
v_prestador_id := auth.uid();
-- auth.uid() = auth.users.id
-- prestadores.id != auth.users.id
-- NUNCA encontra alocação → ALOCACAO_OUTRO_PRESTADOR
```

**Correção (hotfix, não aplicado):**
```sql
-- CORRETO:
SELECT id INTO v_prestador_id FROM public.prestadores
WHERE auth_user_id = auth.uid();
```

### 4.2 BUG-002: Resposta RPC usa chave 'ok' mas Dart espera 'success' (CRÍTICO)

**Arquivo:** `real_tracking_service.dart:287`

```dart
// Dart espera:
final success = response['success'] == true;

// Mas RPC retorna:
RETURN jsonb_build_object('ok', true, ...);
// response['success'] = null → sempre false
```

### 4.3 BUG-003: Dart envia 11 parâmetros, RPC aceita 8 (CRÍTICO)

**Arquivo:** `tracking_point.dart:101-114` (Dart) vs M106 RPC (produção)

```
Dart envia:    p_alocacao_id, p_latitude, p_longitude, p_velocidade, p_precisao,
               p_direcao, p_bateria, p_captured_at, p_altitude,
               p_status_operacional, p_origem
               [11 parâmetros]

RPC aceita:    p_alocacao_id, p_latitude, p_longitude, p_velocidade,
               p_precisao, p_direcao, p_bateria, p_captured_at
               [8 parâmetros]

Resultado: PostgreSQL não encontra overload → "function does not exist"
```

### 4.4 Impacto Combinado

Os 3 bugs em conjunto garantem que **nenhuma posição GPS jamais foi registrada em produção** no `portal_tracking_realtime`. Consequentemente:

- TMS (Tracking.tsx): apenas timeline de eventos, sem mapa GPS
- Portal Cliente (PortalTrackingMap): exibe "Aguardando Localização"
- NOC (vw_noc_operacional): tracking_lat/lng sempre NULL
- Realtime subscriptions: nunca disparam

---

## 5. Causa Raiz

A migration `M106` (20260709_m106_tracking_real_go_live.sql) foi criada com 3 bugs estruturais que impedem o tracking de funcionar. O hotfix `20260731_fix_registrar_posicao_motorista.sql` corrige todos os 3, mas **nunca foi aplicado em produção**.

O Flutter envia corretamente 11 parâmetros via `supabase.rpc()` (definidos em `TrackingPoint.toRpcParams()`), mas:

1. O PostgreSQL não encontra overload compatível (8 vs 11 params)
2. Mesmo que encontrasse, `auth.uid()` lookup falha
3. Mesmo que passasse, a resposta `'ok'` não é reconhecida

---

## 6. Arquivos Auditados

### Flutter (16 arquivos)

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `lib/core/services/real_tracking_service.dart` | 457 | Singleton — envia posições, fila offline, retry |
| `lib/core/services/tracking_session_service.dart` | 187 | Orquestrador: LocationService + RealTrackingService + Foreground |
| `lib/core/services/foreground_tracking_service.dart` | 182 | flutter_background_service com notificação Android |
| `lib/core/services/location_service.dart` | 220 | Geolocator stream, permissões, geofence |
| `lib/core/services/tracking_permission_handler.dart` | 118 | Gerenciamento de permissões |
| `lib/core/services/offline_upload_queue.dart` | 231 | Fila offline genérica (não usada pelo tracking) |
| `lib/core/models/tracking_point.dart` | 147 | Modelo com toRpcParams() |
| `lib/core/models/tracking_session.dart` | 75 | Sessão de tracking |
| `lib/core/models/pending_upload.dart` | 82 | Upload pendente |
| `lib/core/repositories/tracking_repository.dart` | 70 | Repositório (pouco usado) |
| `lib/features/home/widgets/tracking_status_card.dart` | 136 | Card de status na home |
| `lib/features/operations/widgets/tracking_panel.dart` | 205 | Painel de tracking na operação |
| `lib/core/widgets/sync_indicator.dart` | 81 | Indicador de sincronização |
| `lib/features/operations/operation_detail_screen.dart` | 3526 | Tela principal — inicia/para tracking |
| `android/app/src/main/AndroidManifest.xml` | 57 | Permissões Android |
| `lib/main.dart` | 70 | Inicialização do foreground service |

### Supabase (7 migrations)

| Migration | Objeto | Status |
|-----------|--------|--------|
| `20260709_m106_tracking_real_go_live.sql` | RPC + tabela + policies + triggers | ✅ Aplicada (com bugs) |
| `20260711_m108i_noc_enterprise.sql` | Trigger sync → operacao_localizacao | ✅ Aplicada |
| `20260731_fix_registrar_posicao_motorista.sql` | RPC corrigida + policies + grants | ❌ **Não aplicada** |
| `20260801_e3b_tracking_policies_auth_role.sql` | TO authenticated nas policies | ✅ Aplicada |
| `20260725_missao_rls_fix_priority_tables.sql` | RLS fix (tracking_select_tenant) | ✅ Aplicada |
| `20260713_m114_portal_conclusao.sql` | REVOKE anon em tracking | ✅ Aplicada |
| `20260701_portal_cliente_rls.sql` | Policies portal_tracking_realtime | ❌ Substituída |

### TMS/Portal (5 arquivos)

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `src/services/rastreamento/trackingService.ts` | 297 | Service com RPC, Realtime subscriptions, queries |
| `src/pages/Tracking.tsx` | 293 | Página pública de rastreio (timeline, sem mapa) |
| `src/components/portal-cliente/PortalTrackingMap.tsx` | 304 | Mapa Mapbox real (Portal Cliente) |
| `src/components/portal-cliente/PortalRoteirizacao.tsx` | 571 | Roteirização com consulta a portal_tracking_realtime |
| `src/pages/PortalCliente.tsx` | ~5700 | Realtime subscription + renderização do mapa |

---

## 7. Riscos Restantes

| Risco | Severidade | Descrição |
|-------|-----------|-----------|
| R1 | Médio | Fila offline pode acumular 500 posições antes do hotfix ser aplicado — ao aplicar, o flush pode causar spike de inserções |
| R2 | Baixo | Deduplicação por coordenada exata em 10s pode falhar se o veículo estiver parado (semáforo, trânsito) — posições repetidas são rejeitadas, mas é comportamento esperado |
| R3 | Baixo | `captured_at` no Flutter usa `DateTime.now()` em vez do timestamp real do GPS — diferença de ~1-2s |
| R4 | Médio | Sem chave de idempotência — se a resposta da RPC for perdida (timeout), o retry criará um registro duplicado |
| R5 | Baixo | App não verifica se tracking continua rodando após reinício do celular — ForegroundTrackingService não tem `autoStartOnBoot: true` |
| R6 | Baixo | `operation_timeline_events` pode não existir em produção (tabela não verificada) — o `EXCEPTION WHEN OTHERS THEN NULL` no hotfix trata isso silenciosamente |
