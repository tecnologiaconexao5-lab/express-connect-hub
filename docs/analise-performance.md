# Análise de Performance — Express Connect Hub / TMS

> Auditoria: 2026-06-26 | Foco: Queries, Índices, Caching, Concorrência

---

## 1. Índices Faltantes (Alto Impacto)

### Financeiro (P1)
| Tabela | Índice Recomendado | Query Afetada |
|--------|-------------------|---------------|
| `financeiro_receber` | `(cliente_id, status)` | `inadimplenciaService.verificarInadimplenciaCliente()` |
| `financeiro_receber` | `(data_vencimento, status)` | Dashboard aging, relatórios |
| `financeiro_receber` | `(os_id)` | `sincronizarFinanceiroOS()` dedup |
| `financeiro_pagar` | `(fornecedor_id, status)` | Contas a pagar por prestador |
| `pagamentos_prestadores` | `(prestador_id, status_pagamento)` | Status de pagamento |
| `pagamentos_prestadores` | `(os_id)` | Dedup |

### Operação (P1)
| Tabela | Índice Recomendado | Query Afetada |
|--------|-------------------|---------------|
| `ordens_servico` | `(prestador_id, status)` | OS por prestador |
| `ordens_servico` | `(cliente_id, status)` | OS por cliente |
| `ordens_servico` | `(status_faturamento, status_pagamento)` | Filtro financeiro |
| `portal_pedidos` | `(os_vinculada_id)` | Join com OS |
| `contratos_historico` | `(contrato_id)` | Histórico por contrato |

### Escala (P1)
| Tabela | Índice Recomendado | Query Afetada |
|--------|-------------------|---------------|
| `alocacoes_escala` | `(prestador_id, data_escala, status)` | `verificarConflitoPrestador()` |

---

## 2. Padrões de Query Ineficientes

### 2.1 N+1 Queries
O padrão mais comum no código é:
```typescript
const { data: os } = await supabase.from("ordens_servico").select("*");
for (const o of os) {
  const { data: alocacoes } = await supabase.from("alocacoes_escala").select("*").eq("ordem_servico_id", o.id);
  // processa cada OS individualmente
}
```
Presente em: `EscalaLista.tsx`, `OrdensServicoLista.tsx`, `TorreControle.tsx`

**Recomendação:** Usar `.select("*, alocacoes_escala(*)")` com join implícito ou `.in("ordem_servico_id", ids)`.

### 2.2 Select * sem filtro
```typescript
const { data } = await supabase.from("ordens_servico").select("*");
```
Sem paginação, sem filtro de data. Presente em múltiplos componentes.

**Recomendação:** Adicionar `.limit()`, `.order()`, e filtro de data.

### 2.3 Queries sem índice de suporte
- `inadimplenciaService.ts:31`: `WHERE cliente_id = X AND status IN (...)` — sem índice composto
- `escalaService.ts:634`: `WHERE prestador_id = X AND data_escala = X AND status IN (...)` — sem índice composto
- `ordemServicoService.ts:200`: `WHERE os_id = X` em `financeiro_receber` — `os_id` é TEXT e sem índice

---

## 3. Concorrência e Race Conditions

### 3.1 Escrita dupla Trigger SQL + TypeScript (P0)
Quando `alocacao.status = 'concluida' AND finalizada = true`:
1. **TypeScript** (`ordemServicoService.ts:149`): `sincronizarFinanceiroOS()` faz select → upsert
2. **Trigger SQL** (`20260731`): `f_trg_propagar_financeiro_alocacao` faz PERFORM → INSERT/UPDATE

Ambos disparam **concorrentemente** e escrevem nas mesmas 4 tabelas. Sem lock ou transação coordenada.

### 3.2 Read-then-write sem lock (P1)
- `composicaoFinanceiraService.ts:267-321`: select → check exists → insert/update
- `ordemServicoService.ts:200-237`: mesmo padrão para `financeiro_receber`
- `ordemServicoService.ts:260-286`: mesmo padrão para `pagamentos_prestadores`

Sem `SELECT ... FOR UPDATE` ou unique constraint, duas chamadas simultâneas podem inserir duplicatas.

### 3.3 Cache em localStorage (P2)
`useEscala.ts:84-95` — fallback para `localStorage` quando Supabase falha. Cache stale pode mascarar erros silenciosamente.

---

## 4. Realtime Subscriptions

### 4.1 `useEscalaRealtime.ts` (P2)
- Assina `postgres_changes` com `event: '*'` — todos os eventos
- Sem filtro por tabela, coluna, ou condição
- Callback simples sem diff do que mudou
- Usado no `AppPrestador.tsx` para atualizações em tempo real

### 4.2 `TorreControle.tsx:218`
- Assinatura própria do Supabase realtime
- Sem compartilhamento com `useEscalaRealtime` — duas subscriptions para a mesma tabela

---

## 5. Tamanho de Payload

### 5.1 `memoriaService.montarContextoCompleto()` (P2)
5 queries paralelas para montar contexto de memória:
```typescript
await Promise.all([
  buscarEntidade(),
  listarPreferencias(),
  listarEventos(),
  listarConversas(),
  obterResumoAtual(),
  buscarConhecimentoGlobal(),
]);
```
6 queries paralelas por chamada. Com 8 robôs ativos, pode gerar 48 queries simultâneas.

---

## 6. Caching

### 6.1 Sem cache de configuração
- `configuracoes_sistema` é consultada em múltiplos componentes sem cache
- `ia_providers_config` (LLM providers) consultada a cada chamada de IA

### 6.2 Cache indevido
- `localStorage` usado como cache em 7 serviços (chaves de API inclusive)
- `useEscala.ts` cacheia dados de escala em localStorage como fallback

---

## 7. Recomendações

| # | Ação | Impacto |
|---|------|---------|
| 1 | Criar índices compostos nas 11 tabelas listadas | **Alto** — queries de inadimplência e conflito |
| 2 | Adicionar `UNIQUE (os_id)` em `financeiro_receber` e `composicao_financeira_os` | **Crítico** — previne duplicatas |
| 3 | Resolver escrita dupla Trigger vs TypeScript | **Crítico** — race condition |
| 4 | Implementar paginação em listas (`.limit().range()`) | Médio |
| 5 | Usar joins em vez de N+1 queries | Médio |
| 6 | Adicionar `React Query` cache para configurações | Baixo |
| 7 | Consolidar subscriptions realtime | Baixo |

---

## 8. Classificação

| Categoria | P0 | P1 | P2 |
|-----------|----|----|-----|
| Índices faltantes | 0 | 11 | 0 |
| Race condition | 1 | 0 | 0 |
| Read-then-write sem lock | 0 | 3 | 0 |
| N+1 queries | 0 | 0 | 3 |
| Cache inadequado | 0 | 0 | 2 |
| Realtime duplicado | 0 | 0 | 2 |
| Payload pesado | 0 | 0 | 1 |
| **Total** | **1** | **14** | **8** |

---

*Documento gerado por auditoria de performance automatizada — OpenCode Go Pro*
