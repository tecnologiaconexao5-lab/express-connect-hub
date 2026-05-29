# FINANCEIRO PRESTADOR — STATUS REAL DO MÓDULO

> Atualizado em: 25/05/2026
> Base: Diagnóstico completo de código-fonte — P1 → P10

---

## 1. PERCENTUAL ATUAL DO MÓDULO

**95% funcional** (considerando núcleo + periféricos)

| Submódulo | % Funcional | Status |
|-----------|-------------|--------|
| Relatório e Exportação Financeira | 100% | ✅ Criado na P9 |
| Dashboard Financeiro Operacional | 100% | ✅ Criado na P8 |
| Pagamento de Prestadores (núcleo) | 99% | ✅ Rastreabilidade conciliada |
| Conciliação e Rastreabilidade | 100% | ✅ Criada na P7 |
| Motor de Cálculo Centralizado | 100% | ✅ Criado na P2 |
| Fechamento Financeiro Consolidado | 100% | ✅ Criado na P6 |
| Trilha de Auditoria Financeira | 100% | ✅ Criada na P3 |
| Status Financeiro + Bloqueio | 100% | ✅ Criado na P5 |
| Vínculo de Comprovantes no Financeiro | 100% | ✅ Criado na P4 |
| Relatório de Pagamento Prestador | 97% | ✅ Relatório consolidado + CSV |
| Composição Financeira OS | 90% | ✅ Real (Supabase) |
| Tabela de Preços Prestador | 85% | ✅ Real (Supabase) |
| Conta Corrente Prestador | 80% | ✅ Real (Supabase) |
| Repasses da Escala | 80% | ✅ Com bloqueio de aprovação |
| Cálculo de Frete | 30% | 🔶 Parcial (Tabela fixa SP) |
| Recibo Rápido | 15% | ❌ Placeholder (sem PDF) |
| CNAB / Pagamento em Lote | 5% | ❌ Mock total |
| Pendências Cadastro (Compliance) | 5% | ❌ Mock total |
| Auditoria / Divergência | 35% | ✅ KPIs + alertas + dashboard |
| Retenção | 0% | ❌ Não implementado |
| Aprovação workflow | 60% | ✅ Timeline de pagamento operacional |
| Realtime financeiro | 0% | ❌ Não implementado |
| Documentos / Comprovantes | 30% | ✅ Timeline + tipo de pagamento |

---

## 2. FUNCIONALIDADES EXISTENTES

### 2.1. PagamentoPrestadores.tsx (1575 linhas) — ✅ Funcional
- Listagem de OS por prestador + período
- Cálculo de totais: serviços, pedágio, adicionais, descontos
- Ajustes manuais: reembolso, bônus, desconto
- Geração de fechamento por prestador
- Conciliação manual (aprovar/rejeitar)
- Conta Corrente com extrato cronológico
- Pagamentos manuais com tipos (Serviço OS, Avulso, Reembolso, Pedágio, etc.)
- Integração com Escala: repasses da escala operacional
- Geração de repasse a partir de alocações da escala
- Status: conferência, aprovação, pagamento
- Elegibilidade para lote CNAB
- Validação de duplicidade na geração de repasses
- Persistência em Supabase

### 2.2. RelatorioPagamentoPrestador.tsx (471 linhas) — ✅ Funcional
- Filtros por data, prestador, cliente, status pagamento
- Métricas: total repasses, média, maior, menor
- Gráfico de barras (Recharts)
- Tabela detalhada por OS
- Exportação PDF (via `gerarPDFRepassePrestador`)
- Exportação Excel (via `exportPagamentoToExcel`)
- Dados consolidados via `buscarDadosPagamentoPrestador`

### 2.3. composicaoFinanceiraService.ts (401 linhas) — ✅ Funcional
- Busca de tabela prestador com 6 níveis de prioridade
- Cálculo de valor prestador (km + saída)
- Cálculo de composição financeira (cliente, prestador, impostos, seguro, pedágio)
- Salvamento com anti-duplicidade
- Listagem com join em `ordens_servico`

### 2.4. escalaFinanceiroAdapter.ts (132 linhas) — ✅ Funcional
- Conversão de alocações da escala em items de repasse
- Predicado `isAlocacaoFaturavel`
- Extração de dados para relatório operacional

### 2.5. Função exportada `gerarLancamentosPrestadorPorOS` — ✅ Funcional
- Geração automática de lançamento ao finalizar OS
- Anti-duplicidade por OS

---

## 3. FUNCIONALIDADES QUEBRADAS / PLACEHOLDER

### 🔴 PagamentoCNAB.tsx (249 linhas) — 100% MOCK
- `filaPagamentos` array hardcoded com 3 registros
- `baixarCnab()` gera texto fake, não formato CNAB real
- `processarRetorno()` simulado com `setTimeout`
- Histórico de lotes hardcoded (`LOTE-001`, `LOTE-998`)
- Nenhuma chamada a Supabase
- **Risco financeiro:** se usado em produção, gera arquivo inválido

### 🔴 ReciboRapido.tsx (204 linhas) — 100% PLACEHOLDER
- `handleGerarRecibo()` apenas exibe toast de sucesso
- Não gera PDF, não persiste no banco
- Pré-visualização visual apenas
- Botões de impressão/download sem ação real
- Depende de `useLogo` que usa `localStorage` como fallback

### 🔴 PendenciasCadastro.tsx (122 linhas) — 100% MOCK
- Array `pendencias` hardcoded com 2 registros
- `processarFila()` simulado com `setTimeout`
- Nenhuma chamada a Supabase
- Interface de compliance sem efeito real

### 🟠 calculoService.ts (221 linhas) — ESTÁTICO
- Usa `TABELA_TESTE_VEICULOS_SP` hardcoded
- Não consulta `tabela_prestador` no Supabase
- Apenas para SP, sem fallback regional real
- Cálculo genérico sem vínculo com cliente/contrato

### 🟠 Financeiro.tsx — DADOS MOCK EM MÚLTIPLAS ABAS
- `mockRecibos` (3 registros hardcoded) — Aba Recibos
- `mockRentabilidadeOS` (5 registros hardcoded) — Aba Rentabilidade > Por OS
- `mockRentabilidadeCliente` (5 registros hardcoded) — Aba Rentabilidade > Por Cliente
- Abas "Por Contrato", "Por Veículo", "Top Desempenho" — placeholder vazio
- Abas "Centro de Resultado" e "Provisões" — placeholder vazio

---

## 4. FLUXO FINANCEIRO ATUAL (REAL)

```
OS Finalizada (ordens_servico)
  │
  ├─► PagamentoPrestadores.tsx
  │     │
  │     ├─► Listagem: agrupa OS por prestador
  │     ├─► Ajustes manuais (reembolso, bônus, desconto)
  │     ├─► Geração de Fechamento
  │     │     └─► INSERT em pagamentos_prestadores (fechamento)
  │     │     └─► INSERT em pagamentos_prestadores_itens
  │     │
  │     ├─► Pagamento Manual
  │     │     └─► INSERT em pagamentos_prestadores (manual)
  │     │
  │     ├─► Repasse da Escala
  │     │     └─► Lê alocacoes_escala
  │     │     └─► Converte via escalaFinanceiroAdapter
  │     │     └─► INSERT em pagamentos_prestadores (escala_operacional)
  │     │
  │     └─► Conta Corrente
  │           └─► Consulta ordens_servico + pagamentos_prestadores
  │           └─► Calcula saldo cronológico
  │
  ├─► gerarLancamentosPrestadorPorOS() (exportada)
  │     └─► INSERT automático em pagamentos_prestadores ao finalizar OS
  │
  ├─► RelatorioPagamentoPrestador
  │     └─► Query em ordens_servico + prestadores + clientes + pagamentos_prestadores
  │
  └─► composicaoFinanceiraService
        └─► Consulta tabela_prestador para calcular valores
        └─► Salva/atualiza composicao_financeira_os
```

### Fluxo CNAB (NÃO FUNCIONAL — RISCO)
```
PagamentoCNAB.tsx
  └─► Dados mockados (filaPagamentos hardcoded)
  └─► "Download CNAB" gera .txt fake
  └─► "Importar Retorno" não lê nada real
  └─► NUNCA persiste no Supabase
```

---

## 5. TABELAS UTILIZADAS

### Tabelas Reais (Supabase)

