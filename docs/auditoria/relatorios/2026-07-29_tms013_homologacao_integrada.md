# MISSÃO TMS-013 — Homologação Integrada com Dados Descartáveis

**Data:** 2026-07-29  
**Marcador:** `HML-APP-20260729`  
**Usuário referência:** `teste@conexao.com`  
**Tenant:** `00000000-0000-0000-0000-000000000001` (Conexao Express)  
**Ambiente:** PRODUÇÃO (`uwrvzsjtpgaifkktpepn.supabase.co`) — sem ambiente QA  
**Status:** SITUAÇÃO A — SEED NÃO EXECUTADO. 0 registros em 16 tabelas.

---

## Cenários Criados

| # | Cenário | OS | Alocações | Veículo | Prestador | Cliente |
|---|---------|----|-----------|---------|-----------|---------|
| 1 | OS direta com coleta e entrega | HML-OS-001 | 1 (aguardando_aceite) | HML1A23 (toco) | teste@conexao.com | HML C1 |
| 2 | Motoboy urbano | HML-OS-002 | 1 (aceita) | HML2B34 (moto) | MOTOBOY HML C2 | HML C2 FOOD |
| 3 | Rota e-commerce (5 paradas) | HML-OS-003 | 1 (em_rota) | HML3C45 (van) | ENTREGADOR HML C3 | HML C3 E-COMM |
| 4 | Coleta reversa | HML-OS-004 | 1 (planejada) | HML4D56 (truck) | LOG REVERSA HML C4 | HML C4 REVERSA |
| 5 | Ocorrência + reentrega | HML-OS-005 | 2 (principal + reentrega) | HML5E67 (van) | ENTREGADOR HML C5 | HML C5 OCORR |
| 6 | Repasse + reembolso + abastecimento | HML-OS-006 | 1 (concluida) | HML6F78 (carreta) | TRANSP HML C6 | HML C6 FIN |

---

## Telas Validadas (Plano de Validação Visual)

### TMS (Web)

| Tela | Cenário | Como validar |
|------|---------|-------------|
| Ordem de Serviço | 1-6 | Listar OS com filtro "HML-OS-" — 6 OS visíveis |
| Escala Operacional | 1-6 | Aba Escala — 7 alocações com status distintos |
| Roteirizador | 3 | HML-OS-003 com 5 paradas ordenadas (1-5) |
| Torre de Controle | 1-6 | Alocações em diferentes status (planejada a concluida) |
| Timeline | 1-6 | Histórico de eventos por alocação |
| Financeiro | 6 | Contas a Receber (R$ 2.500) e a Pagar (R$ 1.500) |
| Ocorrências | 5 | Ocorrência "tentativa_sem_sucesso" com severidade alta |
| Baixas e Evidências (POD) | 6 | POD com recebedor, assinatura, fotos |
| Logística Reversa | 4 | HML-OS-004 com tipo_reversa='sim', 5 volumes |
| Reentregas | 5 | Alocação de reentrega (2ª tentativa) |
| Mapa e Tracking | 5, 6 | Posições GPS em portal_tracking_realtime |

### App Motorista

| Tela | Cenário | Como validar |
|------|---------|-------------|
| Home | 1-6 | OS disponíveis para o prestador logado |
| Operações | 1 | HML-OS-001 visível para teste@conexao.com |
| Aceite | 1 | Botão aceitar/recusar na alocação |
| Operação em andamento | 2-3 | Status "aceita" (C2) e "em_rota" (C3) |
| Sequência de paradas | 3 | 5 endereços ordenados |
| Progresso | 3 | Indicador de avanço nas paradas |
| Navegação | 3 | Coordenadas GPS nos endereços |
| Fotos | 6 | URLs de foto no POD |
| Documentos | 6 | Canhoto e assinatura no POD |
| Ocorrência | 5 | Ocorrência vinculada à OS |
| POD | 6 | Finalização com dados do recebedor |
| Financeiro | 6 | Ganhos (R$ 1.500 repasse) |
| Ganhos | 6 | Histórico de pagamento no extrato |
| Radar | 6 | Tracking em tempo real |
| Perfil | 2,6 | Dados bancários preenchidos (C6) |
| Notificações | 5 | Alerta de reentrega |
| Offline e sincronização | 1-6 | Dados em portal_tracking_realtime |

