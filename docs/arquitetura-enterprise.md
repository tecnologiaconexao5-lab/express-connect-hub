# Arquitetura Enterprise — Express Connect Hub / TMS

> Auditoria: 2026-06-26 | Classificação: P0/P1/P2 | Versão: v3

---

## 1. Visão Macro da Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                    │
│  42 Páginas │ 200+ Componentes │ shadcn/ui │ Tailwind │ Recharts │
├──────────────────────────────────────────────────────────────────┤
│                    CAMADA DE APRESENTAÇÃO                         │
│  80 componentes acessam Supabase DIRETAMENTE (bypass service)     │
├──────────────────────────────────────────────────────────────────┤
│                    CAMADA DE SERVIÇOS                             │
│  ~130 serviços em src/services/                                   │
│  34 serviços de IA em src/services/ia/                            │
│  5 providers de integração externa                                │
├──────────────────────────────────────────────────────────────────┤
│                    SUPABASE (Backend)                              │
│  ~100 tabelas │ 74 migrations │ 7 Edge Functions                  │
│  RLS formalmente ativo, efetivamente aberto (47 policies USING true) │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Pontos Fortes

| Aspecto | Evidência |
|---------|-----------|
| Sincronização bidirecional OS ↔ Escala | `ordemServicoService.ts:34` / `:602` |
| Diagnóstico de divergência em tempo real | `syncDiagnostico.ts` |
| Motor de IA modular com 30+ ferramentas reais | `actionEngineService.ts:648-1057` |
| Memória corporativa com contexto completo | `memoriaService.ts:montarContextoCompleto()` |
| Orquestrador de trabalho com fila e prioridade | `workforceOrchestratorService.ts` |
| Governança com matriz de autoridade | `governancaService.ts` |
| 50 specs E2E Playwright | `tests/e2e/` |
| Build e TypeScript 0 erros | `npx tsc --noEmit` |

## 3. Problemas Estruturais Críticos (P0)

### 3.1 Segurança: RLS efetivamente desativado
- **47 políticas** com `USING (true)` em tabelas IA, portal, contratos, CRM
- **3 tabelas** sem RLS: `escala_operacional`, `motorista_app_sessoes`, `motorista_checkins`
- `GRANT ALL TO anon` em 20+ tabelas sensíveis (credenciais, identidades, sessões)
- `SUPABASE_SERVICE_ROLE_KEY` vazio no `.env` — Edge Functions quebradas
- API keys lidas de `localStorage` (7 serviços)

### 3.2 Banco: Integridade de dados comprometida
- `financeiro_receber.os_id` é **TEXT**, `alocacoes_escala.id` é **UUID** — joins quebrados
- 16 FKs ausentes em tabelas críticas (ordens_servico, portal, contratos, fiscal)
- Sem CHECK >= 0 em colunas financeiras (20+ colunas)
- Escrita dupla concorrente: trigger SQL + TypeScript nas mesmas tabelas
- Sem unique constraint em `composicao_financeira_os.os_id`
- `escala_operacional` duplica `alocacoes_escala` — tabela deprecated sem FK

### 3.3 TMS: Fluxo central quebrado
- `finalizarOrdemServico()` existe mas **nunca é chamado** (0 callers)
- Portal pedidos nunca convertidos para OS operacional (dead-end)
- Orçamento → Contrato não conectado (FK ausente)
- Sem validação de transições de status (OS pode ir de `rascunho` → `finalizada`)

### 3.4 Financeiro: Margem inflada e registros órfãos
- Margem no dashboard ignora 6 categorias de custo (combustível, ajudantes, KM excedente)
- Motor real (`engineFinanceira`) nunca salva no banco
- Cancelamento de escala não limpa `financeiro_pagar`
- Baixa parcial perde valor original do título
- `TabFinanceiro.tsx:65` consulta campo `margem` inexistente

### 3.5 Escala: Integridade operacional quebrada
- `escalaService` não dispara sync financeiro/OS (só o hook React dispara)
- Cancelamento deixa registros financeiros órfãos
- Sem troca de motorista, troca de veículo, reagendamento
- Detecção de conflitos abrangente existe mas nunca integrada ao service
- `ocorrencia` não é tratado como status ativo para conflito

### 3.6 IA: Governança com bypass padrão
- `governancaService.ts:306` — default `permitido: true, precisa_aprovacao: false`
- IA pode criar OS, finalizar OS, registrar pagamento sem aprovação
- `executarAcaoReal()` sem nenhuma re-verificação de permissão
- Sem rate limiting por segundo/minuto (apenas diário)
- `risco_operacional` é cosmético, nunca usado em autorização

### 3.7 Frontend: Módulos maquete em produção
- `Frota.tsx`, `SLA.tsx`, `Governanca.tsx` — 100% hardcoded
- `Tracking.tsx` — mock com `setTimeout`
- `Combustiveis.tsx` — rotulado `MOCKS DA ESTRUTURA`
- 10 botões destrutivos usam `window.confirm()` em vez de AlertDialog
- 5 ações destrutivas sem confirmação alguma
- 7 blocos `catch {}` silenciosos