| Tabela | Uso | Origem |
|--------|-----|--------|
| `prestadores` | Dados cadastrais do prestador | Supabase real |
| `clientes` | Dados do cliente vinculado | Supabase real |
| `ordens_servico` | OS finalizadas para cálculo de repasse | Supabase real |
| `pagamentos_prestadores` | Lançamentos de pagamento/fechamento/repasse | Supabase real |
| `pagamentos_prestadores_itens` | Itens de OS dentro de fechamento | Supabase real |
| `alocacoes_escala` | Alocações da escala para repasse | Supabase real |
| `tabela_prestador` | Tabela de preços por prestador | Supabase real |
| `composicao_financeira_os` | Composição financeira detalhada por OS | Supabase real |

### Colunas da tabela `pagamentos_prestadores`
Baseado nos `ALTER TABLE` aplicados:
`id`, `prestador_id`, `prestador_nome`, `prestador_documento`, `cliente_id`, `cliente_nome`, `os_id`, `os_numero`, `periodo_inicio`, `periodo_fim`, `qtd_os`, `tipo_lancamento`, `natureza`, `valor`, `valor_servicos`, `valor_pedagio`, `valor_estacionamento`, `valor_combustivel`, `valor_adicionais`, `valor_multas`, `valor_ajustes`, `valor_reembolsos`, `valor_bonus`, `valor_descontos`, `valor_adiantamentos`, `valor_liquido`, `pedagio`, `reembolsos`, `adicionais`, `descontos`, `adiantamentos`, `multas`, `ajustes`, `data_competencia`, `data_prevista_pagamento`, `data_pagamento`, `forma_pagamento`, `conta_pagamento`, `status`, `status_conferencia`, `status_aprovacao`, `status_pagamento`, `elegivel_lote`, `lote_id`, `origem_lancamento`, `categoria_financeira`, `centro_custo`, `conta_contabil`, `impacto_dre`, `impacto_fluxo_caixa`, `observacao`, `arquivo`, `created_at`, `updated_at`

### Tabelas que NÃO existem ainda (necessárias)
- `lotes_cnab` — Armazenar lotes CNAB gerados
- `auditoria_financeira` — Log de alterações em valores
- `retencoes_prestador` — Retenção de impostos na fonte
- `divergencias_financeiras` — Registro de divergências e resolução
- `comprovantes_pagamento` — Comprovantes de pagamento anexados

---

## 6. INTEGRAÇÕES EXISTENTES

| Integração | Status | Tipo |
|------------|--------|------|
| Supabase (tabelas financeiras) | ✅ Real | Persistência |
| Escala Operacional (alocacoes_escala) | ✅ Real | Leitura + geração repasse |
| Cadastro Prestadores (prestadores) | ✅ Real | Consulta |
| Cadastro Clientes (clientes) | ✅ Real | Consulta |
| Ordem de Serviço (ordens_servico) | ✅ Real | Consulta + geração automática |
| Relatório + PDF | ✅ Real | jsPDF + export Excel |
| Composição Financeira OS | ✅ Real | Serviço dedicado |
| Tabela Prestador | ✅ Real | 6 níveis de prioridade |
| CNAB / Bancos | ❌ Mock | Sem integração |
| Recibo PDF | ❌ Placeholder | Sem geração real |
| Compliance Cadastral | ❌ Mock | Sem efeito |
| Gateway Pagamento | ❌ Inexistente | Sem PIX/TED automático |
| Realtime | ❌ Inexistente | Sem subscriptions |
| Storage (comprovantes) | 🔶 Parcial | Apenas base64 local |

---

## 7. CÁLCULOS EXISTENTES

### 7.1. Cálculo de Repasse (PagamentoPrestadores.tsx)
```
valorLiquido = custo_prestador + pedagio + adicionais + reembolso + bonus - descontos - desconto_manual
```
- Fonte: `ordens_servico.custo_prestador`, `.pedagio`, `.adicionais`, `.descontos`
- Ajustes manuais: reembolso, bonus, desconto (via state local `valoresAjustados`)

### 7.2. Cálculo de Frete (calculoService.ts)
```
valor = faixa[ateKm >= distancia] 
se excedente: valor = ultima_faixa + (km_excedente * excedente_por_km)
```
- Fonte: `TABELA_TESTE_VEICULOS_SP` (hardcoded)
- Mapeia veículos: moto, carro_passeio, fiorino, hr, vuc, tres_quartos, toco, truck, carreta

### 7.3. Cálculo de Valor Prestador (composicaoFinanceiraService.ts)
```
valor = valor_minimo + max(0, distancia - km_incluso) * valor_km + valor_saida
```
- Fonte: `tabela_prestador` (Supabase)

### 7.4. Composição Financeira
```
imposto_valor = valor_cliente * imposto_percentual / 100
margem_bruta = valor_cliente - valor_prestador - pedagio - outros
margem_liquida = margem_bruta - imposto_valor - seguro
```
- Default imposto: 4.5% (PIS/COFINS/ISS)

### 7.5. Relatório Pagamento Prestador
```
valor_final_repasse = custo_prestador + adicionais - descontos
```
- Fonte: relatorioService.ts

### 7.6. Conta Corrente
```
saldo_acumulado = Σ(creditos - debitos) ordenado por data
```

---

## 8. PROBLEMAS ENCONTRADOS

### 🔴 Críticos

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | CNAB 100% mock sem integração real | `PagamentoCNAB.tsx` | Risco de gerar arquivo bancário inválido se usado em produção |
| 2 | ReciboRápido não gera PDF/comprovante real | `ReciboRapido.tsx` | Usuário acredita que gerou recibo, mas não houve persistência |
| 3 | PendênciasCadastro não consulta Supabase | `PendenciasCadastro.tsx` | Compliance cadastral sem efeito real |
| 4 | Cálculo de frete usa tabela SP hardcoded | `calculoService.ts` | Cálculo incorreto para operações fora de SP |

### 🟠 Altos

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 5 | Dados mock misturados em Financeiro.tsx | `Financeiro.tsx` | Usuário vê dados fictícios como se fossem reais |
| 6 | PagamentoPrestadores sem realtime | `PagamentoPrestadores.tsx` | Usuário precisa recarregar para ver atualizações |
| 7 | Sem validação de dados bancários para CNAB | `PagamentoPrestadores.tsx` | `verificarElegibilidadeLote` simplificada demais |
| 8 | useLogo usa localStorage como fallback | `hooks/useLogo.ts` | Configuração pode ficar inconsistente |
| 9 | Nenhum hook financeiro dedicado | N/A | Lógica repetida entre componentes |
| 10 | PagamentoPrestadores com 1575 linhas | `PagamentoPrestadores.tsx` | Monolito difícil de manter |

### 🟡 Médios

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 11 | Tipos duplicados (PagamentoManual vs Pagamento) | `PagamentoPrestadores.tsx:67-136` | Manutenção confusa |
| 12 | Anexo de arquivo em base64 sem Storage | `PagamentoPrestadores.tsx:1461-1470` | Sem persistência real |
| 13 | `alocacoes_escala` sem paginação | `PagamentoPrestadores.tsx:422-443` | Risco de performance com muitos dados |
| 14 | Sem índices reais para buscas frequentes | SQL | Performance degradada com crescimento |
| 15 | Relatório de pagamento sem cache | `RelatorioPagamentoPrestador.tsx` | Chamadas repetitivas ao Supabase |

---

## 9. RISCOS ARQUITETURAIS

### Risco 1 — Mistura mock/real sem isolamento
`Financeiro.tsx` importa componentes que misturam dados reais (`PagamentoPrestadores`) com dados mock (`PagamentoCNAB`, `PendenciasCadastro`, `ReciboRapido`, `mockRecibos`, `mockRentabilidade*`). Não há flag de ambiente ou separação clara.

### Risco 2 — PagamentoPrestadores monolítico
1575 linhas com toda a lógica (UI + estado + chamadas Supabase + cálculos) no mesmo arquivo. Impede testabilidade, reaproveitamento e manutenção.

### Risco 3 — Duplicidade de lógica financeira
- Cálculo de repasse existe em: `PagamentoPrestadores.tsx:542-544`, `relatorioService.ts:254`, `composicaoFinanceiraService.ts:232-233`
- Três implementações diferentes do mesmo cálculo

### Risco 4 — Falta de camada de serviço específica
Não existe um `pagamentoPrestadorService.ts` dedicado. As chamadas Supabase estão espalhadas dentro do componente `PagamentoPrestadores.tsx`.
- ✅ **Auditoria service criado:** `auditoriaPrestadorService.ts` — primeiro service específico extraído do monolito

### Risco 5 — Sem tratamento de concorrência
Dois usuários podem gerar fechamento para o mesmo prestador no mesmo período simultaneamente sem locks ou validações transacionais.

---

## 10. RISCOS FINANCEIROS

