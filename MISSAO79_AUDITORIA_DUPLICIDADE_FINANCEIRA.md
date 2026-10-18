# MISSÃO 79 — Auditoria Final de Duplicidade Financeira (2026-07-05)

**Status:** ✅ Auditoria concluída. 5 riscos identificados. Recomendação técnica emitida.

---

## 1. Mapa de Escritores por Tabela

### `alocacoes_escala` (colunas financeiras: valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_desconto)

| Quem | Onde | Como |
|------|------|------|
| `EscalaLista.tsx:930` | TSX | `supabase.from("alocacoes_escala").update(payload)` — UI direta do usuário |
| `ordemServicoService.sincronizarOSEscala():788` | TS | `supabase.from("alocacoes_escala").update(...)` — sincroniza OS → escala |
| `actionEngineService.ts:1040` | TS | `INSERT` via IA (COM_CRIAR_ESCALA) |

### `ordens_servico` (colunas financeiras: valor_cliente, custo_prestador, pedagio)

| Quem | Onde | Como |
|------|------|------|
| `OrdemServicoForm.tsx:656` | TSX | `supabase.from("ordens_servico").insert/update` — UI direta |
| `OrcamentoForm.tsx:466` | TSX | `supabase.from("ordens_servico").insert` |
| `ordemServicoService.finalizarOrdemServico():527` | TS | `UPDATE status, custo_prestador` |
| `ordemServicoService.sincronizarOSEscala():788` | TS | `UPDATE` — puxa dados da escala para a OS |
| **Trigger M66** (M66) | SQL | `INSERT ON CONFLICT DO UPDATE` — cria OS automaticamente a partir da escala |

### `financeiro_receber`

| Quem | Onde | Como | Gatilho |
|------|------|------|---------|
| `sincronizarFinanceiroOS():207-236` | TS | check-then-insert/update | OS salva/finalizada |
| **Trigger M66** (M66) | SQL | check-then-insert/update | escala salva/alterada |
| `escalaService.cancelarAlocacao():482` | TS | `UPDATE status=cancelado` | escala cancelada manual |
| **Trigger Cancelamento** (M02.1) | SQL | `UPDATE` on status=cancelada | escala cancelada |
| `ContasReceberEnterprise.tsx:344-955` | TSX | INSERT/UPDATE manual | UI do usuário (manual) |
| `ContasReceber.tsx:546-635` | TSX | INSERT/UPDATE manual | UI do usuário (manual) |
| `actionEngineService.ts:980` | TS | INSERT (IA) | COM_REGISTRAR_PAGAMENTO |

### `financeiro_pagar`

| Quem | Onde | Como | Gatilho |
|------|------|------|---------|
| **Trigger M66** (M66) | SQL | check-then-insert/update | escala salva/alterada |
| `sincronizarFinanceiroOS():338-353` | TS | `UPDATE valor=0, status=cancelado` **apenas no cancelamento** | OS cancelada |
| `escalaService.cancelarAlocacao():488` | TS | `UPDATE status=cancelado` | escala cancelada manual |
| **Trigger Cancelamento** (M02.1) | SQL | `UPDATE` on status=cancelada | escala cancelada |
| `ContasPagar.tsx:521-596` | TSX | INSERT/UPDATE manual | UI do usuário (manual) |

### `pagamentos_prestadores`

| Quem | Onde | Como | Gatilho |
|------|------|------|---------|
| `sincronizarFinanceiroOS():258-336` | TS | check-then-insert/update | OS salva/finalizada |
| **Trigger M66** (M66) | SQL | check-then-insert/update | escala salva/alterada |
| `escalaService.cancelarAlocacao():494` | TS | `UPDATE status=cancelado` | escala cancelada manual |
| **Trigger Cancelamento** (M02.1) | SQL | `UPDATE` on status=cancelada | escala cancelada |
| `PagamentoPrestadores.tsx:470-2231` | TSX | INSERT/UPDATE manual | UI do usuário (manual) |

### `composicao_financeira_os`

