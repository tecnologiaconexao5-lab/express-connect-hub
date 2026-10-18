# TMS-007.4 ETAPA C — Relatório de Restauração Controlada

**Data:** 2026-07-28T16:10-16:16 UTC-3
**OS:** `TEST-M80-CF-MR751I7O` (id `71e61468-af09-42e6-8d7e-e4624d9b1468`)
**Ambiente:** `uwrvzsjtpgaifkktpepn.supabase.co` (PRODUÇÃO)
**Método:** `pg` client direto via `DATABASE_URL`

---

## 1. Estado Pré-Restauração (pós-ETAPA B)

| Entidade | Status |
|:---------|:-------|
| ordens_servico.status | `finalizada` |
| ordens_servico.valor_prestador_calculado | 1500 |
| financeiro_receber.status | `aberto` |
| financeiro_pagar.status | `aberto` |
| composicao_financeira_os | 1 registro (id `acfbf07e`) |
| evento finalizada | 1 registro (id `f1e5578d`) |

---

## 2. SQL Executado

Bloco `DO $$ ... $$` atômico via `pg.Client.query()`. Transação implícita:
- Sucesso → COMMIT implícito
- `RAISE EXCEPTION` → ROLLBACK automático

### STEP 1 — DELETE composição
```sql
DELETE FROM composicao_financeira_os
WHERE id = 'acfbf07e-5f03-4a8c-ab44-ccf4714b6e5a';
```
ROW_COUNT: 1 ✅

### STEP 2 — UPDATE ordens_servico → pendente
```sql
UPDATE ordens_servico
SET status = 'pendente', valor_prestador_calculado = 0, updated_at = NOW()
WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468';
```
ROW_COUNT: 1 ✅
Triggers disparados: M80b (propagação), M104 (status_changed)

### STEP 3 — Corrige financeiro_receber
```sql
UPDATE financeiro_receber
SET status = 'pendente', updated_at = NOW()
WHERE id = '200ecb02-c91e-48e1-9dc8-ff73f99e0227';
```
ROW_COUNT: 1 ✅

### STEP 4 — Corrige financeiro_pagar
```sql
UPDATE financeiro_pagar
SET status = 'pendente', updated_at = NOW()
WHERE id = '208bc3cb-8e9f-48dc-88c1-67b3a54cdd28';
```
ROW_COUNT: 1 ✅

### STEP 5 — Touch pagamentos_prestadores
```sql
UPDATE pagamentos_prestadores
SET updated_at = NOW()
WHERE id = '7178a5ca-050b-4854-974d-8a3c70ea0d22';
```
ROW_COUNT: 1 ✅

---

## 3. Validações Pós-Restauração (16/16)

| # | Validação | Esperado | Obtido | Resultado |
|:-:|:----------|:---------|:-------|:---------:|
| 1A | OS.status | pendente | pendente | ✅ |
| 1B | custo_prestador | 1500 | 1500 | ✅ |
| 1C | valor_cliente | 3000 | 3000 | ✅ |
| 1D | cliente_id | `04280785...` | `04280785...` | ✅ |
| 1E | prestador_id | `6cc41f68...` | `6cc41f68...` | ✅ |
| 2A | FR.status | pendente | pendente | ✅ |
| 2B | FR.valor | 3000 | 3000 | ✅ |
| 3A | FP.status | pendente | pendente | ✅ |
| 3B | FP.valor | 1500 | 1500 | ✅ |
| 4A | PP.status_pagamento | pendente | pendente | ✅ |
| 4B | PP.status_conferencia | em_aberto | em_aberto | ✅ |
| 4C | PP.valor_liquido | 1750 | 1750 | ✅ |
| 5 | composicao_financeira_os | 0 registros | 0 | ✅ |
| 6A | evento finalizada preservado | 1 | 1 | ✅ |
| 6B | evento status_changed criado | 1 | 1 | ✅ |
| 6C | total eventos (sem duplicatas) | 2 | 2 | ✅ |

---

## 4. Decisões de Restauração

| Decisão | Escolha | Justificativa |
|:--------|:--------|:--------------|
| updated_at | NOW() (não 2026-07-05) | Sem trigger auto; representa data real da restauração |
| Evento finalizada | PRESERVADO | Trilha de auditoria válida |
| Evento status_changed | CRIADO pelo trigger M104 | Documenta pendente → finalizada → pendente |
| composicao_financeira_os | DELETADO | Não existia originalmente; criado pela ETAPA A |
| IDs primários | Usados em vez de os_id | `id` exato de cada registro |

---

## 5. Limpeza

- Scripts temporários removidos: `_m0074_etapaB_2_idempotencia.ts`, `_m0074_etapaB_3_eventos.ts`, `_snapshot_atual.ts`
- Script executor mantido: `scripts/_m0074_etapaC_executar.mjs`
- Nenhum resíduo HML

---

## Conclusão

**TMS-007.4 CONCLUÍDA — M80b, M104, INTERFACE, IDEMPOTÊNCIA E RESTAURAÇÃO HOMOLOGADAS**

Todos os 4 pilares validados:
1. ✅ **M80b** — Propagação financeira OS direta funcional e idempotente
2. ✅ **M104** — Event bus funcional (evento `f1e5578d` confirmado)
3. ✅ **Interface MargemPorOS** — 12 campos validados via Playwright, 0 erros
4. ✅ **Restauração** — 16/16 validações, DO block atômico, sem resíduos
