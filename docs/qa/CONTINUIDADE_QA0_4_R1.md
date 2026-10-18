# QUADRO DE CONTINUIDADE — QA0.4-R1

**Data:** 2026-07-23
**Missão:** 136-C.2-QA0.4-R1 — Auditoria Definitiva da Fonte Única de Verdade
**Estado:** RETOMADA — QA0.3 concluído, QA0.4-R1 nunca iniciado antes desta sessão

---

## LEGENDA

| Classificação | Significado |
|---------------|-------------|
| ✅ CONCLUÍDA | Etapa completa, evidência gerada |
| ⏳ EM EXECUÇÃO | Sendo trabalhada nesta sessão |
| 🔄 NÃO INICIADA | Ainda não começada |
| ❌ BLOQUEADA | Dependente de recurso/ambiente não disponível |
| ⚠️ PARCIAL | Iniciada mas incompleta ou contraditória |
| 🔶 PRECISA REEXECUÇÃO | Dados existem mas são imprecisos |

---

## QUADRO GERAL

| Etapa | Prevista | Iniciada | Concluída | Evidência | Status | Pendente |
|:-----:|:--------:|:--------:|:---------:|-----------|:------:|----------|
| 0 — Retomada segura | Sessão | Sessão | Sessão | `git status`, branch `main`, commit `148b67f` | ✅ | Nada |
| 1 — Ler histórico | Sessão | Sessão | Sessão | Todos os 6 docs QA lidos + scripts qa03 | ✅ | Nada |
| 2 — Quadro continuidade | Sessão | Sessão | Sessão | Este documento | ✅ | Nada |
| 3 — Reconciliar contradições | QA0.4-R1 | ❌ | ❌ | — | 🔄 | 11 contradições listadas |
| 4 — Contagem exata testes | QA0.4-R1 | Sessão | Sessão | `npx playwright test --list`: **821 tests, 91 files** | ✅ | Explicar 189 vs 223 vs 821 |
| 5 — Método acesso banco | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Documentar scripts qa03 |
| 6 — Catálogo real banco | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Query catálogo PostgreSQL |
| 7 — Contagem exata OS | QA0.4-R1 | ❌ | ❌ | — | ❌ BLOQUEADA | Sem service_role ou PG direto |
| 8 — Policy RLS ordens_servico | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Extrair definição real |
| 9 — Auditoria anônima | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Consultar sem sessão |
| 10 — Prestador vs Motorista | QA0.4-R1 | QA0.3 | ⚠️ | qa03 scripts | ⚠️ PARCIAL | Confirmar pagamentos s/ prestador |
| 11 — Origem alocações | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Analisar metadata/created_by |
| 12 — Orfandade real | QA0.4-R1 | QA0.3 | ⚠️ | qa03_etapa5 | ⚠️ PARCIAL | Separar nulo permitido de órfão |
| 13 — Financeiro, Tracking, POD | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Validar M66, tracking, POD |
| 14 — Documentos finais | QA0.4-R1 | ❌ | ❌ | — | 🔄 | 8 documentos a criar |
| 15 — 36 respostas obrigatórias | QA0.4-R1 | ❌ | ❌ | — | 🔄 | Dependente de etapas 3-14 |

---

## CONTRADIÇÕES CONHECIDAS (ETAPA 3)

| # | Contradição | QA0 | QA0.2 | QA0.3 | Real (07/2026) |
|---|-------------|:---:|:-----:|:-----:|:--------------:|
| 1 | Total de testes | 89 exec | ~160 | 189 / 223 | **821** (91 arquivos) |
| 2 | `ordens_servico` registos | 0 | 0 | ~49-81+ | **RLS quebrado: contagem bloqueada** |
| 3 | Alocações | 172 | 172 | 176 | **176** (confirmado) |
| 4 | `recrutamento_prestadores` | 0 | — | 1 | **1** (Diego Balbino) |
| 5 | $page.goto\$ vs sidebar | — | Necessário | Necessário | **Sidebar COLLAPSED ainda afeta** |
| 6 | Prestador = Motorista? | — | — | Conceitualmente sim | **0 prestadores, sem entidade motorista** |
| 7 | Pagamentos com prestador_id sem prestadores | — | — | Observado | **77 registos, 0 prestadores** |
| 8 | Anon lê dados sensíveis | — | Médio | **Alto** | **Confirmado** |
| 9 | RLS ordens_servico quebrada | — | — | Cast UUID | **Confirmado** |
| 10 | Menu COLLAPSED afeta testes | — | Sim | Sim | **Confirmado** |
| 11 | Ambiente QA | — | Plano criado | Não existe | **Continuam sem ambiente QA** |

---

## PRÓXIMAS AÇÕES (ORDEM DE EXECUÇÃO)

1. ETAPA 5 — Documentar método de acesso ao banco
2. ETAPA 6 — Catálogo real via PG catalog + queries
3. ETAPA 8 — Extrair policy RLS via `pg_policies`
4. ETAPA 9 — Auditoria anônima real (2º cliente Supabase sem auth)
5. ETAPA 3 — Reconciliar contradições com dados novos
6. ETAPA 10 — Concluir prestador/motorista/veículo
7. ETAPA 11 — Origem alocações via metadata
8. ETAPA 12 — Orfandade real
9. ETAPA 13 — Financeiro, tracking, POD
10. ETAPA 7 — Tentativa final de contagem OS
11. ETAPA 14 — Gerar documentos finais
12. ETAPA 15 — 36 respostas
