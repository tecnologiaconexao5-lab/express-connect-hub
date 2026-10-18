# MISSÃO 108-L4 — Portal Escala Operacional Real

**Status:** ✅ Implantado e homologado. 5/5 Playwright, 0 regressão.

## O que foi feito

### Etapa 1 — Auditoria
- `PortalEscalaOperacional.tsx` era **100% placeholder**: 6 veículos hardcoded (Sprinter, Fiorino, HR, Biz, Transit), sem `clienteId`, sem consulta a banco, sem filtros funcionais, sem Realtime
- Interface `VeiculoEscala` com dados fictícios (placa ABC-1234, motorista "Carlos Silva", ocupação fixa)
- Erro de digitação: `motorist` (sem `a`) e `Motorista` (com M maiúsculo) — ambos ignorados pelo runtime mas indicativos de falta de revisão

### Etapa 2 — Serviço `buscarEscalaCliente()` + `buscarDetalheAlocacaoCliente()`
Adicionado ao `portalClienteService.ts`:

**`buscarEscalaCliente(clienteId, filtros?)`**
- Query em `alocacoes_escala` filtrada por `cliente_id`, período (padrão 30 dias), status
- JOIN via 4 queries paralelas: `vw_noc_operacional` (SLA, tracking, motorista), `prestadores` (nome, telefone), `ordens_servico` (número, carga), `entregas_protocolo` (POD)
- Filtros: período (7d/15d/30d/60d), status, busca textual (motorista, placa, origem, destino, OS)
- Paginação client-side com 10 itens por página
- Retorno: `AlocacaoClienteResumo[]` — 20 campos por alocação

**`buscarDetalheAlocacaoCliente(alocacaoId)`**
- Query única em `alocacoes_escala`
- JOIN `prestadores`, `ordens_servico`, `entregas_protocolo`, `portal_ocorrencias`
- Retorno: `DetalheAlocacaoCliente` com alocação, OS, POD, ocorrências

### Etapa 3 — Componente React reescrito
`PortalEscalaOperacional.tsx` — de 428 linhas mock → ~360 linhas reais:

| Funcionalidade | Antes | Depois |
|---------------|-------|--------|
| Fonte de dados | 6 objetos VeiculoEscala hardcoded | `buscarEscalaCliente()` (alocacoes_escala real) |
| clienteId | Não aceito | Obrigatório via prop |
| KPI cards | Veículos, Disponíveis, Em Rota, Entregas, Ocupação, Refrigerados | Total, Em Andamento, Pendentes, Concluídas, Com POD, Com Tracking |
| Filtros | Apenas tipo de veículo via Badge clicável | Período (Select), Status (Select), Busca textual (Input) |
| Lista | 6 cards de veículos com modelo, placa, motorista, ocupação | Lista paginada de alocações com origem→destino, data, status, motorista, veículo, SLA, POD |
| Detalhes | Modal com dados do veículo hardcoded | Modal com OS info, POD (foto/canhoto/assinatura), ocorrências, tracking |
| Loading state | ❌ Não existia | ✅ Skeleton de 5 cards animados |
| Empty state | ❌ Não existia | ✅ "Nenhuma alocação encontrada" com ícone |
| Erro state | ❌ Não existia | ✅ "Cliente não identificado" para admin sem vínculo |
| Paginação | ❌ Não existia | ✅ 10 itens/página, botões Anterior/Próximo |
| Contatar motorista | `onContatarMotorista` prop | Mesma prop + botão telefone em cada card e no modal |

### Etapa 4 — Sidebar + Render
- `PortalCliente.tsx`: item `"Escala"` com `Calendar` adicionado ao `itensSidebar` (entre "Insights IA" e "Pedidos")
- Render condicional `activeTab === "escala"` agora passa `clienteId={clienteData?.id}`
- Prop `onVerVeiculo` removida (não mais necessária)

### Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/services/portalCliente/portalClienteService.ts` | Modificado | +`buscarEscalaCliente()` (5 queries paralelas, filtros, paginação), +`buscarDetalheAlocacaoCliente()` (detalhe completo) |
| `src/components/portal-cliente/PortalEscalaOperacional.tsx` | Reescrito | 428→~360 linhas, dados reais, filtros, modal detalhe, loading/empty/error states |
| `src/pages/PortalCliente.tsx` | Modificado | Sidebar +"Escala", render com `clienteId` |
| `tests/e2e/missao108-l4-escala-operacional.spec.ts` | Novo | 5 testes Playwright |
| `evidencias_missao108l4/` | Novo | 2 screenshots (sidebar, estatísticas) |

### Validação

| Teste | Status |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` (32.21s) | ✅ OK |
| **M108-L4** — Sidebar "Escala" existe | ✅ |
| **M108-L4** — Título + estatísticas | ✅ |
| **M108-L4** — Navegação ida/volta | ✅ |
| **M108-L4** — Header com dados ou estado vazio | ✅ |
| **M108-L4** — Navegação ampla sem erros console | ✅ |
| **Regressão M108-L2** (6 testes) | ✅ 6/6 |
| **Regressão M108-L3** (4 testes) | ✅ 4/4 |
| **Regressão M55-C2** (7 testes) | ✅ 7/7 |
| **Total** | **22/22 ✅** |

### Regra de Ouro
> Portal Cliente agora tem aba "Escala" funcional com dados reais do TMS (`alocacoes_escala`, `prestadores`, `ordens_servico`, `entregas_protocolo`, `vw_noc_operacional`). Placeholder de 6 veículos hardcoded substituído por consulta ao banco com filtros, paginação, loading/empty/error states, e modal de detalhes com POD e ocorrências. Sidebar do Portal Cliente cresceu para 14 itens.

### Próximos Passos
1. Adicionar Realtime subscription para atualizar automaticamente alocações em andamento
2. Mapa de tracking integrado ao modal de detalhes (quando `tem_tracking`)
3. Notificação de novas alocações via toast
