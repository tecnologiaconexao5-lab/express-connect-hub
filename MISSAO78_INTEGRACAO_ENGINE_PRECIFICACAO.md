# MISSÃO 78 — Integração do Engine de Precificação (2026-07-05)

**Status:** ✅ Engine integrado em OS, Escala e Orçamento. Depreciações marcadas. Build e tsc OK.

## Objetivo

Substituir TODOS os cálculos de preço espalhados pelo código pelo `precificacaoEngineService.calcularPreco()` (assíncrono, com lookup de tabelas) ou `calcularPrecoRapido()` (síncrono, bridge para componentes com tabela já carregada).

## O que foi feito

### 1. Engine expandido — `calcularPrecoRapido()`

```typescript
// Adicionado em precificacaoEngineService.ts
calcularPrecoRapido(tabela: TabelaInput, distanciaKm: number): { valorCliente: number; valorPrestador: number; kmExcedente: number; descricao: string }
```

Bridge síncrona para componentes que já possuem a tabela de valores em estado (OrdemServicoForm, OrcamentoForm, EscalaLista). Não faz re-query ao banco.

### 2. OrdemServicoForm.tsx — substituído cálculo inline

- `calcularValorAutomatico` → renomeado para `_calcularValorAutomaticoLegado`
- `recalcularValores()` agora chama `calcularPrecoRapido()` para calcular valorCliente e valorPrestador
- Demais campos (kmExcedente, margens, etc.) continuam sendo computados localmente

### 3. EscalaLista.tsx — engine no lugar de engineFinanceira

- `calcularTotalAlocacao()` reescrito: core pricing via `calcularPrecoRapido()`
- Removeu import de `calcularFinanceiroEscala` (`engineFinanceira.ts`)
- Removeu chamada a `engineFinanceira.calcularFinanceiroEscala()`

### 4. OrcamentoForm.tsx — engine no lugar de calcularValorAutomatico

- `calcularValorAutomatico` → renomeado para `_calcularValorAutomaticoLegado`
- Substituído por `calcularPrecoRapido()` no handler de seleção de tabela
- Campos adicionais (kmExcedente, custoEstimado, margens) computados localmente

### 5. Depreciações marcadas (5 arquivos)

| Arquivo | Depreciação |
|---------|------------|
| `engineFinanceira.ts` | `@deprecated` — redirecionar para `precificacaoEngineService.calcularPreco()` |
| `composicaoFinanceiraService.ts` | `@deprecated` — duplicata de buscarTabelaPrestador() + calcularValorPrestador() |
| `calculoService.ts` | `@deprecated` — usava TABELA_TESTE_VEICULOS_SP hardcoded |
| `calculoEscalaFinanceiro.ts` | `@deprecated` — lógica movida para EscalaLista.tsx |
| `ordemServicoService.ts` | `sincronizarFinanceiroOSAlocacao()` já marcada deprecated (Missão 77) |

### 6. Engine validado com dados reais

Teste `scripts/m77_test_engine.ts` — dados reais DVL + FRANKLIN + CDR0F12:
- Cliente: R$ 785,00 (base R$ 400 + 50km exc R$ 105 + espera R$ 280)
- Prestador: R$ 437,50 (diária R$ 350 + 50km exc R$ 87,50)
- Margem bruta: 44,27%, líquida: 43,27%

## Estado atual dos fluxos

| Fluxo | Engine | Persistência financeira | Status |
|-------|--------|------------------------|--------|
| OS Form (criação) | ✅ `calcularPrecoRapido()` | `sincronizarFinanceiroOS()` via composicaoFinanceiraService (legado) | ⚠️ Preview pelo engine, persistência ainda legado |
| OS Form (edição) | ✅ `calcularPrecoRapido()` | mesma função | ⚠️ Idem |
| Escala Form (criação) | ✅ `calcularPrecoRapido()` | Trigger M66 (banco) + `sincronizarFinanceiroOSAlocacao()` (deprecated) | ✅ Trigger cuida da propagação |
| Escala Form (edição) | ✅ `calcularPrecoRapido()` | Trigger M66 (banco) | ✅ Trigger cuida da propagação |
| Orçamento Form | ✅ `calcularPrecoRapido()` | N/A (orcamento não gera financeiro) | ✅ |
| Financeiro (relatórios) | N/A | N/A — só consome dados | ✅ |

## Próximos passos (P5 — Persistência via Engine)

1. Fazer `calcularPreco(modo: "efetivar")` persistir valores em `ordens_servico` + `financeiro_receber` + `pagamentos_prestadores` + `composicao_financeira_os`
2. Remover `sincronizarFinanceiroOS()` de `ordemServicoService.ts` (substituir por chamada ao engine modo efetivar)
3. Remover `calcularValorAutomaticoLegado` de OrdemServicoForm e OrcamentoForm
4. Remover arquivos depreciados (`engineFinanceira.ts`, `composicaoFinanceiraService.ts`, `calculoService.ts`, `calculoEscalaFinanceiro.ts`)

## Arquivos modificados

- `src/services/precificacao/precificacaoEngineService.ts` — adicionado `calcularPrecoRapido()`
- `src/components/operacao/OrdemServicoForm.tsx` — `recalcularValores()` → engine
- `src/components/operacao/EscalaLista.tsx` — `calcularTotalAlocacao()` → engine
- `src/components/comercial/OrcamentoForm.tsx` — handler tabela → engine
- `src/utils/engineFinanceira.ts` — `@deprecated`
- `src/services/financeiro/composicaoFinanceiraService.ts` — `@deprecated`
- `src/services/financeiro/calculoService.ts` — `@deprecated`
- `src/helpers/calculoEscalaFinanceiro.ts` — `@deprecated`

## Validação

- `npx tsc --noEmit` → ✅ 0 erros
- `npm run build` → ✅ 32,56s
- Teste engine (dados reais) → ✅ 3/3 casos (DVL, FRANKLIN, CDR0F12)
