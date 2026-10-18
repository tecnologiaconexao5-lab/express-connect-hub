# PROCESSO OPERACIONAL DE TRANSPORTADORA — Mapeamento vs Sistema

**Data:** 26/06/2026  
**Objetivo:** Mapear o fluxo completo de uma transportadora profissional e comparar com a implementação atual do Express Connect Hub.

---

## FLUXO COMPLETO (Referência Mercado)

```
PRÉ-OPERAÇÃO
─────────────────────────────────────────
1. Captação de Cliente (CRM)
2. Negociação / Proposta Comercial
3. Tabela de Valores / Contrato Comercial
4. Cadastro do Cliente
5. Cadastro de Prestadores / Motoristas
6. Cadastro de Veículos
7. Contratos de Prestadores (TAC/ETC)
8. Configuração de Rotas / Regiões

OPERAÇÃO
─────────────────────────────────────────
9.  Solicitação de Serviço (Cliente → TMS)
10. Análise e Programação
11. Criação da Ordem de Serviço
12. Alocação de Frota / Escala
13. Notificação ao Prestador/Motorista
14. Aceite do Prestador (via App)
15. Roteirização / Otimização
16. Emissão de CT-e (antes da viagem)
17. Checklist de Partida
18. Início da Viagem (check-in geolocalizado)
19. Tracking em Tempo Real
20. Coleta (comprovante)
21. Trânsito / Monitoramento de Ocorrências
22. Entrega / POD (foto + assinatura)
23. Finalização da OS
24. Emissão de NFS-e / Faturamento
25. Envio de Documentos ao Cliente

PÓS-OPERAÇÃO
─────────────────────────────────────────
26. Faturamento (boleto, pix, carteira)
27. Contas a Receber / Cobrança
28. Pagamento a Prestadores
29. Conciliação Bancária
30. Apuração de Impostos
31. DRE / Resultado por OS
32. SLA / Indicadores de Qualidade
33. Logística Reversa (se aplicável)
34. Gestão de Sinistros (seguros)
35. Relatórios Gerenciais
36. Fechamento Mensal

GESTÃO DE FROTA (Contínuo)
─────────────────────────────────────────
37. Abastecimento e Km/L
38. Manutenção Preventiva
39. Documentos e Licenciamento
40. Seguros dos Veículos
41. Custos por Veículo
42. Pneus e Peças

GESTÃO DE SEGUROS (Contínuo)
─────────────────────────────────────────
43. Apólices por Cliente/Rota
44. Averbação Automática
45. Regras DDR por Cliente
46. Sinistros / Regulação
```

---

## MATRIZ DE COBERTURA — SISTEMA × PROCESSO

