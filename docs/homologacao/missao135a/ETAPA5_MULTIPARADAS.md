# ETAPA 5 — Multiparadas

## Descrição
OS com múltiplos pontos de coleta e/ou entrega.

## Tabela
`os_enderecos` — armazena cada ponto da rota com `sequencia`, `tipo` (coleta/entrega/apoio/devolucao), endereço completo.

## Fluxo
```
OrdemServicoForm → criarOrdemServico() → INSERT em os_enderecos (N linhas)
  → EscalaLista exibe pontos → App Motorista navega por sequência
  → Cada ponto pode ter status individual (pendente/concluido/falhou)
```

## Tipos de Ponto
| tipo | Descrição |
|------|-----------|
| `coleta` | Ponto de coleta (origem) |
| `entrega` | Ponto de entrega (destino) |
| `apoio` | Apoio operacional |
| `devolucao` | Devolução |
| `retorno` | Retorno |
| `coleta_reversa` | Coleta reversa |

## Dados por Ponto
- Endereço completo (logradouro, numero, bairro, cidade, estado, cep)
- Janela de horário (janela_inicio, janela_fim)
- Contato, responsável, telefone, email
- Coordenadas (latitude, longitude)
- Instruções operacionais
- Status individual do ponto

## Observações
- OS com multiparadas usa `tipo_operacao = "roteirizado"` ou `"fracionado"`
- `sincronizarComEscala()` usa apenas primeiro endereço de coleta e entrega como origem/destino
- Múltiplos pontos são visíveis no RoteirizadorWeb e App Motorista
