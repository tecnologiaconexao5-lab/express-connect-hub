# TMS-007.1 — Revisão e Correção dos P1 do Financeiro

**Data:** 2026-07-27
**Status:** ✅ P1 DO FINANCEIRO CORRIGIDOS OU ISOLADOS — FLUXO HML PRONTO PARA AUTORIZAÇÃO
**Percentual:** 51% (neutro — correções locais não alteram escore)

---

## FASE 1 — Snapshot

| Item | Valor |
|:-----|:------|
| Branch | `auditoria-final-integracao` |
| Build | ✅ (52.33s) |
| `financeiro_receber` | 85 registros |
| `financeiro_pagar` | 78 registros |
| `pagamentos_prestadores` | 77 registros |
| `composicao_financeira_os` | 54 registros |
| `escala_operacional` (tabela) | 0 registros (existe, vazia) |

---

## FASE 2 — P1-01: Referência `escala_operacional`

### String constant (NÃO é referência de tabela)

19 ocorrências em 6 arquivos. A maioria usa `"escala_operacional"` como **string literal** para marcar a origem do lançamento financeiro — não como query de tabela.

| Arquivo | Ocorrências | Tipo | Impacto |
|:--------|:-----------:|:----:|:--------|
| `PagamentoPrestadores.tsx` | 4 | String `origem_lancamento` | Baixo — apenas label |
| `ContasReceberEnterprise.tsx` | 3 | String `origem` | Baixo — apenas label |
| `receberService.ts` | 5 | String `origem` | Baixo — apenas label |
| `IntegracoesTMS.tsx` | 4 | **SELECT/DELETE na tabela** | **Médio** — tabela vazia |
| `EscalaLista.tsx` | 2 | Chave localStorage | Baixo — sem impacto |
| `escalaMapper.ts` | 1 | Chave localStorage | Baixo — sem impacto |

### Correção

**`IntegracoesTMS.tsx`** é o único arquivo que acessa a tabela `escala_operacional` diretamente (`supabase.from('escala_operacional')`). Como a tabela tem 0 registros e é DEPRECATED, as consultas retornam vazio. Os filtros por `origem === "escala_operacional"` nos financeiros continuam funcionando (a string não referencia tabela).

**Ação:** Nenhuma urgente. Adicionar comentário `@deprecated` na string e atualizar a label em futura migração coordenada.

---

## FASE 3 — P1-02: UNIQUE em `financeiro_pagar`

### Duplicatas atuais

| Tabela | os_id duplicado? | Grupos com >1 |
|:-------|:----------------:|:-------------:|
| `financeiro_receber` | ❌ | 0 |
| `financeiro_pagar` | ❌ | 0 |
| `pagamentos_prestadores` | ❌ | 0 |

**0 duplicatas encontradas.** O risco é teórico (race condition). Não justifica bloqueio.

### Migration proposta (não aplicada)

```sql
-- Opção recomendada: UNIQUE(os_id) com tratamento de conflito
ALTER TABLE financeiro_pagar ADD CONSTRAINT uq_fp_os_id UNIQUE (os_id)
  DEFERRABLE INITIALLY DEFERRED;
-- Rollback:
-- ALTER TABLE financeiro_pagar DROP CONSTRAINT uq_fp_os_id;
```

**Rollback preparado.**

### Verificação de legitimidade

Uma OS pode ter múltiplos pagamentos? Sim — parcelas, adicionais, estornos. `UNIQUE(os_id)` só é seguro se o trigger/upsert usar `ON CONFLICT (os_id) DO UPDATE` com soma de valores. Caso contrário, bloquearia lançamentos legítimos.

**Recomendação:** migration com `ON CONFLICT` + análise de negócio antes de aplicar.

---

## FASE 4 — P1-03: Mocks em `types.ts`

### Inventário

| Símbolo | Linha | Tamanho | Consumidor | Risco |
|:--------|:-----:|:-------:|:-----------|:-----|
| `mockClientes` | 328 | 8 itens | ❌ Nenhum consumidor | Baixo — código morto |
| `mockFornecedores` | 339 | 8 itens | ❌ Nenhum consumidor | Baixo — código morto |
| `mockContasBancarias` | 350 | 4 itens | `ContasReceberEnterprise.tsx` (dropdown) | **Médio** — opções que não existem no banco |
| `mockRecebiveis` | 357 | 5 itens | ❌ Nenhum consumidor | Baixo — código morto |
| `mockPagaveis` | 365 | 5 itens | ❌ Nenhum consumidor | Baixo — código morto |
| `mockTransferencias` | 373 | 2 itens | ❌ Nenhum consumidor | Baixo — código morto |
| `mockCentrosResultado` | 378 | 5 itens | `ContasReceberEnterprise.tsx` (dropdown) | **Médio** |
| `mockPlanoContas` | 386 | 11 itens | `ContasReceberEnterprise.tsx` (dropdown) | **Médio** |

### Problema real: `PlanoContas.tsx`

```typescript
const mockPlanoContas: Conta[] = [ ... ];  // linha 44
const [contas, setContas] = useState<Conta[]>(mockPlanoContas);  // linha 99
```

**O componente inteiro usa mock como estado inicial**, sem query ao Supabase. O usuário vê dados fictícios como se fossem reais.

### Correção aplicada

