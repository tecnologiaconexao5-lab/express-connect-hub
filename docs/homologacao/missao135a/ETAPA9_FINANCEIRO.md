# ETAPA 9 — Financeiro

## Arquitetura de Propagação (pós-M80)

### Triggers SQL (produtivos)
| Trigger | Tabela Origem | Tabelas Destino | Migration |
|---------|---------------|-----------------|-----------|
| `trg_propagar_financeiro_alocacao` | `alocacoes_escala` | `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os` | M66 |
| `trg_propagar_financeiro_os` | `ordens_servico` | `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os` | M80 |

### TypeScript (desativado M80)
| Função | Status | Motivo |
|--------|--------|--------|
| `sincronizarFinanceiroOS()` | No-op (M80) | Triggers SQL substituíram |
| `salvarComposicaoFinanceira()` | Removida (M80) | Trigger cuida |
| `sincronizarFinanceiroOSAlocacao()` | `@deprecated` | Trigger M66 cuida |

### Proteções
| Tabela | UNIQUE(os_id) | ON CONFLICT |
|--------|:-------------:|:-----------:|
| `financeiro_receber` | ✅ M02 | ✅ M66 + M80 |
| `financeiro_pagar` | ✅ M80 | ✅ M66 + M80 |
| `pagamentos_prestadores` | ✅ M02 | ✅ M66 + M80 |
| `composicao_financeira_os` | ✅ M80 | ✅ M66 + M80 |

### Fórmula Unificada (Margem)
```
outros_custos = adicionais + ajudante - descontos
imposto = valor_cliente * 4.5%
seguro = valor_cliente * 1%
margem_liquida = valor_cliente - valor_prestador - imposto - seguro - outros_custos
```

### Componentes Financeiros
| Componente | Função |
|-----------|--------|
| `ContasReceberEnterprise.tsx` | Lista contas a receber com filtros |
| `PagamentoPrestadores.tsx` | Lista pagamentos a prestadores |
| `DREGerencial.tsx` | DRE gerencial |
| `MargemOperacional.tsx` | Margem operacional |
| `MargemPorOS.tsx` | Margem por OS |
| `ConferenciaFinanceira.tsx` | Conferência financeira |
| `RelatorioMargemReal.tsx` | Relatório de margem real |
| `RelatorioClienteAgregadoRefrigerado.tsx` | Relatório cliente agregado |