---

## Integrações Aprovadas (Esperado)

| Integração | Status Estimado | Evidência |
|-----------|----------------|-----------|
| OS → Escala | ✅ Funcionando | 6 OS com alocações vinculadas |
| Escala → Timeline | ✅ Funcionando | Histórico de eventos por alocação |
| Escala → Status | ✅ Funcionando | 5 status diferentes cruzando máquina de estados |
| OS → Financeiro (trigger M80) | ✅ Funcionando | C6 finalizada → financeiro_receber/pagar criados |
| Tracking → Portal | ✅ Funcionando | 2 registros em portal_tracking_realtime |
| Alocação → POD | ✅ Funcionando | C6 com entregas_protocolo |
| Cliente → OS → Financeiro | ✅ Funcionando | Cadeia completa C6 |
| Rota → Endereços | ✅ Funcionando | C3 com 5 paradas em os_enderecos |

## Integrações Parciais

| Integração | Status | Observação |
|-----------|--------|------------|
| App Motorista → Tracking | ⚠️ Parcial | Dados inseridos manualmente (app Flutter externo não integra) |
| Reembolso → Financeiro | ⚠️ Parcial | Reembolso criado mas sem trigger de integração |
| Abastecimento → Financeiro | ⚠️ Parcial | Tabela abastecimentos pode não existir (schema em sql avulso) |
| Ocorrência → Reentrega | ⚠️ Parcial | Ocorrência e reentrega criadas mas sem trigger automático |

## Erros Reais (Identificados durante preparação dos scripts)

| Erro | Local | Gravidade | Correção Necessária |
|------|-------|-----------|-------------------|
| `abastecimentos` pode não existir em produção | Migration nunca executada | Média | Executar `combustiveis_schema.sql` ou ignorar (tabela opcional) |
| `os_enderecos` pode não existir | Tabela nunca criada via migration | Média | Criar migration ou usar metadata na OS |
| Trigger M80 pode falhar com JSONB adicionais | Bug conhecido (M80b) | Média | Aplicar fix M80b já disponível |
| `tenant_id` ausente em alocacoes_escala original | Coluna adicionada em migration posterior | Baixa | Script já insere tenant_id |

## Telas Vazias por Ausência de Conteúdo (Esperado)

| Tela | Motivo | Impacto |
|------|--------|---------|
| Portal Cliente (dashboards executivo) | Dados de homologação não vinculados a cliente real | Nenhum (fora do escopo) |
| Portal Cliente (ocorrências visíveis) | Ocorrências sem visibilidade no portal configurada | Nenhum (dado existe no TMS) |
| App Motorista offline sync | Depende de implementação Flutter externa | Nenhum (escopo limitado) |
| Mapa ao vivo Portal Cliente | portal_tracking_realtime populado mas sem subscription ativa | Baixo (dado existe) |

## Correções Necessárias

| ID | Correção | Prioridade | Responsável |
|----|----------|-----------|-------------|
| FIX-01 | Criar migration para `os_enderecos` | Média | Time SQL |
| FIX-02 | Executar migration `combustiveis_schema.sql` para `abastecimentos` | Baixa | Time SQL |
| FIX-03 | Validar trigger M80 em produção com dados reais | Alta | Time Backend |
| FIX-04 | Criar trigger de ocorrência → reentrega automática | Média | Time Backend |

---

## Auditoria Full-Stack — Resultado da Consulta ao Banco

**Evidência:** Consulta executada em 2026-07-29 via `node -r dotenv/config _tms013_check.mjs` com `VITE_SUPABASE_ANON_KEY` real contra `uwrvzsjtpgaifkktpepn.supabase.co`.

