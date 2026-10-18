# MISSÃO 133-D.6 — Aplicação Controlada da Migration M133-D.4 (RPCs App Motorista)

**Data:** 2026-07-27
**Percentual oficial:** 41%
**Ambiente:** PRODUÇÃO (`uwrvzsjtpgaifkktpepn.supabase.co`)
**Status:** ✅ APLICADA E VALIDADA — Escrita controlada aguardando autorização

---

## Resumo

Aplicação autorizada da migration `20260722_m133d4_fix_rpc_app_security.sql` (SHA256: `3E71F461...`) que corrige 3 anomalias de segurança nas RPCs do App Motorista identificadas na Missão 133-D.3:

| Anomalia | RPC | Correção | Status |
|----------|-----|----------|:------:|
| A01 | `f_avancar_etapa_app_motorista` | STABLE → **VOLATILE** | ✅ |
| A02 | `f_atualizar_reversa_app` | +**auth.uid()** + ownership | ✅ |
| A03 | Todas as 3 RPCs | REVOKE PUBLIC/anon → GRANT **auth+service_role** | ✅ |

---

## ETAPA 1 — Pré-check

| Item | Resultado |
|------|:---------:|
| Branch: `auditoria-final-integracao` | ✅ |
| Migration SHA256: `3E71F461...` | ✅ Confere |
| Rollback SHA256: `59D2F94E...` | ✅ Confere |
| Remote SHA256 unchanged from D.3 freeze | ✅ 3/3 |
| No overloads (1 cada) | ✅ |
| A01 (STABLE bug) confirmado remoto | ✅ |
| A03 (PUBLIC+anon grants) confirmado remoto | ✅ |
| Zero DML fora dos corpos | ✅ |

## ETAPA 2 — Aplicação Única

| Métrica | Valor |
|---------|:-----:|
| Início | 2026-07-27T17:04:22.287Z |
| Término | 2026-07-27T17:04:22.615Z |
| Duração | **0.3s** |
| Transação | ✅ COMMIT |
| Rollback automático | Não necessário |
| Erros | 0 |

## ETAPA 3 — Validação Imediata

### f_buscar_operacoes_motorista
| Check | Resultado |
|-------|:---------:|
| Volatility | ✅ STABLE (correto) |
| SECURITY DEFINER | ✅ SIM |
| Grants | ✅ `[authenticated, postgres, service_role]` |
| Sem PUBLIC | ✅ |
| Sem anon | ✅ |
| SHA256 pós | `4ebdfbde...` (inalterado — só grants) |

### f_avancar_etapa_app_motorista
| Check | Resultado |
|-------|:---------:|
| Volatility | ✅ **VOLATILE (FIX A01)** |
| SECURITY DEFINER | ✅ SIM |
| Grants | ✅ `[authenticated, postgres, service_role]` |
| Sem PUBLIC | ✅ |
| Sem anon | ✅ |
| auth.uid() + ownership | ✅ |
| Assinatura 5 args, 3 defaults | ✅ |
| SHA256 pós | `be7142bf...` (alterado — volatility fix) |

### f_atualizar_reversa_app
| Check | Resultado |
|-------|:---------:|
| Volatility | ✅ VOLATILE |
| SECURITY DEFINER | ✅ SIM |
| Grants | ✅ `[authenticated, postgres, service_role]` |
| Sem PUBLIC | ✅ |
| Sem anon | ✅ |
| auth.uid() + ownership **(FIX A02)** | ✅ |
| Assinatura 12 args, 11 defaults | ✅ |
| SHA256 pós | `f540aadb...` (alterado — auth.uid() added) |

### Colateral
| Check | Resultado |
|-------|:---------:|
| Tabelas inalteradas | ✅ 7 tabelas verificadas |
| Triggers inalterados | ✅ 117 triggers, nenhum alterado |

## ETAPA 4 — Testes sem Escrita

