# MISSÃO 74 — AUDITORIA E AMARRAÇÃO DA PRECIFICAÇÃO ENTERPRISE

**Data:** 2026-07-04
**Status:** Diagnóstico completo — 40 problemas encontrados (14 P0, 17 P1, 9 P2)
**Meta:** Relatório técnico sem implementação de novas funcionalidades

---

## SUMÁRIO EXECUTIVO

O sistema de precificação do TMS possui **duas fontes de verdade concorrentes e incompatíveis**:

1. **Trigger SQL** (`f_trg_propagar_financeiro_alocacao`) — propaga valores de `alocacoes_escala` para `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os`
2. **Service TypeScript** (`sincronizarFinanceiroOSAlocacao()` em `ordemServicoService.ts`) — duplica a mesma lógica no frontend

Ambas divergem em fórmula de margem, componentes de custo incluídos, e tratamento de adicionais. Além disso, **8 campos financeiros cadastrados no prestador** (`valor_diaria`, `valor_km`, `franquia_km`, `valor_saida`, `fixo_mensal`, `valor_ajudante`, `valor_espera`, `valor_reentrega`, `valor_devolucao`) **nunca são usados em cálculos reais de repasse**.

---

## REGRA DE OURO: PREÇO vs CUSTO

### Como DEVERIA ser:
```
Preço cobrado do cliente (tabela comercial / tabelas_valores)
- Custo do prestador (tabela_prestador / cadastro prestador)
- Custos adicionais (pedágio, ajudante, espera, combustível, etc.)
= Margem da Conexão Express
```

### Como É hoje:
```
Usuário digita valores manualmente na UI de alocação
  → alocacoes_escala (valor_frete, valor_repasse, pedagio, etc.)
  → Trigger SQL propaga para financeiro (com margens parciais)
  → Valores cadastrados do prestador SÃO IGNORADOS
```

---

## DIAGNÓSTICO COMPLETO POR ÁREA

---

### 1. CADASTRO DE PRESTADORES

#### Campos financeiros existentes na tabela `prestadores`

| Campo | Tipo | Salvo DB | Usado em cálculo real? | Risco |
|-------|------|----------|----------------------|-------|
| `valor_diaria` | NUMERIC(10,2) | ✅ | ❌ — engine morta (engineFinanceira.ts sem callers) | P0 |
| `valor_km` | NUMERIC(10,2) | ✅ | ❌ — engine morta | P0 |
| `franquia_km` | NUMERIC default 0 | ✅ | ❌ — apenas exibição (contrato, anúncio) | P0 |
| `valor_saida` | NUMERIC(10,2) | ✅ | ❌ — engine morta | P1 |
| `fixo_mensal` | NUMERIC(10,2) | ✅ | ❌ — nunca usado | P1 |
| `valor_ajudante` | NUMERIC(10,2) | ✅ | ❌ — nunca usado | P1 |
| `valor_espera` | NUMERIC | ✅ | ❌ — nunca usado (inexistente em alocacoes_escala) | P1 |
| `valor_reentrega` | NUMERIC | ✅ | ❌ — nunca usado | P2 |
| `valor_devolucao` | NUMERIC | ✅ | ❌ — nunca usado | P2 |

#### Campos financeiros em `veiculos`

| Campo | Tipo | Usado? | Risco |
|-------|------|--------|-------|
| `custo_km` | NUMERIC(10,2) | ❌ — apenas exibição em VeiculoDetalhe | P1 |
| `custo_diaria` | NUMERIC(10,2) | ❌ — apenas exibição | P1 |

#### Problemas — Prestadores

