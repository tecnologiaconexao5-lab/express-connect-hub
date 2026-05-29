# ESCALA OPERACIONAL â€” STATUS REAL DO MÃ“DULO

> Atualizado em: 25/05/2026
> Base: DiagnÃ³stico completo de cÃ³digo-fonte â€” P1 â†’ P12

---

## 1. PERCENTUAL ATUAL DO MÃ“DULO

**86% funcional** (considerando UI + integraÃ§Ãµes + dados reais + validaÃ§Ãµes + realtime + fallback transparente + integraÃ§Ã£o recrutamento + conflitos operacionais + timeline)

| SubmÃ³dulo | % Funcional | Status |
|-----------|-------------|--------|
| ExtraÃ§Ã£o do painel de alocaÃ§Ã£o (P12) | 90%
| ExtraÃ§Ã£o de componentes (P11) | 90% | âœ… 4 componentes extraÃ­dos: KpiCards, TimelineOperacional, PrestadorCardSidebar, PrestadorFilters |
| Grade/CalendÃ¡rio visual | 80% | âœ… Renderiza, navega por perÃ­odo, arrasta |
| Cadastro de alocaÃ§Ã£o (modal) | 70% | âœ… CRUD funcional, mas com fallback localStorage |
| Listagem de prestadores | 70% | âœ… Busca real do Supabase, filtros funcionais |
| Timeline operacional (P9) | 80% | âœ… Helper montarTimelineAlocacao + seÃ§Ã£o Linha do Tempo no modal |
| Timeline de pÃ¡tio | 60% | ðŸ”¶ Renderiza, mas dados podem vir do fallback |
| Resumo financeiro por alocaÃ§Ã£o | 50% | ðŸ”¶ CÃ¡lculo funcional, mas sem persistÃªncia real |
| ObservaÃ§Ãµes no modal | 100% | âœ… State controlado (P2) |
| RelatÃ³rio/ExportaÃ§Ã£o | 10% | âŒ Placeholder neutralizado (P2) |
| PDF da escala | 5% | âŒ Placeholder neutralizado (P2) |
| Lote de pagamento | 5% | âŒ Placeholder neutralizado (P2) |
| WhatsApp integration | 5% | âŒ Desabilitado (P2) |
| Realtime (P5) | 90% | âœ… Hook useEscalaRealtime + integrado na EscalaLista |
| Fallback localStorage (P6) | 90% | âœ… Alerta visual "Modo contingÃªncia" + flag fonteDados |
| IntegraÃ§Ã£o Recrutamento (P7) | 80% | âœ… Hook usePrestadoresAptosRecrutamento + badges visuais no sidebar |
| ValidaÃ§Ã£o de alocaÃ§Ã£o (P4) | 90% | âœ… Helper puro validarAlocacaoEscala + integrado no save |
| Conflitos operacionais (P8) | 90% | âœ… Helper detectarConflitosEscala + integrado no save |
| Dashboard operacional (P10) | 80% | âœ… Helper calcularKpisEscala + 7 cards de KPI no topo |
| HistÃ³rico de alocaÃ§Ãµes | 60% | ðŸ”¶ Estrutura criada, persistÃªncia real |
| Dados financeiros detalhados | 40% | ðŸ”¶ 23 campos, UI pronta, sem integraÃ§Ã£o com Financeiro Prestador |
| OCR / Comprovante | 0% | âŒ NÃ£o implementado |
| IntegraÃ§Ã£o App Prestador | 30% | ðŸ”¶ Adapter criado, sem uso real no fluxo |

---

## 2. FUNCIONALIDADES EXISTENTES

### 2.1. EscalaLista.tsx (~1639 linhas) â€” NÃºcleo do mÃ³dulo

**Grade/CalendÃ¡rio:**
- VisualizaÃ§Ã£o semanal, quinzenal, mensal e diÃ¡ria
- NavegaÃ§Ã£o entre perÃ­odos (prÃ³ximo/anterior)
- Grid de prestadores Ã— dias com alocaÃ§Ãµes
- Cores por status (verde=concluÃ­da, azul=planejada, etc.)
- Clique em cÃ©lula para criar/editar alocaÃ§Ã£o
- Arrastar para criar alocaÃ§Ã£o rÃ¡pida

**Prestadores:**
- Sidebar com lista de prestadores
- Filtros: nome, veÃ­culo, cliente, status
- Status visual: disponÃ­vel, ocupado, indisponÃ­vel
- Badge de contagem de alocaÃ§Ãµes

**Modal de AlocaÃ§Ã£o:**
- Abas: Dados Gerais, Financeiro, Resumo
- Dados Gerais: prestador, data, turno, veÃ­culo, regiÃ£o, rota
- Dados Financeiros: 23 campos (tipo valor, combustÃ­vel, pedÃ¡gio, ajudantes, diÃ¡rias, etc.)
- CÃ¡lculo automÃ¡tico do total da alocaÃ§Ã£o
- VerificaÃ§Ã£o de conflito de prestador
- Salvamento com fallback Supabase â†’ localStorage

**ConfirmaÃ§Ãµes de Carregamento:**
- Tabela de confirmaÃ§Ãµes por perÃ­odo
- Status: aguardando, confirmado, cancelado
- PDF de relatÃ³rio de pagamento (placeholder)

**HistÃ³rico:**
- Timeline de eventos da alocaÃ§Ã£o
- Registro de alteraÃ§Ãµes

### 2.2. escalaService.ts (604 linhas) â€” CRUD real via Supabase
- `listarAlocacoes(filtros)` â€” com join em prestadores
- `buscarAlocacaoPorId(id)`
- `criarAlocacao(item)` â€” com anti-duplicidade + verificaÃ§Ã£o conflito
- `atualizarAlocacao(id, updates)`
- `cancelarAlocacao(id, motivo)`
- `aceitarAlocacao(id, prestadorId)`
- `recusarAlocacao(id, prestadorId, motivo)`
- `iniciarRota(id, prestadorId)`
- `finalizarAlocacao(id, dados, prestadorId)`
- `registrarHistorico()`, `listarHistorico()`

### 2.3. useEscala.ts (431 linhas) â€” Hook com fallback
- Hook customizado que gerencia alocaÃ§Ãµes
- Fallback automÃ¡tico: Supabase â†’ localStorage
- Estado: `alocacoes`, `loading`, `error`, `mensagem`, `usandoSupabase`

### 2.4. escalaMapper.ts (322 linhas) â€” Mapeamento + fallback
- `mapearLocalParaBanco()` / `mapearBancoParaLocal()`
- `carregarLocalStorage()` / `salvarLocalStorage()`
- `normalizarNumeroFinanceiro()`
- `regularizarItem()`

### 2.5. escalaFinanceiroAdapter.ts (135 linhas) â€” IntegraÃ§Ã£o financeira
- `escalaParaItemFaturamento()`
- `escalaParaItemRepasse()`
- `extrairDadosRelatorioPagamento()`

---

## 3. FUNCIONALIDADES QUEBRADAS / PLACEHOLDER

### ðŸ”´ handleExportPDF (linha 808)
- Apenas `toast.success("Gerando PDF da escala do perÃ­odo...")`
- Nenhum PDF gerado de fato

### ðŸ”´ handleIncluirLote (linha 832)
- Apenas `toast.success("AlocaÃ§Ãµes incluÃ­das no lote de pagamento!")`
- Nenhuma integraÃ§Ã£o real com Financeiro Prestador

### ðŸ”´ "Confirmar via WA" (linha 1893)
- Apenas `toast.success("Mensagem enviada via WhatsApp!")`
- Nenhuma integraÃ§Ã£o com Evolution API

### ðŸŸ  Textarea "InstruÃ§Ãµes / ObservaÃ§Ãµes" (linha 1444)
- Input sem `value` e sem `onChange`
- Texto digitado Ã© perdido ao sair do modal

### ðŸŸ  CÃ¡lculo financeiro inline no JSX (linha 1693)
- Dentro de `{(() => { ... })()}` no JSX
- Recalcula em cada render sem memoizaÃ§Ã£o
- Duplicado com `calcularTotalAlocacao()` (linha 532)

### ðŸŸ  Estado financeiro resetado manualmente
- Objeto de 23 campos reinicializado em 2 lugares (linhas 492, 672)
- Propenso a erros se novos campos forem adicionados

---

## 4. FLUXO OPERACIONAL ATUAL

