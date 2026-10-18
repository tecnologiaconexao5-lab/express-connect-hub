# TMS-007.2 FASE 12 — Relatório Final de Cálculo

Data: 2026-07-28T14:05:01.159Z

## OS

ERROR: 400 Bad Request

## ALOCACAO

### Registro 1

`json
{
  "id": "09b7126a-7f68-48cf-aca1-72de65ff4fcc",
  "status": "cancelada",
  "status_pagamento": "cancelado",
  "finalizada": true,
  "valor_total": 70,
  "valor_frete": 100,
  "valor_repasse": 60,
  "observacoes_internas": "Cancelado via escala operacional",
  "metadata": {
    "hml": true,
    "origem": "TMS-007.2 HML Financeiro"
  }
}
`

## FINANCEIRO_RECEBER

### Registro 1

`json
{
  "id": "53e7ccb9-ab9e-4282-82bb-0e736487d99f",
  "descricao": "Faturamento OS-ALOC-20260728-09B7126A",
  "valor": 100,
  "status": "cancelada"
}
`

## FINANCEIRO_PAGAR

### Registro 1

`json
{
  "id": "df755520-4db1-4feb-97c3-6bd0f768fb60",
  "descricao": "Repasse OS-ALOC-20260728-654888B4",
  "valor": 60,
  "status": "cancelada"
}
`

## PAGAMENTOS_PRESTADORES

### Registro 1

`json
{
  "id": "534e674d-8c3d-4d69-abf7-cd818e88f06e",
  "valor_servicos": 60,
  "valor_liquido": 70,
  "status": "pendente",
  "status_pagamento": "cancelado",
  "status_conferencia": "cancelado"
}
`

## COMPOSICAO_FINANCEIRA

(empty — 0 registros)

## Resumo Financeiro

| Item | Valor | Status |
|------|-------|--------|
| Alocação (frete) | R$ 100 | cancelada |
| Alocação (repasse) | R$ 60 | cancelado |
| Alocação (total) | R$ 70 | — |
| FR: Faturamento OS-ALOC-20260728-09B7126A | R$ 100 | cancelada |
| FP: Repasse OS-ALOC-20260728-654888B4 | R$ 60 | cancelada |
| PP: 534e674d | R$ 70 | status=pendente, pgto=cancelado, conf=cancelado |

## Margens

| Cálculo | Valor |
|---------|-------|
| Faturamento (cliente) | R$ 100,00 |
| Custo (prestador) | R$ 60,00 |
| Margem bruta | R$ 40,00 (40%) |
| Adicionais | R$ 10,00 |
| Ajudante | R$ 5,00 |
| Descontos | R$ 5,00 |
| Total alocação | R$ 70,00 |
| Total líquido prestador | R$ 70,00 |
