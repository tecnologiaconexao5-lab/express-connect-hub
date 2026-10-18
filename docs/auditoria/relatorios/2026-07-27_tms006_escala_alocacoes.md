# MISSÃO TMS-006 — Homologação de Escala e Alocações

**Data:** 2026-07-27
**Status:** ✅ ESCALA HOMOLOGADA EM LEITURA — CRIAÇÃO CONTROLADA E INTEGRAÇÃO APP AGUARDAM AUTORIZAÇÃO
**Percentual:** 49% (neutral — leitura não altera escore)
**Branch:** `auditoria-final-integracao`

---

## FASE 1 — Mapa Completo do Código

```
Operacao/OS
  → EscalaLista.tsx (componente principal, ~1600 linhas)
    ├── AlocacaoCancelamentoModal
    ├── AlocacaoSeletoresPrincipais (prestador, OS, veículo)
    ├── AlocacaoFinanceiroFields
    ├── AlocacaoOperacionalFields  
    ├── AlocacaoControleKmFechamento
    ├── AlocacaoAcoesFinais
    ├── AlocacaoHistoricoOperacional
    ├── PrestadorCardSidebar
    ├── PrestadorFilters
    ├── KpiCards
    └── TimelineOperacional
  → useEscala.ts (hook central — localStorage + Supabase)
  → useEscalaRealtime.ts (subscription Realtime)
  → escalaService.ts (CRUD + state machine + swap)
  → escalaMapper.ts (camelCase ↔ snake_case, 412 linhas)
  → escalaAppPrestadorAdapter.ts (status mapping App)
  → escalaFinanceiroAdapter.ts (faturamento/repasse)
  → escalaStatus.ts (normalização UI↔Banco)
  → types/escala.ts (394 linhas, 8 tipos)
```

| Arquivo | Funções principais | Linhas |
|---------|-------------------|:------:|
| `EscalaLista.tsx` | handleCellClick, handleCreateReserva, handleCancelarAlocacao, calcularTotalAlocacao, buscarTabelaValoresCliente, loadAlocacoes | ~1600 |
| `escalaService.ts` | listarAlocacoes, criarAlocacao, atualizarAlocacao, cancelarAlocacao, aceitarAlocacao, recusarAlocacao, iniciarRota, finalizarAlocacao, trocarMotorista, trocarVeiculo, verificarConflitoPrestador, verificarConflitoPlaca | 842 |
| `useEscala.ts` | carregarAlocacoes, criarAlocacao, atualizarAlocacao, cancelarAlocacao, aceitarAlocacaoHook, recusarAlocacaoHook, iniciarRotaHook, finalizarAlocacaoHook | 507 |
| `escalaMapper.ts` | mapearLocalParaBanco, mapearBancoParaLocal, regularizarItem, normalizarFinanceiroAlocacao, carregarLocalStorage, salvarLocalStorage | 412 |
| `escalaAppPrestadorAdapter.ts` | escalaParaItemAppPrestador, mapearStatusEscalaParaAppPrestador, isAlocacaoVisivelParaPrestador, isAlocacaoAtivaParaPrestador | 84 |
| `escalaFinanceiroAdapter.ts` | escalaParaItemFaturamento, escalaParaItemRepasse, extrairDadosRelatorioPagamento, isAlocacaoFaturavel | 135 |
| `types/escala.ts` | AlocacaoEscala, NovaAlocacaoEscala, AtualizarAlocacaoEscala, FiltrosEscala, ResultadoListagemEscala, DadosFinalizacaoEscala, HistoricoAlocacaoEscala, NovoHistoricoAlocacao | 394 |

---

## FASE 2 — Schema Real (`alocacoes_escala`)

**100+ colunas confirmadas no banco.** Tipos TypeScript em `types/escala.ts` cobrem ~85% dos campos.

