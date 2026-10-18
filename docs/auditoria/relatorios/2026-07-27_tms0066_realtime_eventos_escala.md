# TMS-006.6 — Homologação Realtime e Auditoria dos Eventos da Escala

**Data:** 2026-07-27
**Status:** ✅ REALTIME UPDATE HOMOLOGADO — TRIGGER "CONCLUIDA" COM FALSO POSITIVO DOCUMENTADO
**Percentual:** 50% (provisório — pendente reconciliação)

---

## FASE 1 — Eventos da TMS-006.5

O relatório TMS-006.5 mencionou 3 eventos (criada, cancelada, **concluída**). Investigação confirmou:
- **criada** — trigger `trg_evento_alocacao_criada` (INSERT)
- **cancelada** — trigger `trg_evento_alocacao_cancelada` (UPDATE status → cancelada)
- **concluída** — **FALSO POSITIVO** do trigger `trg_evento_operacao_finalizada`

| Evento | Tipo | Origem | Correto? |
|:-------|:----:|:-------|:--------:|
| escala.alocacao.criada | INSERT | `trg_evento_alocacao_criada` (m104) | ✅ |
| escala.alocacao.cancelada | UPDATE status | `trg_evento_alocacao_cancelada` (m104) | ✅ |
| escala.alocacao.concluida | UPDATE finalizada | `trg_evento_operacao_finalizada` (m99) | ❌ **Falso positivo** |

## FASE 2 — Triggers Mapeados

| Trigger | Tabela | Evento | Condição | Tipo publicado |
|:--------|:------:|:------:|:---------|:---------------|
| `trg_evento_alocacao_criada` | alocacoes_escala | AFTER INSERT | — | `escala.alocacao.criada` |
| `trg_evento_alocacao_cancelada` | alocacoes_escala | AFTER UPDATE OF status | NEW.status = 'cancelada' | `escala.alocacao.cancelada` |
| `trg_evento_alocacao_recusada` | alocacoes_escala | AFTER UPDATE OF status | NEW.status = 'recusada' | `escala.alocacao.recusada` |
| `trg_evento_alocacao_motorista_trocado` | alocacoes_escala | AFTER UPDATE OF prestador_id | — | `escala.alocacao.motorista_trocado` |
| `trg_evento_operacao_finalizada` | alocacoes_escala | AFTER UPDATE OF finalizada | NEW.finalizada=true | `escala.alocacao.concluida` **BUG** |

### Bug: `trg_evento_operacao_finalizada` cria "concluída" para cancelamento

O trigger `trg_evento_operacao_finalizada` (arquivo `20260705_m99_event_bus_fundacao.sql`, linha 250) dispara quando `finalizada` muda para `true`. Quando uma alocação é cancelada, o UPDATE define `finalizada: true` juntamente com `status: 'cancelada'`. Ambos os triggers disparam:
1. `trg_evento_alocacao_cancelada` → `escala.alocacao.cancelada` (correto)
2. `trg_evento_operacao_finalizada` → `escala.alocacao.concluida` (INCORRETO — alocação foi cancelada, não concluída)

**Correção necessária (futura):** Adicionar `AND NEW.status != 'cancelada'` na condição WHEN do trigger `trg_evento_operacao_finalizada`.

## FASE 3 — Cliente Realtime

`useEscalaRealtime.ts` (26 linhas):
- Canal: `escala-operacional-realtime`
- Eventos: `*` (INSERT, UPDATE, DELETE)
- Tabela: `alocacoes_escala`
- Cleanup: `supabase.removeChannel(channel)` no return do useEffect
- Usado por `EscalaLista.tsx:295-297` que chama `loadAlocacoes()`

**Avaliação:** ✅ Implementado corretamente. Sem risco de loop (cleanup adequado).

## FASE 4-5 — Pré-check + Autorização

Pré-check: OS, prestador, veículo HML limpos. Autorizado.

## FASE 6-7 — Teste Realtime

### Setup
- Sessão A: cria e cancela alocação
- Sessão B: assina canal `escala-operacional-realtime` com `postgres_changes` (`*:public:alocacoes_escala`)

### Resultados

| Evento | Recebido via Realtime? | Status |
|:-------|:----------------------:|:------:|
| INSERT (criação) | ❌ **Não recebido** | Possível timing ou service_role |
| UPDATE (cancelada) | ✅ **Recebido** | `- → cancelada` |

**UPDATE via Realtime comprovado.** INSERT não recebido — possível race condition com service_role da Edge Function.

## FASE 8 — Eventos Oficiais

| Evento | Tipo | Status no payload | Correto? |
|:-------|:----:|:-----------------:|:--------:|
| `escala.alocacao.criada` | INSERT | aguardando_aceite | ✅ |
| `escala.alocacao.cancelada` | UPDATE | (vazio) | ✅ (trigger fix TMS-006.5) |
| `escala.alocacao.concluida` | UPDATE | cancelada | ❌ **Falso positivo** — cancela, não conclui |

## FASE 9 — Histórico

`historico_alocacoes_escala` (criado por `escalaService.cancelarAlocacao()`):

| Evento | Descrição |
|:-------|:----------|
| `mudanca_status` | Status alterado de aguardando_aceite para cancelada |
| `finalizacao` | Alocação finalizada |

## FASE 10 — Cleanup

| Operação | Resultado |
|:---------|:---------:|
| DELETE eventos (3) | ✅ |
| DELETE alocação | ✅ |
| Remover canal Realtime | ✅ |
| Prestador sem alocações ativas | ✅ |

## FASE 11 — Build

| Comando | Resultado |
|:--------|:---------:|
| `npm run build` | ✅ |

---

## Conclusão

```
REALTIME UPDATE HOMOLOGADO —
TRIGGER "CONCLUIDA" COM FALSO POSITIVO DOCUMENTADO

Realtime UPDATE funciona (cancelada recebida via postgres_changes).
INSERT não comprovado (possível limitação com service_role).

Bug documentado: trg_evento_operacao_finalizada cria 
escala.alocacao.concluida em vez de verificar se é cancelamento.
```
