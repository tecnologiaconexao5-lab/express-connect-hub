# ETAPA 7 — Devolução

## Descrição
Fluxo de devolução de mercadoria — cliente não aceita ou motorista retorna à base.

## Como ocorre
| Cenário | Fluxo |
|---------|-------|
| OS com devolução | Endereço com `tipo: "devolucao"` em `os_enderecos` |
| Devolução na escala | `alocacoes_escala` com flag/metadata de devolução |
| Ocorrência → devolução | `portal_ocorrencias` registra motivo, nova OS de retorno |

## Componentes
- **OS types**: `TipoOperacao` inclui `"Devolução"` e `"Reentrega"` como opções
- **os_enderecos.tipo**: inclui `"devolucao"` e `"retorno"`

## Observações
- Não há fluxo automatizado dedicado de devolução — as missões implementaram triggers e colunas mas sem componente específico de "devolução"
- M108F (logística reversa) cobre tanto coleta reversa quanto devolução
- Ação de "Devolver" no App Motorista não foi auditada (app externo)
