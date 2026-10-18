# Plano de Refatoração v3 — Express Connect Hub / TMS

> Versão: 3.0 | Data: 2026-06-26 | Base: Auditoria Enterprise Completa

---

## Visão Geral

Este plano consolida **133 achados** das 8 auditorias (Segurança, Banco, TMS, Escala, Financeiro, IA, Frontend, Arquitetura) em **6 ondas de correção** priorizadas por risco.

```
Onda 1: Segurança (P0)           ████████████████░░░░  4 dias
Onda 2: Integridade Dados (P0)   ░░░░░████████████░░░  3 dias
Onda 3: TMS + Escala (P0)        ░░░░░░░░░░████████░░  5 dias
Onda 4: IA Governança (P0)       ░░░░░░░░░░░░░░░░████  3 dias
Onda 5: Frontend (P0)            ░░░░░░░░░░░░░░░░░░░░  3 dias
Onda 6: Arquitetura (P0)         ░░░░░░░░░░░░░░░░░░░░  5 dias
```

---

## Onda 1 — Segurança (P0) | 4 dias

### 1.1 RLS — Habilitar em tabelas sem proteção
```sql
ALTER TABLE escala_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_app_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_checkins ENABLE ROW LEVEL SECURITY;
```
**Risco:** Nenhum. Apenas habilita RLS (sem política, acesso negado por default).

### 1.2 RLS — Fechar políticas `USING (true)` nas tabelas IA
Para as 30 tabelas IA críticas, substituir `USING (true)` por políticas seletivas:
- SELECT: permitir `anon` (leitura do painel)
- INSERT/UPDATE/DELETE: exigir `authenticated`
**Risco:** Pode quebrar funcionalidades que dependem de escrita anon. Testar após.

### 1.3 Revogar `GRANT ALL TO anon` de tabelas sensíveis
```sql
REVOKE ALL ON ia_credenciais FROM anon;
REVOKE ALL ON ia_identidades FROM anon;
REVOKE ALL ON ia_sessoes_operacionais FROM anon;
```

### 1.4 Adicionar `SET search_path = ''` em SECURITY DEFINER
9 funções precisam de proteção contra search path hijacking.

### 1.5 Restringir bucket `biblioteca-global`
Upload atualmente público. Restringir para `authenticated`.

### 1.6 Adicionar `SUPABASE_SERVICE_ROLE_KEY` ao `.env`
Obter do dashboard Supabase e configurar.

---

## Onda 2 — Integridade de Dados (P0) | 3 dias

### 2.1 Alinhar `os_id` para UUID
```sql
-- Verificar dados válidos primeiro
SELECT os_id FROM financeiro_receber WHERE os_id !~ '^[0-9a-f]{8}-...';
-- Converter
ALTER TABLE financeiro_receber ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
ALTER TABLE financeiro_pagar ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
```
**Risco:** Falha se houver valores não-UUID. Validar antes.

### 2.2 Adicionar CHECK >= 0 em colunas financeiras
```sql
ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_frete_pos CHECK (valor_frete >= 0);
ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_repasse_pos CHECK (valor_repasse >= 0);
ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_valor_pos CHECK (valor >= 0);
ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_valor_pos CHECK (valor >= 0);
ALTER TABLE pagamentos_prestadores ADD CONSTRAINT ck_pp_valor_pos CHECK (valor >= 0);
```
**Risco:** Pode falhar se houver valores negativos existentes. Corrigir dados primeiro.

### 2.3 Adicionar UNIQUE constraint
```sql
ALTER TABLE composicao_financeira_os ADD CONSTRAINT uq_composicao_os UNIQUE (os_id);
```
**Risco:** Pode falhar se houver duplicatas. Limpar primeiro.

### 2.4 Adicionar FKs críticos
```sql
ALTER TABLE ordens_servico ADD CONSTRAINT fk_os_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE ordens_servico ADD CONSTRAINT fk_os_prestador FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
ALTER TABLE contratos_historico ADD CONSTRAINT fk_ch_contrato FOREIGN KEY (contrato_id) REFERENCES contratos_gerados(id) ON DELETE CASCADE;
```
**Risco:** FKs com SET NULL exigem que a coluna aceite NULL.

### 2.5 Adicionar CHECK em colunas de status
```sql
ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_status CHECK (status IN ('aberto','pago','vencido','atrasado','cancelado'));
ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_status CHECK (status IN ('aberto','pago','vencido','atrasado','cancelado'));
```
**Risco:** Pode falhar se houver status inválidos existentes.

### 2.6 Criar índices de performance
11 índices compostos para queries de inadimplência, conflito, e deduplicação.

### 2.7 Trigger de auditoria financeira
Criar `financeiro_receber_audit` com trigger `AFTER UPDATE`.

---

## Onda 3 — TMS + Escala (P0) | 5 dias

### 3.1 Conectar `finalizarOrdemServico()` ao UI
- Adicionar botão "Finalizar OS" no `OrdemServicoForm.tsx`
- Validar transição de status antes de finalizar
- Disparar sync financeiro e escala

### 3.2 Implementar conversão Pedido → OS
- Criar `pedidosService.converterParaOS(pedidoId)`
- Worker que varre `portal_pedidos WHERE status = 'enviado' AND os_vinculada_id IS NULL`
- Criar OS automaticamente e vincular

### 3.3 Validação de transições de status
- Máquina de estados para OS: `rascunho → pendente → agendada → em_andamento → em_rota → finalizada`
- Bloquear transições inválidas (ex: `finalizada → rascunho`)