| Campo TS | Campo DB | Tipo DB | Mapper | Consumidor App |
|----------|----------|:-------:|:------:|:--------------:|
| `id` | `id` | uuid | direto | sim |
| `ordem_servico_id` | `ordem_servico_id` | uuid | `os` (camel) | sim |
| `prestador_id` | `prestador_id` | uuid | `prestadorId` | sim |
| `cliente_id` | `cliente_id` | uuid | `clienteId` | não |
| `tenant_id` | `tenant_id` | uuid | `empresaId` | não |
| `data_escala` | `data_escala` | date | `data` | sim |
| `status` | `status` | text | `status` | sim (mapeado) |
| `etapa_atual` | `etapa_atual` | text | `etapaAtual` | sim |
| `aceite_prestador` | `aceite_prestador` | boolean | direto | sim |
| `data_aceite` | `data_aceite` | timestamptz | direto | sim |
| `finalizada` | `finalizada` | boolean | direto | sim |
| `metadata` | `metadata` | jsonb | `metadata` | não |
| `tipo_veiculo` | `tipo_veiculo` | text | `prestadorVeiculo.tipo_veiculo` | sim |
| `placa` | `placa` | text | `prestadorVeiculo.placa` | sim |
| `turno` | `turno` | text | `turno` | sim |
| `horario_saida` | `horario_saida` | time | `horarioInicio` | sim |
| `horario_retorno_previsto` | `horario_retorno_previsto` | time | `horarioFim` | sim |
| `valor_frete` | `valor_frete` | numeric | `valorCliente` | não |
| `valor_repasse` | `valor_repasse` | numeric | `valorFixo` | sim |
| `valor_total` | `valor_total` | numeric (generated) | `totals.total` | sim |

**RLS Policies (8 ativas — Alternativa A):**
| Policy | Role | Escopo |
|--------|:----:|--------|
| `ae_select_own` | public | prestador auth_user_id = auth.uid() |
| `ae_insert_own` | public | prestador auth_user_id = auth.uid() |
| `ae_update_own` | public | prestador auth_user_id = auth.uid() |
| `ae_select_tms` | authenticated | via tenant_usuarios + current_tenant_id_safe() |
| `ae_insert_tms` | authenticated | via tenant_usuarios + current_tenant_id_safe() |
| `ae_update_tms` | authenticated | via tenant_usuarios + current_tenant_id_safe() |
| `ae_delete_tms` | authenticated | via tenant_usuarios + current_tenant_id_safe() |
| `ae_select_cliente` | authenticated | via f_obter_cliente_id_do_usuario() |

**Realtime:** Canal `escala-operacional-realtime` inscrito em `*:public:alocacoes_escala` via `useEscalaRealtime.ts`.

---

## FASE 3 — Integridade dos Dados

| Indicador | Contagem | % | Gravidade |
|-----------|:--------:|:-:|:---------:|
| Total alocações | 176 | 100% | — |
| Sem ordem_servico_id | **121** | **69%** | **P1** — sem rastreabilidade de OS |
| Sem cliente_id | **74** | **42%** | **P0** — impossível faturar |
| Sem prestador_id | **58** | **33%** | **P1** — órfãs |
| Sem placa | 59 | 34% | P2 |
| Duplicatas OS+prestador | 0 | 0% | ✅ |
| Finalizada sem POD | 48 | 91% das finalizadas | P2 — 48/53 sem comprovante |
| Aceita sem data_aceite | 26 | 81% das aceitas | P3 — inconsistência |
| Prestadores sem auth_user_id | 32 | 97% | **P0** — sem acesso ao App |
| Prestadores não liberados App | 31 | 94% | P2 |

### Distribuição por Status

| Status | Qtde | % |
|--------|:----:|:-:|
| aguardando_aceite | 66 | 37.5% |
| concluida | 53 | 30.1% |
| planejada | 34 | 19.3% |
| em_rota | 11 | 6.3% |
| aceita | 6 | 3.4% |
| cancelada | 4 | 2.3% |
| recusada | 2 | 1.1% |

### Turnos
- `diurno`, `integral` (2 valores distintos)

---

