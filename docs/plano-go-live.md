# Plano Go-Live — Express Connect Hub / TMS

> **Data:** 2026-06-26 | **Horizonte:** 40 dias | **10 Ondas**

---

## Visão Geral

Este plano descreve o caminho para transformar o Express Connect Hub/TMS de um sistema com ~55% de prontidão operacional para um sistema capaz de suportar uma transportadora real com 200+ clientes, 130 motoristas e 300-500 OS/dia.

---

## Onda 1 — Segurança RLS (Dias 1-4)

**Objetivo:** Fechar o banco de dados para acesso não autorizado.

| Tarefa | Esforço |
|--------|---------|
| Configurar `SUPABASE_SERVICE_ROLE_KEY` no `.env` | 5min |
| Fechar 47 políticas `USING (true)` nas tabelas IA | 4h |
| Criar políticas com `auth.role() = 'authenticated'` para escrita | 2h |
| Habilitar RLS em tabelas sem proteção | 30min |
| Revogar `GRANT ALL TO anon` de tabelas restantes | 30min |
| Restringir bucket `biblioteca-global` | 15min |
| Implementar Supabase Auth (login/registro) | 8h |
| Mover API keys de localStorage para env | 2h |
| Testar todos os fluxos com RLS restrito | 4h |

**Critério de aceite:** Nenhuma tabela com `USING (true)` para escrita. App funcional com autenticação.

---

## Onda 2 — Integridade Financeira (Dias 5-9)

**Objetivo:** Prevenir duplicatas, corrupção e divergências financeiras.

| Tarefa | Esforço |
|--------|---------|
| Adicionar `UNIQUE (os_id)` em `financeiro_receber` | 1h |
| Adicionar `UNIQUE (os_id)` em `pagamentos_prestadores` | 1h |
| Adicionar CHECK `valor >= 0` em `ordens_servico` | 30min |
| Adicionar 6 FKs restantes | 2h |
| Integrar `engineFinanceira` ao `composicaoFinanceiraService` | 4h |
| Criar função `conciliarFinanceiro()` | 4h |
| Criar relatório de divergências OS ↔ financeiro | 3h |
| Adicionar auditoria em `pagamentos_prestadores` | 2h |
| Adicionar coluna `changed_by` na auditoria | 1h |

**Critério de aceite:** Margem real em todos os dashboards. Conciliação zero divergências.

---

## Onda 3 — Cancelamento e Transições (Dias 10-12)

**Objetivo:** Garantir que cancelamentos limpem todos os registros vinculados.

| Tarefa | Esforço |
|--------|---------|
| Criar máquina de estados para `alocacoes_escala.status` | 3h |
| `cancelarAlocacao()` → chamar `sincronizarOSEscala()` | 1h |
| `cancelarAlocacao()` → chamar `sincronizarFinanceiroOSAlocacao()` | 1h |
| Criar função `cancelarOS()` com cascade | 3h |
| Adicionar validação "OS finalizada não pode ser editada" | 2h |
| Testar todos os caminhos de cancelamento | 2h |

**Critério de aceite:** Cancelar escala → OS atualizada + financeiro zerado. Cancelar OS → escala cancelada + financeiro zerado.

---

## Onda 4 — Swap + Multi-stop (Dias 13-17)

**Objetivo:** Permitir trocas emergenciais e rotas complexas.

| Tarefa | Esforço |
|--------|---------|
| Criar `trocarMotorista(alocacaoId, novoPrestadorId)` | 4h |
| Criar `trocarVeiculo(alocacaoId, novoPlaca)` | 3h |
| Validação de conflitos no swap | 2h |
| Notificação automática ao cliente no swap | 2h |
| Criar tabela `escala_paradas` | 2h |
| Adaptar escala para multi-stop | 6h |
| POD por parada | 3h |
| Tracking por parada | 3h |

**Critério de aceite:** Swap em 2 cliques. Rota com 12 paradas em SP totalmente rastreável.

---

## Onda 5 — Logística Reversa (Dias 18-22)

**Objetivo:** Suportar entregas parciais, devoluções e OS de retorno.

| Tarefa | Esforço |
|--------|---------|
| Criar status "parcial" na OS e escala | 1h |
| Criar flag `tipo_os` (entrega, coleta, retorno, devolucao) | 1h |
| `finalizarAlocacao()` com parciais | 3h |
| Criar OS de retorno automática | 3h |
| Ajuste financeiro na entrega parcial | 4h |
| UI para registro de parcial | 3h |
| Relatório de ocorrências parciais | 2h |