### 3.4 Mover sync financeiro/OS para dentro do `escalaService`
Atualmente o sync só acontece via hook React (`useEscala`). Mover para o service:
- `escalaService.finalizarAlocacao()` → chama `sincronizarOSEscala()`
- `escalaService.cancelarAlocacao()` → chama `sincronizarOSEscala()`
- `escalaService.atualizarAlocacao()` → chama `sincronizarOSEscala()`

### 3.5 Limpeza financeira no cancelamento de escala
Quando escala é cancelada:
- `financeiro_receber`: status → 'cancelado', valor → 0
- `financeiro_pagar`: status → 'cancelado', valor → 0
- `pagamentos_prestadores`: status → 'cancelado', valor → 0
- `composicao_financeira_os`: remover ou zerar

### 3.6 Integrar `detectarConflitosEscala` ao service layer
- Chamar em `criarAlocacao()` e `atualizarAlocacao()`
- Bloquear time overlap (atualmente só AVISO)

---

## Onda 4 — IA Governança (P0) | 3 dias

### 4.1 Alterar default de governança
```typescript
// governancaService.ts:306 — ALTERAR DE:
return { permitido: true, precisa_aprovacao: false, ... };
// PARA:
return { permitido: false, precisa_aprovacao: true, motivo: "Ação não configurada na matriz de autoridade" };
```

### 4.2 Adicionar re-verificação em `executarAcaoReal()`
Chamar `validarPermissao()` e `governancaService.avaliarAcao()` no início do switch.

### 4.3 Criar entries `ia_autoridade_acoes` para todas as 30 ferramentas
Cada ferramenta deve ter entrada explícita com:
- `permitido`: true/false
- `precisa_aprovacao`: true/false
- `valor_maximo`: cap financeiro
- `nivel_risco`: classificação

### 4.4 Rate limiting por segundo/minuto
Adicionar sliding window além do contador diário existente.

### 4.5 Adicionar cap de valor em `COM_REGISTRAR_PAGAMENTO`
Validar `contexto.valor` contra `ia_autoridade_acoes.valor_maximo`.

---

## Onda 5 — Frontend (P0) | 3 dias

### 5.1 Remover ou sinalizar módulos maquete
- `Frota.tsx`: adicionar banner "Módulo em desenvolvimento" proeminente ou remover da sidebar
- `SLA.tsx`: mesmo tratamento
- `Governanca.tsx`: mesmo tratamento
- `Tracking.tsx`: conectar ao Supabase (dados reais)

### 5.2 Substituir `window.confirm()` por `AlertDialog`
10 locais usando `window.confirm()`. Substituir pelo componente `AlertDialog` já disponível.

### 5.3 Adicionar confirmação em ações destrutivas
5 locais com delete/remoção sem confirmação:
- `IntegracoesTMS.tsx:835` — excluirEscala
- `Roteirizador.tsx:269` — removerParada
- `ShortlistPanel.tsx:61,85` — removerShortlist
- `ContactDetails.tsx:70` — removerTag
- `ConectoresTab.tsx:404` — desvincularRobo

### 5.4 Corrigir `catch {}` silenciosos
7 locais com `catch {}` vazio. Adicionar `console.error()` e `toast.error()`.

### 5.5 Remover placeholder do Index.tsx
Substituir conteúdo Lovable placeholder por dashboard real ou landing page.

---

## Onda 6 — Arquitetura (P0) | 5 dias

### 6.1 Split `centralIaService.ts` (1685 linhas)
Extrair 6 serviços:
- `roboService.ts` — CRUD de robôs
- `tarefaService.ts` — CRUD de tarefas
- `aprovacaoService.ts` — fluxo de aprovação
- `logService.ts` — registro de logs
- `triggerService.ts` — gatilhos
- `comunicacaoService.ts` — mensagens entre robôs

### 6.2 Consolidar Zoho Email Services
Unificar `zohoEmailService.ts`, `email/zohoEmailService.ts`, `integracoes/zohoEmailService.ts` em `integrations/zohoEmailService.ts`.

### 6.3 Remover código morto
- `externalIntegrationEngine.ts` (337 linhas)
- `automacao.ts` (255 linhas) — se confirmado sem callers
- `automacaoWhatsapp.ts` (269 linhas) — se confirmado sem callers
- `finalizarOrdemServico()` (264 linhas) — ou conectar

### 6.4 Mover tipos compartilhados
De `src/components/*/types` para `src/types/`.

### 6.5 Extrair `sincronizarFinanceiro()` unificado
Juntar `sincronizarFinanceiroOS()` + `sincronizarFinanceiroOSAlocacao()`.

---

## Cronograma Estimado

| Onda | Dias | Dependências |
|------|------|-------------|
| 1. Segurança | 4 | Nenhuma |
| 2. Integridade Dados | 3 | Onda 1 (service role key) |
| 3. TMS + Escala | 5 | Onda 2 (FKs, constraints) |
| 4. IA Governança | 3 | Onda 1 (RLS) |
| 5. Frontend | 3 | Nenhuma |
| 6. Arquitetura | 5 | Ondas 1-5 |
| **Total** | **23 dias** | |

---

## Critérios de Aceite por Onda

Cada onda deve passar:
- `npx tsc --noEmit` → 0 erros
- `npm run build` → sucesso
- `npx playwright test` → sem regressões
- Testes manuais dos fluxos afetados

---

*Documento gerado por planejamento de refatoração — OpenCode Go Pro*