| ID | Arquivo | Linha | Tabela | Campo | Problema | Risco | Prioridade |
|----|---------|-------|--------|-------|----------|-------|------------|
| P0-PR1 | `src/utils/engineFinanceira.ts` | 216-223 | `prestadores` | `valor_diaria, valor_km, franquia_km` | Engine `calcularFinanceiroEscala()` lê `financeiroRealPrestador` mas este objeto NUNCA é populado do DB | Prestador cadastra valores que nunca são aplicados em repasse | P0 |
| P0-PR2 | `src/utils/engineFinanceira.ts` | todo | — | — | Função `calcularFinanceiroEscala()` (356 linhas) tem 0 callers em produção | Engine financeira completa é código morto | P0 |
| P0-PR3 | `src/helpers/calculoEscalaFinanceiro.ts` | todo | — | — | `calcularTotalAlocacao()` (113 linhas) tem 0 callers | Segundo motor financeiro morto | P0 |
| P1-PR4 | `src/components/prestadores/PrestadorDetalhe.tsx` | 1010-1018 | `prestadores` | `valorDiaria..valorDevolucao` | Campos financeiros exibidos no formulário mas sem conexão com fluxo real de pagamento | Falsa sensação de controle financeiro | P1 |
| P1-PR5 | `src/components/prestadores/PrestadoresLista.tsx` | 342 | `prestadores` | `valorDiaria` | Único campo financeiro exibido na listagem — sugere que é usado, mas não é | Enganoso para operadores | P1 |
| P1-PR6 | `src/components/prestadores/PrestadorDetalhe.tsx` | 303-309 | `veiculos` | `custo_km, custo_diaria` | `sanitizeVeiculoPayload` não inclui `custo_km` nem `custo_diaria` na allowlist | Campos de custo do veículo nunca são salvos via formulário | P1 |
| P2-PR7 | `src/components/prestadores/ContratoPrestadorModal.tsx` | 280-303 | `prestadores` | `valor_saida..franquia_km` | Shadow mapping frágil — busca valores em múltiplos lugares com nomes diferentes | Contrato pode exibir valores incorretos | P2 |
| P2-PR8 | `src/services/financeiro/auditoriaPrestadorService.ts` | 53 | — | — | `localStorage.getItem("demo_user")` — resquício de modo demo | Pode retornar usuário incorreto em produção | P2 |

---

### 2. COMERCIAL / TABELA DE VALORES

#### Tabelas de preço existentes

| Tabela | Localização | Status | Multi-tenant? |
|--------|-----------|--------|---------------|
| `tabelas_valores` | Schema oficial (migration) | ✅ Ativa | ❌ **SEM tenant_id** — P0 |
| `tabela_prestador` | `src/sql/` (fora migrations/) | ⚠️ Pode não existir em produção | ❌ **SEM tenant_id** |
| `price_table_rules` | `rebuild_supabase_schema.sql` | ❌ **NUNCA CRIADA** | — |
| `price_table_additionals` | `rebuild_supabase_schema.sql` | ❌ **NUNCA CRIADA** | — |

#### Problemas — Tabela de Valores

