# CHECKLIST GO-LIVE — Express Connect Hub / TMS

**Data:** 26/06/2026  
**Objetivo:** Checklist completo para entrada em produção segura  
**Progresso Atual:** ~35% dos itens concluídos

---

## FASE 0 — PRÉ-REQUISITOS DE INFRAESTRUTURA

### ☐ 0.1 Ambiente de Produção
- [ ] Servidor Supabase dedicado (produção ≠ homologação)
- [ ] Configuração de `service_role` key no backend (não usar anon key)
- [ ] Rate limiting configurado no Supabase
- [ ] Backup automático diário configurado
- [ ] Monitoramento de uptime (UptimeRobot, BetterStack)
- [ ] Alertas de erro configurados (email/Slack/WhatsApp)

### ☐ 0.2 Variáveis de Ambiente
- [ ] `VITE_SUPABASE_URL` — produção
- [ ] `VITE_SUPABASE_ANON_KEY` — produção (manter, mas com RLS corrigido)
- [ ] `VITE_EVOLUTION_API_URL` — produção
- [ ] `VITE_EVOLUTION_API_KEY` — produção
- [ ] `VITE_ZOHO_EMAIL_API_URL` — produção
- [ ] `VITE_ZOHO_EMAIL_API_KEY` — produção
- [ ] `VITE_ZOHO_EMAIL_FROM` — configurado
- [ ] `VITE_MAPBOX_ACCESS_TOKEN` — produção
- [ ] `VITE_GROQ_API_KEY` — produção
- [ ] `VITE_GEMINI_API_KEY` — produção
- [ ] `VITE_OPENAI_API_KEY` — produção
- [ ] `VITE_N8N_API_URL` — produção
- [ ] `VITE_N8N_WEBHOOK_ZOHO_EMAIL` — produção
- [ ] `VITE_WHATSAPP_PRODUCAO_ENABLED=true`
- [ ] `FOCUS_REAL_ENABLED=true` (Supabase Secrets)
- [ ] `FOCUS_TOKEN` (Supabase Secrets)
- [ ] `FOCUS_AMBIENTE=producao` (Supabase Secrets)
- [ ] `FOCUS_PRODUCAO_LIBERADA=true` (Supabase Secrets)

---

## FASE 1 — SEGURANÇA (CRÍTICO)

### ☐ 1.1 RLS Policies
- [ ] Revisar TODAS as migrations para remover `allow_all_*`
- [ ] Implementar policies baseadas em `auth.uid()` para cada tabela
- [ ] Implementar roles: `admin`, `operador`, `financeiro`, `comercial`, `fiscal`, `prestador`, `cliente`
- [ ] Testar cada policy com usuários de不同 perfis
- [ ] Remover acesso `anon` de tabelas de negócio
- [ ] Adicionar policy para `service_role` com validação de origem

### ☐ 1.2 Governança de IA
- [ ] Implementar rate limit por minuto/hora para ações de IA
- [ ] Configurar `limite_execucoes_dia` padrão para 10 em TODAS as ferramentas
- [ ] Adicionar aprovação humana OBRIGATÓRIA para ações financeiras
- [ ] Adicionar aprovação humana OBRIGATÓRIA para exclusão de dados
- [ ] Implementar rollback em transações multi-etapas
- [ ] Sanitizar resultados de IA (remover UUIDs, valores internos)
- [ ] Validar pattern injection nos filtros `.ilike()`

### ☐ 1.3 Auditoria
- [ ] Adicionar coluna `criado_por_ia` em `alocacoes_escala`, `financeiro_receber`, `crm_followups`
- [ ] Logar TODAS as ações de IA em tabela de auditoria imutável
- [ ] Implementar alerta de anomalia (>10 ações/minuto de IA)

---

## FASE 2 — FISCAL (CRÍTICO)

### ☐ 2.1 Certificado Digital
- [ ] Armazenar senha do certificado no Supabase Vault
- [ ] Implementar Edge Function para assinatura digital
- [ ] Validar data de expiração real do certificado (não +365 fixo)
- [ ] Adicionar alerta de vencimento (30 dias antes)

