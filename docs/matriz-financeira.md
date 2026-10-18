# Matriz Financeira — Express Connect Hub / TMS

> **Missao:** 02 | **Data:** 2026-06-26

---

## 1. Tabelas Financeiras

| Tabela | Proposito | Chave | UNIQUE os_id? |
|--------|-----------|-------|---------------|
| `ordens_servico` | Origem da receita e custo | `id` UUID | — |
| `financeiro_receber` | Contas a receber (cliente) | `os_id` UUID | **SIM** (Missao 02) |
| `financeiro_pagar` | Contas a pagar (prestador) | `os_id` UUID | NAO |
| `pagamentos_prestadores` | Repasse ao prestador | `os_id` UUID | **SIM** (Missao 02) |
| `composicao_financeira_os` | Margem e composicao | `os_id` UUID | SIM |
| `contas_financeiras` | Contas bancarias | `id` UUID | — |
| `alocacoes_escala` | Dados financeiros da escala | `id` UUID | — |

---

## 2. Fluxo do Dinheiro

```
CLIENTE paga ──→ financeiro_receber.status = 'pago'
                       │
                       ├──→ Dashboard: Receita
                       └──→ Relatorio: Faturamento

EMPRESA paga ──→ financeiro_pagar.status = 'pago'
  prestador           │
                       ├──→ pagamentos_prestadores.status_pagamento = 'pago'
                       ├──→ Dashboard: Custo
                       └──→ Relatorio: Pagamento Prestador

MARGEM = somatorio(valor_cliente) - somatorio(custo_total)
         ────→ composicao_financeira_os.margem_liquida
                ────→ Dashboard: Margem
                       ────→ Relatorio: Rentabilidade
```

---

## 3. Colunas de Custo em `composicao_financeira_os`

| Coluna | Origem | Descricao |
|--------|--------|-----------|
| `valor_cliente` | `alocacoes_escala.valor_frete` | Receita total do cliente |
| `valor_prestador` | `alocacoes_escala.valor_repasse` | Base de pagamento ao prestador |
| `pedagio_valor` | `alocacoes_escala.valor_pedagio` | Custos de pedagio |
| `combustivel_valor` | `alocacoes_escala.valor_combustivel` | Combustivel (NOVO Missao 02) |
| `ajudante_valor` | `alocacoes_escala.valor_ajudante` | Ajudante (NOVO Missao 02) |
| `adicional_valor` | `alocacoes_escala.valor_adicional` | KM excedente + saidas + diarias extras (NOVO) |
| `desconto_valor` | `alocacoes_escala.valor_desconto` | Descontos aplicados (NOVO Missao 02) |
| `outros_custos` | Calculado | combustivel + ajudante + adicional - desconto |
| `imposto_valor` | `valor_cliente * 4.5%` | PIS/COFINS/ISS estimado |
| `seguro_valor` | `valor_cliente * 1%` | Seguro de carga estimado |
| `margem_bruta` | Calculado | `valor_cliente - valor_prestador - pedagio - outros_custos` |
| `margem_liquida` | Calculado | `margem_bruta - imposto - seguro` |

---

## 4. Propagacao de Dados

```
alocacoes_escala (engineFinanceira)
  │
  ├── valor_frete ────────→ composicao.valor_cliente
  ├── valor_repasse ──────→ composicao.valor_prestador
  ├── valor_pedagio ──────→ composicao.pedagio_valor
  ├── valor_combustivel ──→ composicao.combustivel_valor ─┐
  ├── valor_ajudante ─────→ composicao.ajudante_valor    ├──→ outros_custos
  ├── valor_adicional ────→ composicao.adicional_valor    │
  └── valor_desconto ─────→ composicao.desconto_valor ────┘
```

---

*Documento gerado para Missao 02 — OpenCode Go Pro*
