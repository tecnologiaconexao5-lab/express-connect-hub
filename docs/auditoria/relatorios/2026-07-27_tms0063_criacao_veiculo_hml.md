# TMS-006.3 — Criação Controlada do Veículo HML para Teste de Escala

**Data:** 2026-07-27
**Status:** ✅ VEÍCULO HML CRIADO E VALIDADO — PRONTO PARA TESTE CONTROLADO DE ESCALA
**Percentual:** 49% (neutro — criação não altera escore)

---

## FASE 1 — Schema

| Campo | Obrigatório | Tipo | Default | Valor HML |
|-------|:-----------:|:----:|:-------:|:---------:|
| `placa` | ✅ | text | — | `HML001` |
| `tipo_veiculo` | ✅ | text | — | `moto` |
| `status` | — | text | — | `Ativo` |
| `observacoes` | — | text | — | `TMS-0063-HML — Veículo de homologação...` |
| `prestador_vinculado` | — | uuid | null | null |
| `custo_km` | — | numeric | 0 | 0 |
| `created_at` | — | timestamptz | auto | auto |
| `updated_at` | — | timestamptz | auto | auto |

**Bug detectado:** O mapper `toVeiculoInsert()` (`dbMappers.ts:891`) tenta inserir colunas `subcategoria`, `tipo_carroceria`, `classificacao_termica` que **não existem** no schema real da tabela `veiculos`. Causa erro `PGRST204` ao criar via UI. A criação foi feita via API direta com colunas corretas.

## FASE 2 — Identificador HML

| Critério | Resultado |
|----------|:---------:|
| Placa `HML001` válida? | ✅ — formato aceito (sistema aceita TESTE01, OS001, DEL5-19, etc.) |
| Já existe? | ✅ Confirmado: NÃO existe antes da criação |
| Upper case? | ✅ `HML001` |
| Marcador HML | ✅ Em `observacoes`: `TMS-0063-HML` |

## FASE 3 — Payload

```json
{
  "placa": "HML001",
  "tipo_veiculo": "moto",
  "status": "Ativo",
  "observacoes": "TMS-0063-HML — Veículo de homologação. Não utilizar em operação comercial."
}
```

## FASE 4 — Efeitos Colaterais

| Trigger/Consumidor | Efeito | Reversível | Risco |
|:------------------:|:------:|:----------:|:----:|
| RLS (`veiculos_insert_tenant`) | Valida tenant | ✅ | Zero |
| Realtime | Nenhum canal em `veiculos` | ✅ | Zero |
| Escala | Não consulta `veiculos` para alocação automática | ✅ | Zero |
| Financeiro | Nenhum | ✅ | Zero |
| Tracking | Nenhum | ✅ | Zero |
| Notificações | Nenhuma | ✅ | Zero |
| **Total:** | **Zero efeitos colaterais** | ✅ | **Zero** |

## FASE 5 — Autorização

✅ **AUTORIZADO** pelo usuário.

## FASE 6 — Criação

**Via API direta** (devido a bug no mapper — ver FASE 1).

| Parâmetro | Valor |
|:---------:|:------|
| Endpoint | `POST /rest/v1/veiculos` |
| HTTP | **201** ✅ |
| ID criado | `e674550f-c577-4d14-956c-b83df5e903b0` |
| Usuário | `tamiris.castilho@conexaoexpress.com.br` (super_admin) |
| Tenant | `00000000-0000-0000-0000-000000000000` (sentinel) |
| Marca/Modelo | Não preenchido |

## FASE 7 — Banco × Interface

| Campo | Payload | Banco | Interface (lista) | Resultado |
|-------|:-------:|:-----:|:-----------------:|:---------:|
| placa | `HML001` | `HML001` | ✅ "HML001" visível | ✅ |
| tipo_veiculo | `moto` | `moto` | ✅ "Moto" visível | ✅ |
| status | `Ativo` | `Ativo` | ✅ | ✅ |
| observacoes | `TMS-0063-HML...` | ✅ | ✅ (textarea) | ✅ |
| prestador_vinculado | null | null | ✅ | ✅ |

**Playwright:** 1/1 passou (8.3s) — HML001 confirmado na lista após recarregar.

## FASE 8 — Isolamento

| Verificação | Resultado |
|:-----------:|:---------:|
| Alocações com placa HML001 | **0** ✅ |
| OS com placa_alocada HML001 | **0** ✅ |
| Financeiro com HML001 | **0** ✅ |
| Tracking/Prestador vinculado | **0** ✅ |
| Prestador vinculado ao veículo | **Não** ✅ |

## FASE 9 — Registro HML

```
REGISTRO HML TEMPORÁRIO — NÃO UTILIZAR EM OPERAÇÃO COMERCIAL

ID:          e674550f-c577-4d14-956c-b83df5e903b0
Placa:       HML001
Tipo:        moto
Status:      Ativo
Criado em:   2026-07-27
Missão:      TMS-006.3
Finalidade:  Homologação de alocação de escala (TMS-006.4)
Exclusão:    Após conclusão dos testes de Escala, DELETE por ID
Marcador:    TMS-0063-HML em observacoes
```

## FASE 10 — TypeScript e Build

| Comando | Resultado |
|---------|:---------:|
| `npm run typecheck:node` | **0 erros** ✅ |
| `npm run build` | **OK** (37.90s) ✅ |

Nenhum erro novo introduzido.

---

## Bug Report: Mapper insere colunas inexistentes

**Arquivo:** `src/lib/dbMappers.ts:891-936`
**Problema:** `toVeiculoInsert()` envia colunas `subcategoria`, `tipo_carroceria`, `classificacao_termica` que não existem na tabela `veiculos`.
**Impacto:** Criação via UI falha com erro `PGRST204`.
**Solução:** Adicionar filtro no mapper ou remover os campos do formulário.
**Prioridade:** P3 (não afeta leitura/edição de veículos existentes).

---

## Próximo Passo

**TMS-006.4:** Criar alocação controlada usando:
- OS: `TESTE-001` (28640e7b)
- Prestador: `M43_2026-06-29_18-24-20` (5377592a)
- **Veículo:** `HML001` (e674550f) ✅ **CRIADO NESTA MISSÃO**