### ☐ 2.2 ICMS / Impostos
- [ ] Implementar cálculo de ICMS por UF de origem/destino
- [ ] Implementar tabela de alíquotas por UF (4%, 7%, 12%, 18%, 25%)
- [ ] Implementar cálculo de PIS (1.65% ou 0.65%)
- [ ] Implementar cálculo de COFINS (7.6% ou 3%)
- [ ] Implementar CSLL (9% ou 0%)
- [ ] Considerar regime tributário (Simples Nacional, Lucro Presumido, Lucro Real)
- [ ] Adicionar CFOP correto por tipo de operação

### ☐ 2.3 Emissão CT-e
- [ ] Configurar Edge Function `focus-emissao` para produção
- [ ] Configurar `focus-consulta` para produção
- [ ] Configurar `focus-documentos` para produção
- [ ] Implementar webhook de retorno Focus (processamento assíncrono)
- [ ] Testar emissão em lote (10 CT-es simultâneos)
- [ ] Validar XML gerado contra schema XSD oficial

### ☐ 2.4 Contingência SEFAZ
- [ ] Implementar modo contingência FS-DA
- [ ] Implementar fila de retentativa automática
- [ ] Implementar fallback para XML contingência com posterior transmissão
- [ ] Testar cenário de SEFAZ offline por 2h

### ☐ 2.5 Manifestação do Destinatário
- [ ] Implementar evento "Ciência da Operação"
- [ ] Implementar evento "Confirmação da Operação"
- [ ] Implementar evento "Desconhecimento da Operação"
- [ ] Implementar evento "Não Realização da Operação"

### ☐ 2.6 NFS-e
- [ ] Criar Edge Function para NFS-e
- [ ] Suportar padrão ABRASF 2.03 / 2.04
- [ ] Suportar padrão nacional (Padrão Nacional NFS-e)
- [ ] Suportar prefeituras específicas (SP, RJ, BH, etc.)
- [ ] Configurar emissão automática ao finalizar OS

### ☐ 2.7 MDF-e
- [ ] Criar Edge Function para MDF-e
- [ ] Implementar emissão, encerramento, alteração
- [ ] Implementar eventos de MDF-e
- [ ] Validar RNTRC, peso bruto, capacidades

---

## FASE 3 — FINANCEIRO (CRÍTICO)

### ☐ 3.1 Contas a Receber
- [ ] Corrigir baixa parcial (não alterar `valor_liquido`, controlar recebido separadamente)
- [ ] Calcular juros/multa automaticamente por dia de atraso
- [ ] Implementar boleto registrado (via banco ou gateway)
- [ ] Implementar PIX como forma de recebimento
- [ ] Integrar com conciliação bancária

### ☐ 3.2 Contas a Pagar
- [ ] Implementar workflow de aprovação hierárquica
- [ ] Verificar saldo bancário antes de autorizar pagamento
- [ ] Validar situação fiscal do prestador antes de pagar
- [ ] Integrar com CNAB real

### ☐ 3.3 CNAB
- [ ] Implementar layout FEBRABAN 240 completo
- [ ] Suportar Itaú, Bradesco, Santander, Banco do Brasil
- [ ] Implementar segmento A (favorecido), B (pagamento), J/J-2 (judicial/fiscal)
- [ ] Implementar processamento de arquivo de retorno
- [ ] Conciliar baixas automaticamente após processamento

### ☐ 3.4 Conciliação Bancária
- [ ] Implementar parser OFX/QIF/CSV
- [ ] Implementar matching automático (valor + data + descrição)
- [ ] Implementar conciliação manual de divergências
- [ ] Gerar lançamentos contábeis a partir da conciliação
- [ ] Integrar com API bancária (OFB ou plugins)

