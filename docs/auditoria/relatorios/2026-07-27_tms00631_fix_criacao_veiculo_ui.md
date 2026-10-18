# TMS-006.3.1 — Corrigir Criação de Veículo pela Interface

**Data:** 2026-07-27
**Status:** ✅ CRIAÇÃO DE VEÍCULO PELA INTERFACE CORRIGIDA E HOMOLOGADA — HML001 LIBERADO PARA TESTE DE ESCALA
**Percentual:** 49% (neutro)

---

## FASE 1 — Erro Congelado

| Item | Valor |
|:----:|:------|
| Código | `PGRST204` |
| Mensagem | `Could not find the 'classificacao_termica' column of 'veiculos' in the schema cache` |
| Colunas rejeitadas | `subcategoria`, `tipo_carroceria`, `classificacao_termica` |
| Arquivo | `src/lib/dbMappers.ts` |
| Função | `toVeiculoInsert()` |
| Screenshot | `test-results/e2e/tms0063/test-failed-1.png` |

## FASE 2 — Schema Real vs Mapper

| Campo do mapper | Existe no DB? | Tipo DB | Ação |
|:---------------:|:-------------:|:-------:|:----:|
| `subcategoria` | ❌ | — | **Removido do INSERT** |
| `tipo_carroceria` | ❌ | — | **Removido do INSERT** |
| `classificacao_termica` | ❌ | — | **Removido do INSERT** |
| `tipo_veiculo` | ✅ | text | Mantido |
| `placa` | ✅ | text | Mantido |
| `prestador_vinculado` | ✅ | uuid | Mantido |
| `tipo_carga` | ✅ | text | Mantido |
| `temperatura_min` | ✅ (temp_min) | numeric | Mantido |
| `temperatura_max` | ✅ (temp_max) | numeric | Mantido |
| `status` | ✅ | text | Mantido |
| `observacoes` | ✅ | text | Mantido |

## FASE 3 — Origem dos Campos Inexistentes

| Campo | Origem | É usado? | Pode remover? |
|:-----:|:-------|:--------:|:-------------:|
| `subcategoria` | `VeiculoForm` / `VeiculoRow` / formulário UI | Formulário (3 selects) | Sim — removido do INSERT; campos do formulário ficam vazios (não persistidos) |
| `tipo_carroceria` | `VeiculoForm` / `VeiculoRow` / formulário UI | Formulário (select) | Sim |
| `classificacao_termica` | `VeiculoForm` / `VeiculoRow` / formulário UI | Formulário (select) | Sim |

Os campos existem na interface `VeiculoForm` e nos selects do formulário, mas **nunca existiram como colunas na tabela `veiculos`** no Supabase. São um artefato de desenvolvimento onde o frontend assumiu colunas que não foram criadas.

## FASE 4 — Correção Aplicada

### `src/lib/dbMappers.ts`

| O quê | Onde | Antes | Depois |
|:------|:----:|:-----:|:------:|
| `VeiculoRow.subcategoria` | linha 853 | `subcategoria?: string;` | Removido (comentário documentando) |
| `VeiculoRow.tipo_carroceria` | linha 867 | `tipo_carroceria?: string;` | Removido |
| `VeiculoRow.classificacao_termica` | linha 868 | `classificacao_termica?: string;` | Removido |
| `toVeiculoInsert` subcategoria | linha 897 | `d.subcategoria = form.subcategoria` | Removido |
| `toVeiculoInsert` tipoCarroceria | linha 911 | `d.tipo_carroceria = form.tipoCarroceria` | Removido |
| `toVeiculoInsert` classificacaoTermica | linha 912 | `d.classificacao_termica = form.classificacaoTermica` | Removido |
| `fromVeiculoRow` subcategoria | linha 950 | `subcategoria: item.subcategoria` | Removido |
| `fromVeiculoRow` tipoCarroceria | linha 964 | `tipoCarroceria: item.tipo_carroceria` | Removido |
| `fromVeiculoRow` classificacaoTermica | linha 965 | `classificacaoTermica: item.classificacao_termica` | Removido |

Os campos permanecem em `VeiculoForm` e `Veiculo` (UI types) — selects do formulário continuam visíveis, mas **não são enviados ao banco**. Ao recarregar, voltam ao estado vazio (placeholder do select).

## FASE 5 — Testes Unitários do Mapper

**11/11 testes passam** (arquivo: `src/test/veiculoMapper.test.ts`)

| Teste | Resultado |
|:----:|:---------:|
| 1 — payload mínimo (placa + tipo) | ✅ |
| 2 — NÃO envia subcategoria/tipo_carroceria/classificacao_termica | ✅ |
| 3 — todas as chaves do payload são colunas reais | ✅ |
| 4 — subcategoria vazia não gera chave | ✅ |
| 5 — prestadorVinculado undefined não aparece | ✅ |
| 6 — capacidades numéricas viram number | ✅ |
| 7 — observacoes preservada | ✅ |
| Update: não contém created_at | ✅ |
| Update: não contém colunas ilegítimas | ✅ |
| fromVeiculoRow: sem subcategoria | ✅ |
| fromVeiculoRow: placa/tipo preservados | ✅ |

## FASE 6 — Update

`toVeiculoUpdate()` chama `toVeiculoInsert()` e remove `created_at`. As colunas ilegítimas também foram removidas do fluxo de update. Testes comprovam.

## FASE 7+8 — Teste de Criação pela Interface

**Estratégia B** (criar HML002, confirmar, excluir).

### Resultado

| Etapa | Resultado |
|:------|:---------:|
| Abrir formulário | ✅ |
| Preencher payload | ✅ |
| Salvar | ✅ **HTTP 201 — 0 erros 400** |
| HML002 no banco | ✅ ID `ac868c85`, placa `HML002`, tipo `moto` |
| Observacoes | ✅ `TMS-0063.1-HML` |
| Cleanup | ✅ HML002 excluído por ID |

### Evidência definitiva

**0 HTTP 400 errors.** O INSERT via UI não enviou `subcategoria`, `tipo_carroceria` ou `classificacao_termica`. A correção do mapper funciona end-to-end pela interface.

## FASE 9 — TypeScript + Build

| Comando | Antes | Agora | Delta |
|---------|:-----:|:-----:|:-----:|
| `npm run typecheck:node` | 0 erros | 0 erros | 0 ✅ |
| `npm run build` | OK (31s) | OK (45s) | 0 ✅ |
| `npx vitest run` | 20/20 | **31/31** (+11) | +11 ✅ |

Nenhum erro novo introduzido.

## FASE 10 — Errata TMS-006.3

| Afirmação anterior | Correção |
|:-------------------|:---------|
| "criação via interface falhou" | ✅ **CORRIGIDA** — mapper não envia mais colunas inexistentes |
| "criação via API direta não homologa o formulário" | ✅ **HOMOLOGADO** — criação via UI comprovada (HML002) |
| "mapper incompatível com schema" | ✅ **CORRIGIDO** — `dbMappers.ts` alterado |
| "criação de alocação adiada até correção" | ✅ **BLOQUEADOR REMOVIDO** — HML001 disponível |

---

## Conclusão

```
CRIAÇÃO DE VEÍCULO PELA INTERFACE CORRIGIDA E HOMOLOGADA —
HML001 LIBERADO PARA TESTE DE ESCALA

Causa raiz: mapper toVeiculoInsert() enviava colunas subcategoria,
tipo_carroceria e classificacao_termica que não existem na tabela
veiculos do Supabase.

Correção: remoção dos 3 campos do fluxo INSERT + VeiculoRow.
11 testes unitários + 1 Playwright UI comprovam.
```
