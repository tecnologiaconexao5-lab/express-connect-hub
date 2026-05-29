# STATUS DOS MÓDULOS — express-connect-hub

> Atualizado em: 25/05/2026
> Base: diagnóstico gerado por IA após leitura completa do código-fonte.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ Completo | 100% funcional, conectado ao Supabase |
| 🔶 Parcial | Funcional, mas com dados mock ou localStorage |
| ❌ Pendente | Estrutura criada, não funcional |
| 🔴 Crítico | Bloqueante para produção |

---

## Módulo 1 — Autenticação

**Status: 🔴 CRÍTICO — Completamente mock**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Login/Registro | ❌ Mock | DEMO_USERS hardcoded em src/lib/auth.ts |
| Sessão | ❌ Mock | localStorage.getItem/setItem |
| Supabase Auth | ❌ Não implementado | supabase.auth não é utilizado |
| Proteção de rotas | ❌ Inexistente | Qualquer rota é acessível |
| RLS (Row Level Security) | 🔶 Configurado no banco | Mas nunca acionado pois auth é mock |

**Arquivos:** src/lib/auth.ts, src/pages/Login.tsx

---

## Módulo 2 — Dashboard / Torre de Controle

**Status: 🔶 Parcial (80%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Dashboard | ✅ Real | KPIs puxam Supabase |
| Torre de Controle | 🔶 Parcial | Alguns indicadores mock |
| Relatórios | 🔶 Parcial | RelatorioService conectado, alguns filtros mock |
| Monitor de Integrações | 🔶 Parcial | Estrutura criada |

**Arquivos:** src/pages/Dashboard.tsx, src/pages/TorreControle.tsx, src/pages/Relatorios.tsx, src/services/relatorios/relatorioService.ts

---

## Módulo 3 — Operação / OS / Escala

**Status: 🔶 Parcial (85%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Ordem de Serviço (CRUD) | ✅ Real | Conectado ao Supabase via ordemServicoService |
| OS Templates WhatsApp | ✅ Pronto | Templates criados |
| Listagem de OS | ✅ Real | OrdensServicoLista conectada |
| Ocorrências | 🔶 Parcial | Estrutura criada |
| Escala Operacional | ❌ Mock | EscalaLista.tsx ~1980 linhas com mock data |
| Roteirização | ✅ Real | Mapbox integrado via roteirizacaoMapbox |
| Roteirizador Web | ✅ Real | Componente Roteirizador funcional |
| POD (Proof of Delivery) | 🔶 Parcial | Estrutura criada |
| Tracking | ✅ Real | Página de rastreio funcional |

**Arquivos:** src/services/ordemServicoService.ts, src/pages/Operacao.tsx, src/components/operacao/EscalaLista.tsx, src/services/roteirizacaoMapbox.ts, src/components/Roteirizador.tsx

---

## Módulo 4 — Cadastros

**Status: ✅ Quase completo (90%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Prestadores CRUD | ✅ Real | Conectado Supabase |
| Clientes CRUD | ✅ Real | Conectado Supabase |
| Veículos CRUD | ✅ Real | Conectado Supabase |
| Cadastros Auxiliares | 🔶 Parcial | Alguns dados mock |
| Mapeadores dbMappers | ✅ Completo | 1944 linhas, centraliza camelCase↔snake_case |
| Análise de Documentos | 🔶 Parcial | DocumentAnalysis conectado, UI parcial |

**Arquivos:** src/pages/CadastrosPrestadores.tsx, src/pages/CadastrosClientes.tsx, src/pages/CadastrosVeiculos.tsx, src/lib/dbMappers.ts

---

## Módulo 5 — Financeiro

**Status: 🔶 Parcial (90%)** — Financeiro Prestador em ~95%

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Contas a Pagar | ✅ Real | Conectado Supabase |
| Contas a Receber | ✅ Real | Conectado Supabase |
| Dashboard Financeiro Enterprise | ✅ Real | Conectado |
| Fluxo de Caixa | ✅ Real | Conectado |
| DRE Gerencial | ✅ Real | Conectado |
| Inadimplência | ✅ Real | Conectado |
| Margem por OS | ✅ Real | Conectado |
| Conciliação Avançada | ✅ Real | Conectado |
| Relatórios Financeiros | ✅ Real | RelatorioFinanceiroCompleto |
| Plano de Contas | ✅ Real | Conectado |
| Contas Bancárias | ✅ Real | Conectado |
| **Pagamento Prestadores (completo)** | ✅ **95%** | P2-P10: cálculo, auditoria, comprovantes, bloqueio, fechamento, timeline, dashboard, relatório |
| Pagamento CNAB | ❌ Mock | Dados mockados |
| Recibo Rápido | 🔶 Placeholder | Estrutura criada, sem PDF |
| Composição Financeira | ✅ Real | Conectado |
| Auditoria Financeira Prestador | ✅ 100% | Criada na P3 |
| Dashboard Operacional Prestador | ✅ 100% | Criado na P8 |
| Relatório + Exportação Prestador | ✅ 100% | Criado na P9 |

**Arquivos:** src/components/financeiro/* (25+ arquivos), src/services/financeiro/* (3 services), src/helpers/* (8 helpers financeiros)

---

## Módulo 6 — Comercial

**Status: 🔶 Parcial (60%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| CRM Pipeline | ✅ Real | CrmBase, CrmPipeline, CrmKanban, CrmLeads |
| CRM Dashboard | ✅ Real | CrmDashboard conectado |
| Follow-ups | ✅ Real | FollowUpService conectado |
| Orçamentos | ❌ Mock | mockOrcamentos.ts |
| Propostas Comerciais | ❌ Mock | mockPropostas.ts |
| Tabelas de Valores | 🔶 Parcial | UI criada, conexão pendente |
| Simulador de Frete | 🔶 Parcial | UI funcional |
| Marketing | 🔶 Parcial | Estrutura criada |
| Orçamento → OS | 🔶 Parcial | orcamentoToOSService criado |

**Arquivos:** src/components/comercial/*, src/services/comercial/*, src/pages/Comercial.tsx

---

## Módulo 7 — Fiscal

**Status: ❌ Pendente (40%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Estrutura de páginas | ✅ Criada | Página Fiscal.tsx existe |
| NFS-e | ❌ Não implementado | Apenas esboço |
| SEFAZ | ❌ Não implementado | Apenas esboço |
| CIOT | 🔶 Parcial | Serviço criado |
| Averbação | 🔶 Parcial | Serviço criado |

**Arquivos:** src/pages/Fiscal.tsx, src/services/nfse.ts, src/services/sefaz.ts, src/services/ciot.ts, src/services/averbacao.ts

---

## Módulo 8 — Frota / Combustíveis

**Status: 🔶 Parcial (70%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Abastecimentos | ✅ Real | Conectado Supabase |
| Frota | 🔶 Parcial | UI parcial |
| Monitoramento Combustível | 🔶 Parcial | Estrutura criada |

**Arquivos:** src/pages/Frota.tsx, src/pages/Combustiveis.tsx, src/services/combustivelService.ts

---

## Módulo 9 — Contratos / SLA / Seguros

**Status: 🔶 Parcial (70%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Geração de Contratos | ✅ Real | ContratosService conectado |
| Modelos de Contrato | ✅ Real | Conectado |
| Assinatura (modal) | 🔶 Parcial | AssinarContratoModal criado |
| SLA | 🔶 Parcial | Página criada |
| Seguros (Apolices) | 🔶 Parcial | Estrutura criada |
| Sinistros | 🔶 Parcial | Estrutura criada |

**Arquivos:** src/services/contratosService.ts, src/pages/Contratos.tsx, src/pages/SLA.tsx, src/pages/Seguros.tsx, src/components/seguros/*

---

## Módulo 10 — Portal Cliente

**Status: 🔴 CRÍTICO — Predominantemente mock (40%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Dashboard Cliente | ❌ Mock | generateMockEntregas() |
| Pedidos | ❌ Mock | generateMockFaturas() |
| Faturas | ❌ Mock | Dados mock em localStorage |
| Tracking | 🔶 Parcial | Partial real |
| Ocorrências | ❌ Mock | Dados mock |
| Notificações | ❌ Mock | Dados mock |
| Serviços backend | ✅ Real | PortalClienteService, PedidosService criados |

**⚠️ MONOLITO:** src/pages/PortalCliente.tsx — ~5500 linhas, 322KB
**Arquivos:** src/pages/PortalCliente.tsx, src/services/portalCliente/* (4 serviços)

---

## Módulo 11 — Portal Prestador / App Prestador

**Status: 🔶 Parcial (60%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| App Prestador (mobile) | ✅ Real | AppPrestadorService conectado |
| Notificações | ✅ Real | prestador_notificacoes |
| Reembolsos | ✅ Real | prestador_reembolsos |
| Disponibilidade | ✅ Real | prestador_disponibilidade |
| Engajamento | ✅ Real | prestador_engajamento |
| Portal Prestador (web) | 🔶 Parcial | UI parcial, dados mistos |

**Arquivos:** src/pages/PortalPrestador.tsx, src/pages/AppPrestador.tsx, src/services/appPrestadorService.ts

---

## Módulo 12 — Recrutamento Inteligente

**Status: ✅ Pronto para operação (96%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Dashboard Recrutamento | ✅ Real | KPIs operacionais + gráficos (P14) |
| Kanban/Pipeline Enterprise | ✅ Real | Supabase-first, 10 estágios, drag-and-drop, seed automático (P3) |
| Conversão Candidato → Prestador | ✅ Real | `conversaoCandidatoService` com anti-duplicação (P4) |
| Realtime | ✅ Real | `useKanbanRealtime` + `usePrestadoresRealtime` (P6) |
| Vínculo Candidato → Prestador | ✅ Real | `prestador_id` com FK no banco (P7) |
| Timeline/Histórico | ✅ Real | JSONB `historico`, 6 tipos de evento, aba no sheet (P8) |
| Status Documental | ✅ Real | Docs mínimos (CNH/CRLV/ANTT/Foto/Residência), auto-vencimento (P9) |
| Elegibilidade Operacional | ✅ Real | Status apto/pendente/bloqueado/indisponivel (P10) |
| Lista de Aptos | ✅ Real | `listarPrestadoresAptos()`, filtros, seção "Operacionais" (P11) |
| Pré-seleção Manual | ✅ Real | Tag `preSelecionado`, toggle, badge, filtro (P12) |
| Onboarding Checklist | ✅ Real | 6 itens, progresso, aba 5ª no sheet (P13) |
| Métricas Operacionais | ✅ Real | 10 KPIs, gráficos pipeline + documental (P14) |
| Shortlist Escala | ✅ Real | Tag `enviadoEscala`, filtro "Reservas Escala" (P15) |
| Contexto da Reserva | ✅ Real | Migration JSONB, modal edição, prioridade (P16) |
| Prestadores (módulo) | ✅ Real | `prestadoresService` Supabase-first com fallback (P2) |
| CRM WhatsApp | 🔶 Parcial | Supabase real, depende de Evolution API |
| IA / Automações | ❌ Pendente | Fora do escopo P1–P17 |
| Banco de Talentos (mock) | ❌ Mock | Componente interno ainda usa MOCK_TALENTOS |
| Homologação | ❌ Mock | localStorage |

**Arquivos:** src/modules/recrutamento/* (sub-árvore completa), src/services/recrutamento*.ts

---

## Módulo 13 — WhatsApp / n8n / IA

**Status: 🔶 Parcial — infraestrutura montada (50%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Evolution API (Docker) | ✅ Configurada | docker-compose, porta 8080 |
| Envio de Mensagens | ✅ Real | evolutionApiService.ts |
| n8n (Docker) | ✅ Configurado | docker-compose, porta 5679 |
| n8n Webhooks | 🔶 Parcial | URLs configuradas, fluxos pendentes |
| Zoho Email | 🔶 Parcial | Serviço criado, integração parcial |
| IA Provedores (Groq/Gemini/OpenAI) | ✅ Configurados | aiProviderManager, aiOrchestrator |
| IA Automacão (setores) | 🔶 Parcial | iaAutomacaoService conectado, regras pendentes |
| Automação Comercial | 🔶 Parcial | automacaoComercial.ts criado |
| Integração WhatsApp + IA | 🔶 Parcial | recrutamentoWhatsappIAService |
| Central de Integrações | 🔶 Parcial | UI criada |

**⚠️ Nota:** Todas as integrações apontam para localhost. Não funcionam em produção sem VPS.
**Arquivos:** src/services/evolutionApiService.ts, src/services/integracoes/*, src/services/ia/*, src/services/n8nClient.ts

---

## Módulo 14 — Comunicação

**Status: 🔶 Parcial (50%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Hub de Comunicação | ✅ Real | hubComunicacaoService conectado |
| Templates de Mensagem | ✅ Real | mensagensTemplates.ts |
| Comunicação em Lote | 🔶 Parcial | comunicacaoLote.ts |
| Página de Comunicação | 🔶 Parcial | UI parcial |

**Arquivos:** src/pages/Comunicacao.tsx, src/services/hubComunicacaoService.ts

---

## Módulo 15 — Biblioteca / Governança

**Status: 🔶 Parcial (60%)**

| Subitem | Status | Detalhes |
|---------|--------|----------|
| Página Biblioteca | 🔶 Parcial | UI criada |
| Página Governança | 🔶 Parcial | UI criada |

**Arquivos:** src/pages/Biblioteca.tsx, src/pages/Governanca.tsx

---

## Resumo Consolidado

| Status | Quantidade |
|--------|-----------|
| ✅ Completo (100% real) | 0 módulos |
| ✅ Pronto para operação (96%) | 1 (Recrutamento Inteligente) |
| 🔶 Parcial (misto real/mock) | 13 módulos |
| ❌ Pendente (sem integração real) | 0 módulos (mas vários subitens) |
| 🔴 Crítico (bloqueante) | 2 (Auth + Portal Cliente) |

**Módulo mais avançado:** Recrutamento Inteligente (96%). **Próximos:** Financeiro (90%), Cadastros (90%) e Operação/OS (85%).