### 3.8 Serviços: God objects e código morto
- `centralIaService.ts` — 1685 linhas, 6+ domínios
- `romaneioCalvoService.ts` — 1617 linhas
- 3 cópias do Zoho Email Service, 2 cópias do Evolution API Service
- `externalIntegrationEngine.ts` (337 linhas) — 100% simulado, nunca chamado
- `finalizarOrdemServico()` — 264 linhas de código morto
- 80 componentes bypassam a camada de serviço

---

## 4. Matriz de Risco Enterprise

| Domínio | P0 | P1 | P2 | Total |
|---------|----|----|----|-------|
| Segurança/RLS | 6 | 3 | 2 | 11 |
| Banco/Modelagem | 1 | 11 | 9 | 21 |
| TMS Central | 4 | 4 | 4 | 12 |
| Escala | 5 | 8 | 6 | 19 |
| Financeiro | 4 | 11 | 5 | 20 |
| IA/Governança | 3 | 4 | 5 | 12 |
| Frontend/UX | 4 | 5 | 7 | 16 |
| Arquitetura | 6 | 8 | 8 | 22 |
| **Total** | **33** | **54** | **46** | **133** |

---

## 5. Plano de Correção por Onda

### Onda 1 — Segurança e Integridade (P0 crítico)
1. Adicionar `SUPABASE_SERVICE_ROLE_KEY` ao `.env`
2. Criar migration de RLS: substituir `USING (true)` por políticas com `auth.role()`
3. Habilitar RLS em `escala_operacional`, `motorista_app_sessoes`, `motorista_checkins`
4. Adicionar `SET search_path = ''` em 9 funções SECURITY DEFINER
5. Remover `GRANT ALL TO anon` de tabelas de credenciais/sessões
6. Restringir upload no bucket `biblioteca-global`

### Onda 2 — Dados e Financeiro (P0 integridade)
1. Migration: alinhar `os_id` para UUID em `financeiro_receber` e `financeiro_pagar`
2. Migration: adicionar CHECK >= 0 em colunas financeiras
3. Migration: adicionar FKs ausentes (16 tabelas)
4. Migration: adicionar UNIQUE em `composicao_financeira_os(os_id)`
5. Migration: adicionar CHECK em colunas de status sem constraint
6. Adicionar trigger de auditoria financeira (`financeiro_receber_audit`)

### Onda 3 — TMS e Escala (P0 operacional)
1. Conectar `finalizarOrdemServico()` ao UI (botão "Finalizar OS")
2. Implementar conversão Pedido → OS (fechar loop portal)
3. Adicionar validação de transições de status na OS
4. Mover sync financeiro/OS para dentro do `escalaService` (não só no hook)
5. Implementar limpeza financeira no cancelamento de escala
6. Integrar `detectarConflitosEscala` ao service layer

### Onda 4 — IA Governança (P0 autonomia)
1. Alterar default em `governancaService.ts:306` para `precisa_aprovacao: true`
2. Adicionar re-verificação de permissão em `executarAcaoReal()`
3. Implementar rate limiting por segundo/minuto
4. Criar entries `ia_autoridade_acoes` para todas as 30 ferramentas
5. Adicionar cap de valor em `COM_REGISTRAR_PAGAMENTO`

### Onda 5 — Frontend (P0 maquetes)
1. Remover `Frota.tsx`, `SLA.tsx`, `Governanca.tsx` do menu ou adicionar banner "Em desenvolvimento"
2. Conectar `Tracking.tsx` ao Supabase
3. Substituir `window.confirm()` por `AlertDialog` (10 locais)
4. Adicionar confirmação em 5 ações destrutivas
5. Remover `Index.tsx` placeholder

### Onda 6 — Arquitetura (P0 dívida técnica)
1. Split `centralIaService.ts` em 6 serviços
2. Consolidar 3 Zoho Email Services em 1
3. Remover `externalIntegrationEngine.ts`
4. Remover `finalizarOrdemServico()` ou conectá-lo
5. Mover tipos compartilhados de componentes para `src/types/`

---

## 6. Métricas de Health Check

| Indicador | Atual | Alvo |
|-----------|-------|------|
| Tabelas com RLS efetivo | ~15% | 100% |
| Tabelas com FK completo | ~60% | 100% |
| Colunas financeiras com CHECK | ~30% | 100% |
| Serviços >1000 linhas | 2 | 0 |
| Componentes bypassando service | 80 | 0 |
| Módulos maquete | 3 | 0 |
| Cobertura de testes E2E | 50 specs | Manter |
| Build + TypeScript | 0 erros | 0 erros |

---

## 7. Decisões de Arquitetura Pendentes

1. **Autenticação**: App nunca chama `signInWithPassword`. Usar Supabase Auth ou permanecer anon-key com RLS restrito?
2. **Escala**: Manter `escala_operacional` (deprecated) ou migrar totalmente para `alocacoes_escala`?
3. **Financeiro**: Adotar soft-delete ou manter hard-delete com auditoria?
4. **IA Autônoma**: Permitir `EXECUTAR_AUTONOMO` em produção ou forçar sempre `PRODUCAO_ASSISTIDA`?
5. **Providers**: Ativar providers reais (Zoho, WhatsApp) ou manter simulação até chaves disponíveis?

---

*Documento gerado por auditoria enterprise automatizada — OpenCode Go Pro*
*Próxima revisão: após Onda 1 de correções*
