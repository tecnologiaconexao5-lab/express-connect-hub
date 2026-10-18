# TMS-006.4 — Criação Controlada de Alocação HML na Escala

**Data:** 2026-07-27
**Status:** ✅ ALOCAÇÃO HML CRIADA, VALIDADA E LIMPA — INTEGRAÇÃO APP AINDA PENDENTE
**Percentual:** 49% (neutro)

---

## FASE 1 — Pré-check

| Registro | Status | Alocações ativas | Financeiro |
|:---------|:------:|:----------------:|:----------:|
| OS TESTE-001 | pendente | 0 | 0 |
| Prestador M43 | ativo | 0 | 0 |
| Veículo HML001 | ativo | 0 | 0 |

## FASE 2-3 — Fluxo + Payload + Autorização

Payload com `ordem_servico_id`:

```
ordem_servico_id: 28640e7b-...  ← FK REAL (não apenas metadata)
prestador_id: 5377592a-...
data_escala: 2026-07-27
status: aguardando_aceite
tipo_veiculo: moto | placa: HML001
cliente_id: null
valor_frete: 0 | valor_repasse: 0
metadata: { os: "TESTE-001", ordem_servico_id, hml_test: "TMS-0064" }
```

Autorizado pelo usuário.

## FASE 4 — Efeitos Esperados

| Efeito | Esperado | Ocorreu |
|:-------|:--------:|:-------:|
| Alocação criada em `alocacoes_escala` | 1 registro | ✅ |
| `ordem_servico_id` = UUID da OS | FK real | ✅ |
| `prestador_id` correto | UUID do M43 | ✅ |
| `placa` = HML001 | identificador | ✅ |
| `cliente_id` = null | sem cliente | ✅ |
| `valor_frete` = 0 | zero | ✅ |
| `valor_repasse` = 0 | zero | ✅ |
| `metadata.os` = TESTE-001 | auxiliar | ✅ |
| `metadata.ordem_servico_id` | preservado | ✅ |
| Trigger financeiro | não criou (valores 0) | ✅ |
| Cleanup | DELETE por ID | ✅ |

## FASE 5 — Criação

**Via Edge Function `criar-alocacao-escala`** (mesmo caminho da UI).

Resultado: ID `6e66afad-7354-4571-a8ad-8c8124d3327d` — HTTP 201.

## FASE 6 — Validação

### 9/9 checks aprovados

| Check | Resultado |
|:------|:---------:|
| ordem_servico_id = OS_ID | ✅ |
| prestador_id = PRES_ID | ✅ |
| placa = HML001 | ✅ |
| tipo_veiculo = moto | ✅ |
| cliente_id = null | ✅ |
| valor_frete = 0 | ✅ |
| valor_repasse = 0 | ✅ |
| metadata.os = TESTE-001 | ✅ |
| metadata.ordem_servico_id | ✅ |

## FASE 7 — Realtime

Não comprovado — requer duas janelas simultâneas ou subscription observável.

## FASE 8 — Cancelamento

Cancelamento direto (via UPDATE) falhou com erro `motivo_cancelamento` não encontrado — coluna não existe. A alocação foi removida no cleanup.

## FASE 9 — Cleanup

| Operação | Resultado |
|:---------|:---------:|
| DELETE alocação (6e66afad) | ✅ |
| Prestador alocações ativas restantes | 0 |
| Veículo HML001 alocações restantes | 0 |
| OS TESTE-001 status | pendente ✅ |

## FASE 10 — Testes Negativos

Não executados — risco de poluir dados ou bloquear fluxo real.

## FASE 11 — TypeScript + Build

| Comando | Resultado |
|:--------|:---------:|
| `npx vitest run` | 31/31 ✅ |
| `npm run build` | OK (52.63s) ✅ |
| typecheck: EscalaLista.tsx | 0 erros |

## Correções no Componente

`src/components/operacao/EscalaLista.tsx` (4 edições):

| O quê | Detalhe |
|:------|:--------|
| State `novaOSId` | UUID da OS selecionada |
| SearchableSelect onChange | Agora captura `record.id` (2º parâmetro) |
| Payload `ordem_servico_id` | Enviado para a Edge Function |
| Metadata `ordem_servico_id` | Preservado para round-trip |
| Reset do state | `novaOSId("")` no clear + edit |

## Limitações Conhecidas

| Limitação | Impacto |
|:----------|:--------|
| Cancelamento via UPDATE falha (`motivo_cancelamento`) | Usar `escalaService.cancelarAlocacao()` |
| OS vinculada via FK mas não via dropdown (input livre na UI atual) | Já corrigido: agora captura UUID |
| Realtime não comprovado | Requer teste manual com 2 janelas |
| UI test via Playwright | Modal com custom dropdowns muito complexo |

## Conclusão

```
ALOCAÇÃO HML CRIADA, VALIDADA E LIMPA —
INTEGRAÇÃO APP AINDA PENDENTE

9/9 validações aprovadas:
  ✅ FK ordem_servico_id = 28640e7b
  ✅ prestador_id = 5377592a
  ✅ placa HML001 | tipo moto
  ✅ cliente NULL | valores 0
  ✅ metadata preservada
  ✅ cleanup completo

Estado final: todos os registros HML intactos.
```
