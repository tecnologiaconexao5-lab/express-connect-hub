# Checklist Produção Final — Express Connect Hub / TMS

> **Data:** 2026-06-26 | **Itens:** 80 | **P0:** 47 | **P1:** 22 | **P2:** 11

---

## SEGURANÇA (12 itens)

- [ ] P0 — `SUPABASE_SERVICE_ROLE_KEY` configurado no `.env`
- [ ] P0 — RLS habilitado em `escala_operacional`
- [ ] P0 — RLS habilitado em `motorista_app_sessoes`
- [ ] P0 — RLS habilitado em `motorista_checkins`
- [ ] P0 — Políticas `USING (true)` substituídas (30 tabelas IA)
- [ ] P0 — `GRANT ALL TO anon` revogado de `ia_credenciais`, `ia_identidades`, `ia_sessoes_operacionais`
- [ ] P0 — Upload restrito no bucket `biblioteca-global`
- [ ] P0 — API keys removidas de localStorage (7 serviços)
- [ ] P1 — `SET search_path = ''` em 9 funções SECURITY DEFINER
- [ ] P1 — Autenticação Supabase implementada (`signInWithPassword`)
- [ ] P1 — Storage bucket `documentos` auditado
- [ ] P2 — RLS padronizado (todas tabelas mesma estratégia)

---

## BANCO DE DADOS (16 itens)

- [ ] P0 — `os_id` alinhado para UUID em `financeiro_receber` e `financeiro_pagar`
- [ ] P0 — CHECK >= 0 em colunas financeiras (5 tabelas)
- [ ] P0 — UNIQUE em `composicao_financeira_os(os_id)`
- [ ] P0 — UNIQUE em `financeiro_receber(os_id)`
- [ ] P0 — UNIQUE em `pagamentos_prestadores(os_id)`
- [ ] P0 — FK `ordens_servico.cliente_id → clientes.id`
- [ ] P0 — FK `ordens_servico.prestador_id → prestadores.id`
- [ ] P0 — FK `financeiro_receber.cliente_id → clientes.id`
- [ ] P0 — FK `financeiro_receber.os_id → ordens_servico.id`
- [ ] P0 — FK `pagamentos_prestadores.os_id → ordens_servico.id`
- [ ] P0 — FK `composicao_financeira_os.prestador_id → prestadores.id`
- [ ] P0 — FK `composicao_financeira_os.os_id → ordens_servico.id`
- [ ] P0 — CHECK `ordens_servico.valor_cliente >= 0`
- [ ] P0 — CHECK `ordens_servico.custo_prestador >= 0`
- [ ] P1 — CHECK em colunas de status (6 tabelas)
- [ ] P1 — Índices de performance (11 índices)

---

## TMS / OPERAÇÃO (18 itens)

- [ ] P0 — Validação de transição de status na escala (máquina de estados)
- [ ] P0 — `cancelarAlocacao()` propaga para OS
- [ ] P0 — `cancelarAlocacao()` zera registros financeiros
- [ ] P0 — `cancelarOS()` criado com cascade para escala + financeiro
- [ ] P0 — `finalizarOrdemServico()` conectado ao UI
- [ ] P0 — Conversão Pedido → OS implementada
- [ ] P0 — Swap de motorista implementado
- [ ] P0 — Swap de veículo implementado
- [ ] P0 — Suporte a multi-stop na escala (tabela de paradas)
- [ ] P0 — Logística reversa / entrega parcial
- [ ] P0 — OS de retorno / devolução
- [ ] P1 — `inadimplenciaService` chamado em `propostaService.converterEmOS()`
- [ ] P1 — `prestador_id` obrigatório na escala
- [ ] P1 — Índice único parcial para conflito de motorista
- [ ] P1 — Índice único parcial para conflito de veículo
- [ ] P2 — Sugestão automática de veículo na OS
- [ ] P2 — Worker de monitoramento de no-show
- [ ] P2 — Notificação automática ao cliente em swap

