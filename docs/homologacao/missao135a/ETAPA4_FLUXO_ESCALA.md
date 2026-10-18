# ETAPA 4 — Fluxo com Escala (OS → Alocação → Aceite → Conclusão)

## Caminho Crítico
```
OrdemServicoForm → criarOrdemServico() → sincronizarComEscala() → alocacao criada
  → App Motorista aceita → alocacao.aceita → em_rota → concluida
  → [trigger M66] → financeiro
  → [trigger M99] → eventos
```

## Etapas

| # | Ação | Arquivo/Função | Tabela |
|---|------|----------------|--------|
| 1 | Criar OS | `ordemServicoService.criarOrdemServico()` | `ordens_servico` |
| 2 | Sincronizar com escala | `ordemServicoService.sincronizarComEscala()` | `alocacoes_escala` (INSERT) |
| 3 | App Motorista aceita | RPC `aceitar_alocacao` / `escalaService.aceitarAlocacao()` | `alocacoes_escala.status=aceita` |
| 4 | Motorista sai p/ rota | App Motorista / EscalaLista | `alocacoes_escala.status=em_rota` |
| 5 | Concluir entrega | `escalaService.finalizarAlocacao()` | `alocacoes_escala.status=concluida` |
| 6 | **Trigger M66** | `f_trg_propagar_financeiro_alocacao()` | `financeiro_receber`, `pagamentos_prestadores`, `composicao_financeira_os` |
| 7 | **Trigger M99** | `trg_evento_alocacao_*` | `eventos_oficiais` |

## Status Flow (Alocação)
```
planejada → aguardando_aceite → aceita → em_rota → concluida
                                                       → cancelada (qualquer estado)
```

## Status Flow (OS) — via escala
```
pendente → agendada → em_andamento → em_rota → entregue → finalizada
```

## Integrações
- **App Motorista (Flutter)**: aceita rota, altera status, envia POD
- **Portal Cliente**: visualiza status em tempo real via Realtime subscription
- **Financeiro**: propagado via trigger M66 (idempotente, ON CONFLICT)

## Pontos de Atenção
- `sincronizarComEscala()` exige `prestador_id`, `data_os` e `veiculo_tipo` — sem esses campos, fluxo não avança
- `alocacoes_escala` tem coluna `ordem_servico_id` FK para `ordens_servico`
- Alocação pode ser criada sem OS (modo "avulso" pela EscalaLista)