### ☐ 3.5 DRE Gerencial
- [ ] REFATORAR COMPLETAMENTE — não usar estimativas
- [ ] Implementar lançamentos contábeis por competência
- [ ] Ratear custos indiretos por centro de custo
- [ ] Calcular impostos reais a partir de notas fiscais
- [ ] Comparar com orçamento/planejamento
- [ ] **DESABILITAR O DRE ATUAL** até nova versão

### ☐ 3.6 Fluxo de Caixa
- [ ] Corrigir classificação "realizado vs previsto"
- [ ] Considerar saldo real por conta bancária
- [ ] Implementar projeção por cenários (otimista, realista, pessimista)
- [ ] Alertar saldo negativo projetado

### ☐ 3.7 Inadimplência
- [ ] Conectar UI com `inadimplenciaService.ts` (já existe, só não é usado)
- [ ] Implementar régua de cobrança automática
- [ ] Integrar com Serasa/SPC para negativação
- [ ] Implementar renegociação de dívidas

---

## FASE 4 — OPERAÇÃO

### ☐ 4.1 Ocorrências (CRIAR DO ZERO)
- [ ] Criar migration `ocorrencias` com todas as colunas necessárias
- [ ] Implementar CRUD completo com vinculação obrigatória a OS/Alocação
- [ ] Implementar workflow: Aberta → Em Tratativa → Resolvida → Encerrada
- [ ] Notificar cliente automaticamente
- [ ] Criar reentrega/devolução automaticamente quando aplicável
- [ ] Calcular impacto financeiro automaticamente
- [ ] Upload de fotos/documentos

### ☐ 4.2 POD (CONECTAR UI COM SERVIÇO)
- [ ] Refatorar `PodLista.tsx` para usar `podService.ts`
- [ ] Implementar visualizador de fotos/assinaturas
- [ ] Validar geolocalização do POD
- [ ] Gestão de PODs pendentes

### ☐ 4.3 Escala
- [ ] Substituir `Math.random()` por algoritmo real de alocação
- [ ] Integrar com disponibilidade de frota
- [ ] Otimizar rotas na alocação
- [ ] Controlar jornada do motorista (Lei 12.619/2012)

### ☐ 4.4 Roteirizador
- [ ] Integrar com dados reais (pedidos do banco, veículos reais)
- [ ] Criar OS automaticamente a partir de rotas geradas
- [ ] Vincular com escala
- [ ] Reotimização em tempo real

### ☐ 4.5 Logística Reversa (CRIAR DO ZERO)
- [ ] Criar migration e CRUD
- [ ] Implementar workflow: Solicitação → Autorização → Coleta → Inspeção → Destino
- [ ] Creditar cliente quando aplicável

### ☐ 4.6 Reentregas (CRIAR DO ZERO)
- [ ] Criar automaticamente a partir de ocorrência com `geraReentrega=true`
- [ ] Controlar custo adicional
- [ ] Limitar número de tentativas

### ☐ 4.7 Tracking em Tempo Real
- [ ] Implementar feed de GPS via app do motorista
- [ ] WebSocket/Supabase Realtime para atualizações
- [ ] Exibir no mapa da Torre de Controle
- [ ] Disponibilizar no Portal do Cliente

---

## FASE 5 — FROTA (REFATORAR)

### ☐ 5.1 Manutenção
- [ ] Criar migration `manutencoes_veiculos`
- [ ] Implementar CRUD com km programada, data, tipo, custo
- [ ] Calcular km programada automaticamente
- [ ] Alertar quando manutenção estiver próxima

### ☐ 5.2 Abastecimento
- [ ] Criar migration `abastecimentos`
- [ ] Calcular km/L automaticamente
- [ ] Calcular custo por km rodado
- [ ] Detectar anomalias (consumo muito acima da média)

### ☐ 5.3 Documentos
- [ ] Criar migration `documentos_veiculos`
- [ ] Alertar vencimento (30 dias antes)
- [ ] Armazenar PDF dos documentos

### ☐ 5.4 Custos por Veículo
- [ ] Agregar manutenção + abastecimento + seguro + pneus
- [ ] Calcular custo total por km rodado
- [ ] Relatório de rentabilidade por veículo