---

## FINANCEIRO (14 itens)

- [ ] P0 — Margem inclui 6 custos reais (combustível, ajudantes, KM excedente, etc.)
- [ ] P0 — `engineFinanceira` salva resultado no banco
- [ ] P0 — Conciliação OS ↔ `financeiro_receber` (função + relatório)
- [ ] P0 — Fatura comercial / boleto
- [ ] P0 — Cobrança automática / notificação vencimento
- [ ] P1 — `financeiro_pagar` limpo no cancelamento de OS
- [ ] P1 — Baixa parcial preserva valor original (tabela de baixas)
- [ ] P1 — DRE gerencial implementado
- [ ] P1 — Fechamento mensal (batch)
- [ ] P1 — Lote de pagamento prestador (tabela + UI)
- [ ] P1 — Auditoria financeira com `changed_by`
- [ ] P1 — Auditoria para `pagamentos_prestadores` e `composicao_financeira_os`
- [ ] P2 — Conciliação bancária real (substituir mock)
- [ ] P2 — Verificação de inadimplência de prestador

---

## IA / GOVERNANÇA (8 itens)

- [ ] P0 — Default governança alterado para `precisa_aprovacao: true` ✅ (CORRIGIDO)
- [ ] P0 — Re-verificação de permissão em `executarAcaoReal()`
- [ ] P0 — Cap de valor em `COM_REGISTRAR_PAGAMENTO`
- [ ] P0 — Matriz `ia_autoridade_acoes` para todas as 30 ferramentas
- [ ] P1 — Rate limiting por segundo/minuto
- [ ] P1 — `risco_operacional` usado em autorização (não cosmético)
- [ ] P1 — Whitelist de status em `COM_ATUALIZAR_STATUS`
- [ ] P2 — Tabelas de auditoria append-only

---

## FRONTEND / UX (12 itens)

- [ ] P0 — `Frota.tsx` implementado ou removido do menu
- [ ] P0 — `SLA.tsx` implementado ou removido do menu
- [ ] P0 — `Governanca.tsx` implementado ou removido do menu
- [ ] P0 — `Tracking.tsx` conectado ao Supabase
- [ ] P0 — Auto-save no `OrdemServicoForm.tsx`
- [ ] P0 — Indicadores de campos obrigatórios no formulário OS
- [ ] P0 — Botões "em desenvolvimento" desabilitados (não clickable + toast)
- [ ] P0 — Sidebar com busca
- [ ] P1 — `window.confirm()` substituído por `AlertDialog` (10 locais)
- [ ] P1 — Confirmação em ações destrutivas (5 locais)
- [ ] P1 — `catch {}` silenciosos corrigidos (7 locais)
- [ ] P2 — Menu mobile (hamburger/drawer)

---

## RESUMO

| Domínio | P0 | P1 | P2 | Total |
|---------|----|----|-----|-------|
| Segurança | 7 | 3 | 1 | 11 |
| Banco de Dados | 12 | 2 | 0 | 14 |
| TMS / Operação | 11 | 4 | 3 | 18 |
| Financeiro | 6 | 6 | 2 | 14 |
| IA / Governança | 3 | 3 | 1 | 7 |
| Frontend / UX | 8 | 3 | 1 | 12 |
| **Total** | **47** | **21** | **8** | **76** |

---

## REGRAS DE VERIFICAÇÃO

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npm run build` → sucesso
- [ ] `npx playwright test` → sem regressões
- [ ] Teste manual: criar OS → alocar → executar → finalizar → verificar financeiro
- [ ] Teste manual: cancelar escala → verificar OS + financeiro limpos
- [ ] Teste manual: swap motorista → verificar sem conflitos
- [ ] Teste manual: OS multi-stop → verificar paradas independentes
- [ ] Teste manual: entrega parcial → verificar ajuste financeiro

---

*Documento gerado por auditoria enterprise definitiva — OpenCode Go Pro*
