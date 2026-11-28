# CONEXÃO EXPRESS 2027 — FASE 1A
## Auditoria Técnica e Funcional Completa do TMS (`express-connect-hub`)

- **Data da auditoria:** 2026-11-28
- **Modo:** somente leitura (READ-ONLY)
- **Escopo:** front-end React/TypeScript, serviços, componentes, rotas, integrações e estruturas Supabase utilizadas pelo TMS.
- **Fora de escopo nesta fase:** aplicativo do prestador (Flutter, projeto externo, mesmo Supabase). A comparação integrada fica para a auditoria do app.
- **Declaração de conformidade:** nenhum arquivo de código, migration, RLS, bucket, dado de produção, tabela ou configuração foi alterado. Nenhum segredo/credencial foi lido ou exposto neste relatório. Nenhum deploy foi executado. Nenhuma operação de banco foi realizada.
- **Base de análise:** código em `src/`, `supabase/migrations/` (324 arquivos), `supabase/functions/`, `supabase/baseline/` (dump read-only de produção de 2026-11-03) e `supabase/config.toml`. Também foram considerados os relatórios históricos em `docs/` e `AGENTS.md` como contexto, mas as conclusões foram validadas no código.

### Legenda de classificação (obrigatória)

| Código | Significado |
|:------:|-------------|
| **A** | Implementada e funcional (código + dados/integração reais) |
| **B** | Implementada parcialmente (parte real, parte simulada/limitada) |
| **C** | Existe visualmente, mas não possui funcionamento completo |
| **D** | Existe no código, mas não está integrada (órfã / ponta solta) |
| **E** | Não implementada |
| **F** | Necessita de investigação adicional |

---

## 0. Sumário executivo

### 0.1 Números da auditoria

| Indicador | Valor |
|-----------|:-----:|
| Módulos funcionais auditados | **20** |
| Módulos classificados **A** (funcionais no núcleo) | **8** |
| Módulos classificados **B** (parciais) | **12** |
| Módulos classificados **C/D** (apenas visual ou não integrado) | **0** |
| Itens de funcionalidade detalhados (Anexo D) | **117** |
| └ Classificados **A** | **51** |
| └ Classificados **B** | **35** |
| └ Classificados **C** | **11** |
| └ Classificados **D** | **9** |
| └ Classificados **E** | **11** |
| └ Classificados **F** | **0** |
| Integrações externas mapeadas | **15** |
| └ Reais/operacionais (com ou sem configuração) | 9 |
| └ Condicionais/simuladas/não configuradas | 6 |
| Tabelas no schema `public` (baseline de produção) | **~250** |
| Views | **24** |
| Functions/RPCs | **~161** |
| Triggers | **~132** |
| Policies RLS (vivas no baseline) | **614** |
| Tabelas com RLS habilitado | **239** |
| Edge Functions | **17 + `_shared`** |
| Buckets de Storage mapeados | **13** |

### 0.2 Leitura em uma frase

O TMS tem um **núcleo operacional-financeiro-fiscal robusto e conectado ao Supabase real** (OS, escala, POD, financeiro, faturas/repasses, contratos, relatórios, Torre de Controle), mas convive com **módulos parcialmente simulados** (CT-e/MDF-e, combustíveis, seguros, SLA, governança, CRM/propostas, IA documental/recrutamento, gerador “IA” de escala) e com **lacunas estruturais de rastreabilidade de volumes** (sem volume individual, código de barras/QR operacional, cadeia de custódia, lotes/validade e entregas parciais). A prioridade técnica é **segurança de credenciais/RLS**, **consolidação de fontes duplicadas** e **fechamento das pontas fiscais/notificação**.

### 0.3 Principais riscos

1. **Segurança de credenciais no bundle** — variáveis sensíveis com prefixo `VITE_` (ex.: segredo/refresh token Zoho e token interno de Edge) são embutidas no front e ficam expostas ao navegador. (`src/lib/supabase.ts` também fixa URL + anon key — a anon key é pública por design, mas o hardcode impede rotação limpa.)
2. **RLS permissiva** — há ~266 policies com `USING(true)` e 403 policies para `anon`; as migrations de endurecimento (`20260725_missao_rls_fix_*`) foram criadas mas **não aplicadas** em produção, segundo o próprio repositório.
3. **Fontes duplicadas de verdade** — `ocorrencias` × `portal_ocorrencias`; `alocacoes_escala` × `escala_operacional` (legado); `entregas_protocolo` × `os_pod`/`portal_comprovantes`; `pagamentos_prestadores` × `pagamento_prestadores` (legado).
4. **Mocks mascarando ausência de dados** — CRM, Propostas, Combustíveis, Seguros, SLA, Governança, gerador “IA” da Programação, IA de recrutamento e IA documental.
5. **Fiscal parcial** — CT-e/MDF-e simulados por padrão (`FOCUS_REAL_ENABLED` desligado); NFS-e real, mas com histórico de 404 do ADN em homologação; serviços legados `nfse.ts`/`sefaz.ts` órfãos e com URLs fictícias.
6. **Rastreabilidade de carga incompleta** — sem volume individual rastreável, sem leitura por scanner/coletor, sem manifesto digital de carga real (MDF-e simulado), sem cadeia de custódia e sem lotes/validade.
7. **Push/offline** — infraestrutura FCM completa no backend, mas o app externo não possui Firebase; PWA instalável porém com service worker ativamente **desregistrado** no boot, sem sincronização offline.

---

## 1. Arquitetura identificada

### 1.1 Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Linguagem | TypeScript 5.8 |
| UI | React 18.3 + Vite 5.4 |
| Roteamento | React Router DOM 6.30 (`createBrowserRouter` + `RouterProvider`) |
| Componentes | shadcn/ui sobre Radix UI, Tailwind CSS 3.4, `class-variance-authority`, `tailwind-merge` |
| Estado servidor | `@tanstack/react-query` 5 |
| Estado cliente | `zustand` 4 |
| Formulários | `react-hook-form` + `zod` |
| Backend | Supabase (Postgres 17, Auth, Storage, Realtime, Edge Functions/Deno 2) |
| Gráficos | `recharts` |
| PDF | `jspdf` + `jspdf-autotable`; `pdfjs-dist` |
| Planilhas | `xlsx`, `papaparse` |
| Mapas | `mapbox-gl`, `react-map-gl`, Mapbox Geocoding/Directions |
| QR | `qrcode.react` |
| OCR | `tesseract.js` |
| Datas | `date-fns`, `date-fns-tz` |
| Testes | `vitest` (unit), Playwright 1.57 (E2E), Maestro (fluxos mobile no repositório) |
| Deploy | Vercel (front) + Supabase (Edge/DB/Storage); há `docker/`, `nginx.conf` e `vercel.json` |

### 1.2 Estrutura de pastas (relevante)

```
src/
  App.tsx                # data router + rotas + providers
  components/            # ~35 domínios (operacao, financeiro, fiscal, portal-cliente, portal-prestador, ...)
  pages/                 # ~57 páginas (inclui públicas: CotacaoExpress, PedidoRapido, Tracking, PortalCliente)
  services/              # ~31 subpastas + ~45 arquivos de serviço
  modules/recrutamento/  # módulo isolado (kanban, ofertas, CRM, IA, talentos)
  hooks/                 # 18 hooks (escala, POD, realtime, alerts, form draft, permissões)
  contexts/              # AuthContext, TenantContext, DashboardFilterContext
  lib/                   # supabase client, auth, permissões, mappers, PDFs, regras de negócio puras
  stores/                # zustand (ex.: portal prestador)
  types/, utils/, helpers/, config/, constants/
supabase/
  migrations/            # 324 arquivos SQL (jan/2026 → nov/2026)
  functions/             # 17 Edge Functions + _shared (NFS-e)
  baseline/              # dump read-only de produção (2026-11-03)
  sql/, scripts/, migrations_lab/
api/                     # api/nfse-sefin-proxy.ts (proxy Vercel para Sefin/DANFSe)
tests/e2e/, e2e/, .maestro/, playwright*.ts
docs/                    # histórico de missões e auditorias
```

Observação: a raiz do repositório contém **milhares de arquivos auxiliares** (scripts `.cjs`/`.mjs`, screenshots `screen*.png`, relatórios `.txt`, arquivos `*.sql` avulsos). Isso é dívida de higiene de repositório, não afeta o runtime, mas dificulta auditoria e manutenção.

### 1.3 Rotas (páginas) identificadas

**Públicas (fora do `ProtectedRoute`):**
`/login`, `/forgot-password`, `/reset-password`, `/cadastro-prestador`, `/rastrear`, `/rastrear/:codigo`, `/t/:codigo`, `/rastreamento/:token`, `/pedido-rapido`, `/c`, `/cotacao-express`, `/cotacao-express/detalhes/:id`, `/portal-cliente`, `/portal-prestador`, `/zoho/callback`, `/convite`, `/` (redirect para `/login`).

**Protegidas (`ProtectedRoute` + `AppLayout`):**
`/dashboard`, `/torre-controle`, `/roteirizador`, `/comercial`, `/operacao`, `/cadastros` (+ prestadores, fornecedores, clientes, veículos, auxiliares, análise-documentos), `/financeiro`, `/fiscal`, `/frota`, `/combustiveis`, `/recrutamento` (+ whatsapp-crm, banco-talentos), `/contratos`, `/sla`, `/relatorios`, `/biblioteca`, `/central-documentos`, `/governanca`, `/ia-automacoes`, `/ia-central-automacao`, `/central-ia`, `/admin/tenants`, `/admin/conectores`, `/robo-recrutamento-monitor`, `/monitor-api`, `/app-prestador`, `/configuracoes`, `/comunicacao`, `/seguros`, `/inteligencia`, `/integracoes`, `/mensagens-whatsapp`, `/central-comunicacao`, `/controle-patio`, `/os-mobile`, `/comprovantes`.

### 1.4 Contextos, hooks e estado

- **`AuthContext`**: Supabase Auth (`signInWithPassword`, `getSession`, `onAuthStateChange`, `signOut`, `resetPasswordForEmail`), mapeia `tenant_usuarios.papel` → `UserRole`, grava em `auth_eventos_auditoria`. Tem `comTimeout` e separação de “usuário imediato” x “role assíncrona” (correção de race de sessão).
- **`TenantContext`**: resolução de tenant ativo (sem fallback hardcoded após M003).
- **`DashboardFilterContext`**: filtro global de período no Dashboard.
- **Hooks principais**: `useEscala`, `useEscalaRealtime`, `useEventosRealtime`, `usePod`, `useNovaOSAlerta` (polling 25s — `ordens_servico` não está no Realtime), `useCotacoesPublicasRealtime`, `usePermissaoFinanceira`, `useFormExitGuard` + `useRouterBlocker`, `useViaCEP`, `useTheme`.
- **Worker no browser**: `eventProcessorWorker.iniciar(10000)` no `App.tsx` — processa `eventos_oficiais` via `setInterval` no navegador (não há cron server-side).

