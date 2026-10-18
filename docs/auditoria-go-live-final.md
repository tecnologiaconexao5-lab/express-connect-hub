# Auditoria Go-Live Final — Express Connect Hub / TMS

> **Data:** 2026-06-26  
> **Escopo:** Simulação completa de transportadora real (200+ clientes, 130 motoristas, 120 veículos)  
> **Método:** 8 cenários operacionais, 20 regras de negócio, auditoria de todos os módulos  
> **Veredito Final:** **NÃO APTO PARA GO-LIVE** — 47 bloqueios P0 encontrados

---

## 1. Resposta à Pergunta Fundamental

> *"Se amanhã uma transportadora real contratar este sistema, ela conseguirá operar 100% do negócio apenas por ele?"*

**NÃO.** O sistema entrega ~55% da operação real de uma transportadora. Os 45% restantes são lacunas críticas que tornariam a operação inviável sem processos manuais paralelos ou sistemas complementares.

---

## 2. Matriz de Prontidão por Módulo

| Módulo | % Pronto | P0 | Status |
|--------|----------|----|--------|
| CRM / Leads | 90% | 0 | Funcional |
| Clientes | 75% | 2 | FK ausente em financeiro, sem portal aprovação |
| Prestadores / Motoristas | 70% | 3 | FK ausente, sem swap, sem gestão frota |
| Orçamentos | 85% | 0 | Funcional |
| Ordens de Serviço | 65% | 5 | Sem validação transição status, sem cancelamento integrado |
| Escala / Alocação | 50% | 6 | Sem swap, sem multi-stop, cancelamento não propaga |
| Frota / Veículos | 10% | 5 | Módulo maquete, sem reserva, sem manutenção |
| Financeiro (Receber) | 55% | 4 | Sem boleto, sem UNIQUE os_id, auditoria incompleta |
| Financeiro (Pagar) | 40% | 4 | Orfandade no cancelamento, sem batch, sem conciliação |
| Margem / Rentabilidade | 50% | 2 | Margem inflada (ignora 6 custos), motor real não salva |
| Portal do Cliente | 60% | 2 | Pedido não vira OS, tracking mock |
| Portal do Prestador | 65% | 1 | App funcional, mas sem swap |
| Dashboards | 55% | 3 | Frota/SLA/Governanca maquete, gráfico margem quebrado |
| Relatórios | 50% | 1 | Sem DRE, sem conciliação |
| Fiscal (CT-e/NFS-e) | 70% | 1 | Emissão pendente chaves API |
| IA / Automação | 60% | 5 | Default bypass, sem rate limit, sem verificação em execução |
| Segurança / RLS | 15% | 12 | 47 políticas USING true, anon = admin |
| Contratos | 60% | 2 | Sem contrato comercial, sem link orçamento→contrato |
| Tracking | 20% | 2 | Mock, sem tabela de posições |
| Logística Reversa | 0% | 3 | Totalmente ausente |

---

## 3. Os 10 Bloqueios Mais Críticos para Go-Live

### #1 — RLS efetivamente desativado (P0 — Segurança)
47 políticas `USING (true)` + `GRANT ALL TO anon` em 20+ tabelas. A chave anon key tem privilégios equivalentes a admin. Qualquer pessoa com a URL do Supabase acessa todos os dados.

### #2 — Margem financeira inflada (P0 — Financeiro)
`composicaoFinanceiraService.ts:232` ignora 6 categorias de custo real (combustível, ajudantes, KM excedente, diárias adicionais, saídas extras, reembolsos). Todos os dashboards mostram lucro falso. O motor real (`engineFinanceira.ts:272`) calcula corretamente mas nunca salva no banco.

### #3 — Cancelamento não limpa registros (P0 — Operacional/Financeiro)
Cancelar escala NÃO atualiza OS, NÃO zera `financeiro_receber`, NÃO zera `financeiro_pagar`, NÃO zera `pagamentos_prestadores`. Registros financeiros fantasmas permanecem para sempre.

### #4 — Sem validação de transição de status (P0 — Operacional)
`escalaService.ts:343` faz `UPDATE` direto sem verificar estado anterior. Escala pode pular de "planejada" para "concluida" sem passar por nenhum estado operacional, gerando métricas falsas.

### #5 — IA pode criar OS e registrar pagamentos sem aprovação (P0 — Governança)
`governancaService.ts:299-312`: default `permitido: true, precisa_aprovacao: false` (corrigido). Mas `executarAcaoReal()` ainda não tem re-verificação, permitindo bypass da governança.

### #6 — Sem proteção contra faturamento duplicado (P0 — Financeiro)
`financeiro_receber` e `pagamentos_prestadores` sem `UNIQUE (os_id)`. Apenas proteção em código (read-then-write sem lock). Race condition ou chamada direta à API = duplicata.