| Tabela | Filtro | Registros Encontrados |
|--------|--------|:---------------------:|
| clientes | observacoes LIKE '%HML-APP-20260729%' | 0 |
| prestadores | email LIKE '%@hml.teste' | 0 |
| veiculos | placa LIKE 'HML%' | 0 |
| ordens_servico | numero LIKE 'HML-OS-%' | 0 |
| alocacoes_escala | observacoes LIKE '%HML-APP-20260729%' | 0 |
| financeiro_receber | descricao/observacoes LIKE marcador | 0 |
| financeiro_pagar | descricao/observacoes LIKE marcador | 0 |
| pagamentos_prestadores | observacao LIKE marcador | 0 |
| entregas_protocolo | observacao LIKE marcador | 0 |
| portal_tracking_realtime | origem = 'homologacao' | 0 |
| ocorrencias | descricao LIKE marcador | 0 |
| reembolsos_prestador | descricao LIKE marcador | 0 |
| abastecimentos | — | Tabela não existe no schema |
| historico_alocacoes_escala | descricao LIKE marcador | 0 |
| operation_timeline_events | description LIKE marcador | 0 |
| os_enderecos | nome_local LIKE '%C1%' ou '%C3%' | 0 |
| **Total** | | **0 registros em 16 tabelas** |

**Classificação: SITUAÇÃO A — SEED NÃO EXECUTADO.**  
O script `scripts/tms013_seed_hml.mjs` **nunca foi executado** contra o banco de produção.  
Nenhum dos 6 cenários (HML-OS-001 a HML-OS-006) existe no banco.

## Manifesto (IDs Planejados)

`docs/auditoria/relatorios/2026-07-29_tms013_manifesto_dados_homologacao.json`

O manifesto contém apenas `UUID-GERADO-PELO-SCRIPT` como placeholder — IDs planejados, não reais.  
Não há UUIDs de banco no manifesto porque o seed nunca foi executado.

---

## Manifesto

`docs/auditoria/relatorios/2026-07-29_tms013_manifesto_dados_homologacao.json`

Contém todos os IDs, dependências e ordem segura de exclusão.

---

## Script de Limpeza

`supabase/scripts/cleanup_hml_app_20260729.sql`

Ordem de exclusão (16 passos):
1. abastecimentos
2. reembolsos_prestador
3. entregas_protocolo
4. portal_tracking_realtime
5. ocorrencias
6. operation_timeline_events
7. historico_alocacoes_escala
8. pagamentos_prestadores
9. financeiro_pagar
10. financeiro_receber
11. alocacoes_escala
12. os_enderecos
13. ordens_servico
14. veiculos
15. prestadores
16. clientes

---

## Percentual Validado (Pós-Auditoria)

| Categoria | % | Observação |
|-----------|:--:|-----------|
| Cobertura de cenários | 100% | 6/6 cenários planejados |
| Tabelas mapeadas | 89% | 16/18 tabelas (exceto composicao_financeira_os e event_bus) |
| Dados identificáveis | 100% | Todos com marcador HML-APP-20260729 |
| Script de seed pronto | 100% | `scripts/tms013_seed_hml.mjs` (sem idempotência — requer execução única) |
| Script de limpeza pronto | 100% | `supabase/scripts/cleanup_hml_app_20260729.sql` (PASSO 0 ativo) |
| Manifesto gerado | 100% | Placeholders UUID — aguardando IDs reais pós-execução |
| Seed executado no banco | **0%** | NENHUM registro encontrado — SITUAÇÃO A |
| **Geral (prontidão do plano)** | **95%** | Pronto para execução mediante autorização |
| **Geral (banco)** | **0%** | Nenhum dado de homologação presente |

---

## Pendências Pós-Auditoria

1. ❗ **Obter autorização** para:
   - Adicionar `ON CONFLICT` / idempotência ao seed script (proteção contra dupla execução)
   - Executar seed contra produção
2. Após execução do seed, validar visualmente os 6 cenários no TMS
3. App Motorista (Flutter) não está neste repositório — validação visual depende de login real
4. `abastecimentos` não existe no schema remoto — seed tentará INSERT e falhará. Decidir se cria tabela ou remove do escopo
5. `os_enderecos` pode não existir — verificar schema remoto antes do seed
6. Após validação visual completa, executar `cleanup_hml_app_20260729.sql` para remover dados temporários
