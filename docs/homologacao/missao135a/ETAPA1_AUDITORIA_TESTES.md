# ETAPA 1 — Auditoria dos Testes Existentes

## Resumo

| Categoria | Quantidade | Status |
|-----------|:----------:|:------:|
| Testes unitários do TMS | 1 | ✅ |
| Testes de componentes | 0 | ⚠️ Nenhum encontrado |
| Testes de serviços | 8 | ✅ |
| Testes Playwright (E2E) | 83 spec files | ✅ |
| Testes Supabase/SQL | 117 (63 test + 51 check + 3 SQL) | ✅ |
| Testes do Portal Cliente (Playwright) | ~15 spec files | ✅ (contidos nos PW) |
| Testes App Motorista | 6 Playwright + 4 pastas evidências | ✅ |

---

## 1. Testes Unitários do TMS

**Arquivos encontrados: 1**

| Arquivo | Descrição |
|---------|-----------|
| `src/testes/validacaoTMS.ts` | Validação ponta a ponta de módulos (Supabase, Mapbox, Evolution, n8n, Groq, Gemini). Interface `ResultadoTeste` com status OK/FALHOU/NAO_CONFIGURADO. Importa serviços reais. |

**Observação**: Não há testes unitários com framework (vitest/jest). O arquivo `validacaoTMS.ts` é um script de validação manual executado no browser ou via `DevTesteTMS`.

---

## 2. Testes de Componentes

**Arquivos encontrados: 0**

Nenhum teste de componente (React Testing Library, Storybook, etc.) encontrado no repositório.

---

## 3. Testes de Serviços

**Arquivos encontrados: 8** em `src/lib/testes/`

| Arquivo | Descrição |
|---------|-----------|
| `executarTesteReal.cjs` | Runner de testes reais (CommonJS) |
| `executarTesteReal.js` | Runner de testes reais (ESM) |
| `testarEdgeFunction.cjs` | Teste de Edge Functions |
| `testeDocumentos.ts` | Teste de processamento de documentos |
| `testeEscalaAppPrestador.ts` | Teste de integração escala ↔ app prestador |
| `testeM66Corrigido.ts` | Teste da propagação financeira M66 |
| `testeMissaoOSCompleta.ts` | Teste de fluxo completo de OS |
| `testeTMSCompleto.ts` | Teste TMS completo |

---

## 4. Testes Playwright (E2E)

**Arquivos encontrados: 83** em `tests/e2e/`

**Configuração**:
- `playwright.config.ts`: testDir `./tests/e2e`, 1 worker, fullyParallel false, timeout 120s
- Base URL: `http://localhost:8800`
- Browser: Chromium (Desktop Chrome)
- Locale: pt-BR, timezone: America/Sao_Paulo
- WebServer configurado (vite dev)

**Categorias dos testes**:
| Categoria | Quantidade | Exemplos |
|-----------|:----------:|----------|
| Central IA / Funcionários Digitais | 20 | `central-ia-f22*`, `f25*`, `f26*`, `f27*`, `f28*`, `f29*`, `f30*`, `f31*`-`f40*` |
| Portal Cliente | ~15 | `portal-cliente-*`, `missao107*`, `missao108*`, `missao55-c2` |
| Login/Auth | 4 | `login.spec.ts`, `logins-reais-todos.spec.ts`, `missao-critica-login.spec.ts`, `p0-sidebar.spec.ts` |
| App Motorista / Prestador | 6 | `flutter-prestador-*`, `tms-app-prestador.spec.ts`, `f18-*`, `financeiro-app-prestador*` |
| Financeiro | 2 | `financeiro-e2e.spec.ts`, `relatorios-export.spec.ts` |
| Fluxo Operacional | 2 | `missao55-cenario1*`, `missao56*` |
| Homologação geral | 3 | `homologacao-completa.spec.ts`, `homologacao-critica-pontaponta.spec.ts` |
| Rede Prestadores | 2 | `m84_rede_prestadores.spec.ts`, `m86_rede_visual.spec.ts` |
| Event Bus / NOC | 2 | `m99_event_bus.spec.ts`, `m100_event_bus_consumidores.spec.ts`, `m97_noc_dashboard.spec.ts` |
| Recrutamento | 1 | `recrutamento-e2e.spec.ts` |
| Controle Pátio | 1 | `controle-patio-m53.spec.ts` |
| Relatórios | 2 | `relatorios.spec.ts`, `relatorios-export.spec.ts` |

