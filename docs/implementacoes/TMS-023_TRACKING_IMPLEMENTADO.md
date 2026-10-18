# TMS-023 — Tracking Implementado

**Data:** 2026-07-29
**Status:** ✅ Correções locais aplicadas. Pendente SQL em produção.

---

## 1. O Que Foi Feito

### 1.1 Correções no Flutter (aplicadas)

**Arquivo:** `lib/core/services/real_tracking_service.dart`

**Linha 287 — Resposta da RPC:**
```dart
// ANTES (quebrado):
final success = response['success'] == true;

// DEPOIS (corrigido):
final success = response['success'] == true || response['ok'] == true;
```

**Linha 287 — Flag duplicada:**
```dart
// ANTES:
if (success || response['duplicada'] == true) {

// DEPOIS:
final duplicada = response['duplicada'] == true || response['deduplicated'] == true;
if (success || duplicada) {
```

**Motivo:** O RPC original (M106) retorna `{'ok': true, ...}`, enquanto o hotfix retorna `{'success': true, ...}`. O fix aceita ambos os formatos, garantindo compatibilidade antes e depois da aplicação do hotfix SQL.

### 1.2 Documentação Criada

| Arquivo | Local | Descrição |
|---------|-------|-----------|
| Diagnóstico SQL | `supabase/scripts/TMS-023_DIAGNOSTICO_TRACKING_CONSOLIDADO.sql` | 38 verificações read-only |
| SQL Incremental | `supabase/scripts/TMS-023_TRACKING_INCREMENTAL.sql` | Wrapper com prechecks do hotfix |
| SQL Rollback | `supabase/scripts/TMS-023_TRACKING_ROLLBACK.sql` | Reversão para M106 original |
| Auditoria | `docs/auditorias/TMS-023_TRACKING_COMPLETO.md` | Auditoria completa |
| Plano | `docs/planos/TMS-023_IMPLEMENTACAO_TRACKING.md` | Plano de implementação |
| Implementação | `docs/implementacoes/TMS-023_TRACKING_IMPLEMENTADO.md` | Este documento |

---

## 2. Fluxo de Dados (Pós-Fix)

### 2.1 App Motorista → Supabase

```
[GPS] → LocationService (Geolocator, 50m filter)
          → RealTrackingService.sendPosition()
            → _persistPosition() → supabase.rpc('registrar_posicao_motorista')
              → RPC corrigida (prestadores.auth_user_id lookup)
                → INSERT em portal_tracking_realtime
                  → Trigger M108I: sync → operacao_localizacao
                  → Trigger M106: tracking.iniciado → eventos_oficiais
                  → Realtime: NOTIFY via Supabase Realtime
```

### 2.2 Supabase → TMS/Portal

```
portal_tracking_realtime
  ├── PortalCliente.tsx: Realtime subscription → PortalTrackingMap
  ├── trackingService.ts: inscreverPosicaoEmTempoReal()
  ├── vw_noc_operacional: LATERAL JOIN em operacao_localizacao
  └── Tracking.tsx: busca eventos de historico_alocacoes_escala
```

---

## 3. Validação

| Item | Resultado |
|------|-----------|
| `npx tsc --noEmit` | Pendente |
| `flutter analyze` | Pendente |
| Testes Flutter | Pendente |
| Diagnóstico SQL executado | ❌ (não autorizado) |
| SQL incremental aplicado | ❌ (não autorizado) |

---

## 4. Situação dos Artefatos

| Artefato | Caminho | Status |
|----------|---------|--------|
| SQL diagnóstico | `supabase/scripts/TMS-023_DIAGNOSTICO_TRACKING_CONSOLIDADO.sql` | ✅ Criado |
| SQL incremental | `supabase/scripts/TMS-023_TRACKING_INCREMENTAL.sql` | ✅ Criado |
| SQL rollback | `supabase/scripts/TMS-023_TRACKING_ROLLBACK.sql` | ✅ Criado |
| Fix Flutter | `lib/core/services/real_tracking_service.dart` | ✅ Aplicado |
| Fix TMS/Portal | — | 🟡 Nenhum necessário |
| SQL em produção | — | ❌ Não executado |

---

## 5. Pendências para Conclusão

1. **Aplicar hotfix SQL em produção** (`20260731_fix_registrar_posicao_motorista.sql` ou `TMS-023_TRACKING_INCREMENTAL.sql`)
2. **Compilar e distribuir APK** com fix do Flutter
3. **Executar roteiro de homologação** (20 etapas)
4. **Verificar dados reais** em `portal_tracking_realtime`
5. **Executar diagnóstico SQL** para confirmar
6. **Liberar GATE 2** (seed)
