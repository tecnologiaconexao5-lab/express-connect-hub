# MISSÃO 80 — Remoção Segura da Duplicidade Financeira (2026-07-05)

**Status:** ✅ Migration criada. TS limpo. Validação OK (tsc 0 erros, build 38,58s).

---

## 1. Problema Resolvido

Antes da M80, a persistência financeira era feita por **duas camadas concorrentes**:

| Caminho | Origem | Tabelas escritas | Problema |
|---------|--------|-----------------|----------|
| Trigger M66 (SQL) | `alocacoes_escala` | ordens_servico, financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os | ✅ Correto |
| `sincronizarFinanceiroOS()` (TS) | `ordens_servico` | financeiro_receber, pagamentos_prestadores, composicao_financeira_os | ❌ Duplicata com M66 |
| `escalaService.cancelarAlocacao()` (TS) | manual | financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os | ❌ Duplicata com trigger |
| `salvarComposicaoFinanceira()` (TS) | `sincronizarFinanceiroOS` | composicao_financeira_os | ❌ Fórmula de margem diferente |

**Resultado**: Para uma OS com escala vinculada, até 3 escritas simultâneas nas mesmas linhas, com margens potencialmente divergentes.

---

## 2. O que foi feito

### 2.1 Migration SQL — `20260705_m80_remocao_duplicidade_financeira.sql`

**Arquivo**: `supabase/migrations/20260705_m80_remocao_duplicidade_financeira.sql`

| Item | Descrição |
|------|-----------|
| UNIQUE(os_id) em `financeiro_pagar` | `ALTER TABLE financeiro_pagar ADD CONSTRAINT uq_fp_os_id UNIQUE (os_id)` — Remove duplicatas existentes antes de aplicar |
| Colunas TEXT em `ordens_servico` | `ADD COLUMN IF NOT EXISTS cliente, prestador, placa_alocada` |
| Trigger `trg_propagar_financeiro_os` | Análogo ao M66, dispara em INSERT/UPDATE de colunas financeiras de `ordens_servico` |
| Função `f_trg_propagar_financeiro_os()` | Propaga para 4 tabelas com `ON CONFLICT (os_id) DO UPDATE` |
| Fórmula unificada de margem | `outros_custos = adicionais + ajudante - descontos` |

#### Trigger OS — comportamento

```
ordens_servico (INSERT/UPDATE de valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, status)
  │
  └── ⚡ trg_propagar_financeiro_os (M80)
        ├── financeiro_receber       (INSERT ON CONFLICT DO UPDATE)
        ├── financeiro_pagar         (INSERT ON CONFLICT DO UPDATE)
        ├── pagamentos_prestadores   (INSERT ON CONFLICT DO UPDATE)
        └── composicao_financeira_os (INSERT ON CONFLICT DO UPDATE, apenas na finalização)
```

#### Fórmula unificada de margem (M80):

```
outros_custos = adicionais + ajudante - descontos
margem_bruta = valor_cliente - custo_prestador - pedagio - outros_custos
margem_liquida = margem_bruta - imposto(4.5%) - seguro(1%)
```

### 2.2 TypeScript removido/desativado

| O quê | Arquivo | Ação |
|-------|---------|------|
| `sincronizarFinanceiroOS()` | `ordemServicoService.ts` | Corpo substituído por no-op (log + return sucesso) |
| Caller em `OrdemServicoForm.tsx:682` | `OrdemServicoForm.tsx` | Removido `Promise.all` com `sincronizarFinanceiroOS` |
| Caller em `finalizarOrdemServico():283` | `ordemServicoService.ts` | Removido — trigger OS cuida |
| Caller fire-and-forget em `sincronizarOSEscala():541` | `ordemServicoService.ts` | Removido — trigger OS cuida |
| `salvarComposicaoFinanceira()` | `composicaoFinanceiraService.ts` | Removida (corpo substituído por comentário) |
| Cancelamento financeiro em `escalaService.cancelarAlocacao():478-509` | `escalaService.ts` | Removido — trigger `trg_cancelar_financeiro_escala` cuida |
| `state financeiroSincronizado` + badge "Auto" | `OrdemServicoForm.tsx` | Removido (não mais relevante) |

### 2.3 TypeScript mantido (apenas leitura/cálculo)

| O quê | Arquivo | Motivo |
|-------|---------|--------|
| `calcularComposicaoFinanceira()` | `composicaoFinanceiraService.ts` | Função pura, não escreve no banco. Marcada `@deprecated` |
| `verificarDuplicidadeFinanceira()` | `ordemServicoService.ts` | Apenas leitura (SELECT COUNT) |
| `buscarComposicaoFinanceira()` | `composicaoFinanceiraService.ts` | Apenas leitura |
| `ContasReceberEnterprise.tsx` (escrita manual) | UI Financeiro | Operação manual do usuário (lançar recebível, baixar) |
| `ContasPagar.tsx` (escrita manual) | UI Financeiro | Operação manual do usuário |
| `PagamentoPrestadores.tsx` (escrita manual) | UI Financeiro | Operação manual do usuário |
| `actionEngineService.ts` COM_REGISTRAR_PAGAMENTO | IA | Ação intencional da IA |

