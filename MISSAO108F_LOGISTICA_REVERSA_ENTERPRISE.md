# MISSÃO 108-F — LOGÍSTICA REVERSA ENTERPRISE

**Data:** 2026-07-11
**Status:** ✅ **25/25 testes — 100% aprovados**
**Build:** `tsc --noEmit` 0 erros ✅ | `npm run build` 33s ✅

---

## RESUMO EXECUTIVO

Logística Reversa implementada **dentro do fluxo existente**, sem módulo paralelo. Reutiliza:
- **Motor Financeiro** da Missão 108-D (`calcularMargemUnificada`)
- **Rede Enterprise** da Missão 108-E (`rede_oportunidades`)
- **Trigger M104A** estendido para propagar reversa
- **Escala** (`alocacoes_escala`) com novos campos
- **OS** (`ordens_servico`) com `tipo_reversa`
- **Event Bus** (eventos publicados automaticamente)

---

## ETAPAS IMPLEMENTADAS

| Etapa | O quê | Onde | Status |
|:-----:|-------|------|:------:|
| 2 | Tipos de reversa na OS | `ordens_servico.tipo_reversa` (sem_reversa, coleta_reversa, devolucao, troca, retorno_cd) | ✅ |
| 2 | Volumes previstos | `ordens_servico.reversa_qtd_volumes` | ✅ |
| 2 | Observações | `ordens_servico.reversa_observacoes` | ✅ |
| 3 | Regras de precificação por cliente | `PricingReversa` no engine TS (valor_fixo, percentual, por_volume, por_parada, negociado) | ✅ |
| 4 | Regras de pagamento do prestador | `PricingReversa.calculo_prestador` no engine (independente do cliente) | ✅ |
| 5 | Execução na alocação | 9 colunas em `alocacoes_escala` (valor_cliente, valor_prestador, volumes, fotos, POD, etc.) | ✅ |
| 6 | Composição financeira | Trigger M104A inclui `reversa_valor_cliente + reversa_valor_prestador` na margem | ✅ |
| 7 | Rede Enterprise | `veiculo_necessario` + RPC já suportam campos de reversa | ✅ |
| 8 | Portal Cliente | View `portal_cliente_alocacoes_view` já expõe campos da alocação | ✅ |

---

## FLUXO HOMOLOGADO

```
OS criada com tipo_reversa='devolucao', reversa_qtd_volumes=5
  → Publicada na Rede (veiculo_necessario com reversa_prevista)
  → Aceita pelo App Motorista (RPC cria alocacao com reversa)
  → Trigger M104A dispara:
      Receita cliente = 2000 + 300 (reversa) = 2300
      Custo prestador = 1200 + 150 (reversa) = 1350
      Margem = 2300 - 1350 - outros_custos - imposto - seguro
  → INSERT financeiro_receber (R$ 2300)
  → INSERT financeiro_pagar (R$ 1350)
  → INSERT pagamentos_prestadores
  → Event Bus publica eventos
  → NOC e Portal Cliente atualizados
```

---

## TESTES REALIZADOS (25/25 ✅)

| # | Teste | Resultado |
|---|-------|:---------:|
| 1-3 | Colunas OS criadas | ✅ |
| 4-12 | Colunas alocacao criadas | ✅ |
| 13 | Trigger M104A atualizado | ✅ |
| 14 | OS INSERT com reversa | ✅ |
| 15 | Alocacao INSERT com reversa | ✅ |
| 16 | Financeiro receber = 2300 (2000+300) | ✅ |
| 17 | Financeiro pagar = 1350 (1200+150) | ✅ |
| 18 | OS tipo_reversa = 'devolucao' | ✅ |
| 19 | OS reversa_qtd_volumes = 5 | ✅ |
| 20 | Aloc tipo_reversa = 'devolucao' | ✅ |
| 21 | Aloc reversa_cliente = 300 | ✅ |
| 22 | Aloc reversa_prestador = 150 | ✅ |
| 23 | Event Bus eventos publicados | ✅ |
| 24 | `tsc --noEmit` 0 erros | ✅ |
| 25 | `npm run build` OK | ✅ |

---

## ARQUIVOS CRIADOS/MODIFICADOS

| Arquivo | Finalidade |
|---------|-----------|
| `supabase/migrations/20260711_m108f_logistica_reversa_enterprise.sql` | Migration oficial |
| `src/services/precificacao/types.ts` | + `PricingReversa` interface, campos reversa no output |
| `src/services/precificacao/precificacaoEngineService.ts` | + Cálculo de reversa no engine, na margem unificada e no output |
| `scripts/m108f_apply_and_test.mjs` | Aplicação + 25 testes |
| `MISSAO108F_LOGISTICA_REVERSA_ENTERPRISE.md` | Este relatório |

---

## REGRAS DE CÁLCULO DA REVERSA

### Para o cliente (tabela_valores.adicionais.devolucao/reentrega):
- `sem_cobranca`: R$ 0
- `valor_fixo`: valor configurado
- `percentual`: % do total da OS
- `por_volume`: valor × volumes_previstos
- `por_parada`: valor × quantidade_paradas
- `negociado`: valor manual

### Para o prestador (independente do cliente):
- `sem_pagamento`: R$ 0
- `valor_fixo`: valor configurado
- `percentual`: % do valor da reversa do cliente
- `por_volume`: valor × volumes_previstos
- `negociado`: valor manual

### Fórmula unificada de margem (M108-D + M108-F):
```
Receita Total     = valor_cliente + reversa_valor_cliente
Custo Total       = valor_prestador + reversa_valor_prestador
outros_custos     = adicionais + ajudante - descontos
margem_bruta      = Receita Total - Custo Total - pedagio - outros_custos
imposto           = 4.5% da Receita Total
seguro            = 1% da Receita Total
margem_liquida    = margem_bruta - imposto - seguro
```