| # | Etapa | Status | % Cobertura | Observação |
|:-:|-------|--------|:-:|-----------|
| 1 | CRM / Captação | 🟡 Funcional | 80% | Kanban 8 estágios, timeline, integração WhatsApp. Fallback mock é preocupante. |
| 2 | Proposta Comercial | 🟡 Funcional | 70% | Editor de proposta existe mas pipeline não integra automaticamente. |
| 3 | Tabela de Valores | 🟡 Parcial | 60% | Estrutura excelente, mas faixas não implementadas no motor de cálculo. |
| 4 | Cadastro Cliente | 🟢 OK | 90% | CRUD completo com endereço, fiscal, contatos. |
| 5 | Cadastro Prestadores | 🟢 OK | 85% | Completo com documentos, financeiro, contrato. |
| 6 | Cadastro Veículos | 🟢 OK | 80% | CRUD existe, mas sem integração com manutenção real. |
| 7 | Contratos Prestadores | 🟢 OK | 85% | PDF profissional, assinatura canvas, 30+ variáveis. Sem vigência. |
| 8 | Config. Rotas/Regiões | 🟡 Parcial | 50% | Cadastro de regiões existe mas não integrado com cálculo de frete. |
| 9 | Solicitação Serviço | 🟡 Funcional | 70% | Portal Cliente permite criar pedidos. Mas sem criação automática de OS. |
| 10 | Análise/Programação | 🟡 Funcional | 60% | Operador vê solicitações e digita número de OS manualmente. |
| 11 | Criação OS | 🟢 OK | 85% | **Destaque do sistema.** Formulário completo, 80+ campos, 6 abas. |
| 12 | Alocação/Escala | 🟡 Parcial | 60% | CRUD funcional, mas alocação automática é `Math.random()`. |
| 13 | Notificação Prestador | 🟡 Funcional | 70% | Envio WhatsApp implementado, mas templates são fixos. |
| 14 | Aceite via App | 🟡 Funcional | 60% | AppPrestador permite aceitar. Mas app real é PWA Flutter não integrado. |
| 15 | Roteirização | 🟡 Parcial | 55% | Algoritmo existe, dados de entrada são mockados. Sem integração OS. |
| 16 | Emissão CT-e | 🔴 Bloqueado | 30% | Rascunho excelente. Emissão real bloqueada (certificado, Focus). |
| 17 | Checklist Partida | ⚫ Inexiste | 0% | Não implementado. |
| 18 | Check-in Geolocalizado | 🟡 Parcial | 40% | AppPrestador tem check-in, mas sem coordenadas GPS. |
| 19 | Tracking Tempo Real | 🔴 Placeholder | 10% | Modal vazio: "aguardando integração com app." |
| 20 | Coleta Comprovante | 🟡 Parcial | 50% | App registra, mas sem workflow dedicado. |
| 21 | Monitoramento Ocorrências | 🔴 Mockado | 10% | 100% mock. Dados morrem ao recarregar. |
| 22 | POD | 🟡 Parcial | 50% | Serviço real existe. UI é estática e não usa o serviço. |
| 23 | Finalização OS | 🟢 OK | 80% | Trigger de propagação financeira é excelente. |
| 24 | Emissão NFS-e | 🔴 Bloqueado | 15% | Rascunho existe. Emissão real não implementada. |
| 25 | Envio Documentos | 🟡 Parcial | 40% | Templates WhatsApp/email existem. Sem automação real. |
| 26 | Faturamento | 🟡 Parcial | 50% | Wizard de faturamento consolidado existe. Sem boleto real. |
| 27 | Contas a Receber | 🟡 Funcional | 70% | Baixa manual. Sem conciliação. Cobrança não automatizada. |
| 28 | Pagamento Prestadores | 🔴 Parcial | 40% | CNAB é fake. Pagamento em lote impossível. |
| 29 | Conciliação Bancária | 🔴 Mockado | 5% | 100% simulado. Não existe. |
| 30 | Apuração Impostos | 🔴 Inexiste | 0% | Impostos são chutados no DRE. Sem apuração real. |
| 31 | DRE / Resultado | 🔴 Fabricado | 10% | 90% dos valores são estimados. Não confiável. |
| 32 | SLA / Qualidade | 🔴 Mockado | 10% | Valores hardcoded. Não consulta banco. |
| 33 | Logística Reversa | ⚫ Inexiste | 0% | Não implementada. |
| 34 | Sinistros/Seguros | 🔴 Mockado | 10% | 100% mock. Sem persistência. |
| 35 | Relatórios Gerenciais | 🟡 Parcial | 30% | Exportador básico existe. Relatórios deep dive não. |
| 36 | Fechamento Mensal | 🔴 Inexiste | 0% | Não há workflow de fechamento. |
| 37 | Abastecimento | 🔴 Mockado | 5% | Dados fixos em HTML. |
| 38 | Manutenção Preventiva | 🔴 Mockado | 5% | Dados fixos em HTML. |
| 39 | Documentos Veículo | 🔴 Mockado | 5% | Datas fixas. Sem alerta real. |
| 40 | Seguros Veículo | 🔴 Mockado | 5% | Mock visual. |
| 41 | Custos por Veículo | 🔴 Mockado | 5% | Mock visual. |
| 42 | Pneus | ⚫ Inexiste | 0% | Não implementado. |
| 43 | Apólices Cliente | 🔴 Mockado | 10% | Mock visual. |
| 44 | Averbação | 🔴 Simulado | 20% | Código existe mas `Math.random()`. |
| 45 | Regras DDR | 🟡 Parcial | 30% | Interface mock, sem engine. |
| 46 | Sinistros/Seguros | 🔴 Mockado | 10% | Mock visual. |

---

## GAPS CRÍTICOS NO FLUXO

### Gap #1 — Ausência de Workflow de Aprovação
O sistema não tem aprovação hierárquica. Qualquer usuário pode:
- Criar orçamentos de qualquer valor
- Aprovar orçamentos
- Criar/finalizar OS
- Dar baixa em contas a receber

**Necessário:** Workflow com níveis (operador → coordenador → diretor) baseado em valor/risco.

### Gap #2 — Falta de Integração entre Módulos
- Roteirizador não cria OS
- Orçamento não valida disponibilidade de frota
- OS não valida se veículo está disponível
- Financeiro não valida se CT-e foi emitido
- SLA não consulta entregas reais

**Necessário:** Integração bidirecional entre todos os módulos.

### Gap #3 — Documentação Fiscal não Gera Faturamento
CT-e e NFS-e são módulos isolados. Quando um documento é emitido, não cria automaticamente a conta a receber.

**Necessário:** Trigger: CT-e autorizado → cria financeiro_receber.

### Gap #4 — Sem Fechamento Contábil/Mensal
Não existe processo de:
- Fechamento de caixa
- Conciliação de contas
- Apuração de resultados do mês
- Geração de obrigações acessórias

**Necessário:** Workflow de fechamento mensal.

### Gap #5 — Sem Controle de Jornada de Motoristas
O sistema não controla:
- Horas trabalhadas por motorista
- Intervalos de descanso obrigatórios (Lei do Motorista)
- Violação de jornada

**Necessário:** Módulo de jornada com alertas de violação.

---

## O QUE UMA TRANSPORTADORA PROFISSIONAL ESPERA

### Expectativas Mínimas (GO-LIVE):
- ✅ OS com ciclo completo
- ✅ Escala com alocação e tracking
- ✅ CT-e emitido e transmitido
- ✅ NFS-e emitida e transmitida
- ✅ Contas a receber com baixa
- ✅ Pagamento a prestadores (CNAB)
- ✅ Conciliação bancária
- ✅ DRE confiável
- ✅ Frota com manutenção/abastecimento
- ✅ Seguros com averbação

### Expectativas Diferenciais:
- ⭐ Tracking em tempo real
- ⭐ App do motorista
- ⭐ Portal do cliente white-label
- ⭐ IA para alocação inteligente
- ⭐ Dashboard executivo real
- ⭐ Relatórios gerenciais exportáveis

### Status Atual:
- Expectativas mínimas: **45% atendidas**
- Expectativas diferenciais: **20% atendidas**
- **Conclusão:** Sistema precisa de 3-4 meses para atingir nível profissional.
