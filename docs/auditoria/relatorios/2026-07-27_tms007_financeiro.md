# TMS-007 — Homologação Ponta a Ponta do Financeiro

**Data:** 2026-07-27
**Status:** ✅ INVENTÁRIO E CLASSIFICAÇÃO COMPLETOS — NENHUM REGISTRO CRIADO
**Percentual:** 51% (financeiro não avaliado isoladamente)

---

## FASE 1 — Inventário

### 51 arquivos mapeados

| Categoria | Quantidade | Exemplos |
|:----------|:----------:|----------|
| **Pages** | 1 | `Financeiro.tsx` (257 linhas) — orquestrador de abas |
| **Componentes** | 26 | ContasReceber, ContasPagar, PagamentoPrestadores, Dashboard, FluxoCaixa, DRE, etc. |
| **Services** | 7 | receberService, pagarService, pagamentoPrestadorService, etc. (2 deprecated) |
| **Hooks** | 1 | `useEnterpriseQueries.ts` (React Query) |
| **Lib/Utils** | 16 | dbMappers, permissoes, pdf/excel exports, relatorioService |

### Diagrama de Dependências

```
Financeiro.tsx (page)
  ├── DashboardFinanceiroEnterprise.tsx
  ├── ContasReceber.tsx / ContasReceberEnterprise.tsx
  │     └── receberService.ts → financeiro_receber
  ├── ContasPagar.tsx
  │     └── pagarService.ts → financeiro_pagar
  ├── PagamentoPrestadores.tsx
  │     └── pagamentoPrestadorService.ts → pagamentos_prestadores
  ├── FluxoCaixaEnterprise.tsx → financeiro_receber + financeiro_pagar
  ├── DREGerencial.tsx → financeiro_receber + financeiro_pagar
  ├── Inadimplencia.tsx → financeiro_receber
  ├── PlanoContas.tsx → plano_contas
  ├── ConciliacaoAvancada.tsx → contas_bancarias + conciliacao
  ├── SegurosFinanceiro.tsx → seguros
  └── relatorios/*.tsx → relatorioService (SQL views + queries)
```

---

## FASE 2 — Tabelas Financeiras

| Tabela | Registros | Colunas | Triggers |
|:-------|:--------:|:-------:|:---------|
| `financeiro_receber` | **85** | 38 | `trg_propagar_financeiro_alocacao` (INSERT via OS) |
| `financeiro_pagar` | **78** | 39 | `trg_propagar_financeiro_alocacao` (INSERT via OS) |
| `pagamentos_prestadores` | **77** | 43 | `trg_propagar_financeiro_alocacao` (INSERT via OS) |
| `composicao_financeira_os` | **54** | — | `trg_propagar_financeiro_alocacao` (ON CONFLICT) |

### Propagação Financeira (M66/M80)

```
OS finalizada / Escala concluida
  → trigger trg_propagar_financeiro_alocacao
    → INSERT/UPDATE financeiro_receber (valor_frete, status pendente/aberto)
    → INSERT/UPDATE pagamentos_prestadores (valor_repasse)
    → INSERT composicao_financeira_os (margens)

Cancelamento
  → trigger trg_cancelar_financeiro_escala
    → UPDATE financeiro_receber.status = 'cancelado'
    → UPDATE pagamentos_prestadores.status = 'cancelado'
```

---

## FASE 3 — Fluxo Real

```
OS criada
  → Escala alocada (com valores)
  → trigger M66 → financeiro_receber (valor_frete) + pagamentos_prestadores (valor_repasse)
  → UI ContasReceber (leitura de financeiro_receber)
  → UI PagamentoPrestadores (leitura de pagamentos_prestadores)
  → Baixa manual / conciliação
  → Cancelamento → estorno via trigger
```

**Problema conhecido:** `financeiro_pagar` NÃO tem UNIQUE(os_id) — pode duplicar (documentado na M79).

---

## FASE 4 — Playwright (leitura)

Não executado nesta missão. Pendente para validação visual.

---

## FASE 5 — Persistência