### ☐ 5.5 Pneus
- [ ] Criar migration `pneus`
- [ ] Controlar km por pneu, posição, vida útil
- [ ] Alertar substituição

---

## FASE 6 — SEGUROS (REFATORAR)

### ☐ 6.1 Apólices
- [ ] Criar migration `apolices_seguros`
- [ ] CRUD completo com vigência, valor, coberturas
- [ ] Vincular a clientes e/ou rotas

### ☐ 6.2 Averbação
- [ ] Refatorar `averbacao.ts` para chamar API real
- [ ] Integrar com principais seguradoras (Porto, Tokio, Sompo, etc.)
- [ ] Implementar averbação automática no fechamento da OS

### ☐ 6.3 Regras DDR
- [ ] Implementar motor de cálculo baseado em regras configuradas
- [ ] Aplicar na criação da OS automaticamente
- [ ] Consultar base de dados de risco

### ☐ 6.4 Sinistros
- [ ] Implementar workflow completo
- [ ] Acionar seguradora automaticamente
- [ ] Acompanhamento de regulação

---

## FASE 7 — SLA / QUALIDADE

### ☐ 7.1 Indicadores Reais
- [ ] Calcular taxa no prazo a partir de `ordens_servico.entregue_em` vs `previsao`
- [ ] Calcular avarias de `ocorrencias`
- [ ] Calcular devoluções de `logistica_reversa`
- [ ] Calcular NPS a partir de `portal_avaliacoes`

### ☐ 7.2 Metas por Cliente
- [ ] Criar migration `sla_metas_cliente`
- [ ] Comparar realizado vs meta contratual
- [ ] Alertar quando meta estiver em risco

### ☐ 7.3 Relatórios
- [ ] Exportar para PDF/Excel
- [ ] Dashboard de qualidade por cliente

---

## FASE 8 — MIGRAÇÕES PENDENTES

### ☐ 8.1 Novas Migrations
- [ ] `ocorrencias.sql`
- [ ] `manutencoes_veiculos.sql`
- [ ] `abastecimentos.sql`
- [ ] `documentos_veiculos.sql`
- [ ] `pneus.sql`
- [ ] `apolices_seguros.sql`
- [ ] `averbacoes.sql`
- [ ] `sinistros.sql`
- [ ] `sla_metas_cliente.sql`
- [ ] `financeiro_conciliacao.sql`
- [ ] `financeiro_juros_multa.sql`
- [ ] `financeiro_protesto.sql`
- [ ] `financeiro_aprovacao.sql`

### ☐ 8.2 Correções em Migrações Existentes
- [ ] Corrigir RLS policies (TODAS as migrations)
- [ ] Adicionar colunas de auditoria IA nas tabelas de negócio
- [ ] Adicionar CHECK constraints de integridade

---

## FASE 9 — TESTES

### ☐ 9.1 Testes Unitários (Vitest)
- [ ] Cobrir serviços críticos: `ordemServicoService`, `escalaService`, `cteService`
- [ ] Cobrar engine financeira: `calculoService`, `composicaoFinanceiraService`
- [ ] Cobrir módulo fiscal: `focusService`, `nfseService`
- [ ] Cobrir IA: `actionEngineService`, `agenteService`, `conectoresService`
- [ ] Mínimo: 70% de cobertura nos serviços core

### ☐ 9.2 Testes de Integração
- [ ] Fluxo completo: Orçamento → OS → Escala → Execução → Financeiro
- [ ] Fluxo fiscal: OS → CT-e → Faturamento
- [ ] Fluxo IA: Solicitação → Seleção → Execução → Avaliação
- [ ] Fluxo de erros: SEFAZ offline, certificado expirado, prestador recusou

### ☐ 9.3 Testes E2E (Playwright)
- [ ] Fluxo do operador: criar OS, alocar, finalizar
- [ ] Fluxo do financeiro: emitir boleto, baixar, conciliar
- [ ] Fluxo do fiscal: emitir CT-e, NFS-e
- [ ] Fluxo do cliente: criar pedido, acompanhar, avaliar
- [ ] Fluxo do prestador: aceitar escala, fazer check-in, enviar POD

