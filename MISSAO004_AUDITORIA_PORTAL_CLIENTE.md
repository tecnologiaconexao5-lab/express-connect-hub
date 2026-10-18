# MISSÃO 004 — Auditoria e Correção do Portal do Cliente (2026-07-24)

**Status:** ✅ Concluída. 524 linhas removidas, 4 correções aplicadas. tsc 0 erros, build 47s, testes 20/20.

## O que foi feito

### Auditoria de Código
- `PortalCliente.tsx` auditado integralmente (~5736 linhas)
- Identificados 4 defeitos de segurança e qualidade
- Verificados loading states em todas as 22 abas

### Defeitos Corrigidos

| # | Severidade | Defeito | Linhas | Correção |
|---|-----------|---------|--------|----------|
| 1 | **Alta** | 5 imports mortos de `pedidosService` (`sugerirVeiculo`, `sugerirVeiculoAvancado`, `calcularTempoRota`, `statusCores`, `prioridadeCores`) — poluíam o bundle e causavam warning de lint | 89-95 | Removidos |
| 2 | **Média** | `os.cliente` e `os.prestador` exibiam UUIDs como nome do cliente/prestador | 1386-1388 | Substituído por `clienteInfo?.nome_fantasia` |
| 3 | **Alta** | localStorage fallback `tms_cliente_id` (leit+escrita) — bypass de segurança pós-MISSÃO 50. Qualquer usuário autenticado podia definir `localStorage.setItem("tms_cliente_id", qualquer_id)` para assumir identidade de outro cliente | 1305-1327 | Removido; apenas `usuarios_cliente` via auth Supabase |
| 4 | **Média** | 2 `.catch(() => {})` silenciosos nas chamadas `buscarStatusPatioCliente` e `portal_preferencias_cliente` — erros engolidos | 1458, 1465 | Substituído por `console.warn` |

### Achados sem Correção (arquiteturais)
- **Chunk grande**: `PortalCliente-BMhAns8d.js` com 526 kB (acima do threshold 500 kB) — componente único massivo
- **Sem loading full-page**: `initialLoading` só usado nas 4 KPIs; demais abas mostram empty state durante carregamento
- **22 abas gerenciadas por `activeTab` condicional**: sem lazy loading, todas renderizadas condicionalmente no mesmo componente

### Código Morto Confirmado (não alterado nesta missão)
- `src/services/portalCliente/analyticsService.ts` — nunca importado
- `src/hooks/portalCliente/usePortalRealtime.ts` — `useNotificacoesRealtime` nunca importado

### Validação
| Verificação | Resultado |
|------------|-----------|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ 47,30s, 0 erros |
| `npx vitest run` | ✅ 20/20 testes, 3/3 arquivos |