| ID | Arquivo | Linha | Tabela | Campo | Problema | Risco | Prioridade |
|----|---------|-------|--------|-------|----------|-------|------------|
| P0-TV1 | `src/components/operacao/EscalaLista.tsx` | 168,192,199,208 | `tabelas_valores` | `km_franquia` vs `franquia_km` | **Duas colunas com mesmo propósito e nomes diferentes**. Novo formulário escreve `franquia_km`, legado lê `km_franquia` | Dados de franquia km fragmentados entre sistemas | P0 |
| P0-TV2 | `src/components/comercial/TabelasValoresLista.tsx` | 166-199 | `tabelas_valores` | `percentual_prestador` | Novo formulário NÃO salva `percentual_prestador` (default 80%). Toda tabela criada terá NULL | Prestadores pagos com valor errado se percentual correto for diferente | P0 |
| P0-TV3 | `src/components/comercial/TabelaValoresForm.tsx` | 84 | — | — | Botão "Visualizar Impacto" renderizado **sem onClick handler** | Usuário clica e nada acontece | P0 |
| P1-TV4 | `src/components/comercial/TabelasValoresLista.tsx` | 166-199 | `tabelas_valores` | `km_inicial, km_final` | Novo formulário salva faixas em JSONB mas NÃO salva `km_inicial`/`km_final` como colunas planas | `OrcamentoForm.tsx` busca por `km_inicial/km_final` (colunas planas) e nunca encontra tabelas do novo formulário | P1 |
| P1-TV5 | `src/components/comercial/TabelaValoresForm.tsx` | 103-106 | `tabelas_valores` | `cliente` (texto) vs `cliente_id` (UUID) | Novo formulário vincula por nome_fantasia (texto) em vez de UUID FK. Schema SQL define `cliente_id UUID FK` | Mudança de nome fantasia quebra vínculo. Sem integridade referencial | P1 |
| P1-TV6 | `src/components/comercial/TabelasValoresLista.tsx` | 176 | `tabelas_valores` | `ativo` | Novo formulário escreve `status` (texto) mas NÃO escreve `ativo` (booleano). Legado filtra por `.eq("ativo", true)` | Tabelas com `status='ativa'` mas `ativo=NULL` não são encontradas pelo legado | P1 |
| P1-TV7 | `src/components/comercial/TabelaValoresForm.tsx` | 200-231 | `tabelas_valores` | `faixas` (JSONB) | `faixas` JSONB é escrito mas NUNCA lido pelo sistema operacional (EscalaLista, OrcamentoForm, engineFinanceira) | Regras complexas de faixa configuradas mas ignoradas no cálculo de frete | P1 |
| P1-TV8 | `src/components/comercial/tabelaValoresTypes.ts` | 23-41 | `tabelas_valores` | `adicionais` (JSONB) | 19 tipos de adicionais definidos. Apenas `espera` é lido (parcialmente) por `EscalaLista.tsx:2157` | 18/19 adicionais configurados mas nunca aplicados | P1 |
| P1-TV9 | `src/components/comercial/SimuladorFrete.tsx` | 30-63 | — | — | Simulador 100% mock/hardcoded (`valorBaseTabela = 350.00`, `custoPedagio = 48.90`). Não consulta `tabelas_valores` | Decisões comerciais baseadas em dados fictícios | P1 |
| P2-TV10 | `src/lib/sidebarData.ts` | 62 | — | — | Sidebar path `?tab=tabela-valores` não corresponde ao trigger `value="tabela"` em `Comercial.tsx:35` | Clique na sidebar abre aba errada | P2 |

---

### 3. ORDEM DE SERVIÇO

#### Problemas — OS

| ID | Arquivo | Linha | Tabela | Campo | Problema | Risco | Prioridade |
|----|---------|-------|--------|-------|----------|-------|------------|
| P0-OS1 | `src/services/ordemServicoService.ts` | 520-522 | `ordens_servico` | `custo_prestador` | `finalizarOrdemServico()` recalcula e **sobrescreve** `custo_prestador` sem preservar valor anterior | Valor original do prestador perdido na finalização | P0 |
| P0-OS2 | `src/components/comercial/OrcamentoForm.tsx` | 98-115 | `tabelas_valores` | — | `buscarTabelaValores()` não filtra por `cliente_id`. Retorna primeira tabela que encontrar por `tipo_veiculo` | Preço de cliente A pode ser aplicado à OS do cliente B | P0 |
| P1-OS3 | `src/components/operacao/OrdemServicoForm.tsx` | 297-312 | — | — | `recalcularValores()` usa `calcularValorPorDistancia()` com `TABELA_TESTE_VEICULOS_SP` (hardcoded) como fallback | Se não há tabela_valores, OS recebe preço do ar | P1 |
| P1-OS4 | `src/components/operacao/OrdemServicoForm.tsx` | 2159-2163 | `ordens_servico` | `valorCliente` | Edição manual direta do valor não abre diálogo de justificativa | Alteração de preço sem rastreabilidade | P1 |
| P1-OS5 | `src/components/operacao/OrdemServicoForm.tsx` | 967-977 | — | — | Margem calculada apenas visualmente (frontend). 4 lugares diferentes calculam margem com fórmulas diferentes | Divergência de margem entre trigger, service e frontend | P1 |
| P2-OS6 | `src/components/operacao/OrdemServicoForm.tsx` | 852 | `ordens_servico` | `usuarioAjusteManual` | Usuário do ajuste manual é hardcoded como "Operador" | Sem rastreabilidade de quem alterou o preço | P2 |
| P2-OS7 | `src/lib/dbMappers.ts` | 1290-1301 | `ordens_servico` | `distancia_rota.ajuste_manual` | Justificativa armazenada em JSONB profundamente aninhado | Difícil consultar, indexar ou reportar | P2 |
| P2-OS8 | `src/services/ordemServicoService.ts` | 34-132 + 697-806 | — | — | Sincronização bidirecional OS↔Escala cria loop de overwrite. Trigger SQL + TS service escrevem nas mesmas tabelas | Ordem de execução indeterminada pode causar perda de dados | P2 |