### ☐ 9.4 Testes de Carga
- [ ] Simular 100 OS simultâneas
- [ ] Simular 50 CT-es simultâneos
- [ ] Simular 10 agentes IA simultâneos
- [ ] Verificar tempo de resposta < 2s

### ☐ 9.5 Testes de Segurança
- [ ] Testar RLS policies com cada perfil
- [ ] Testar SQL injection via ILIKE
- [ ] Testar rate limiting
- [ ] Testar aprovação hierárquica

---

## FASE 10 — TREINAMENTO E DOCUMENTAÇÃO

### ☐ 10.1 Manuais
- [ ] Manual do Operador (OS, Escala, Ocorrências)
- [ ] Manual do Financeiro (Receber, Pagar, Conciliação)
- [ ] Manual do Fiscal (CT-e, NFS-e, MDF-e, Certificados)
- [ ] Manual do Gestor (IA, Relatórios, Configurações)
- [ ] Manual do Prestador (App, POD, Pagamentos)
- [ ] Manual do Cliente (Portal, Pedidos, Tracking)

### ☐ 10.2 Treinamento
- [ ] Operadores (8h)
- [ ] Financeiro (8h)
- [ ] Fiscal (8h)
- [ ] Gestores (4h)
- [ ] Prestadores (2h — remoto)
- [ ] Clientes (1h — webinar)

### ☐ 10.3 Suporte
- [ ] Canal de suporte definido (WhatsApp, chat, email)
- [ ] SLA de resposta: 2h para crítico, 8h para normal
- [ ] Plantão 24h para emergências (primeiros 30 dias)

---

## FASE 11 — GO-LIVE

### ☐ 11.1 D-30
- [ ] Correção de todos os itens críticos de segurança
- [ ] Correção de todos os itens críticos fiscais
- [ ] Início dos testes de integração

### ☐ 11.2 D-15
- [ ] Testes de carga concluídos
- [ ] Testes de segurança concluídos
- [ ] Homologação com dados reais (10 operações)

### ☐ 11.3 D-7
- [ ] Rollback plan definido
- [ ] Equipe de suporte treinada
- [ ] Ambiente de produção configurado

### ☐ 11.4 D-1
- [ ] Backup completo da base de testes
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Certificados digitais instalados e testados
- [ ] FocuS configurado e testado

### ☐ 11.5 D-DAY (GO-LIVE)
- [ ] Migração dos dados legados
- [ ] Validação de saldos iniciais
- [ ] Primeira OS real criada
- [ ] Primeiro CT-e emitido
- [ ] Primeiro pagamento processado
- [ ] Monitoramento intensivo (24h)

---

## RESUMO DE PROGRESSO

| Fase | Itens | Concluídos | % |
|:----:|:-----:|:----------:|:-:|
| 0 — Infraestrutura | 12 | 2 | **16%** |
| 1 — Segurança | 11 | 0 | **0%** |
| 2 — Fiscal | 22 | 0 | **0%** |
| 3 — Financeiro | 25 | 2 | **8%** |
| 4 — Operação | 22 | 3 | **14%** |
| 5 — Frota | 14 | 0 | **0%** |
| 6 — Seguros | 10 | 0 | **0%** |
| 7 — SLA | 7 | 0 | **0%** |
| 8 — Migrações | 16 | 0 | **0%** |
| 9 — Testes | 18 | 2 | **11%** |
| 10 — Treinamento | 10 | 0 | **0%** |
| 11 — GO-LIVE | 14 | 0 | **0%** |

**Total Geral:** 181 | **Concluídos:** 9 | **Progresso:** **5%**

---

## DECISÃO

☐ **GO-LIVE AUTORIZADO** (todos os críticos e altos concluídos)  
☐ **GO-LIVE NEGADO** (riscos inaceitáveis) → **Situação Atual**  
☐ **GO-LIVE CONDICIONAL** (com plano de correção aprovado)
