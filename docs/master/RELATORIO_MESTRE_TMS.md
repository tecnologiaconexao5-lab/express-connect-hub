# RELATÓRIO MESTRE — express-connect-hub (Conexão Express TMS)

## 1. Resumo Geral

TMS (Transportation Management System) completo construído como SPA React 18 + TypeScript + Vite + Tailwind/shadcn/ui com Supabase como backend PostgreSQL + Auth + Storage + Realtime. Hospedado em Vercel.

**Stack principal:** React 18, TypeScript 5.8, Vite 5, Tailwind 3, shadcn/ui, React Router 6, TanStack Query 5, Zustand 4, React Hook Form + Zod, Framer Motion 11, Recharts 2.

**Integrações:** Supabase, Mapbox GL (roteirização), n8n (workflows), Evolution API (WhatsApp), múltiplos provedores de IA (Groq, Gemini, OpenRouter, OpenAI), ViaCEP, Zoho Email.

**Infraestrutura:** Docker Compose (PostgreSQL 16, Redis 7, n8n, Evolution API), Vercel (frontend), Supabase Cloud (banco).

**Estado geral:** ~80% features implementadas, ~50% conectado ao Supabase real, ~30% ainda em mock/localStorage. 35+ páginas, 40+ componentes shadcn/ui, 277 tabelas no schema SQL.

---

## 2. Status por Módulo

| Módulo | Status | Conexão Supabase | Observação |
|--------|--------|-----------------|------------|
| Dashboard / Torre Controle | 80% | Parcial | KPIs puxam Supabase, alguns dados mock |
| Operação / OS / Escala | 85% | Real (OS) / Mock (Escala) | OrdemServicoService conectado; EscalaLista (~1980 linhas) ainda mock |
| Cadastros (Prestadores, Clientes, Veículos) | 90% | Real | CRUDs funcionais, mappers centralizados em dbMappers.ts |
| Financeiro | 90% | Parcial | ContasPagar/Receber reais; PagamentoPrestadores 95% concluído (P1-P10); CNAB mock |
| Comercial (CRM, Orçamentos, Propostas) | 60% | Misto | CRM real; Orçamentos e Propostas mock |
| Fiscal (NFS-e, SEFAZ) | 40% | Nenhum | Estrutura criada, sem integração real |
| Frota / Combustíveis | 70% | Parcial | Abastecimentos real; Frota parcial |
| Contratos / SLA / Seguros | 70% | Misto | Contratos real; Seguros parcial |
| Portal Cliente | 40% | Predominantemente mock | Monolito ~5500 linhas, generateMock*() |
| Portal Prestador / App Prestador | 60% | Real (AppPrestadorService) | AppService conectado; Portal parcial |
| Recrutamento Inteligente | 70% | Misto | UI rica (kanban, IA, pipeline); services maioria localStorage |
| WhatsApp / n8n / IA | 50% | Infraestrutura montada | Evolution dockerizada, n8n configurado, IA providers prontos |
| Comunicação | 50% | Parcial | Hub conectado, templates criados |
| Biblioteca / Governança | 60% | Parcial | Estrutura criada |

---

## 3. Riscos Críticos

### 🔴 CRÍTICO — Auth Mock
src/lib/auth.ts usa DEMO_USERS hardcoded e localStorage. Não utiliza Supabase Auth. RLS configurada para auth.uid() nunca é acionada. Dados reais no banco expostos para qualquer acesso ao frontend. Impede rollout para clientes reais.

### 🔴 CRÍTICO — PortalCliente Monolito (~5500 linhas)
src/pages/PortalCliente.tsx com 322KB. Mistura UI, regras de negócio, dados mock (generateMockEntregas, generateMockFaturas) e chamadas Supabase. Manutenção inviável; qualquer alteração quebra múltiplas funcionalidades.

### 🟠 ALTO — Mistura mock/real sem isolamento
Múltiplos serviços (configuracoesService, recrutamento services) misturam supabase.from() com fallback localStorage. Sem flag clara de ambiente, comportamento imprevisível.