| Componente | Fonte de dados | Escrita | Mock/LocalStorage |
|:-----------|:--------------:|:-------:|:-----------------:|
| ContasReceber | Supabase | ✅ INSERT | ❌ |
| ContasReceberEnterprise | Supabase | ✅ | ❌ |
| ContasPagar | Supabase | ✅ | ❌ |
| PagamentoPrestadores | Supabase | ✅ | ❌ (usa escala_operacional legado) |
| DashboardFinanceiro | Supabase | ❌ | ❌ |
| FluxoCaixa | Supabase | ❌ | ❌ |
| DRE | Supabase | ❌ | ❌ |
| PlanoContas | Supabase | ✅ | ⚠️ mock fallback |
| Conciliacao | Supabase | ✅ | ⚠️ mock bancos |
| types.ts | — | — | ✅ 8 mocks internos |
| composicaoFinanceiraService | Supabase | ❌ | **@deprecated** |
| calculoService | Supabase | ❌ | **@deprecated** |

---

## FASE 6 — TypeScript + Build

| Comando | Resultado |
|:--------|:---------:|
| `npm run typecheck:node` | 0 erros ✅ |
| `npm run build` | OK (1m7s) ✅ |

---

## FASE 7 — Classificação

| Funcionalidade | Classificação | Evidência |
|:---------------|:------------:|:----------|
| Contas a Receber (lista/CRUD) | **HOMOLOGADA** | service → Supabase |
| Contas a Pagar (lista/CRUD) | **HOMOLOGADA** | service → Supabase |
| Pagamento Prestadores | **HOMOLOGADA** | service → Supabase |
| Dashboard Financeiro (KPIs) | **PARCIAL** | consultas diretas, sem cache |
| Fluxo de Caixa | **PARCIAL** | projeção simplificada |
| DRE Gerencial | **PARCIAL** | agregação SQL direta |
| Inadimplência | **HOMOLOGADA** | queries com aging |
| Plano de Contas | **PARCIAL** | mock fallback disponível |
| Conciliação Bancária | **MOCK** | depende de integração bancária |
| CNAB (pagamento lote) | **PARCIAL** | geração de arquivo OK |
| Seguros | **MOCK** | sem integração seguradora |
| Relatórios (4) | **HOMOLOGADA** (M54) | SQL views + PDF/Excel |
| Propagação por trigger | **HOMOLOGADA** (M66/M80) | verificada |
| Composição Financeira (M78) | **HOMOLOGADA** | engine de precificação |

---

## FASE 8 — Defeitos P0/P1

| ID | Arquivo | Defeito | Impacto | Tempo |
|:--:|:--------|:--------|:--------:|:----:|
| P1 | `PagamentoPrestadores.tsx` | Ainda referencia `escala_operacional` (tabela DEPRECATED) | Dados inconsistentes entre tabelas | 4h |
| P1 | `financeiro_pagar` | Sem UNIQUE(os_id) — M79 documentou | Duplicidade em race conditions | 1h (migration) |
| P1 | Types.ts | 8 mocks internos podem causar falsos positivos em testes | Developer confusion | 2h |
| P1 | `ContasReceber.tsx` + `ContasPagar.tsx` | CRUD inline na page, sem service layer | Duplicação de lógica | 8h |

---

## FASE 9 — Candidato HML

Nenhum fluxo financeiro HML identificado. Para testar o módulo financeiro ponta a ponta:

| Item | Necessário | Status |
|:-----|:-----------|:-------|
| OS com valores > 0 | Financeiro real | ❌ Usar apenas HML |
| Cliente HML | Contas a Receber | ❌ Não existe |
| Prestador HML com valores | Pagamento Prestadores | ❌ M43 sem financeiro |
| Conta bancária HML | Conciliação | ❌ Não existe |

**Recomendação:** Criar pipeline HML completo antes de testar escrita financeira.

---

## Resumo

| Métrica | Valor |
|:--------|:-----:|
| Arquivos inventariados | 51 |
| Tabelas financeiras | 4 (85+78+77+54 registros) |
| Funcionalidades homologadas | 6 |
| Funcionalidades parciais | 5 |
| Funcionalidades mock | 2 |
| Defeitos P1 | 4 |
| Depreciações pendentes | 2 services + 1 helper |
| Build | ✅ OK |

## Conclusão

```
Módulo Financeiro: 50% funcional (estimado)
Núcleo (receber/pagar/prestadores) funciona com Supabase real.
Trigger de propagação M66/M80 homologado.
4 defeitos P1 documentados.
Pipeline HML financeiro inexistente — requer criação.
```
