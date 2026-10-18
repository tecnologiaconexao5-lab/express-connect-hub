# MISSAO77 — Validação do Engine de Precificação

**Data:** 2026-07-05
**Status:** ✅ Migration aplicada. Engine validado com dados reais.

---

## 1. Migration Aplicada ✅

**Migration:** `supabase/migrations/20260705_m76_p0_precificacao_engine.sql`

**Conexão:** Via `DATABASE_URL` do `.env` (pooler Supabase)

### Verificações pós-migration

| Item | Status | Detalhes |
|------|--------|----------|
| `tenant_id` em `tabelas_valores` | ✅ | Adicionado via `ADD COLUMN IF NOT EXISTS` |
| `tenant_id` em `tabela_prestador` | ✅ | Adicionado via `ADD COLUMN IF NOT EXISTS` |
| RLS `tabelas_valores` | ✅ | 4 policies: tv_select_tenant, tv_insert_tenant, tv_update_tenant, tv_delete_tenant |
| RLS `tabela_prestador` | ✅ | 4 policies: tp_select_tenant, tp_insert_tenant, tp_update_tenant, tp_delete_tenant |
| Índice `idx_tabelas_valores_tenant` | ✅ | btree (tenant_id) |
| Índice `idx_tabelas_valores_cliente_veiculo` | ✅ | btree (cliente, tipo_veiculo) |
| Índice `idx_tabelas_valores_universal_veiculo` | ✅ | btree (universal, tipo_veiculo) |
| Índice `idx_tabela_prestador_tenant` | ✅ | btree (tenant_id) |
| Índice `idx_tabela_prestador_busca` | ✅ | btree (nome, tipo_veiculo, uf) |
| `franquia_km` unificada | ✅ | Já existia (`ADD COLUMN IF NOT EXISTS` idempotente) |
| `percentual_prestador` | ✅ | Já existia |
| Trigger P0 removida | ✅ | `DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao_p0` |
| Trigger M66 preservada | ✅ | `trg_propagar_financeiro_alocacao` ativa |

### Observação
- `tabelas_valores` não tinha policies de RLS antes → agora tem 4 tenant-aware.
- `tabela_prestador` tinha apenas `"Allow all on tabela_prestador"` (permissiva) → agora tem 4 tenant-aware + a antiga (coexiste — PostgreSQL aplica OR entre policies).
- Pendência: remover `"Allow all on tabela_prestador"` em futura limpeza.

---

## 2. Tabelas Verificadas ✅

### `tabelas_valores` (colunas principais)
```
id, nome, tipo_veiculo, km_inicial, km_final, valor_base, valor_km, valor_minimo,
ativo, universal, created_at, adicionais, financeiro, regras, faixas, observacoes,
status, cliente, updated_at, ..., franquia_km, km_franquia, valor_km_excedente,
percentual_prestador, ..., tenant_id (NOVO)
```

### `tabela_prestador` (colunas)
```
id, nome, tipo_veiculo, regiao, valor_minimo, km_incluso, valor_km, ativo,
created_at, cidade, uf, valor_saida, tenant_id (NOVO)
```

### `tabela_prestador` — dados existentes
- **5 registros** encontrados. Nenhum possui compatibilidade com `prestador_id` (uuid) — a coluna `nome` armazena nome textual.

---

## 3. Triggers Verificadas ✅

| Trigger | Função | Status |
|---------|--------|--------|
| `trg_alocacoes_escala_updated_at` | updated_at automático | ✅ Ativa |
| `trg_propagar_financeiro_alocacao` (M66) | Propagação financeira correta | ✅ Ativa |
| `trg_registrar_historico_alocacao` | Log de alterações | ✅ Ativa |
| `trg_propagar_financeiro_alocacao_p0` (P0 regressiva) | Removeu margem | ❌ Removida |

---

## 4. Teste do Engine — Resultado Real ✅

### Cenário de teste

| Parâmetro | Valor |
|-----------|-------|
| Cliente | DVL - DISTRIBUIDORA VIA LACTEA LTDA |
| Tabela aplicada | FIORINO DVL (R$ 400 base, 100km franquia, R$ 2.1/km exc) |
| Prestador | FRANKLIN DA SILVA PEREIRA |
| Fonte prestador | `prestadores_cadastro` (R$ 350 diária, R$ 1.75/km, 100km franquia) |
| Veículo | CDR0F12 (fiorino) |
| Distância | 150 km |
| Espera | 90 min |
| Modo | preview |

### Resultado do cálculo

```
CLIENTE
  Tabela: FIORINO DVL (tabelas_valores)
  Valor base:          R$ 400.00
  KM excedente (50km): R$ 105.00  (50km × R$ 2.1)
  Espera (90min):      R$ 280.00  (1h após 60min free × R$ 280/h)
  Total adicionais:    R$ 385.00
  TOTAL CLIENTE:       R$ 785.00

PRESTADOR
  Fonte: Cadastro do Prestador (prestadores_cadastro)
  Valor base:          R$ 350.00
  KM excedente (50km): R$ 87.50   (50km × R$ 1.75)
  TOTAL PRESTADOR:     R$ 437.50

MARGEM
  Bruta:     R$ 347.50  (44.27%)
  Imposto:   R$ 0.00    (ISS 0% — cliente sem aliquota configurada)
  Seguro:    R$ 7.85    (1%)
  Líquida:   R$ 339.65  (43.27%)
```

