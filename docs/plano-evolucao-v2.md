# PLANO DE EVOLUÇÃO V2 — Express Connect Hub / TMS

**Data:** 26/06/2026  
**Versão Alvo:** v2.0 (Produção Segura)  
**Prazo Estimado:** 12-16 semanas  
**Orçamento Estimado:** 800-1200 horas de desenvolvimento

---

## VISÃO GERAL DA VERSÃO 2.0

A versão 2.0 tem como objetivo transformar o Express Connect Hub de uma plataforma promissora (com módulos em estado de maquete) em um TMS profissional pronto para operar uma transportadora real com segurança fiscal, financeira e operacional.

**Três Pilares:**
1. **Segurança em Primeiro Lugar** — RLS, governança de IA, auditoria
2. **Fiscal Real** — CT-e, NFS-e e MDF-e emitindo e transmitindo
3. **Financeiro Confiável** — DRE real, CNAB real, conciliação real

---

## SPRINT 1 — FUNDAÇÃO DE SEGURANÇA (Semanas 1-2)

### Objetivo: Eliminar riscos críticos de segurança e dados

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| Revisar RLS de todas as migrations | 16h | 🔴 Crítica |
| Implementar roles e policies baseadas em `auth.uid()` | 8h | 🔴 Crítica |
| Desabilitar acesso anon em tabelas de negócio | 4h | 🔴 Crítica |
| Configurar `service_role` no backend | 4h | 🔴 Crítica |
| Implementar rate limit por minuto/hora para IA | 8h | 🔴 Crítica |
| Sanitizar filtros `.ilike()` — prevenir pattern injection | 4h | 🔴 Crítica |
| Adicionar colunas de auditoria IA nas tabelas de negócio | 8h | 🔴 Crítica |
| Implementar rollback em transações multi-etapas IA | 8h | 🔴 Crítica |
| Adicionar circuit breaker com backoff nos workers | 8h | 🟡 Alta |
| Adicionar aprovação humana obrigatória para ações financeiras IA | 4h | 🟡 Alta |

**Total Sprint 1:** 72h  
**Entregáveis:** Segurança mínima para operar sem risco de vazamento de dados.

---

## SPRINT 2 — FISCAL MVP (Semanas 3-5)

### Objetivo: Emitir CT-e e NFS-e reais com impostos corretos

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| Armazenar senha do certificado no Vault | 4h | 🔴 Crítica |
| Corrigir cálculo de validade do certificado (ler do arquivo) | 4h | 🔴 Crítica |
| Implementar Edge Function para assinatura digital | 8h | 🔴 Crítica |
| Implementar cálculo de ICMS por UF destino | 12h | 🔴 Crítica |
| Implementar tabela de alíquotas ICMS (4%, 7%, 12%, 18%, 25%) | 4h | 🔴 Crítica |
| Implementar PIS/COFINS/CSLL no CT-e | 8h | 🔴 Crítica |
| Configurar Focus produção (secrets, tokens, ambiente) | 4h | 🔴 Crítica |
| Implementar webhook de retorno Focus | 8h | 🔴 Crítica |
| Implementar modo contingência SEFAZ (FS-DA) | 12h | 🔴 Crítica |
| Criar Edge Function para NFS-e | 12h | 🟡 Alta |
| Suportar padrão ABRASF + padrão nacional | 8h | 🟡 Alta |
| Implementar manifestação do destinatário | 8h | 🟡 Alta |
| Testar emissão de lote (10 CT-es simultâneos) | 4h | 🟡 Alta |
| Validar XML contra schema XSD oficial | 4h | 🟡 Alta |

**Total Sprint 2:** 100h  
**Entregáveis:** Módulo fiscal funcional com CT-e, NFS-e, contingência e manifestação.

---

## SPRINT 3 — FINANCEIRO REAL (Semanas 6-8)

### Objetivo: DRE confiável, CNAB real e conciliação funcional

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| REFATORAR DRE: implementar lançamentos contábeis reais | 24h | 🔴 Crítica |
| Ratear custos indiretos por centro de custo | 8h | 🔴 Crítica |
| Calcular impostos reais a partir de notas fiscais emitidas | 8h | 🔴 Crítica |
| DESABILITAR DRE atual e substituir por versão real | 4h | 🔴 Crítica |
| Implementar gerador CNAB FEBRABAN 240 completo | 16h | 🔴 Crítica |
| Suportar Itaú, Bradesco, Santander, BB | 12h | 🔴 Crítica |
| Implementar processamento de retorno CNAB | 8h | 🔴 Crítica |
| Implementar parser OFX/QIF/CSV | 8h | 🔴 Crítica |
| Implementar matching automático de conciliação | 12h | 🔴 Crítica |
| Implementar conciliação manual com divergências | 8h | 🔴 Crítica |
| Corrigir baixa parcial (controlar recebido separadamente) | 4h | 🔴 Crítica |
| Calcular juros/multa por dia de atraso | 4h | 🟡 Alta |
| Implementar régua de cobrança automática | 8h | 🟡 Alta |
| Conectar UI de inadimplência com serviço real | 4h | 🟡 Alta |
| Corrigir fluxo de caixa (classificação realizado vs previsto) | 4h | 🟡 Alta |

