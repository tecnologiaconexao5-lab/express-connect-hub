# CHECKPOINT DE CONTINUIDADE — MISSÃO 136-A.1

**Data:** 2026-07-22
**Contexto:** Antigravity iniciou a missão, alterou arquivos e ficou sem créditos antes de emitir relatório. OpenCode assumiu a continuação.

---

## Estado Atual

| Item | Status |
|------|--------|
| Build (tsc --noEmit) | ✅ Ok (verificado) |
| Build (npm run build) | ✅ Ok (verificado) |
| Playwright existente | ✅ Teste criado, **não executado** |
| Alterações aplicadas | ⚠️ Não commitadas (working tree) |
| Rota /cadastros/clientes | ⚠️ Não verificada |
| DashboardFilterContext | ✅ Criado |

---

## Arquivos Alterados (4 + 1 extra)

### 1. `src/lib/sidebarData.ts`
- **O quê:** Reestruturação completa do menu lateral
- **Função `getVisibleSidebarItems`:** Agora recebe `User` como parâmetro (não chama `getUser()`)
- **`checkPermission`:** Recebe `user` para passar a `podeAcessar(modulo, "ver", user)`
- **Cadastros Base:** Perdeu `modulo: "prestadores"` no pai — agora SEMPRE visível, filhos filtrados individualmente
- **Clientes:** Movido de Comercial para Cadastros Base (MAS também permanece em Comercial → `DUPLICATA`)
- **Caminhos:** Vários sub-items tiveram rotas simplificadas (ex: `/cadastros/clientes` em vez de `/comercial?tab=clientes`)
- **Novos itens:** Central de Robôs IA, Comunicação Inteligente, Controle de Pátio, Empresas (admin/tenants), Monitor de Conectores
- **Removidos:** Fornecedores (financeiro), Centro de Resultado, Provisões, Análise em Lote, Status Documental, Departamentos, IA & Automação (substituído por Central de Robôs)

### 2. `src/components/dashboard/TabExecutivo.tsx`
- **O quê:** Adicionado `useDashboardFilters`, `Promise.allSettled`, timeout 5s, active flag
- **Problemas:**
  - `useEffect` com dep array `[]` vazio — `filters` fica stale (não reage a mudança de período)
  - Timeout de 5s força `loading = false` mesmo sem dados

### 3. `src/components/dashboard/TabOperacional.tsx`
- **O quê:** Reescrita completa (de ~300 para ~280 linhas)
- **Removido:** `StatusCard`, filtros `Select`, `statusIcons`, `statusBg`, `statusBadge`
- **Adicionado:** `NocCard`, `escalaStats`, `redeStats`, `osStats`, 4 seções (OS / Escalas / Rede / Motoristas)
- **Bom:** Dependency array correto `[filters.dataInicio, filters.dataFim]`
- **Bom:** `Promise.allSettled` com fallbacks, empty state para OS

### 4. `tests/e2e/missao136a1-clientes-dashboard.spec.ts`
- **O quê:** Teste Playwright com 3 cenários
- **Problemas:**
  - Usa localStorage bypass (não login real) — não valida autenticação real
  - `waitForTimeout` em vez de `waitForSelector`/`toBeVisible` — frágil
  - Selectores genéricos com `placeholder*`, `name*`, `id*` — ambíguos
  - Não verifica toast/mensagem de sucesso após salvar
  - Não captura console errors nem network failures
  - Tenta navegar para `/cadastros/clientes` (rota nova — pode não existir)

### 5. `src/contexts/DashboardFilterContext.tsx` (NOVO — extra)
- **O quê:** Provider de filtro de período para dashboards
- Provider exportado: `DashboardFilterProvider`
- Hook: `useDashboardFilters`
- Períodos: hoje, semana, mes, trimestre, personalizado
- Default: "mes" (mês atual)

---

## Problemas Identificados

| # | Gravidade | Arquivo | Problema |
|---|-----------|---------|----------|
| P1 | Média | `sidebarData.ts` | "Clientes" aparece em **dois** lugares: Comercial e Cadastros Base (duplicata) |
| P2 | Média | `TabExecutivo.tsx` | Dependency array `[]` — filtro de período não atualiza dados |
| P3 | Baixa | Teste | `waitForTimeout` em vez de wait condicional — frágil |
| P4 | Baixa | Teste | Não valida toast/sucesso após salvar cliente |
| P5 | Info | Teste | Usa localStorage bypass, não login real |

---

## Próximas Ações (Ordem)

1. ETAPA 2: Auditar menu Clientees + permissões (sidebarData + permissoes.ts)
2. ETAPA 3: Validar Dashboard (se possível com dev server)
3. ETAPA 4: Executar Playwright test
4. ETAPA 5: Teste funcional real de Clientes
5. ETAPA 6: Validar API e banco
6. ETAPA 7: Volumetria
7. ETAPA 8: Testes técnicos
8. ETAPA 9: Evidências