### Alertas gerados
- Nenhum alerta de erro — fluxo completo sem blocking.
- `clientes_aliquota` = ❌ (ISS = 0 no cadastro da DVL)

---

## 5. Compilação

| Comando | Resultado |
|---------|-----------|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ 35.91s |

---

## 6. Problemas Encontrados e Corrigidos Durante Validação

### 🔧 Schema mismatches corrigidos (3)

| # | Problema | Correção |
|---|----------|----------|
| 1 | `buscarTabelaValoresCliente` usava `.eq("cliente_id", uuid)` mas `tabelas_valores.cliente` é TEXT (nome) | Resolver `cliente_id` → `clientes.nome_fantasia` antes de filtrar |
| 2 | `buscarTabelaPrestador` usava `.eq("prestador_id", uuid)` mas `tabela_prestador` não tem essa coluna | Resolver `prestador_id` → `prestadores.nome_completo` antes de filtrar |
| 3 | `veiculos` não possui colunas financeiras (`custo_km`, `custo_diaria`) — dados estão em `prestadores` | Fallback de veículos removido; prestadores já coberto pelo fallback de `prestadores_cadastro` |

### 🔧 Bug fix: variável `custos_operacionais` vs `custosOperacionais`

- Engine usava shorthand `{ custos_operacionais }` para variável `custosOperacionais` (camelCase vs snake_case) → corrigido para `{ custos_operacionais: custosOperacionais }`.

### 🔧 Migration fix: índice com coluna inexistente

- Migration original criava `idx_tabelas_valores_cliente_veiculo` em `(cliente_id, tipo_veiculo)` mas `cliente_id` não existe → corrigido para `(cliente, tipo_veiculo)`.
- `idx_tabela_prestador_busca` em `(prestador_id, ...)` → corrigido para `(nome, ...)`.

---

## 7. Pendências para Conectar Engine na OS

| # | Pendência | Prioridade | Detalhes |
|---|-----------|-----------|----------|
| P1 | Substituir chamada a `engineFinanceira.ts` (legado) pelo novo `calcularPreco()` em `ordemServicoService.ts` | **Alta** | O fluxo de criação/atualização de OS deve usar o novo engine |
| P2 | Mapear campos do formulário de OS para `PricingInput` | **Alta** | Os campos `km_rodados`, `minutos_espera`, `tipo_veiculo`, etc. precisam ser mapeados do formulário React |
| P3 | Decidir quando chamar: preview (enquanto usuário digita) vs efetivar (ao salvar) | **Média** | `PricingInput.modo` define se o cálculo é preview ou persistido |
| P4 | Persistir resultado do engine nas tabelas financeiras | **Média** | Quando `modo: 'efetivar'`, o engine deve inserir/atualizar `financeiro_receber`, `pagamentos_prestadores`, `composicao_financeira_os` |
| P5 | Integrar regras especiais (DVL, overbooking) ao formulário | **Baixa** | Regras estão implementadas no engine mas sem UI |

---

## 8. Pendências para Conectar Engine na Escala

| # | Pendência | Prioridade | Detalhes |
|---|-----------|-----------|----------|
| P6 | Mapear `PricingInput.prestador_operacional` dos campos da escala | **Alta** | Ajudantes, pedagio, segunda/terceira saída vêm da escala, não da OS |
| P7 | Executar engine ao fechar escala (status = concluída) | **Alta** | Disparar `calcularPreco()` quando escala for finalizada |
| P8 | Validar consistência: engine vs trigger M66 | **Média** | Garantir que o engine e a trigger produzem os mesmos valores |

---

## 9. Riscos Restantes

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `tabela_prestador` sem registros compatíveis | Cálculo do prestador sempre cai para `prestadores_cadastro` | Aceitável — `prestadores_cadastro` tem os campos necessários |
| `clientes.aliquota_iss` = 0 para clientes reais | Margem líquida superestimada | Alertar no engine quando ISS = 0 |
| `tabelas_valores.adicionais.espera.valorHora` = R$ 280/h real | Espera pode ser cara demais | Validar com operacional se o valor está correto |
| Trigger M66 e engine podem duplicar propagação | Duplicação financeira | `sincronizarFinanceiroOSAlocacao()` já desativado. Verificar se trigger M66 cobre todos os cenários |
| `"Allow all on tabela_prestador"` policy ainda existe | Permissão permissiva para anon | Remover em próxima limpeza de RLS |

---

## 10. Sumário

| Métrica | Valor |
|---------|-------|
| Arquivos do engine | 3 (types.ts, buscarTabelasService.ts, precificacaoEngineService.ts) |
| Migration aplicada | ✅ Sim (via DATABASE_URL) |
| Engine testado com dados reais | ✅ Cliente + Prestador + Veículo |
| Bugs corrigidos durante validação | 5 (3 schema, 1 variável, 1 migration) |
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ 35.91s |
| Engine pode ser conectado na OS | ⏳ Pendente P1-P5 |
| Engine pode ser conectado na Escala | ⏳ Pendente P6-P8 |
