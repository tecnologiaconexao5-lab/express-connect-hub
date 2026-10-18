# MISSÃO 84 — REDE ENTERPRISE DE PRESTADORES

**Data:** 2026-07-05
**Status:** ✅ Implantado e homologado (tsc 0 erros, build ok)

---

## Resumo Executivo

Rede Enterprise de Prestadores integrada ao fluxo real da Conexão Express. A Rede não é um sistema separado — é uma forma inteligente de alocação dentro da OS e Escala existentes.

### O que foi criado

| Item | Descrição |
|------|-----------|
| `rede_oportunidades` | Tabela de oportunidades vinculadas a OS |
| `rede_visualizacoes` | Tabela de rastreio de visualizações/interesse |
| `f_buscar_prestadores_compativeis()` | RPC de matching por veículo, região, temperatura, score |
| `f_aceitar_oportunidade_rede()` | RPC atômica de aceite (único ponto, sem race condition) |
| `redePrestadoresService.ts` | Service TypeScript (10 métodos) |
| UI na OS | Botão "Enviar para Rede" + painel de compatíveis |
| Teste Supabase | `scripts/m84_test_rede_prestadores.ts` |
| Teste Playwright | `tests/e2e/m84_rede_prestadores.spec.ts` |

### O que NÃO foi criado

- ❌ Não foi criada segunda máquina de estados
- ❌ Não foi criado fluxo paralelo
- ❌ Não foi criado cálculo financeiro novo
- ❌ Não foi criada persistência financeira em TypeScript
- ❌ Não foi alterado Portal Cliente (Rede é interna)

---

## Tabelas Reutilizadas

| Tabela | Como foi reutilizada |
|--------|----------------------|
| `ordens_servico` | OS recebe `prestador_id` e `prestador` ao aceitar via Rede |
| `prestadores` | Fonte de dados para filtro de compatibilidade (status, região, score) |
| `veiculos_prestadores` | Tipo de veículo, capacidade, placa para matching |
| `alocacoes_escala` | Criada/atualizada via `sincronizarComEscala()` após aceite |
| `os_historico` | Timeline registra eventos: enviado para rede, aceite, cancelamento |
| `financeiro_receber` | Propagado via triggers M66/M80 existentes (sem alteração) |
| `financeiro_pagar` | Propagado via triggers existentes |
| `pagamentos_prestadores` | Propagado via triggers existentes |

---

## Tabelas Criadas

### `rede_oportunidades`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Primary key |
| os_id | UUID FK → ordens_servico | **UNIQUE** — apenas 1 oportunidade ativa por OS |
| status | ENUM | publicada, visualizada, interessada, aceita, expirada, cancelada |
| prestador_aceite_id | UUID FK → prestadores | Quem aceitou (NULL até aceite) |
| valor_prestador | NUMERIC(12,2) | Valor do engine de precificação |
| veiculo_necessario | JSONB | {tipo, carroceria, capacidade_kg, termica} |
| regiao | TEXT | Região da operação |
| requisitos | JSONB | Requisitos adicionais |
| prazo_expiracao | TIMESTAMPTZ | Expiração automática |
| aceite_em | TIMESTAMPTZ | Quando foi aceita |
| expirada_em | TIMESTAMPTZ | Quando expirou |

**Justificativa para tabela nova:** Nenhuma tabela existente atende ao requisito de rastrear oportunidades de prestadores vinculadas a OS com estados específicos (publicada → visualizada → interessada → aceita). `match_operacoes_prestadores` é para recrutamento (pipeline de onboarding), não para operações reais.

### `rede_visualizacoes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Primary key |
| oportunidade_id | UUID FK → rede_oportunidades | Oportunidade visualizada |
| prestador_id | UUID FK → prestadores | Prestador que visualizou |
| status | TEXT | visualizada ou interessada |
| UNIQUE | (oportunidade_id, prestador_id) | Evita duplicatas |

**Justificativa:** Necessário rastrear quais prestadores visualizaram/interesse sem duplicar dados na tabela principal.

---

## Services

### Criado: `src/services/operacao/redePrestadoresService.ts`

| Método | Descrição |
|--------|-----------|
| `publicarOportunidade()` | Cria oportunidade + atualiza OS + registra timeline |
| `buscarPrestadoresCompativeis()` | Chama RPC `f_buscar_prestadores_compativeis` |
| `registrarVisualizacao()` | Upsert visualização + atualiza status |
| `demonstrarInteresse()` | Upsert interesse |
| `aceitarOportunidade()` | Chama RPC `f_aceitar_oportunidade_rede` + sincronizaEscala + tracking |
| `cancelarOportunidade()` | Cancela + registra timeline |
| `listarOportunidades()` | Lista com filtros + join OS |
| `listarOportunidadesParaPrestador()` | Filtra por compatibilidade com o prestador |
| `obterOportunidade()` | Busca por ID |
| `obterOportunidadePorOS()` | Busca oportunidade ativa de uma OS |

### Reutilizados (sem alteração)

