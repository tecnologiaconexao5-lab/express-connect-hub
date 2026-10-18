# Checklist de Arquitetura — Express Connect Hub / TMS

> Versão: 3.0 | Data: 2026-06-26 | 133 itens

---

## Segurança (19 itens)

- [ ] P0 — Adicionar `SUPABASE_SERVICE_ROLE_KEY` ao `.env`
- [ ] P0 — Habilitar RLS em `escala_operacional`
- [ ] P0 — Habilitar RLS em `motorista_app_sessoes`
- [ ] P0 — Habilitar RLS em `motorista_checkins`
- [ ] P0 — Auditar RLS em `ordens_servico`, `clientes`, `prestadores`, `veiculos`
- [ ] P0 — Fechar políticas `USING (true)` nas tabelas IA (30 tabelas)
- [ ] P0 — Revogar `GRANT ALL TO anon` de `ia_credenciais`, `ia_identidades`, `ia_sessoes_operacionais`
- [ ] P0 — Restringir upload no bucket `biblioteca-global`
- [ ] P0 — Remover API keys de localStorage (7 serviços)
- [ ] P1 — Adicionar `SET search_path = ''` em 9 funções SECURITY DEFINER
- [ ] P1 — Corrigir políticas `ia_comunicacoes_robos` (bloqueado para anon)
- [ ] P1 — Corrigir políticas `diretor_virtual_eventos_ia` (bloqueado para anon)
- [ ] P1 — Fechar `GRANT ALL TO anon` em tabelas de automação
- [ ] P1 — Restringir `obter_cliente_id_do_usuario` (SECURITY DEFINER + EXECUTE TO anon)
- [ ] P2 — Padronizar abordagem RLS (todas tabelas com mesma estratégia)
- [ ] P2 — Implementar Supabase Auth (`signInWithPassword`)
- [ ] P2 — Corrigir RLS inconsistente entre tabelas relacionadas
- [ ] P2 — Revisar storage bucket `documentos`
- [ ] P2 — Proteger `contratos_bucket_upload`

---

## Banco de Dados (21 itens)

- [ ] P0 — Alinhar `os_id` para UUID em `financeiro_receber` e `financeiro_pagar`
- [ ] P1 — Adicionar FK `ordens_servico.cliente_id → clientes.id`
- [ ] P1 — Adicionar FK `ordens_servico.prestador_id → prestadores.id`
- [ ] P1 — Adicionar FK `contratos_historico.contrato_id → contratos_gerados.id`
- [ ] P1 — Adicionar FK `portal_pedidos.os_vinculada_id → ordens_servico.id`
- [ ] P1 — Adicionar FK `portal_ocorrencias.os_id → ordens_servico.id`
- [ ] P1 — Adicionar FK `portal_ocorrencias.cliente_id → clientes.id`
- [ ] P1 — Adicionar FK `portal_faturas.cliente_id → clientes.id`
- [ ] P1 — Adicionar FK `escala_operacional.os_id → ordens_servico.id`
- [ ] P1 — Adicionar FK `orcamentos.os_vinculada_id → ordens_servico.id`
- [ ] P1 — Adicionar FK `pagamentos_prestadores.prestador_id → prestadores.id`
- [ ] P1 — Adicionar FK `financeiro_receber.cliente_id → clientes.id`
- [ ] P0 — Adicionar CHECK >= 0 em colunas financeiras (6 tabelas)
- [ ] P0 — Adicionar UNIQUE em `composicao_financeira_os(os_id)`
- [ ] P1 — Adicionar CHECK em `financeiro_receber.status`
- [ ] P1 — Adicionar CHECK em `financeiro_pagar.status`
- [ ] P1 — Adicionar CHECK em `portal_faturas.status`
- [ ] P1 — Adicionar CHECK em `crm_leads.estagio`
- [ ] P1 — Adicionar CHECK em `ordens_servico.status_faturamento`
- [ ] P1 — Marcar `escala_operacional` como deprecated
- [ ] P1 — Criar trigger de auditoria `financeiro_receber_audit`

---

## TMS — Fluxo Central (12 itens)