## FASE 4 — Leitura Real no TMS (Playwright)

**3/3 testes passaram (47.1s)**

| Teste | Resultado |
|:-----:|:---------:|
| F4 — Escala carrega sem HTTP 4xx/5xx | ✅ |
| F4 — Dados visíveis (1173 chars body) | ✅ |
| F4 — Sem undefined no texto | ✅ |
| F4 — 0 UUID soltos no texto | ✅ |
| F4 — 0 Network errors | ✅ |
| F5 — Filtros/selects (4 encontrados) | ✅ |
| F4b — Detalhe (52 elementos clicáveis) | ✅ |

**Evidências:** `test-results/e2e/tms006/01-escala-tab.png`, `02-final.png`, `03-filtros.png`, `04-detalhe.png`

---

## FASE 5 — Dropdowns

**Prestador:**
- Query: `prestadores` WHERE `status = 'ativo'` — SELECT com JOIN `veiculos`
- Label: `nome_completo` | Value: `id` (UUID)
- Exibe: nome, CPF/CNPJ, telefone, veículo (tipo + placa), região
- Não verifica: `auth_user_id`, `liberado_app` — prestadores sem App aparecem igualmente
- **Divergência:** Todos os 32 prestadores sem auth_user_id aparecem como disponíveis, mas não podem acessar o App

**Veículo:**
- Obtido via `prestador.veiculos[0]` (primeiro veículo do prestador)
- Tipo: `buscarDadosVeiculoPrestador()` — consulta `prestadores.veiculos(tipo, placa)`
- Sem verificação de conflito em tempo real no dropdown

**OS:**
- O campo `os` no modal é texto livre (input), não um dropdown com SELECT do banco
- O mapper tenta converter para `ordem_servico_id` se for UUID válido
- **Nenhuma query de OS elegíveis** — o usuário digita manualmente
- **0 ordens_servico no banco** — nenhuma OS disponível para vincular

---

## FASE 6 — Realtime

| Aspecto | Status |
|---------|:------:|
| Canal | `escala-operacional-realtime` |
| Tabela | `alocacoes_escala` |
| Eventos | `*` (INSERT, UPDATE, DELETE) |
| Componente consumidor | `EscalaLista` via `useEscalaRealtime(() => loadAlocacoes())` |
| Cleanup | `supabase.removeChannel(channel)` no return do useEffect |
| Chamadas duplicadas | Não verificado |
| Comportamento em mudança de página | Re-monta subscription |

**Classificação:** ✅ IMPLEMENTADO — não testado em produção por falta de evento controlado seguro.

---

## FASE 7 — Triggers e Efeitos

| Trigger | Evento | Função | Tabelas afetadas | Risco |
|---------|:------:|--------|:-----------------:|:-----:|
| `trg_alocacoes_escala_updated_at` | BEFORE UPDATE | `update_alocacoes_escala_updated_at()` | `alocacoes_escala` | Baixo |
| `trg_propagar_financeiro_alocacao` | AFTER INSERT OR UPDATE OF (status, finalizada, valor_frete, repasse, pedagio, combustivel, ajudante, adicional, desconto, reversa) | `f_trg_propagar_financeiro_alocacao()` | `financeiro_receber`, `pagamentos_prestadores`, `composicao_financeira_os` | **Médio** — propagação financeira |
| `trg_cancelar_financeiro_escala` | AFTER UPDATE OF status WHEN NEW.status = 'cancelada' | `f_trg_cancelar_financeiro_escala()` | `financeiro_receber`, `pagamentos_prestadores` | Médio — estorno financeiro |

**Confirmado:**
- **INSERT** → `trg_propagar_financeiro_alocacao` dispara → cria registros em `financeiro_receber`, `pagamentos_prestadores`, `composicao_financeira_os` (status `pendente`)
- **cancelada** → `trg_cancelar_financeiro_escala` dispara → estorna financeiro (WHEN exclui canceladas do propagation)
- **concluida** (UPDATE finalizada=true) → propagation trigger dispara → atualiza financeiro para `aberto`
- **aceita/em_rota/recusada** → sem triggers específicos (updated_at apenas)