---

### 4. FINANCEIRO

#### Problemas — Financeiro

| ID | Arquivo | Linha | Tabela | Campo | Problema | Risco | Prioridade |
|----|---------|-------|--------|-------|----------|-------|------------|
| P0-FI1 | `20260731_p0_propagacao_financeira_trigger.sql` | 204-224 | `composicao_financeira_os` | `margem_bruta, margem_liquida` | Trigger P0 (mais recente, 31/07) **NÃO calcula margens**. Trigger M66 (04/07, anterior) calculava corretamente | **A trigger mais recente REGREDIU** — margens sempre zero | P0 |
| P0-FI2 | `20260731_p0_propagacao_financeira_trigger.sql` | 179 | `pagamentos_prestadores` | `valor_liquido` | Trigger P0 usa apenas `NEW.valor_repasse`. M66 inclui `repasse + pedagio + adicional - desconto` | Prestador recebe valor menor do que deveria | P0 |
| P0-FI3 | `20260731_p0_propagacao_financeira_trigger.sql` | 216 | `composicao_financeira_os` | `outros_custos` | `outros_custos = 0` fixo. Ignora `combustivel, ajudante, adicional, desconto` | Cálculo de margem ignora custos operacionais | P0 |
| P0-FI4 | `src/services/ordemServicoService.ts` | 573-690 | — | — | `sincronizarFinanceiroOSAlocacao()` duplica 100% da lógica da trigger SQL | Dupla inserção/atualização pode corromper dados financeiros | P0 |
| P0-FI5 | `20260731_p0_propagacao_financeira_trigger.sql` | 142 | `financeiro_pagar` | `valor` | `financeiro_pagar.valor` recebe APENAS `NEW.valor_repasse`. Não inclui pedágio, adicionais | Conta a pagar ao prestador não reflete custo total | P0 |
| P1-FI6 | `20260704_m66_fix_propagacao_financeira.sql` vs `composicaoFinanceiraService.ts:232-233` | — | `composicao_financeira_os` | `margem_bruta` | Fórmulas divergentes: M66 ignora combustível+ajudante+desconto. Service TS inclui todos | Margem calculada diferente dependendo de quem executa | P1 |
| P1-FI7 | `20260731_p0_propagacao_financeira_trigger.sql` | 204-224 | `composicao_financeira_os` | `combustivel_valor, ajudante_valor, adicional_valor, desconto_valor` | Trigger P0 não popula estas colunas (existem no schema) | 4 colunas de custo nunca preenchidas | P1 |
| P1-FI8 | `20260731_p0_propagacao_financeira_trigger.sql` vs M66 | — | `financeiro_receber` | `cliente, cliente_id, cliente_nome` | Trigger P0 usa `cliente = nome` (texto). M66 usa `cliente = NEW.cliente_id` (UUID). **Invertido** | Schema inconsistente — depende de qual trigger está ativa | P1 |
| P1-FI9 | `20260731_p0_propagacao_financeira_trigger.sql` | 104,134,165 | `financeiro_receber/pagar` | `os_id` | `v_os_id::TEXT` em tabelas onde `os_id` é UUID | Cast TEXT→UUID pode falhar com certos valores | P1 |
| P2-FI10 | `src/services/financeiro/auditoriaPrestadorService.ts` | 53 | — | — | Ainda usa `localStorage.getItem("demo_user")` | Resquício de modo demo | P2 |
| P2-FI11 | `20260626_missao021_fechamento_financeiro.sql` | 165-172 | `composicao_financeira_os` | — | Trigger de cancelamento zera valores mas não exclui registro | Margem 0/0 = 0% nos relatórios | P2 |

---

### 5. ESCALA