| Quem | Onde | Como | Gatilho |
|------|------|------|---------|
| `salvarComposicaoFinanceira()` → chamado por `sincronizarFinanceiroOS():399` | TS | check-then-insert/update | OS salva/finalizada (sempre) |
| **Trigger M66** (M66) | SQL | `INSERT ON CONFLICT (os_id) DO UPDATE` | escala **concluída** apenas |
| `escalaService.cancelarAlocacao():500` | TS | `UPDATE zerar campos` | escala cancelada manual |
| **Trigger Cancelamento** (M02.1) | SQL | `UPDATE zerar campos` | escala cancelada |

---

## 2. Diagrama de Fluxo — OS com Escala Vinculada

```
OrdemServicoForm salva OS (656)
  │
  ├── supabase.from("ordens_servico").insert/update (656-657)
  │
  └── Promise.all([
        │
        ├── sincronizarComEscala(dadosSync) (682)
        │     │
        │     ├── supabase.from("alocacoes_escala").update (sincronizarOSEscala:788)
        │     │     │
        │     │     └── ⚡ TRIGGER M66 DISPARA (M66:297)
        │     │           ├── ordens_servico (INSERT ON CONFLICT)
        │     │           ├── financeiro_receber (check-then-insert)
        │     │           ├── financeiro_pagar (check-then-insert)
        │     │           ├── pagamentos_prestadores (check-then-insert)
        │     │           └── composicao_financeira_os (se concluída: INSERT ON CONFLICT)
        │     │
        │     └── sincronizarFinanceiroOS fire-and-forget (800) ← TERCEIRO WRITE
        │           ├── financeiro_receber (check-then-insert)
        │           ├── pagamentos_prestadores (check-then-insert)
        │           ├── composicao_financeira_os (sempre via salvarComposicaoFinanceira)
        │           └── financeiro_pagar (só se cancelada)
        │
        └── sincronizarFinanceiroOS(dadosSync) (684) ← PRIMEIRO WRITE
              ├── financeiro_receber (check-then-insert)
              ├── pagamentos_prestadores (check-then-insert)
              ├── composicao_financeira_os (sempre via salvarComposicaoFinanceira)
              └── financeiro_pagar (só se cancelada)
      ])
```

**Total: até 3 escritas simultâneas** para `financeiro_receber` e `pagamentos_prestadores` no mesmo ciclo de salvamento de OS.

---

## 3. Análise do Trigger M66

### Cobertura
- **Fonte**: `alocacoes_escala` — INSERT ou UPDATE em `status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_desconto`
- **Propaga para**: `ordens_servico`, `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os`
- **Proteção**: pula `status='cancelada'` (delega para outro trigger)

### Limites
- ❌ **Não cobre OS sem escala vinculada** — standalone OS não dispara M66
- ❌ **`composicao_financeira_os` apenas na conclusão** — OS sem escala concluída não tem composição via trigger
- ❌ **Fórmula de margem simplificada** — usa `valor_adicional` como único custo adicional; ignora `valor_combustivel`, `valor_ajudante` que estão em `alocacoes_escala` no banco real

### Fórmulas usadas pelo M66:

```
v_valor_liquido = valor_repasse + valor_pedagio + valor_adicional - valor_desconto

-- composicao_financeira_os (só na conclusão):
outrosCustos = valor_adicional  ← ignora combustivel, ajudante
margem_bruta = valor_frete - valor_repasse - pedagio - valor_adicional
margem_liquida = margem_bruta - imposto - seguro
imposto = valor_frete * 4.5%
seguro = valor_frete * 1%
```

---

## 4. Análise de `sincronizarFinanceiroOS()`

### Cobertura
- **Fonte**: Dados da OS (`ordens_servico` ou payload do form)
- **Propaga para**: `financeiro_receber`, `pagamentos_prestadores`, `composicao_financeira_os`, `financeiro_pagar` (só cancelamento)
- **Quando**: Chamado após salvar OS (via form), finalizar OS, ou sincronizar OS←escala