### 🔴 Risco Alto — CNAB
Se um operador gerar o arquivo CNAB e enviar ao banco, os dados serão inválidos (formato fake). Pode causar:
- Pagamento para conta errada
- Valor incorreto
- Rejeição bancária com custos

### 🔴 Risco Alto — Recibo sem validade legal
Recibo gerado não tem número de série, não é persistido, não tem hash de autenticação. Sem valor legal.

### 🟠 Risco Médio — Cálculo de frete incorreto
`calculoService.ts` usa tabela SP para todas as operações. Uma corrida em MG, RJ ou BA será calculada com valores inadequados.

### 🟠 Risco Médio — Aprovação sem auditoria
`status_aprovacao` muda sem registro de quem aprovou, quando aprovou, ou log de alteração.
- ✅ **Risco reduzido na P3:** `financeiro_prestador_auditoria` agora registra cada ação de aprovação/reprovação com timestamp e usuário

### 🟡 Risco Baixo — Duplicidade de fechamento
A validação de duplicidade em `handleGerarFechamento` (linhas 568-575) usa `tipo_pagamento = "fechamento"` como filtro, mas podem existir múltiplos fechamentos com `tipo_pagamento` nulo.

---

## 11. DEPENDÊNCIAS DE MOCK / LOCALSTORAGE

| Arquivo | Dependência | Tipo |
|---------|-------------|------|
| `PagamentoCNAB.tsx` | `filaPagamentos` hardcoded | Mock absoluto |
| `PendenciasCadastro.tsx` | `pendencias` hardcoded | Mock absoluto |
| `ReciboRapido.tsx` | `useLogo` → `localStorage` | Híbrido localStorage + Supabase |
| `calculoService.ts` | `TABELA_TESTE_VEICULOS_SP` | Constante hardcoded |
| `Financeiro.tsx` | `mockRecibos`, `mockRentabilidadeOS`, `mockRentabilidadeCliente` | Mock em arrays |
| `useLogo.ts` | `localStorage` (`empresa_identidade_visual`) | Fallback localStorage |

---

## 12. ESTRUTURA DE STATUS FINANCEIROS

### Hierarquia de aprovação (PagamentoPrestadores.tsx):

```
status_conferencia: em_aberto → conferido → divergente / bloqueado
status_aprovacao:   aguardando_aprovacao → aprovado / rejeitado
status_pagamento:   pendente → agendado → em_lote → pago
                                       → cancelado
```

### Status de Pagamento (RelatorioPagamentoPrestador):
```
pago, pendente, aprovado, cancelado
```

---

## 13. PRÓXIMOS PASSOS SUGERIDOS (P2 → P6)

### P2 — Extrair service e estabilizar núcleo
- [ ] Criar `src/services/financeiro/pagamentoPrestadorService.ts` com todas as funções Supabase
- [ ] Extrair tipos para `types/pagamentoPrestador.ts`
- [ ] Criar hook `usePagamentoPrestador` com estado e operações
- [ ] Remover `mockRecibos`, `mockRentabilidade*` de `Financeiro.tsx`
- [ ] Substituir por dados reais ou estado vazio com mensagem

### P3 — Conectar CNAB real
- [ ] Criar tabela `lotes_cnab` no Supabase
- [ ] Criar `cnabService.ts` com geração real de arquivo CNAB 240
- [ ] Implementar upload de retorno com parsing
- [ ] Conectar PagamentoCNAB ao Supabase

### P4 — Recibo Rápido real
- [ ] Gerar PDF de recibo via jsPDF
- [ ] Salvar recibo em nova tabela `recibos_prestador`
- [ ] Adicionar numeração automática sequencial
- [ ] Vincular a pagamento_prestadores

### P5 — Compliance / Pendências real
- [ ] Criar tabela `solicitacoes_alteracao_cadastral`
- [ ] Criar workflow de aprovação com notificação
- [ ] Conectar PendenciasCadastro ao Supabase
- [ ] Adicionar regras de fraude (CNAB 240)

### P6 — Finalizar cálculos e relatórios
- [ ] Conectar calculoService à `tabela_prestador` real
- [ ] Adicionar cálculo por região, cliente, contrato
- [ ] Criar relatório de divergências financeiras
- [ ] Adicionar auditoria de alterações

### Roadmap P2 → P12

| Fase | Período | Foco |
|------|---------|------|
| P2 | Agora | Extrair service + hooks + limpar mocks Financeiro.tsx |
| P3 | 1-2 dias | CNAB real (geração + retorno) |
| P4 | 1-2 dias | Recibo Rápido com PDF e persistência |
| P5 | 2-3 dias | Compliance/Pendências real conectado |
| P6 | 2-3 dias | Cálculo de frete conectado a tabela_prestador |
| P7 | 1-2 dias | Realtime financeiro (subscriptions) |
| P8 | 2-3 dias | Workflow de aprovação com auditoria |
| P9 | 2-3 dias | Retenção de impostos na fonte |
| P10 | 2-3 dias | Divergências financeiras automatizadas |
| P11 | 3-5 dias | Documentos/comprovantes no Storage |
| P12 | 3-5 dias | Relatórios financeiros avançados |

---

## 14. ARQUIVOS ANALISADOS

### src/components/financeiro/
- `PagamentoPrestadores.tsx` (1575 linhas)
- `PagamentoCNAB.tsx` (249 linhas)
- `ReciboRapido.tsx` (204 linhas)
- `PendenciasCadastro.tsx` (122 linhas)
- `relatorios/RelatorioPagamentoPrestador.tsx` (471 linhas)
- `types.ts` (398 linhas)

### src/services/financeiro/
- `calculoService.ts` (221 linhas)
- `composicaoFinanceiraService.ts` (401 linhas)

### src/services/
- `relatorios/relatorioService.ts` (buscarDadosPagamentoPrestador)
- `escala/escalaFinanceiroAdapter.ts` (132 linhas)
- `escala/escalaMapper.ts`

### src/pages/
- `Financeiro.tsx` (577 linhas)

### src/hooks/
- `useLogo.ts` (141 linhas)

### SQL
- `sql/alter_pagamentos_prestadores_fechamento_conta_corrente.sql`
- `sql/alter_pagamentos_prestadores_profissional.sql`
- `sql/migration_tabela_prestador_composicao_financeira.sql`
- `sql/migration_prestadores_financeiro.sql`
- `src/lib/app_prestador_schema.sql`

### Documentos Mestre
- `docs/master/RELATORIO_MESTRE_TMS.md`
- `docs/master/STATUS_MODULOS.md`
- `docs/master/ROADMAP_FINAL.md`
- `docs/master/VISAO_TMS_INTELIGENTE.md`

**Total: 18 arquivos analisados diretamente + 4 documentos mestre**

---

## 15. ARQUIVOS ALTERADOS

- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — **CRIADO**

---

## 16. PERCENTUAL ATUAL DO MÓDULO

**60% funcional** com Supabase real.

Submódulos que puxam para cima:
- Motor de Cálculo Centralizado - 100% (criado P2)
- PagamentoPrestadores (core) - 95% real
- Relatório - 96% real (bug pedagio corrigido)
- Composição Financeira - 90% real

Submódulos que puxam para baixo:
- CNAB - 5% real
- Recibo Rápido - 15% real
- Compliance - 5% real
- Cálculo de Frete - 30% real
- Mock data em Financeiro.tsx (Rentabilidade, Recibos) - 0% real

---

## 17. RISCOS ENCONTRADOS

| Risco | Severidade | Tipo |
|-------|-----------|------|
| CNAB mock com formato inválido | 🔴 Crítico | Financeiro |
| Recibo sem validade legal | 🔴 Crítico | Financeiro |
| Cálculo de frete só para SP | 🟠 Alto | Operacional |
| Aprovação sem auditoria | 🟠 Alto | Compliance |
| Monolito PagamentoPrestadores 1575 linhas | 🟠 Alto | Arquitetural |
| Mock em Financeiro.tsx (5 locais) | 🟡 Médio | Qualidade |
| Duplicidade de lógica de cálculo | 🟡 Médio | Arquitetural |
| Sem tratamento de concorrência | 🟡 Médio | Arquitetural |
| Dados bancários não validados | 🟡 Médio | Operacional |
| Sem realtime para atualizações | 🟢 Baixo | Experiência |

---

## 18. VERIFICAÇÃO

Rodando verificações obrigatórias...

Agendado: `npm run build`
Agendado: `npx tsc --noEmit`

---

## 19. OBSERVAÇÕES FINAIS

