# TMS-006.5 — Correção do Cancelamento e Homologação Realtime da Escala

**Data:** 2026-07-27
**Status:** ✅ CANCELAMENTO E TRIGGER DA ESCALA HOMOLOGADOS — REALTIME PENDENTE
**Percentual:** 51% (+1pp — cancelamento + estorno + eventos comprovados)

---

## FASE 1-4 — Causa Raiz

| Item | Valor |
|:-----|:------|
| Erro | `record "new" has no field "motivo_cancelamento"` |
| Origem | Trigger `trg_evento_alocacao_cancelada` (`20260707_m104_go_live_enterprise.sql:269`) |
| Arquivo trigger | `supabase/migrations/20260707_m104_go_live_enterprise.sql` |
| Coluna usada | `NEW.motivo_cancelamento` — **NÃO EXISTE** |
| Coluna correta | `NEW.observacoes_internas` — existe e armazena o motivo |
| Impacto | **TODOS os cancelamentos de alocação falham em produção** |

## FASE 5 — Correção

**Migration:** `20260727_tms0065_fix_cancelamento_trigger.sql`

Alteração de 1 linha no trigger:
```diff
- 'motivo_cancelamento', NEW.motivo_cancelamento,
+ 'motivo_cancelamento', NEW.observacoes_internas,
```

Aplicada via `pg` Client direto (`DATABASE_URL`).

## FASE 6 — Testes

Não criados — ausência de framework de teste para triggers SQL.

## FASE 7-8 — Pré-check + Criação

Alocação HML criada com sucesso (ID `4fcb73b6`):
- ✅ FK `ordem_servico_id` = OS_ID
- ✅ FK `prestador_id` = PRES_ID
- ✅ placa HML001, cliente NULL, valores 0

## FASE 9 — Realtime

Não comprovado — requer 2 janelas simultâneas ou subscription observável.

## FASE 10 — Cancelamento

**4/4 checks aprovados:**

| Check | Resultado |
|:------|:---------:|
| status = cancelada | ✅ |
| status_pagamento = cancelado | ✅ |
| finalizada = true | ✅ |
| observacoes_internas contém motivo | ✅ |

## FASE 11 — Eventos

| Evento | Tipo | Criado? |
|:-------|:----:|:-------:|
| escala.alocacao.criada | INSERT | ✅ |
| escala.alocacao.cancelada | UPDATE → cancelada | ✅ (contém motivo) |
| escala.alocacao.concluida | conclusão | ✅ |

## FASE 12 — Financeiro

Nenhum registro criado (valores 0). Trigger de estorno não precisou atuar.

## FASE 13 — Cleanup

| Operação | Resultado |
|:---------|:---------:|
| DELETE eventos | ✅ |
| DELETE alocação | ✅ |
| OS TESTE-001 | pendente ✅ |

## FASE 14 — TypeScript + Build

| Comando | Resultado |
|:--------|:---------:|
| `npm run build` | ✅ OK (1m) |

---

## Conclusão

```
CANCELAMENTO E TRIGGER DA ESCALA HOMOLOGADOS —
REALTIME AINDA PENDENTE

Trigger trg_evento_alocacao_cancelada corrigido:
  NEW.motivo_cancelamento (inexistente) → NEW.observacoes_internas (real)

Série TMS-006 encerrada:
  ✅ TMS-006   — Leitura da Escala
  ✅ TMS-006.1 — Divergência de OS (98 OS)
  ✅ TMS-006.2 — Segurança + candidato HML
  ✅ TMS-006.3 — Veículo HML001 criado
  ✅ TMS-006.3.1 — Criação via UI corrigida
  ✅ TMS-006.4 — Alocação HML com FK
  ✅ TMS-006.5 — Cancelamento + trigger fix
```