### #7 — Módulos maquete em produção (P0 — UX/Confiança)
`Frota.tsx`, `SLA.tsx`, `Governanca.tsx` — 100% dados hardcoded. Usuário vê números falsos como se fossem reais. `Tracking.tsx` — mock com `setTimeout`.

### #8 — Sem logística reversa / entrega parcial (P0 — Operacional)
0% de suporte. Com 300-500 OS/dia e ~5-10% de ocorrências parciais, ~30-50 OS/dia teriam dados financeiros incorretos.

### #9 — Sem swap de motorista / veículo (P0 — Operacional)
Com 130 motoristas e 120 veículos, trocas são diárias. Único jeito é `UPDATE` manual na tabela, sem validação de conflitos, sem notificação, sem auditoria.

### #10 — Sem conciliação financeira (P0 — Financeiro)
Nenhuma função compara `financeiro_receber` vs `ordens_servico` vs `composicao_financeira_os`. Divergências entre tabelas nunca são detectadas automaticamente.

---

## 4. Cenários Reais — Resultado da Simulação

| Cenário | % Funcional | Bloqueios |
|---------|-------------|-----------|
| 1. Onboarding → Entrega | 65% | Sem aprovação cliente, sem contrato comercial, sem fatura/boleto |
| 2. Rota Multi-stop (12 entregas SP) | 40% | Sem paradas na escala, sem tracking parcial, sem POD por parada |
| 3. No-show / Troca emergencial | 15% | Sem função swap, sem validação automática |
| 4. Quebra de veículo | 5% | Sem gestão de frota, sem reserva, sem transferência de carga |
| 5. Entrega parcial / devolução | 0% | Totalmente ausente |
| 6. Fechamento financeiro mensal | 45% | Sem DRE, sem conciliação, sem fechamento batch |
| 7. Disputa / chargeback | 40% | Dados fragmentados, sem trilha unificada |
| 8. Lote pagamento prestador | 35% | Sem tabela de lote, sem batch update |

---

## 5. O Que Funciona

- **Cálculo de frete** — tabela por tipo veículo × distância
- **POD com validade jurídica** — foto + assinatura + GPS
- **Roteirização Mapbox** — nearest-neighbor funcional
- **Sincronização OS↔Escala↔Financeiro** — bidirecional (na criação)
- **Portal do cliente** — entregas, financeiro, ocorrências
- **Controle de inadimplência** — bloqueia OS para devedores
- **CRM e pipeline comercial** — leads, orçamentos, propostas
- **Emissão fiscal** — rascunhos CT-e/NFS-e (pendente chaves API)
- **Memória corporativa IA** — contexto completo para decisões
- **50+ specs E2E** — cobertura de testes

---

## 6. Estimativa para Go-Live

| Onda | Dias | Foco |
|------|------|------|
| 1. Segurança RLS | 4 | Fechar 47 políticas, habilitar Auth |
| 2. Integridade Financeira | 5 | UNIQUE constraints, FKs, conciliação, margem real |
| 3. Cancelamento e Transições | 3 | Estado de máquina, cascade cancelamento |
| 4. Swap + Multi-stop | 5 | Troca motorista/veículo, paradas na escala |
| 5. Logística Reversa | 5 | Entrega parcial, devolução, OS retorno |
| 6. Cobrança/Fatura | 3 | Boleto, fatura comercial, notificação |
| 7. Módulos Maquete | 5 | Implementar Frota, SLA, Tracking, Governanca |
| 8. IA Governança | 3 | Rate limit, re-verificação, matriz autoridade |
| 9. UX Crítico | 3 | Auto-save, validação inline, swap UI |
| 10. Testes + Doc | 4 | Testes integrados, manual operador |
| **Total** | **40 dias** | |

---

## 7. Veredito Final

**O sistema está a aproximadamente 40 dias de desenvolvimento de estar pronto para go-live** com uma transportadora real. As fundações são sólidas (build OK, TypeScript 0 erros, arquitetura de serviços organizada, testes E2E extensivos), mas as lacunas operacionais (cancelamento, swap, multi-stop, devolução, fatura) e de segurança (RLS) são bloqueantes.

**Não é seguro colocar em produção hoje.** Com as 10 ondas de correção aplicadas, o sistema seria capaz de operar ~90% do negócio de uma transportadora real. Os 10% restantes seriam cobertos por processos manuais até implementação completa.

---

*Documento gerado por auditoria enterprise definitiva — OpenCode Go Pro*
*Próxima revisão: após conclusão da Onda 1 (Segurança)*