- `ordemServicoService.sincronizarComEscala()` — cria/atualiza alocação
- `trackingService.gerarLinkRastreio()` — gera link de rastreio
- Triggers M66/M80 — propagação financeira automática
- UI `SearchableSelect` existente para prestador direto

---

## Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/operacao/OrdemServicoForm.tsx` | + imports Rede, + states, + handlers, + useEffect, + botão "Enviar para Rede", + painel de compatíveis, + "ou" separador, + cancelamento |

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20260705_m84_rede_enterprise_prestadores.sql` | Migration completa (tabelas, RPCs, triggers, RLS, índices, Realtime) |
| `src/services/operacao/redePrestadoresService.ts` | Service central (400+ linhas, 10 métodos) |
| `scripts/m84_test_rede_prestadores.ts` | Teste Supabase (13 cenários) |
| `tests/e2e/m84_rede_prestadores.spec.ts` | Teste Playwright (4 cenários) |

---

## Máquina de Estados da Oportunidade

```
                ┌──────────┐
                │ publicada│ ◄── Operador envia OS para Rede
                └────┬─────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
        ┌──────────┐  ┌──────────┐
        │visualizada│  │ expirada │ ◄── Prazo venceu
        └─────┬────┘  └──────────┘
              │
        ┌──────┴──────┐
        ▼             ▼
  ┌──────────┐  ┌──────────┐
  │interessada│  │  aceita  │ ◄── Prestador aceita
  └─────┬────┘  └────┬─────┘
        │            │
        ▼            ▼
  ┌──────────┐  ┌──────────┐
  │  aceita  │  │ OS alocada│ → Escala → Tracking → Financeiro
  └──────────┘  └──────────┘

  Qualquer estado pode ir para "cancelada" (exceto "aceita")
```

**Regra:** A oportunidade não substitui a OS. A OS continua sendo a fonte operacional principal. Quando aceita, a OS atualiza seu `prestador_id` e `status`.

---

## Integração com OS

1. OS criada normalmente (rascunho → pendente)
2. Operador na tela da OS tem duas opções:
   - **Alocar Prestador diretamente**: fluxo existente (SearchableSelect)
   - **Enviar para Rede**: novo botão com ícone `Network`
3. Ao enviar para Rede:
   - OS é atualizada para `pendente` (se estava rascunho)
   - Oportunidade é criada em `rede_oportunidades`
   - Evento "OS enviada para Rede de Prestadores" registrado em `os_historico`
4. Ao aceitar pela Rede:
   - OS recebe `prestador_id` e `prestador` (nome)
   - OS avança para `agendada` (se estava pendente)
   - Evento "Prestador aceitou via Rede" registrado
   - `sincronizarComEscala()` cria/atualiza alocação

---

## Integração com Escala

Após aceite da Rede, `sincronizarComEscala()` é chamada com os dados da OS + prestador_id. A função existente:
- Verifica se já existe alocação para a OS
- Cria ou atualiza `alocacoes_escala`
- Preenche prestador_id, tipo_veiculo, data_escala, origem/destino, valores, etc.

A escala criada aciona os triggers M66/M80 para propagação financeira.

---

## Integração com App Motorista (Flutter)

O App Motorista (projeto Flutter PWA externo) deve:

### 1. Subscribe Realtime
```dart
supabase
  .from('rede_oportunidades')
  .stream(primaryKey: ['id'])
  .subscribe((event, data) {
    // Nova oportunidade publicada
  });
```

### 2. Listar Oportunidades Compatíveis
```dart
// Chamar a função do service via REST/Supabase
// Ou filtrar localmente com dados do prestador
final response = await supabase.rpc(
  'f_buscar_prestadores_compativeis',
  params: { 'p_oportunidade_id': oportunidadeId },
);
```

### 3. Registrar Visualização
```dart
await supabase.from('rede_visualizacoes').upsert({
  'oportunidade_id': oportunidadeId,
  'prestador_id': prestadorId,
  'status': 'visualizada',
});
```

### 4. Aceitar Oportunidade
```dart
final response = await supabase.rpc(
  'f_aceitar_oportunidade_rede',
  params: {
    'p_oportunidade_id': oportunidadeId,
    'p_prestador_id': prestadorId,
  },
);
```

### Dados que o App Motorista NUNCA deve mostrar
- Valor do cliente
- Margem ou lucro
- Dados financeiros internos
- Lista de prestadores que recusaram

### Dados que o App Motorista DEVE mostrar
- Endereço aproximado de coleta/entrega
- Valor do prestador (apenas o valor que será pago a ele)
- Tipo de operação
- Distância
- Janela de coleta
- Observações operacionais

---

## Integração com Portal Cliente

O cliente NÃO vê a Rede interna. O `mapStatusCliente()` existente em `PortalCliente.tsx` mapeia:

| OS Status | Portal Label | Quando |
|-----------|--------------|--------|
| pendente/rascunho | "Pedido recebido" | OS aguardando prestador |
| agendada | "Operação confirmada" | Prestador alocado (via Rede ou direto) |
| em_andamento/em_rota | "Em distribuição" | Operação em andamento |
| entregue/finalizada | "Entrega concluída" | Finalizada |

A Rede não expõe ao cliente: lista de prestadores, quem recusou, margem, valor do prestador, disputa interna.

---

## Integração com Financeiro

**Nenhuma alteração.** O fluxo financeiro existente continua funcionando:

```
Aceite via Rede → OS atualizada com prestador_id
  → sincronizarComEscala() cria alocacao_escala
  → Trigger M66: alocacoes_escala → financeiro_receber + pagamentos_prestadores
  → Trigger M80: ordens_servico → composicao_financeira_os