| ID | Arquivo | Linha | Tabela | Campo | Problema | Risco | Prioridade |
|----|---------|-------|--------|-------|----------|-------|------------|
| P0-ES1 | `supabase/migrations/20260522_alocacoes_escala.sql` | 110 | `alocacoes_escala` | `tabela_valores_id` | Coluna existe mas **NUNCA é populada** por nenhum código | Impossível rastrear qual tabela de preços foi usada historicamente | P0 |
| P1-ES2 | `src/components/operacao/EscalaLista.tsx` | 160-226 | `tabelas_valores` | `km_franquia, percentual_prestador` | Busca tabela por `cliente` (texto) + `tipo_veiculo`. Não usa `cliente_id` (UUID) | Tabelas vinculadas por UUID não são encontradas | P1 |
| P1-ES3 | `src/components/operacao/EscalaLista.tsx` | 2140-2163 | `tabelas_valores` | `adicionais` | Apenas `adicionais.espera` é lido. 18 outros adicionais ignorados | Adicionais configurados na tabela não afetam cálculo da escala | P1 |

---

### 6. SUPABASE (SCHEMA)

#### Problemas — Schema

| ID | Tabela | Campo | Problema | Risco | Prioridade |
|----|--------|-------|----------|-------|------------|
| P0-SC1 | `veiculos` | `prestador_vinculado` | Coluna é TEXT mas usada como UUID em JOINs (view `vw_relatorio_prestadores_analise`) | Pode quebrar com dados inválidos | P0 |
| P0-SC2 | `ordens_servico` | `adicionais` | Schema define NUMERIC(10,2). Migration adiciona NUMERIC. **DB real tem JSONB**. View `vw_relatorio_faturamento_detalhado` faz `::numeric` | Tipo no schema ≠ tipo real no banco | P0 |
| P0-SC3 | `tabelas_valores` | — | **SEM tenant_id, SEM RLS.** Qualquer tenant vê preços de outros | Vazamento de dados entre tenants | P0 |
| P0-SC4 | `tabela_prestador` | — | Criada em `src/sql/` (fora migrations/). Pode não existir em produção | Tabela de preços do prestador pode não estar no banco | P0 |
| P1-SC5 | `ordens_servico` | `cliente` / `cliente_id` | **Nomenclatura invertida.** `cliente` = UUID (FK). `cliente_id` = TEXT (nome do cliente) | Causa confusão constante em manutenção | P1 |
| P1-SC6 | `financeiro_receber` | `cliente`, `cliente_id`, `cliente_nome` | **3 colunas para mesma informação** (nome do cliente) | Duplicata semântica. Qual é a fonte da verdade? | P1 |
| P1-SC7 | `financeiro_pagar` | `prestador`, `fornecedor_id`, `fornecedor_nome` | **3 colunas para mesma informação** (nome do prestador) | Duplicata semântica | P1 |
| P1-SC8 | Trigger P0/M66 | — | Imposto 4.5% e seguro 1% **hardcoded** no trigger | Ignora `clientes.aliquota_iss` e `configuracoes_sistema` | P1 |
| P1-SC9 | `pagamentos_prestadores` | `os_id` | Schema original (`sql_pagamentos_prestadores.sql`) não tem `os_id`. Trigger insere com `os_id` + UNIQUE. | Schema disconectado da realidade | P1 |
| P1-SC10 | `ordens_servico` + `composicao_financeira_os` | `margem_bruta, margem_liquida` | **Margens duplicadas** em ambas as tabelas | Duas fontes de verdade para margem | P1 |
| P2-SC11 | `ordens_servico` | `lucro_estimado, margem_lucro` | Colunas adicionadas em migration (`20260515_correcao_2.sql`) mas **nunca populadas** por trigger ou processo | Campos mortos no schema | P2 |
| P2-SC12 | Nomes de migration | — | `20260704_m66_fix_propagacao_financeira.sql` diz "Fix da migration 20260731_p0..." — **data 04/07 é anterior a 31/07** | Paradoxo temporal. Ordem de aplicação ambígua | P2 |
| P2-SC13 | `orcamentos` | `valores` | Todos os valores financeiros dentro de JSONB não normalizado | Impossível fazer agregacões SQL ou CHECK constraints | P2 |

---

## TABELA CONSOLIDADA: ORIGEM → DESTINO DOS VALORES