- [ ] P0 — Conectar `finalizarOrdemServico()` ao UI
- [ ] P0 — Implementar conversão Pedido → OS (fechar loop portal)
- [ ] P0 — Adicionar validação de transições de status na OS
- [ ] P0 — Conectar Orçamento → Contrato (FK ausente)
- [ ] P1 — Validar `cliente_id` como FK real na criação de OS
- [ ] P1 — Adicionar deduplicação em `sincronizarFinanceiroOS`
- [ ] P1 — Criar trilha de auditoria para ajustes manuais de valor
- [ ] P1 — Alertar quando OS é criada sem escala vinculada
- [ ] P2 — Prevenir duplicação OS from orçamento
- [ ] P2 — Integrar `matchPrestadores` à criação de OS
- [ ] P2 — Gerar PDF automaticamente na finalização de OS
- [ ] P2 — Adicionar permissão `finalizar_os` ao `permissoes.ts`

---

## Escala (19 itens)

- [ ] P0 — Limpar financeiro no cancelamento de escala
- [ ] P0 — Mover sync OS/financeiro para dentro do `escalaService`
- [ ] P0 — `finalizarAlocacao()` deve disparar sync financeiro
- [ ] P0 — Re-verificar conflitos no `atualizarAlocacao()`
- [ ] P0 — Incluir `ocorrencia` como status ativo para conflito
- [ ] P1 — Implementar troca de motorista
- [ ] P1 — Implementar troca de veículo
- [ ] P1 — Corrigir UI que afirma limpeza financeira inexistente
- [ ] P1 — Conectar KPI "Conflitos" (atualmente "—")
- [ ] P1 — Exibir `historico_alocacoes_escala` real na timeline
- [ ] P1 — Integrar `detectarConflitosEscala` ao service layer
- [ ] P1 — Implementar sync OS → Escala (atualmente só diagnóstico)
- [ ] P1 — Unificar cancelamento entre service e hook
- [ ] P2 — Implementar reagendamento
- [ ] P2 — Adicionar webhook/notificação em mudanças de status
- [ ] P2 — Filtrar eventos no realtime
- [ ] P2 — Corrigir adapter `ocorrencia → em_rota`
- [ ] P2 — Remover fallback de localStorage em produção
- [ ] P2 — Validar `km_realizados` na finalização

---

## Financeiro (20 itens)

- [ ] P0 — Incluir custos reais na margem (combustível, ajudantes, KM excedente)
- [ ] P0 — Salvar resultado do `engineFinanceira` no banco
- [ ] P0 — Limpar `financeiro_pagar` no cancelamento de OS
- [ ] P0 — Adicionar proteção contra duplicatas (unique constraint + lock)
- [ ] P1 — Preservar valor original na baixa parcial (não sobrescrever)
- [ ] P1 — Propagar cancelamento de escala para tabelas financeiras
- [ ] P1 — Corrigir query `TabFinanceiro.tsx` (campo `margem` inexistente)
- [ ] P1 — Conectar `Inadimplencia.tsx` ao Supabase (remover hardcoded)
- [ ] P1 — Incluir status "parcial" como inadimplente
- [ ] P1 — Substituir `ConciliacaoAvancada.tsx` (100% mock)
- [ ] P1 — Criar reconciliação automática OS ↔ financeiro
- [ ] P1 — Preservar valor original na baixa total
- [ ] P1 — Corrigir precedência de operador no filtro de inadimplência
- [ ] P2 — Filtrar `composicao_financeira_os` por data
- [ ] P2 — Substituir `allSettled` por transação no delete de OS
- [ ] P2 — Mover tabela de frete para banco de dados
- [ ] P2 — Verificar inadimplência de prestador
- [ ] P2 — Usar tolerância na verificação de duplicidade de repasse
- [ ] P2 — Adicionar baixa parcial em pagamentos de prestadores
- [ ] P2 — Criar tabela de baixas (`financeiro_baixas`)

---

## IA / Governança (12 itens)