```

Garantido:
- ✅ Sem duplicidade (UNIQUE os_id nas tabelas financeiras)
- ✅ Sem novo cálculo financeiro (valor já vem do engine)
- ✅ Sem persistência financeira em TypeScript (M80 já removeu)

---

## Evidências dos Testes

### Validação TypeScript
```
npx tsc --noEmit → ✅ 0 erros
npm run build   → ✅ build ok (33s)
```

### Teste Supabase (13 cenários)
`scripts/m84_test_rede_prestadores.ts` cobre:
| # | Cenário | Status |
|---|---------|--------|
| 1 | Buscar dados base (prestadores) | ✅ |
| 2 | Criar OS de teste | ✅ |
| 3 | Publicar oportunidade na Rede | ✅ |
| 4 | Validar status inicial 'publicada' | ✅ |
| 5 | Buscar prestadores compatíveis via RPC | ✅ |
| 6 | Validar score mínimo (se RPC disponível) | ✅ |
| 7 | Oportunidade inválida retorna 0 | ✅ |
| 8 | Registrar visualização | ✅ |
| 9 | Aceitar oportunidade | ✅ |
| 10 | Validar OS atualizada com prestador_id | ✅ |
| 11 | Segundo aceite bloqueado | ✅ |
| 12 | Histórico da OS registrado | ✅ |
| 13 | Trigger de expiração automática | ✅ |

### Playwright (4 cenários)
`tests/e2e/m84_rede_prestadores.spec.ts`:
| # | Cenário | Status |
|---|---------|--------|
| 1 | Formulário de OS carrega | ✅ |
| 2 | Navegação entre abas sem erros | ✅ |
| 3 | Página de Prestadores carrega | ✅ |
| 4 | Service de Rede no bundle | ✅ |

---

## Problemas Encontrados

1. **RPC `f_buscar_prestadores_compativeis` depende de `veiculos_prestadores`**
   - Se prestador não tem veículo cadastrado, não aparece como compatível
   - Comportamento correto (veículo é requisito obrigatório)

2. **UNIQUE(os_id) em `rede_oportunidades`**
   - Impede criar segunda oportunidade para mesma OS
   - Comportamento desejado (apenas 1 oportunidade ativa por OS)

3. **App Motorista Flutter é externo**
   - Integração Realtime/RPC documentada mas não testável neste repositório
   - Depende do time Flutter implementar subscribe + RPC calls

4. **`prestadores` sem coluna `veiculo_tipo` direta**
   - Veículo vem de `veiculos_prestadores` (tabela separada) ou `prestadores.veiculos` (JSONB)
   - RPC faz LEFT JOIN com `veiculos_prestadores`

5. **Trigger de expiração (`trg_rede_oportunidades_expiracao`)**
   - Executa em BEFORE INSERT OR UPDATE, altera status se prazo vencido
   - Testado e validado

---

## Riscos Restantes

| Risco | Gravidade | Mitigação |
|-------|-----------|-----------|
| Race condition em aceite simultâneo | Média | RPC `f_aceitar_oportunidade_rede` usa `SELECT ... FOR UPDATE` |
| App Motorista expõe dados financeiros | Alta | Documentado o que NÃO mostrar; depende do time Flutter |
| Prestador sem veículo em `veiculos_prestadores` | Baixa | Aparece com score_match = 0; não incompatível |
| Multiple oportunidades para mesma OS | Baixa | UNIQUE(os_id) + validação no service |
| Financeiro duplicado | Muito Baixa | Triggers M66/M80 já protegem com UNIQUE + ON CONFLICT |

---

## Recomendação para Missão 85

1. **Criar Edge Function `api/rede-oportunidades`** para simplificar integração do App Motorista (Flutter chama uma API REST, não precisa de lógica de filtro)
2. **Adicionar notificação push/WhatsApp** para prestadores compatíveis quando nova oportunidade for publicada
3. **Implementar scoring com IA** no `f_buscar_prestadores_compativeis` (usar LLM para ranquear por histórico)
4. **Dashboard da Rede** no TMS: página dedicada para operador acompanhar oportunidades ativas
5. **Tempo real** com Realtime: prestadores veem oportunidade em tempo real sem refresh
6. **Métrica de tempo médio de aceite** por tipo de operação/região
7. **Auto-expiragem** com worker (já existe trigger, mas worker pode notificar)
8. **Contingência**: se ninguém aceitar em X horas, escalar para operador via tarefa na Central IA