```
alocacoes_escala (origem manual / UI)
  │
  ├── valor_frete ──────────→ financeiro_receber.valor
  │                          → composicao_financeira_os.valor_cliente
  │                          → ordens_servico.valor_cliente (via trigger)
  │
  ├── valor_repasse ────────→ financeiro_pagar.valor (APENAS repasse — P0!)
  │                          → pagamentos_prestadores.valor_servicos
  │                          → pagamentos_prestadores.valor_liquido (P0: só repasse; M66: +pedágio+adicional-desconto)
  │                          → composicao_financeira_os.valor_prestador
  │                          → ordens_servico.custo_prestador (via trigger)
  │
  ├── valor_pedagio ────────→ composicao_financeira_os.pedagio_valor
  │                          → pagamentos_prestadores.pedagio (M66 apenas)
  │
  ├── valor_combustivel ────→ composicao_financeira_os.combustivel_valor (M66 apenas)
  │
  ├── valor_ajudante ───────→ composicao_financeira_os.ajudante_valor (M66 apenas)
  │
  ├── valor_adicional ──────→ composicao_financeira_os.adicional_valor
  │
  └── valor_desconto ───────→ composicao_financeira_os.desconto_valor

❌ NÃO propagados para nenhum lugar:
  prestadores.valor_diaria, valor_km, franquia_km, valor_saida, fixo_mensal
  prestadores.valor_ajudante, valor_espera, valor_reentrega, valor_devolucao
  veiculos.custo_km, veiculos.custo_diaria
```

---

## TRIGGERS CONFLITANTES

| Trigger | Data | Status | Calcula margem? | Inclui adicionais? | Multi-tenant? |
|---------|------|--------|-----------------|-------------------|---------------|
| `20260626_missao02_financeiro_enterprise.sql` | 26/06 | ⚠️ Substituída | ✅ Sim | ⚠️ Parcial | ❌ |
| `20260704_m66_fix_propagacao_financeira.sql` | **04/07** | ✅ **ATIVA (correta)** | ✅ Sim (mas simplificada) | ✅ Combustível+ajudante+adicional-desconto | ❌ |
| `20260731_p0_propagacao_financeira_trigger.sql` | 31/07 | ❌ **Substituída (regrediu)** | ❌ **NÃO** | ❌ Ignora tudo | ❌ |

**⚠️ A M66 (04/07) é a trigger correta. A P0 (31/07) regrediu e perdeu funcionalidades.**
**⚠️ A M66 tem nome de arquivo com data ANTERIOR ao arquivo que ela "fixa" (P0, 31/07).**

---

## DUPLICAÇÃO TS vs SQL

| Operação | Service TS | Trigger SQL | Risco |
|----------|-----------|-------------|-------|
| Criar `financeiro_receber` | `ordemServicoService.ts:614-619` | `f_trg_propagar_financeiro_alocacao()` | Dupla inserção se ambos executarem |
| Criar `pagamentos_prestadores` | `ordemServicoService.ts:631-650` | Mesma trigger | Dupla inserção |
| Criar `composicao_financeira_os` | `ordemServicoService.ts:659-680` | Mesma trigger | UNIQUE constraint `uq_composicao_os` pode falhar |
| Calcular margem | `composicaoFinanceiraService.ts:232-233` | Trigger `calcular_margens_financeiras_os` | Fórmulas diferentes → margens diferentes |

---

## 11 TRIGGERS NO BANCO

| Trigger | Tabela | Evento | Migration |
|---------|--------|--------|-----------|
| `f_trg_propagar_financeiro_alocacao` | `alocacoes_escala` | AFTER INSERT OR UPDATE | `20260704_m66_fix_propagacao_financeira.sql` |
| `trg_cancelar_financeiro_escala` | `alocacoes_escala` | AFTER UPDATE (cancel) | `20260626_missao021_fechamento_financeiro.sql` |
| `normalizar_os_fks` | `ordens_servico` | BEFORE INSERT OR UPDATE | `20260630000004_m44d_normalizacao_os_uuid.sql` |
| `trg_auditar_os` | `ordens_servico` | AFTER INSERT OR UPDATE | `20260626_missao03_operacao_enterprise.sql` |
| `calcular_margens_financeiras_os` | `composicao_financeira_os` | BEFORE INSERT OR UPDATE | `src/sql/tabela_prestador_composicao_financeira.sql` |
| `trg_audit_financeiro_receber` | `financeiro_receber` | AFTER UPDATE | `20260626_enterprise_hardening.sql` |
| `trg_registrar_historico_alocacao` | `alocacoes_escala` | AFTER INSERT OR UPDATE | `20260522_alocacoes_escala.sql` |
| `trg_alocacoes_escala_updated_at` | `alocacoes_escala` | BEFORE UPDATE | `20260522_alocacoes_escala.sql` |

