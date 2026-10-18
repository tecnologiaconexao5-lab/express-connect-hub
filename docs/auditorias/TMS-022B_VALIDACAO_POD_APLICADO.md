# TMS-022B — Validação do POD Aplicado em Produção

**Data:** 2026-07-29

---

## 1. Confirmação: M108C1 JÁ APLICADA

Diagnóstico TMS-022 confirmou que a migration `20260710_m108c1_pod_unico_entregas_protocolo.sql` já está em produção:

| Componente | Status |
|:-----------|:------:|
| Função `f_sync_delivery_proof_to_entregas` | ✅ EXISTE |
| Trigger `trg_sync_delivery_proof_to_entregas` | ✅ EXISTE (AFTER INSERT ON delivery_proofs) |
| Coluna `receiver_relationship` em entregas_protocolo | ✅ EXISTE |
| Coluna `gps_accuracy` em entregas_protocolo | ✅ EXISTE |
| Tabela `delivery_proofs` | ✅ EXISTE (2 registros) |
| Tabela `entregas_protocolo` | ✅ EXISTE (44 registros) |
| 0 delivery_proofs sem correspondência | ✅ Sincronização OK |
| 1 possível duplicata (alocacao_id repetido) | ⚠️ A INVESTIGAR |

---

## 2. Análise da Função Atual

Baseado na migration M108C1:

| Aspecto | Análise |
|:--------|:--------|
| CAST de operation_id | `CAST(NEW.operation_id AS UUID)` com TRY/CATCH. Seguro. |
| Busca alocação | SELECT de `alocacoes_escala` por `ae.id = v_alocacao_id`. Correto. |
| Idempotência | `IF EXISTS (SELECT 1 FROM entregas_protocolo WHERE alocacao_id = v_alocacao_id) THEN RETURN NEW`. ✅ |
| Fallback ON CONFLICT | `ON CONFLICT DO NOTHING`. ✅ |
| Mapeamento de status | `delivered` → `entregue`, `delivered_with_note` → `entregue_ressalva`, `not_delivered` → `nao_entregue`. ✅ |
| SECURITY DEFINER | Executa como owner. Risco mitigado por `SET search_path = public`. ✅ |
| Trigger | AFTER INSERT — falha reverte INSERT original. App recebe erro. ⚠️ |
| Chave de idempotência | `alocacao_id` — funciona para 1 POD por alocação. ⚠️ Ver cardinalidade. |

### Risco: Trigger falha reverte INSERT do app

Se o trigger lançar exceção (ex: violação de constraint), a transação completa é revertida — incluindo o INSERT em `delivery_proofs`. O app receberá erro e poderá:
1. Tentar novamente (retry) → pode ser bem-sucedido
2. Enfileirar em `OfflineUploadQueue` → retry automático
3. Mostrar erro para o motorista → perda de dados

**Probabilidade:** Baixa (função testada em produção, 2 registros OK)
**Impacto:** Alto (perda de POD)
**Mitigação:** Já existe — o app tem `OfflineUploadQueue` e retry.

---

## 3. Duplicidade Potencial

**1 alocacao_id com 2 registros em entregas_protocolo.**

### Hipóteses

| Hipótese | Probabilidade | Explicação |
|:---------|:-------------:|:-----------|
| Trigger + TMS inseriram mesmo POD | Média | TMS `podService.ts:131` insere em `entregas_protocolo` DIRETAMENTE. Se o TMS finalizou uma operação COM POD, e o app também enviou, podem existir 2 registros para a mesma alocação. |
| Dois registros antigos (pré-trigger) | Média | Os 44 registros incluem 10 do seed M57 + possíveis inserções diretas do TMS antes do trigger existir. |
| alocacao_id NULL | Baixa | NULLs não são considerados duplicatas por UNIQUE. |

### Ação Recomendada

Executar `TMS-022B_DIAGNOSTICO_DUPLICIDADE_POD.sql` para identificar o caso exato.

**Se for trigger + TMS:** corrigir TMS `podService.ts` para verificar se já existe POD antes de inserir.
**Se for dados antigos:** não requer ação (dados históricos legítimos).

