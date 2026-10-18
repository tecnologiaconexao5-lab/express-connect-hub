# TMS-023A — Revisão Final do Hotfix de Tracking

## Resumo

TMS-023 (tracking GPS ponta a ponta) concluído: 10 fases auditadas.
TMS-023A (revisão final do hotfix) concluído: 3 bugs confirmados, hotfix aprovado.

**3 bugs críticos na RPC `registrar_posicao_motorista` em produção (M106):**

| Bug | Severidade | Descrição | Correção |
|-----|-----------|-----------|---------|
| BUG-001 | **P0** | `auth.uid()` comparado diretamente com `prestador_id` (UUID de `prestadores.id`), que **nunca** é igual a `auth.uid()` (UUID de `auth.users`). Tracking nunca escreveu uma posição. | Hotfix usa `prestadores.auth_user_id = auth.uid()` |
| BUG-002 | **P0** | RPC retorna `{"ok": true}` mas Flutter espera `{"success": true}` | Hotfix retorna `{"success": true}` |
| BUG-003 | **P0** | Flutter envia 11 parâmetros nomeados (`p_altitude`, `p_status_operacional`, `p_origem`) mas M106 aceita 8. PostgreSQL named params não encontram match → **function does not exist** | Hotfix aceita 12 parâmetros (todos os 11 + `p_ordem_servico_id DEFAULT NULL`) |

**Por que não foi pego antes?** Ambiente único de produção, sem QA/staging. M106 (14/Jul) criou RPC com 8 params. Flutter posteriormente adicionou campos (`p_altitude` etc.) sem atualizar a RPC. Nenhum teste de integração App→Supabase validou o contrato.

## 4 Fontes Comparadas

| Aspecto | M106 (produção) | Flutter | Hotfix | Incremental |
|---------|:---------------:|:-------:|:------:|:-----------:|
| Parâmetros | 8 | 11 enviados | 12 (aceita todos) | 12 |
| Auth lookup | `auth.uid()` direto | — | `prestadores.auth_user_id` | `prestadores.auth_user_id` |
| Resposta sucesso | `'ok'` | — | `'success'` | `'success'` |
| Resposta erro | `'ok'=false` | — | `'success'=false` | `'success'=false` |
| Dedup response | `'deduplicated'` | aceita ambos | `'duplicada'` | `'duplicada'` |
| Dedup window | 5s | — | 10s | 10s |
| `TO authenticated` | ✅ | — | ❌ ausente | ❌ ausente |
| SECURITY DEFINER | ✅ | — | ✅ | ✅ |
| `search_path=public` | ✅ | — | ✅ | ✅ |
| EXECUTE TO authenticated | ✅ | — | ✅ | ✅ |

## Flutter: Correção Defensiva (`real_tracking_service.dart:287`)

```dart
// Aceita AMBOS os formatos: 'success' (hotfix/incremental) ou 'ok' (M106)
final success = response['success'] == true || response['ok'] == true;
final duplicada = response['duplicada'] == true || response['deduplicated'] == true;
```

- `flutter analyze` → sem novas issues (apenas 483 pre-existing infos/warnings)
- `npx tsc --noEmit` no TMS → 0 erros

## Hotfix SQL: Revisão 10/10

- **RPC body**: lookup correto via `prestadores.auth_user_id`, 12 params, resposta `success`. ✅
- **Validações**: 6 condições (auth, prestador, alocação, coordenadas, limites, dedup). ✅
- **Segurança**: SECURITY DEFINER + `SET search_path = public` sem schemas extras. ✅
- **SQL Injection**: sem dynamic SQL ou EXECUTE. ✅
- **Cross-tenant**: tenant_id derivado do prestador via subquery, não do input. ✅
- **Cross-prestador**: valida `v_alocacao_prestador_id != v_prestador_id`. ✅
- **Grants**: `EXECUTE TO authenticated` apenas, sem `anon`. ✅
- **operation_timeline_events**: try/catch no tracking.iniciado, não quebra fluxo se tabela não existir. ✅
- **Rollback**: completo, restaura M106 com os 3 bugs (só para emergência). ✅
- **Policies**: corrigidas para usar `prestadores.auth_user_id`. ⚠️ falta `TO authenticated`

### Gap identificado: políticas sem `TO authenticated`

Tanto o hotfix quanto o incremental criam policies INSERT/SELECT sem `TO authenticated`:

```sql
CREATE POLICY tracking_insert_prestador ON public.portal_tracking_realtime
    FOR INSERT
    WITH CHECK (...)  -- ❌ falta TO authenticated
```

Na prática a WITH CHECK usando `auth.uid()` já protege (anon retorna null → falha), mas por boa prática e clareza de intenção, deve ter `TO authenticated`. Se aplicado antes de E3b (que adiciona `TO authenticated`), será corrigido posteriormente.

## Arquivos do Hotfix

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `supabase/migrations/20260731_fix_registrar_posicao_motorista.sql` | ❌ Não executado | Hotfix principal (RPC + policies + grants) |
| `supabase/scripts/TMS-023_TRACKING_INCREMENTAL.sql` | ❌ Não executado | Wrapper com prechecks + pós-validação |
| `supabase/scripts/TMS-023_TRACKING_ROLLBACK.sql` | ❌ Não executado | Rollback (restaura M106 com bugs) |
| `supabase/scripts/TMS-023_DIAGNOSTICO_TRACKING_CONSOLIDADO.sql` | ❌ Não executado | Diagnóstico read-only (38 verificações) |
| `supabase/scripts/TMS-023A_VALIDAR_HOTFIX_TRACKING.sql` | ❌ Não executado | Validação pré-execução |
| `C:\src\conexao_prestador\lib\core\services\real_tracking_service.dart` | ✅ Modificado | Flutter fix (linha 287) |

## Estado Atual

- **`portal_tracking_realtime`**: VAZIA — zero posições escritas (nenhuma chamada RPC bem-sucedida)
- **App Motorista (Flutter)**: tracking envia a cada 15/30/60s, mas erro `function does not exist`
- **Portal Cliente**: Realtime subscription + Mapbox MAP prontos, mas sem dados
- **TMS**: Tracking pronto, mas sem dados
- **Pipeline**: App→Supabase quebrado (RPC); Supabase→Portal/TMS já OK

## Próximos Passos

1. **Autorizar execução do hotfix** no Supabase SQL Editor
2. **Compilar APK** com Flutter fix e distribuir para PRESTADOR TESTE APP
3. **Homologar** tracking ponta a ponta (20 etapas)
4. **GATE 2** — seed de dados (após homologação tracking + POD)
5. **Aplicar E3b** (adiciona `TO authenticated` nas policies) após hotfix
6. **SQLs POD** (TMS-022F, TMS-022H) aguardam autorização separada