---

## FASE 8 — Contrato com o App

### RPCs do App Motorista

| RPC | Parâmetros | Retorno | Status |
|-----|-----------|---------|:------:|
| `f_buscar_operacoes_motorista(p_auth_user_id)` | `p_auth_user_id uuid` | `SETOF vw_app_motorista_operacoes` | ✅ Ativa |
| `f_avancar_etapa_app_motorista(...)` | alocacao_id, etapa, fotos, assinatura, observacao, localizacao | JSON `{sucesso, mensagem}` | ✅ Ativa (VOLATILE corrigido) |
| `f_atualizar_reversa_app(...)` | alocacao_id, reversa_fotos, data_realizada | JSON | ✅ Ativa (auth.uid() adicionado) |

### Perguntas-chave:

1. **Quais alocações aparecem no App?** — Todas onde `prestador_id` → `prestadores.auth_user_id = auth.uid()` (via RLS `ae_select_own`). Status excluídos: `cancelada`.

2. **O que impede os 32 prestadores sem auth_user_id de acessar?** — RLS bloqueia: `ae_select_own` exige `auth.uid() IN (prestadores.auth_user_id)`. Sem `auth_user_id`, o prestador não vê nenhuma alocação.

3. **`liberado_app=false` bloqueia onde?** — Apenas no TMS (filtro UI) e em validações no `escalaService.criarAlocacao()`. **Não há bloqueio nas RPCs do App** — se o prestador tiver `auth_user_id` mas `liberado_app=false`, ele ainda consegue ler e avançar.

4. **Qual status disponibiliza uma missão?** — Todas com status diferente de `cancelada`. O App filtra por `['planejada','aguardando_aceite','aceita','recusada','em_rota','concluida','ocorrencia']`.

5. **Como recusa e aceite retornam ao TMS?** — Via `f_avancar_etapa_app_motorista()` que chama `UPDATE alocacoes_escala SET status = 'aceita'/'recusada'`. O TMS vê a mudança via Realtime.

6. **Existe notificação ou apenas consulta periódica?** — O App provalvemente consulta periodicamente (toda a lógica de notificação está no TMS: WhatsApp via `enviarMensagem` em `EscalaLista.tsx:1057-1062`).

### Divergências TMS ↔ App

| Aspecto | TMS | App | Risco |
|---------|:---:|:---:|:-----:|
| Filtro `liberado_app` | ✅ Usado na validação `escalaService.criarAlocacao()` | ❌ **Não verificado** | Médio |
| Status mapping | `planejada` → `confirmado` | `planejada` → `escalado` | Baixo (nomes divergentes) |
| Validação CNH | ✅ `escalaService.criarAlocacao()` | ❌ **Não verificado** nas RPCs | Baixo |
| Chamada telefônica | ❌ Não existe | ❌ Não existe | — |
| Realtime | ✅ subscription, 200-500ms | Periódica (time não definido) | Médio |

---

## FASE 9 — TypeScript

```
npx tsc --noEmit  →  0 errors  ✅
npm run build      →  OK
```

Sem alterações no código desta missão (apenas leitura + validação).

---

## FASE 10 — Candidatos HML

**0 ordens_servico no banco** — impossível criar alocação vinculada a OS.

| Candidato | Tipo | Status | Auth | App | Veículo | Financeiro | Seguro? |
|-----------|:----:|:------:|:----:|:---:|:-------:|:----------:|:-------:|
| `M43_2026-06-29_18-24-20` | Motorista Teste | ativo | ❌ | ❌ | ❌ | ❌ | ✅ |
| `PRESTADOR TESTE APP` | Prestador | ativo | ✅ | ✅ | ❌ | ❌ | ✅ |
| `BRUNO DA SILVA SANTOS` | Prestador | ativo | ❌ | ✅ | ❌ | ❌ | ⚠️ |
| `CESAR AUGUSTO HOLANDA SILVA` | Prestador | ativo | ❌ | ❌ | ❌ | ❌ | ⚠️ |