### 1.5 Autenticação, permissões e acesso ao Supabase

- **Cliente Supabase**: `src/lib/supabase.ts` — `createClient(url, anonKey)` com URL/anon key fixadas no código (comentário justifica: “credenciais públicas por definição; acesso controlado por RLS”). Existe `createServiceClient()` separado para backend/scripts (não usado no front).
- **RBAC**: `tenant_usuarios(user_id, tenant_id, papel, status='ativo')`; papéis `super_admin`, `admin`/`admin_tenant`, `financeiro`, `comercial`, `operacional`/`operador`, `atendimento`, `cliente`, `prestador`. Matriz em `src/lib/permissoes.ts`; rotas em `src/lib/routePermissions.ts`; menu em `src/lib/sidebarData.ts` (filtra por `podeAcessar`).
- **Rota sem permissão** cai em `{ modulo: "configuracoes", roles: [] }` (default restritivo).
- **Portal Cliente**: `usuarios_cliente.auth_user_id` → `cliente_id`; RLS por `f_portal_cliente_id()`.
- **Prestador/App**: `prestadores.auth_user_id`; RPCs `SECURITY DEFINER` validam `auth.uid()`.

### 1.6 Observações arquiteturais

- **Forte uso de RPCs e triggers** para regras de negócio no banco (numeração de OS, propagação financeira M66/M80, baixas/estornos, faturas, fechamentos, ofertas/rede, onboarding do app).
- **Duas camadas de cálculo de preço**: motor de precificação no front (`precificacaoEngineService`, `calcularPrecoRapido`) + RPC/edge. Há legado (`engineFinanceira.ts`, `calculoService.ts`, `calculoEscalaFinanceiro.ts`) marcado `@deprecated`.
- **PDF gerado no cliente** (jsPDF) para OS, orçamento, proposta, fatura e relatórios; armazenamento em buckets Supabase.
- **Alguns módulos isolados em `src/modules/recrutamento`**, fora do padrão `pages/components/services` do restante.

---

## 2. Mapa de módulos

| # | Módulo | Página principal | Serviços centrais | Status |
|:-:|--------|------------------|-------------------|:------:|
| 1 | Dashboard | `src/pages/Dashboard.tsx` | componentes `dashboard/*` | **A** |
| 2 | Clientes | `CadastrosClientes.tsx` | `services/clientes/*`, `dbMappers` | **A** |
| 3 | Prestadores | `CadastrosPrestadores.tsx` | `prestadores/*`, `documentosPrestadorService` | **A** |
| 4 | Veículos & Categorias | `CadastrosVeiculos.tsx` | `frota/*`, `constants/tiposVeiculo`, `veiculoPeso` | **B** |
| 5 | Ordens de Serviço | `Operacao.tsx` (tab OS), `OsMobile.tsx` | `ordemServicoService`, `operacao/*` | **A** |
| 6 | Programação / Escala | `Operacao.tsx` (tab escala) | `escala/*`, `useEscala` | **B** |
| 7 | Rotas / Paradas / Coletas / Entregas | `Operacao.tsx` (tab roteirização), form OS | `maps/*`, `roteirizacao*`, `resumoRotaOS` | **A** |
| 8 | Devoluções / Reentregas / Ocorrências | `Operacao.tsx` (tabs) | `ocorrenciaService`, `patioService` | **B** |
| 9 | Comprovantes / POD | `Comprovantes.tsx` | `comprovantes/*`, `podService` | **A** |
| 10 | Financeiro & Repasses | `Financeiro.tsx` | `financeiro/*` (13 serviços) | **A** |
| 11 | Documentos | `CentralDocumentos.tsx`, `AnaliseDocumentos.tsx` | `documentos/*`, `documentos-ia` | **B** |
| 12 | Contratos | `Contratos.tsx` | `contratos/*`, `contratosPdfService` | **B** |
| 13 | Notificações / Comunicação | `Comunicacao.tsx`, `CentralComunicacao.tsx` | `comunicacao/*`, `evolutionApi`, `zohoEmail`, `n8n` | **B** |
| 14 | Relatórios & Indicadores | `Relatorios.tsx` | `relatorios/relatorioService` | **A** |
| 15 | Rastreamento | `Tracking.tsx`, `RastreamentoPublico.tsx` | `rastreamento/trackingService`, Mapbox | **B** |
| 16 | Gestão de usuários / Configurações | `Configuracoes.tsx`, `Governanca.tsx`, `admin/*` | `configuracoesService`, `adminTenantsService` | **B** |
| 17 | Comercial (orçamentos, cotação, CRM, propostas, recrutamento) | `Comercial.tsx`, `Recrutamento.tsx`, `CotacaoExpress.tsx`, `PedidoRapido.tsx` | `comercial/*`, `cotacoes/*`, `modules/recrutamento` | **B** |
| 18 | Fiscal (NFS-e, CT-e, MDF-e) | `Fiscal.tsx` | `fiscal/*`, Edges `nfse-*`/`focus-*` | **B** |
| 19 | Frota / Combustíveis / Seguros | `Frota.tsx`, `Combustiveis.tsx`, `Seguros.tsx` | `frota/*`, `combustiveis*`, `seguros` (inline) | **B** |
| 20 | Central IA / Torre / SLA | `CentralIA.tsx`, `TorreControle.tsx`, `SLA.tsx` | `centralIa*`, `ia/*`, `torre-controle/*` | **B** |

> **Ressalva de leitura:** classificação “A” no módulo significa que o **núcleo** do módulo é real e funcional; pode haver itens internos parciais (detalhados no Anexo D). Classificação “B” significa que o módulo mistura partes reais com partes simuladas, visuais ou não integradas.

---

## 3. Funcionalidades existentes (núcleo funcional real)

As funcionalidades abaixo operam sobre Supabase real e foram confirmadas no código (não são mock):

1. **Dashboard** com 8 abas (Executivo, Operacional, Comercial, Financeiro, Alertas, Rede, Eventos) consultando `ordens_servico`, `financeiro_*`, `alocacoes_escala`, `rede_*` etc.
2. **Clientes**: CRUD, endereços, contratos/anexos, tabela de valores, ViaCEP, histórico de endereços.
3. **Prestadores**: CRUD, veículos, documentos (com status IA), treinamentos, gestão de acesso ao app via Edge `gestao-acesso-prestador`.
4. **Veículos**: CRUD, capacidades, vínculo a prestador, despesas operacionais.
5. **OS**: wizard completo, numeração sequencial via RPC, itinerário multi-paradas, cálculo de rota/pedágio, vínculo com escala, exclusão com limpeza de vínculos, WhatsApp T1/T2, PDF.
6. **Escala/Programação**: CRUD de `alocacoes_escala`, status, troca de motorista/veículo, histórico, reversa.
7. **Rotas**: Mapbox geocoding/directions, roteirizador web (`rotas`/`rota_paradas`), favoritos de endereço.
8. **POD/Comprovantes**: `entregas_protocolo` (foto, canhoto, assinatura, GPS, recebedor), dossiê, timeline, comparação, Storage.
9. **Ocorrências** e **Controle de Pátio** (check-in/doca/carregamento manual).
10. **Logística reversa** (`alocacoes_escala.reversa_*`, RPC do app).
11. **Financeiro**: receber/pagar, baixas/estornos, faturas (rascunho→emitida→cancelada) com PDF, repasses/fechamentos/extrato de prestador, DRE, fluxo de caixa, inadimplência, plano de contas, contas bancárias.
12. **Contratos**: modelos, gerados, hash SHA-256, histórico, PDF, bucket `contratos`.
13. **Documentos**: central com filtros, upload universal (drag/drop/câmera), versionamento, histórico, compartilhamento.
14. **Relatórios**: extrato operacional, faturamento, margem, prestadores; export PDF/Excel; Storage.
15. **Rastreamento**: leitura/assinatura de `portal_tracking_realtime`, mapa Mapbox, tracking público por token.
16. **Torre de Controle**: KPIs reais, Realtime, timeline `eventos_oficiais`, mapa operacional.
17. **Comercial**: orçamentos, Cotação Express (2 fases), Pedido Rápido, tabela de valores, conversão orçamento→OS.
18. **Recrutamento**: pipeline/kanban, ofertas públicas, banco de talentos, onboarding (dados reais; IA é mock).
19. **NFS-e Nacional**: Edge real com DPS, XMLDSig, mTLS Sefin, DANFSe do ADN.
20. **Fiscal estrutural**: tabelas/CRUD de CT-e/MDF-e/NFS-e, emitente, regras, auditoria fiscal.
21. **Configurações**: empresa, identidade, valores, veículos, integrações, notificações (JSON em `configuracoes_sistema`).
22. **Admin Tenants**: CRUD de tenants, usuários e convites; RPCs auxiliares.
23. **Central IA**: persistência real de robôs, tarefas, aprovações, logs, missões/metas, agenda, fila de trabalho, memória corporativa, conectores, sessões de agente.
24. **RBAC/multi-tenant**: `tenant_usuarios`, `current_tenant_id_safe()`, 239 tabelas com RLS, matriz de permissões no front.

---

## 4. Funcionalidades incompletas (B/C/D)

Itens parciais, visuais ou não integrados (classificação B/C/D), agrupados:

### 4.1 Parciais (B) — highlights

