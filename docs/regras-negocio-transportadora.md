# REGRAS DE NEGÓCIO — TRANSPORTADORA
## Express Connect Hub / TMS
**Data:** 26/06/2026  
**Versão:** 1.1

---

## 1. ORÇAMENTO → ORDEM DE SERVIÇO

### RN01 — Geração de OS a partir de Orçamento
- Um orçamento com status `aprovado` pode ser convertido em Ordem de Serviço.
- Após a conversão, o orçamento recebe status `convertido` e não pode ser convertido novamente.
- A OS gerada herda: cliente, endereços (coleta/entrega), dados de carga, valores financeiros, tipo de veículo.
- O número da OS segue o formato `OS-AAAAMM-NNNNNN` (sequencial por mês).
- A OS é criada com status `rascunho`.

### RN02 — Dupla Verificação de Conversão
- Antes de converter, o sistema verifica se o orçamento já possui OS vinculada:
  1. Consulta `ordens_servico.orcamento_id` (se coluna existir)
  2. Consulta `orcamentos.os_vinculada_id` (fallback)
- Se OS já existir, retorna erro e não duplica.

---

## 2. ORDEM DE SERVIÇO

### RN03 — Status da OS
Sequência de status: `rascunho → pendente → agendada → em_andamento/em_rota → finalizada → concluída`
Status alternativos: `cancelada`, `ocorrencia`

### RN04 — Finalização Financeira Automática
- Ao finalizar uma OS (status = `finalizada`), o sistema AUTOMATICAMENTE:
  1. Cria/atualiza `financeiro_receber` com valor do cliente
  2. Cria/atualiza `pagamentos_prestadores` com valor do prestador
  3. Cria/atualiza `composicao_financeira_os` com margem calculada
- A sincronização usa upsert: se registro já existe para a OS, atualiza; caso contrário, cria.
- A composição financeira considera: receita, custo, pedágio, impostos (4.5%), seguro (1%).

### RN05 — Cancelamento de OS
- OS cancelada → `financeiro_receber.status = "cancelado"`, `valor = 0`
- OS cancelada → `pagamentos_prestadores.status = "cancelado"`, `valor = 0`
- OS cancelada → composição financeira NÃO é alterada automaticamente (deficiência conhecida)

---

## 3. ESCALA OPERACIONAL

### RN06 — Conflito de Escala (BLOQUEANTE)
- Mesmo **prestador** não pode ter duas alocações ativas na mesma data.
- Mesmo **veículo** (placa) não pode ter duas alocações ativas na mesma data.
- Mesmo **motorista** não pode ter duas alocações ativas na mesma data. *(Pendente: coluna motorista_id não existe na tabela)*
- Status considerados "ativos": `planejada`, `aguardando_aceite`, `aceita`, `em_rota`.
- Alocações canceladas ou concluídas NÃO geram conflito.

### RN07 — Sincronização OS ↔ Escala
- Ao criar/atualizar OS com `prestador_id`, `data` e `tipo_veiculo`, o sistema cria/atualiza automaticamente uma alocação na escala.
- Ao criar/atualizar alocação na escala, o sistema atualiza a OS vinculada (status, valores, prestador).
- A sincronização é bidirecional, com mapeamento de status entre os dois domínios.

### RN08 — Ciclo de Vida da Alocação
`planejada → aguardando_aceite → aceita/recusada → em_rota → concluida`
- Apenas prestador pode aceitar/recusar (via App Prestador).
- Apenas sistema pode cancelar.
- Ao concluir, dados de finalização (km, horários, comprovantes) são registrados.

---

## 4. FINANCEIRO

### RN09 — Composição Financeira
Toda OS finalizada gera composição financeira com:
- `valor_cliente`: receita bruta
- `valor_prestador`: custo do transporte
- `pedagio_valor`: despesa de pedágio
- `imposto_percentual`: padrão 4.5% (PIS/COFINS/ISS)
- `imposto_valor`: valor_cliente × imposto_percentual / 100
- `seguro_valor`: padrão 1% do valor_cliente
- `margem_bruta`: valor_cliente - valor_prestador - pedagio
- `margem_liquida`: margem_bruta - impostos - seguro

### RN10 — Faturamento (Contas a Receber)
- Criado com status `aberto` e vencimento em 30 dias.
- Vinculado à OS via `os_id`.
- Ao receber pagamento, status muda para `pago`.
- Se OS cancelada, status muda para `cancelado`.

