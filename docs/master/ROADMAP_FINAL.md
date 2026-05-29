# ROADMAP FINAL — Conexão Express TMS

> Atualizado em: 23/05/2026
> Base: diagnóstico completo do código-fonte.

---

## Fase 1 — Fundação de Segurança (AGORA)

**Objetivo:** Eliminar risks críticos que impedem produção.

| # | Tarefa | Esforço | Prioridade | Depende de |
|---|--------|---------|------------|------------|
| 1.1 | Substituir auth mock por Supabase Auth | Médio | 🔴 Crítica | — |
| 1.2 | Criar hook useAuth com session real | Baixo | 🔴 Crítica | 1.1 |
| 1.3 | Proteger rotas com AuthGuard | Baixo | 🔴 Crítica | 1.2 |
| 1.4 | Migrar usuários DEMO_USERS para auth.users | Médio | 🔴 Crítica | 1.1 |
| 1.5 | Testar RLS policies com auth real | Médio | 🔴 Crítica | 1.1 |

**Tempo estimado:** 3-5 dias

---

## Fase 2 — Refatoração dos Monolitos (30 DIAS)

**Objetivo:** Quebrar arquivos gigantes em módulos manuteníveis.

| # | Tarefa | Esforço | Prioridade |
|---|--------|---------|------------|
| 2.1 | Extrair serviços do PortalCliente (~5.5k linhas) | Alto | 🟠 Alta |
| 2.2 | Extrair componentes do PortalCliente | Alto | 🟠 Alta |
| 2.3 | Migrar dados mock do PortalCliente para Supabase | Alto | 🟠 Alta |
| 2.4 | Refatorar EscalaLista (~2k linhas) | Médio | 🟡 Média |
| 2.5 | Remover duplicação IAAutomacoes/IaAutomacao | Baixo | 🟡 Média |
| 2.6 | Remover duplicação BancoTalentos | Baixo | 🟡 Média |

**Tempo estimado:** 20-30 dias

---

## Fase 3 — Finalização dos Módulos Core (45 DIAS)

**Objetivo:** Conectar todos os módulos core ao Supabase real.

| # | Tarefa | Esforço | Prioridade |
|---|--------|---------|------------|
| 3.1 | Migrar Recrutamento (services → Supabase) | Alto | 🟠 Alta |
| 3.2 | Migrar Comercial (Orçamentos/Propostas → Supabase) | Médio | 🟠 Alta |
| 3.3 | Finalizar Pagamento Prestadores + CNAB | Médio | 🟠 Alta |
| 3.4 | Migrar Escala (mock → Supabase) | Médio | 🟡 Média |
| 3.5 | Conectar Tabelas de Valores ao Supabase | Baixo | 🟡 Média |
| 3.6 | Finalizar Portal Prestador | Médio | 🟡 Média |

**Tempo estimado:** 30-45 dias

---

## Fase 4 — Infraestrutura de Produção (15 DIAS)

**Objetivo:** Levar integrações de localhost para produção.

| # | Tarefa | Esforço | Prioridade |
|---|--------|---------|------------|
| 4.1 | Configurar VPS para n8n + Evolution API | Alto | 🟠 Alta |
| 4.2 | Migrar webhooks de localhost para produção | Médio | 🟠 Alta |
| 4.3 | Configurar domínio tms.conexaoexpress.com.br | Baixo | 🟡 Média |
| 4.4 | Configurar SSL/Vercel Domain | Baixo | 🟢 Baixa |
| 4.5 | Testar fluxo completo WhatsApp → n8n → Supabase | Médio | 🟠 Alta |

**Tempo estimado:** 10-15 dias

---

## Fase 5 — Módulos Finais (30 DIAS)

**Objetivo:** Completar módulos pendentes.

| # | Tarefa | Esforço | Prioridade |
|---|--------|---------|------------|
| 5.1 | Implementar NFS-e (integração real) | Alto | 🟡 Média |
| 5.2 | Implementar SEFAZ | Alto | 🟢 Baixa |
| 5.3 | Finalizar Seguros (apólices + sinistros) | Médio | 🟢 Baixa |
| 5.4 | Implementar automações IA completas | Alto | 🟡 Média |
| 5.5 | Finalizar Marketing | Médio | 🟢 Baixa |
| 5.6 | App Motorista DreamFlow | Médio | 🟡 Média |

**Tempo estimado:** 20-30 dias

---

## Fase 6 — Limpeza e Organização (CONTÍNUO)

**Objetivo:** Qualidade de código e documentação.

| # | Tarefa | Esforço | Prioridade |
|---|--------|---------|------------|
| 6.1 | Mover 40+ scripts .cjs/.ts para scripts/ | Baixo | 🟢 Baixa |
| 6.2 | Mover .sql avulsos para sql/ | Baixo | 🟢 Baixa |
| 6.3 | Atualizar documentação master continuamente | Baixo | 🟡 Média |
| 6.4 | Adicionar testes automatizados | Médio | 🟡 Média |
| 6.5 | CI/CD com testes no deploy | Médio | 🟢 Baixa |

**Tempo estimado:** Contínuo (5-10 dias iterativo)

---

## Cronograma Visual

```
Fase 1 (Auth)       ████████░░░░ 3-5d     [SEMANA 1]
Fase 2 (Monolitos)  ████████████████████ 20-30d  [SEMANAS 2-5]
Fase 3 (Core)       ████████████████████████████████ 30-45d [SEMANAS 5-11]
Fase 4 (Infra)      ████████████ 10-15d   [SEMANAS 11-13]
Fase 5 (Finais)     ████████████████████ 20-30d  [SEMANAS 13-17]
Fase 6 (Limpeza)    ████████████████...   Contínuo
```

---

## Marcos (Milestones)

| Marco | Data Alvo | Entregável |
|-------|-----------|------------|
| M1 | Fim Semana 1 | Auth real funcionando, rotas protegidas |
| M2 | Fim Semana 5 | PortalCliente refatorado, EscalaLista quebrada |
| M3 | Fim Semana 11 | Todos módulos core conectados ao Supabase |
| M4 | Fim Semana 13 | Infraestrutura em produção (VPS + domínio) |
| M5 | Fim Semana 17 | Sistema completo, deploy estável |

---

## Riscos do Roadmap

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Auth quebrar funcionalidades existentes | Média | Alto | Manter backward compatibility, testes manuais |
| Monolitos serem grandes demais para refatorar em 1 passada | Alta | Médio | Refatorar em etapas, extrair 1 serviço por vez |
| VPS não ficar pronta a tempo | Média | Alto | Usar serviços cloud (n8n.cloud, Evolution SaaS) |
| Dependências externas (SEFAZ, bancos) | Alta | Médio | Priorizar modules que não dependem de terceiros |
| Perda de dados mock ao migrar | Média | Alto | Scripts de seed para popular Supabase |

---

## Decisões Estratégicas

1. **Manter camelCase → snake_case via dbMappers.ts** (já implementado e funcional)
2. **Zero secrets no frontend** — toda operação sensível via n8n middleware
3. **Supabase como única fonte de verdade** — eliminar localStorage progressivamente
4. **Recrutamento como 1º módulo pós-Auth a ser finalizado** (já tem a UI mais rica)
5. **Refatoração primeiro, features novas depois** — até Fase 5, sem novas features