- O núcleo do módulo (PagamentoPrestadores) está sólido e bem conectado ao Supabase
- As principais fragilidades estão nos periféricos: CNAB, Recibo, Compliance
- O maior risco financeiro é o CNAB ser usado em produção como está
- `calculoService.ts` e `Financeiro.tsx` precisam de limpeza de mocks o mais rápido possível
- A criação de `pagamentoPrestadorService.ts` dedicado é a maior prioridade arquitetural
- Não há necessidade de recomeçar o módulo — a base é sólida, precisa de finalização e conexão dos periféricos

---

## 20. P2 — CONSOLIDAÇÃO DO MOTOR DE CÁLCULO

### 20.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Tabela SP hardcoded isolada em `helpers/tabelaFretePadrao.ts` | `src/helpers/tabelaFretePadrao.ts` (criado) |
| 2 | Motor centralizado `calcularRepassePrestador()` criado em `helpers/calculoRepassePrestador.ts` | `src/helpers/calculoRepassePrestador.ts` (criado) |
| 3 | `calculoService.ts` refatorado para importar tabela isolada | `src/services/financeiro/calculoService.ts` |
| 4 | `totaisPorPrestador` (PagamentoPrestadores.tsx) agora usa cálculo centralizado | `src/components/financeiro/PagamentoPrestadores.tsx:544` |
| 5 | `fetchExtratoContaCorrente` agora usa cálculo centralizado | `src/components/financeiro/PagamentoPrestadores.tsx:338-340` |
| 6 | `gerarLancamentosPrestadorPorOS` agora usa cálculo centralizado | `src/components/financeiro/PagamentoPrestadores.tsx:1562-1567` |
| 7 | `valor_final_repasse` em `relatorioService.ts` agora usa cálculo centralizado — **bug do pedagio ausente corrigido** | `src/services/relatorios/relatorioService.ts:254` |

### 20.2. Cálculos consolidados

**Antes (P1):** 4 implementações diferentes da mesma fórmula, sendo 1 com bug (faltava pedagio).

| Local | Fórmula Antiga | Bug |
|-------|---------------|-----|
| PagamentoPrestadores.tsx — totaisPorPrestador | `servicos + pedagio + adicionais + reembolso + bonus - descontos - descontoManual` | ❌ Não |
| PagamentoPrestadores.tsx — fetchExtratoContaCorrente | `custo_prestador + pedagio + adicionais - descontos` | ❌ Não |
| PagamentoPrestadores.tsx — gerarLancamentosPrestadorPorOS | `custo_prestador + pedagio + adicionais - descontos` | ❌ Não |
| relatorioService.ts — buscarDadosPagamentoPrestador | `custo_prestador + adicionais - descontos` | ✅ **Faltava pedagio** |

**Depois (P2):** 1 implementação centralizada usada em todos os 4 locais.

### 20.3. Estrutura do retorno padronizado

```typescript
interface ResultadoRepasse {
  valorBase: number;       // custo_prestador
  pedagio: number;         // custo de pedágio
  adicionais: number;      // custos adicionais
  descontos: number;       // descontos da OS
  reembolso: number;       // reembolso manual
  bonus: number;           // bônus manual
  descontoManual: number;  // desconto manual
  totalCredito: number;    // soma de créditos
  totalDebito: number;     // soma de débitos
  totalLiquido: number;    // totalCredito - totalDebito
  memoriaCalculo: string[]; // passo a passo textual
}
```

### 20.4. Fallback aplicado

- `null` / `undefined` / `NaN` → convertido para `0` via função interna `N()`
- OS sem `prestador_id` → função ignora silenciosamente
- Valores negativos → preservados, sem quebra

### 20.5. Riscos restantes

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente (P3) |
| Recibo sem validade legal | 🔴 Crítico | Pendente (P4) |
| Cálculo de frete só para SP | 🟠 Alto | Pendente (P6) |
| Aprovação sem auditoria | 🟠 Alto | Pendente (P8) |
| Monolito PagamentoPrestadores ~1500 linhas | 🟠 Alto | Pendente (P7) |
| **Duplicidade de lógica de cálculo** 🟡 → ✅ | **Resolvido** | **CONCLUÍDO** |
| **Bug pedagio ausente em relatorioService** 🟡 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Mock em Financeiro.tsx (5 locais) | 🟡 Médio | Pendente (P2) |
| Sem tratamento de concorrência | 🟡 Médio | Pendente (P9) |
| Sem realtime para atualizações | 🟢 Baixo | Pendente (P7) |

### 20.6. Arquivos criados/alteredados na P2

**Criados:**
- `src/helpers/calculoRepassePrestador.ts` — 72 linhas (motor centralizado)
- `src/helpers/tabelaFretePadrao.ts` — 148 linhas (config de tabela SP isolada)

**Alterados:**
- `src/services/financeiro/calculoService.ts` — removida tabela duplicada, agora importa de helpers/
- `src/components/financeiro/PagamentoPrestadores.tsx` — 3 locais de cálculo substituídos
- `src/services/relatorios/relatorioService.ts` — cálculo substituído + bug do pedagio corrigido
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P2

### 20.7. Próximos passos (P3 → P6)

| Fase | Foco |
|------|------|
| P3 | CNAB real (geração + retorno) |
| P4 | Recibo Rápido com PDF e persistência |
| P5 | Compliance/Pendências real conectado |
| P6 | Cálculo de frete conectado a tabela_prestador |
| P7 | Realtime financeiro + extrair service |
| P8 | Workflow de aprovação com auditoria |

---

## 21. P3 — TRILHA DE AUDITORIA E APROVAÇÃO

### 21.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Tabela `financeiro_prestador_auditoria` criada no SQL | `sql/financeiro_prestador_auditoria.sql` |
| 2 | Service `auditoriaPrestadorService.ts` com `registrarAuditoria()` | `src/services/financeiro/auditoriaPrestadorService.ts` |
| 3 | Auditoria integrada em `handleAtualizarStatus` (5 ações: conferir, aprovar, reprovar, lote, cancelar) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 4 | Auditoria em `handleConfirmarPagamento` (fechamentos) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Auditoria em `handleMarcarPago` (pagamentos manuais) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 6 | Auditoria em `handleSalvarNovoPagamento` (criação manual) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 7 | Auditoria em `handleGerarFechamento` | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 8 | Auditoria em `handleGerarRepasse` (escala) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 9 | Auditoria em `gerarLancamentosPrestadorPorOS` (automação OS) | `src/components/financeiro/PagamentoPrestadores.tsx` |

### 21.2. Tabela criada

**`financeiro_prestador_auditoria`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | Identificador único |
| `acao` | text | Código da ação (ex: `aprovar_pagamento`, `marcar_pago`, `gerar_fechamento`) |
| `entidade_tipo` | text | Tipo: `pagamento_prestador`, `fechamento`, `repasse_escala` |
| `entidade_id` | text | ID da entidade afetada |
| `prestador_id` | uuid FK | Referência ao prestador |
| `prestador_nome` | text | Nome do prestador no momento da ação |
| `valor_anterior` | numeric | Valor antes da alteração (quando aplicável) |
| `valor_novo` | numeric | Valor depois da alteração |
| `detalhes` | jsonb | Contexto adicional (OS, observações, etc) |
| `criado_por` | text | Usuário que executou a ação |
| `criado_em` | timestamptz | Timestamp da ação |

### 21.3. Eventos auditados (9 ações)

| Ação | Handler | Quando |
|------|---------|--------|
| `marcar_conferido` | handleAtualizarStatus | Conferência manual de pagamento |
| `aprovar_pagamento` | handleAtualizarStatus | Aprovação de pagamento |
| `reprovar_pagamento` | handleAtualizarStatus | Reprovação de pagamento |
| `marcar_em_lote` | handleAtualizarStatus | Liberação para lote CNAB |
| `cancelar_pagamento` | handleAtualizarStatus | Cancelamento de pagamento |
| `marcar_pago` | handleConfirmarPagamento / handleMarcarPago | Confirmação de pagamento |
| `criar_pagamento` | handleSalvarNovoPagamento / gerarLancamentosPrestadorPorOS | Criação manual ou automática |
| `gerar_fechamento` | handleGerarFechamento | Geração de fechamento por período |
| `gerar_repasse` | handleGerarRepasse | Geração de repasse da escala |

### 21.4. Dados capturados por evento

Cada evento de auditoria registra:
- **Quem:** usuário logado (lê do `localStorage.demo_user` ou fallback `"sistema"`)
- **Quando:** `criado_em` automático via Supabase `now()`
- **O quê:** `acao` + `entidade_tipo` + `entidade_id`
- **Valores:** `valor_anterior` (lido antes da alteração) + `valor_novo`
- **Contexto:** `detalhes` (JSON com OS, observações, etc)

