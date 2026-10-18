# MISSÃO 75 — ARQUITETURA DO ENGINE DE PRECIFICAÇÃO ENTERPRISE

**Data:** 2026-07-04
**Autor:** Missão 75 — Diagnóstico Arquitetural
**Status:** Aprovado para implementação na Missão 76
**Objetivo:** Definir a arquitetura oficial e única do motor de precificação antes de corrigir os P0 da Missão 74

---

## 1. RESUMO EXECUTIVO

O sistema de precificação atual possui **3 engines concorrentes + 2 triggers + 2 serviços duplicados** que calculam valores de formas diferentes:

| Componente | Local | Status | O que faz |
|------------|-------|--------|-----------|
| `engineFinanceira.ts` | `src/utils/` | ❌ Morto (0 callers) | Engine completa: cliente + prestador + KM + espera + overbooking + margem |
| `composicaoFinanceiraService.ts` | `src/services/financeiro/` | ⚠️ Parcialmente usado | Só calcula margem. Tem `buscarTabelaPrestador()` (6 níveis) |
| `calculoService.ts` | `src/services/financeiro/` | ⚠️ Fallback hardcoded | `TABELA_TESTE_VEICULOS_SP` — tabela fixa em TypeScript |
| `calculoRepassePrestador.ts` | `src/helpers/` | ✅ Usado | Simples: base + pedagio + adicionais - descontos |
| Trigger M66 (`alocacoes_escala`) | SQL migration | ✅ Ativa (correta) | Propaga manual values para tabelas financeiras |
| `OrdemServicoForm.tsx` (inline) | Componente | ⚠️ Usado | `buscarTabelaValores()` + `calcularValorAutomatico()` inline |
| `EscalaLista.tsx` (inline) | Componente | ⚠️ Usado | `buscarTabelaValoresCliente()` inline |
| `sincronizarFinanceiroOSAlocacao()` | `ordemServicoService.ts` | ❌ Duplicado | Duplica lógica da trigger M66 em TypeScript |

### Decisão arquitetural

**TypeScript como engine principal, SQL como persistente.**

Toda a lógica de precificação deve ficar em **um único service TypeScript** (`precificacaoEngineService.ts`) que:

1. Consulta `tabelas_valores` para preço do cliente
2. Consulta `tabela_prestador` + `prestadores` + `veiculos` para custo do prestador
3. Calcula valores completos (cliente, prestador, adicionais, margens)
4. Retorna resultado estruturado com `memoria_calculo` e `fontes_dados`
5. Pode ser chamado em modo **preview** (sem salvar) e modo **efetivar** (com persistência)

A trigger SQL M66 **continua existindo** mas como garantia de consistência, não como fonte primária de cálculo.

---

## 2. DIAGNÓSTICO DO `engineFinanceira.ts`

### 2.1 O que este arquivo contém

**Linhas:** 356 | **Funções:** 1 (`calcularFinanceiroEscala`) | **Interfaces:** 3 (`EngineParams`, `EngineFinanceiraResult`, `CalculoKM`, `CalculoEspera`)

### 2.2 Funcionalidades que já implementa corretamente

| Funcionalidade | Linhas | Status |
|----------------|--------|--------|
| Cálculo de KM excedente (cliente) | 137-140 | ✅ Completo |
| Cálculo de espera com faixas | 142-166 | ✅ Completo (prioriza faixas, fallback minutos) |
| Regra especial de faturamento (DVL) | 168-180 | ✅ Completo (hora saída × multiplicador) |
| Overbooking (substitui valor base) | 182-194 | ✅ Correto (NÃO soma, substitui) |
| Parâmetros do prestador (tabela_prestador) | 214-244 | ✅ Completo (6 cenários de fallback) |
| Margem operacional | 271-273 | ✅ Simples e correta |
| Detalhamento completo (cliente + prestador + margem) | 275-355 | ✅ Extremamente rico |

### 2.3 Por que não tem callers

**Causa raiz:** A função `calcularFinanceiroEscala()` exige o parâmetro `EngineParams` que por sua vez requer `financeiroPrestador: any` e `financeiroRealPrestador?: {...}` — objetos complexos que **nenhum componente** sabe montar. O formato de entrada é diferente do que os formulários (OS, Escala) produzem naturalmente.

Em outras palavras: **a engine exige dados pré-processados que ninguém sabe gerar.**

### 2.4 Decisão: MANTER e REFATORAR

**O `engineFinanceira.ts` DEVE ser mantido como core.** Sua lógica de cálculo é a mais completa do sistema. Precisa de:

1. **Wrapper** que aceite entradas simples (tipo `PricingInput`) e monte o `EngineParams` internamente
2. **Integração com `composicaoFinanceiraService.ts`** para buscar `tabela_prestador`
3. **Integração com `buscarTabelaValores()`** para buscar `tabelas_valores`
4. **Modo preview** que retorna resultado sem salvar nada no banco
5. **Remoção do parâmetro `financeiroRealPrestador`** — este dado deve ser buscado internamente pela engine (não passado externamente)

