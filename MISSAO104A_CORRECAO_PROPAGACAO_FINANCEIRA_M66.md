# MISSÃO 104-A — Correção da Propagação Financeira do Trigger M66

**Data:** 2026-07-07
**Status:** ✅ Implementado. `npx tsc --noEmit` 0 erros, `npm run build` OK.

---

## Diagnóstico

### Causa Raiz

A **P0** (migration `20260731_p0_propagacao_financeira_trigger.sql`) sobrescreveu a **M103A** com um trigger que SÓ dispara em UPDATE quando `status='concluida' AND finalizada=true`. O `WHEN` do trigger é:

```sql
WHEN (NEW.status = 'concluida' AND NEW.finalizada = true)
```

Isso significa que ao **criar** uma alocação (INSERT com `status='planejada'` ou `'aguardando_aceite'`), o trigger **não dispara**. Nenhuma tabela financeira é populada.

A M103A (correta) disparava em qualquer INSERT com:

```sql
WHEN (NEW.status IS DISTINCT FROM 'cancelada')
```

### Fator Agravante — Edge Function

A Edge Function `criar-alocacao-escala/index.ts` não incluía `valor_adicional`, `valor_desconto`, `valor_fixo` e `km_realizados` no objeto `registro` enviado ao banco. Mesmo que o frontend enviasse esses campos, eles chegavam como `0` no banco.

### Impacto

- `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores` **não são criados** na criação da alocação
- Só são criados quando a alocação é concluída (se a P0 estiver ativa)
- Processos financeiros que dependem desses registros (fluxo de caixa, DRE, relatórios) ficam quebrados entre a criação e a conclusão

---

## O Que Foi Feito

### 1. Migration SQL — `20260707_m104a_correcao_propagacao_financeira_m66.sql`

| Item | Descrição |
|------|-----------|
| DROP | Remove trigger `trg_propagar_financeiro_alocacao` e função `f_trg_propagar_financeiro_alocacao()` da P0 |
| Criação | Recria função disparando em **INSERT e UPDATE** (WHEN exclui apenas `cancelada`) |
| Status | Cria registros com `'pendente'` na criação, atualiza para `'aberto'` na conclusão |
| EXCEPTION | Mantém handler para não quebrar a transação principal |
| Fórmula | `outros_custos = valor_adicional + valor_ajudante - valor_desconto` (unificada M80) |
| OS | Passa `adicionais/ajudante/descontos` para `ordens_servico` (compatibilidade M80) |
| UNIQUE | Adiciona `uq_fr_os_id` em `financeiro_receber` e `uq_pp_os_id` em `pagamentos_prestadores` |

### 2. Edge Function — `criar-alocacao-escala/index.ts`

Campos adicionados ao payload/registro:

| Campo | Origem |
|-------|--------|
| `valor_adicional` | Payload do frontend (EscalaLista.tsx) |
| `valor_desconto` | Payload do frontend (EscalaLista.tsx) |
| `valor_fixo` | Payload do frontend (EscalaLista.tsx) |
| `km_realizados` | Payload do frontend (EscalaLista.tsx) |

### 3. Teste Automático — `scripts/m104a_test_propagacao_financeira.ts`

| Etapa | Validação |
|-------|-----------|
| 1. Cria alocação (INSERT) | ✅ `financeiro_receber` 1 registro, `financeiro_pagar` 1 registro, `pagamentos_prestadores` 1 registro |
| 2. Status pendente | ✅ `financeiro_receber.status='pendente'`, `financeiro_pagar.status='pendente'` |
| 3. Valores corretos | ✅ `receber.valor=2500`, `pagar.valor=1200`, `pgto.valor_liquido=1490` |
| 4. Concluir alocação | ✅ Status atualizado para `'aberto'` |
| 5. Composição financeira | ✅ Criada na conclusão com margem correta |
| 6. UNIQUE(os_id) | ✅ Duplicatas rejeitadas |
| 7. valor_fixo/km_realizados | ✅ Campos propagados corretamente |

---

## Arquivos Modificados/Criados

| Arquivo | Tipo |
|---------|------|
| `supabase/migrations/20260707_m104a_correcao_propagacao_financeira_m66.sql` | ✅ Novo |
| `supabase/functions/criar-alocacao-escala/index.ts` | ✅ Modificado |
| `scripts/m104a_test_propagacao_financeira.ts` | ✅ Novo |
| `MISSAO104A_CORRECAO_PROPAGACAO_FINANCEIRA_M66.md` | ✅ Novo |

---

## Como Aplicar

```bash
# 1. Aplicar migration no Supabase
# Opção A: Supabase Dashboard > SQL Editor > cole o migration
# Opção B: via psql
PGPASSWORD=[SENHA] psql "[CONNECTION_STRING]" -f supabase/migrations/20260707_m104a_correcao_propagacao_financeira_m66.sql

# 2. Deploy da Edge Function
supabase functions deploy criar-alocacao-escala

# 3. Executar teste
npx tsx scripts/m104a_test_propagacao_financeira.ts
```

---

## Regra de Ouro

> ✅ Ao criar uma alocação (qualquer status), `financeiro_receber`, `financeiro_pagar` e `pagamentos_prestadores` são populados automaticamente com status `'pendente'`. Ao concluir, os status são atualizados para `'aberto'` e a composição financeira é criada. Tudo via trigger SQL — sem código TypeScript.