### Limites
- ❌ **Idempotente via check-then-insert**, mas sem ON CONFLICT — race condition pode gerar UNIQUE violation
- ❌ **Não usa ON CONFLICT** — usa SELECT + INSERT/UPDATE separados
- ❌ **Fórmula de margem diferente do M66** — agrega `combustivel + ajudante + adicional - desconto` de escalas vinculadas, enquanto M66 usa só `adicional`

### Fórmulas usadas por `sincronizarFinanceiroOS()`:

```
outrosCustos = SUM(escalas: combustivel + ajudante + adicional - desconto)
margem_bruta = valor_cliente - valor_prestador - pedagio - outrosCustos
margem_liquida = margem_bruta - imposto - seguro
imposto = valor_cliente * 4.5%
seguro = valor_cliente * 1%
```

---

## 5. Análise do Engine (`calcularPreco`)

### Preview mode (atual)
- `calcularPreco(modo: "preview")` — **só calcula, não persiste**
- `calcularPrecoRapido()` — **só calcula a partir de tabela em memória, não persiste**
- Chamado por: `OrdemServicoForm.recalcularValores()`, `EscalaLista.calcularTotalAlocacao()`, `OrcamentoForm`
- Usado exclusivamente para **exibição/preview** no frontend

### Efetivar mode (P5 — planejado)
- `calcularPreco(modo: "efetivar")` — **deve persistir valores calculados**
- Ainda não implementado

### Fórmulas usadas pelo engine:
```
valorCliente = valor_base + km_excedente * valor_km_excedente (+ adicionais: espera, etc.)
valorPrestador = diária + km_excedente * valor_km
margem_bruta = valorCliente - valorPrestador
margem_liquida = margem_bruta - impostos - seguros
```

**Nota**: O engine calcula margem **antes** dos adicionais operacionais (pedágio, combustível, ajudante) — diferente do M66 e sincronizarFinanceiroOS que os incluem.

---

## 6. Riscos Identificados

### Risco 1 — Race condition entre M66 e `sincronizarFinanceiroOS` (GRAVIDADE: MÉDIA)

**Cenário**: OS com escala vinculada salva via `OrdemServicoForm.tsx`.

`Promise.all` dispara `sincronizarComEscala` e `sincronizarFinanceiroOS` em paralelo. `sincronizarComEscala` atualiza a escala → M66 dispara → ambos escrevem nas mesmas tabelas.

**Ordem não-determinística**. Último write vence.

**Impacto**: Se OS e escala têm valores diferentes, o resultado final depende de qual escreveu por último. Dados podem ficar inconsistentes entre as tabelas.

**Mitigação atual**: Ambas as fontes (OS e escala) usam os mesmos valores na prática (o form calcula uma vez e salva nos dois lugares). Risco real apenas se usuário editar escala separadamente após criar OS.

### Risco 2 — Margem divergente entre M66 e `sincronizarFinanceiroOS` (GRAVIDADE: ALTA)

| Componente | `outrosCustos` |
|------------|----------------|
| M66 trigger | `valor_adicional` (1 campo) |
| `sincronizarFinanceiroOS` | `combustivel + ajudante + adicional - desconto` (4 campos) |

**Exemplo concreto**:
- `valor_adicional = 100`, `valor_combustivel = 50`, `valor_ajudante = 30`, `valor_desconto = 20`
- M66: `outrosCustos = 100` → margem_bruta = cliente - prestador - pedagio - **100**
- sincronizarFinanceiroOS: `outrosCustos = 50+30+100-20 = 160` → margem_bruta = cliente - prestador - pedagio - **160**
- Diferença: **R$ 60**

**Isso já acontece em produção** para toda OS com escala que tem combustível ou ajudante preenchidos.

**Adicionalmente**: o engine de precificação (Missão 78) calcula margem bruta como `valorCliente - valorPrestador`, SEM incluir pedagio ou outros custos. Três fórmulas diferentes para a mesma métrica.

### Risco 3 — Duplicata em `financeiro_pagar` (GRAVIDADE: MÉDIA)