- [ ] P0 — Alterar default de governança para `precisa_aprovacao: true`
- [ ] P0 — Adicionar re-verificação de permissão em `executarAcaoReal()`
- [ ] P0 — Adicionar cap de valor em `COM_REGISTRAR_PAGAMENTO`
- [ ] P1 — Implementar rate limiting por segundo/minuto
- [ ] P1 — Usar `risco_operacional` em decisões de autorização
- [ ] P1 — Re-verificar permissão entre gate e execução
- [ ] P1 — Adicionar whitelist de status em `COM_ATUALIZAR_STATUS`
- [ ] P2 — Expandir `AuditoriaTab` para detectar anomalias de governança
- [ ] P2 — Adicionar chamada agendada para `expirarAprovacoesPendentes()`
- [ ] P2 — Prevenir auto-aprovação (segregação de deveres)
- [ ] P2 — Tornar tabelas de auditoria append-only
- [ ] P2 — Bloquear mudança de modo HOMOLOGACAO → PRODUCAO_AUTONOMA sem aprovação

---

## Frontend / UX (16 itens)

- [ ] P0 — Sinalizar `Frota.tsx` como "Em desenvolvimento"
- [ ] P0 — Sinalizar `SLA.tsx` como "Em desenvolvimento"
- [ ] P0 — Sinalizar `Governanca.tsx` como "Em desenvolvimento"
- [ ] P0 — Conectar `Tracking.tsx` ao Supabase
- [ ] P1 — Substituir `window.confirm()` por `AlertDialog` (10 locais)
- [ ] P1 — Adicionar confirmação em ações destrutivas (5 locais)
- [ ] P1 — Remover mock de `Combustiveis.tsx`
- [ ] P1 — Remover placeholder do `Index.tsx`
- [ ] P1 — Corrigir `catch {}` silenciosos (7 locais)
- [ ] P2 — Implementar menu mobile (hamburger/drawer)
- [ ] P2 — Reduzir itens da sidebar (25+ top-level)
- [ ] P2 — Substituir `overflow-x-auto` em TabsList por design responsivo
- [ ] P2 — Adicionar empty states em tabelas (4 páginas)
- [ ] P2 — Remover badge "IA — em breve" ou implementar
- [ ] P2 — Corrigir hardcoded heights (3 páginas)
- [ ] P2 — Implementar templates em `Comunicacao.tsx`

---

## Arquitetura de Serviços (22 itens)

- [ ] P0 — Split `centralIaService.ts` (1685 linhas)
- [ ] P0 — Consolidar 3 Zoho Email Services
- [ ] P0 — Remover `externalIntegrationEngine.ts` (código morto)
- [ ] P0 — Remover `automacao.ts` e `automacaoWhatsapp.ts` (se mortos)
- [ ] P0 — Remover ou conectar `finalizarOrdemServico()`
- [ ] P0 — Extrair `sincronizarFinanceiro()` unificado
- [ ] P1 — Mover tipos de componentes para `src/types/`
- [ ] P1 — Remover `evolutionApiService.ts` duplicado
- [ ] P1 — Split `gestaoFuncionariosService.ts`
- [ ] P1 — Extrair `validarMensagemSegura` para módulo compartilhado
- [ ] P1 — Canonicalizar cálculo de margem
- [ ] P1 — Mover `TABELA_TESTE_VEICULOS_SP` para banco
- [ ] P2 — Padronizar padrão de criação de serviços
- [ ] P2 — Criar módulo `src/services/validators/`
- [ ] P2 — Criar `src/lib/config.ts` para acesso a env vars
- [ ] P2 — Mover status maps para `ia_configuracoes`
- [ ] P2 — Consolidar chamadas fetch de AI no `aiProviderManager`
- [ ] P2 — Mover URLs hardcoded para env vars
- [ ] P2 — Delegar `criarAlocacao` do hook para o service
- [ ] P2 — Extrair validators de `romaneioCalvoService.ts`
- [ ] P2 — Criar `useApi()` hook para encapsular supabase
- [ ] P2 — Remover localStorage de serviços

---

## Resumo

| Domínio | P0 | P1 | P2 | Total |
|---------|----|----|----|-------|
| Segurança | 9 | 4 | 6 | 19 |
| Banco de Dados | 2 | 13 | 6 | 21 |
| TMS Central | 4 | 4 | 4 | 12 |
| Escala | 5 | 8 | 6 | 19 |
| Financeiro | 4 | 7 | 7 | 18 |
| IA Governança | 3 | 4 | 5 | 12 |
| Frontend UX | 4 | 5 | 7 | 16 |
| Arquitetura | 6 | 5 | 11 | 22 |
| **Total** | **37** | **50** | **52** | **139** |

---

*Documento gerado por auditoria enterprise — OpenCode Go Pro*