| Teste | Resultado |
|-------|:---------:|
| 4.A — anon REST API (3 RPCs) | ✅ HTTP 401 bloqueado |
| 4.A — `has_function_privilege` anon (3/3) | ✅ FALSE |
| 4.B — `has_function_privilege` authenticated (3/3) | ✅ TRUE |
| 4.E — `has_function_privilege` service_role (3/3) | ✅ TRUE |
| 4.E — `has_function_privilege` postgres (3/3) | ✅ TRUE |
| Chamada direta (3/3) sem auth | ✅ `USUARIO_NAO_AUTENTICADO` |

### Resumo Grants (pós-aplicação)

| Função | anon | PUBLIC | authenticated | service_role |
|--------|:----:|:------:|:------------:|:------------:|
| f_buscar_operacoes_motorista | ❌ | ❌ | ✅ | ✅ |
| f_avancar_etapa_app_motorista | ❌ | ❌ | ✅ | ✅ |
| f_atualizar_reversa_app | ❌ | ❌ | ✅ | ✅ |

## ETAPA 5 — Testes de Escrita (preparados, não executados)

**Plano disponível em:** `scripts/m133d6_write_test_plan.cjs`

**Estado atual dos dados:**
- Prestadores com `auth_user_id`: 1
- Alocações pendentes: 0
- Alocações em andamento: 85

**Pré-requisitos para execução:**
1. Prestador com `auth_user_id` real (vinculado a Supabase Auth)
2. Alocação vinculada ao prestador
3. Chamada via REST API com JWT do prestador
4. Ou: `service_role` com `SET LOCAL "request.jwt.claims"`

**Aguardando autorização específica para escrita.**

---

## Arquivos de Evidência

| Artefato | Caminho |
|----------|---------|
| Migration aplicada | `supabase/migrations/20260722_m133d4_fix_rpc_app_security.sql` |
| Rollback | `supabase/migrations/20260722_m133d4_rollback.sql` |
| Relatório GO (D.5) | `docs/auditoria/relatorios/2026-07-27_missao133d5_revisao_liberacao_m133d4.md` |
| **Relatório aplicação** | **`docs/auditoria/relatorios/2026-07-27_missao133d6_aplicacao_rpcs_app.md`** |
| Definições pré (D.3 freeze) | `docs/auditoria/02_evidencias/sql/f-*-motorista_remota.sql` |
| Definições pré-check | `docs/auditoria/02_evidencias/sql/f-*-motorista_remota_precheck.sql` |
| Definições pós-aplicação | `docs/auditoria/02_evidencias/sql/f-*-motorista_remota_pos.sql` |
| Script pré-check | `scripts/m133d5_precheck.cjs` |
| Script apply | `scripts/m133d6_apply.cjs` |
| Script validação | `scripts/m133d6_validate.cjs` |
| Script test anon | `scripts/m133d6_test_anon.cjs` |
| Script test pg | `scripts/m133d6_test_pg.cjs` |
| Plano escrita | `scripts/m133d6_write_test_plan.cjs` |

---

## Conclusão

> **RPCs APLICADAS E SEGURANÇA VALIDADA — ESCRITA CONTROLADA AGUARDANDO AUTORIZAÇÃO**

### O que foi alcançado
- ✅ **A01 corrigida**: `f_avancar_etapa_app_motorista` agora é VOLATILE (não mais STABLE com UPDATE/INSERT)
- ✅ **A02 corrigida**: `f_atualizar_reversa_app` agora valida `auth.uid()` + pertencimento do prestador
- ✅ **A03 corrigida**: todas as 3 RPCs sem EXECUTE para PUBLIC/anon, apenas authenticated + service_role
- ✅ **Zero impacto colateral**: tabelas, triggers e dados inalterados
- ✅ **Rollback disponível**: `20260722_m133d4_rollback.sql`

### O que permanece pendente
- ❌ Testes de escrita (requerem autorização específica + prestador com auth_user_id ativo)
- ❌ Homologação com App Motorista real (Flutter externo)
- ❌ Percentual geral: 41% (não aumentado — fluxos de escrita e integração Flutter continuam sem homologação)