`financeiro_pagar` **NÃO tem UNIQUE(os_id)**. Ao contrário de `financeiro_receber` e `pagamentos_prestadores` que têm `uq_fr_os_id` e `uq_pp_os_id`, a tabela de contas a pagar permite múltiplos registros por OS.

M66 e sincronizarFinanceiroOS usam check-then-insert em `financeiro_pagar`. Se ambos verificarem simultaneamente e encontrarem 0 registros, ambos inserem, gerando duplicatas.

**Atenuação**: `sincronizarFinanceiroOS` só escreve em `financeiro_pagar` **no cancelamento**. Na criação/atualização normal, apenas M66 escreve. Risco real apenas se cancelamento coincidir com update da escala.

### Risco 4 — Três escritas em cadeia (GRAVIDADE: BAIXA)

Para OS com escala, o ciclo de salvamento gera até 3 escritas para as mesmas linhas:

| # | Fonte | Tabelas | Quando |
|---|-------|---------|--------|
| 1 | `sincronizarFinanceiroOS(dadosSync)` (Promise.all linha 684) | rec, pag, comp | Imediato |
| 2 | M66 trigger (via `sincronizarComEscala` linha 682) | rec, pag, comp, pagar, OS | Após update da escala |
| 3 | `sincronizarFinanceiroOS` (fire-and-forget linha 800) | rec, pag, comp | Após M66 |

**Impacto**: 3x mais chamadas SQL que o necessário. Sem consequência financeira porque são idempotentes, mas carga desnecessária no banco.

### Risco 5 — Composição duplicada em OS sem escala concluída (GRAVIDADE: BAIXA)

Para OS com escala **não concluída**:
- M66: **não** cria composicao_financeira_os (só em conclusão)
- sincronizarFinanceiroOS: **cria** composicao_financeira_os (sempre que valorCliente > 0)

Resultado: composição existe via TS mas não via trigger. Consistente, mas a composição foi criada com dados parciais (sem os custos reais da execução). Quando a escala for concluída, M66 sobrescreve com `ON CONFLICT`.

---

## 7. Recomendação Técnica para P5

### Decisão 1: Manter trigger M66 como única propagação escala → financeiro

✅ **Manter M66**. É a fonte de verdade mais confiável:
- Executa no banco (atômico, serializável)
- Já em produção desde M66 (2026-07-04)
- Cobre INSERT e UPDATE nas colunas financeiras
- ON CONFLICT em composicao_financeira_os

### Decisão 2: Remover `sincronizarFinanceiroOS()` e substituir por trigger em `ordens_servico`

❌ **Remover `sincronizarFinanceiroOS()`** — a função é a causa raiz de:
- Race condition com M66
- Margem divergente (fórmula diferente de `outrosCustos`)
- Três escritas em cadeia
- Chamada fire-and-forget redundante (linha 800)

✅ **Criar trigger `f_trg_propagar_financeiro_os()`** em `ordens_servico` — análogo ao M66:
- Dispara em INSERT/UPDATE de `valor_cliente, custo_prestador, pedagio, status`
- Para OS sem escala vinculada, propaga para `financeiro_receber` + `pagamentos_prestadores` + `composicao_financeira_os`
- Para OS com escala, **não faz nada** (M66 já cuidou)
- Usa `ON CONFLICT (os_id) DO UPDATE` (não check-then-insert)
- Usa a **mesma fórmula** do M66 para margem

### Decisão 3: Unificar fórmula de margem

✅ **M66 e novo trigger OS devem usar a MESMA fórmula**:
```
outrosCustos = COALESCE(adicional, 0) + COALESCE(combustivel, 0) + COALESCE(ajudante, 0) - COALESCE(desconto, 0)
margem_bruta = valor_cliente - valor_prestador - pedagio - outrosCustos
```

### Decisão 4: `calcularPreco(modo: "efetivar")` deve ser apenas cálculo + validação

❌ **Não deve persistir diretamente** em tabelas financeiras.