- **Categorias de veículo** não são uma entidade configurável: catálogo e capacidades estão **hardcoded em ≥6 arquivos TS** (`constants/tiposVeiculo.ts`, `lib/veiculoPeso.ts`, `lib/ofertaPublica.ts`, `lib/veiculoCotacao.ts`, `helpers/validarAlocacaoEscala.ts`, `services/operacao/cargaService.ts`). Só o fator de cubagem é parametrizável.
- **Programação Operacional real**, mas o botão “Gerar com IA” cria alocações aleatórias em `localStorage`.
- **Ocorrências** reais, porém com **duas bases** (`ocorrencias` na Torre e `portal_ocorrencias` no serviço) — risco de divergência de histórico.
- **Financeiro**: núcleo real; alguns painéis (`Conciliação Bancária`, partes de `ContasReceber/Pagar`) são parciais/visuais.
- **Documentos**: gestão real; **IA documental é simulada/determinística** na Edge `documentos-ia`.
- **Comunicação**: persistência real; **envio** é simulado por padrão (`communicationHubService.simulationMode = true`) até `VITE_COMUNICACAO_PRODUCAO_ASSISTIDA=true` + provedor configurado.
- **Rastreamento**: infraestrutura A, mas depende do **app externo** popular `portal_tracking_realtime`; sem ingestão o mapa não “acende”.
- **Fiscal**: NFS-e real; **CT-e/MDF-e simulados por padrão** (`FOCUS_REAL_ENABLED` desligado).
- **Combustíveis**: preços **simulados** (`PRECOS_ANP_SIMULADOS`, `Math.random`).
- **Seguros**: maioria dos painéis é **mock/estático**; apenas `SegurosFinanceiro` persiste em `sinistros`/`seguros_auto_apolices`.
- **Central IA**: persistência real; **execução de integrações externas é simulada** (`externalIntegrationEngine` é 100% mock; `actionEngineService` marca `status:"simulado"` em vários caminhos).
- **CRM/Propostas**: fallback mock quando o banco está vazio; `ListaPropostas` inicia com `mockPropostas`; `propostaService` gera números `PROP-<random>`.
- **Recrutamento IA**: scores aleatórios (`modules/recrutamento/services/iaService.ts`).
- **Simulador de Frete**: tabela fixa demonstrativa.
- **SLA**: página inteira estática.
- **Governança**: tabelas/logs fictícios, sem Supabase.
- **Usuários/Perfis em Configurações**: espelho em `configuracoes_sistema.usuarios`; **não** cria/edita `auth.users`/`tenant_usuarios`.
- **Conferência de carregamento** (Portal Cliente e Escala): painéis visuais; a coluna `checklist` consultada não existe em `alocacoes_escala`.
- **MDF-e**: modelo + rascunho reais; transmissão simulada.
- **Relatórios**: as views `vw_relatorio_*` existem no banco mas **não são usadas** pelo serviço atual.
- **Contratos operação recorrente**: cadastro real; execução recorrente automática ainda limitada.
- **Conferência de carregamento / qtd prevista x recebida por item**: só por parada (`rota_paradas.volumes`/`volumes_entregues`), não por item.

### 4.2 Visual sem funcionamento (C)

- Gerador “IA” de Programação Operacional (`EscalaLista.tsx`).
- Página `/sla` completa (KPIs/gráficos/tabelas fixos).
- Página `/governanca` (auditoria/histórico/permissões/LGPD estáticos).
- Simulador de Frete (`SimuladorFrete.tsx`).
- Painel “Controle de Carregamento” (Portal Cliente, `carregamentos = []`).
- Painel “Ver Carregamento” (Escala, coluna `checklist` inexistente).
- Seguros (`ConfiguracaoGeral`, `RegrasCalculo`, `AlertasPainel`, `ApolicesTransportador`, `HistoricoSinistros`, `RegrasCliente` — arrays mock).
- Combustíveis (painel ANP simulado).
- PWA/offline: manifest existe, mas o service worker é **desregistrado** no boot (`index.html`).
- CRM e Propostas quando não há dados (exibem mock).

### 4.3 Código não integrado / órfão (D)

- `src/services/nfse.ts` e `src/services/sefaz.ts` — sem consumidores, URLs fictícias (`api.prefeitura.gov.br`, `api.sefaz.gov.br`).
- `supabase/functions/criar-alocacao-escala` — sem chamada no front.
- `src/components/prestadores/mockPrestadores.ts` e `mockOrcamentos.ts` — não usados em telas.
- `supabase/functions/efi-mtls-probe` — diagnóstico/temporário.
- `auditoria_operacional` — tabela criada em migration, **ausente no baseline de produção**; `Tracking.tsx` consulta e falha silenciosamente.
- `os_pod` / `portal_comprovantes` — coexistem com `entregas_protocolo` (fonte oficial); risco de confusão.
- `operation_timeline_events` e `os_historico` — escritos, mas **sem leitor no TMS** (write-only).
- `escala_operacional` (legado) — ainda referenciada em pontos antigos/scripts.
- `nfse.ts`/`sefaz.ts` e `pagamento_prestadores` (legado) — dívida técnica.

---

## 5. Funcionalidades ausentes (E)

Itens classificados **E** (não implementados):

1. **Cadastro individual de volumes** (registro por volume com ID/etiqueta, vinculado a OS/parada).
2. **Identificação operacional por código de barras / QR Code por volume** (o QR existente é fiscal/DANFSe e o código de barras é de boleto).
3. **Leitura/conferência por scanner/coletor** (bipagem).
4. **Entregas parciais** como entidade explícita (status/registro por entrega parcial).
5. **Cadeia de custódia** formal por volume (quem entregou/recebeu, quando, onde, por item).
6. **Controle de lotes e validade de mercadoria** (lote/serial/validade/ANVISA).
7. **ETA dinâmico** (chegada estimada em tempo real a partir do GPS; hoje há apenas duração estática da rota).
8. **Assinatura eletrônica externa** de contratos (D4Sign/Clicksign ou equivalente).
9. **Agendamento/cache de relatórios** e compartilhamento por e-mail de relatórios.
10. **Sincronização offline real** no TMS web (sem service worker ativo / sem outbox IndexedDB).
11. **Devoluções** e **Reentregas** como telas funcionais (hoje são `PlaceholderPage`).

> Observação: “Devoluções” enquanto **logística reversa** existe e é funcional (coleta reversa em `alocacoes_escala`). O que está ausente é a **tela/aba de Devoluções** e o **fluxo dedicado de Reentregas**.

---

## 6. Mapa de estruturas do Supabase

> Fontes: `supabase/migrations` (324 arquivos) + `supabase/baseline/full_production_schema_readonly_20261103.sql`. Contagens do baseline de produção (schema `public`). Migrations posteriores a 2026-11-03 adicionam algumas tabelas/RPCs (ver 6.9). Nenhum segredo é exposto.

### 6.1 Números estruturais

- `CREATE TABLE` no baseline: **250** (~255–260 com pós-2026-11-03).
- `CREATE VIEW`: **24** (sem materialized views).
- `CREATE FUNCTION`: **161** vivas (200 statements históricos).
- `CREATE TRIGGER`: **132**.
- Policies RLS: **614** vivas (1226 statements históricos de create/drop/recreate).
- Tabelas com `ENABLE ROW LEVEL SECURITY`: **239**.
- Índices: 699 · FKs: 266 · PKs: 250 · UNIQUE: 48.

### 6.2 Tabelas por domínio (visão macro)

| Domínio | Tabelas principais |
|---------|--------------------|
| Tenants/Usuários/Auth/Config | `tenants`, `tenant_usuarios`, `usuarios_cliente`, `perfis_permissoes`, `roles_permissoes`, `convites`, `auth_eventos_auditoria`, `filiais`, `unidades`, `centros_custo`, `configuracoes_sistema`, `configuracoes_fiscais`, `municipios_ibge`, `regioes` |
| Clientes/Comercial | `clientes`, `clientes_contratos`, `enderecos_cliente`, `enderecos_clientes`, `leads`, `campanhas`, `criativos`, `postagens`, `orcamentos`, `comercial_hunter_*` |
| Prestadores/Recrutamento/Talent | `prestadores`, `prestadores_app`, `prestadores_ocorrencias`, `prestador_disponibilidade`, `prestador_oportunidade_historico`, `prestador_os`, `prestador_perfil_talento`, `prestador_treinamentos`, `rascunhos_prestador`, `permissoes_prestador`, `candidatos`, `candidato_documentos`, `recrutamento_*`, `fluxo_recrutamento`, `match_operacoes_prestadores`, `academia_*`, `biblioteca_documentos`, `modelos_mensagens` |
| Veículos/Frota/Custos | `veiculos`, `tabela_prestador`, `tabela_prestador_operacional`, `tabelas_valores`, `tabela_valores`, `combustivel_precos`, `seguros_apolices`, `sinistros`, `despesas_operacionais` |
| OS/Operações | `ordens_servico`, `os_historico`, `os_ocorrencias`, `os_pod`, `operacoes`, `operacoes_financeiro`, `operation_km`, `operation_timeline_events`, `ocorrencias`, `escala_operacional` (legado) |
| Escala/Alocações | `alocacoes_escala`, `historico_alocacoes_escala`, `liberado_app_audit` |
| Pátio/Rotas | `patio_unidades`, `patio_docas`, `patio_fila`, `patio_regras_fila`, `patio_checkins`, `patio_alertas`, `patio_eventos`, `patio_rodizio`, `operacao_localizacao`, `operacao_mensagens`, `rotas`, `rota_execucoes`, `rota_paradas`, `route_stops` |
| Entregas/POD | `entregas_protocolo`, `delivery_proofs`, `os_pod`, `portal_comprovantes`, `portal_protocolos`, `pending_uploads`, `provider_documents` |
| Financeiro | `financeiro_receber`, `financeiro_receber_audit`, `financeiro_pagar`, `financeiro_baixas`, `financeiro_transferencias`, `pagamentos_prestadores`, `pagamentos_prestadores_itens`, `pagamento_prestadores` (legado), `lotes_pagamento`, `lotes_pagamento_itens`, `fechamentos_prestador`, `itens_fechamento_prestador`, `movimentos_conta_corrente_prestador`, `reembolsos_prestador`, `faturas`, `fatura_itens`, `fatura_contadores_cliente`, `recibos`, `contas_financeiras`, `fornecedores`, `composicao_financeira`, `composicao_financeira_os` |
| Fiscal | `fiscal_nfse`, `fiscal_ctes`, `fiscal_mdfes`, `fiscal_events`, `fiscal_logs`, `fiscal_historico_status`, `fiscal_xml_recebidos`, `fiscal_documentos_vinculados`, `certificados_fiscais`, `configuracoes_fiscais`, `regras_fiscais_nfse`, `regras_fiscais_cte` |
| Contratos | `contratos_gerados`, `contratos_historico`, `contratos_modelos`, `contratos_operacao`, `contratos_operacao_execucao`, `contratos_operacao_rotas`, `clientes_contratos` |
| Documentos | `documentos_metadata`, `documentos_prestadores`, `candidato_documentos`, `provider_documents`, `biblioteca_documentos` |
| Comunicação/Notificação | `communication_events/preferences/templates`, `comunicacoes_mensagens`, `comunicacoes_destinatarios_autorizados`, `whatsapp_instancias/conversas/mensagens`, `recrutamento_whatsapp_*`, `portal_notificacoes`, `modelos_mensagens`, `eventos_oficiais`, `motorista_push_tokens`, `push_notificacoes_fila` |
| CRM | `crm_leads`, `crm_conversas`, `crm_mensagens`, `crm_followups`, `crm_historico`, `crm_interacoes_prestadores` |
| IA/Automações (~70) | `automacoes_*`, `ia_*` (51 tabelas), `memoria_*`, `raciocinio_auditoria`, `diretor_virtual_*`, `escalonamentos_humanos`, `rotinas_ia`, `agentes_ia_internos` |
| Portal Cliente | `portal_pedidos`, `portal_ocorrencias`, `portal_avaliacoes`, `portal_comprovantes`, `portal_protocolos`, `portal_rotas`, `portal_relatorios`, `portal_faturas`, `portal_preferencias_cliente`, `portal_notificacoes`, `portal_tracking_realtime`, `usuarios_cliente` |
| Cotações públicas | `cotacoes_publicas` (metadata JSONB com precificação/paradas) |
| Rede de oportunidades | `rede_oportunidades`, `rede_visualizacoes`, `prestador_oportunidade_historico`, `recrutamento_ofertas`, `recrutamento_oferta_eventos`, `recrutamento_oferta_identificadores`, `recrutamento_oferta_rate_limit` |
| Tracking/App | `tracking_public_links`, `operacao_localizacao`, `portal_tracking_realtime`, `motorista_app_sessoes`, `motorista_checkins`, `driver_operations`, `driver_incidents`, `driver_profiles` |
| Integrações/Sistema | `central_integracoes`, `integracoes_config`, `integracoes_logs`, `webhooks_recebidos`, `homologacoes`, `security_violation_log`, `auditoria_operacional` (ausente em prod), `_hml_seed_checkpoint` |