**Total Sprint 3:** 132h  
**Entregáveis:** Módulo financeiro confiável com DRE, CNAB e conciliação.

---

## SPRINT 4 — OPERAÇÃO COMPLETA (Semanas 9-11)

### Objetivo: Fechar gaps operacionais (ocorrências, POD, logística reversa)

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| Criar migration e CRUD de ocorrências | 8h | 🔴 Crítica |
| Implementar workflow completo de ocorrências | 12h | 🔴 Crítica |
| Conectar POD UI com `podService.ts` | 8h | 🔴 Crítica |
| Implementar checklist de partida | 6h | 🟡 Alta |
| Criar migration e CRUD de logística reversa | 8h | 🟡 Alta |
| Implementar reentregas automáticas | 8h | 🟡 Alta |
| Refatorar escala: substituir `Math.random()` | 8h | 🟡 Alta |
| Integrar roteirizador com OS e escala | 12h | 🟡 Alta |
| Implementar controle de jornada do motorista | 10h | 🟡 Alta |
| Adicionar tracking em tempo real (feed GPS) | 16h | 🟡 Alta |
| Criar workflow de aprovação hierárquica | 8h | 🟡 Alta |

**Total Sprint 4:** 104h  
**Entregáveis:** Operação completa com ocorrências, POD, tracking e logística reversa.

---

## SPRINT 5 — FROTA E SEGUROS (Semanas 12-13)

### Objetivo: MVP funcional de frota e seguros

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| Criar migration `manutencoes_veiculos` + CRUD | 8h | 🟡 Alta |
| Criar migration `abastecimentos` + CRUD com km/L | 8h | 🟡 Alta |
| Criar migration `documentos_veiculos` + alertas | 6h | 🟡 Alta |
| Criar migration `pneus` + controle de km | 6h | 🟡 Alta |
| Implementar dashboard de custos por veículo | 8h | 🟡 Alta |
| Criar migration `apolices_seguros` + CRUD | 6h | 🟡 Alta |
| Refatorar `averbacao.ts` para usar API real | 8h | 🟡 Alta |
| Implementar motor de cálculo DDR | 8h | 🟡 Alta |
| Implementar workflow de sinistros | 10h | 🟡 Alta |

**Total Sprint 5:** 68h  
**Entregáveis:** Frota e seguros mínimos viáveis para operação.

---

## SPRINT 6 — SLA, RELATÓRIOS E INTEGRAÇÕES (Semana 14)

### Objetivo: Qualidade mensurável e relatórios gerenciais

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| Calcular indicadores SLA a partir de dados reais | 8h | 🟡 Alta |
| Criar migration `sla_metas_cliente` | 4h | 🟡 Alta |
| Implementar metas por cliente | 6h | 🟡 Alta |
| Implementar relatório de margem por OS real | 6h | 🟡 Alta |
| Implementar relatório de produtividade por prestador | 6h | 🟡 Alta |
| Implementar exportação avançada (PDF, Excel, CSV) | 8h | 🟢 Média |
| Refatorar Portal Cliente (quebrar em componentes menores) | 12h | 🟢 Média |
| Refinar templates WhatsApp/Email | 4h | 🟢 Média |

**Total Sprint 6:** 54h  
**Entregáveis:** SLA real, relatórios gerenciais, portal cliente refatorado.

---

## SPRINT 7 — IA E AUTOMAÇÃO (Semana 15-16)

### Objetivo: IA segura e útil para operação

| Tarefa | Esforço | Prioridade |
|--------|:-------:|:----------:|
| Implementar LLM real no motor de seleção (F34) | 12h | 🟡 Alta |
| Adicionar validações de negócio na Action Engine | 8h | 🟡 Alta |
| Implementar transações atômicas via RPC | 8h | 🟡 Alta |
| Limitar ações da IA por ferramenta (default 5/dia) | 4h | 🟡 Alta |
| Sanitizar resultados da IA (remover dados internos) | 4h | 🟡 Alta |
| UI para sessões de agente (`ia_agentes_execucao`) | 8h | 🟢 Média |
| Gatilhos de agenda F31 para iniciar sessões automáticas | 8h | 🟢 Média |
| Workflow de aprovação de ações IA | 8h | 🟡 Alta |
| Testes de integração IA × Operação | 8h | 🟡 Alta |

**Total Sprint 7:** 68h  
**Entregáveis:** IA operacional segura com LLM real e aprovação humana.

---

## CRONOGRAMA CONSOLIDADO