---

## 3. ARQUITETURA RECOMENDADA

### 3.1 Diagrama Textual do Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PRECIFICACAO ENGINE SERVICE                             │
│                    src/services/precificacaoEngineService.ts                 │
│                                                                             │
│  calcularPreco(input: PricingInput): PricingOutput                          │
│  visualizarImpacto(input: PricingInput): PricingOutput  (preview, sem DB)   │
│  efetivarPreco(input: PricingInput): PricingOutput     (preview + persist)  │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┬────────────────┬────────────────┐
          ▼            ▼            ▼                ▼                ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
   │tabelas_  │ │tabela_   │ │prestadores│ │  veiculos    │ │  clientes    │
   │valores   │ │prestador │ │          │ │              │ │(aliquota_iss)│
   │(preço    │ │(custo    │ │(valores  │ │(custo_km,    │ │              │
   │cliente)  │ │prestador)│ │referência│ │custo_diaria) │ │              │
   └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘
                       │
                       ▼
           ┌─────────────────────┐
           │  engineFinanceira   │
           │  (core cálculo)     │
           └──────────┬──────────┘
                      │
                      ▼
           ┌─────────────────────┐
           │  PricingOutput      │
           │  (valor_cliente,    │
           │   valor_prestador,  │
           │   adicionais,       │
           │   margem,           │
           │   memoria_calculo,  │
           │   fontes_dados,     │
           │   alertas)          │
           └──────────┬──────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ┌──────────────┐     ┌──────────────────┐
   │  OS / Escala │     │  Persistência    │
   │  (preview)   │     │  (se efetivar)   │
   └──────────────┘     └──────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Trigger M66 (SQL)  │
                    │  Garantia de        │
                    │  consistência       │
                    └─────────────────────┘
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
              ┌────────┐ ┌────────┐ ┌──────────────┐
              │financei│ │financei│ │pagamentos_   │
              │ro_     │ │ro_     │ │prestadores    │
              │receber │ │pagar   │ │+ composicao   │
              └────────┘ └────────┘ └──────────────┘
```

### 3.2 Fluxo de Dados (Ordem Cronológica)

```
1. ENTRADA: UI (OS/Escala/Pedido) → coleta dados básicos
   ↓
2. CONSULTA: Engine busca tabelas_valores (cliente)
   ↓ Prioridade: cliente_id + tipo_veiculo > universal + tipo_veiculo > fallback
   ↓
3. CONSULTA: Engine busca tabela_prestador (custo prestador)
   ↓ Prioridade: 6 níveis (prestador_id + tipo + cidade/uf ... tipo genérico)
   ↓ Se não encontrada: busca prestadores.valor_diaria, valor_km, franquia_km
   ↓ Se não encontrado: veiculos.custo_km, custo_diaria
   ↓
4. CÁLCULO: engineFinanceira.calcularFinanceiroEscala()
   ↓ Calcula: valor_cliente, valor_prestador, KM, espera, overbooking, adicionais, margem
   ↓
5. SAÍDA: PricingOutput → UI (preview)
   ↓ Se usuário confirmar:
   ↓
6. PERSISTÊNCIA: Engine salva na OS/Escala + chama trigger M66
   ↓ Trigger M66 propaga para financeiro_receber, pagamentos_prestadores, composicao_financeira_os
```

---

## 4. FONTE DE VERDADE DE CADA VALOR

| Valor | Fonte Primária | Fallback 1 | Fallback 2 | Consulta via |
|-------|---------------|-----------|-----------|-------------|
| **Preço do cliente** (base) | `tabelas_valores.valor_base` + `km_franquia` + `valor_km_excedente` | `tabelas_valores.valor_base` + `valor_km` (legado) | `TABELA_TESTE_VEICULOS_SP` (hardcoded, com warning) | Engine → `tabelas_valores` query |
| **Preço do cliente** (faixas) | `tabelas_valores.faixas` JSONB (kmIni, kmFim, valor) | Colunas planas `km_inicial`/`km_final`/`valor_km` | — | Engine → `tabelas_valores` |
| **Custo do prestador** (base) | `tabela_prestador.valor_minimo` + `km_incluso` + `valor_km` + `valor_saida` | `prestadores.valor_diaria` + `franquia_km` + `valor_km` | `veiculos.custo_km` + `custo_diaria` | Engine → prioridade 6 níveis |
| **Percentual repasse** | `tabelas_valores.percentual_prestador` | 80% (default TS) | — | Engine → `tabelas_valores` |
| **Adicionais** (pedágio, ajudante, espera, etc.) | `tabelas_valores.adicionais` JSONB + inputs manuais | Inputs manuais da UI | — | Engine → `tabelas_valores` + UI |
| **KM rodado** | Cálculo de rota (Mapbox) | Input manual | — | OS/Escala form |
| **Espera** | `tabelas_valores.adicionais.espera` (faixas + minutosFree + valorHora) | Input manual minutos | — | Engine → `tabelas_valores.adicionais.espera` |
| **Overbooking** | `financeiroPrestador` (da UI de escala) | — | — | Engine via parâmetro |
| **Imposto** | `clientes.aliquota_iss` | 4.5% (default fixo) | — | Engine → `clientes` |
| **Seguro** | `tabelas_valores.adicionais.seguro` | 1% (default fixo) | — | Engine → `tabelas_valores` |
| **Margem bruta** | Calculada: `valor_cliente_total - valor_prestador_total - custos` | — | — | Engine (cálculo) |
| **Margem líquida** | Calculada: `margem_bruta - imposto - seguro` | — | — | Engine (cálculo) |
| **Veículo** | `veiculos` (tipo, capacidade, térmica) | Input manual | — | Engine → `veiculos` via prestador_id |
| **Contrato** | `tabelas_valores` (vigência) ou contrato específico | — | — | Engine |

### 4.1 Regra de Ouro da Fonte de Verdade

```
PREÇO DO CLIENTE   = tabelas_valores (comercial)
CUSTO PRESTADOR    = tabela_prestador (operacional)
                     ↓ fallback para prestadores.valor_diaria/valor_km
                     ↓ fallback para veiculos.custo_km/custo_diaria
                     ↓ fallback para percentual da tabelas_valores
MARGEM             = CALCULADA pelo engine (nunca persistida antes do cálculo)
FINANCEIRO         = PERSISTIDO pela trigger M66 (nunca calculado no SQL)
```

---

## 5. ESTRATÉGIA SQL VS TYPESCRIPT

### Decisão: OPÇÃO A — TypeScript como engine principal

| Critério | Opção A (TypeScript) | Opção B (SQL trigger) |
|----------|---------------------|----------------------|
| **Manutenção** | ✅ Melhor — código legível, debugável, versionado | ❌ Difícil — PL/pgSQL verboso, sem debug, sem testes unitários |
| **Testes** | ✅ Jest/Playwright testam engine isoladamente | ❌ Impossível testar trigger sem mockar Supabase |
| **Rastreabilidade** | ✅ `memoria_calculo[]` com cada passo + fontes | ❌ Sem log de cálculo — só resultado final |
| **Multi-tenant** | ✅ Filtro explícito por tenant_id em cada query | ⚠️ RLS aplica, mas lógica misturada |
| **APIs** | ✅ Engine pode ser exposta como Edge Function | ❌ Trigger só reage a INSERT/UPDATE |
| **Simulação** | ✅ `visualizarImpacto()` sem salvar no banco | ❌ Trigger sempre persiste |
| **Risco regressão** | ⚠️ Médio — código novo precisa substituir 4+ pontos | ❌ Alto — alterar trigger impacta todo fluxo |
| **Performance** | ⚠️ Rede round-trip para consultar tabelas | ✅ Tudo no mesmo banco (PL/pgSQL) |

### 5.1 Modelo Híbrido Recomendado

```
┌───────────────────────────────────────────────────────────────┐
│                     TYPESCRIPT (ENGINE)                        │
│   precificacaoEngineService.ts                                 │
│                                                                │
│   Responsabilidades:                                           │
│   - Consultar tabelas de preço (tabelas_valores,               │
│     tabela_prestador, prestadores, veiculos, clientes)         │
│   - Calcular valores (engineFinanceira.ts como core)           │
│   - Montar memoria_calculo (array de strings com cada passo)   │
│   - Retornar preview para UI                                   │
│   - Persistir resultado na OS/Escala                          │
│   - NÃO duplicar trigger — apenas salvar na tabela de origem   │
└───────────────────────────────────────┬───────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────┐
│                     SQL (TRIGGER M66)                          │
│   f_trg_propagar_financeiro_alocacao()                        │
│                                                                │
│   Responsabilidades:                                           │
│   - Reagir a INSERT/UPDATE em alocacoes_escala                │
│   - Propagar valores para financeiro_receber,                 │
│     pagamentos_prestadores, composicao_financeira_os           │
│   - NÃO calcular (recebe valores já calculados pelo TS)       │
│   - Apenas distribuir para as tabelas financeiras              │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Regras da Separação

| O que | Quem faz | Onde |
|-------|----------|------|
| Consultar tabela de preços | TypeScript | `precificacaoEngineService.ts` |
| Calcular valor do cliente | TypeScript | `engineFinanceira.ts` (core) |
| Calcular custo do prestador | TypeScript | `engineFinanceira.ts` (core) |
| Calcular adicionais | TypeScript | `engineFinanceira.ts` (core) |
| Calcular margem | TypeScript | `engineFinanceira.ts` (core) |
| Montar memória de cálculo | TypeScript | `precificacaoEngineService.ts` |
| Exibir preview | TypeScript | Componentes (via engine) |
| **Persistir na OS** | TypeScript | `ordemServicoService.ts` |
| **Propagar para Financeiro** | SQL (trigger M66) | `f_trg_propagar_financeiro_alocacao` |
| Calcular imposto/seguro | TypeScript (+ fallback no trigger) | Engine + trigger |
| Garantir consistência | SQL (trigger M66 + constraints) | Banco |

### 5.3 O que fazer com as duplicações atuais

| Código atual | Ação |
|-------------|------|
| `sincronizarFinanceiroOSAlocacao()` em `ordemServicoService.ts` | ❌ **Remover.** Trigger M66 já faz isso. Manter só validação mínima |
| `calcularValorAutomatico()` em `OrdemServicoForm.tsx` | ❌ **Remover.** Substituir por chamada ao engine |
| `buscarTabelaValoresCliente()` em `EscalaLista.tsx` | ❌ **Remover.** Substituir por chamada ao engine |
| `buscarTabelaValores()` em `OrdemServicoForm.tsx` | ❌ **Remover.** Substituir por chamada ao engine |
| `calcularValorPorDistancia()` em `calculoService.ts` | ❌ **Remover** ou marcar como `@deprecated` com warning |
| `TABELA_TESTE_VEICULOS_SP` em `tabelaFretePadrao.ts` | ❌ **Remover.** Substituir por dados reais do banco. Se não houver tabela, engine retorna erro claro |
| `engineFinanceira.ts` | ✅ **Manter como core.** Adicionar wrapper no `precificacaoEngineService.ts` |
| `composicaoFinanceiraService.ts` | ✅ **Manter.** `calcularComposicaoFinanceira()` usado pelo engine. `buscarTabelaPrestador()` integrado. `salvarComposicaoFinanceira()` mantido |
| `calculoRepassePrestador.ts` | ⚠️ **Manter temporariamente.** Substituir pelo engine no longo prazo |
| Trigger M66 | ✅ **Manter.** É a versão correta. Garantir que está ativa no banco |

---

## 6. CONTRATO DE DADOS DO ENGINE

### 6.1 Interface de Entrada: `PricingInput`

```typescript
// src/services/precificacao/types.ts

interface PricingInput {
  // Identificação
  tenant_id: string;
  cliente_id: string;
  prestador_id?: string;
  veiculo_id?: string;
  filial_id?: string;
  contrato_id?: string;

  // Operação
  tipo_operacao: 'dedicado' | 'fracionado' | 'urbano' | 'transferencia';
  tipo_veiculo: string;
  distancia_km: number;
  peso?: number;
  cubagem?: number;
  quantidade_paradas: number;
  origem: { cidade: string; uf: string; cep?: string };
  destino: { cidade: string; uf: string; cep?: string };

  // Tempos
  minutos_espera?: number;
  hora_saida?: number;         // 0-23, para regra especial DVL

  // Adicionais (inputs manuais da UI)
  adicionais_manuais?: {
    pedagio_cobrado_cliente?: number;
    reentrega_cliente?: number;
    agendamento_cliente?: number;
    ajuste_cliente_valor?: number;
    km_excedente_prestador_valor?: number;
  };

  // Regras especiais
  regra_especial?: {
    ativa: boolean;
    tipo?: string;             // 'DVL', 'overbooking', etc.
    parametros?: Record<string, any>;
  };

  // Overbooking (preenchido pela escala)
  overbooking?: {
    ativo: boolean;
    tipo?: 'percentual' | 'fixo';
    valor_base?: number;
    percentual_cliente?: number;
    percentual_prestador?: number;
    valor_cliente?: number;
    valor_prestador?: number;
  };

  // Prestador (preenchido pela escala/alocação)
  prestador_operacional?: {
    valor_fixo?: number;
    valor_percentual?: number;
    valor_tipo?: 'fixo' | 'percentual';
    ajudantes?: number;
    valor_ajudante?: number;
    pedagio?: number;
    combustivel?: number;
    desconto?: number;
    segunda_saida?: boolean;
    valor_segunda_saida?: number;
    segunda_saida_cobrar_cliente?: boolean;
    segunda_saida_pagar_prestador?: boolean;
    terceira_saida?: boolean;
    valor_terceira_saida?: number;
    terceira_saida_cobrar_cliente?: boolean;
    terceira_saida_pagar_prestador?: boolean;
    saidas_adicionais?: number;
    valor_saida_adicional?: number;
    diarias_adicionais?: number;
    valor_diaria?: number;
    valor_reembolso_outros?: number;
  };

  // Dados de contrato (se houver)
  contrato?: {
    tabela_valores_id?: string;
    tabela_prestador_id?: string;
    vigencia_inicio?: string;
    vigencia_fim?: string;
    valor_fixo_mensal?: number;
  };

  // Modo de operação
  modo: 'preview' | 'efetivar';
  usuario_id?: string;
}
```

### 6.2 Interface de Saída: `PricingOutput`

```typescript
interface PricingOutput {
  // Metadados
  sucesso: boolean;
  modo: 'preview' | 'efetivar';
  timestamp: string;

  // Cliente
  cliente: {
    id: string;
    nome: string;
    tabela_aplicada: {
      id: string;
      nome: string;
      fonte: 'tabelas_valores' | 'universal' | 'fallback_hardcoded';
    };
    valor_base: number;
    valor_base_original: number;   // antes de overbooking
    adicionais: {
      km_excedente: number;
      espera: number;
      pedagio_cobrado: number;
      reentrega: number;
      agendamento: number;
      segunda_saida: number;
      terceira_saida: number;
      ajuste_manual: number;
      overbooking: number;
      outros: number;
    };
    total_adicionais: number;
    total: number;                   // valor_base + total_adicionais
  };

  // Prestador
  prestador: {
    id: string | null;
    nome: string | null;
    tabela_aplicada: {
      id: string | null;
      nome: string;
      fonte: 'tabela_prestador' | 'prestadores_cadastro' | 'veiculos' | 'percentual_tabela_valores' | 'manual' | 'nao_encontrada';
    };
    valor_base: number;
    valor_base_original: number;
    detalhes_km: {
      franquia: number;
      excedente: number;
      valor_km: number;
      total_excedente: number;
    };
    adicionais: {
      km_excedente: number;
      espera: number;
      ajudante: number;
      pedagio: number;
      segunda_saida: number;
      terceira_saida: number;
      saidas_adicionais: number;
      diarias_adicionais: number;
      reembolso_outros: number;
      overbooking: number;
    };
    total_adicionais: number;
    descontos: {
      combustivel: number;
      outros: number;
    };
    total_descontos: number;
    total: number;                   // valor_base + adicionais - descontos
  };

  // Custos operacionais
  custos_operacionais: {
    pedagio: number;
    combustivel: number;
    ajudante: number;
    outros: number;
    total: number;
  };

  // Margem
  margem: {
    bruta: number;        // cliente.total - prestador.total
    liquida: number;      // bruta - imposto - seguro
    percentual_bruta: number;
    percentual_liquida: number;
    imposto_valor: number;
    seguro_valor: number;
    imposto_percentual: number;  // da tabela do cliente ou 4.5%
  };

  // Regras especiais aplicadas
  regras_aplicadas: {
    tipo: string;
    descricao: string;
    impacto_cliente: number;
    impacto_prestador: number;
  }[];

  // Memória de cálculo (para exibição e auditoria)
  memoria_calculo: string[];  // ex: "1. Buscando tabela para cliente X + veiculo Y"
                              //     "2. Tabela encontrada: 'Tabela SP' (ID: abc)"
                              //     "3. KM calculado: 45km (franquia: 20km, excedente: 25km)"
                              //     "4. Valor base cliente: R$ 150,00"
                              //     "5. + KM excedente: 25km x R$ 3,50 = R$ 87,50"

  // Alertas
  alertas: {
    tipo: 'info' | 'warning' | 'error';
    mensagem: string;
    campo?: string;
  }[];

  // Controles
  pode_salvar: boolean;
  motivo_bloqueio?: string;
  fontes_dados: {
    tabelas_valores: boolean;
    tabela_prestador: boolean;
    prestadores_cadastro: boolean;
    veiculos: boolean;
    clientes_aliquota: boolean;
    fallback_hardcoded: boolean;
  };
}
```

---

## 7. ESTRATÉGIA SQL VS TYPESCRIPT — DECISÃO DETALHADA

### 7.1 Manutenção

**TypeScript vence.** O código de `engineFinanceira.ts` (356 linhas) é 10x mais legível que o PL/pgSQL equivalente. Comentários, tipos, refatoração segura por IDE.

### 7.2 Testes

**TypeScript vence.** É possível testar `calcularPreco()` com Jest sem mockar Supabase (basta mockar as queries de consulta). Para testar a trigger SQL, seria necessário criar um banco de teste real.

### 7.3 Rastreabilidade

**TypeScript vence.** O array `memoria_calculo[]` dá visibilidade total de cada passo. SQL não tem capacidade de log de cálculo sem criar tabela auxiliar.

### 7.4 Multi-tenant

**TypeScript vence.** `tenant_id` é passado explicitamente no `PricingInput` e filtrado em cada query. Na trigger SQL o RLS aplica, mas a lógica de cálculo não tem visibilidade do tenant.

### 7.5 APIs (Edge Function)

**TypeScript vence.** O engine pode ser exposto como Edge Function sem modificação. Uma trigger SQL só pode ser chamada indiretamente via INSERT.

### 7.6 Simulação (Visualizar Impacto)

**TypeScript vence.** `modo: 'preview'` no engine retorna resultado sem tocar no banco. Trigger SQL não tem conceito de preview.

### 7.7 Performance

**SQL vence tecnicamente**, mas na prática a diferença é irrelevante. As queries do engine são simples (SELECT em tabelas indexadas). O round-trip de rede do Supabase domina o tempo de resposta, não o cálculo.

### 7.8 Decisão Final

| Componente | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| **Engine de precificação** | **TypeScript** | Testabilidade, rastreabilidade, preview, APIs |
| **Propagação financeira** | **SQL (trigger M66)** | Consistência ACID, atomicidade, performance |
| **Validação de constraints** | **SQL (CHECK, FK, UNIQUE)** | Garantia de integridade |
| **Auditoria financeira** | **SQL (triggers auditoria)** | Imutabilidade, rastreamento independente |
| **Relatórios financeiros** | **SQL (views)** | Performance em agregações |

---

## 8. IMPACTO NO SUPABASE

### 8.1 Tabelas que precisam de ajuste

| Tabela | Ajuste | Prioridade |
|--------|--------|-----------|
| `tabelas_valores` | ✅ Adicionar `tenant_id` + RLS | **P0** |
| `tabelas_valores` | ✅ Unificar `km_franquia`/`franquia_km` → `franquia_km` | **P0** |
| `tabelas_valores` | ✅ Adicionar `percentual_prestador` DEFAULT 80 | **P1** |
| `tabelas_valores` | ✅ Migration oficial com todas as colunas do novo schema | **P1** |
| `tabela_prestador` | ✅ Adicionar `tenant_id` + RLS | **P0** |
| `tabela_prestador` | ✅ Mover para `supabase/migrations/` com migration oficial | **P1** |
| `alocacoes_escala` | ✅ Coluna `tabela_valores_id` — garantir que é populada pelo engine | **P2** |
| `alocacoes_escala` | ✅ Adicionar colunas `valor_espera`, `valor_reentrega`, `valor_devolucao` | **P1** |
| `veiculos` | ✅ `prestador_vinculado` TEXT → UUID com FK | **P1** |
| `clientes` | ✅ Garantir `aliquota_iss` preenchido para todos | **P2** |

### 8.2 Trigger M66 — Ajustes necessários

1. **Adicionar cálculo de `outros_custos`** completo (combustível + ajudante + adicional - desconto), não apenas `adicional`
2. **Adicionar colunas `combustivel_valor`, `ajudante_valor`, `adicional_valor`, `desconto_valor`** na INSERT/UPDATE de `composicao_financeira_os` (a M66 atual já tem estes campos, mas precisam ser confirmados)
3. **Garantir que `financeiro_pagar.valor`** inclua pedágio + adicionais (não apenas repasse)
4. **Adicionar log de cálculo** opcional (salvar `memoria_calculo` em `composicao_financeira_os.origem_calculo`)

### 8.3 RLS — Políticas necessárias

```sql
-- tabelas_valores: adicionar tenant_id RLS
CREATE POLICY "tv_tenant_select" ON tabelas_valores
  FOR SELECT USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "tv_tenant_insert" ON tabelas_valores
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id_safe());
CREATE POLICY "tv_tenant_update" ON tabelas_valores
  FOR UPDATE USING (tenant_id = current_tenant_id_safe());
CREATE POLICY "tv_tenant_delete" ON tabelas_valores
  FOR DELETE USING (tenant_id = current_tenant_id_safe());

-- tabela_prestador: adicionar tenant_id + RLS (mesmo padrão)
```

---

## 9. IMPACTO NO FINANCEIRO

### 9.1 Cadeia de valores corrigida

```
ANTES (Missão 74):
  Usuário digita valores manualmente na alocação
    → Trigger P0 (regredida) propaga com margens erradas
    → TS duplica com outra lógica
    → Composicao_financeira_os com outros_custos = 0

DEPOIS (Missão 76+):
  Engine calcula automaticamente
    → Salva na OS/Escala (valores calculados + fontes)
    → Trigger M66 propaga para tabelas financeiras
    → Composicao_financeira_os com todos os custos
    → Margem correta: cliente - prestador - pedagio - combustivel - ajudante - adicional + desconto
```

### 9.2 Fórmula oficial de margem

```
Margem Bruta = valor_cliente_total
             - valor_prestador_total
             - pedagio
             - combustivel
             - ajudante
             - outros_custos

Margem Líquida = Margem Bruta
               - imposto (aliquota_iss do cliente, default 4.5%)
               - seguro (1% default, ou da tabela)

Percentual = Margem / valor_cliente_total * 100
```

### 9.3 Onde cada custo entra

| Custo | Lado Cliente | Lado Prestador | Margem |
|-------|-------------|----------------|--------|
| KM base | `valor_base` | `valor_base_prestador` | ✅ Incluído |
| KM excedente | `adicionais.km_excedente` | `adicionais.km_excedente` | ✅ Incluído |
| Pedágio | `adicionais.pedagio_cobrado` | `adicionais.pedagio` | ⚠️ Duplicado se ambos preenchidos. Engine deve evitar |
| Ajudante | — | `adicionais.ajudante` | ✅ Correto (custo do prestador) |
| Espera | `adicionais.espera` | — | ✅ Correto (receita do cliente) |
| Combustível | — | `descontos.combustivel` | ✅ Correto (custo do prestador) |
| Reentrega | `adicionais.reentrega` | — | ✅ Correto (receita do cliente) |
| Devolução | `adicionais.devolucao` | — | ✅ Correto |
| Agendamento | `adicionais.agendamento` | — | ✅ Correto |
| Overbooking | Substitui `valor_base` | Percentual | ✅ Correto |
| Segunda saída | `adicionais.segunda_saida` (se cobrar) | `adicionais.segunda_saida` (se pagar) | ✅ Correto |

---

## 10. IMPACTO NO PAINEL CLIENTE

### 10.1 Novo Pedido

Quando o cliente cria um pedido pelo Portal, o engine será chamado em modo `preview` para exibir:

- Valor do frete (baseado na tabela comercial do cliente)
- Adicionais aplicáveis
- Prazo estimado
- **Sem expor custo do prestador ou margem**

### 10.2 Relatórios

As views de relatório (`vw_relatorio_faturamento_cliente`, etc.) continuam usando os dados já persistidos. O engine não impacta diretamente — os valores corretos estarão no banco.

### 10.3 Rastreamento

O Portal Cliente não consulta o engine. Os valores já estão salvos quando o cliente acessa.

---

## 11. IMPACTO NO APP MOTORISTA

### 11.1 Proposta de Frete

Quando o motorista recebe uma proposta no App:

- O engine **já foi chamado** no momento da alocação
- O `valor_repasse` já está calculado
- O App apenas exibe o valor final

### 11.2 Sem engine no app

O App Motorista (Flutter) **nunca chama o engine diretamente**. O engine roda exclusivamente no lado TMS (web).

---

## 12. PLANO DE CORREÇÃO P0 — PARA MISSÃO 76

### 12.1 Lista de Correções

| # | Problema | Correção | Arquivo | Complexidade |
|---|----------|----------|---------|-------------|
| P0.1 | **Trigger P0 regrediu** | Garantir que M66 está ativa. Remover P0 se existir | SQL migration | Baixa |
| P0.2 | **Duplicação TS vs SQL** | Remover `sincronizarFinanceiroOSAlocacao()` de `ordemServicoService.ts`. Manter trigger M66 como única fonte de propagação | `ordemServicoService.ts` | Média |
| P0.3 | **Campos financeiros do prestador não usados** | Engine deve consultar `prestadores.valor_diaria/valor_km/franquia_km` como fallback para `tabela_prestador` | `precificacaoEngineService.ts` | Alta |
| P0.4 | **engineFinanceira.ts morto** | Criar `precificacaoEngineService.ts` que importa `engineFinanceira.ts` como core. Wrapper que prepara `EngineParams` | Novo service | Alta |
| P0.5 | **km_franquia vs franquia_km** | Unificar para `franquia_km`. Migration RENAME COLUMN. Ajustar 22+ referências | Migration + código | Média |
| P0.6 | **Botão Visualizar Impacto decorativo** | Conectar ao engine em modo `preview`. Exibir resultado em modal/drawer | `TabelaValoresForm.tsx` | Média |
| P0.7 | **tabelas_valores sem tenant_id** | Migration ADD COLUMN `tenant_id` + RLS | SQL migration | Baixa |
| P0.8 | **tabelas_valores e tabela_prestador sem integração** | Engine é a integração. Consulta ambas e combina resultados | `precificacaoEngineService.ts` | Alta |
| P0.9 | **TABELA_TESTE_VEICULOS_SP fallback hardcoded** | Substituir por consulta real. Se não houver tabela, engine retorna erro com alerta claro | `calculoService.ts` + engine | Média |
| P0.10 | **OS não filtra tabela por cliente_id** | Engine filtra por `cliente_id` (UUID) com fallback para `universal=true` | Engine | Baixa |

### 12.2 Ordem de Implementação

```
FASE 1 — Fundação (Missão 76.1)
├── P0.7: Adicionar tenant_id + RLS em tabelas_valores
├── P0.5: Unificar km_franquia/franquia_km
├── P0.1: Garantir M66 ativa, remover P0
└── P0.2: Remover sincronizarFinanceiroOSAlocacao()

FASE 2 — Engine (Missão 76.2)
├── P0.4: Criar precificacaoEngineService.ts
├── P0.8: Integrar busca de tabelas (cliente + prestador)
├── P0.9: Remover fallback hardcoded, adicionar alertas
├── P0.10: Corrigir filtro por cliente_id
└── P0.3: Conectar campos financeiros do prestador

FASE 3 — Integração (Missão 76.3)
├── P0.6: Conectar Visualizar Impacto ao engine
├── Substituir calcularValorAutomatico() da OS
├── Substituir buscarTabelaValoresCliente() da Escala
└── Testes reais com DB live
```

### 12.3 Riscos da Correção

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Engine novo quebrar cálculo existente | Alta | Testar em preview antes de efetivar. Comparar resultado com cálculo antigo |
| Remover `sincronizarFinanceiroOSAlocacao()` causar falta de propagação | Média | Trigger M66 já faz a propagação. Validar com teste real |
| Fallback hardcoded removido expor falta de tabelas | Alta | Engine deve retornar alerta claro "Nenhuma tabela de preços encontrada para este cliente/veículo" |
| Unificar colunas de KM quebrar queries existentes | Média | Migration com RENAME COLUMN + atualização de 22 referências em paralelo |

### 12.4 Validação Pós-Correção

- [ ] `npx tsc --noEmit` — 0 erros
- [ ] `npm run build` — build ok
- [ ] Teste real: criar tabela de valor comercial
- [ ] Teste real: cadastrar prestador com valores financeiros
- [ ] Teste real: criar OS com cliente + prestador
- [ ] Teste real: engine retorna preview com valores corretos
- [ ] Teste real: ao efetivar, financeiro_receber recebe valor do cliente
- [ ] Teste real: pagamentos_prestadores recebe valor líquido correto (repasse + pedagio + adicional - desconto)
- [ ] Teste real: composicao_financeira_os tem margem calculada corretamente
- [ ] Teste real: Visualizar Impacto abre modal com preview
- [ ] Regressão: Playwright existente continua passando

---

## 13. NOVOS ARQUIVOS A CRIAR (Missão 76)

| Arquivo | Descrição |
|---------|-----------|
| `src/services/precificacao/types.ts` | Interfaces `PricingInput`, `PricingOutput`, `ResultadoBuscaTabela` |
| `src/services/precificacao/precificacaoEngineService.ts` | Engine principal (~250 linhas): buscar tabelas + chamar core + montar output |
| `src/services/precificacao/buscarTabelasService.ts` | Serviço de consulta: busca em `tabelas_valores` (6 níveis) + `tabela_prestador` (6 níveis) + `prestadores` + `veiculos` |

## 14. ARQUIVOS A MODIFICAR (Missão 76)

| Arquivo | Modificação |
|---------|-------------|
| `src/utils/engineFinanceira.ts` | Adicionar export para wrapper. Nenhuma alteração na lógica interna |
| `src/services/ordemServicoService.ts` | Remover `sincronizarFinanceiroOSAlocacao()` (linhas 573-690). Manter validação |
| `src/components/operacao/OrdemServicoForm.tsx` | Substituir `recalcularValores()` → engine. Remover `buscarTabelaValores()` + `calcularValorAutomatico()` |
| `src/components/operacao/EscalaLista.tsx` | Substituir `buscarTabelaValoresCliente()` → engine |
| `src/components/comercial/TabelaValoresForm.tsx` | Adicionar `onClick` no Visualizar Impacto → engine preview |
| `src/components/comercial/SimuladorFrete.tsx` | Substituir valores hardcoded → engine real |
| `src/services/financeiro/calculoService.ts` | Marcar como `@deprecated`. Redirecionar para engine |
| `supabase/migrations/` | 3 novas migrations: tenant_id, unificar km, trigger M66 definitiva |

---

## 15. MÉTRICAS DE SUCESSO

| Métrica | Atual (Missão 74) | Esperado (Missão 76) |
|---------|-------------------|---------------------|
| **Número de engines concorrentes** | 6 (3 TS + 1 inline OS + 1 inline Escala + 1 trigger) | **1** (engine TS + trigger SQL) |
| **Fontes de verdade para margem** | 4 (frontend, service, trigger M66, trigger P0) | **1** (engine TS, confirmado por trigger M66) |
| **Campos financeiros do prestador usados** | 0 de 9 | **9 de 9** (via engine, como fallback) |
| **Linhas de código duplicado** | ~400 (TS duplica trigger) | **0** |
| **Visualizar Impacto** | ❌ Decorativo | ✅ Preview real |
| **Testes reais com DB live** | ❌ Não executados | ✅ 8 cenários validados |
| **TABELA_TESTE_VEICULOS_SP em produção** | ✅ Ativa | ❌ Removida (com warning se não houver tabela) |