### 6.3 Views (24)

`vw_app_motorista_operacoes`, `vw_app_motorista_paradas`, `vw_app_notificacoes_pendentes`, `vw_motorista_viagens`, `vw_motorista_dashboard`, `vw_motorista_documentos`, `vw_motorista_financeiro`, `vw_motorista_checklist`, `vw_route_stops_driver`, `vw_portal_financeiro_cliente`, `portal_cliente_pedidos_view`, `portal_cliente_ordens_view`, `portal_cliente_financeiro_view`, `portal_cliente_alocacoes_view`, `portal_cliente_pods_view`, `portal_cliente_perfil_view`, `vw_relatorio_faturamento_cliente`, `vw_relatorio_faturamento_detalhado`, `vw_relatorio_prestadores_analise`, `vw_relatorio_pagamento_detalhado`, `vw_relatorio_pagamento_prestador`, `vw_noc_operacional`, `vw_hierarquia_tabelas`, `vw_tenant_usuarios`, `central_ia_dashboard_view`, `prestadores_public`.

### 6.4 Functions/RPCs (principais por domínio)

- **Multi-tenant/Auth**: `current_tenant_id_safe`, `current_cliente_id_safe`, `f_portal_is_staff`, `f_portal_cliente_id`, `f_usuario_pode_acessar_cliente`, `f_usuario_pode_acessar_tenant`, `user_is_super_admin`, `user_has_tenant_access`, `user_tenant_role`, `f_obter_prestador_por_auth`, `listar_usuarios_tenant`, `buscar_usuario_por_email`, `mascarar_cpf`, `mascarar_telefone`.
- **App Motorista/Escala/POD**: `f_buscar_operacoes_motorista`, `f_avancar_etapa_app_motorista`, `f_atualizar_reversa_app`, `f_atualizar_status_parada`, `f_buscar_oportunidades_para_prestador`, `f_aceitar_oportunidade_rede`, `aceitar_viagem`, `recusar_viagem`, `registrar_checkin_motorista`, `registrar_localizacao_motorista`, `registrar_posicao_motorista`, `reportar_ocorrencia_motorista`, `f_sync_delivery_proof_to_entregas`, `f_sync_tracking_to_oper_localizacao`, `f_registrar_push_token`, `f_remover_push_token`, `f_validar_pod_operacao`, `app_s6_*` (onboarding).
- **OS/Cotação**: `f_cotacao_detalhes_para_os`, `converter_pedido_para_os`, `f_cotacao_status_cliente`, `f_proximo_numero_os`, `f_proximo_numero_os_sequencial`, `f_reprocessar_pedido_portal`, `f_registrar_oferta_publica`, `f_converter_oferta_em_candidato`, `f_atualizar_status_oferta`.
- **Financeiro**: `f_registrar_baixa_financeira`, `f_estornar_baixa_financeira`, `f_criar_recebivel_manual`, `f_criar_lancamento_manual_prestador`, `f_emitir_fatura`, `f_cancelar_fatura`, `f_mover_fatura_status`, `f_gerar_lote_pagamentos`, `f_confirmar_pagamento_prestador`, `f_aprovar_pagamento_prestadores`, `f_conferir_fechamento`, `f_aprovar_fechamento`, `f_confirmar_pagamento_fechamento`, `f_cancelar_fechamento`, `f_transferir_entre_contas`.
- **Fiscal/Documentos**: `f_scan_validade_documentos`, `f_documentos_prestadores_para_metadata`, `obter_documento_signed_url`, `notificar_xml_recebido`.
- **Triggers de negócio**: `f_trg_propagar_financeiro_alocacao/os`, `f_trg_cancelar_financeiro_*`, `f_trg_event_bus_consumer`, `f_trg_notificar_oportunidade_rede`, `f_trg_notificar_os_para_app`, `f_trg_enfileirar_push_notificacao`, `f_trg_os_normalizar_cotacao`, `f_trg_sync_tracking_to_oper_localizacao`.

### 6.5 Edge Functions (17 + `_shared`)

| Função | Papel | Estado |
|--------|-------|:------:|
| `pedido-rapido` | Pedido público (criar/estimar), grava `portal_pedidos` + `orcamentos` | Real |
| `cotacao-frete` | Cotação pública via API **Frenet** (CORS aberto) | Real (cond.) |
| `criar-alocacao-escala` | Cria alocação via token interno | Código existe; **sem chamada no front** |
| `ofertas-publicas` | Oferta pública → RPC, captcha/rate-limit | Real |
| `gestao-acesso-prestador` | Credenciais/ativar/bloquear prestador | Real (JWT) |
| `nfse-assinar-transmitir` | NFS-e Nacional: DPS + XMLDSig + mTLS Sefin + DANFSe ADN | Real (mTLS) |
| `nfse-upload-certificado` | Upload A1 criptografado | Real (JWT) |
| `focus-emissao` | CT-e/MDF-e/NFS-e via Focus NFe | **Simulado por padrão** |
| `focus-consulta` / `focus-documentos` | Consulta/obtenção de CT-e | Condicional |
| `fiscal-documento-url` / `fiscal-email-documentos` | URL assinada / envio de CT-e | Real/cond. |
| `documentos-ia` | Análise documental estruturada | **Simulada/determinística** |
| `enviar-push` | Consome fila e envia FCM HTTP v1 | Implementada; não comprovada em prod |
| `proxy-ia` | Proxy LLM (Groq/Gemini/OpenRouter/OpenAI/Anthropic) | Real se secrets |
| `whatsapp-recrutamento-webhook` | Recebe mensagens de recrutamento | Real (service_role) |
| `efi-mtls-probe` | Diagnóstico mTLS Efi | Temporário |
| `_shared/` | `nfseAdn`, `nfseCrypto`, `nfseDps`, `nfseEmail`, `nfseEvento`, `nfsePfx`, `nfseSefin`, `nfseXmlSign` | — |

`verify_jwt`: `ofertas-publicas=false`, `enviar-push=false` (protegidas internamente por service_role/internal token); `gestao-acesso-prestador`, `nfse-upload-certificado`, `nfse-assinar-transmitir` = true.

### 6.6 Storage buckets (13 mapeados)

| Bucket | Público? | Uso |
|--------|:--------:|-----|
| `prestadores` | público | fotos de prestador |
| `veiculos` | público | fotos de veículo |
| `documentos` | público | documentos genéricos |
| `contratos` | público | PDFs de contrato |
| `biblioteca-global` | público | biblioteca/academia |
| `comprovantes-entrega` | público | POD |
| `relatorios` | público | relatórios exportados |
| `documentos_prestadores` | **privado** | documentos (privatizado em ADM-APP-02D.2) |
| `certificados-fiscais` | **privado** | certificado A1 |
| `fiscal-documentos` | **privado** | XML/DANFSe |
| `documentos_operacionais` | **privado** | central de documentos |
| `propostas` | **privado** | anexos de proposta/orçamento |
| `driver-evidence` | **privado** | evidências do app |

### 6.7 RLS — padrão

- **Padrão dominante (soft multi-tenant)**: `tenant_id = current_tenant_id_safe()`; `current_tenant_id_safe()` resolve `app.tenant_id` → `auth.uid()` → `tenant_usuarios.user_id` → **tenant sentinela** `00000000-0000-0000-0000-000000000001`. Várias policies core adicionam guard `EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())` para impedir que o Portal Cliente caia no sentinela.
- **Portal Cliente (Onda 1, nov/2026)**: `f_portal_is_staff()` e `f_portal_cliente_id()`; staff vê tudo, cliente vê `cliente_id = f_portal_cliente_id()`; views `portal_cliente_*_view` com `security_invoker`.
- **App Motorista**: RPCs `SECURITY DEFINER` validando `auth.uid()`; grants restritos após M133-D.4; views `vw_app_*`/`vw_motorista_*`.
- **Risco**: 266 policies com `USING(true)` e 403 para `anon`; hardening `20260725_missao_rls_fix_*` **não aplicado** em produção (confirmado no repositório).

### 6.8 Realtime (publicação `supabase_realtime`)

Tabelas publicadas identificadas: `alocacoes_escala`, `historico_alocacoes_escala`, `automacoes_fila`, `automacoes_regras`, `ia_logs`, `contratos_gerados`, `contratos_historico`, `cotacoes_publicas`, `escala_operacional` (legado), `escalonamentos_humanos`, `eventos_oficiais`, `motorista_app_sessoes`, `motorista_checkins`, `ocorrencias`, `operacao_mensagens`, `portal_comprovantes`, `portal_notificacoes`, `portal_ocorrencias`, `portal_pedidos`, `portal_tracking_realtime`, `recrutamento_candidatos`, `recrutamento_operacoes`, `recrutamento_prestadores`, `rede_oportunidades`, `rede_visualizacoes`, `reembolsos_prestador`, `usuarios_cliente`.

> **`ordens_servico` NÃO está na publicação** → o alerta de nova OS usa **polling de 25s** (`useNovaOSAlerta`). Para Realtime puro seria necessário `ALTER PUBLICATION` (migration).

### 6.9 Estruturas posteriores ao baseline (2026-11-09 → 2026-11-26)

`motorista_push_tokens`, `push_notificacoes_fila` (push), `security_violation_log`, `auditoria_operacional`, `comercial_hunter_*`, `ia_config_tenant`, `recrutamento_oferta_*`, `match_operacoes_prestadores`, RPCs/RLS de NFS-e (20261117), RLS do Portal Cliente (20261125), consolidação multiparadas/lotes de pedido (20261126).