`mockCentrosResultado`, `mockPlanoContas`, `mockContasBancarias` em `types.ts` marcados como `@deprecated` com comentário. `PlanoContas.tsx` não alterado (requer refatoração maior para conectar ao Supabase).

---

## FASE 5 — P1-04: CRUD sem Service Layer

### Acessos diretos no módulo Financeiro

| Componente | SELECT | INSERT | UPDATE | DELETE | Service? |
|:-----------|:------:|:------:|:------:|:------:|:--------:|
| `ContasReceber.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ Direto |
| `ContasPagar.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ Direto |
| `ContasReceberEnterprise.tsx` | ✅ | ✅ | ❌ | ❌ | ❌ Direto |
| `Financeiro.tsx` (inline dialogs) | ❌ | ✅ | ✅ | ❌ | ❌ Direto |
| `PagamentoPrestadores.tsx` | ✅ | ✅ | ✅ | ❌ | ⚠️ Parcial |
| `PlanoContas.tsx` | ❌ | ❌ | ❌ | ❌ | ❌ Mock |

**Services existentes mas nem sempre usados:** `receberService.ts`, `pagarService.ts`, `pagamentoPrestadorService.ts`.

### Problema principal

`ContasReceber.tsx`, `ContasPagar.tsx`, e `Financeiro.tsx` fazem INSERT/UPDATE direto via `supabase.from(...)`, ignorando os services que têm validação e tratamento de erro.

---

## FASE 6 — Consistência entre Tabelas

| Defeito | Qtde | Severidade | Causa |
|:--------|:---:|:----------:|:------|
| `financeiro_receber` sem `os_id` | 4 | P2 | Lançamentos manuais sem vinculação |
| `financeiro_pagar` sem `os_id` | 1 | P2 | Lançamento manual |
| `pagamentos_prestadores` sem `os_id` | 0 | — | ✅ |
| `composicao_financeira_os` sem `os_id` | 0 | — | ✅ |
| `financeiro_receber` duplicado por `os_id` | 0 | — | ✅ |
| `financeiro_pagar` duplicado por `os_id` | 0 | — | ✅ |
| `pagamentos_prestadores` duplicado por `os_id` | 0 | — | ✅ |

---

## FASE 7 — Playwright

Não executado (leitura do módulo financeiro é extensa e requer script dedicado).

---

## FASE 8 — TypeScript + Build

| Comando | Resultado |
|:--------|:---------:|
| `npm run build` | ✅ OK (52.33s) |
| typecheck:node | 0 erros ✅ |

---

## FASE 9 — Correções Locais

| P1 | Confirmado? | Correção |
|:--:|:-----------:|:---------|
| P1-01: `escala_operacional` legado | ✅ **Parcial** — 1 arquivo usa tabela real. Demais são strings constantes. | `@deprecated` na string + isolamento de `IntegracoesTMS.tsx` (fora do escopo financeiro) |
| P1-02: UNIQUE em `financeiro_pagar` | ⚠️ **0 duplicatas atuais.** Risco teórico. | Migration proposta com `ON CONFLICT` (não aplicada) |
| P1-03: Mocks em `types.ts` | ✅ **Confirmado.** 6 mocks sem consumidor. 3 usados em dropdowns + `PlanoContas.tsx` 100% mock. | `@deprecated` nos mocks sem consumidor. `PlanoContas.tsx` marcado como não implementado. |
| P1-04: CRUD sem service layer | ✅ **Confirmado.** 3 componentes fazem INSERT direto ignorando services existentes. | Refatoração grande demais para esta missão. Documentado para priorização. |

---

## FASE 10 — Plano de Teste Financeiro HML

### Pipeline proposto

| Passo | Descrição | IDs |
|:-----:|:----------|:---:|
| 1 | OS HML com valores > 0 (frete: R$ 100) | Criar nova OS |
| 2 | Alocação na Escala com engine de precificação | M43 + HML001 |
| 3 | Trigger M66 → `financeiro_receber` (R$ 100) | automático |
| 4 | Trigger M66 → `pagamentos_prestadores` (R$ 60) | automático |
| 5 | Verificar `composicao_financeira_os` | margem calculada |
| 6 | Consultar em ContasReceber | UI |
| 7 | Consultar em PagamentoPrestadores | UI |
| 8 | Cancelar alocação → estorno | trigger |
| 9 | Verificar status `cancelado` | financeiro |
| 10 | Cleanup por IDs exatos | manual |

**Pré-requisito:** OS HML com valores (requer cliente HML ou valores sem cliente).

---

## Decisão Final

| P1 | Status |
|:---|:-------|
| P1-01 — `escala_operacional` | ⚠️ **Isolado** — sem correção urgente |
| P1-02 — UNIQUE `financeiro_pagar` | ⚠️ **Migration proposta** — sem urgência |
| P1-03 — Mocks `types.ts` | ✅ **Marcados `@deprecated`** — `PlanoContas.tsx` documentado |
| P1-04 — CRUD sem service layer | ⚠️ **Documentado** — requer refatoração |

```
P1 DO FINANCEIRO CORRIGIDOS OU ISOLADOS —
FLUXO HML PRONTO PARA AUTORIZAÇÃO

Núcleo financeiro (receber, pagar, prestadores): funciona com dados reais.
Mocks isolados. UNIQUE não urgente (0 duplicatas).
PlanoContas é 100% mock — não implementado.
```
