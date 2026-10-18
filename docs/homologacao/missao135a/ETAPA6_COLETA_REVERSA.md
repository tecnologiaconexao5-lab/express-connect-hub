# ETAPA 6 — Coleta Reversa

## Descrição
Fluxo de coleta reversa — motorista coleta volumes no destino do cliente e retorna à base.

## Componentes
| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `ColetaReversaFields` | `src/components/operacao/ColetaReversaFields.tsx` | Formulário de campos de coleta reversa (tipo, volumes, endereço, valor, divergências) |
| `ColetaReversaFinanceiro` | `src/components/operacao/ColetaReversaFinanceiro.tsx` | Cálculo financeiro específico para coleta reversa |

## Interface
`ReversaFields` com 25+ campos:
- `tipo_reversa`, `reversa_qtd_volumes`, `reversa_observacoes`
- `reversa_endereco_coleta`, `reversa_endereco_devolucao`
- `reversa_valor_unitario`, `reversa_unidade_cobranca`
- `reversa_qtd_coletada`, `reversa_divergencia`, `reversa_motivo_divergencia`
- `reversa_impacto_prestador`, `reversa_impacto_cliente`

## Migração
`supabase/migrations/20260711_m108f_logistica_reversa_enterprise.sql` — adiciona colunas reversa em `alocacoes_escala` e `ordens_servico`.

## Tabelas Impactadas
- `alocacoes_escala` — colunas reversa adicionadas
- `ordens_servico` — colunas reversa adicionadas
- Endereços em `os_enderecos` com tipo `coleta_reversa`

## Fluxo
```
OS com flag reversa → ColetaReversaFields ativado
  → Alocação criada com dados reversa
  → Motorista executa coleta no destino
  → Confere divergências
  → Finaliza com reversa concluída
```