### 6.10 Autenticação

Supabase Auth (e-mail/senha), `tenant_usuarios.papel` para RBAC, `auth_eventos_auditoria` para login/logout/reset, `usuarios_cliente` para Portal Cliente, `prestadores.auth_user_id` para App, `agentes_ia_internos` (sem login, apenas assinatura).

---

## 7. Integrações existentes

| # | Integração | Onde | Estado |
|:-:|-----------|------|:------:|
| 1 | **Supabase** (Auth/DB/Storage/Realtime/Edge) | todo o app | Real |
| 2 | **Mapbox** (Geocoding/Directions/GL) | `services/maps/*`, `roteirizacao*`, form OS, Portal, cotação | Real se `VITE_MAPBOX_ACCESS_TOKEN` |
| 3 | **ViaCEP** | `cepService`, `useViaCEP`, `cepCotacao`, `CampoEnderecoChat` | Real (público) |
| 4 | **BrasilAPI** (CNPJ) | `NfseTab`, cadastro/cotação | Real (público) |
| 5 | **Focus NFe** (CT-e/MDF-e/NFS-e) | Edges `focus-emissao/consulta/documentos` | Simulado por padrão (`FOCUS_REAL_ENABLED`) |
| 6 | **Sefin/ADN NFS-e Nacional** (mTLS A1) | Edge `nfse-assinar-transmitir`, `api/nfse-sefin-proxy.ts` | Real (certificado); ADN pode 404 em homologação |
| 7 | **Evolution API** (WhatsApp) | `evolutionApiService`, `comunicacaoGatewayService` | Não configurado (sem `VITE_EVOLUTION_*`) |
| 8 | **Zoho Mail** | `zohoEmailService` (3 gerações) | Mock em uma versão; parcial/hook em outra |
| 9 | **n8n** | `n8nClient`, `n8nService`, automações | Não configurado (sem `VITE_N8N_*`) |
| 10 | **LLMs** (Groq/Gemini/OpenRouter/OpenAI/Anthropic) | Edge `proxy-ia` | Real se secrets; fallback mock |
| 11 | **FCM** (push) | Edge `enviar-push` + `motorista_push_tokens` | Implementado; não comprovado ponta a ponta |
| 12 | **TinyURL** | `OsMobile` (encurtar links Maps) | Real (público) |
| 13 | **Google Maps** | links de navegação em mensagens/WhatsApp | Apenas URL (sem API) |
| 14 | **Frenet** | Edge `cotacao-frete` | Real (CORS aberto) |
| 15 | **Efi** (mTLS) | Edge `efi-mtls-probe` | Diagnóstico/temporário |

**Resumo:** 9 integrações reais ou potencialmente operacionais (com configuração), 6 condicionais/simuladas/não configuradas.

---

## 8. Dependências do aplicativo (prestador) — estruturas compartilhadas

O app Flutter do prestador é um projeto externo, mas compartilha o mesmo Supabase. Estruturas claramente de contrato TMS ↔ App:

### 8.1 Tabelas compartilhadas

- **Núcleo operacional**: `alocacoes_escala`, `historico_alocacoes_escala`, `ordens_servico`, `prestadores`/`prestadores_app`, `veiculos`, `clientes`.
- **POD/evidências**: `entregas_protocolo`, `delivery_proofs` (bruto do app → sincronizado por `f_sync_delivery_proof_to_entregas`), `os_pod`.
- **Tracking/sessão**: `operacao_localizacao`, `portal_tracking_realtime`, `motorista_app_sessoes`, `motorista_checkins`.
- **Notificações/push**: `portal_notificacoes`, `motorista_push_tokens`, `push_notificacoes_fila`, `eventos_oficiais`.
- **Rede/oportunidades**: `rede_oportunidades`, `prestador_disponibilidade`, `prestador_oportunidade_historico`, `prestador_os`.
- **Onboarding/talent**: `prestador_perfil_talento`, `prestador_treinamentos`, `rascunhos_prestador`, `permissoes_prestador`, `driver_*`, `route_stops`, `pending_uploads`, `provider_documents`.

### 8.2 Views compartilhadas

`vw_app_motorista_operacoes`, `vw_app_motorista_paradas`, `vw_app_notificacoes_pendentes`, `vw_motorista_viagens`, `vw_motorista_dashboard`, `vw_motorista_documentos`, `vw_motorista_financeiro`, `vw_motorista_checklist`, `vw_route_stops_driver`.

### 8.3 RPCs compartilhadas

`f_buscar_operacoes_motorista`, `f_avancar_etapa_app_motorista`, `f_atualizar_reversa_app`, `f_atualizar_status_parada`, `f_buscar_oportunidades_para_prestador`, `f_aceitar_oportunidade_rede`, `aceitar_viagem`, `recusar_viagem`, `atualizar_status_viagem`, `registrar_checkin_motorista`, `registrar_localizacao_motorista`, `registrar_posicao_motorista`, `reportar_ocorrencia_motorista`, `f_marcar_mensagens_lidas_app`, `f_registrar_push_token`, `f_remover_push_token`, `app_s6_*` (onboarding).

### 8.4 Buckets compartilhados

`driver-evidence` (privado), `documentos_prestadores` (privado), `comprovantes-entrega`.

### 8.5 Dependências críticas do TMS em relação ao app

- **Rastreamento** só tem dados se o app chamar `registrar_posicao_motorista`.
- **POD em tempo real** depende de `delivery_proofs`/RPC do app.
- **Push** depende de FCM no app (hoje ausente) + deploy da Edge + credenciais + agendamento.
- **Aceite/execução/reversa** dependem das RPCs do app.

---

## 9. Problemas encontrados

### 9.1 Segurança

1. **Segredos `VITE_*` no bundle** — variáveis sensíveis (ex.: segredo/refresh token Zoho, token interno de Edge) são expostas ao navegador por definição do prefixo `VITE_`. Ainda que parte dos serviços seja mock, a exposição é um risco real.
2. **RLS permissiva** — ~266 policies `USING(true)` / 403 para `anon`; hardening de RLS criado mas não aplicado em produção.
3. **`supabase.ts` fixa URL + anon key** — anon key é pública, mas o hardcode impede rotação e mistura configuração com código.
4. **`verify_jwt=false`** em duas Edge Functions (`ofertas-publicas`, `enviar-push`) — proteção delegada à função (CORS/captcha/token interno); exige monitoramento.
5. **Tenant sentinela** em `current_tenant_id_safe()` — fallback que pode permitir leitura indevida se o Auth/tenant não forem resolvidos; guards mitigam parcialmente.
6. **`auditoria_operacional` ausente** em produção — consulta silenciosamente falha em `Tracking.tsx`.

### 9.2 Consistência de dados / dívida técnica

1. Duas bases de ocorrências (`ocorrencias` × `portal_ocorrencias`).
2. `escala_operacional` (legado) coexistindo com `alocacoes_escala`.
3. `os_pod`/`portal_comprovantes` coexistindo com `entregas_protocolo`.
4. `pagamento_prestadores` (legado) × `pagamentos_prestadores`.
5. `os_historico` e `operation_timeline_events` write-only no TMS.
6. Mocks mascarando ausência de dados (CRM, Propostas, Combustíveis, Seguros, SLA, Governança, IA de recrutamento/documentos, gerador de escala).
7. Legado fiscal `nfse.ts`/`sefaz.ts` órfão com URLs fictícias.
8. Migrations/histórico da CLI com drift (296 migrations locais não registradas; `db push` é arriscado — aplicar arquivo a arquivo via `pg`). *Observado em documentação do repositório.*

### 9.3 Funcional / operacional

1. **Rastreabilidade de volumes** incompleta: sem volume individual, sem barcode/QR operacional, sem scanner, sem cadeia de custódia, sem lotes/validade, sem entregas parciais.
2. **MDF-e** não transmite de verdade (simulado); portais de conferência de carregamento são visuais.
3. **CT-e/MDF-e** simulados por padrão; **NFS-e** depende de certificado e do ADN (404 em homologação).
4. **Push FCM** sem elo final (app sem Firebase, Edge não comprovada, sem cron).
5. **Offline/PWA** sem service worker ativo.
6. **Categorias de veículo** hardcoded em múltiplos arquivos (risco de divergência, ex.: `3/4` como `tres_quartos` × `3_4`; moto com capacidades ligeiramente diferentes).
7. **SLA, Governança e Seguros** sem dados reais.
8. **Programação “IA”** grava em `localStorage` (não persiste).
9. **Usuários/Perfis** na tela de Configurações não é a fonte de Auth.
10. **ETA dinâmico** e **histórico de localização explorável** ausentes.

---

## 10. Recomendações técnicas

### P0 — Segurança e integridade (antes de evoluir)

1. **Rotacionar e remover segredos `VITE_*` sensíveis** do bundle; mover Zoho/n8n/Evolution/token interno para Edge Functions/secrets. Manter apenas `VITE_SUPABASE_URL`/anon key (idealmente por env em vez de hardcode).
2. **Aplicar o hardening de RLS** (`20260725_missao_rls_fix_*`) após validação em QA; revisar as ~266 policies `USING(true)` e as 403 de `anon`.
3. **Consolidar fontes duplicadas**: ocorrências, POD, escala legada, pagamento prestador. Definir fonte oficial e migrar leitores.
4. **Resolver `auditoria_operacional`** (aplicar migration ou remover a consulta) e transformar `os_historico`/`operation_timeline_events` em leitura real.

### P1 — Fechar pontas de produto já iniciadas

5. **Rastreabilidade de volumes**: criar modelo de **volume individual** (`volumes` por OS/parada com código), geração de etiqueta/QR, leitura por scanner/coletor, conferência de carga persistida, **entrega parcial**, **cadeia de custódia** e **lote/validade**.
6. **Manifesto digital real**: MDF-e transmitido (Focus real) + manifesto de carga vinculado ao carregamento físico.
7. **Substituir mocks por dados reais + empty states**: CRM, Propostas, Seguros, Combustíveis (API ANP real), SLA, Governança, IA documental/recrutamento, gerador de Programação.
8. **Ativar/validar integrações**: `FOCUS_REAL_ENABLED`, `proxy-ia` secrets, Evolution/Zoho/n8n e `enviar-push` (com FCM no app + cron).
9. **Categorias de veículo configuráveis**: tabela mestre (`categorias_veiculo`) com capacidades/dimensões/térmico, FK em `veiculos`, eliminando duplicação hardcoded.

### P2 — Evolução operacional (Conexão Express 2027)