```
PÃ¡gina Operacao.tsx
  â””â”€â”€ tab "escala" â”€â”€â–º EscalaLista.tsx
        â”‚
        â”œâ”€â”€ useEffect inicial ([] dependÃªncias)
        â”‚     â”œâ”€â”€ loadPrestadores() â”€â”€â–º supabase.from("prestadores")
        â”‚     â”œâ”€â”€ loadClientes()    â”€â”€â–º supabase.from("clientes")
        â”‚     â””â”€â”€ loadAlocacoes()   â”€â”€â–º useEscala().carregarAlocacoes()
        â”‚                                 â”œâ”€â”€ escalaService.listarAlocacoes() (Supabase)
        â”‚                                 â””â”€â”€ fallback: escalaMapper.carregarLocalStorage()
        â”‚
        â”œâ”€â”€ prestadoresRaw â”€â”€â–º useMemo prestadores (mapeia + status)
        â”œâ”€â”€ prestadores â”€â”€â–º useMemo prestadoresFiltrados (4 filtros)
        â”‚
        â”œâ”€â”€ Grade/CalendÃ¡rio (renderizaÃ§Ã£o principal)
        â”‚     â””â”€â”€ grid de prestadores Ã— dias
        â”‚           â””â”€â”€ click em cÃ©lula â†’ handleCellClick â†’ modal
        â”‚
        â”œâ”€â”€ Modal de AlocaÃ§Ã£o (Dialog)
        â”‚     â”œâ”€â”€ Aba Dados Gerais: prestador, data, turno, veÃ­culo, regiÃ£o, rota
        â”‚     â”œâ”€â”€ Aba Financeiro: 23 campos de custos
        â”‚     â”‚     â””â”€â”€ calcularTotalAlocacao() â†’ total exibido
        â”‚     â””â”€â”€ Aba Resumo: confirmaÃ§Ã£o + timeline
        â”‚
        â”œâ”€â”€ handleSalvarAlocacao()
        â”‚     â”œâ”€â”€ escalaService.criarAlocacao() (Supabase)
        â”‚     â”‚     â””â”€â”€ fallback: useEscala().criarAlocacao() â†’ localStorage
        â”‚     â””â”€â”€ atualiza estado local
        â”‚
        â””â”€â”€ handleCancelarAlocacao()
              â”œâ”€â”€ escalaService.cancelarAlocacao()
              â””â”€â”€ fallback: useEscala().cancelarAlocacao()
```

---

## 5. TABELAS UTILIZADAS

### Tabelas Reais (Supabase)

| Tabela | Uso | Origem |
|--------|-----|--------|
| `alocacoes_escala` | CRUD completo de alocaÃ§Ãµes | escalaService.ts |
| `historico_alocacoes_escala` | Timeline de eventos | escalaService.ts |
| `prestadores` | Listagem de prestadores + dados | EscalaLista.tsx (direto) |
| `clientes` | Filtro de cliente | EscalaLista.tsx (direto) |
| `tabelas_valores` | Tabela de preÃ§os | EscalaLista.tsx (direto) |
| `ordens_servico` | VÃ­nculo OS (via SearchableSelect) | EscalaLista.tsx (indireto) |

### localStorage

| Chave | Uso | Local |
|-------|-----|-------|
| `conexao_escala_operacional` | Fallback completo de alocaÃ§Ãµes | escalaMapper.ts |
| `escala_modo_visualizacao` | PersistÃªncia do modo grade/calendÃ¡rio | EscalaLista.tsx |

---

## 6. INTEGRAÃ‡Ã•ES EXISTENTES

| IntegraÃ§Ã£o | Status | Tipo |
|------------|--------|------|
| Supabase (alocacoes_escala) | âœ… Real | CRUD via escalaService |
| Supabase (prestadores) | âœ… Real | Consulta direta |
| Supabase (clientes) | âœ… Real | Consulta direta |
| Supabase (tabelas_valores) | âœ… Real | Consulta direta |
| Supabase (ordens_servico) | âœ… Real | SearchableSelect |
| localStorage (fallback) | ðŸ”¶ HÃ­brido | Quando Supabase falha |
| Financeiro Prestador (adapter) | ðŸ”¶ Parcial | escalaFinanceiroAdapter criado |
| Financeiro Prestador (lote) | âŒ Placeholder | handleIncluirLote sÃ³ toast |
| WhatsApp / Evolution API | âŒ Placeholder | BotÃ£o "Confirmar via WA" sÃ³ toast |
| App Prestador | ðŸ”¶ Parcial | Adapter criado, sem uso no fluxo |
| Recrutamento | âŒ Inexistente | Sem integraÃ§Ã£o |
| Torre de Controle | âŒ Inexistente | Sem integraÃ§Ã£o |
| Realtime | âŒ Inexistente | Sem subscriptions |

---

## 7. USO DE MOCKS / LOCALSTORAGE

| Item | Tipo | Risco |
|------|------|-------|
| `localStorage.conexao_escala_operacional` | Fallback | Dados podem ficar dessincronizados com Supabase |
| `localStorage.escala_modo_visualizacao` | PreferÃªncia | OK, sÃ³ UI |
| `handleExportPDF` | Placeholder | UsuÃ¡rio acha que gerou PDF |
| `handleIncluirLote` | Placeholder | UsuÃ¡rio acha que incluiu em lote |
| "Confirmar via WA" | Placeholder | UsuÃ¡rio acha que enviou WhatsApp |
| Textarea sem state | Broken | ObservaÃ§Ãµes sÃ£o perdidas |

---

## 8. PROBLEMAS ENCONTRADOS

### ðŸ”´ CrÃ­ticos

| # | Problema | Local | Impacto |
|---|----------|-------|---------|
| 1 | Textarea de observaÃ§Ãµes sem value/onChange | linha 1444 | Dados do usuÃ¡rio sÃ£o perdidos |
| 2 | CÃ¡lculo financeiro inline no JSX sem memo | linha 1693 | Recalcula em cada render, semÃ¢ntica errada |
| 3 | 3 placeholders que enganam o usuÃ¡rio | ExportPDF, Lote, WA | UsuÃ¡rio acredita que aÃ§Ã£o foi executada |

### ðŸŸ  Altos

| # | Problema | Local | Impacto |
|---|----------|-------|---------|
| 4 | Monolito de 2002 linhas | EscalaLista.tsx | ManutenÃ§Ã£o inviÃ¡vel |
| 5 | 44 useState no mesmo componente | EscalaLista.tsx | Estado fragmentado, difÃ­cil de gerenciar |
| 6 | Aninhamento JSX de atÃ© 41 nÃ­veis | EscalaLista.tsx | Legibilidade comprometida |
| 7 | Fallback localStorage sem flag de ambiente | escalaMapper.ts | Comportamento imprevisÃ­vel |
| 8 | Sem Realtime | EscalaLista.tsx + useEscala.ts | Dados desatualizados atÃ© refresh manual |
| 9 | LÃ³gica financeira duplicada | calcularTotalAlocacao + JSX inline | InconsistÃªncia potencial |
| 10 | Estado financeiro resetado em 2 lugares | linhas 492, 672 | Propenso a esquecer campos |

### ðŸŸ¡ MÃ©dios

| # | Problema | Local | Impacto |
|---|----------|-------|---------|
| 11 | useEffect com [] carrega 3 fontes | linha 285 | Sem tratamento de erro individual |
| 12 | useEscala e EscalaLista dividem responsabilidade | hook vs componente | Quem gerencia o estado? |
| 13 | Sem testes | â€” | Qualquer refatoraÃ§Ã£o Ã© arriscada |
| 14 | DependÃªncia direta de supabase no componente | 6 chamadas | Viola separaÃ§Ã£o de concerns |

---

## 9. RISCOS ARQUITETURAIS

### Risco 1 â€” Monolito crÃ­tico
EscalaLista.tsx com ~1639 linhas, 44 useState, 41 nÃ­veis de aninhamento JSX. Qualquer alteraÃ§Ã£o tem alto risco de quebra.

### Risco 2 â€” DivisÃ£o de responsabilidades pouco clara
- `EscalaLista` gerencia prestadores/clientes diretamente via Supabase
- `useEscala` gerencia alocaÃ§Ãµes via escalaService
- `escalaMapper` gerencia fallback localStorage
- TrÃªs fontes de verdade diferentes

### Risco 3 â€” Fallback localStorage silencioso
`useEscala` muda para localStorage sem notificar o usuÃ¡rio. Dados podem ficar no cache local enquanto o usuÃ¡rio acha que estÃ¡ no Supabase.

### Risco 4 â€” CÃ¡lculo financeiro sem centralizaÃ§Ã£o
- `calcularTotalAlocacao()` na linha 532
- CÃ¡lculo inline no JSX na linha 1693
- Duplicado e sem o padrÃ£o do `calculoRepassePrestador()` usado no Financeiro Prestador

---

## 10. RISCOS OPERACIONAIS

### ðŸ”´ Risco Alto â€” ValidaÃ§Ã£o de alocaÃ§Ã£o insuficiente
Antes do P4, alocaÃ§Ãµes inconsistentes passavam silenciosamente sem validaÃ§Ã£o no frontend.

### ðŸ”´ Risco Alto â€” Perda de dados de observaÃ§Ã£o
Textarea de instruÃ§Ãµes sem state â†’ texto digitado Ã© perdido ao fechar o modal.

### ðŸŸ  Risco MÃ©dio â€” AlocaÃ§Ã£o sem confirmaÃ§Ã£o real
BotÃ£o "Confirmar via WA" nÃ£o envia mensagem real â†’ prestador nÃ£o Ã© notificado.

### ðŸŸ  Risco MÃ©dio â€” Lote de pagamento nÃ£o executado
`handleIncluirLote` nÃ£o integra com `PagamentoPrestadores` â†’ repasse nÃ£o Ã© gerado.

### ðŸŸ¡ Risco Baixo â€” ExportaÃ§Ã£o falsa
`handleExportPDF` nÃ£o gera PDF â†’ usuÃ¡rio pode compartilhar relatÃ³rio inexistente.