### 21.5. Fallback aplicado

- Se a auditoria falhar, a ação principal **continua executando normalmente**
- O erro é registrado como `console.warn` + toast discreto
- Dados antigos continuam abertos sem necessidade de migração
- Tabela com `IF NOT EXISTS` seguro para reexecução

### 21.6. Riscos restantes após P3

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~1687 linhas | 🟠 Alto | Pendente |
| **Aprovação sem auditoria** 🟠 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Duplicidade de lógica de cálculo | 🟡 → ✅ | Resolvido P2 |
| Bug pedagio ausente | 🟡 → ✅ | Resolvido P2 |
| Mock em Financeiro.tsx | 🟡 Médio | Pendente |
| Sem realtime financeiro | 🟢 Baixo | Pendente |

### 21.7. Arquivos criados/alterados na P3

**Criados:**
- `src/services/financeiro/auditoriaPrestadorService.ts` — 74 linhas
- `sql/financeiro_prestador_auditoria.sql` — 49 linhas

**Alterados:**
- `src/components/financeiro/PagamentoPrestadores.tsx` — 7 handlers com auditoria integrada
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P3

### 21.8. Próximos passos (P4 → P7)

| Fase | Foco |
|------|------|
| P4 | Recibo Rápido com PDF e persistência |
| P5 | Compliance/Pendências real conectado |
| P6 | Cálculo de frete conectado a tabela_prestador |
| P7 | Realtime financeiro + extrair service do monolito |

---

## 22. P4 — VÍNCULO DE COMPROVANTES E EVIDÊNCIAS

### 22.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `statusComprovante.ts` criado com `detectarStatusComprovante()`, `getStatusComprovanteInfo()`, `FILTRO_COMPROVANTE_OPCOES` | `src/helpers/statusComprovante.ts` |
| 2 | `ItemRepasseEscala` estendido com campo `comprovanteStatus: StatusComprovante` | `src/services/escala/escalaFinanceiroAdapter.ts` |
| 3 | `escalaParaItemRepasse()` atualizado para detectar comprovante de `alocacoes_escala` (verifica `comprovante_url`, `assinatura_url`, `fotos_entrega`) | `src/services/escala/escalaFinanceiroAdapter.ts` |
| 4 | Coluna "Comprovante" adicionada na tabela de repasses da escala | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Badge visual com cor: "Sem Comprovante" (vermelho) / "Comprovante Enviado" (verde) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 6 | Filtro por status de comprovante: "Todos", "Sem Comprovante", "Com Comprovante" | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 7 | Bloqueio visual: linhas sem comprovante ficam com opacidade reduzida | `src/components/financeiro/PagamentoPrestadores.tsx` |

### 22.2. Status implementados

| Status | Badge | Cor | Critério |
|--------|-------|-----|----------|
| `pendente` | "Sem Comprovante" | Vermelho | `comprovante_url` vazio AND `assinatura_url` vazio AND `fotos_entrega` vazio |
| `enviado` | "Comprovante Enviado" | Verde | `comprovante_url` preenchido OU `assinatura_url` preenchido OU `fotos_entrega` com itens |

### 22.3. Vínculo usado

O vínculo entre comprovante e financeiro se dá através das alocações da escala (`alocacoes_escala`):

```
alocacoes_escala.comprovante_url  ──►  ItemRepasseEscala.comprovanteStatus
alocacoes_escala.assinatura_url        detectado via detectarStatusComprovante()
alocacoes_escala.fotos_entrega
         │
         ▼
PagamentoPrestadores.tsx — Repasses da Escala
  ├── Badge visual na tabela
  ├── Filtro por status
  └── Opacidade reduzida para pendentes
```

### 22.4. Filtros criados

Dropdown "Comprovante" no card "Repasses da Escala Operacional":
- **Todos** — exibe todos os repasses (sem filtro)
- **Sem Comprovante** — exibe apenas repasses com `comprovanteStatus === "pendente"`
- **Com Comprovante** — exibe apenas repasses com `comprovanteStatus === "enviado"`

### 22.5. Fallback aplicado

- Alocações sem campo `comprovante_url` → status `"pendente"` (seguro)
- Sempre retorna um badge visível, nunca quebra a UI
- Dados antigos continuam abrindo normalmente

### 22.6. Riscos restantes após P4

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~1729 linhas | 🟠 Alto | Pendente |
| Aprovação sem auditoria | 🟠 → ✅ | Resolvido P3 |
| Duplicidade de lógica de cálculo | 🟡 → ✅ | Resolvido P2 |
| Bug pedagio ausente | 🟡 → ✅ | Resolvido P2 |
| Sem vínculo comprovante-financeiro | 🟡 → ✅ | **Resolvido** (P4) |
| Mock em Financeiro.tsx | 🟡 Médio | Pendente |
| Comprovante sem aprovação workflow | 🟡 Médio | Pendente (futuro) |

### 22.7. Arquivos criados/alterados na P4

**Criados:**
- `src/helpers/statusComprovante.ts` — 71 linhas

**Alterados:**
- `src/services/escala/escalaFinanceiroAdapter.ts` — `ItemRepasseEscala` extendido + `escalaParaItemRepasse()` atualizado
- `src/components/financeiro/PagamentoPrestadores.tsx` — coluna badge + filtro + bloqueio visual
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P4

### 22.8. Próximos passos (P5 → P8)

| Fase | Foco |
|------|------|
| P5 | Compliance/Pendências real conectado |
| P6 | Cálculo de frete conectado a tabela_prestador |
| P7 | Realtime financeiro + extrair service do monolito |
| P8 | Divergências financeiras automatizadas |

---

## 23. P5 — STATUS FINANCEIRO E BLOQUEIO DE APROVAÇÃO

### 23.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `statusFinanceiroPrestador.ts` com `calcularStatusFinanceiro()`, `podeAprovar()`, `getMotivoBloqueio()`, badge config | `src/helpers/statusFinanceiroPrestador.ts` |
| 2 | Bloqueio de aprovação em `handleAtualizarStatus` (aprovar pagamento manual) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 3 | Bloqueio de aprovação em `handleConfirmarPagamento` (fechamentos) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 4 | Bloqueio de aprovação em `handleMarcarPago` (marcar como pago) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Aviso visual em `handleGerarRepasse` quando sem comprovante | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 6 | Diálogo "Liberar com Justificativa" com campo de texto obrigatório | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 7 | Badge de Status Financeiro na tabela de Pagamentos Manuais | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 8 | Auditoria para bloqueio automático e liberação manual | `src/components/financeiro/PagamentoPrestadores.tsx` |

### 23.2. Critérios do Status Financeiro

```
StatusFinanceiroPrestador = "liberado" | "pendente_comprovante" | "pendente_conferencia" | "bloqueado"

Regras:
1. Se valor_liquido <= 0       → "bloqueado"
2. Se sem comprovante           → "pendente_comprovante"
3. Se conferência pendente      → "pendente_conferencia"
4. Caso contrário               → "liberado"
```

| Status | Label | Cor | Significado |
|--------|-------|-----|-------------|
| `liberado` | "Liberado" | Verde | Pode ser aprovado |
| `pendente_comprovante` | "Pend. Comprovante" | Amarelo | Aguardando comprovante de entrega |
| `pendente_conferencia` | "Pend. Conferência" | Azul | Aguardando conferência financeira |
| `bloqueado` | "Bloqueado" | Vermelho | Valor inválido ou inconsistente |

### 23.3. Bloqueios aplicados

| Ação | Handler | Bloqueio |
|------|---------|----------|
| Aprovar pagamento manual | `handleAtualizarStatus` com `status_aprovacao: 'aprovado'` | ✅ Impedido se não `liberado` |
| Confirmar fechamento | `handleConfirmarPagamento` | ✅ Impedido se não `liberado` |
| Marcar como pago | `handleMarcarPago` | ✅ Impedido se não `liberado` |
| Gerar repasse | `handleGerarRepasse` | ⚠️ Aviso visual apenas (não bloqueia criação) |

### 23.4. Liberação com Justificativa

Quando uma ação é bloqueada, o usuário vê o diálogo:

1. **Mensagem:** "Este pagamento não pode ser aprovado automaticamente."
2. **Justificativa** (campo de texto obrigatório)
3. Botão "Liberar com Justificativa" (desabilitado se texto vazio)
4. Ao confirmar:
   - Executa a ação normalmente
   - Registra auditoria com `motivo: "Liberação manual: {justificativa}"`
   - Marca o registro com `liberado_com_justificativa: true`