10. **Centros de distribuição** como entidade (unidade/base) e operações CD→CD; regras específicas de e-commerce (OTIF, tentativas/reentrega).
11. **ETA dinâmico** e **histórico/trilha de localização** a partir de `portal_tracking_realtime`/`operacao_localizacao`.
12. **Transporte dedicado/operações fixas**: motor dedicado por contrato (veículo/motorista fixo) e execução recorrente automática.
13. **SLA real**: conectar `/sla` a `alocacoes_escala`/`ordens_servico`/POD; substituir KPIs fixos.
14. **Agendamento/cache de relatórios** e compartilhamento por e-mail; conectar as views `vw_relatorio_*` ao serviço.
15. **Offline/PWA real** (se necessário): service worker versionado + outbox IndexedDB.

### P3 — Higiene e governança

16. **Limpar dívida de repositório**: milhares de scripts/screenshots/relatórios na raiz; organizar em `scripts/`, `docs/`, `artefatos/`.
17. **Remover/arquivar código órfão** (`nfse.ts`, `sefaz.ts`, `mockPrestadores.ts`, `mockOrcamentos.ts`, `criar-alocacao-escala` sem caller, `efi-mtls-probe`).
18. **Reconciliar histórico de migrations** da Supabase CLI antes de qualquer `db push`.
19. **Assinatura eletrônica** de contratos (D4Sign/Clicksign) — avaliação de produto.
20. **Testes**: ampliar E2E dos fluxos reais (volume, conferência, MDF-e, push) e testes de contrato TMS↔App.

---

## Anexo A — Volumes e Rastreabilidade (detalhado)

> Legenda: ✅ completo · 🟡 parcial · ❌ inexistente. Evidências em `arquivo:linha` quando aplicável.

| Item | Situação | Evidência | Tabelas | O que falta |
|------|:--------:|-----------|---------|-------------|
| Cadastro individual de volumes | ❌ | `osTypes.ts:226` (`volumes?`), `cargaService.ts:104-120` | `ordens_servico.volumes/carga`, `cotacoes_publicas.carga_volumes` | Tabela `os_volumes`/`volume_itens` com ID/código/dimensões/peso por volume; UI item a item |
| Identificação por barcode/QR operacional | ❌ | QR só fiscal (`DanfsePrintTemplate`), código de barras só boleto | — | Código de rastreio por volume, geração de etiqueta/selo |
| Leitura e conferência (scan/coletor) | ❌ | grep `scan/bipar/coletor` sem fluxo | — | Leitura por scanner/coletor/câmera, conferência por volume |
| Manifesto digital (MDF-e) | 🟡 | `mdfeService` (rascunho), `focus-emissao` simulado; romaneio Calvo para faturamento | `fiscal_mdfes`, `fiscal_ctes`, `ordens_servico.romaneio` | Transmissão real do MDF-e e manifesto de carga ligado ao carregamento físico |
| Conferência de carregamento | ❌→🟡 visual | Pátio manual (`patio_checkins/eventos`); painéis visuais (`PortalCliente` `carregamentos=[]`; `EscalaLista` lê `checklist` inexistente) | `patio_*` | Persistir checklist por OS/alocação e alimentar os painéis |
| Conferência de recebimento | ✅ | `entregas_protocolo` + `comprovantesService` | `entregas_protocolo` | (aprimorar por item) |
| Quantidade prevista × recebida | 🟡 | `rota_paradas.volumes`/`volumes_entregues`, `PortalRoteirizacao` (“X de Y”) | `rota_paradas` | Por item de volume + `qtd_prevista/qtd_recebida` genéricos |
| Volumes por parada | ✅ | `rota_paradas.volumes`, `20261126000001_portal_multiparadas_e_lotes.sql` | `rota_paradas`, `portal_pedidos.metadata.paradas` | — |
| Entregas parciais | ❌ | grep `entrega_parcial` = 0 | — | Entidade/status de entrega parcial por parada/volume |
| Devoluções / logística reversa | ✅ | `alocacoes_escala.reversa_*`, `ColetaReversaFields`, `f_atualizar_reversa_app` | `alocacoes_escala` | Tela/aba de Devoluções dedicada (reversa já funciona na escala) |
| Protocolo de divergência | 🟡 | `reversa_divergencia`, `ocorrencias` (tipo `falta_volume`) | `alocacoes_escala`, `ocorrencias` | Protocolo dedicado por volume com trilha |
| Histórico de movimentações | 🟡 | `historico_alocacoes_escala`, `eventos_oficiais`, `os_historico` (write-only) | `historico_alocacoes_escala`, `eventos_oficiais` | Histórico por volume e exposição na UI |
| Cadeia de custódia | ❌ | grep `custodia` = 0 | — | Modelo de custódia por volume (quem/quando/onde) |
| Controle de lotes e validade | ❌ | “lote” só financeiro/importação | — | Lote/serial/validade/ANVISA por mercadoria |

**Resumo:** volumes por parada e POD de recebimento são os pontos fortes; cadastro individual, barcode/QR operacional, scanner, entregas parciais, cadeia de custódia e lotes/validade são **ausentes**.

---

## Anexo B — Modalidades operacionais

| Modalidade | Situação | Evidência | O que falta |
|-----------|:--------:|-----------|-------------|
| Entrega imediata | 🟡 | `slaPermitido` (imediato só moto), Pedido Rápido | Flag explícita “imediata” + SLA curto dedicado |
| Serviços agendados | ✅ | `status "agendada"`, `data_programada`, `cotacoes_publicas.data_desejada/hora_desejada` | Slots de agendamento mais ricos |
| Rotas de e-commerce | 🟡 | tipo op. “E-commerce Multiparadas”, multi-paradas do portal | Regras OTIF, tentativas/reentrega automática |
| Múltiplas paradas | ✅ | `rotas`/`rota_paradas`, view do app, Roteirizador, `f_atualizar_status_parada` | — |
| Transporte dedicado | 🟡 | tipo op. “Dedicado”, `prestadores.aceita_dedicada` | Motor/veículo dedicado por contrato |
| Operações fixas empresariais | 🟡 | `contratos_operacao*`, `contratoOperacaoService`, perfil “rota_fixa” | Execução recorrente automática |
| Centros de distribuição | 🟡/❌ | apenas como endereço/texto (“CD Guarulhos”, “CD para CD”) | Entidade “Centro de Distribuição” (unidade/base) e operação CD→CD |
| Coletas e distribuições | 🟡/✅ | tipos de operação (Coleta/Entrega/Distribuição) | Engine específica de distribuição urbana |
| Logística reversa | ✅ | `reversa_*`, `ColetaReversa*`, RPC | — (maduro) |
| Transporte refrigerado | 🟡 | `carga_refrigerada`, `temperatura_min/max`, `VEICULOS_REFRIGERADOS`, matching | Monitoramento de temperatura em tempo real (hoje só faixa/conferência manual) |

**Categorias de veículo:** **não configuráveis** (D). Catálogo e capacidades em `constants/tiposVeiculo.ts`, `lib/veiculoPeso.ts`, `lib/ofertaPublica.ts`, `lib/veiculoCotacao.ts`, `helpers/validarAlocacaoEscala.ts`, `services/operacao/cargaService.ts`. `veiculos.tipo_veiculo` é texto livre; não existe `categorias_veiculo`. Único parâmetro configurável em banco: fator de cubagem (`configuracoes_sistema['fator_cubagem_regras']`).

---

## Anexo C — Inventário de mocks / placeholders / órfãos

| Item | Caminho | Efeito |
|------|---------|--------|
| Gerador “IA” de programação | `components/operacao/EscalaLista.tsx:1218-1249` | Alocações aleatórias em `localStorage` |
| Propostas | `components/comercial/propostas/ListaPropostas.tsx:21,137` + `mockPropostas.ts` | Lista inicia mockada; `Math.random` |
| CRM fallback | `components/comercial/crm/CrmBase.tsx:191-198`, `crmTypes.ts:381` | `LEADS_MOCK` |
| Simulador de frete | `components/comercial/SimuladorFrete.tsx:38` | Tabela fixa |
| IA de recrutamento | `modules/recrutamento/services/iaService.ts:7-40` | Scores aleatórios |
| Combustíveis | `services/combustiveis.ts`, `combustivelService.ts`, `radarCombustivel.ts` | Preços simulados / `Math.random` |
| Seguros | `components/seguros/*` | Arrays mock/estáticos |
| Governança | `pages/Governanca.tsx` | Tabelas/logs fictícios |
| SLA | `pages/SLA.tsx` | KPIs/gráficos fixos |
| IA documental | `supabase/functions/documentos-ia/index.ts` | Simulação determinística |
| Focus CT-e/MDF-e | `supabase/functions/focus-emissao/index.ts` | Simulado salvo `FOCUS_REAL_ENABLED` |
| Conectores IA | `services/ia/externalIntegrationEngine.ts` | 100% mock |
| Zoho (uma versão) | `services/integracoes/zohoEmailService.ts` | `[ZOHO MOCK]` |
| Fiscal legado | `services/nfse.ts`, `services/sefaz.ts` | URLs fictícias, sem consumidores (D) |
| `mockPrestadores.ts` / `mockOrcamentos.ts` | `components/prestadores/`, `components/comercial/` | Não usados em telas |
| Conferência de carregamento | `PortalCliente.tsx:772`, `EscalaLista.tsx:3685-3706` | Painéis visuais (C) |
| PWA/offline | `index.html:38-75` | Service worker desregistrado |

---

## Anexo D — Matriz detalhada por funcionalidade (117 itens)

> Colunas: **#** · **Situação** · **Funcionalidade** · **Onde (arquivos)** · **Componentes / Tabelas** · **Dependências** · **O que falta**.

### D.1 Dashboard (3)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 1 | A | Dashboard multi-abas (8 abas) | `pages/Dashboard.tsx`, `components/dashboard/*` | `ordens_servico`, `financeiro_*`, `alocacoes_escala`, `rede_*` | Auth/Tenant, Realtime | — |
| 2 | A | Alertas Cotação Express + Nova OS | `AlertaOscotacaoExpress.tsx`, `useNovaOSAlerta.ts` | `ordens_servico`, `orcamentos` | Realtime/polling 25s | `ordens_servico` fora do Realtime → polling |
| 3 | A | KPIs financeiros/operacionais | `TabExecutivo.tsx`, `TabFinanceiro.tsx` | `financeiro_receber/pagar`, `composicao_financeira_os` | Supabase | — |

### D.2 Clientes (3)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 4 | A | CRUD cliente + endereços + contratos | `components/clientes/*`, `dbMappers.ts` | `clientes`, `enderecos_clientes`, `clientes_contratos` | RLS, tenant | — |
| 5 | A | ViaCEP / autocomplete / favoritos | `cepService.ts`, `EnderecoCompleto.tsx`, `historicoEnderecosCliente.ts` | `enderecos_clientes` | ViaCEP | — |
| 6 | A | Tabela de valores por cliente | `components/clientes/*`, `TabelasValoresLista.tsx` | `tabelas_valores` | precificação | — |