---

## 4. Cardinalidade do POD

| Permissão | Regra | Justificativa |
|:----------|:------|:--------------|
| 1 alocação = 1 POD | ✅ Regra atual | Operação padrão (standard_delivery) |
| 1 alocação = vários PODs | ❌ Não suportado | Trigger bloqueia via alocacao_id |
| 1 alocação = 1 POD por parada | ❌ Não suportado | `entregas_protocolo` não tem campo `stop_id` |
| 1 alocação = vários comprovantes (foto + assinatura separados) | ❌ Não suportado | App envia tudo em 1 registro |

### Chave de Idempotência Recomendada

**`alocacao_id`** — é a chave correta para o modelo atual.

- App trata cada alocação como uma única operação de entrega
- O POD de uma alocação contém: foto + assinatura + recebedor + canhoto (tudo em 1 registro)
- Não há suporte a múltiplas paradas por alocação no modelo atual de POD
- Para suportar multi-paradas no futuro: adicionar `stop_id` em `entregas_protocolo` e alterar chave para `(alocacao_id, stop_id)`

**Não criar UNIQUE(alocacao_id) agora** sem confirmar que não há dados conflitantes. O trigger já faz idempotência via `IF EXISTS`.

---

## 5. Riscos da Função Atual

| Risco | Severidade | Ação |
|:------|:----------:|:-----|
| CAST de operation_id TEXT inválido | Baixa | TRY/CATCH — ignora o registro |
| Alocação não encontrada | Baixa | Trigger retorna sem inserir (prestador_id NULL) |
| Duplicidade por trigger + TMS | Média | Investigar via diagnóstico |
| Trigger falha reverte app transação | Baixa | OfflineUploadQueue faz retry |
| SECURITY DEFINER sem search_path | Zero | M108C1 já tem SET search_path = public |

---

## 6. Situação das Policies e Grants

Diagnóstico TMS-022 reportou: **6 policies** e **27 grants** em `entregas_protocolo`.

Para verificação detalhada, executar:
- `supabase/scripts/TMS-022B_DIAGNOSTICO_SEGURANCA_POD.sql`

### Análise Preliminar

6 policies para `entregas_protocolo` é um número elevado. Migrações M113, M114 e M108C1 adicionaram policies que podem ter se acumulado. Possível haver policies conflitantes ou obsoletas.

**Ação:** Executar diagnóstico e, se confirmado, planejar limpeza de policies (missão futura).

---

## 7. Arquivos Gerados

| Arquivo | Finalidade | Estado |
|:--------|:-----------|:-------|
| `supabase/scripts/TMS-022B_DIAGNOSTICO_DUPLICIDADE_POD.sql` | Investigar 1 duplicata | ✅ Criado, não executado |
| `supabase/scripts/TMS-022B_VALIDAR_SINCRONIZACAO_POD.sql` | Validar 2 delivery_proofs | ✅ Criado, não executado |
| `supabase/scripts/TMS-022B_DIAGNOSTICO_SEGURANCA_POD.sql` | Auditar policies/grants | ✅ Criado, não executado |
| `docs/auditorias/TMS-022B_VALIDACAO_POD_APLICADO.md` | Este documento | ✅ Salvo |
| `docs/auditorias/TMS-022_UNIFICACAO_POD.md` | Atualizado com status aplicado | ✅ Atualizado |

---

## 8. Decisões

### Script Controlado
❌ **NÃO EXECUTAR** `TMS-022_POD_UNIFICADO_CONTROLADO.sql` — M108C1 já aplicada.

### Rollback
❌ **NÃO EXECUTAR** `TMS-022_POD_ROLLBACK.sql` — preservar trigger existente.

### Migração M108C1
❌ **NÃO REAPLICAR** — qualquer correção deve ser incremental.

### Próximo Passo
Executar os 3 SQLs de diagnóstico TMS-022B para confirmar duplicidade, sincronização e segurança. Após resultados, decidir se TMS-022 pode ser encerrada.

---

*Fim — TMS-022B Validação POD Aplicado*