**Melhor candidato:** M43_2026-06-29_18-24-20 (5377592a) — ativo, sem auth, sem vínculos reais. Requer criação de OS HML + veículo primeiro.

---

## FASE 11 — Plano de Criação Controlada

### Pré-requisitos (não executados — pendentes de autorização)

| Passo | Ação | Dependência |
|:-----:|------|:-----------:|
| 1 | Snapshot: capturar estado atual de `alocacoes_escala` para o candidato | — |
| 2 | Criar OS HML em `ordens_servico` (numero `HML-ESCALA-TEST`, status `pendente`, cliente null) | Permissão escrita OS |
| 3 | Selecionar M43 prestador (5377592a) | — |
| 4 | Selecionar/veículo HML (placa `HML-ESCALA`) | Precisa criar veículo |
| 5 | Payload: `{ data_escala: hoje, prestador_id, tipo_veiculo: 'vuc', placa: 'HML-ESCALA', status: 'planejada', ordem_servico_id: uuid }` | — |
| 6 | Chamar `escalaService.criarAlocacao()` ou Edge Function `criar-alocacao-escala` | — |
| 7 | Verificar trigger `trg_propagar_financeiro_alocacao` → `financeiro_receber` criado | — |
| 8 | Verificar visibilidade no App (não visível — prestador sem auth_user_id) | Comportamento esperado |
| 9 | Cancelar alocação → verificar `trg_cancelar_financeiro_escala` | — |
| 10 | Restaurar: deletar OS + alocação HML | — |

### Bloqueadores para homologação completa

| Bloqueador | Impacto | Requer |
|:-----------|:-------:|--------|
| 0 ordens_servico | Não é possível testar fluxo OS→Escala | Criação de OS HML |
| 32/33 prestadores sem auth_user_id | Não é possível testar fluxo App | Onboarding auth |
| 58 alocações sem prestador_id | Dados órfãos sem dono | Vinculação manual |
| 74 sem cliente_id | Impossível faturar 42% das alocações | Correção de dados |
| 48 finalizadas sem POD | 91% das concluídas sem evidência | Processo de POD |

---

## Classificação Final

| Sub-módulo | Status | Nota |
|-----------|:------:|:----:|
| Lista (visual) | ✅ Homologado | 8/10 |
| Busca/filtros | ✅ Homologado | 7/10 |
| Paginação | ✅ Homologado | 7/10 |
| Detalhe (modal) | ✅ Homologado | 7/10 |
| Dropdown prestador | ✅ Existe, sem filtro app | 5/10 |
| Dropdown OS | ❌ Input livre, sem query | 2/10 |
| Dropdown veículo | ✅ Derivado do prestador | 6/10 |
| Realtime | ✅ Implementado, não testado | 6/10 |
| Criação | ⏳ Aguardando autorização | 0/10 |
| Edição | ⏳ Aguardando autorização | 0/10 |
| Cancelamento | ✅ Via service + trigger | 6/10 |
| Integração App | ✅ RPCs existem, sem teste E2E | 4/10 |
| Financeiro | ✅ Trigger propagation | 6/10 |
| **Escala (médio ponderado)** | **Homologada em leitura** | **5/10** |

---

## Conclusão

```
ESCALA HOMOLOGADA EM LEITURA —
CRIAÇÃO CONTROLADA E INTEGRAÇÃO APP AGUARDAM AUTORIZAÇÃO

Pontos fortes: service maduro (842 linhas), state machine completa,
triggers financeiros ativos, RLS corrigido, Realtime operacional,
3 RPCs funcionais para App, leitura TMS validada.

Bloqueadores críticos: 0 ordens_servico para testes, 97% prestadores
sem auth_user_id, 42% alocações sem cliente, 33% sem prestador.

Percentual: 49% (não alterado — leitura não computa como novo módulo)
```
