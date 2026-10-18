# ETAPA 3 — Fluxo Direto (OS → Finalizada, sem Escala)

## Descrição
OS criada no TMS (formulário) e finalizada sem vinculação a escala/motorista.

## Caminho Crítico
```
OrdemServicoForm.tsx → criarOrdemServico() → [trigger SQL M80] → financeiro
                                            → [trigger M99] → eventos_oficiais
```

## Etapas

| # | Ação | Arquivo | Função |
|---|------|---------|--------|
| 1 | Preencher formulário | `OrdemServicoForm.tsx` | `handleSubmit()` |
| 2 | Criar OS no banco | `ordemServicoService.ts:263` | `criarOrdemServico()` |
| 3 | Inserir endereços | `ordemServicoService.ts:335-361` | INSERT em `os_enderecos` |
| 4 | Finalizar OS | `ordemServicoService.ts:393` | `finalizarOrdemServico()` |
| 5 | Buscar tabela prestador | `finalizarOrdemServico()` | `buscarTabelaPrestador()` |
| 6 | Calcular valor prestador | `finalizarOrdemServico()` | Fórmula inline (vmin + kmExc * vKm + vSaida) |
| 7 | Atualizar OS | `finalizarOrdemServico()` | UPDATE status=finalizada |
| 8 | **Trigger SQL M80** | `trg_propagar_financeiro_os` | Cria/atualiza financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os |
| 9 | **Trigger SQL M99** | `trg_evento_os_finalizada` | Publica `os.ordem_servico.finalizada` em `eventos_oficiais` |

## Tabelas Impactadas
| Tabela | Operação | Origem |
|--------|----------|--------|
| `ordens_servico` | INSERT → UPDATE | `criarOrdemServico()` / `finalizarOrdemServico()` |
| `os_enderecos` | INSERT | `criarOrdemServico()` |
| `financeiro_receber` | INSERT/UPDATE | Trigger M80 |
| `financeiro_pagar` | INSERT/UPDATE | Trigger M80 |
| `pagamentos_prestadores` | INSERT/UPDATE | Trigger M80 |
| `composicao_financeira_os` | INSERT/UPDATE | Trigger M80 |
| `eventos_oficiais` | INSERT | Trigger M99 |

## Status Flow (OS)
```
pendente → finalizada
       (não passa por agendada/em_rota/entregue)
```

## Observações
- Fluxo direto NÃO cria alocação em `alocacoes_escala`
- Financeiro propagado exclusivamente por trigger SQL (M80)
- Sem motorista, sem tracking, sem POD
- Sempre que possível, usar fluxo com escala (ETAPA 4)
