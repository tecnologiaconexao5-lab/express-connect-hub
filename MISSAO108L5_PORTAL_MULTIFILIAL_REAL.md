# MISSÃO 108-L5 — Portal MultiFilial Real

**Veredito: PORTAL MULTIFILIAL HOMOLOGADO ✅**

---

## O que foi feito

### Etapa 1 — Auditoria
- `PortalMultiFilial.tsx` era 100% placeholder: 5 unidades hardcoded, sem DB, sem sidebar, mock handlers
- Tabela `filiais` sem `cliente_id`, sem `tenant_id`, sem RLS — em bootstrap SQLs apenas
- `ClienteDetalhe.tsx` com CRUD de filiais local-state-only (`id: String(Date.now())`)
- Fonte real de filiais por cliente: campo `unidade` (TEXT) em `ordens_servico`
- Schema conflitante entre 3 arquivos bootstrap para `filiais`

### Etapa 2 — Serviço (`portalClienteService.ts`)
- `buscarFiliaisCliente(clienteId, filtros?)` — retorna `{ filiais, comparativo }`:
  - Agrupa `ordens_servico` por `unidade` para cliente
  - 5 queries paralelas: OS, `financeiro_receber`, `alocacoes_escala`, `contratos_operacao`, `portal_ocorrencias`
  - KPIs por filial: total_os, abertas, concluidas, faturamento, pendentes_financeiro, ocorrencias, sla, tem_pod, reversas
  - Filtros: período (7/30/60/mês_atual)
  - Dados comparativos com evolução percentual vs período anterior
- `buscarDetalheFilial(clienteId, filialNome, filtros?)` — retorna `FilialDetalhe`:
  - Operações listadas, financeiro (faturado/recebido/pendente/vencido/a_receber), ocorrências

### Etapa 3 — Componente React (`PortalMultiFilial.tsx`)
- Sidebar item "Multi Filial" (Building2) adicionado ao Portal Cliente
- Componente aceita `clienteId` prop
- **Visão Geral**: KPIs consolidados (5 cards), grid de cards por filial, busca textual, filtro período
- **Comparativo**: tabela completa com operações, no prazo, atrasos, SLA, faturamento, ocorrências, POD, reversas, evolução %, contratos
- **Detalhe (modal)**: operações, SLA, faturamento, a receber, PODs, contratos, pendências, ocorrências
- Loading skeleton, empty state, "cliente não identificado"
- Render condicional: se clienteId é undefined, exibe mensagem
- Ausência de margem, repasse, custos internos — validado via teste 11

### Etapa 4 — PortalCliente.tsx
- Sidebar: `{ id: "multi_filial", icon: Building2, label: "Multi Filial" }` adicionado
- Render: `clienteId={clienteData?.id}` passado ao componente
- Mock `handleVerFilial` removido (não mais usado)

### Etapa 5 — Validação

| Item | Resultado |
|------|-----------|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` (30.57s) | ✅ OK |
| **Playwright M108-L5** (18 testes) | **✅ 18/18** |
| 01 — Sidebar existe | ✅ |
| 02 — Título + KPIs | ✅ |
| 03 — Comparativo carrega | ✅ |
| 04 — Filtro período | ✅ |
| 05 — Busca textual | ✅ |
| 06 — Detalhe da filial | ✅ |
| 07 — Operações no detalhe | ✅ |
| 08 — Financeiro no detalhe | ✅ |
| 09 — Contratos no detalhe | ✅ |
| 10 — Isolamento tenant | ✅ |
| 11 — Sem margem/repasse | ✅ |
| 12 — Navegação ampla | ✅ |
| 13 — Visão Geral ↔ Comparativo | ✅ |
| 14 — Botão Atualizar | ✅ |
| 15 — Zero ErrorBoundary | ✅ |
| 16 — Zero 404 | ✅ |
| 17 — Fechar modal | ✅ |
| 18 — Zero mocks (API calls) | ✅ |

### Regra de Ouro
> Portal Cliente agora tem aba "Multi Filial" funcional com dados reais do TMS. Placeholder de 5 unidades hardcoded substituído por derivação de `ordens_servico.unidade` com 5 queries paralelas para KPIs, visão comparativa, modal de detalhes com operações/financeiro/ocorrências. Sidebar do Portal Cliente: 15 itens.

### Pendências
1. `tenant_usuarios` não tem `filial_id` — usuário restrito a filial não pode ser configurado no banco atual
2. `filiais` tabela sem `cliente_id` — a derivação por `unidade` TEXT em OS é frágil (typos)
3. Idealmente: migration para adicionar `cliente_id` em `filiais` + `filial_id` em `tenant_usuarios` + RLS

### Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/services/portalCliente/portalClienteService.ts` | Modificado | +`buscarFiliaisCliente()` (5 queries), +`buscarDetalheFilial()` |
| `src/components/portal-cliente/PortalMultiFilial.tsx` | Reescrito | 432→~350 linhas, dados reais, comparativo, detalhe |
| `src/pages/PortalCliente.tsx` | Modificado | Sidebar +"Multi Filial" (Building2), render com clienteId |
| `tests/e2e/missao108-l5-portal-multifilial.spec.ts` | Novo | 18 testes Playwright |
| `evidencias_missao108l5/` | Novo | 10 screenshots, 6 docs |