---

## RESUMO — CONTAGEM DE PROBLEMAS

| Área | P0 | P1 | P2 | Total |
|------|----|----|----|-------|
| Prestadores | 3 | 3 | 2 | 8 |
| Tabela de Valores | 3 | 6 | 1 | 10 |
| Ordem de Serviço | 2 | 3 | 3 | 8 |
| Financeiro | 5 | 4 | 2 | 11 |
| Escala | 1 | 2 | 0 | 3 |
| Schema/DB | 4 | 7 | 3 | 14 |
| **Total** | **14** | **17** | **9** | **40** |

---

## RECOMENDAÇÕES POR PRIORIDADE

### CORREÇÃO IMEDIATA (P0)

1. **Desativar trigger P0 e reativar M66** — ou corrigir P0 para incluir: cálculo de margens, `v_valor_liquido` com todos os componentes, `outros_custos` com combustível+ajudante+adicional-desconto
2. **Remover duplicação TS vs SQL** — escolher uma única fonte (recomendado: trigger SQL é mais performática e não depende de rede). Desligar `sincronizarFinanceiroOSAlocacao()` ou transformá-la em mera validação
3. **Unificar `km_franquia`/`franquia_km`** — criar migration renomeando para `franquia_km` (único nome). Ajustar 22+ referências
4. **Adicionar `percentual_prestador` ao novo formulário** — campo essencial para repasse
5. **Corrigir `finalizarOrdemServico()`** — não sobrescrever `custo_prestador` sem preservar original + auditoria
6. **Adicionar `tenant_id` + RLS em `tabelas_valores`** — urgente para multi-tenant
7. **Adicionar `tenant_id` + RLS + migration oficial em `tabela_prestador`**
8. **Corrigir `financeiro_pagar.valor`** para incluir pedágio e adicionais

### CORREÇÃO EM 30 DIAS (P1)

9. **Implementar `onClick` do botão "Visualizar Impacto"** ou removê-lo da UI
10. **Corrigir nomenclatura invertida** em `ordens_servico.cliente/cliente_id` e `prestador/prestador_id` — ou pelo menos documentar com comentários
11. **Unificar `cliente`/`cliente_id`/`cliente_nome`** em `financeiro_receber` — manter uma única coluna
12. **Remover impostos/seguro hardcoded** do trigger — buscar de `clientes.aliquota_iss` ou `configuracoes_sistema`
13. **Adicionar `km_inicial`/`km_final`** ao payload de save do novo formulário (extrair de `faixas[0]`)
14. **Conectar SimuladorFrete** a dados reais de `tabelas_valores`
15. **Criar migration oficial** com todas as colunas do novo schema de `tabelas_valores`

### MELHORIAS PLANEJADAS (P2)

16. **Criar migration oficial para `composicao_financeira_os`** (atualmente em `src/sql/`)
17. **Criar migration oficial para `pagamentos_prestadores`** com coluna `os_id`
18. **Remover colunas mortas** (`lucro_estimado`, `margem_lucro` em `ordens_servico`)
19. **Corrigir paradoxo de datas** nas migrations (M66 vs P0)
20. **Migrar justificativas** de `distancia_rota.ajuste_manual` JSONB para tabela `historico_precos_os`

---

## VALIDAÇÃO PENDENTE (REQUER DB LIVE)

Para considerar a missão concluída, é necessário executar com DB real:

- [ ] Teste real: criar tabela de valor comercial
- [ ] Teste real: cadastrar prestador com valores financeiros
- [ ] Teste real: criar OS com cliente + prestador
- [ ] Verificar se `financeiro_receber` recebe valor do cliente
- [ ] Verificar se `financeiro_pagar` recebe valor do prestador
- [ ] Verificar se `pagamentos_prestadores` recebe valor correto
- [ ] Verificar se `composicao_financeira_os` calcula margem corretamente
