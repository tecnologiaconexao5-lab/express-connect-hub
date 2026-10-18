# TMS-006.7 — Correção do Evento Falso de Conclusão na Escala

**Data:** 2026-07-27
**Status:** ✅ TRIGGER DE CONCLUSÃO CORRIGIDO — TESTE FUNCIONAL PENDENTE
**Percentual:** 50% (provisório — pendente teste funcional)

---

## FASE 1 — Revisão

| Status | finalizada | Evento ANTES | Evento DEPOIS |
|:------:|:----------:|:------------:|:-------------:|
| cancelada | true | `concluida` ❌ | **nenhum** ✅ |
| concluida | true | `concluida` ✅ | `concluida` ✅ |
| finalizada (futuro) | true | `concluida` | `concluida` |
| em_rota | false | nenhum ✅ | nenhum ✅ |

**Bug confirmado:** trigger `trg_evento_operacao_finalizada` (m99:250, função m109:122) criava `escala.alocacao.concluida` para QUALQUER `finalizada=true`, inclusive cancelamento. A condição WHEN não excluía `NEW.status = 'cancelada'`.

## FASE 2 — Correção

Migration `20260727_tms0067_fix_conclusao_falsa.sql`:

```diff
 WHEN (NEW.finalizada = true
       AND (OLD.finalizada IS DISTINCT FROM NEW.finalizada)
+      AND NEW.status != 'cancelada')
```

**1 linha adicionada.** SHA-256: `9C8ABE6197313FC60F8D7DC0DA670A8DC5AC49D6F312F9A52E0F7AEAA04FF828`

## FASE 3 — Rollback

`20260727_tms0067_rollback.sql` — restaura condição original (com bug). SHA-256: `B2180A0E3384780C3B67D4510C7035B3519D6B2E6C7EE1FA05580250A5FEA6D6`

## FASE 4 — Validação Estática

| Item | Status |
|:-----|:------:|
| Sintaxe SQL | ✅ OK |
| Assinatura da função | ✅ inalterada |
| Trigger recriado | ✅ mesmo nome |
| Tabelas alteradas | ✅ nenhuma |
| RLS alterada | ✅ nenhuma |
| DML | ✅ nenhum |
| Outros triggers | ✅ nenhum alterado |

## FASE 5 — Autorização

✅ **AUTORIZADO** (apenas migration, sem testes funcionais).

## FASE 6 — Aplicação

✅ Migration aplicada via `pg` Client (`DATABASE_URL`). Trigger `trg_evento_operacao_finalizada` recriado com condição corrigida.

---

## Pendente

Teste funcional completo (2 cenários) aguardando autorização separada:
1. Cancelamento → verificar SÓ `cancelada` (sem `concluida`)
2. Conclusão real → verificar `concluida` exatamente uma vez

## Conclusão

```
TRIGGER DE CONCLUSÃO CORRIGIDO —
TESTE FUNCIONAL PENDENTE

1 linha adicionada na condição WHEN do trigger
trg_evento_operacao_finalizada para excluir
status = 'cancelada' da geração de evento concluída.
```