**Critério de aceite:** Entregar 3 de 5 volumes → OS parcial + OS retorno para 2 + ajuste cobrança.

---

## Onda 6 — Cobrança e Fatura (Dias 23-25)

**Objetivo:** Fechar o ciclo financeiro com emissão de cobrança.

| Tarefa | Esforço |
|--------|---------|
| Gerar fatura comercial na finalização de OS | 3h |
| Emitir boleto (integrar API bancária) | 4h |
| Notificação de vencimento ao cliente | 2h |
| Portal do cliente: aprovar orçamento | 3h |
| Portal do cliente: visualizar faturas | 2h |

**Critério de aceite:** OS finalizada → fatura gerada → boleto emitido → cliente notificado.

---

## Onda 7 — Módulos Maquete (Dias 26-30)

**Objetivo:** Implementar ou remover módulos falsos.

| Tarefa | Esforço |
|--------|---------|
| Implementar `Frota.tsx` (cadastro + manutenção + reserva) | 8h |
| Implementar `SLA.tsx` com dados reais | 4h |
| Implementar `Governanca.tsx` com dados reais | 4h |
| Conectar `Tracking.tsx` ao Supabase | 3h |
| Implementar `Combustiveis.tsx` com API real | 4h |

**Critério de aceite:** Zero dados hardcoded em módulos principais.

---

## Onda 8 — IA Governança (Dias 31-33)

**Objetivo:** Fechar brechas de autonomia da IA.

| Tarefa | Esforço |
|--------|---------|
| Re-verificação em `executarAcaoReal()` | 2h |
| Rate limiting por segundo/minuto | 3h |
| Popular `ia_autoridade_acoes` para 30 ferramentas | 4h |
| `risco_operacional` usado em autorização | 1h |
| Whitelist de status em `COM_ATUALIZAR_STATUS` | 1h |

**Critério de aceite:** IA não executa ação perigosa sem aprovação. Rate limit efetivo.

---

## Onda 9 — UX Crítico (Dias 34-36)

**Objetivo:** Corrigir problemas de usabilidade bloqueantes.

| Tarefa | Esforço |
|--------|---------|
| Auto-save no `OrdemServicoForm.tsx` | 3h |
| Indicadores de campos obrigatórios | 2h |
| Botões "em desenvolvimento" → disabled | 1h |
| Sidebar com busca | 3h |
| Substituir `window.confirm()` por `AlertDialog` | 2h |
| Adicionar `catch {}` com tratamento | 1h |

**Critério de aceite:** Formulário OS com auto-save. Zero toasts "em desenvolvimento".

---

## Onda 10 — Testes e Documentação (Dias 37-40)

**Objetivo:** Validar sistema completo antes do go-live.

| Tarefa | Esforço |
|--------|---------|
| Teste integrado: OS → escala → entrega → fatura → pagamento | 4h |
| Teste integrado: cancelamento completo | 2h |
| Teste integrado: swap emergencial | 2h |
| Teste integrado: multi-stop com parciais | 2h |
| Criar manual do operador | 4h |
| Criar manual do administrador | 3h |
| Teste de carga (100 OS simultâneas) | 3h |

**Critério de aceite:** Todos os 8 cenários operacionais passam. Manual do operador pronto.

---

## Cronograma

```
Semana 1: Onda 1 (Segurança) + Onda 2 (Financeiro)
Semana 2: Onda 3 (Cancelamento) + Onda 4 (Swap/Multi-stop)
Semana 3: Onda 5 (Logística Reversa) + Onda 6 (Cobrança)
Semana 4: Onda 7 (Maquetes) + Onda 8 (IA)
Semana 5: Onda 9 (UX) + Onda 10 (Testes)
Semana 6: Go-Live + Hypercare
```

---

## Equipe Recomendada

| Papel | Qtd | Responsabilidade |
|-------|-----|-----------------|
| Dev Fullstack Sênior | 2 | Backend + Frontend |
| Dev PostgreSQL | 1 | Migrations, constraints, performance |
| QA | 1 | Testes manuais + automatizados |
| UX Designer | 1 | Melhorias de usabilidade |
| **Total** | **5** | |

---

*Documento gerado por planejamento de go-live — OpenCode Go Pro*
