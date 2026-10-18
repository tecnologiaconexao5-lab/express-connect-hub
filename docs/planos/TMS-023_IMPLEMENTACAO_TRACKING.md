# TMS-023 — Plano de Implementação do Tracking

**Data:** 2026-07-29
**Status:** ✅ Plano pronto, aguardando autorização para execução

---

## 1. Resumo

Implementar tracking GPS funcional de ponta a ponta: App Motorista → Supabase → TMS → Portal Cliente.

**Problema:** 3 bugs na RPC `registrar_posicao_motorista` em produção impedem qualquer posição de ser registrada.

**Solução:** Aplicar hotfix SQL (já existe) + 1 correção defensiva no Flutter (já aplicada).

---

## 2. Dependências

| ID | Dependência | Status |
|----|-------------|--------|
| D1 | Autorização para executar SQL em produção | ❌ Pendente |
| D2 | App Motorista compilado com fix do Flutter | ✅ Local, aguardando deploy |
| D3 | PRESTADOR TESTE APP com auth_user_id configurado | ✅ e6646799-... existe |
| D4 | Alocação ativa para teste | ✅ Pode ser criada via TMS |
| D5 | Seed (opcional, GATE 2) | ❌ Bloqueado |

---

## 3. Etapas de Implementação

### Etapa 1: Aplicar SQL em Produção

**Arquivo:** `supabase/migrations/20260731_fix_registrar_posicao_motorista.sql`

Executar via Supabase Dashboard > SQL Editor ou pg client:

```bash
PGPASSWORD=[senha] psql "postgresql://postgres.uwrvzsjtpgaifkktpepn@aws-1-sa-east-1.pooler.supabase.com:5432/postgres" -f supabase/migrations/20260731_fix_registrar_posicao_motorista.sql
```

**O que faz:**
1. Recria RPC `registrar_posicao_motorista` com lookup correto (`prestadores.auth_user_id`)
2. Altera resposta de `'ok'` para `'success'` (compatível com Flutter)
3. Expande parâmetros de 8 para 12 (com defaults)
4. Corrige RLS policies para usar `prestadores.auth_user_id`
5. Aplica GRANT EXECUTE TO authenticated

**Rollback:** `supabase/scripts/TMS-023_TRACKING_ROLLBACK.sql`

### Etapa 2: Deploy do Flutter com Fix

**Arquivo modificado:** `lib/core/services/real_tracking_service.dart`

```dart
// ANTES (linha 287):
final success = response['success'] == true;

// DEPOIS:
final success = response['success'] == true || response['ok'] == true;
```

Compilar e distribuir nova versão do APK.

### Etapa 3: Validar Funcionamento

Verificar se `portal_tracking_realtime` começa a receber posições após o hotfix.

---

## 4. Roteiro de Homologação

### Pré-condições
- [ ] Hotfix SQL aplicado em produção
- [ ] Flutter compilado com fix da resposta
- [ ] PRESTADOR TESTE APP logado no celular
- [ ] Alocação ativa criada no TMS

### Testes

| # | Teste | Como | Critério |
|---|-------|------|----------|
| 1 | Tracking inicia ao sair em rota | Completar etapas até "Sair em rota" no App | `trackingStatus` muda para `active` |
| 2 | Posição aparece no Supabase | `SELECT * FROM portal_tracking_realtime WHERE alocacao_id = '...'` | Pelo menos 1 registro em 30s |
| 3 | Mapa no Portal Cliente | Abrir Portal > Comprovantes > selecionar entrega | Marcador aparece no mapa |
| 4 | Realtime funciona | Mover celular ~100m | Mapa atualiza sem refresh |
| 5 | Offline queue | Desligar internet, gerar posições, religar | Posições aparecem após reconexão |
| 6 | Sem duplicidade | Verificar `portal_tracking_realtime` para mesma coordenada/tempo | Sem registros duplicados (mesma lat/lng em <10s) |
| 7 | Tracking para ao finalizar | Completar "Finalizar operação" | `_sessionEnded = true`, sem novas posições |
| 8 | Não trackeia fora da operação | Navegar para outra tela | `stopTracking()` chamado no dispose |
| 9 | Isolamento entre clientes | Cliente A só vê posições da sua operação | RLS bloqueia cross-tenant |
| 10 | Foreground funcionando | Minimizar app | Notificação "Conexão Express - Operação em andamento" visível |

---

## 5. Pós-Implementação

| Item | Responsável |
|------|-------------|
| Executar diagnóstico TMS-023_DIAGNOSTICO_TRACKING_CONSOLIDADO.sql | TMS |
| Verificar RLS isolamento com teste cross-tenant | TMS |
| Verificar M108I trigger sync para operacao_localizacao | TMS |
| Atualizar NOC (Torre de Controle) com tracking ao vivo | Equipe NOC |
| Seed (GATE 2) | Aguardando TMS-023 concluído |