---

## 3. Estado Final dos Triggers

| Trigger | Tabela fonte | Tabelas destino | Quando |
|---------|-------------|-----------------|--------|
| `trg_propagar_financeiro_alocacao` (M66) | `alocacoes_escala` | financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os, ordens_servico | INSERT/UPDATE de colunas financeiras da escala |
| `trg_propagar_financeiro_os` (M80) | `ordens_servico` | financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os | INSERT/UPDATE de colunas financeiras da OS |
| `trg_cancelar_financeiro_escala` (M02.1) | `alocacoes_escala` | financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os | UPDATE status → 'cancelada' na escala |

**Como a duplicidade é evitada**: Ambos os triggers (M66 e M80) usam `ON CONFLICT (os_id) DO UPDATE` em todas as 4 tabelas financeiras. Se M66 já escreveu (via escala), M80 apenas atualiza com os mesmos valores (via OS). As 4 tabelas têm UNIQUE(os_id) — garantia de registro único por OS.

### Proteções contra duplicidade

| Tabela | UNIQUE(os_id) | Trigger usa ON CONFLICT |
|--------|---------------|------------------------|
| `financeiro_receber` | ✅ `uq_fr_os_id` (M02) | ✅ M66 e M80 |
| `financeiro_pagar` | ✅ **`uq_fp_os_id` (M80 — NOVO)** | ✅ M66 e M80 |
| `pagamentos_prestadores` | ✅ `uq_pp_os_id` (M02) | ✅ M66 e M80 |
| `composicao_financeira_os` | ✅ `uq_composicao_os` (hardening) | ✅ M66 e M80 |

---

## 4. Riscos Restantes

| Risco | Gravidade | Descrição | Mitigação |
|-------|-----------|-----------|-----------|
| Trigger OS dispara em cascata com M66 | Baixa | M66 escreve em `ordens_servico`, o que dispara o trigger OS novamente | `ON CONFLICT DO UPDATE` — valores são os mesmos, sem duplicação |
| OS sem `cliente_id`/`prestador_id` (UUID) | Baixa | Trigger tenta lookup mas falha | TRY/EXCEPTION + fallback para `NEW.cliente`/`NEW.prestador` (TEXT) |
| `financeiro_pagar` duplicatas preexistentes | Média | Migration remove duplicatas mantendo o registro mais recente | `DELETE + HAVING COUNT(*) > 1` antes de aplicar UNIQUE |
| UI manual (ContasReceber) sobrescreve dados do trigger | Média | Usuário pode editar manualmente um título gerado pelo trigger | Comportamento esperado — UI manual tem prioridade |
| IA registra pagamento sem disparar trigger | Baixa | `actionEngineService.ts:980` insere direto em `financeiro_receber` sem atualizar OS | Ação intencional da IA (não é propagação automática) |

---

## 5. Validação

- `npx tsc --noEmit` → ✅ 0 erros
- `npm run build` → ✅ 38,58s
- Teste pendente (requer Supabase real):
  - Criar OS standalone → verificar financeiro_receber criado
  - Criar escala → verificar financeiro_receber criado
  - Finalizar OS → verificar composicao_financeira_os criada
  - Cancelar OS → verificar financeiro_receber cancelado
  - Verificar que `financeiro_pagar` não tem duplicatas por os_id

---

## 6. Recomendação para Missão 81

1. **Remover `sincronizarFinanceiroOSAlocacao()`** — função já sem callers desde M76, corpo pode ser removido
2. **Remover `buscarTabelaPrestador()` e `calcularValorPrestador()`** do `composicaoFinanceiraService.ts` — engine de precificação as substitui
3. **Remover `engineFinanceira.ts`** e `calculoService.ts` inteiros — já marcados `@deprecated`
4. **Remover `calcularComposicaoFinanceira()`** — engine de precificação calcula margem
5. **Atualizar `actionEngineService.ts:980`** para gravar via `ordens_servico` em vez de direto em `financeiro_receber`
6. **Adicionar índice** em `financeiro_receber.os_id`, `financeiro_pagar.os_id` e `pagamentos_prestadores.os_id` para acelerar as queries dos triggers

---

## 7. Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/20260705_m80_remocao_duplicidade_financeira.sql` | **NOVO** — trigger OS + UNIQUE financeiro_pagar |
| `src/services/ordemServicoService.ts` | sincronizarFinanceiroOS → no-op; removidos callers em finalizarOrdemServico e sincronizarOSEscala; import limpo |
| `src/services/escala/escalaService.ts` | Removido bloco de cancelamento financeiro (478-509) |
| `src/components/operacao/OrdemServicoForm.tsx` | Removido import + chamada sincronizarFinanceiroOS; removido state financeiroSincronizado |
| `src/services/financeiro/composicaoFinanceiraService.ts` | Removido salvarComposicaoFinanceira; calcularComposicaoFinanceira → deprecated |
| `MISSAO80_REMOCAO_DUPLICIDADE_FINANCEIRA.md` | **NOVO** — este relatório |