```
Sprint   | Semanas | Horas | Foco Principal
─────────|─────────|───────|────────────────────────────────
1        | 1-2     | 72h   | 🔐 Segurança e Governança
2        | 3-5     | 100h  | 📄 Fiscal MVP (CT-e, NFS-e, MDF-e)
3        | 6-8     | 132h  | 💰 Financeiro Real (DRE, CNAB, Conciliação)
4        | 9-11    | 104h  | 🚚 Operação Completa (Ocorrências, POD, Tracking)
5        | 12-13   | 68h   | 🚛 Frota e Seguros MVP
6        | 14      | 54h   | 📊 SLA, Relatórios, Portal
7        | 15-16   | 68h   | 🤖 IA Segura + Integrações
─────────|─────────|───────|────────────────────────────────
TOTAL    | 16      | 598h  | 🎯 GO-LIVE v2.0
```

---

## EQUIPE RECOMENDADA

| Papel | Dedicação | Responsabilidades |
|-------|:---------:|-------------------|
| Tech Lead / Arquiteto | 100% | Arquitetura, segurança, revisão de código |
| Desenvolvedor Fullstack (x2) | 100% | Implementação dos sprints |
| Desenvolvedor Frontend | 50% | Refatoração de UI, portais |
| Especialista Fiscal | 50% (consultor) | Regras de ICMS, validação fiscal |
| Especialista Financeiro | 25% (consultor) | Layout CNAB, regras contábeis |
| QA | 50% | Testes de integração, carga, segurança |
| Gerente de Projeto | 25% | Acompanhamento, riscos, comunicação |

**Custo Estimado de Equipe (16 semanas):** R$ 180.000 - R$ 350.000 (dependendo da composição)

---

## MARCOS (MILESTONES)

| Marco | Prazo | Critério de Aceitação |
|-------|:-----:|-----------------------|
| **M1 — Fundação Segura** | Semana 2 | RLS corrigido, roles implementadas, rate limit OK |
| **M2 — CT-e Real** | Semana 5 | CT-e emitido e transmitido via Focus com ICMS correto |
| **M3 — NFS-e Real** | Semana 5 | NFS-e emitida com ISS calculado corretamente |
| **M4 — Financeiro Confiável** | Semana 8 | DRE real, CNAB transmitido, conciliação funcional |
| **M5 — Operação Completa** | Semana 11 | Ocorrências persistem, POD funcional, tracking MVP |
| **M6 — Frota Mínima** | Semana 13 | Manutenção, abastecimento, documentos OK |
| **M7 — Seguros Mínimo** | Semana 13 | Apólices, averbação real, sinistros |
| **M8 — IA Segura** | Semana 16 | LLM real, aprovação humana, testes OK |
| **M9 — GO-LIVE** | Semana 16 | Todos os checklists aprovados |

---

## GESTÃO DE RISCOS DO PLANO

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:------------:|:-------:|-----------|
| Atraso na configuração Focus | Média | Alto | Iniciar Sprint 2 com foco total em Focus |
| Complexidade do CNAB | Média | Médio | Contratar especialista FEBRABAN |
| Mudanças na legislação fiscal | Baixa | Alto | Acompanhar CONFAZ, manter regime tributário parametrizável |
| Rotatividade da equipe | Média | Alto | Documentar decisões, manter padrões de código |
| Escopo crescente | Alta | Alto | Congelar escopo após Sprint Planning |

---

## ORÇAMENTO ESTIMADO

| Item | Custo (R$) |
|------|:----------:|
| Desenvolvimento (598h × R$ 200-350/h) | 119.600 - 209.300 |
| Consultoria Fiscal (80h × R$ 400/h) | 32.000 |
| Consultoria Financeira (40h × R$ 400/h) | 16.000 |
| Infraestrutura (Supabase Pro + 6 meses) | 6.000 |
| Ferramentas (Mapbox, APIs) | 3.000 |
| Certificado Digital A1 | 500 |
| Taxa Focus NFe (homologação + produção) | 2.000 |
| Contingência (20%) | 35.820 - 51.760 |
| **Total Estimado** | **~R$ 215.000 - 320.000** |

---

## PÓS V2.0 — VISÃO DE FUTURO

Após a versão 2.0, o sistema estará pronto para evoluções:

### v2.1 — App Motorista Nativo (Mês 5)
- PWA/Flutter para motoristas
- Aceite, check-in, POD offline-first
- Rotas no celular com navegação GPS
- Chat direto com torre de controle

### v2.2 — BI e Analytics (Mês 6)
- Data warehouse dimensional
- Dashboards executivos avançados
- Machine Learning para previsão de demanda
- Análise de rentabilidade por cliente/rota/veículo

### v2.3 — Otimização Avançada (Mês 7-8)
- Algoritmo genético para alocação de frota
- Roteirização inteligente com restrições reais
- Precificação dinâmica baseada em mercado
- Detecção automática de anomalias

### v2.4 — Ecossistema (Mês 9-10)
- Marketplace de fretes
- Integração com corretores de seguros
- Integração com bancos (API aberta)
- Portal do investidor / nota comercial