**Última execução** (`test-results/.last-run.json`): **FAILED** — 4 testes falharam (IDs anônimos).

---

## 5. Testes Supabase/SQL

**Arquivos encontrados: ~120**

Distribuição:
| Tipo | Quantidade | Descrição |
|------|:----------:|-----------|
| `scripts/*test*.ts` | 30+ | Testes TypeScript que conectam no Supabase real |
| `scripts/*test*.mjs` | 10+ | Testes em ESM |
| `scripts/*test*.cjs` | 5+ | Testes em CommonJS |
| `scripts/*check*.*` | 51 | Scripts de verificação de schema, colunas, constraints |
| `scripts/*verify*.*` | 6 | Scripts de verificação de dados/seed |
| `scripts/*.sql` | 3 | SQL direto (testes de reembolso, derivar) |

**Missões cobertas**: M66, M77, M81, M84, M85, M86, M90, M99, M103a, M104a, M106, M108, M110, M124, M127, M129c, M129c2, M132a, M133d2, F30-F40

---

## 6. Testes do Portal Cliente

**Arquivos encontrados: ~15 spec files** (subset dos Playwright)

| Arquivo | Foco |
|---------|------|
| `missao55-cenario2-portal-cliente.spec.ts` | 7 testes: Pedidos, Financeiro, Ocorrências, Comprovantes, Perfil, Fiscal, Relatórios |
| `missao58-portal-cliente.spec.ts` | Regressão geral portal |
| `missao107-fase3-portal-cliente.spec.ts` | Fase 3 Portal |
| `missao108a-reproducao-erros.spec.ts` | Reprodução de erros |
| `missao108-l2*` a `-l8*` | L2-L8: Dashboard, IA, Escala, MultiFilial, AI Report, WhatsApp, Roteirização |
| `portal-cliente-patio.spec.ts` | Pátio |
| `portal-cliente-perfil.spec.ts` | Perfil |
| `portal-cliente-real-data.spec.ts` | Dados reais |
| `portal-cliente-rls.spec.ts` | RLS/segurança |

---

## 7. Testes do App Motorista

**Arquivos Playwright: 6**
| Arquivo | Foco |
|---------|------|
| `flutter-prestador-real.spec.ts` | Testes reais com Flutter (login, aceitar rota, evidências, status) |
| `flutter-prestador-os.spec.ts` | OS no app prestador |
| `tms-app-prestador.spec.ts` | Integração TMS ↔ app prestador |
| `f18-os-tms-app-prestador.spec.ts` | OS entre TMS e app |
| `financeiro-app-prestador-f19.spec.ts` | Financeiro no app |
| `m84_rede_prestadores.spec.ts` | Rede de prestadores |

**Evidências**: 4 pastas em `test-results/` com screenshots de execuções reais Flutter.

---

## Conclusão da Auditoria

| Indicador | Valor |
|-----------|:-----:|
| Total de arquivos de teste | ~210 |
| Testes unitários (vitest/jest) | 0 |
| Testes de componentes | 0 |
| Testes de serviços (manuais) | 8 |
| Testes E2E (Playwright) | 83 spec files |
| Testes Supabase/SQL | ~117 scripts |
| Última execução PW | Falha (4 testes) |
| Cobertura funcional | ☑️ Central IA ☑️ Portal ☑️ Financeiro ☑️ OS ☑️ Tracking |
| Lacunas | Testes unitários, componentes, integração contínua |

**Próxima etapa**: ETAPA 2 — Matriz operacional de eventos.
