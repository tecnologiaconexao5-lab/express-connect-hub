# MISSÃO 005 — Auditoria e Correção do Portal Prestador / App Motorista

**Status:** ✅ Concluída. 8 correções aplicadas. Build e testes OK.

**Data:** 2026-07-24

---

## Sumário Executivo

Auditoria completa do módulo de prestador no TMS, abrangendo 2 páginas principais (PortalPrestador + AppPrestador), store Zustand, hooks, adaptadores e serviços. Código morto removido (~872 linhas). Defeitos de UUID display, `.catch` silenciosos e imports não utilizados corrigidos.

## Escopo Auditado

| Componente | Arquivo | Linhas | Propósito |
|-----------|---------|--------|-----------|
| PortalPrestador | `src/pages/PortalPrestador.tsx` | 133 | Portal mobile-first para motoristas (100% mock) |
| AppPrestador | `src/pages/AppPrestador.tsx` | 693 | Painel administrativo TMS para gerenciar prestadores |
| Store | `src/stores/portalPrestadorStore.ts` | 246 | Store Zustand com dados mock |
| 5 componentes | `src/components/portal-prestador/` | ~500 | Dashboard, Operações, Documentos, Treinamentos, Perfil |
| Hook escala | `src/hooks/useEscala.ts` | 545 | Hook de escala com fallback localStorage |
| Hook POD | `src/hooks/usePod.ts` | 68 | Hook de upload de fotos/assinatura |
| Adapter | `src/services/escala/escalaAppPrestadorAdapter.ts` | 84 | Mapeamento alocação → UI |

## Defeitos Corrigidos

### PortalPrestador.tsx
1. **Import morto `Bell`**: Substituído por `FileText` para a aba Documentos
2. **Import morto `ChevronLeft`**: Removido (sem uso no layout)
3. **Import `GraduationCap`**: Adicionado para a aba Treinamentos

### AppPrestador.tsx
4. **UUID display bug `os.cliente` (linha 126)**: `os.cliente.includes("/")` exibia UUID quando cliente não era razão social — corrigido para `"Cliente"`
5. **Query OS sem `origem`/`destino`**: SELECT não incluía `origem`/`destino` — adicionado
6. **Campo `destino: os.cliente` (linha anterior)**: Mapeava `os.cliente` como destino — corrigido para `os.destino`
7. **Import morto `Star`**: Removido (score usa `⭐` inline)
8. **`.catch {}` silenciosos (linhas 137-139, 256-258)**: Substituídos por `console.warn` com contexto

## Código Morto Removido

| Arquivo | Linhas | Motivo |
|---------|--------|--------|
| `src/services/appPrestadorService.ts` | 594 | 0 imports no código fonte — ninguém chama |
| `src/lib/testes/testeEscalaAppPrestador.ts` | 278 | 0 imports no código fonte — script de teste órfão |
| **Total removido** | **872** | |

## Verificação de Dead Code

Varredura confirmou que `src/services/portalCliente/analyticsService.ts` e o hook `useNotificacoesRealtime` de `usePortalRealtime.ts` **não são importados** por nenhum caller em `src/`.

## Fluxo de Dados Auditado

```
AppPrestador.tsx
  │
  ├── loadViagens() → supabase.from("ordens_servico").select("...") ✅ query corrigida
  ├── useEscala() → carregarAlocacoesAppPrestador() → useEscala.fetchAlocacoes()
  │     └── escalaAppPrestadorAdapter.escalaParaItemAppPrestador() ✅ origem/destino mapeados
  │
  ├── handleAceitarViagem() → aceitarAlocacaoHook(id, prestadorId) ✅
  ├── handleRecusarViagem() → recusarAlocacaoHook(id, prestadorId) ✅
  ├── handleIniciarViagem() → iniciarRotaHook(id, prestadorId, kmInicial) ✅
  └── handleEnviarComprovante() → pod.finalizar() + pod.uploadFoto() ✅
```

Componentes do PortalPrestador (DashboardTab, OperacoesTab, DocumentosTab, TreinamentosTab, PerfilTab) são **100% mock** — usam `portalPrestadorStore` com dados estáticos.

## Validação Final

| Item | Resultado |
|------|-----------|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ 46.07s |
| `npx vitest run` | ✅ 20/20 (3 arquivos) |
| Playwright M55-C1 TMS | ✅ 13/13 (regressão) |
| Playwright M55-C2 Portal | ✅ 7/7 (regressão) |
| Playwright M55-C3 Erros | ✅ 7/7 (regressão) |

## Arquivos Modificados

- `src/pages/PortalPrestador.tsx` — imports mortos Bell/ChevronLeft removidos, GraduationCap adicionado
- `src/pages/AppPrestador.tsx` — query OS corrigida (select + origem/destino), UUID bug, `.catch` silenciosos → console.warn, import Star removido
- `src/services/appPrestadorService.ts` — **REMOVIDO** (código morto, 594 linhas)
- `src/lib/testes/testeEscalaAppPrestador.ts` — **REMOVIDO** (código morto, 278 linhas)

## Regra de Ouro

> Módulo de prestador com código auditado, sem imports mortos, sem `.catch` silenciosos, sem fallbacks inseguros, sem código sem caller. PortalPrestador (mobile-first) identificado como 100% mock — placeholder para futuro PWA real.
