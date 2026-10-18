# MISSÃO 108-G — TABELA DE VALORES ENTERPRISE DEFINITIVA

**Data:** 2026-07-11
**Status:** ✅ **18/18 testes — 100% aprovados**
**Build:** `tsc --noEmit` 0 erros ✅ | `npm run build` 31s ✅

---

## O QUE FOI IMPLEMENTADO

### Migration (banco de dados)

| Tabela | Colunas adicionadas |
|--------|-------------------|
| `tabelas_valores` | `versao INTEGER`, `motivo_alteracao TEXT`, `prioridade INTEGER` |
| `tabela_prestador` | `data_inicio DATE`, `data_fim DATE`, `versao INTEGER`, `motivo_alteracao TEXT`, `prioridade INTEGER` |

### Triggers
- `trg_tabelas_valores_version`: incrementa `versao` automaticamente em UPDATE
- `trg_tabela_prestador_version`: incrementa `versao` automaticamente em UPDATE

### View de auditoria
- `vw_hierarquia_tabelas`: consolida todas as tabelas com nível hierárquico (1-7)

### Engine TypeScript

| Arquivo | Mudança |
|---------|---------|
| `buscarTabelasService.ts` | Hierarquia expandida para 7 níveis (antes 4), tracking de `HierarquiaInfo` |
| `types.ts` | `TabelaValorAplicada` com `versao`, `prioridade`, `data_inicio`, `data_fim` |

### Hierarquia oficial (7 níveis)

| Nível | Descrição | Prioridade |
|:-----:|-----------|:----------:|
| 1 | Valor negociado na OS (match por `cliente_id` UUID) | Máxima |
| 2 | Contrato (se `contrato_id` informado) | |
| 3 | Cliente (nome) + tipo_veículo + vigência | |
| 4 | Cliente (nome) + tipo_veículo (sem vigência) | |
| 5 | Universal + tipo_veículo + vigência | |
| 6 | Universal + tipo_veículo (sem vigência) | |
| 7 | Fallback genérico (com alerta) | Mínima |

Dentro do mesmo nível, a tabela com **maior `prioridade`** é selecionada automaticamente.

### Versionamento

- `UPDATE` em qualquer tabela incrementa `versao` automaticamente
- Histórico de versões preservado (nunca sobrescrito)
- `motivo_alteracao` documenta cada mudança

### Testes realizados (18/18 ✅)

| # | Teste | Resultado |
|---|-------|:---------:|
| 1-3 | Colunas adicionadas em `tabelas_valores` | ✅ |
| 4-8 | Colunas adicionadas em `tabela_prestador` | ✅ |
| 9 | Trigger de versionamento criado | ✅ |
| 10 | Versão incrementa automaticamente | ✅ |
| 11 | View `vw_hierarquia_tabelas` criada | ✅ |
| 12 | INSERT com `versao` e `prioridade` | ✅ |
| 13 | `versao = 1` no INSERT | ✅ |
| 14 | `prioridade = 10` no INSERT | ✅ |
| 15 | Nível hierárquico 1 na view | ✅ |
| 16 | INSERT tabela_prestador com vigência | ✅ |
| 17 | `versao = 1` na tabela_prestador | ✅ |
| 18 | `prioridade = 5` na tabela_prestador | ✅ |

### Arquivos modificados

| Arquivo | Finalidade |
|---------|-----------|
| `supabase/migrations/20260711_m108g_tabela_valores_enterprise.sql` | Migration oficial |
| `src/services/precificacao/types.ts` | + campos versao, prioridade, data_inicio, data_fim |
| `src/services/precificacao/buscarTabelasService.ts` | Hierarquia 7 níveis, `HierarquiaInfo`, prioridade, vigência |
| `scripts/m108g_apply_and_test.mjs` | Aplicação + 18 testes |