### D.3 Prestadores (5)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 7 | A | CRUD prestador + veículos | `components/prestadores/*` | `prestadores`, `veiculos` | RLS | — |
| 8 | B | Documentos do prestador + IA | `documentosMetadataService.ts`, `documentos-ia` | `documentos_prestadores`, `documentos_metadata` | Edge simulada/`proxy-ia` | IA real de conferência |
| 9 | A | Gestão de acesso ao App | `gestaoAcessoPrestadorService.ts`, Edge `gestao-acesso-prestador` | `prestadores`, auth | Edge JWT | — |
| 10 | A | Recrutamento pipeline/kanban | `modules/recrutamento/*` | `recrutamento_*`, `operacoes` | RPCs de ofertas | — |
| 11 | C | IA de recrutamento (scores) | `modules/recrutamento/services/iaService.ts` | — | — | Substituir `Math.random` por regra/LLM |

### D.4 Veículos & Categorias (3)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 12 | A | CRUD de veículos / frota | `components/veiculos/*`, `frotaService.ts` | `veiculos`, `despesas_operacionais` | RLS | — |
| 13 | D | Catálogo de categorias configurável | `constants/tiposVeiculo.ts`, `lib/veiculoPeso.ts`, `lib/ofertaPublica.ts` | `veiculos.tipo_veiculo` (texto) | — | Tabela `categorias_veiculo` mestre + FK |
| 14 | B | Capacidades e fator de cubagem | `cargaService.ts`, `FatorCubagemConfig.tsx` | `configuracoes_sistema` | — | Parametrizar catálogo, não só cubagem |

### D.5 Ordens de Serviço (6)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 15 | A | Wizard de OS (desktop + mobile) | `OrdemServicoForm.tsx`, `OsMobile.tsx` | `ordens_servico` | RLS, triggers | — |
| 16 | A | Numeração sequencial | `ordemServicoService.ts`, RPC `f_proximo_numero_os_sequencial` | `os_numero_seq` | RPC | — |
| 17 | A | Multi-paradas / itinerário | `OrdemServicoForm.tsx`, `resumoRotaOS.ts` | `ordens_servico.enderecos`, `rota_paradas` | Mapbox/ViaCEP | — |
| 18 | A | Cálculo de rota/pedágio | `distanceService.ts`, `pedagioEstimativa.ts` | — | Mapbox | — |
| 19 | B | Histórico/timeline da OS | `HistoricoOS.tsx`, `os_historico` | `os_historico`, `eventos_oficiais` | triggers | `os_historico` write-only → expor |
| 20 | A | Exclusão/cancelamento com limpeza | `OrdensServicoLista.tsx`, `ordemServicoService.ts` | `ordens_servico`, `alocacoes_escala`, financeiro | triggers M66/M80 | — |

### D.6 Programação / Escala (4)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 21 | A | CRUD de alocações/escala | `EscalaLista.tsx`, `escalaService.ts` | `alocacoes_escala`, `historico_alocacoes_escala` | triggers | — |
| 22 | C | Gerador “IA” de programação | `EscalaLista.tsx:1218-1249` | `localStorage` | — | Algoritmo real ou remover botão |
| 23 | C | Conferência de carregamento (escala) | `EscalaLista.tsx:3685-3706` | coluna `checklist` inexistente | — | Tabela/coluna de checklist real |
| 24 | A | Coleta reversa na escala | `ColetaReversaFields.tsx`, `reversa_*` | `alocacoes_escala` | RPC app | — |

### D.7 Rotas / Paradas (3)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 25 | A | Geocoding/Directions Mapbox | `services/maps/*` | — | Token Mapbox | — |
| 26 | A | Roteirizador web | `RoteirizadorWeb.tsx`, `roteirizacaoService.ts` | `rotas`, `rota_paradas` | Mapbox | — |
| 27 | B | Despacho/otimização | `roteirizacaoDespachoService.ts` | `rotas`, `alocacoes_escala` | — | Otimização avançada |

### D.8 Devoluções / Reentregas / Ocorrências / Pátio (5)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 28 | B | Ocorrências | `OcorrenciasLista.tsx`, `ocorrenciaService.ts`, `TorreControle.tsx` | `ocorrencias`, `portal_ocorrencias` | RLS | Unificar base de ocorrências |
| 29 | E | Devoluções (aba) | `Operacao.tsx` (`PlaceholderPage`) | — | — | Implementar tela/fluxo |
| 30 | E | Reentregas (aba) | `Operacao.tsx` (`PlaceholderPage`) | — | — | Implementar fluxo de reentrega |
| 31 | A | Controle de pátio (check-in/doca) | `ControlePatio.tsx`, `patioService.ts` | `patio_checkins`, `patio_eventos`, `patio_docas` | RLS | — |
| 32 | A | Logística reversa | `ColetaReversa*`, RPC `f_atualizar_reversa_app` | `alocacoes_escala.reversa_*` | App | — |

### D.9 Comprovantes / POD (3)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 33 | A | Comprovantes/POD | `comprovantesService.ts`, `Comprovantes.tsx` | `entregas_protocolo` | Storage, app | — |
| 34 | A | Dossiê/evidências/timeline | `DossieEntregaSheet.tsx`, `PortalDrawerPOD.tsx` | `entregas_protocolo`, `alocacoes_escala` | Storage | — |
| 35 | A | Comparação entre entregas | `PortalComparacaoEntregas.tsx` | `entregas_protocolo` | — | — |

### D.10 Financeiro (6)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 36 | A | Contas a receber/pagar/baixas | `receberService.ts`, `pagarService.ts`, `ContasReceberEnterprise.tsx` | `financeiro_receber/pagar/baixas` | RPCs/triggers | — |
| 37 | A | Faturas + PDF | `faturaService.ts`, `FaturaPanel.tsx` | `faturas`, `fatura_itens` | RPCs, Storage | — |
| 38 | A | Repasses/fechamento/extrato prestador | `pagamentoPrestadorService.ts`, `fechamentoService.ts`, `extratoPrestadorService.ts` | `pagamentos_prestadores`, `fechamentos_prestador`, `movimentos_conta_corrente_prestador` | RPCs | — |
| 39 | B | DRE/fluxo/inadimplência | `DREGerencial.tsx`, `FluxoCaixaEnterprise.tsx`, `Inadimplencia.tsx` | `financeiro_*`, `financeiro_baixas` | — | Alguns painéis parciais |
| 40 | C | Conciliação bancária | `ConciliacaoAvancada.tsx` | `financeiro_baixas`, `contas_financeiras` | — | Integração/real conciliação |
| 41 | B | Pagamento em lote (CNAB) | `PagamentoCNAB.tsx`, `f_gerar_lote_pagamentos` | `lotes_pagamento`, `lotes_pagamento_itens` | RPC | Geração/retorno CNAB real |

### D.11 Documentos (4)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 42 | A | Central de documentos + versionamento | `CentralDocumentos.tsx`, `documentosMetadataService.ts` | `documentos_metadata` | Storage | — |
| 43 | A | Upload universal (drag/drop/câmera) | `DocumentoUploadUniversal.tsx` | bucket `documentos_operacionais` | Storage | — |
| 44 | B | IA documental | `documentos-ia`, `documentAnalysis.ts` | `documentos_metadata` | `proxy-ia` | IA real de conferência |
| 45 | A | Compartilhar/histórico | `DocumentoCompartilharModal.tsx`, `DocumentoHistoricoModal.tsx` | `documentos_metadata` | — | — |

### D.12 Contratos (3)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 46 | A | Modelos/gerados/PDF/hash | `Contratos.tsx`, `contratosService.ts`, `contratosPdfService.ts` | `contratos_modelos`, `contratos_gerados`, `contratos_historico` | Storage | — |
| 47 | B | Contratos de operação recorrente | `contratoOperacaoService.ts` | `contratos_operacao*` | — | Execução recorrente automática |
| 48 | E | Assinatura eletrônica externa | — | — | — | Integrar D4Sign/Clicksign |

### D.13 Notificações / Comunicação (6)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 49 | A | Persistência de mensagens/templates | `comunicacao/*`, `CommunicationHub` | `communication_*`, `comunicacoes_*`, `crm_conversas` | RLS | — |
| 50 | D | Envio WhatsApp (Evolution) | `evolutionApiService.ts`, `comunicacaoGatewayService.ts` | `whatsapp_*` | `VITE_EVOLUTION_*` | Configurar credenciais |
| 51 | D | Envio e-mail Zoho | `zohoEmailService.ts` (3 versões) | `crm_followups` | OAuth/API | Unificar e ativar real |
| 52 | D | n8n | `n8nClient.ts`, `n8nService.ts` | `integracoes_logs` | `VITE_N8N_*` | Configurar webhooks |
| 53 | D | Push FCM | Edge `enviar-push` | `motorista_push_tokens`, `push_notificacoes_fila` | Secrets + app FCM + cron | Fechar ponta a ponta |
| 54 | B | Notificações do Portal | `portal_notificacoes` | `portal_notificacoes` | RLS/Realtime | Verificação |

### D.14 Relatórios (4)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 55 | A | Relatórios operacionais/financeiros | `relatorioService.ts`, `RelatoriosEnterprise.tsx` | `ordens_servico`, `financeiro_*`, `prestadores` | — | — |
| 56 | A | Export PDF/Excel | `pdfRelatorioOperacional.ts`, `excelExport.ts` | bucket `relatorios` | jsPDF/xlsx | — |
| 57 | D | Views `vw_relatorio_*` conectadas | migrations; serviço não usa | `vw_relatorio_*` | — | Conectar ou remover |
| 58 | E | Agendamento/cache de relatórios | — | — | — | Implementar |

### D.15 Rastreamento (5)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 59 | B | GPS tempo real | `trackingService.ts`, `PainelOperacionalMapa.tsx`, `RastreamentoOSDialog.tsx` | `portal_tracking_realtime` | App/RPC + Mapbox | Ingestão do app comprovada |
| 60 | B | Histórico de localização | `operacao_localizacao` | `operacao_localizacao`, `vw_noc_operacional` | triggers | Tela/trilha histórica |
| 61 | E | ETA dinâmico | — | — | GPS + Directions | Calcular ETA em tempo real |
| 62 | A | Tracking público por link | `Tracking.tsx`, `RastreamentoPublico.tsx`, `communicationHubService` | `tracking_public_links` | token | — |
| 63 | B | Tracking no Portal Cliente | `PortalCliente.tsx`, `PortalTrackingMap.tsx` | `portal_tracking_realtime` | App | Depende do app |

