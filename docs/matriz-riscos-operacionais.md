# MATRIZ DE RISCOS OPERACIONAIS — Express Connect Hub / TMS

**Data:** 26/06/2026  
**Classificação:** Probabilidade × Impacto  
**Avaliador:** Diretoria de Operações e Riscos

---

## METODOLOGIA

**Probabilidade:** 1 (Rara) a 5 (Quase Certa)  
**Impacto:** 1 (Insignificante) a 5 (Catastrófico)  
**Risco:** P × I (1-25)  
**Prioridade:** Crítico (15-25), Alto (10-14), Médio (5-9), Baixo (1-4)

---

## RISCOS OPERACIONAIS

| ID | Risco | Descrição | P | I | R | Prioridade |
|:--:|-------|-----------|:-:|:-:|:-:|:----------:|
| R01 | **Vazamento de dados por RLS aberto** | Anon key exposta permite ler/escrever em todas as tabelas | 5 | 5 | **25** | 🔴 Crítico |
| R02 | **OS criada sem prestador/veículo válido** | IA cria OS sem validar FK → operação sem recurso alocado | 4 | 5 | **20** | 🔴 Crítico |
| R03 | **OS finalizada sem serviço executado** | IA pode marcar "concluída" sem POD ou tracking | 3 | 5 | **15** | 🔴 Crítico |
| R04 | **Multa por ICMS incorreto** | Alíquota fixa de 12% independente da UF | 4 | 4 | **16** | 🔴 Crítico |
| R05 | **CT-e não transmitido (SEFAZ offline)** | Sem contingência, operação para | 3 | 5 | **15** | 🔴 Crítico |
| R06 | **NFS-e não emitida** | Serviço sem nota fiscal → sonegação | 4 | 4 | **16** | 🔴 Crítico |
| R07 | **Pagamento a prestador incorreto** | CNAB fake → valor errado ou não pago | 4 | 4 | **16** | 🔴 Crítico |
| R08 | **Decisão baseada em DRE falso** | 90% dos valores são estimados | 5 | 3 | **15** | 🔴 Crítico |
| R09 | **Desvio financeiro não detectado** | Conciliação mock → diferenças não aparecem | 3 | 5 | **15** | 🔴 Crítico |
| R10 | **Veículo sem manutenção quebra** | Frota mock → sem alerta de preventiva | 4 | 4 | **16** | 🔴 Crítico |
| R11 | **Carga não segurada** | Seguro mock → sem averbação real | 4 | 5 | **20** | 🔴 Crítico |
| R12 | **Sinistro sem acionamento** | Sinistros mock → seguradora não notificada | 3 | 5 | **15** | 🔴 Crítico |
| R13 | **IA cria 10.000 OSs indevidas** | Sem rate limit por minuto/hora | 2 | 5 | **10** | 🟡 Alto |
| R14 | **IA aprova pagamento sem autorização** | Agente autônomo + ferramenta financeira sem governança | 3 | 4 | **12** | 🟡 Alto |
| R15 | **Ocorrência importante perdida** | Dados mock → recarrega página e perde | 5 | 2 | **10** | 🟡 Alto |
| R16 | **Cliente insatisfeito sem tracking** | Tracking placeholder → cliente não vê carga | 4 | 2 | **8** | 🟢 Médio |
| R17 | **POD não conferido** | UI estática → operador acha que POD está OK | 3 | 3 | **9** | 🟢 Médio |
| R18 | **Escala automática inútil** | `Math.random()` → gera alocações fictícias | 4 | 2 | **8** | 🟢 Médio |
| R19 | **Contrato vigente vencido** | Sem controle de vigência → prestador opera irregular | 3 | 3 | **9** | 🟢 Médio |
| R20 | **Multa por atraso na entrega sem registro** | SLA mock → não mede performance real | 4 | 2 | **8** | 🟢 Médio |
| R21 | **Cliente inadimplente continua operando** | Inadimplência mock → não bloqueia | 3 | 3 | **9** | 🟢 Médio |
| R22 | **Fluxo de caixa otimista** | Vencido tratado como realizado | 4 | 2 | **8** | 🟢 Médio |
| R23 | **Cobrança indevida por tarifa errada** | Simulador didático → valor incorreto | 3 | 3 | **9** | 🟢 Médio |
| R24 | **Abastecimento fraudulento** | Sem controle de km/L → desvio não detectado | 4 | 3 | **12** | 🟡 Alto |
| R25 | **Equipe superestima capacidade do sistema** | Módulos mock parecem funcionais na UI | 4 | 3 | **12** | 🟡 Alto |

---

## RISCOS FINANCEIROS DETALHADOS

| ID | Risco | Cenário | Perda Estimada (R$) |
|:--:|-------|---------|:-------------------:|
| RF01 | Pagamento duplicado por falta de conciliação | Mesmo boleto pago 2x | 5.000 - 50.000 |
| RF02 | Multa fiscal por ICMS incorreto | Diferença de alíquota + juros | 10.000 - 100.000 |
| RF03 | Multa fiscal por NFS-e não emitida | Sonegação fiscal | 15.000 - 75.000 |
| RF04 | Prejuízo por carga não segurada | Acidente sem seguro | 50.000 - 500.000 |
| RF05 | Desvio de combustível não detectado | Abastecimento sem controle | 2.000 - 20.000/mês |
| RF06 | Perda por cliente inadimplente | Sem bloqueio automático | 10.000 - 100.000 |
| RF07 | Quebra de veículo por manutenção atrasada | Motor fundido, câmbio quebrado | 15.000 - 80.000 |
| RF08 | Decisão errada por DRE falso | Precificação abaixo do custo | 20.000 - 200.000/ano |
| RF09 | Pagamento a prestador incorreto (CNAB) | Valor errado no lote | 5.000 - 50.000 |
| RF10 | Violação LGPD por RLS aberto | Dados de clientes expostos | Multa de até 2% faturamento |