### RN11 — Pagamento a Prestadores
- Criado com status `pendente` e vencimento em 15 dias.
- Vinculado à OS via `os_id`.
- Se OS cancelada, status muda para `cancelado`.

---

## 5. DASHBOARD E RELATÓRIOS

### RN12 — Fonte de Dados do Dashboard
- **TabExecutivo**: calcula margem diretamente de `OS.valor_cliente - OS.custo_prestador` (simplificado).
- **TabFinanceiro**: calcula margem de `financeiro_receber - financeiro_pagar` (simplificado).
- **MargemOperacional**: usa `composicao_financeira_os.margem_liquida` (CORRETO).
- **Regra**: A fonte CORRETA de margem é `composicao_financeira_os`. As abas do dashboard devem migrar para esta fonte.

### RN13 — Filtro de Período
- DashboardTopbar possui filtros de período (hoje/semana/mês/trimestre) e unidade.
- **REGRÃO**: Todas as queries das abas DEVEM respeitar estes filtros.
- **Status**: ✅ CORRIGIDO via `DashboardFilterContext` (26/06/2026). Filtros propagados para TabExecutivo, TabOperacional e TabFinanceiro.

---

## 6. PORTAL CLIENTE

### RN14 — Isolamento de Dados
- Cliente autenticado vê APENAS seus próprios dados.
- Resolução de `clienteId`:
  1. Supabase Auth → `usuarios_cliente` (seguro)
  2. Fallback: localStorage (demo users)
  3. Fallback final: busca por nome do usuário (legado)
- Todas as queries filtram por `cliente_id`.

### RN15 — Criação de Pedido
- Cliente pode criar pedidos no portal (solicitação de serviço).
- Pedido é registrado em `portal_pedidos` ou `ordens_servico`.
- Cliente pode anexar endereços favoritos (armazenados em localStorage).

---

## 7. CADASTROS

### RN16 — Tipos de Veículo Válidos
`moto, passeio, fiorino, kangoo, kombi, van, vuc, hr, 3_4, toco, truck, carreta, bitrem, outro`

### RN17 — Tabela de Prestador
Prioridade de busca:
1. prestador_id + tipo_veiculo + cidade + uf
2. prestador_id + tipo_veiculo + regiao
3. prestador_id + tipo_veiculo (genérico)
4. tipo_veiculo + cidade + uf
5. tipo_veiculo + regiao
6. tipo_veiculo (genérico)

---

## 8. CENTRAL IA

### RN18 — Automação com Segurança
- Conectores em `HOMOLOGACAO`: execução simulada (retorna `{status: "simulado"}`)
- Conectores em `PRODUCAO_ASSISTIDA`: execução real + aprovação humana necessária
- Conectores em `PRODUCAO_AUTONOMA`: execução real direta (com limites diários)
- Action Engine consulta `montarContextoCompleto()` da memória corporativa antes de executar ações.

---

## 9. BLOQUEIO POR INADIMPLÊNCIA

### RN19 — Verificação de Inadimplência Antes de Criar OS
- **BLOQUEANTE**: Não é permitido criar Ordem de Serviço para cliente inadimplente.
- **Critério de inadimplência**: cliente com pelo menos 1 título em `financeiro_receber` com status `aberto`/`vencido`/`atrasado`, vencido há **mais de 30 dias**, e valor total em aberto **>= R$ 100**.
- **Onde o bloqueio é aplicado**:
  1. `OrdemServicoForm.tsx` — formulário principal de criação de OS
  2. `orcamentoToOSService.ts` — conversão de orçamento aprovado em OS
  3. `OrcamentoForm.tsx` — função `gerarOS()` interna do formulário de orçamento
- **Comportamento**: toast de erro + `return` (não salva) no frontend; `throw Error` + `{success:false, erro}` no backend.
- **Serviço**: `src/services/financeiro/inadimplenciaService.ts` com funções `verificarInadimplenciaCliente()` e `verificarInadimplenciaEName()`.

---

## GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| OS | Ordem de Serviço |
| TMS | Transport Management System |
| RN | Regra de Negócio |
| RLS | Row Level Security (Supabase) |
| P0/P1/P2/P3 | Prioridade (0=crítico, 3=melhoria) |
| EBITDA | Lucro operacional antes de juros, impostos, depreciação |
| DRE | Demonstração do Resultado do Exercício |
| CNAB | Padrão de arquivo para remessas bancárias |
