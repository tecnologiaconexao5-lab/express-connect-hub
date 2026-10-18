# Relatório de Homologação — TMS-030 Fase 1B · Torre de Controle

**Data:** 2026-08-01
**Escopo:** Homologação visual/funcional da Torre de Controle (`/torre-controle`) — correção de falhas reais de frontend.
**Restrições respeitadas:** nenhuma alteração em Supabase Produção (sem SQL/RPC/trigger/RLS/migration), App Flutter intocado, sem mocks/dados inventados, sem consultas/subscriptions desnecessárias, sem redesenho sem falha comprovada.

---

## 1. Resumo executivo

A Torre de Controle foi auditada por completo (965 linhas em `TorreControle.tsx`, `MapboxMap.tsx`, `CentralAlertas.tsx`, `DetalhesOperacaoSheet.tsx`, `acoesPrioritarias.ts`, `markerAdapter.ts`, `eventAdapter.ts`, `timelineVisuals.ts`).

**3 falhas reais de frontend encontradas e corrigidas:**

| # | Tipo | Severidade | Descrição | Correção |
|---|------|:----------:|-----------|----------|
| B1 | Dados errados (exibição) | Alta | `ordens_servico.cliente` e `ordens_servico.prestador` são **UUIDs** no banco de produção (ex.: `3d2d079d-...` → "HOMOLOGAÇÃO APP", `e6646799-...` → "PRESTADOR TESTE APP"). A Torre exibia o **UUID bruto** no popup do mapa, na Central de Alertas, na timeline, no Painel de Ocorrências e no sheet de detalhes. | Resolução UUID → nome via pré-carga de `clientes(id, nome_fantasia, razao_social)` e `prestadores(id, nome_completo)`, aplicada em todas as superfícies de exibição. |
| B2 | Navegação morta | Média | Botão **"Ver Todas"** do Painel de Ocorrências (rodapé) não tinha `onClick` — parecia clicável, não fazia nada. | Wire para `/operacao?tab=ocorrencias` (rota real do sidebar). |
| B3 | Affordance falsa | Baixa | Badge **"Rastreamento Automático"** (overlay do mapa) tinha `cursor-pointer` sem nenhuma ação associada. | `cursor-pointer` removido (badge decorativo). |

Nenhuma outra falha real de layout, responsividade, estado vazio, console, duplicidade ou regressão foi comprovada no código.

---

## 2. Diagnóstico da falha B1 (UUID como nome)

### 2.1. Evidência no banco (leitura plain, sem escrita)

Consulta em Produção (apenas `SELECT`):

```
ordens_servico: 120 linhas
  → cliente = UUID (35 preenchidos), ex.: 3d2d079d-708b-4d4d-9c0b-1ed9b894e37e → cliente "HOMOLOGAÇÃO APP"
  → prestador = UUID (20 preenchidos), ex.: e6646799-... → prestador "PRESTADOR TESTE APP"
```

O problema afetava as seguintes superfícies (todas liam `os.cliente`/`os.prestador` como se fossem nomes):

| Superfície | Origem dos dados | Antes | Depois |
|------------|------------------|-------|--------|
| Popup do mapa (MapboxMap) | `markers[].cliente/prestador/driverName` | UUID | Nome resolvido |
| Central de Alertas | `action.cliente/prestador` | UUID | Nome resolvido |
| Timeline Operacional | `event.cliente/prestador` (event bus + ocorrências) | UUID | Nome resolvido |
| Painel de Ocorrências (rodapé) | `osRef.cliente/prestador` | UUID | Nome resolvido |
| Sheet de detalhes (header + aba Geral) | `osForm.cliente` / `osFull.cliente` | UUID | Nome resolvido |

### 2.2. Implementação

Criada resolução de nomes centralizada em `TorreControle.tsx`:

- `carregarNomes(osLista)`: coleta os IDs de `clientes` e `prestadores` referenciados pelas OS (somente valores que casam com UUID — nomes já legíveis são preservados), busca em **2 queries batched** (`clientes` e `prestadores`) e guarda em `nomeClienteMap`/`nomePrestadorMap`.
- Guarda de deduplicação `nomesCarregadosRef`: se o conjunto de IDs não mudou entre `fetchData` consecutivos, **não** refaz as consultas (respeita a restrição de não adicionar consultas desnecessárias).
- `nomeCliente(id)`/`nomePrestador(id)`: resolvem via map; se o valor não for UUID (já é nome) ou não estiver no map, devolve o valor original inalterado — sem quebra para OS que armazenam texto.
- Derivados de exibição (`osAtivasResolvidas`, `comprovantesPendentesResolvidos`, `timelineEventsResolvidos`) alimentam markers, alertas, timeline e tabela de ocorrências.
- `DetalhesOperacaoSheet` recebe `resolverCliente`/`resolverPrestador` como props e resolve `osForm` mesmo quando `fetchOSFull` reescreve os dados com os UUIDs crus; o rodapé de "Prestador e Veículo" agora também exibe o nome do prestador resolvido a partir de `alocacoes_escala.prestador_id`.