---

## RISCOS DE IA AUTÔNOMA

| ID | Risco | Cenário | Mitigação Atual | Gap |
|:--:|-------|---------|:----------------:|:---:|
| AI01 | Criação de OS em massa | Robô cria 1000 OSs em 1 minuto | Limite diário (10-1000) | Sem rate limit |
| AI02 | Finalização de OS sem execução | Robô marca como concluída sem serviço | Nenhuma | Não valida etapas |
| AI03 | Pagamento sem autorização | Robô registra pagamento de R$ 1M | Governança (valor máximo) | Se configurado autônomo, sem aprovação |
| AI04 | Exclusão de dados críticos | Robô deleta leads/contratos | Nenhuma ferramenta de delete | Mas pode via SQL injection no ILIKE |
| AI05 | Vazamento de dados via LLM | Robô expõe dados financeiros em resposta | Nenhuma | Resultado não sanitizado |
| AI06 | Loop infinito de redistribuição | Worker move tarefa entre robôs a cada 15s | Nenhuma | Sem detecção de loop |
| AI07 | Fraude via prompt injection | Usuário manipula LLM para ação indevida | Nenhuma | Motor de seleção é frágil |

---

## MAPA DE CALOR DE RISCOS

```
Impacto ↑
  5 │ R01 R11     R02
    │ R06 R07     │
  4 │ R04 R10 R24 R09 R05 R12
    │         R14 │
  3 │ R17 R19     │ R03 R08
    │ R23 R18     │
  2 │ R15 R16 R20 R22
    │             │
  1 │             │
    └─────────────┴──────────→ Probabilidade
      1   2   3   4   5
      
      🔴 Crítico (15-25): R01,R02,R03,R04,R05,R06,R07,R08,R09,R10,R11,R12
      🟡 Alto (10-14): R13,R14,R24,R25
      🟢 Médio (5-9): R15,R16,R17,R18,R19,R20,R21,R22,R23
```

---

## PLANO DE MITIGAÇÃO — TOP 10 RISCOS

| # | Risco | Ação | Responsável | Prazo |
|:-:|-------|------|:-----------:|:-----:|
| 1 | R01 — RLS aberto | Revisar todas as policies. Implementar `auth.uid()` | Segurança | 3 dias |
| 2 | R02 — OS sem validação | Adicionar CHECK constraints + validação pré-INSERT | Backend | 5 dias |
| 3 | R03 — OS finalizada sem serviço | Validar etapas antes de finalizar. Exigir POD | Operação | 5 dias |
| 4 | R04 — ICMS incorreto | Implementar cálculo por UF/CFOP conforme CONFAZ | Fiscal | 5 dias |
| 5 | R05 — Sem contingência | Implementar modo contingência SEFAZ | Fiscal | 5 dias |
| 6 | R06 — NFS-E não emitida | Criar Edge Function para NFS-e | Fiscal | 10 dias |
| 7 | R07 — CNAB fake | Implementar gerador FEBRABAN 240 real | Financeiro | 5 dias |
| 8 | R09 — Conciliação mock | Implementar parser OFX + matching automático | Financeiro | 8 dias |
| 9 | R10 — Frota mock | Criar migrations + CRUD de manutenção | Frota | 10 dias |
| 10 | R11 — Seguro mock | Criar migrations + integrar com averbação | Seguros | 10 dias |

---

## INDICADORES DE MONITORAMENTO DE RISCOS

| Indicador | Fórmula | Frequência | Alerta |
|-----------|---------|:----------:|:------:|
| Taxa de OS sem prestador | OS sem FK / Total OS | Diário | > 1% |
| OS finalizadas sem POD | Finalizadas sem POD / Total | Diário | > 5% |
| CT-e emitidos > 24h após viagem | CT-e após viagem / Total | Diário | > 10% |
| Contas a receber vencidas > 30d | Vencidas +30d / Total | Semanal | > 15% |
| Pagamentos sem NF do prestador | Pagos sem NF / Total | Semanal | > 5% |
| Veículos com manutenção atrasada | Atrasados / Total Frota | Semanal | > 10% |
| Ocorrências abertas > 7 dias | Abertas +7d / Total | Diário | > 20% |
| IA ações por minuto | Ações / minuto | Tempo real | > 5/min |

---

## RESPONSABILIDADES

| Risco | Dono | Revisor |
|-------|:----:|:-------:|
| Operacionais (R01-R12) | Gerente Operacional | Diretor de Operações |
| Financeiros (RF01-RF10) | Diretor Financeiro | Auditor Externo |
| IA / Automação (AI01-AI07) | Coordenador de IA | CTO |
| Fiscais (R04-R06) | Supervisor Fiscal | Contador |
| Frota (R10, R24) | Supervisor de Frota | Gerente Operacional |
| Seguros (R11, R12) | Supervisor de Seguros | Diretor Financeiro |