### D.16 Usuários / Configurações (5)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 64 | A | Config empresa/identidade/integrações | `Configuracoes.tsx`, `configuracoesService.ts` | `configuracoes_sistema`, `central_integracoes` | RLS | — |
| 65 | C | Gestão de usuários/perfis na UI | `Configuracoes.tsx:136-235` | `configuracoes_sistema.usuarios` (espelho) | — | Usar `auth.users`/`tenant_usuarios` |
| 66 | A | Admin tenants/convites | `AdminTenantsPage.tsx`, `adminTenantsService.ts` | `tenants`, `tenant_usuarios`, `convites` | RPCs | — |
| 67 | C | Governança/LGPD/auditoria UI | `Governanca.tsx` | — | — | Conectar a dados reais |
| 68 | B | RBAC/permissões/RLS | `permissoes.ts`, `routePermissions.ts`, `sidebarData.ts` | `tenant_usuarios`, policies | Auth | Revisar ~266 `USING(true)` |

### D.17 Comercial (8)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 69 | A | Orçamentos + conversão em OS | `OrcamentosLista.tsx`, `OrcamentoForm.tsx`, `orcamentoToOSService.ts` | `orcamentos`, `ordens_servico` | RPCs | — |
| 70 | A | Cotação Express (2 fases) | `CotacaoExpress.tsx`, `cotacaoPublicaService.ts` | `cotacoes_publicas` | Edge `pedido-rapido` | — |
| 71 | A | Pedido Rápido | `PedidoRapido.tsx`, Edge `pedido-rapido` | `portal_pedidos`, `orcamentos` | Edge | — |
| 72 | B | CRM | `comercial/crm/*` | `crm_leads`, `crm_followups`, `crm_historico` | — | Remover fallback mock |
| 73 | B | Propostas | `propostas/*`, `propostaService.ts` | `propostas` (Storage) | — | Remover mock, numerar sequencial |
| 74 | C | Simulador de frete | `SimuladorFrete.tsx` | tabela fixa | — | Usar tabela real |
| 75 | A | Tabela de valores | `TabelasValoresLista/Form` | `tabelas_valores` | — | — |
| 76 | B | Automação comercial/follow-up | `automacaoComercial.ts`, `followUpService.ts` | `crm_*` | n8n | Execução real |

### D.18 Fiscal (7)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 77 | B | NFS-e Nacional | `nfse-emissao`, Edge `nfse-assinar-transmitir`, `_shared/nfse*` | `fiscal_nfse`, `certificados_fiscais` | Certificado, Sefin/ADN | ADN 404 homolog; consulta/cancelamento |
| 78 | B | CT-e | `cteService.ts`, Edge `focus-*` | `fiscal_ctes` | Focus real | Ativar `FOCUS_REAL_ENABLED` |
| 79 | D | MDF-e transmissão | `mdfeService.ts`, `focus-emissao` | `fiscal_mdfes` | Focus real | Branch real de transmissão |
| 80 | B | DANFSe oficial (PDF) | `DanfsePrintTemplate.tsx`, `nfseAdn` | `fiscal-documentos` | ADN mTLS | 404 do ADN em homologação |
| 81 | A | Emitente/regras fiscais | `EmitenteFiscalConfig.tsx`, `configuracoesFiscaisService.ts` | `configuracoes_fiscais`, `regras_fiscais_*` | — | — |
| 82 | A | Auditoria fiscal | `AuditoriaFiscal.tsx` | `fiscal_events`, `fiscal_logs`, `fiscal_historico_status` | — | — |
| 83 | D | Legado `nfse.ts`/`sefaz.ts` | `services/nfse.ts`, `services/sefaz.ts` | — | — | Remover/arquivar |

### D.19 Frota / Combustíveis / Seguros (4)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 84 | A | Frota (manutenção/abastecimento/custos) | `Frota.tsx`, `frotaService.ts` | `veiculos`, `despesas_operacionais` | — | — |
| 85 | C | Combustíveis (ANP) | `Combustiveis.tsx`, `combustiveis.ts`, `radarCombustivel.ts` | `combustivel_precos` | API ANP | Integrar fonte real |
| 86 | C | Seguros | `Seguros.tsx`, `components/seguros/*` | `sinistros`, `seguros_auto_apolices` | — | Dados reais |
| 87 | B | Custo operacional | `custoOperacionalService.ts` | `veiculos`, `despesas_operacionais` | combustível | Combustível simulado |

### D.20 Central IA / Torre / SLA (6)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 88 | B | Central IA/robôs/tarefas/logs | `CentralIA.tsx`, `centralIa*`, `ia/*` | `automacoes_*`, `ia_*` | RLS, proxy-ia | Execução real de integrações |
| 89 | B | Conectores IA | `ia/conectoresService.ts`, `ia/providers/*` | `ia_conectores`, `ia_conector_robo` | Credenciais | Vagas/Social/Ads reais |
| 90 | B | Memória corporativa | `ia/memoriaService.ts` | `memoria_*` | — | Integração plena aos fluxos |
| 91 | B | LLM via `proxy-ia` | Edge `proxy-ia`, `aiProviderManager.ts` | `ia_providers_config` | Secrets LLM | Fallback mock → real |
| 92 | A | Torre de Controle | `TorreControle.tsx`, `components/torre-controle/*` | `ordens_servico`, `alocacoes_escala`, `ocorrencias`, `eventos_oficiais` | Realtime, Mapbox | KPI `ocorrenciasCriticas` fixo em 0 |
| 93 | C | SLA e Qualidade | `SLA.tsx` | — | — | Conectar a dados reais |

### D.21 Volumes e Rastreabilidade (14)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 94 | E | Cadastro individual de volumes | `osTypes.ts:226`, `cargaService.ts` | `ordens_servico.volumes` | — | Tabela `os_volumes` + UI item a item |
| 95 | E | Código de barras / QR operacional | — | — | — | Etiqueta/selo por volume |
| 96 | E | Leitura/conferência por scanner | — | — | — | Coletor/câmera/bipagem |
| 97 | B | Manifesto digital (MDF-e) | `mdfeService.ts`, `focus-emissao` | `fiscal_mdfes` | Focus real | Transmissão real |
| 98 | C | Conferência de carregamento | `PortalCliente.tsx:772`, `EscalaLista.tsx` | — | — | Checklist persistido |
| 99 | A | Conferência de recebimento (POD) | `entregas_protocolo`, `comprovantesService` | `entregas_protocolo` | App/Storage | (por item) |
| 100 | B | Qtd prevista × recebida | `rota_paradas.volumes_entregues` | `rota_paradas` | — | Por item + genéricos |
| 101 | A | Volumes por parada | `rota_paradas`, `20261126000001` | `rota_paradas`, `portal_pedidos.metadata.paradas` | — | — |
| 102 | E | Entregas parciais | — | — | — | Entidade/status de entrega parcial |
| 103 | A | Devoluções/logística reversa | `ColetaReversa*`, `reversa_*` | `alocacoes_escala` | App | — |
| 104 | B | Protocolo de divergência | `reversa_divergencia`, `ocorrencias` | `alocacoes_escala`, `ocorrencias` | — | Protocolo por volume |
| 105 | B | Histórico de movimentações | `historico_alocacoes_escala`, `eventos_oficiais` | `historico_alocacoes_escala` | — | Por volume + UI |
| 106 | E | Cadeia de custódia | — | — | — | Modelo por volume |
| 107 | E | Lotes e validade | — | — | — | Lote/serial/validade/ANVISA |

### D.22 Modalidades operacionais (10)

| # | Situação | Funcionalidade | Onde | Componentes / Tabelas | Dependências | O que falta |
|:-:|:--------:|----------------|------|----------------------|--------------|-------------|
| 108 | B | Entrega imediata | `slaPermitido`, Pedido Rápido | `ordens_servico` | — | Flag + SLA curto |
| 109 | A | Serviços agendados | `status "agendada"`, `data_programada` | `ordens_servico`, `cotacoes_publicas` | — | — |
| 110 | B | Rotas de e-commerce | tipo op. + multiparadas portal | `portal_pedidos.metadata.paradas` | — | Regras OTIF/reentrega |
| 111 | A | Múltiplas paradas | `rotas`/`rota_paradas`, RPC parada | `rota_paradas` | — | — |
| 112 | B | Transporte dedicado | tipo op. “Dedicado”, `aceita_dedicada` | `ordens_servico`, `prestadores` | — | Motor/veículo dedicado |
| 113 | B | Operações fixas empresariais | `contratos_operacao*` | `contratos_operacao*` | — | Execução recorrente |
| 114 | D | Centros de distribuição | apenas texto/endereço | — | — | Entidade CD + operação CD→CD |
| 115 | B | Coletas e distribuições | tipos de operação | `ordens_servico.tipo_operacao` | — | Engine de distribuição |
| 116 | A | Logística reversa | `reversa_*`, RPC | `alocacoes_escala` | App | — |
| 117 | B | Transporte refrigerado | `carga_refrigerada`, `temperatura_min/max` | `ordens_servico`, `veiculos` | — | Monitoramento de temperatura |

> **Verificação de contagem:** A=51 · B=35 · C=11 · D=9 · E=11 · F=0 · **Total=117**.

---

## Anexo E — Metodologia e limitações

### E.1 Método

- Leitura estática de código (`glob`/`grep`/`read`) em `src/`, `supabase/migrations/`, `supabase/functions/`, `supabase/baseline/`.
- Validação por evidência (arquivo e, quando possível, linha).
- Sem execução de app, sem chamadas ao banco de produção, sem leitura de `.env`/segredos.
- Relatórios históricos (`AGENTS.md`, `docs/`) usados apenas como contexto; conclusões validadas no código.

### E.2 Limitações

- **Não foi possível validar runtime**: não houve execução do app nem consulta ao banco de produção. Classificações “A” baseiam-se em código + schema, não em prova em tempo real.
- **O app do prestador é externo**: o comportamento de GPS/POD/aceite depende dele; o TMS está pronto para consumir, mas a prova ponta a ponta exige o app.
- **Contagens de estruturas** vêm do baseline de 2026-11-03 + migrations; podem variar ligeiramente do banco atual.
- **Migrations pós-baseline** (nov/2026) foram lidas no código; não se confirmou aplicação em produção (exceto pelos relatórios do repositório).
- **Segredos** não foram inspecionados; o risco de `VITE_*` é inferido pelo prefixo e pelo código que os consome.

### E.3 Próxima fase

Aguardar a auditoria do **aplicativo do prestador** (projeto externo) para a **comparação integrada** TMS ↔ App ↔ Portal Cliente: contrato de RPCs/views, sincronização de POD/tracking/push, divergências de status documental e cobertura de campos por parada/volume.

---

*Fim do relatório — Fase 1A. Nenhum arquivo de aplicação, banco, RLS ou configuração foi alterado.*