**Custo:** +2 queries apenas quando o conjunto de IDs muda; nenhum contrato novo, nenhuma subscription nova.

---

## 3. Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/TorreControle.tsx` | Resolução UUID→nome (maps + `carregarNomes` + memos resolvidos), navegação do botão "Ver Todas", badge "Rastreamento Automático" sem affordance falsa, passagem de resolvers ao sheet. |
| `src/components/torre-controle/DetalhesOperacaoSheet.tsx` | Props `resolverCliente`/`resolverPrestador`; `osForm` resolvido; prestador exibido a partir de `prestador_id` da alocação. |

---

## 4. Validação executada

| Item | Comando | Resultado |
|------|---------|:---------:|
| Type check | `npx tsc --noEmit` | ✅ 0 erros |
| Build | `npm run build` | ✅ ok (1m33s) |
| Testes unitários | `npx vitest run` | ✅ 31/31 |

### 4.1. Testes E2E (Playwright) — BLOQUEADOS por design

A execução E2E **não foi executada** e está documentada como pendência, por duas barreiras de segurança do próprio projeto:

1. **Guarda de ambiente:** `tests/e2e/helpers/ambiente.ts` — `.env` aponta para **PRODUÇÃO** (`uwrvzsjtpgaifkktpepn.supabase.co`). `verificarAmbiente()` lança erro e bloqueia a execução em produção (bypass `PLAYWRIGHT_QA` foi removido na MISSÃO 003, R6).
2. **Credenciais reais indisponíveis:** `tests/e2e/helpers/auth.ts` lê `PLAYWRIGHT_TAMIRIS_PASSWORD` **apenas de env var, sem fallback** (MISSÃO 50). Não há senha real configurada neste ambiente, então o login dos 5 usuários corporativos falharia.

> Alinhado com missões anteriores (M133-D.3/D.4 etc.): não se executa suíte contra produção nem se burla o guard.

### 4.2. Capturas de tela (screenshots)

Não capturadas — requerem login real (usuário corporativo + senha real) contra ambiente QA. Etapa pendente; ver §6.

---

## 5. Etapas do enunciado — status

| Etapa | Item | Status |
|:-----:|------|:------:|
| 1 | Execução local limpa console | ⏳ Pendente (requer login QA) |
| 2 | Cabeçalho | ✅ Verificado no código (título, badge "Atualizado", "Conexões ativas", botão Atualizar) |
| 3 | KPIs consistentes entre fontes | ✅ Verificado — fontes somadas corretamente em `stats` (emRota/aguardandoAceite/comOcorrencia de `alocacoes_escala`, atrasadas/emRisco/semPrevisao de `ordens_servico`, semComprovante de `alocacoes_escala`) |
| 4 | Estados do mapa | ✅ Verificado — estados vazios/sem token/sem coordenadas em `MapboxMap`; contadores GPS (ativo/antigo/sem GPS/parados/ocorrências) |
| 5 | Painel via todos os pontos de entrada | ✅ Verificado — sidebar `/torre-controle`, alertas, timeline, ocorrências e markers abrem o mesmo `DetalhesOperacaoSheet` |
| 6 | Timeline | ✅ Verificado — event bus + ocorrências + escalonamentos + app events; ordenação desc; B1 corrigido nos nomes |
| 7 | Responsividade 1920/1600/1440/1366 | ⏳ Pendente (requer execução local/navegador) — estrutura usa `xl:` breakpoints; sem evidência de quebra estática |
| 8 | `tsc` + build + `vitest run` | ✅ Concluído |
| 9 | Capturas + documentação | ⚠️ Relatório gerado; capturas pendentes (QA) |

---

## 6. Pendências pós-Fase 1B

1. **Execução E2E/visual** — rodar a Torre em ambiente **QA** (`ENVIRONMENT=qa`) com `PLAYWRIGHT_*_PASSWORD` reais e capturar screenshots em 1920/1600/1440/1366.
2. **Validação visual do sheet** — confirmar popup/alertas/timeline exibindo nomes resolvidos (depende da etapa 1).
3. (Opcional, fora do escopo) "Exportar" na Torre — o componente atual **não possui** botão Exportar; quando for adicionado, seguir a regra: só habilitar com implementação real.

---

## 7. Regra de Ouro respeitada

> Nenhuma alteração em dados/SQL de Produção. Nenhum mock novo. Apenas falhas reais de frontend comprovadas foram corrigidas. O UUID exibido como nome era o defeito de maior impacto visual da Torre — agora resolvido em todas as superfícies.