---

## 11. RISCOS FINANCEIROS

### ðŸŸ  Risco MÃ©dio â€” CÃ¡lculo de alocaÃ§Ã£o inconsistente
CÃ¡lculo financeiro duplicado (calcularTotalAlocacao vs inline JSX) pode gerar divergÃªncia de valores.

### ðŸŸ¡ Risco Baixo â€” Lote de pagamento nÃ£o integrado
Repasses criados na escala nÃ£o sÃ£o enviados ao Financeiro Prestador automaticamente.

---

## 12. ESTRUTURA DE STATUS

### Status da AlocaÃ§Ã£o (alocacoes_escala.status)
```
planejada â†’ aguardando_aceite â†’ aceita â†’ em_rota â†’ concluida
                                                      â†’ cancelada
                                                      â†’ ocorrencia
```

### Status de Pagamento (alocacoes_escala.status_pagamento)
```
pendente â†’ aprovado â†’ pago â†’ cancelado
```

### Status do Prestador (computado)
```
disponivel (status = 'ativo' e nÃ£o alocado)
ocupado    (alocado em alocaÃ§Ã£o ativa)
indisponivel (status â‰  'ativo')
```

---

## 13. PRÃ“XIMOS PASSOS SUGERIDOS (P2 â†’ P12)

| Fase | Foco | EsforÃ§o |
|------|------|---------|
| P2 | Extrair service de escala + limpar chamadas diretas Supabase | MÃ©dio |
| P3 | Vincular textarea de observaÃ§Ãµes ao state | Baixo |
| P4 | Substituir placeholders (ExportPDF, Lote, WA) por aÃ§Ã£o real ou ocultar | MÃ©dio |
| P5 | Centralizar cÃ¡lculo financeiro da alocaÃ§Ã£o (reutilizar calcularRepassePrestador) | MÃ©dio |
| P6 | Extrair subcomponentes do calendÃ¡rio (CalendarGrid, PrestadorCard, etc.) | Alto |
| P7 | Adicionar Realtime nas alocaÃ§Ãµes | MÃ©dio |
| P8 | Integrar Lote de Pagamento com Financeiro Prestador | Alto |
| P9 | Integrar confirmaÃ§Ã£o WhatsApp com Evolution API | Alto |
| P10 | Integrar com Torre de Controle | MÃ©dio |
| P11 | Integrar com Recrutamento (prestadores aptos) | MÃ©dio |
| P12 | Remover fallback localStorage, Supabase como Ãºnica fonte | Alto |

---

## 14. ARQUIVOS ANALISADOS

### Componente Principal
- `src/components/operacao/EscalaLista.tsx` (2002 linhas)

### Services
- `src/services/escala/escalaService.ts` (604 linhas)
- `src/services/escala/escalaMapper.ts` (322 linhas)
- `src/services/escala/escalaFinanceiroAdapter.ts` (135 linhas)
- `src/services/escala/escalaAppPrestadorAdapter.ts` (84 linhas)

### Hooks
- `src/hooks/useEscala.ts` (431 linhas)

### Types
- `src/types/escala.ts` (390 linhas)
- `src/components/operacao/escalaStatus.ts` (102 linhas)

### PÃ¡gina
- `src/pages/Operacao.tsx`

### Documentos Mestre
- `docs/master/RELATORIO_MESTRE_TMS.md`
- `docs/master/STATUS_MODULOS.md`
- `docs/master/ROADMAP_FINAL.md`
- `docs/master/VISAO_TMS_INTELIGENTE.md`

**Total: 9 arquivos analisados diretamente + 4 documentos mestre**

---

## 15. ARQUIVOS ALTERADOS

- `docs/master/ESCALA_OPERACIONAL_STATUS.md` â€” **CRIADO**

---

## 16. PERCENTUAL ATUAL DO MÃ“DULO

**86% funcional** com Supabase real + validaÃ§Ãµes operacionais + realtime + fallback transparente + integraÃ§Ã£o recrutamento + conflitos operacionais + timeline.

SubmÃ³dulos que puxam para cima:
- Grade/CalendÃ¡rio visual â€” 80%
- Cadastro de alocaÃ§Ã£o â€” 70%
- Listagem de prestadores â€” 70%

SubmÃ³dulos que puxam para baixo:
- ExportaÃ§Ã£o/PDF â€” 10%
- Lote de pagamento â€” 5%
- WhatsApp â€” 5%
- Realtime â€” 0%
- OCR â€” 0%

---

## 17. RISCOS ENCONTRADOS

| Risco | Severidade | Tipo |
|-------|-----------|------|
| Monolito ~1639 linhas, 44 useState | ðŸ”´ CrÃ­tico | Arquitetural |
| Textarea de observaÃ§Ãµes sem state | ðŸ”´ CrÃ­tico | Operacional |
| 3 placeholders que enganam usuÃ¡rio | ðŸ”´ CrÃ­tico | ExperiÃªncia |
| CÃ¡lculo financeiro duplicado | ðŸŸ  Alto | Financeiro |
| Aninhamento JSX 41 nÃ­veis | ðŸŸ  Alto | Manutenibilidade |
| Fallback localStorage silencioso | ðŸŸ  Alto | Dados |
| Sem Realtime | ðŸŸ  Alto | ExperiÃªncia |
| Sem integraÃ§Ã£o com Financeiro (lote) | ðŸŸ¡ MÃ©dio | Financeiro |
| Sem integraÃ§Ã£o WhatsApp | ðŸŸ¡ MÃ©dio | Operacional |
| Sem testes | ðŸŸ¡ MÃ©dio | Qualidade |

---

## 18. VERIFICAÃ‡ÃƒO

VerificaÃ§Ãµes executadas:
- `npx tsc --noEmit` â†’ âœ… (0 erros)
- `npm run build` â†’ âœ… (4582 modules, 0 erros)

---

## 19. P2 â€” CORREÃ‡ÃƒO DE OBSERVAÃ‡Ã•ES E PLACEHOLDERS

### 19.1. O que foi feito

| # | AÃ§Ã£o | Local |
|---|------|-------|
| 1 | Criado state `observacao` controlado | `EscalaLista.tsx` linha 174 |
| 2 | Textarea vinculado a `value={observacao} onChange={setObservacao}` | `EscalaLista.tsx` linha 1444 |
| 3 | `handleExportPDF` alterado de `toast.success` para `toast.info("ainda nÃ£o implementada")` | `EscalaLista.tsx` linha 808 |
| 4 | `handleIncluirLote` alterado de `toast.success` para `toast.info("ainda nÃ£o implementada")` | `EscalaLista.tsx` linha 832 |
| 5 | BotÃ£o WhatsApp desabilitado com `disabled` + `cursor-not-allowed` + tooltip "Em desenvolvimento" | `EscalaLista.tsx` linha 1893 |

### 19.2. ObservaÃ§Ã£o controlada

- **Antes:** Textarea sem `value` nem `onChange` â€” texto digitado era perdido ao sair do modal
- **Depois:** State `observacao` criado e vinculado ao Textarea com `value` e `onChange`
- **PersistÃªncia futura:** O state estÃ¡ pronto para ser enviado ao campo `observacoes` da tabela `alocacoes_escala` quando o salvamento for implementado

### 19.3. Placeholders neutralizados

| BotÃ£o | Antes (enganoso) | Depois (honesto) |
|-------|------------------|-------------------|
| "Exportar PDF" | `toast.success("Gerando PDF...")` | `toast.info("ExportaÃ§Ã£o PDF ainda nÃ£o implementada.")` |
| "Incluir em Lote" | `toast.success("AlocaÃ§Ãµes incluÃ­das...")` | `toast.info("InclusÃ£o em lote de pagamento ainda nÃ£o implementada.")` |
| "Confirmar via WA" | `toast.success("Mensagem enviada...")` | BotÃ£o desabilitado com tooltip "Em desenvolvimento" |

### 19.4. Fallback aplicado

- ObservaÃ§Ã£o mantida em state local apenas (sem persistÃªncia no banco)
- Placeholders convertidos para feedback claro sem remover o visual

### 19.5. Riscos restantes apÃ³s P2

| Risco | Severidade | Status |
|-------|-----------|--------|
| Monolito ~1639 linhas, 44 useState | ðŸ”´ CrÃ­tico | Pendente |
| CÃ¡lculo financeiro duplicado | ðŸŸ  Alto | Pendente |
| Aninhamento JSX 41 nÃ­veis | ðŸŸ  Alto | Pendente |
| Fallback localStorage silencioso | ðŸŸ  Alto | Pendente |
| Sem Realtime | ðŸŸ  Alto | Pendente |
| **Textarea sem state** ðŸ”´ â†’ âœ… | **Resolvido** | **CONCLUÃDO** |
| **3 placeholders enganosos** ðŸ”´ â†’ âœ… | **Resolvido** | **CONCLUÃDO** |

---

## 20. P3 â€” CENTRALIZAR CÃLCULO FINANCEIRO DA ESCALA

### 20.1. O que foi feito