✅ Deve:
1. Calcular payload validado (`{ valorCliente, valorPrestador, kmExcedente, margens }`)
2. O componente decide gravar em `ordens_servico` (trigger cuida do resto)
3. Para OS sem escala, o novo trigger propaga automaticamente

### Plano Seguro para P5

```
Fase 1: Criar trigger OS (análogo ao M66)
  ├── supabase/migrations/20260705_m79_trigger_propagacao_os.sql
  ├── Função: f_trg_propagar_financeiro_os()
  ├── Trigger: AFTER INSERT OR UPDATE ON ordens_servico
  ├── Condição: apenas OS sem ordem_servico_id em alocacoes_escala
  │            (OS standalone) OU com todas as escalas canceladas
  ├── Fórmula de margem unificada (combustivel + ajudante + adicional - desconto)
  └── ON CONFLICT (os_id) DO UPDATE em todas as 4 tabelas

Fase 2: Remover sincronizarFinanceiroOS() dos callers
  ├── OrdemServicoForm.tsx: remover chamada (linha 684) — trigger OS cobre
  ├── ordemServicoService.finalizarOrdemServico(): remover chamada (linha 540)
  ├── ordemServicoService.sincronizarOSEscala(): remover chamada (linha 800)
  └── ordemServicoService.ts: manter função como deprecated (segurança)

Fase 3: Adicionar UNIQUE(os_id) em financeiro_pagar
  ├── ALTER TABLE financeiro_pagar ADD CONSTRAINT uq_fp_os_id UNIQUE (os_id);
  └── Previne duplicata residual

Fase 4: Implementar calcularPreco(modo: "efetivar")
  ├── Retorna payload validado (NÃO persiste)
  ├── Componentes chamam engine + gravam em ordens_servico
  └── Triggers propagam automaticamente

Fase 5: Remover código morto
  ├── sincronizarFinanceiroOS() — remover
  ├── sincronizarFinanceiroOSAlocacao() — remover (já sem callers)
  ├── salvarComposicaoFinanceira() — remover
  ├── calcularComposicaoFinanceira() — remover se fórmula unificada no trigger
  ├── engineFinanceira.ts — remover
  └── composicaoFinanceiraService.ts — remover
```

### Matriz de Decisão

| Opção | Vantagens | Desvantagens | Nota |
|-------|-----------|--------------|------|
| A) Manter TS + trigger | Zero mudanças | Race condition, margem divergente, 3x writes | ❌ Rejeitada |
| B) Só trigger M66, remover TS | Zero race, atomicidade, fórmula única | OS sem escala não propaga | ❌ Incompleta |
| C) Trigger M66 + Trigger OS | Zero TS financeiro, atomicidade total, um lugar para margem | Requer migration, validação | ✅ **RECOMENDADA** |
| D) Engine efetivar direto | Controle total no TS | Recria race condition, sem atomicidade | ❌ Rejeitada |

### Recomendação Final: **Opção C**

> Manter M66 para escala → financeiro. Criar trigger análogo em `ordens_servico` para OS → financeiro. Remover `sincronizarFinanceiroOS()`. Unificar fórmula de margem. Adicionar UNIQUE(os_id) em `financeiro_pagar`. `calcularPreco(modo: "efetivar")` só calcula e valida — quem persiste é o componente + triggers.

---

## 8. Anexo: Constantes de Cálculo

| Parâmetro | M66 trigger | sincronizarFinanceiroOS | Engine (precificacaoEngineService) |
|-----------|-------------|------------------------|------------------------------------|
| Imposto | 4.5% | 4.5% (configurável) | 4.5% |
| Seguro | 1% | 1% (param) | Não calcula |
| `outrosCustos` | `adicional` | `combustivel+ajudante+adicional-desconto` | Não aplica |
| Margem bruta | `cliente - prestador - pedagio - adicional` | `cliente - prestador - pedagio - outrosCustos` | `cliente - prestador` |
| ONDE corre | Banco (trigger) | TypeScript (TS service) | TypeScript (engine) |
| Quando executa | INSERT/UPDATE na escala | Após salvar/finalizar OS | Preview no form + futuro efetivar |