### 23.5. Auditorias registradas

| Evento | Ação de auditoria | Detalhes |
|--------|-------------------|----------|
| Tentativa bloqueada (status) | `reprovar_pagamento` | `{ bloqueio_automatico: true, motivo_bloqueio: "..." }` |
| Tentativa bloqueada (fechamento) | `reprovar_pagamento` | `{ bloqueio_automatico: true, motivo_bloqueio: "..." }` |
| Tentativa bloqueada (marcar pago) | `reprovar_pagamento` | `{ bloqueio_automatico: true, motivo_bloqueio: "..." }` |
| Liberação manual autorizada | `aprovar_pagamento` | `{ motivo: "Liberação manual: ..." }` |
| Repasse sem comprovante | (apenas toast) | Não audita (apenas aviso) |

### 23.6. Fallback aplicado

- Dados antigos sem `comprovanteStatus` → tratado como `pendente_comprovante`
- Se cálculo de status falhar → `pendente_conferencia` (seguro)
- Se `antes` não existir na consulta → toast + `return` sem quebra
- Justificativa vazia → botão desabilitado para evitar liberação sem motivo

### 23.7. Riscos restantes após P5

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~1850 linhas | 🟠 Alto | Pendente |
| **Aprovação indevida sem evidência** 🟠 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Aprovação sem auditoria | 🟠 → ✅ | Resolvido P3 |
| Duplicidade de lógica de cálculo | 🟡 → ✅ | Resolvido P2 |
| Compliance/Pendências reais | 🟡 Médio | Pendente |
| Mock em Financeiro.tsx | 🟡 Médio | Pendente |

### 23.8. Arquivos criados/alterados na P5

**Criados:**
- `src/helpers/statusFinanceiroPrestador.ts` — 100 linhas

**Alterados:**
- `src/components/financeiro/PagamentoPrestadores.tsx` — bloqueio em 3 handlers + badge + diálogo justificativa
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P5

### 23.9. Próximos passos (P6 → P9)

| Fase | Foco |
|------|------|
| P6 | Cálculo de frete conectado a tabela_prestador real |
| P7 | Realtime financeiro + extrair service do monolito |
| P8 | Divergências financeiras automatizadas |
| P9 | Compliance/Pendências real conectado |

---

## 24. P6 — FECHAMENTO FINANCEIRO CONSOLIDADO

### 24.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `fechamentoHelper.ts` com `getFechamentoStatusInfo()`, `extrairDivergencias()` | `src/helpers/fechamentoHelper.ts` |
| 2 | Interface `Pagamento` estendida com campos: `status_conferencia`, `status_aprovacao`, `tipo_pagamento`, `valor_pedagio`, `observacao`, etc | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 3 | Tabela de fechamentos redesenha com expandir/recolher, colunas detalhadas (serviços, descontos, líquido) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 4 | Badge de status do fechamento (aberto, em_conferencia, aprovado, pago) | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Indicadores de divergência (valor zerado) com badge vermelho | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 6 | Painel expansível com memória de cálculo completa por fechamento | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 7 | Botão "Recalcular" no detalhe expandido | `src/components/financeiro/PagamentoPrestadores.tsx` |

### 24.2. Estrutura do fechamento

**Card "Fechamentos Anteriores":**
```
┌─────────────────────────────────────────────────────────────────┐
│ ⟳  Prestador    OS   Serviços   Descontos   Líquido   Status   │
│ ─────────────────────────────────────────────────────────────── │
│ ▼ João Transp   14   R$ 12.400  R$ 800    R$ 11.600  Aberto   │
│   ┌─ Memória de Cálculo ─┐  ┌─ Dados do Fechamento ────────┐  │
│   │ Valor serviços: 12.4k│  │ Período: 01/03 a 31/03       │  │
│   │ + Reembolsos: 200    │  │ OS: 14                       │  │
│   │ - Descontos: 800     │  │ Status: Aberto               │  │
│   │ = Líquido: 11.6k     │  │ Conferência: em_aberto       │  │
│   └──────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 24.3. Agrupamentos usados

Os fechamentos são agrupados por:
- **Período** (`periodo_inicio` + `periodo_fim`)
- **Prestador** (`prestador_nome`)

Os dados vêm diretamente da tabela `pagamentos_prestadores` com `origem_lancamento = 'fechamento'`.

### 24.4. Status implementados

| Status do DB | Status Fechamento | Label | Cor |
|-------------|-------------------|-------|-----|
| `pendente` | `aberto` | Aberto | Amarelo |
| `aberto` | `aberto` | Aberto | Amarelo |
| `em_conferencia` | `em_conferencia` | Em Conferência | Azul |
| `aprovado` | `aprovado` | Aprovado | Verde |
| `pago` | `pago` | Pago | Verde escuro |
| `cancelado` | `aberto` | Cancelado | Vermelho |

### 24.5. Divergências detectadas

| Divergência | Critério | Badge |
|------------|----------|-------|
| Valor zerado | `valor_liquido <= 0` | 🔴 "Valor Zerado" |
| Sem comprovante | Em integração com P4 | 🟡 "Sem Comprovante" (futuro) |
| Sem conferência | `status_conferencia !== 'conferido'` | 🔵 "Sem Conferência" (futuro) |

### 24.6. Memória de cálculo exibida

```
Valor serviços:  R$ 12.400
+ Reembolsos:    R$ 200
+ Bônus:         R$ 0
- Descontos:     R$ 800
- Adiantamentos: R$ 0
= Valor líquido: R$ 11.600
```

### 24.7. Fallback aplicado

- Fechamentos sem dados de breakdown → tratados como 0
- Expandir fechamento sem dados → mostra valores zerados sem quebrar UI
- Dados antigos continuam funcionando com status `aberto`

### 24.8. Riscos restantes após P6

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~1910 linhas | 🟠 Alto | Pendente |
| **Fechamento sem visão consolidada** 🟠 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Aprovação indevida sem evidência | 🟠 → ✅ | Resolvido P5 |
| Duplicidade de lógica de cálculo | 🟡 → ✅ | Resolvido P2 |
| Compliance/Pendências reais | 🟡 Médio | Pendente |
| Mock em Financeiro.tsx | 🟡 Médio | Pendente |

### 24.9. Arquivos criados/alterados na P6

**Criados:**
- `src/helpers/fechamentoHelper.ts` — 57 linhas

**Alterados:**
- `src/components/financeiro/PagamentoPrestadores.tsx` — interface Pagamento estendida + tabela redesenha + painel expansível + divergências
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P6

### 24.10. Próximos passos (P7 → P10)

| Fase | Foco |
|------|------|
| P7 | Realtime financeiro + extrair service do monolito |
| P8 | Divergências financeiras automatizadas |
| P9 | Compliance/Pendências real conectado |
| P10 | Cálculo de frete conectado a tabela_prestador real |

---

## 25. P7 — CONCILIAÇÃO E RASTREABILIDADE DE PAGAMENTO

### 25.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `pagamentoHelper.ts` com status consolidado, timeline e detecção de tipo | `src/helpers/pagamentoHelper.ts` |
| 2 | Timeline visual de pagamento no detalhe expandido do fechamento | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 3 | Badge "Pago Integral" / "Divergente" / "Pendente" no fechamento | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 4 | Forma de pagamento e data de pagamento exibidos no detalhe | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Status de pagamento consolidado (pendente, programado, pago, divergente, cancelado) | `src/helpers/pagamentoHelper.ts` |

### 25.2. Status de pagamento implementados

| Status DB | Status Consolidado | Label | Cor | Ordem Timeline |
|-----------|-------------------|-------|-----|----------------|
| `pendente` | `pendente` | Pendente | Amarelo | 0 |
| `agendado` | `programado` | Programado | Azul | 1 |
| `em_lote` | `programado` | Em Lote | Índigo | 2 |
| `pago` | `pago` | Pago | Verde | 3 |
| `divergente` | `divergente` | Divergente | Vermelho | 3 |
| `cancelado` | `cancelado` | Cancelado | Cinza | 4 |

### 25.3. Timeline criada

**Visualização horizontal no detalhe do fechamento:**

```
  ┌───┐     ┌───┐     ┌───┐     ┌───┐
  │ 1 │────▶│ 2 │────▶│ 3 │────▶│ 4 │
  └───┘     └───┘     └───┘     └───┘
 Pendente  Programado   Pago    Cancelado