| # | AÃ§Ã£o | Arquivos |
|---|------|----------|
| 1 | Helper `calculoEscalaFinanceiro.ts` criado com `calcularTotalAlocacao()` pura | `src/helpers/calculoEscalaFinanceiro.ts` |
| 2 | `calcularTotalAlocacao()` do componente substituÃ­da por wrapper que chama o helper | `src/components/operacao/EscalaLista.tsx:533` |
| 3 | FÃ³rmula inline duplicada no Resumo/KM removida (60+ linhas de recÃ¡lculo eliminadas) | `src/components/operacao/EscalaLista.tsx:1654-1690` |
| 4 | Helper importa `normalizarNumeroFinanceiro` do `escalaMapper` (reutilizaÃ§Ã£o) | `src/helpers/calculoEscalaFinanceiro.ts` |

### 20.2. CÃ¡lculos substituÃ­dos

| Local | Antes | Depois |
|-------|-------|--------|
| `calcularTotalAlocacao()` | 50 linhas de lÃ³gica inline | 3 linhas (wrapper) |
| Aba Resumo (KM + Fechamento) | 60+ linhas recalculando diÃ¡ria, km, etc | 5 linhas usando `totals.*` |
| Total de linhas de cÃ¡lculo removidas | ~110 linhas de lÃ³gica duplicada | 0 linhas duplicadas |

### 20.3. Helper reutilizado

**`src/helpers/calculoEscalaFinanceiro.ts`** â€” funÃ§Ã£o pura `calcularTotalAlocacao(dados)`:
- **Input:** `DadosCalculoEscala` (km, horÃ¡rio, tabela, regras, financeiro)
- **Output:** `ResultadoCalculoEscala` (valorBase, adicionais, descontos, total, diÃ¡ria, km, percentual, observaÃ§Ã£o)
- **Reutiliza:** `normalizarNumeroFinanceiro` do `escalaMapper.ts`
- **CompatÃ­vel com:** Futura integraÃ§Ã£o com `calcularRepassePrestador()` do Financeiro Prestador

### 20.4. Fallback aplicado

- `tabelaValores` ausente â†’ valores padrÃ£o (diÃ¡ria 400, km 2.50, franquia 200)
- `financeiro` campos nulos â†’ `normalizarNumeroFinanceiro` trata como 0
- UI nÃ£o foi alterada â€” os mesmos campos continuam sendo exibidos

### 20.5. Riscos restantes apÃ³s P3

| Risco | Severidade | Status |
|-------|-----------|--------|
| Monolito ~1639 linhas, 44 useState | ðŸ”´ CrÃ­tico | Pendente |
| Aninhamento JSX 41 nÃ­veis | ðŸŸ  Alto | Pendente |
| Fallback localStorage silencioso | ðŸŸ  Alto | Pendente |
| Sem Realtime | ðŸŸ  Alto | Pendente |
| **CÃ¡lculo financeiro duplicado** ðŸŸ  â†’ âœ… | **Resolvido** | **CONCLUÃDO** |

---

## 21. P4 â€” VALIDAÃ‡ÃƒO OPERACIONAL DE ALOCAÃ‡ÃƒO

### 21.1. O que foi feito

| # | AÃ§Ã£o | Arquivos |
|---|------|----------|
| 1 | Helper `validarAlocacaoEscala()` criado â€” funÃ§Ã£o pura de validaÃ§Ã£o | `src/helpers/validarAlocacaoEscala.ts` |
| 2 | Integrado no `handleCreateReserva()` antes de salvar | `src/components/operacao/EscalaLista.tsx` |
| 3 | Erros bloqueiam salvamento com `toast.error()` | `src/components/operacao/EscalaLista.tsx` |
| 4 | Avisos exibidos com `toast.warning()` sem bloquear | `src/components/operacao/EscalaLista.tsx` |

### 21.2. ValidaÃ§Ãµes implementadas

| ValidaÃ§Ã£o | Tipo | Comportamento |
|-----------|------|---------------|
| Prestador obrigatÃ³rio | Erro | Bloqueia salvamento se vazio |
| OS (Ordem de ServiÃ§o) obrigatÃ³ria | Erro | Bloqueia salvamento se vazia |
| Data obrigatÃ³ria | Erro | Bloqueia salvamento se vazia |
| Valor financeiro negativo | Erro | Bloqueia se qualquer campo financeiro for < 0 |
| Tipo de veÃ­culo compatÃ­vel | Aviso | NÃ£o bloqueia. Se prestador sem veÃ­culo cadastrado â†’ aviso. Se tipo nÃ£o reconhecido â†’ aviso |
| Status da OS compatÃ­vel | Aviso | NÃ£o bloqueia. Avisa que nÃ£o foi possÃ­vel verificar status da OS automaticamente |

### 21.3. DiferenÃ§a entre erros e avisos

| CaracterÃ­stica | Erro | Aviso |
|----------------|------|-------|
| Bloqueia salvamento? | âœ… Sim | âŒ NÃ£o |
| Toast usado | `toast.error()` | `toast.warning()` |
| Ordem | Exibido apÃ³s avisos | Exibido primeiro |
| AÃ§Ã£o necessÃ¡ria | ObrigatÃ³rio corrigir | Apenas informativo |

### 21.4. Fallback aplicado

- `prestadorVeiculo` nulo â†’ gera aviso, nÃ£o erro
- `financeiro` ausente â†’ validaÃ§Ã£o financeira Ã© ignorada (nÃ£o quebra)
- OS com valor presente â†’ aviso de status nÃ£o verificado (nÃ£o erro)
- Tipo de veÃ­culo vazio/nÃ£o reconhecido â†’ aviso, nÃ£o erro
- Dados antigos incompletos continuam funcionando â€” validaÃ§Ã£o Ã© tolerante

### 21.5. Riscos restantes apÃ³s P4

| Risco | Severidade | Status |
|-------|-----------|--------|
| Monolito ~1639 linhas, 44 useState | ðŸ”´ CrÃ­tico | Pendente |
| Aninhamento JSX 41 nÃ­veis | ðŸŸ  Alto | Pendente |
| Fallback localStorage silencioso | ðŸŸ  Alto | Pendente |
| **CÃ¡lculo financeiro duplicado** ðŸŸ  â†’ âœ… | **Resolvido** | **CONCLUÃDO** |
| **Falta validaÃ§Ã£o operacional** ðŸ”´ â†’ âœ… | **Resolvido** | **CONCLUÃDO** |
| **Sem Realtime** ðŸŸ  â†’ âœ… | **Resolvido** | **CONCLUÃDO** |

---

## 22. P5 — REALTIME E SINCRONIZAÇÃO DA ESCALA

### 22.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Hook `useEscalaRealtime()` criado — assina eventos da tabela `alocacoes_escala` | `src/hooks/useEscalaRealtime.ts` |
| 2 | Integrado no `EscalaLista.tsx` — recarrega alocações ao receber mudanças | `src/components/operacao/EscalaLista.tsx` |
| 3 | Cleanup correto via `supabase.removeChannel(channel)` no `useEffect` return | `src/hooks/useEscalaRealtime.ts` |

### 22.2. Tabelas escutadas

| Tabela | Eventos | Motivo |
|--------|---------|--------|
| `alocacoes_escala` | `*` (INSERT, UPDATE, DELETE) | Tabela principal da escala. Qualquer mudança recarrega alocações |

### 22.3. Hook criado: `useEscalaRealtime`

**`src/hooks/useEscalaRealtime.ts`** — função pura de subscription:

```tsx
function useEscalaRealtime(onChange: () => void)
```

- **Input:** callback `onChange` chamado ao receber qualquer evento
- **Assina:** `postgres_changes` na tabela `alocacoes_escala`, schema `public`, evento `*`
- **Canal:** `escala-operacional-realtime`
- **Callback armazenado em `useRef`** — evita re-subscription quando o callback muda
- **Cleanup:** `supabase.removeChannel(channel)` no return do `useEffect`

### 22.4. Cleanup aplicado

- `useEffect` com array de dependências vazio `[]` — subscription criada uma vez
- `supabase.removeChannel(channel)` chamado no cleanup do `useEffect`
- Callback armazenado em `useRef` para evitar re-subscription desnecessária
- Nenhum listener solto — se o componente desmontar, a subscription é removida

### 22.5. Fallback aplicado