### 🟠 ALTO — Duplicação de módulos
IAAutomacoes.tsx e IaAutomacao.tsx duplicados. BancoTalentos.tsx em pages/ e components/. Gera inconsistência e retrabalho.

### 🟠 ALTO — 40+ scripts de debug na raiz
Arquivos .cjs, .ts, .sql poluindo a raiz do projeto. Deveriam estar em scripts/ ou sql/. Atrapalha navegação.

### 🟡 MÉDIO — EscalaLista.tsx (~1980 linhas)
Segundo maior monolito. Mock data + lógica + UI no mesmo arquivo.

### 🟡 MÉDIO — Dependência localhost (n8n/Evolution)
Integrações apontam para localhost:5678 e localhost:8080. Não funcionam em produção sem VPS.

### 🟡 MÉDIO — docs/master/ vazios
5 arquivos estratégicos estavam vazios (corrigido neste commit).

---

## 4. Ordem Recomendada de Trabalho

| Ordem | Módulo | Esforço | Impacto | Dependências |
|-------|--------|---------|---------|--------------|
| 1 | Auth (mock → Supabase Auth) | Médio | Crítico | Nenhuma |
| 2 | Portal Cliente (refatorar monolito) | Alto | Alto | Auth |
| 3 | Recrutamento (mock → Supabase) | Alto | Alto | Auth |
| 4 | Comercial (mock → real) | Médio | Alto | Auth |
| 5 | Financeiro (CNAB/Pagamento) | Médio | Alto | Auth |
| 6 | Escala (refatorar + migrar) | Médio | Médio | Auth |
| 7 | n8n/WhatsApp (produção/VPS) | Alto | Alto | Auth |
| 8 | Fiscal (NFS-e/SEFAZ) | Alto | Médio | Auth |
| 9 | Limpeza (scripts/módulos duplicados) | Baixo | Baixo | — |
| 10 | docs/master/ (manutenção contínua) | Baixo | Médio | — |

---

## 5. Próximos Módulos a Finalizar

1. **Autenticação** — Substituir DEMO_USERS + localStorage por supabase.auth.signInWithPassword(). Criar AuthGuard, loader de sessão, proteção de rotas. Escopo: src/lib/auth.ts, src/App.tsx, + hook useAuth.

2. **Portal Cliente** — Extrair serviços de src/pages/PortalCliente.tsx para src/services/portalCliente/. Separar em componentes: DashboardCliente, Pedidos, Faturas, Tracking, Ocorrências.

3. **Recrutamento** — Migrar módulo inteiro (services do modules/recrutamento/services/) de localStorage para Supabase. UI já está pronta.

4. **Comercial** — Migrar mockOrcamentos e mockPropostas para Supabase. Conectar OrcamentoForm ao banco real.

5. **Financeiro (CNAB)** — Finalizar PagamentoPrestadores e PagamentoCNAB conectando ao Supabase.

---

## 6. Modelos IA Recomendados por Tipo de Tarefa

| Tipo de Tarefa | Modelo | Motivo |
|----------------|--------|--------|
| Ajuste simples (import, tipo, rename) | Claude 3.5 Sonnet / GPT-4o mini | Rápido, barato, preciso |
| Correção média (migrar service, adicionar validação) | Claude 3.5 Sonnet / DeepSeek-Coder | Equilíbrio contexto-precisão |
| Refatoração complexa (quebrar monolito, reescrever auth) | Claude 3 Opus / GPT-4.1 | Visão arquitetural profunda |
| Geração schema SQL / RLS | Claude 3.5 Sonnet | Excelente para SQL complexo |
| UI / Componentes React + Tailwind | Claude 3.5 Sonnet | Melhor para shadcn/ui |
| Auditoria / diagnóstico | Claude 3.5 Sonnet | Visão sistêmica |

---

## 7. Premissas Técnicas

- TypeScript estrito em todo o código
- shadcn/ui como design system oficial
- camelCase no frontend → snake_case no banco (dbMappers.ts centraliza)
- Zero secrets no frontend (n8n like middleware para operações sensíveis)
- Supabase como única fonte de verdade (fase final)