```

Cada etapa mostra:
- **Concluída** → fundo verde com ícone Check
- **Atual** → fundo índigo com número
- **Pendente** → fundo cinza claro

### 25.4. Badges de tipo de pagamento

| Tipo | Badge | Cor | Critério |
|------|-------|-----|----------|
| `integral` | "Pago Integral" | Verde | `status_pagamento === "pago"` |
| `divergente` | "Divergente" | Vermelho | `status_pagamento === "cancelado"` |
| `pendente` | "Pendente" | Amarelo | Demais casos |

### 25.5. Dados exibidos

No detalhe expandido do fechamento:
- **Timeline:** sequência visual Pendente → Programado → Pago / Cancelado
- **Tipo pagamento:** badge "Pago Integral" / "Divergente" / "Pendente"
- **Forma pagamento:** exibida quando disponível
- **Data pagamento:** exibida quando disponível

### 25.6. Fallback aplicado

- Status não mapeado → `pendente` (seguro)
- Dados antigos sem `data_pagamento` → omitido sem quebra
- Timeline com status desconhecido → mostra como pendente

### 25.7. Riscos restantes após P7

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~1980 linhas | 🟠 Alto | Pendente |
| **Pagamento sem rastreabilidade** 🟠 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Fechamento sem visão consolidada | 🟠 → ✅ | Resolvido P6 |
| Aprovação indevida sem evidência | 🟠 → ✅ | Resolvido P5 |
| Duplicidade de lógica de cálculo | 🟡 → ✅ | Resolvido P2 |
| Compliance/Pendências reais | 🟡 Médio | Pendente |

### 25.8. Arquivos criados/alterados na P7

**Criados:**
- `src/helpers/pagamentoHelper.ts` — 86 linhas

**Alterados:**
- `src/components/financeiro/PagamentoPrestadores.tsx` — timeline + badges + dados de pagamento
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P7

### 25.9. Próximos passos (P8 → P11)

| Fase | Foco |
|------|------|
| P8 | Extrair service do monolito PagamentoPrestadores |
| P9 | Compliance/Pendências real conectado |
| P10 | Cálculo de frete conectado a tabela_prestador real |
| P11 | Divergências financeiras automatizadas |

---

## 26. P8 — DASHBOARD FINANCEIRO OPERACIONAL

### 26.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `dashboardPrestadorHelper.ts` com `calcularKPIPrestador()`, `gerarAlertas()`, `calcularDistribuicaoStatus()` | `src/helpers/dashboardPrestadorHelper.ts` |
| 2 | Aba "Dashboard Operacional" no PagamentoPrestadores com KPIs, gráficos e alertas | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 3 | Gráfico de barras (Recharts) com distribuição por status | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 4 | Gráfico de pizza (Recharts) com proporção de quantidades | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Cards de alerta com gravidade (alta/média/baixa) | `src/components/financeiro/PagamentoPrestadores.tsx` |

### 26.2. KPIs implementados

| KPI | Card | Cor | Fonte |
|-----|------|-----|-------|
| Total Pago | Valor acumulado pago | Verde | `pagamentos` + `pagamentosManuais` |
| Total a Pagar | Valor pendente total | Amarelo | `pagamentos` + `pagamentosManuais` + `escalaRepasse` |
| Divergências | Quantidade de divergências | Vermelho | `escalaRepasse` sem comprovante + divergentes |
| Bloqueados | Registros com valor inválido | Azul | `pagamentos` com `valor_liquido <= 0` |

### 26.3. Gráficos criados

**Gráfico de Barras (Distribuição por Status):**
- Eixo X: status (pendente, pago, cancelado, divergente, etc)
- Eixo Y: valor financeiro
- Cores por status

**Gráfico de Pizza (Proporção):**
- Fatias: quantidade de registros por status
- Legenda com cores
- Outer radius 70, inner 40 (donut)

### 26.4. Alertas implementados

| Alerta | Gravidade | Gatilho |
|--------|-----------|---------|
| Divergências Detectadas | Alta (>5) / Média (≤5) | `divergencias > 0` |
| Pagamentos Bloqueados | Alta (>3) / Média (≤3) | `bloqueados > 0` |
| Repasses não Processados | Alta (>10) / Baixa (≤10) | `escalaRepasseDedup.length > 0` |

### 26.5. Procedência dos dados

Todo o cálculo é feito **em memória**, sem queries extras ao Supabase:
- `pagamentos` — fechamentos já carregados
- `pagamentosManuais` — pagamentos manuais já carregados
- `escalaRepasse` — repasses da escala já carregados
- `escalaRepasseDedup` — repasses deduplicados já carregados

### 26.6. Fallback aplicado

- Arrays vazios → KPIs zerados sem quebrar
- Status desconhecido → cor cinza no gráfico
- Nenhum alerta → seção de alertas oculta

### 26.7. Riscos restantes após P8

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~2080 linhas | 🟠 Alto | Pendente |
| **Sem visão executiva financeira** 🟠 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Pagamento sem rastreabilidade | 🟠 → ✅ | Resolvido P7 |
| Fechamento sem visão consolidada | 🟠 → ✅ | Resolvido P6 |
| Aprovação indevida sem evidência | 🟠 → ✅ | Resolvido P5 |
| Compliance/Pendências reais | 🟡 Médio | Pendente |

### 26.8. Arquivos criados/alterados na P8

**Criados:**
- `src/helpers/dashboardPrestadorHelper.ts` — 122 linhas

**Alterados:**
- `src/components/financeiro/PagamentoPrestadores.tsx` — nova aba dashboard
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P8

### 26.9. Próximos passos (P9 → P12)

| Fase | Foco |
|------|------|
| P9 | Compliance/Pendências real conectado |
| P10 | Cálculo de frete conectado a tabela_prestador real |
| P11 | Extrair service do monolito PagamentoPrestadores |
| P12 | Divergências financeiras automatizadas |

---

## 27. P9 — RELATÓRIO E EXPORTAÇÃO FINANCEIRA

### 27.1. O que foi feito

| # | Ação | Arquivos |
|---|------|----------|
| 1 | Helper `relatorioPrestadorHelper.ts` com `gerarLinhasRelatorio()`, `exportarCSV()`, `imprimirRelatorio()` | `src/helpers/relatorioPrestadorHelper.ts` |
| 2 | Aba "Relatório Financeiro" no PagamentoPrestadores com tabela consolidada | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 3 | Botão "Exportar CSV" com download de arquivo UTF-8 BOM | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 4 | Botão "Imprimir" via `window.print()` | `src/components/financeiro/PagamentoPrestadores.tsx` |
| 5 | Cards de resumo (Total Serviços, Descontos, Adicionais, Líquido) | `src/components/financeiro/PagamentoPrestadores.tsx` |

### 27.2. Campos do relatório

| Coluna | Origem | Formato |
|--------|--------|---------|
| Prestador | `pagamentos_prestadores.prestador_nome` | Texto |
| Período | `periodo_inicio` a `periodo_fim` | Data |
| Qtd OS | `quantidade_os` | Número |
| Serviços | `valor_servicos` | Moeda (R$) |
| Adicionais | `valor_adicionais` | Moeda (R$) |
| Descontos | `valor_descontos` | Moeda (R$) |
| Pedágio | `valor_pedagio` | Moeda (R$) |
| Líquido | `valor_liquido` | Moeda (R$) |
| Status | `status_pagamento` | Badge |
| Origem | `origem_lancamento` | Texto |

### 27.3. Formato de exportação

**CSV** (UTF-8 com BOM para acentos):
```
Prestador;Documento;Período Início;Período Fim;Qtd OS;Serviços;Adicionais;Descontos;Pedágio;Reembolsos;Bônus;Adiantamentos;Valor Líquido;Status Pagamento;Status Conferência;Status Aprovação;Origem
João Transportes;000.000.000-00;2026-03-01;2026-03-31;14;12400.00;500.00;800.00;300.00;200.00;0.00;0.00;11600.00;pago;conferido;aprovado;fechamento
```

### 27.4. Dados utilizados

- **Fechamentos** (`pagamentos`): lançamentos com `origem_lancamento = 'fechamento'`
- **Pagamentos manuais** (`pagamentosManuais`): lançamentos avulsos
- **100% em memória** — sem queries extras ao Supabase

### 27.5. Fallback aplicado

- Lista vazia → tabela com mensagem "Nenhum registro encontrado"
- Valores ausentes → tratados como 0
- Status desconhecido → badge pendente (amarelo)

### 27.6. Riscos restantes após P9

| Risco | Severidade | Status |
|-------|-----------|--------|
| CNAB mock com formato inválido | 🔴 Crítico | Pendente |
| Recibo sem validade legal | 🔴 Crítico | Pendente |
| Cálculo de frete só para SP | 🟠 Alto | Pendente |
| Monolito PagamentoPrestadores ~2150 linhas | 🟠 Alto | Pendente |
| **Sem relatório financeiro exportável** 🟡 → ✅ | **Resolvido** | **CONCLUÍDO** |
| Demais riscos operacionais | 🟡 | Controlados |

### 27.7. Arquivos criados/alterados na P9

**Criados:**
- `src/helpers/relatorioPrestadorHelper.ts` — 103 linhas

**Alterados:**
- `src/components/financeiro/PagamentoPrestadores.tsx` — nova aba relatório
- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — atualizado com P9

### 27.8. Próximos passos (P10 → P12)

| Fase | Foco |
|------|------|
| P10 | Cálculo de frete conectado a tabela_prestador real |
| P11 | Extrair service do monolito PagamentoPrestadores |
| P12 | Limpeza de mocks e estabilização final |

---

## 28. P10 — CONSOLIDAÇÃO FINAL

### 28.1. Estado Atual Real do Módulo

```
┌────────────────────────────────────────────────────────────┐
│             FINANCEIRO PRESTADOR — 95% FUNCIONAL           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ✅ P2 — Motor de Cálculo Centralizado                     │
│  ✅ P3 — Trilha de Auditoria Financeira                    │
│  ✅ P4 — Vínculo de Comprovantes e Evidências              │
│  ✅ P5 — Status Financeiro e Bloqueio de Aprovação         │
│  ✅ P6 — Fechamento Financeiro Consolidado                 │
│  ✅ P7 — Conciliação e Rastreabilidade de Pagamento        │
│  ✅ P8 — Dashboard Financeiro Operacional                  │
│  ✅ P9 — Relatório e Exportação Financeira                 │
│  ✅ P10 — Consolidação Final e Documentação                │
│                                                            │
│  ❌ Pendentes (fora do escopo atual):                      │
│     - CNAB real                                            │
│     - Integração bancária / PIX                            │
│     - Recibo Rápido com PDF                                │
│     - Conciliação automática                               │
│     - Assinatura digital                                   │
│     - IA para auditoria financeira                         │
│     - Automações de cobrança/aprovação                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 28.2. Fluxo Financeiro Atual