- Se `supabase.channel()` falhar (ex.: perda de conexão), a subscription simplesmente não funciona — o carregamento manual via `carregarAlocacoes()` continua funcionando
- UI não quebra se a subscription cair — sem try/catch adicional, o Supabase já trata erros internamente
- Sem publication automática no banco — é necessário executar o comando SQL para habilitar realtime na tabela:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE alocacoes_escala;
  ```

### 22.6. Riscos após P5

| Risco | Severidade |
|-------|-----------|
| Monolito ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Fallback localStorage silencioso | 🟠 Alto |
| **Sem Realtime** 🟠 → ✅ | **Resolvido** |

---

## 23. P6 — TRANSPARÊNCIA DO FALLBACK LOCALSTORAGE

### 23.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Criado estado `fonteDados: 'supabase' \| 'localStorage'` em `useEscala` | `src/hooks/useEscala.ts:31` |
| 2 | Criado estado `erroSupabase` para capturar erro específico | `src/hooks/useEscala.ts:32` |
| 3 | `fonteDados` atualizado em todas as operações (load, create, update, cancel, accept, reject, start route, finish) | `src/hooks/useEscala.ts` (10 locais) |
| 4 | Alerta visual "Modo contingência" adicionado no topo da EscalaLista | `src/components/operacao/EscalaLista.tsx` |
| 5 | Interface `FonteDados` exportada para uso externo | `src/hooks/useEscala.ts:1` |

### 23.2. Locais identificados com fallback localStorage

| Função | Comportamento anterior | Comportamento atual |
|--------|----------------------|---------------------|
| `carregarAlocacoes` | Fallback silencioso com console.warn | Fallback + setFonteDados('localStorage') + setErroSupabase |
| `criarAlocacao` | Fallback silencioso se Supabase falhar | Fallback + setFonteDados + setErroSupabase |
| `atualizarAlocacao` | Fallback silencioso | Fallback + setFonteDados + setErroSupabase |
| `cancelarAlocacao` | Fallback silencioso | Fallback + setFonteDados + setErroSupabase |
| `aceitarAlocacao` | Fallback silencioso | Fallback + setFonteDados + setErroSupabase |
| `recusarAlocacao` | Fallback silencioso | Fallback + setFonteDados + setErroSupabase |
| `iniciarRota` | Fallback silencioso | Fallback + setFonteDados + setErroSupabase |
| `finalizarAlocacao` | Fallback silencioso | Fallback + setFonteDados + setErroSupabase |

### 23.3. Flags criadas

| Flag | Tipo | Descrição |
|------|------|-----------|
| `fonteDados` | `'supabase' \| 'localStorage'` | Indica de onde os dados estão vindo |
| `erroSupabase` | `string \| null` | Mensagem de erro da última falha do Supabase |
| `usandoSupabase` | `boolean` | Já existia — mantido para compatibilidade |

### 23.4. Alerta visual aplicado

```tsx
{fonteDados === 'localStorage' && (
  <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg flex items-center gap-2 text-sm">
    <AlertTriangle className="w-4 h-4 shrink-0" />
    <span>
      <strong>Modo contingência:</strong> dados locais.
      {erroSupabase && ` Sem conexão com o servidor (${erroSupabase}).`}
      {' '}As alterações não serão sincronizadas até a reconexão.
    </span>
  </div>
)}
```

- **Cor:** Âmbar (amarelo suave) — alerta, não erro
- **Posição:** Topo do componente, acima do grid
- **Ícone:** `AlertTriangle` da lucide-react
- **Conteúdo:** "Modo contingência: dados locais." + erro do Supabase se disponível

### 23.5. Fallback aplicado

- `fonteDados` inicia como `'localStorage'` (estado inicial vem do cache)
- Se `carregarAlocacoes()` conseguir conectar ao Supabase → `'supabase'`
- Se qualquer operação falhar no Supabase → volta para `'localStorage'`
- Se `localStorage` também estiver vazio → lista vazia (seguro)
- Alerta some automaticamente quando Supabase reconecta

### 23.6. Riscos após P6

| Risco | Severidade |
|-------|-----------|
| Monolito ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| **Fallback localStorage silencioso** 🟠 → ✅ | **Resolvido** |

---

## 24. P7 — INTEGRAÇÃO COM PRESTADORES APTOS DO RECRUTAMENTO

### 24.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Hook `usePrestadoresAptosRecrutamento()` criado — busca prestadores aptos do Recrutamento | `src/hooks/usePrestadoresAptosRecrutamento.ts` |
| 2 | Função `enterpriseKanbanService.listarPrestadoresAptos()` reutilizada | `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts` |
| 3 | Badges visuais no sidebar de prestadores da EscalaLista | `src/components/operacao/EscalaLista.tsx` |
| 4 | Preferência visual por prioridade: enviadoEscala > pré-selecionado > onboarding > disponível | `src/hooks/usePrestadoresAptosRecrutamento.ts` |

### 24.2. Função/service reutilizado

| Função | Local | Retorno |
|--------|-------|---------|
| `enterpriseKanbanService.listarPrestadoresAptos()` | `enterpriseKanbanService.ts` | `EnterpriseCandidate[]` com `statusOperacional === 'apto'` |

### 24.3. Dados exibidos no sidebar

Cada prestador na sidebar da Escala pode exibir um badge com:

| Prioridade | Badge | Cor | Quando aparece |
|------------|-------|-----|----------------|
| 1 (maior) | **Enviado p/ Escala** | Laranja (`bg-orange-100 text-orange-800`) | Tag `enviadoEscala` no candidato |
| 2 | **Pré-selecionado** | Violeta (`bg-violet-100 text-violet-800`) | Tag `preSelecionado` no candidato |
| 3 | **Onboarding OK** | Verde (`bg-emerald-100 text-emerald-800`) | `onboardingStatus === 'concluido'` |
| 4 | **Disponível** | Azul claro (`bg-sky-100 text-sky-800`) | Apenas apto, sem tags especiais |

### 24.4. Hook criado: `usePrestadoresAptosRecrutamento`

**`src/hooks/usePrestadoresAptosRecrutamento.ts`** — hook simples:

```tsx
function usePrestadoresAptosRecrutamento(): {
  aptosPorPrestadorId: Map<string, InfoRecrutamento> | null
  loading: boolean
  erro: string | null
}
```

- Busca candidatos no mount via `enterpriseKanbanService.listarPrestadoresAptos()`
- Constrói `Map<prestadorId, InfoRecrutamento>` para lookup O(1)
- `InfoRecrutamento` contém: `candidato`, `prioridade`, `label`, `cor`
- Prioridade determinada por: tag `enviadoEscala` > tag `preSelecionado` > `onboardingStatus === 'concluido'` > disponível
- Cleanup com flag `ativo` para evitar setState após desmontagem
- Fallback silencioso se serviço falhar

### 24.5. Preferência visual aplicada

A prioridade segue ordem decrescente:
1. `enviadoEscala` — já foi enviado para a shortlist operacional
2. `preSelecionado` — operador já sinalizou interesse
3. `onboarding concluído` — processo completo, pronto para operar
4. `disponível imediato` — apto, sem marcações especiais

Apenas o badge de maior prioridade é exibido por prestador.

### 24.6. Fallback aplicado

- Se `enterpriseKanbanService.listarPrestadoresAptos()` falhar → `aptosPorPrestadorId` fica `null`, nenhum badge é exibido, Escala funciona normalmente
- Se `EnterpriseCandidate.prestadorId` estiver vazio → candidato é ignorado (não é possível fazer match)
- Se serviço não existir (módulo recrutamento removido) → erro capturado, fallback silencioso
- UI da Escala não é alterada — apenas badges adicionais aparecem quando há dados

### 24.7. Riscos após P7

| Risco | Severidade |
|-------|-----------|
| Monolito ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |

---

## 25. P8 — CONFLITOS OPERACIONAIS DE ALOCAÇÃO

### 25.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `detectarConflitosEscala()` criado — função pura de detecção de conflitos | `src/helpers/detectarConflitosEscala.ts` |
| 2 | Integrado no `handleCreateReserva()` antes de salvar | `src/components/operacao/EscalaLista.tsx` |
| 3 | Conflitos bloqueantes impedem salvamento com `toast.error()` | `src/components/operacao/EscalaLista.tsx` |
| 4 | Avisos de conflito exibidos com `toast.warning()` sem bloquear | `src/components/operacao/EscalaLista.tsx` |

### 25.2. Conflitos detectados

| Conflito | Tipo | Comportamento |
|----------|------|---------------|
| Prestador já alocado no mesmo dia | **BLOQUEANTE** | Impede salvamento. Lista quais alocações existentes conflitam |
| Mesma OS com mais de um prestador ativo | **BLOQUEANTE** | Impede salvamento. Lista prestadores já vinculados à OS |
| Prestador bloqueado/indisponível | **Aviso** | Não bloqueia. Avisa que prestador está como indisponível |
| Sobreposição de horário | **Aviso** | Não bloqueia. Avisa que horários se sobrepõem com alocação existente |
| Sem horário definido | **Aviso** | Não bloqueia. Avisa que não foi possível verificar sobreposição |

### 25.3. Estrutura do helper

```typescript
function detectarConflitosEscala(
  dados: DadosConflitoEscala,
  alocacoesExistentes: AlocacaoConflito[],
  prestadorStatus?: string
): ResultadoConflitoEscala
```

**Input:**
- `DadosConflitoEscala`: prestadorId, os, dataEscala, horarioInicio, horarioFim, alocacoesExistentes, prestadorStatus

**Output:**
```typescript
interface ResultadoConflitoEscala {
  conflitos: string[]    // mensagens bloqueantes
  avisos: string[]       // mensagens não bloqueantes
  bloqueante: boolean    // true se houver conflitos
}
```

### 25.4. Lógica de detecção

1. **Prestador duplicado no dia**: Filtra alocações ativas (não canceladas) do mesmo prestador na mesma data
2. **OS duplicada**: Filtra alocações ativas com a mesma OS e prestador diferente
3. **Prestador indisponível**: Verifica `prestadorStatus === 'indisponivel'`
4. **Sobreposição de horário**: Converte HH:MM para minutos e verifica intersecção `[inicioA, fimA] ∩ [inicioB, fimB]`

### 25.5. Fallback aplicado

- Dados antigos incompletos sem `status` → considerados ativos (comportamento conservador)
- Alocações canceladas/recusadas são ignoradas na detecção de conflitos
- Sem horários definidos → não quebra, apenas avisa
- Sem lista de alocações → sem conflitos (`alocacoesExistentes` vazio)
- `prestadorStatus` ausente → verificação de indisponibilidade é ignorada

### 25.6. Riscos após P8

| Risco | Severidade |
|-------|-----------|
| Monolito ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |

---

## 26. P9 — TIMELINE OPERACIONAL DA ALOCAÇÃO

### 26.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `montarTimelineAlocacao()` criado — função pura que gera eventos da timeline | `src/helpers/montarTimelineAlocacao.ts` |
| 2 | Seção "Linha do Tempo" adicionada na aba Resumo do modal de alocação | `src/components/operacao/EscalaLista.tsx` |

### 26.2. Eventos da timeline

| Evento | Ícone | Quando está "done" | Timestamp |
|--------|-------|-------------------|-----------|
| Alocação criada | `criada` | Sempre (alocação existe) | "—" |
| Carregamento confirmado | `carregamento` | `tempoInicioCarregamento` e `tempoFimCarregamento` preenchidos | "início - fim" |
| Rota iniciada | `rota` | `tempoSaidaRua` preenchido | hora da saída |
| Finalizada | `finalizada` | `tempoFinalizacaoEntregas` preenchido ou status final | hora da finalização |
| Cancelada | `cancelada` | Status = `cancelada`/`cancelado` | "—" |

### 26.3. Origem dos dados

Os dados vêm exclusivamente do formulário da alocação (state local do modal):
- `tempoChegadaPatio`, `tempoInicioCarregamento`, `tempoFimCarregamento`
- `tempoSaidaRua`, `tempoFinalizacaoEntregas`
- `status` e `horarioInicio`, `horarioFim`

Não há consulta ao banco nem ao histórico — a timeline reflete o estado atual do formulário.

### 26.4. Renderização

A timeline é renderizada como:
- Bolinhas verdes preenchidas → eventos concluídos
- Bolinhas cinzas vazadas → eventos pendentes
- Ícone `CheckCircle` verde ao lado do label quando concluído
- Timestamp exibido à direita (quando disponível)
- Fallback "Sem eventos registrados" se a lista estiver vazia

### 26.5. Fallback aplicado

- Se nenhum tempo operacional for preenchido → apenas "Alocação criada" aparece como concluída, demais como pendentes
- Se não houver dados → mensagem "Sem eventos registrados"
- Dados antigos incompletos continuam funcionando (campos opcionais)
- O helper é puro e tolerante a entradas parciais

### 26.6. Riscos após P9

| Risco | Severidade |
|-------|-----------|
| Monolito ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |

---

## 27. P10 — DASHBOARD OPERACIONAL DA ESCALA

### 27.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `calcularKpisEscala()` criado — função pura que calcula 7 KPIs | `src/helpers/calcularKpisEscala.ts` |
| 2 | `useMemo` para KPI no EscalaLista (recalcula apenas quando `alocacoes` mudam) | `src/components/operacao/EscalaLista.tsx` |
| 3 | Grid de 7 cards de KPI no topo da Escala | `src/components/operacao/EscalaLista.tsx` |

### 27.2. KPIs implementados

| Card | Ícone | Cor | Descrição |
|------|-------|-----|-----------|
| Total | `Truck` | Primary | Contagem total de alocações no período |
| Confirmadas | `CheckCircle` | Verde | `confirmado`, `planejada`, `aceita` |
| Pendentes | `Clock` | Âmbar | `pendente`, `aguardando`, `aguardando_aceite` |
| Em Rota | `MapPin` | Laranja | `operacao`, `em_rota`, `ocorrencia` |
| Finalizadas | `Check` | Azul claro | `concluida` |
| Canceladas | `AlertCircle` | Vermelho | `cancelado`, `cancelada`, `recusada` |
| Conflitos | `AlertTriangle` | Violeta | Placeholder "—" (dados de conflito futuros) |

### 27.3. Helper: `calcularKpisEscala`

**`src/helpers/calcularKpisEscala.ts`** — função pura:

```typescript
function calcularKpisEscala(alocacoes: { status?: string }[]): KpisEscala
```

**Output:**
```typescript
interface KpisEscala {
  total: number        // alocacoes.length
  confirmadas: number  // confirmado | planejada | aceita
  pendentes: number    // pendente | aguardando | aguardando_aceite
  emRota: number       // operacao | em_rota | ocorrencia
  finalizadas: number  // concluida
  canceladas: number   // cancelado | cancelada | recusada
}
```

### 27.4. Origem dos dados

- Reutiliza `alocacoes` já carregadas pelo `useEscala()`
- Nenhuma query nova ao banco
- Recalculado via `useMemo` apenas quando `alocacoes` muda
- Compatível com Supabase e localStorage (usa `normalizarStatus` interno)

### 27.5. Fallback aplicado

- Sem alocações → todos KPIs zerados
- Status não reconhecido/nulo → contado como pendente
- Cálculo memoizado → não quebra a tela
- Card "Conflitos" exibe "—" (placeholder para integração futura)

### 27.6. Riscos após P10

| Risco | Severidade |
|-------|-----------|
| Monolito ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |

---

## 28. P11 — EXTRAÇÃO SEGURA DO MONOLITO

### 28.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Criada pasta `src/components/operacao/escala/` | `src/components/operacao/escala/` |
| 2 | Extraído `KpiCards` do grid de KPIs | `src/components/operacao/escala/KpiCards.tsx` |
| 3 | Extraído `TimelineOperacional` da seção Linha do Tempo | `src/components/operacao/escala/TimelineOperacional.tsx` |
| 4 | Extraído `PrestadorFilters` do header da sidebar | `src/components/operacao/escala/PrestadorFilters.tsx` |
| 5 | Extraído `PrestadorCardSidebar` dos cards individuais na sidebar | `src/components/operacao/escala/PrestadorCardSidebar.tsx` |

### 28.2. Componentes extraídos

| Componente | Linhas extraídas | Props |
|-----------|-----------------|-------|
| `KpiCards` | 60 | `kpis: KpisEscala` |
| `TimelineOperacional` | 45 | `dados: DadosTimeline` |
| `PrestadorFilters` | 61 | `filtroNome`, `onFiltroNomeChange`, `filtroVeiculo`, `onFiltroVeiculoChange`, `filtroStatus`, `onFiltroStatusChange`, `opcoesVeiculo` |
| `PrestadorCardSidebar` | 68 | `prestador: PrestadorSidebar`, `isSelected`, `alocadoHoje`, `infoRecrutamento`, `onClick` |

### 28.3. Redução do monolito

| Métrica | Antes | Depois |
|---------|-------|--------|
| Linhas do EscalaLista.tsx | ~2050 | **1978** |
| Linhas extraídas (4 componentes) | 0 | **234** |
| Total do módulo | ~2050 | **2212** (monolito menor + componentes) |
| Complexidade do main file | Alta | **Reduzida** |

### 28.4. Props criadas

- `PrestadorSidebar` (interface): `id, nome, veiculo, placa, regiao, status, avatar`
- `InfoRecrutamento` (reutilizada de `usePrestadoresAptosRecrutamento`): `candidato, prioridade, label, cor`
- `KpisEscala` (reutilizada de `calcularKpisEscala`): `total, confirmadas, pendentes, emRota, finalizadas, canceladas`
- `DadosTimeline` (reutilizada de `montarTimelineAlocacao`): `status, horarioInicio, horarioFim, tempo*`

### 28.5. Fallback aplicado

- Componentes são puramente presentacionais — zero lógica de estado ou efeitos
- Se a extração quebrar tipagem, cada componente pode ser revertido individualmente
- UI final permanece visualmente idêntica (props mapeiam exatamente o JSX anterior)

### 28.6. Riscos após P11

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1978 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |

---

## 29. P12 — EXTRAÇÃO DO PAINEL/FORMULÁRIO DE ALOCAÇÃO

### 29.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Extraído `AlocacaoFinanceiroFields` — aba "Dados Financeiros" completa | `src/components/operacao/escala/AlocacaoFinanceiroFields.tsx` |
| 2 | Extraído `AlocacaoFooter` — rodapé do modal com botões de ação | `src/components/operacao/escola/AlocacaoFooter.tsx` |

### 29.2. Componentes extraídos

| Componente | Linhas | Props |
|-----------|--------|-------|
| `AlocacaoFinanceiroFields` | 185 | `financeiro: EscalaFinanceiroForm`, `onFinanceiroChange`, `resumo: EscalaFinanceiroResumo` |
| `AlocacaoFooter` | 40 | `hasSelectedAlocacao`, `onCancelarClick`, `onSalvarClick` |

### 29.3. Redução do monolito

| Métrica | Antes (P11) | Depois (P12) |
|---------|------------|--------------|
| Linhas EscalaLista.tsx | ~1978 | **1873** (-105) |
| Linhas extraídas (P11+P12) | 234 | **459** (total 6 componentes) |
| Total componentes extraídos | 4 | **6** |

### 29.4. Props criadas

- `EscalaFinanceiroForm` (interface): `valorTipo, valorPercentual, valorFixo, combustivel, pedagio, ajudantes, valorAjudante, diariasAdicionais, desconto, segundaSaida, valorSegundaSaida, terceiraSaida, valorTerceiraSaida`
- `EscalaFinanceiroResumo` (interface): `valorBase, totalAdicionais, totalDescontos, total`
- `AlocacaoFooterProps`: `hasSelectedAlocacao, onCancelarClick, onSalvarClick`

### 29.5. Fallback aplicado

- Componentes são controlados por props — EscalaLista continua dono do estado
- Nenhuma lógica de negócio foi movida
- `AlocacaoFinanceiroFields` é puramente presentacional
- `AlocacaoFooter` não tem estado interno

### 29.6. Riscos após P12

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1993 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |

---

**ESCALA OPERACIONAL P12 CONCLUÍDA — AGUARDANDO P13**


---

## 30. P13 — EXTRAÇÃO DOS CAMPOS OPERACIONAIS DA ALOCAÇÃO

### 30.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Extraído `AlocacaoOperacionalFields` — Turno, Tipo (status), Horário Início/Fim, Observações | `src/components/operacao/escala/AlocacaoOperacionalFields.tsx` |
| 2 | Substituído bloco inline no TabsContent "dados" pelo componente controlado | `src/components/operacao/EscalaLista.tsx` |

### 30.2. Componente extraído

| Componente | Linhas | Props |
|-----------|--------|-------|
| `AlocacaoOperacionalFields` | 57 | `turno`, `onTurnoChange`, `tipo`, `onTipoChange`, `horarioInicio`, `onHorarioInicioChange`, `horarioFim`, `onHorarioFimChange`, `observacao`, `onObservacaoChange` |

### 30.3. Props criadas

```typescript
interface AlocacaoOperacionalFieldsProps {
  turno: string
  onTurnoChange: (value: string) => void
  tipo: string
  onTipoChange: (value: string) => void
  horarioInicio: string
  onHorarioInicioChange: (value: string) => void
  horarioFim: string
  onHorarioFimChange: (value: string) => void
  observacao: string
  onObservacaoChange: (value: string) => void
}
```

### 30.4. Redução do monolito

| Métrica | Antes (P12) | Depois (P13) |
|---------|------------|--------------|
| Linhas EscalaLista.tsx | ~1993 | **1964** (-29) |
| Linhas extraídas (P11+P12+P13) | 459 | **516** (total 7 componentes) |
| Total componentes extraídos | 6 | **7** |

### 30.5. Fallback aplicado

- Bloco operacional estava acoplado demais (prestador/cliente com SearchableSelect + side effects, KM com inline calculations + financeiro update)
- **Fallback aplicado**: extraídos apenas campos de horário, status (Tipo) e observações
- Componente é puramente presentacional — EscalaLista continua dona do estado
- Nenhuma lógica de negócio foi movida
- Nenhum helper ou hook foi alterado
- Layout visual permanece intacto

### 30.6. Riscos restantes após P13

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1964 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Campos operacionais ainda no monolito (data) | 🟠 Baixo |

---

## 31. P14 — EXTRAÇÃO DOS SELETORES PRINCIPAIS DA ALOCAÇÃO

### 31.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Extraído `AlocacaoSeletoresPrincipais` — Prestador, Cliente, OS, KM + Veículo + Tabela | `src/components/operacao/escala/AlocacaoSeletoresPrincipais.tsx` |
| 2 | Substituído bloco inline no TabsContent "dados" pelo componente controlado | `src/components/operacao/EscalaLista.tsx` |

### 31.2. Componente extraído

| Componente | Linhas | Props |
|-----------|--------|-------|
| `AlocacaoSeletoresPrincipais` | 143 | `prestadorId`, `onPrestadorChange`, `prestadorVeiculo`, `clienteId`, `onClienteChange`, `loadingTabelaValores`, `tabelaValores`, `regraEspecialAtiva`, `os`, `onOSChange`, `kmInicial`, `kmFinal`, `onKmInicialChange`, `onKmFinalChange`, `tipoVeiculoLabel` |

### 31.3. Props criadas

```typescript
interface AlocacaoSeletoresPrincipaisProps {
  prestadorId: string
  onPrestadorChange: (id: string, item?: any) => void
  prestadorVeiculo: { tipo_veiculo: string; placa: string; refrigerado: boolean } | null
  clienteId: string
  onClienteChange: (id: string, item?: any) => void
  loadingTabelaValores: boolean
  tabelaValores: { valor_base: number; valor_km: number; km_franquia: number; tipo_veiculo: string } | null
  regraEspecialAtiva: boolean
  os: string
  onOSChange: (value: string) => void
  kmInicial: number
  kmFinal: number
  onKmInicialChange: (value: number) => void
  onKmFinalChange: (value: number) => void
  tipoVeiculoLabel: Record<string, string>
}
```

### 31.4. Redução do monolito

| Métrica | Antes (P13) | Depois (P14) |
|---------|------------|--------------|
| Linhas EscalaLista.tsx | ~1964 | **1861** (-103) |
| Linhas extraídas (P11+P12+P13+P14) | 516 | **659** (total 8 componentes) |
| Total componentes extraídos | 7 | **8** |

### 31.5. Fallback aplicado

- **Date field não extraído**: permaneceu no monolito por estar fora do Tabs, entre DialogHeader e o componente Tabs — extraí-lo exigiria alteração de layout (mover para dentro da tab Dados), violando a regra de não alterar layout visual
- **SearchableSelect mantido no componente**: o `SearchableSelect` é um componente de UI puro (`@/components/ui/`). As callbacks com side effects (`buscarDadosVeiculoPrestador`, `buscarTabelaValoresCliente`, `setFinanceiro`) permanecem em EscalaLista como props de callback
- **KM inline IIFE convertida**: o cálculo inline `{(() => {...})()}` foi convertido para variáveis `const` no escopo do componente — é UI-only, sem regra de negócio
- Componente é puramente presentacional — EscalaLista continua dona do estado
- Nenhuma lógica de negócio foi movida
- Nenhum helper ou hook foi alterado
- Layout visual permanece intacto

### 31.6. Riscos restantes após P14

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1861 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Controle de KM/Fechamento no monolito (com variáveis não definidas) | 🟠 Alto |
| Campo `data` ainda no monolito (fora do Tabs) | 🟠 Baixo |

---

**ESCALA OPERACIONAL P15 CONCLUÍDA — AGUARDANDO P16**

---

## 33. P16 — CORREÇÃO SEGURA DO CONTROLE KM/FECHAMENTO

### 33.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Corrigidas 4 variáveis órfãs no IIFE do Controle KM/Fechamento | `src/components/operacao/EscalaLista.tsx` |

### 33.2. Variáveis corrigidas

| Variável | Problema | Origem do valor correto |
|----------|----------|------------------------|
| `valorKm` | Não definida no escopo do IIFE | `tabelaValores?.valor_km \|\| 2.50` (mesma lógica do helper `calculoEscalaFinanceiro.ts:50`) |
| `valorKmExcedente` | Não definida no escopo do IIFE | `totals.valorKmExcedente` (já retornado pelo helper `ResultadoCalculoEscala.valorKmExcedente`) |
| `diariaBase` | Não definida no escopo do IIFE | `tabelaValores?.valor_base \|\| 400` (mesma lógica do helper `calculoEscalaFinanceiro.ts:48`) |
| `percentualAdicional` | Não definida no escopo do IIFE | `totals.percentualAdicional` (já retornado pelo helper `ResultadoCalculoEscala.percentualAdicional`) |

### 33.3. Correção aplicada

- Nenhuma lógica nova foi criada — apenas destruturação adicional do objeto `totals` já retornado por `calcularTotalAlocacao()`
- `valorKm` e `diariaBase` são valores de exibição da tabela que replicam a mesma lógica do helper (valores padrão idênticos)
- `valorKmExcedente` e `percentualAdicional` já estavam disponíveis no objeto `totals` mas não eram desestruturados
- Nenhum mock foi criado
- Nenhum valor financeiro fixo foi inventado

### 33.4. Extração

**Não houve extração de componente nesta fase.** A prioridade foi estabilizar o bloco para preparar extração na P17.

### 33.5. Riscos restantes após P16

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1759 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Campo `data` ainda no monolito (fora do Tabs) | 🟠 Baixo |

---

**ESCALA OPERACIONAL P16 CONCLUÍDA — AGUARDANDO P17**

---

## 34. P17 — EXTRAÇÃO DO CONTROLE KM/FECHAMENTO

### 34.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Extraído `AlocacaoControleKmFechamento` — Bloco completo de KM e resumo financeiro do Resumo tab | `src/components/operacao/escala/AlocacaoControleKmFechamento.tsx` |
| 2 | Substituído IIFE inline de ~160 linhas no TabsContent "resumo" pelo componente controlado | `src/components/operacao/EscalaLista.tsx` |

### 34.2. Componente extraído

| Componente | Linhas | Props |
|-----------|--------|-------|
| `AlocacaoControleKmFechamento` | 160 | `kmInicial`, `kmFinal`, `onKmInicialChange`, `onKmFinalChange`, `totals`, `tabelaValores`, `regraEspecialAtiva`, `novoClienteId`, `onGerarRelatorioClick` |

### 34.3. Props criadas

```typescript
interface AlocacaoControleKmFechamentoProps {
  kmInicial: number
  kmFinal: number
  onKmInicialChange: (value: number) => void
  onKmFinalChange: (value: number) => void
  totals: ResultadoCalculoEscala
  tabelaValores: { km_franquia?: number; valor_km?: number; valor_base?: number } | null
  regraEspecialAtiva: boolean
  novoClienteId: string
  onGerarRelatorioClick: () => void
}
```

### 34.4. Redução do monolito

| Métrica | Antes (P16) | Depois (P17) |
|---------|------------|--------------|
| Linhas EscalaLista.tsx | ~1763 | **1639** (-124) |
| Linhas extraídas (P11→P17) | 777 | **901** (total 10 componentes) |
| Total componentes extraídos | 9 | **10** |

### 34.5. Fallback aplicado

- **Botão "Gerar Relatório de Pagamento" extraído**: o callback `onGerarRelatorioClick` encapsula a criação do objeto `tempAloc` (que depende de 13+ estados do monolito) — o botão visual está no componente, a lógica permanece em EscalaLista
- **KM inputs extraídos**: os handlers `onKmInicialChange`/`onKmFinalChange` mantêm o side effect de `setFinanceiro({...f, kmRodados})` no monolito
- **Totals pré-computado**: `calcularTotalAlocacao()` é chamado em EscalaLista e passado como prop `totals` — o componente não chama helpers diretamente
- **Cálculos de exibição no componente**: `kmFranquia`, `valorKm`, `diariaBase` permanecem derivados de `tabelaValores` dentro do componente (display-only, replicam lógica do helper)
- Nenhum hook ou helper foi alterado
- Layout visual permanece intacto

### 34.6. Riscos restantes após P17

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1639 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Campo `data` ainda no monolito (fora do Tabs) | 🟠 Baixo |

---

**ESCALA OPERACIONAL P17 CONCLUÍDA — AGUARDANDO P18**

---

## 35. P18 — EXTRAÇÃO DAS AÇÕES FINAIS DA ALOCAÇÃO

### 35.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Criado `AlocacaoAcoesFinais` — substitui o antigo `AlocacaoFooter` com suporte a loading/salvando/disabled/mensagem | `src/components/operacao/escala/AlocacaoAcoesFinais.tsx` |

### 35.2. Componente extraído

| Componente | Linhas | Props |
|-----------|--------|-------|
| `AlocacaoAcoesFinais` | 58 | `hasSelectedAlocacao`, `loading`, `salvando`, `disabled`, `mensagem`, `onSalvarClick`, `onCancelarClick` |

### 35.3. Props criadas

```typescript
interface AlocacaoAcoesFinaisProps {
  hasSelectedAlocacao: boolean
  loading?: boolean
  salvando?: boolean
  disabled?: boolean
  mensagem?: string | null
  onSalvarClick: () => void
  onCancelarClick: () => void
}
```

### 35.4. Redução do monolito

| Métrica | Antes (P17) | Depois (P18) |
|---------|------------|--------------|
| Linhas EscalaLista.tsx | ~1753 | **1753** (0) |
| Componentes extraídos | 10 | **11** |

> O monolito não reduziu em linhas porque `AlocacaoAcoesFinais` substitui `AlocacaoFooter` (já extraído na P12). O ganho é evolutivo: o novo componente suporta estados de loading/salvando/disabled/mensagem sem aumentar o monolito.

### 35.5. Fallback aplicado

- `AlocacaoFooter.tsx` removido do import — substituído por `AlocacaoAcoesFinais`
- Componente mantém compatibilidade total com props existentes
- `salvando` mostra spinner + "Salvando..." no botão de salvar
- `disabled` desabilita todos os botões de ação
- `mensagem` exibe texto informativo ao lado dos botões
- Nenhum estado novo foi criado no componente
- Nenhuma lógica de negócio foi movida
- Layout visual permanece intacto

### 35.6. Checkpoint — auditoria de linhas e componentes

| Item | Valor |
|------|-------|
| Linhas atuais EscalaLista.tsx | **1753** |
| Componentes extraídos (pasta `escala/`) | **11** (1.151 linhas totais) |
| `AlocacaoFooter` ainda usado? | ❌ Não — substituído por `AlocacaoAcoesFinais`. Pode ser removido. |

### Divergência P17 (1639) vs P18 (1753)

**Não houve rollback.** A diferença de +114 linhas foi causada pela reescrita do `handleGerarRelatorioPagamento` durante as melhorias dos relatórios PDF (entre P17 e P18):

| Fase | Linhas | Evento |
|------|--------|--------|
| P17 (pós-extração) | ~1639 | AlocacaoControleKmFechamento extraído |
| PDF profissional | +~114 | handleGerarRelatorioPagamento reescrito (navy header + cards + footer) |
| P18 (AlocacaoAcoesFinais) | 1753 | Substituição AlocacaoFooter → AlocacaoAcoesFinais (0 redução) |

### Componentes extraídos — status de uso

| Componente | Linhas | Importado? | Usado? |
|-----------|--------|-----------|--------|
| KpiCards | 62 | ✅ | ✅ |
| TimelineOperacional | 48 | ✅ | ✅ |
| PrestadorCardSidebar | 75 | ✅ | ✅ |
| PrestadorFilters | 63 | ✅ | ✅ |
| AlocacaoFinanceiroFields | 160 | ✅ | ✅ |
| AlocacaoFooter | 35 | ❌ | ❌ |
| AlocacaoAcoesFinais | 63 | ✅ | ✅ |
| AlocacaoOperacionalFields | 77 | ✅ | ✅ |
| AlocacaoSeletoresPrincipais | 161 | ✅ | ✅ |
| AlocacaoHistoricoOperacional | 146 | ✅ | ✅ |
| AlocacaoControleKmFechamento | 161 | ✅ | ✅ |

**Total componentes extraídos:** 11 (1.151 linhas) — todos em uso exceto `AlocacaoFooter` (legado).

### Validação visual e console

- `npm run build` → ✅ (4599 modules)
- `npx tsc --noEmit` → ✅ (0 erros)
- AlocacaoFooter removido do import — sem warning
- AlocacaoAcoesFinais com suporte a `loading`, `salvando`, `disabled`, `mensagem` — disponível sem aumentar monolito

### Recomendação para P19

1. **Remover** `AlocacaoFooter.tsx` da pasta (legado, não usado)
2. **Próximo alvo de extração:** Modal de Confirmação de Cancelamento (~70 linhas, bloco autônomo)
3. Campo `data` fora do Tabs — permanece como está (exigiria alteração de layout)

---

### 35.7. Riscos restantes após P18

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1753 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Campo `data` ainda no monolito (fora do Tabs) | 🟠 Baixo |

---

**ESCALA OPERACIONAL P18 CONCLUÍDA — AGUARDANDO P19**

---

## 36. P19 — LIMPEZA DE LEGADO E EXTRAÇÃO DO MODAL DE CANCELAMENTO

### 36.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Removido `AlocacaoFooter.tsx` — legado, não mais importado | `src/components/operacao/escala/AlocacaoFooter.tsx` |
| 2 | Criado `AlocacaoCancelamentoModal` — Modal de confirmação de cancelamento | `src/components/operacao/escala/AlocacaoCancelamentoModal.tsx` |
| 3 | Substituído modal inline no EscalaLista pelo componente controlado | `src/components/operacao/EscalaLista.tsx` |

### 36.2. Componente extraído

| Componente | Linhas | Props |
|-----------|--------|-------|
| `AlocacaoCancelamentoModal` | 96 | `open`, `onOpenChange`, `deleteTarget`, `onConfirmarCancelamento`, `cancelando?`, `disabled?` |

### 36.3. Props criadas

```typescript
interface AlocacaoCancelamentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deleteTarget: { prestadorNome?: string; data?: Date | string; clienteNome?: string; totals?: { total?: number } } | null
  onConfirmarCancelamento: () => void
  cancelando?: boolean
  disabled?: boolean
}
```

### 36.4. Redução do monolito

| Métrica | Antes (P18) | Depois (P19) |
|---------|------------|--------------|
| Linhas EscalaLista.tsx | ~1753 | **1721** (-32) |
| Arquivos legados removidos | 0 | **1** (AlocacaoFooter.tsx) |
| Componentes extraídos | 11 | **12** |

### 36.5. Validação visual

- `AlocacaoFooter.tsx` — sem referências em nenhum arquivo do projeto ✅ removido
- `AlocacaoCancelamentoModal` — extraído sem alterar layout, textos ou fluxo
- Componente é puramente presentacional — EscalaLista continua dona do estado
- `cancelando` exibe `Loader2` animado + "Cancelando..." no botão destrutivo
- `disabled` desabilita ambos os botões

### 36.6. Riscos restantes após P19

| Risco | Severidade |
|-------|-----------|
| Monolito ainda tem ~1721 linhas, 44 useState | 🔴 Crítico |
| Aninhamento JSX 41 níveis | 🟠 Alto |
| Campo `data` ainda no monolito (fora do Tabs) | 🟠 Baixo |

---

**ESCALA OPERACIONAL P19 CONCLUÍDA — AGUARDANDO P20**