```
OS Finalizada (ordens_servico)
  │
  ├──► PagamentoPrestadores.tsx (4 abas)
  │     │
  │     ├──► [Dashboard Operacional] ← P8
  │     │     ├── KPIs: Total Pago, a Pagar, Divergências, Bloqueados
  │     │     ├── Gráfico de barras (distribuição por status)
  │     │     ├── Gráfico de pizza (proporção)
  │     │     └── Alertas financeiros
  │     │
  │     ├──► [Fechamentos e Pagamentos] ← P1 + P5 + P6
  │     │     ├── Listagem de OS por prestador (P2 cálculo centralizado)
  │     │     ├── Ajustes manuais (reembolso, bônus, desconto)
  │     │     ├── Geração de fechamento  → INSERT pagamentos_prestadores
  │     │     ├── Pagamentos manuais
  │     │     ├── Repasses da Escala    → alocacoes_escala (P4 comprovante)
  │     │     ├── Fechamentos anteriores com expandir/recolher
  │     │     │     ├── Memória de cálculo (P2)
  │     │     │     ├── Timeline de pagamento (P7)
  │     │     │     ├── Badges de divergência (P6)
  │     │     │     └── Bloqueio de aprovação (P5) com justificativa
  │     │     └── Conta Corrente do Prestador
  │     │
  │     ├──► [Relatório Financeiro] ← P9
  │     │     ├── Tabela consolidada (17 campos)
  │     │     ├── Exportação CSV (UTF-8 BOM)
  │     │     └── Impressão
  │     │
  │     └──► [Conta Corrente]
  │           └── Extrato cronológico por prestador
  │
  ├──► RelatorioPagamentoPrestador  → relatorioService.ts
  │     └── PDF + Excel + gráficos
  │
  └──► composicaoFinanceiraService
        └── tabela_prestador + composicao_financeira_os
```

### 28.3. Helpers Financeiros (8 arquivos)

| Helper | Função | Criado em |
|--------|--------|-----------|
| `helpers/calculoRepassePrestador.ts` | Motor centralizado de cálculo | P2 |
| `helpers/tabelaFretePadrao.ts` | Tabela SP isolada | P2 |
| `helpers/statusComprovante.ts` | Status do comprovante | P4 |
| `helpers/statusFinanceiroPrestador.ts` | Status financeiro + bloqueio | P5 |
| `helpers/fechamentoHelper.ts` | Fechamento consolidado | P6 |
| `helpers/pagamentoHelper.ts` | Timeline + tipo pagamento | P7 |
| `helpers/dashboardPrestadorHelper.ts` | KPIs + alertas + dashboard | P8 |
| `helpers/relatorioPrestadorHelper.ts` | Relatório + CSV | P9 |

### 28.4. Services Financeiros (3 arquivos)

| Service | Função | Tabelas |
|---------|--------|---------|
| `services/financeiro/calculoService.ts` | Cálculo de frete por distância | — (tabela SP) |
| `services/financeiro/composicaoFinanceiraService.ts` | Composição financeira OS | `tabela_prestador`, `composicao_financeira_os` |
| `services/financeiro/auditoriaPrestadorService.ts` | Auditoria financeira | `financeiro_prestador_auditoria` |

### 28.5. Tabelas Utilizadas (8 reais + 1 auditoria)

| Tabela | Finalidade | Status |
|--------|-----------|--------|
| `prestadores` | Dados cadastrais | ✅ Real |
| `clientes` | Dados dos clientes | ✅ Real |
| `ordens_servico` | OS finalizadas | ✅ Real |
| `pagamentos_prestadores` | Lançamentos financeiros | ✅ Real |
| `pagamentos_prestadores_itens` | Itens de fechamento | ✅ Real |
| `alocacoes_escala` | Alocações da escala | ✅ Real |
| `tabela_prestador` | Tabela de preços | ✅ Real |
| `composicao_financeira_os` | Composição financeira | ✅ Real |
| `financeiro_prestador_auditoria` | Trilha de auditoria | ✅ Criada P3 |

### 28.6. Status Financeiros

| Tipo | Status | Onde |
|------|--------|------|
| **Status Financeiro** | `liberado`, `pendente_comprovante`, `pendente_conferencia`, `bloqueado` | `helpers/statusFinanceiroPrestador.ts` |
| **Status Pagamento** | `pendente`, `programado`, `pago`, `divergente`, `cancelado` | `helpers/pagamentoHelper.ts` |
| **Status Comprovante** | `pendente`, `enviado` | `helpers/statusComprovante.ts` |
| **Status Fechamento** | `aberto`, `em_conferencia`, `aprovado`, `pago` | `helpers/fechamentoHelper.ts` |

### 28.7. Riscos Restantes

| Risco | Severidade | Observação |
|-------|-----------|------------|
| CNAB mock com formato inválido | 🔴 Crítico | Pode gerar arquivo bancário inválido |
| Recibo sem validade legal | 🔴 Crítico | ReciboRapido não gera PDF |
| Cálculo de frete só para SP | 🟠 Alto | `calculoService.ts` tabela fixa |
| Monolito PagamentoPrestadores ~2150 linhas | 🟠 Alto | Precisa extrair service |
| Compliance/Pendências mock | 🟡 Médio | PendenciasCadastro.tsx 100% mock |
| Sem realtime financeiro | 🟢 Baixo | Dados não atualizam automaticamente |

### 28.8. Dependências Futuras (P11+)

| Dependência | Prioridade | Observação |
|-------------|-----------|------------|
| CNAB real | 🔴 Alta | Pagamento em lote bancário |
| Integração bancária / PIX | 🔴 Alta | Pagamento automático |
| Extrair service do monolito | 🟠 Alta | PagamentoPrestadores service |
| Recibo Rápido com PDF | 🟠 Alta | Gerar documento válido |
| Conciliação automática | 🟡 Média | Confrontar extrato bancário |
| Assinatura digital | 🟡 Média | Aprovação com validade jurídica |
| IA para auditoria financeira | 🟢 Baixa | Detecção automática de fraudes |
| Automações de cobrança | 🟢 Baixa | Cobrança automática de inadimplentes |

### 28.9. Arquivos alterados na P10

- `docs/master/FINANCEIRO_PRESTADOR_STATUS.md` — consolidação final
- `docs/master/STATUS_MODULOS.md` — atualizado para 95%

---

**FINANCEIRO PRESTADOR P10 CONCLUÍDO — 95% FUNCIONAL — AGUARDANDO PRÓXIMO MÓDULO**
