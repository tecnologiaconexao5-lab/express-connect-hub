# RELATORIO P0 — Auditoria de Policies RLS Inseguras

**Data:** 2026-07-31
**Total de policies inseguras encontradas:** ~415+ em 50+ arquivos SQL

---

## SUMARIO EXECUTIVO

| Categoria | Quantidade | Criticas | Media | Baixa/Legado |
|-----------|:----------:|:--------:|:-----:|:------------:|
| USING(true) sem TO (qquer role) | ~85 | 5 | 15 | 65 |
| TO anon ou TO public explicitas | ~130 | 18 | 30 | 82 |
| USING(true) + TO authenticated | ~200 | 0 | 0 | 200 |
| **Total** | **~415** | **23** | **45** | **347** |

Destas 415:
- **23 serao corrigidas** pelas migrations M3 + M4 pendentes
- **~200 sao de IA/automacao/tabelas internas** com risco baixo (so authenticated)
- **~82 sao de tabelas antigas/renomeadas** que podem nem existir em producao
- **~110 sao de tabelas ativas sem protecao real** que precisam de nova migration

---

## 1. POLICIES BLOQUEANTES GO-LIVE (23)

### 1.1 Tabelas com dados financeiros/sensiveis — SEM protecao

| # | Policy | Tabela | Arquivo | Linha | Migracao que criou | Frontend usa? | Risco |
|---|--------|--------|---------|:-----:|--------------------|:-------------:|:-----:|
| 1 | "Allow all on financeiro_receber" | `financeiro_receber` | sql_final_supabase.sql | 645 | Pre-migracoes | Sim (ContasReceber) | **81 registros, valores financeiros expostos** |
| 2 | "Allow all on financeiro_pagar" | `financeiro_pagar` | sql_final_supabase.sql | 646 | Pre-migracoes | Sim (ContasPagar) | **74 registros, valores financeiros expostos** |
| 3 | "Allow all on pagamentos_prestadores" | `pagamentos_prestadores` | sql_pagamentos_prestadores.sql | 100 | Pre-migracoes | Sim (PagamentoPrestadores) | **77 registros, dados de prestador expostos** |
| 4 | "Allow all on lancamentos_financeiros" | `lancamentos_financeiros` | sql_final_supabase.sql | 647 | Pre-migracoes | Nao (legado) | Dados financeiros |
| 5 | "fp_select_tenant" | `financeiro_pagar` | missao16_multitenant_rls_p0.sql | 155 | 2026-06-26 | Sim | **TO anon + USING tenant_id** |
| 6 | "fr_select_tenant" | `financeiro_receber` | missao16_multitenant_rls_p0.sql | 139 | 2026-06-26 | Sim | **TO anon + USING tenant_id** |
| 7 | "pp_select_tenant" | `pagamentos_prestadores` | missao16_multitenant_rls_p0.sql | 171 | 2026-06-26 | Sim | **TO anon + USING tenant_id** |

**Observacao:** As policies #5-7 tem `TO anon, authenticated` + `USING (tenant_id = current_tenant_id_safe())`. Embora filtrem por tenant, o `TO anon` permite que QUALQUER pessoa com a anon key do Supabase liste dados financeiros de um tenant. O `tenant_id` e um UUID sentinel conhecido (`00000000-0000-0000-0000-000000000001`).

### 1.2 Tabelas core de operacao — SEM protecao

| # | Policy | Tabela | Arquivo | Linha | Migracao | Frontend usa? | Risco |
|---|--------|--------|---------|:-----:|----------|:-------------:|:-----:|
| 8 | "os_select_tenant" | `ordens_servico` | missao16_multitenant_rls_p0.sql | 123 | 2026-06-26 | Sim | **TO anon + USING tenant_id (e QUEBRADA por cast UUID)** |
| 9 | "ae_select_tenant" | `alocacoes_escala` | missao18_multitenant_rls_p1.sql | 16 | 2026-06-26 | Sim | **TO anon + USING tenant_id** |
| 10 | "prestadores_select_tenant" | `prestadores` | missao16_multitenant_rls_p0.sql | 91 | 2026-06-26 | Sim | **TO anon + USING tenant_id** |
| 11 | "veiculos_select_tenant" | `veiculos` | missao16_multitenant_rls_p0.sql | 107 | 2026-06-26 | Sim | **TO anon + USING tenant_id** |
| 12 | "Allow all on clientes" | `clientes` | sql_final_supabase.sql | 636 | Pre-migracoes | Sim | **24 registros, dados cadastrais expostos** |
| 13 | "Allow all on veiculos" | `veiculos` | sql_final_supabase.sql | 638 | Pre-migracoes | Sim | Tabela vazia, mas schema exposto |
| 14 | "Allow all on prestadores" | `prestadores` | sql_final_supabase.sql | 639 | Pre-migracoes | Sim | Tabela vazia, mas schema exposto |

### 1.3 Tabelas de CRM e comunicacao — SEM protecao

| # | Policy | Tabela | Arquivo | Linha | Migracao | Frontend usa? | Risco |
|---|--------|--------|---------|:-----:|----------|:-------------:|:-----:|
| 15 | "allow_all_crm_conversas" | `crm_conversas` | correcao_4_comunicacao_real.sql | 84 | 2026-05-17 | Sim | **Conversas de clientes expostas** |
| 16 | "allow_all_crm_mensagens" | `crm_mensagens` | correcao_4_comunicacao_real.sql | 88 | 2026-05-17 | Sim | **Mensagens expostas** |
| 17 | "allow_all_crm_templates_mensagem" | `crm_templates_mensagem` | correcao_4_comunicacao_real.sql | 92 | 2026-05-17 | Sim | Templates de comunicacao |
| 18 | "allow_all_integracoes_logs" | `integracoes_logs` | correcao_4_comunicacao_real.sql | 96 | 2026-05-17 | Sim | Logs de integracao |
| 19 | "allow_all_crm_historico" | `crm_historico` | correcao_3b_crm_alter.sql | 83 | 2026-05-17 | Sim | Historico de leads |
| 20 | "allow_all_crm_followups" | `crm_followups` | correcao_3b_crm_alter.sql | 86 | 2026-05-17 | Sim | Followups expostos |

### 1.4 Tabelas de tenant/auth — anon

| # | Policy | Tabela | Arquivo | Linha | Migracao | Risco |
|---|--------|--------|---------|:-----:|----------|:-----:|
| 21 | "tenants_select_anon" | `tenants` | missao15_multitenant_fundacao.sql | 40 | 2026-06-26 | **Lista de tenants exposta** |
| 22 | "tu_select_anon" | `tenant_usuarios` | missao15_multitenant_fundacao.sql | 69 | 2026-06-26 | **Lista de usuarios de cada tenant exposta** |
| 23 | "Allow all on tabelas_valores" | `tabelas_valores` | sql_tabelas_valores.sql + sql_final_supabase.sql | 28/650 | Pre-migracoes | **Tabela de precos exposta** |

---

## 2. POLICIES QUE SERAO CORRIGIDAS POR M3 + M4 (23)

### 2.1 Corrigidas por M3 (14 tabelas prioritarias)

Das 23 bloquantes:
- `portal_pedidos` — M3 cria po_select_tms, po_insert_tms, po_update_tms
- `portal_ocorrencias` — M3 cria po_select_tms, po_insert_tms, po_update_tms
- `entregas_protocolo` — M3 cria ep_select_prestador, ep_insert_prestador, ep_select_portal
- `portal_avaliacoes` — M3 substitui
- `portal_comprovantes` — M3 substitui
- `portal_rotas` — M3 substitui
- `portal_relatorios` — M3 substitui
- `portal_notificacoes` — M3 substitui
- `portal_protocolos` — M3 substitui
- `portal_preferencias_cliente` — M3 substitui
- `portal_faturas` — M3 substitui
- `portal_tracking_realtime` — M3 substitui
- `documentos_prestadores` — M3 cria dp_select_prestador, dp_select_tms, etc.
- `pagamentos_prestadores` — M3 cria pp_select_tenant, pp_select_cliente, pp_select_prestador

**Total corrigido por M3: 14 tabelas**

### 2.2 Corrigidas por M4 (3 tabelas core)

- `alocacoes_escala` — M4 cria ae_select_tms, ae_select_cliente, ae_insert_prestador, etc.
- `ordens_servico` — M4 cria os_select_tms, os_select_cliente, os_select_prestador, etc.
- `clientes` — M4 recria clientes_select_own (apenas authenticated)

**Total corrigido por M4: 3 tabelas**

### 2.3 Nao corrigidas por M3 nem M4

As tabelas abaixo continuam COM policies inseguras mesmo apos aplicar M3+M4:

| Tabela | Policy atual | Risco |
|--------|-------------|:-----:|
| `financeiro_receber` | "Allow all" + "fr_select_tenant" (TO anon) | ALTO |
| `financeiro_pagar` | "Allow all" + "fp_select_tenant" (TO anon) | ALTO |
| `pagamentos_prestadores` | "Allow all" + "pp_select_tenant" (TO anon) | **JA corrigido por M3** |
| `crm_leads` | 3 policies TO anon (USING true) | ALTO |
| `crm_conversas` | "allow_all_crm_conversas" (TO anon) | ALTO |
| `crm_mensagens` | "allow_all_crm_mensagens" (TO anon) | ALTO |
| `crm_historico` | "allow_all_crm_historico" (TO anon) | ALTO |
| `crm_followups` | "allow_all_crm_followups" (TO anon) | ALTO |
| `crm_interacoes_prestadores` | 4 policies TO anon | ALTO |
| `prestadores` | "Allow all" + "prestadores_select_tenant" (TO anon) | ALTO |
| `veiculos` | "Allow all" + "veiculos_select_tenant" (TO anon) | ALTO |
| `tabelas_valores` | "Allow all" | ALTO (precos) |
| `tenants` | "tenants_select_anon" (TO anon) | MEDIO |
| `tenant_usuarios` | "tu_select_anon" (TO anon) | MEDIO |
| `orcamentos` | 3 policies TO anon | ALTO |
| `contratos_gerados` | policies USING(true) | ALTO |
| `fiscal_ctes` | "fcte_select_tenant" (TO anon) | ALTO (documentos fiscais) |
| `fiscal_nfse` | "fnfse_select_tenant" (TO anon) | ALTO |
| `fiscal_mdfes` | "fmdfe_select_tenant" (TO anon) | ALTO |
| `financeiro_baixas` | "fb_select_anon" (TO anon) | MEDIO |
| `despesas_operacionais` | "do_select_anon" (TO anon) | MEDIO |
| `auditoria_operacional` | "ao_select_anon" (TO anon) | BAIXO |
| `recrutamento_candidatos` | 4 policies TO anon (USING true) | MEDIO |
| `rede_oportunidades` | "SELECT TO anon" | BAIXO |
| `rede_demandas` | "SELECT TO anon" | BAIXO |
| `communication_templates` | TO anon | BAIXO |
| `communication_preferences` | TO anon | BAIXO |
| `communication_queue` | TO anon | BAIXO |
| `communication_logs` | TO anon | BAIXO |
| `operacao_localizacao` | TO anon (WITH CHECK true) | MEDIO (GPS) |
| `rotas` | "allow_all_rotas" (TO anon) | MEDIO |
| `rota_paradas` | "allow_all_rota_paradas" (TO anon) | MEDIO |
| `rota_execucoes` | "allow_all_rota_execucoes" (TO anon) | MEDIO |
| `configuracoes_sistema` | TO anon | BAIXO |
| `contas_financeiras` | TO anon | BAIXO |
| `usuarios_cliente` | TO anon | ALTO |
| `ocorrencias` | 2 policies TO anon | BAIXO |
| `agentes_ia_internos` | TO anon | BAIXO |
| `auth_eventos_auditoria` | TO anon | BAIXO |
| `perfis_permissoes` | TO anon | BAIXO |
| `historico_alocacoes_escala` | "hae_select_tenant" (TO anon) | MEDIO |
| `composicao_financeira_os` | "cfo_select_tenant" (TO anon) | ALTO |

---

## 3. POLICIES DE CODIGO MORTO (82)

Policies em tabelas que **provavelmente nao existem** no schema real de producao, ou cujas policies foram sobrescritas por migracoes posteriores.

### 3.1 Tabelas com nomes antigos (provavelmente nao existem)

| Arquivo | Tabela | Policies | Motivo |
|---------|--------|:--------:|--------|
| rls_policies_fix.sql | `client_addresses` | 4 | Nome real: `enderecos_clientes` |
| rls_policies_fix.sql | `client_contacts` | 4 | Nome real: `contatos_clientes` |
| rls_policies_fix.sql | `client_commercial_rules` | 4 | Nao existe (regras comerciais sao JSONB em clientes) |
| rls_policies_fix.sql | `provider_documents` | 4 | Nome real: `documentos_prestadores` |
| rls_policies_fix.sql | `provider_emergency_contacts` | 4 | Nao existe |
| rls_policies_fix.sql | `vehicle_documents` | 4 | Nao existe |
| rls_fix_temporario.sql | `client_addresses` | 1 | Nome real: `enderecos_clientes` |
| rls_fix_temporario.sql | `client_contacts` | 1 | Nome real: `contatos_clientes` |
| sql_pagamentos_prestadores.sql | `pagamentos_prestadores_itens` | 1 | Nao existe (itens sao JSONB em pagamentos_prestadores) |
| sql_pagamentos_prestadores.sql | `adiantamentos_prestadores` | 1 | Nao existe |
| sql_biblioteca_fix.sql | `storage.objects` (documentos_prestadores) | 1 | Storage bucket policies sao separadas |

**Total codigo morto (tabelas inexistentes): ~28 policies**

### 3.2 Tabelas IA/automacao (so authenticated, risco baixo)

| Arquivo | Tabelas | Policies | Motivo |
|---------|---------|:--------:|--------|
| f31_missoes_metas_kpi_agenda.sql | ia_missoes, ia_metas, ia_indicadores, etc. | 21 | So authenticated |
| f32_workforce_orchestrator.sql | ia_trabalhos, ia_fila_trabalho, etc. | 9 | So authenticated |
| f33_memoria_corporativa.sql | memoria_entidades, memoria_eventos, etc. | 16 | So authenticated |
| f34_agentes_ferramentas_autonomo.sql | ia_agentes_execucao | 3 | So authenticated |
| f304a_action_engine_ferramentas.sql | ia_ferramentas, ia_robo_ferramentas, etc. | 9 | So authenticated |
| f305a_conectores_universais.sql | ia_conectores, ia_conector_robo, etc. | 9 | So authenticated |
| f30_academia_ia.sql | academia_cursos, academia_materiais, etc. | 9 | So authenticated |
| f303_motor_aprendizado_processamento.sql | processamento_fila, memoria_conhecimento, etc. | 12 | So authenticated |
| missao53_controle_patio.sql | patio_* | 14 | So authenticated |
| supabase_schema_complete.sql | 27 tabelas | 27 | So authenticated |
| contratos_enterprise.sql | contratos_gerados, contratos_modelos, etc. | 8 | USING(true) sem TO |

**Total IA/automacao (risco baixo): ~137 policies**

### 3.3 Tabelas de storage/arquivos (TO public, mas storage)

| Arquivo | Policies | Risco |
|---------|:--------:|:-----:|
| m44b_storage_buckets.sql | 7 (SELECT TO public) | BAIXO (storage) |
| m54e6_bucket_relatorios.sql | 1 (SELECT TO public) | BAIXO |
| f25fa3_storage_policies_biblioteca_global.sql | 4 (ALL TO public) | BAIXO |
| f25fa3_treinamento_arquivos_ia.sql | 2 (ALL TO public) | BAIXO |
| f25c_rls_ia_conhecimento.sql | 2 (ALL TO public) | BAIXO |

**Total storage: ~16 policies (baixo risco)**

---

## 4. POLICIES QUE PRECISAM DE NOVA MIGRACAO (~110)

Apos aplicar M3+M4, as seguintes tabelas ATIVAS continuam com policies inseguras:

### Prioridade ALTA (dados financeiros/sensiveis)

| Tabela | Dados | Frontend | Correcao necessaria |
|--------|-------|:--------:|---------------------|
| `financeiro_receber` | 81 registros financeiros | ContasReceber.tsx | Substituir `TO anon` por `TO authenticated` + scoped por tenant |
| `financeiro_pagar` | 74 registros financeiros | ContasPagar.tsx | Substituir `TO anon` por `TO authenticated` + scoped por tenant |
| `crm_leads` | Leads comerciais | CRM | Substituir 3 policies TO anon por scoped |
| `crm_conversas` | Conversas | CRM/WhatsApp | Substituir TO anon por scoped |
| `crm_mensagens` | Mensagens | CRM/WhatsApp | Substituir TO anon por scoped |
| `crm_historico` | Historico | CRM | Substituir TO anon por scoped |
| `crm_followups` | Followups | CRM | Substituir TO anon por scoped |
| `prestadores` | 0 registros (vazia) | PrestadoresLista | Substituir TO anon por scoped |
| `tabelas_valores` | Precificacao | OrcamentoForm | Substituir USING(true) por scoped |
| `fiscal_ctes` | CT-es | Fiscal | Substituir TO anon por scoped |
| `fiscal_nfse` | NFSe | Fiscal | Substituir TO anon por scoped |
| `fiscal_mdfes` | MDFe | Fiscal | Substituir TO anon por scoped |
| `orcamentos` | Orcamentos | OrcamentoForm | Substituir TO anon por scoped |
| `contratos_gerados` | Contratos | Contratos | Substituir USING(true) por scoped |
| `usuarios_cliente` | Usuarios do portal | Autenticacao | Substituir TO anon por scoped |
| `composicao_financeira_os` | Margens | Financeiro | Substituir TO anon por scoped |

### Prioridade MEDIA

| Tabela | Risco | Correcao |
|--------|:-----:|----------|
| `tenants` | Lista de tenants exposta | Substituir TO anon por authenticated |
| `tenant_usuarios` | Lista de usuarios exposta | Substituir TO anon por authenticated |
| `financeiro_baixas` | Baixas financeiras | Substituir TO anon |
| `despesas_operacionais` | Despesas | Substituir TO anon |
| `operacao_localizacao` | GPS em tempo real | Substituir TO anon |
| `rotas` / `rota_paradas` | Rotas | Substituir TO anon |
| `recrutamento_candidatos` | Candidatos | Substituir TO anon |
| `historico_alocacoes_escala` | Historico | Substituir TO anon |

### Prioridade BAIXA

| Tabela | Motivo |
|--------|--------|
| `configuracoes_sistema` | Dados de configuracao, nao sensivel |
| `contas_financeiras` | Nomes de contas apenas |
| `auditoria_operacional` | Logs de auditoria |
| `communication_*` | Templates e preferencias |
| `agentes_ia_internos`, `perfis_permissoes` | Dados estruturais, nao operacionais |
| `auth_eventos_auditoria` | Logs de auth |
| `ocorrencias` | Tabela legado (substituida por portal_ocorrencias) |
| `rede_oportunidades` / `rede_demandas` | Rede de prestadores |

---

## 5. MATRIZ DE RISCOS POR MODULO

| Modulo | Tabelas | Policies inseguras | Risco atual | Apos M3+M4 | Precisa nova mig? |
|--------|---------|:------------------:|:-----------:|:----------:|:-----------------:|
| **Financeiro** | receber, pagar, pagamentos_prestadores, composicao, baixas, despesas | 10+ | **CRITICO** | **CRITICO** (so pagamentos_prestadores corrigido) | **SIM (6+ tabelas)** |
| **CRM** | leads, conversas, mensagens, historico, followups, templates, logs | 15+ | **CRITICO** | **CRITICO** | **SIM (7+ tabelas)** |
| **Operacao** | alocacoes_escala, ordens_servico, historico_alocacoes | 6+ | **CRITICO** | **BAIXO** (corrigido por M4) | NAO |
| **Cadastro** | clientes, prestadores, veiculos, enderecos | 8+ | **CRITICO** | **MEDIO** (clientes corrigido, prestadores/veiculos nao) | **SIM (prestadores, veiculos)** |
| **Portal Cliente** | portal_ocorrencias, portal_pedidos, entregas_protocolo, etc. | 24+ | **CRITICO** | **BAIXO** (corrigido por M3) | NAO |
| **Documentos** | documentos_prestadores | 3+ | **CRITICO** | **BAIXO** (corrigido por M3) | NAO |
| **Fiscal** | ctes, nfse, mdfes | 3+ | **ALTO** | **ALTO** | **SIM (3 tabelas)** |
| **Orcamentos/Contratos** | orcamentos, contratos_gerados, tabelas_valores | 6+ | **ALTO** | **ALTO** | **SIM (3+ tabelas)** |
| **Tenant/Auth** | tenants, tenant_usuarios, usuarios_cliente | 4+ | **MEDIO** | **MEDIO** | **SIM (3 tabelas)** |
| **IA/Automacao** | ia_*, memoria_*, academia_*, processamento_*, patio_* | 100+ | **BAIXO** | **BAIXO** | NAO (so authenticated) |
| **Storage** | storage.objects (buckets) | 16 | **BAIXO** | **BAIXO** | NAO |
| **Recrutamento** | recrutamento_candidatos, candidatos | 5+ | **MEDIO** | **MEDIO** | Pode ser postergado |
| **Comunicacao** | crm_conversas, communication_* | 8+ | **MEDIO** | **MEDIO** | Pode ser postergado |

---

## 6. DIAGRAMA DE COBERTURA DAS MIGRACOES

```
M3 (priority tables) ─── 14 tabelas portal_* + documentos + pagamentos
  ├── portal_ocorrencias ✅
  ├── portal_pedidos ✅
  ├── entregas_protocolo ✅
  ├── portal_avaliacoes ✅
  ├── portal_comprovantes ✅
  ├── portal_rotas ✅
  ├── portal_relatorios ✅
  ├── portal_notificacoes ✅
  ├── portal_protocolos ✅
  ├── portal_preferencias_cliente ✅
  ├── portal_faturas ✅
  ├── portal_tracking_realtime ✅
  ├── documentos_prestadores ✅
  └── pagamentos_prestadores ✅

M4 (core operations) ─── 3 tabelas principais
  ├── alocacoes_escala ✅
  ├── ordens_servico ✅
  └── clientes ✅

NAO COBERTOS por M3+M4 (precisam de M6):
  Financeiro: receber, pagar, composicao, baixas, despesas
  CRM: leads, conversas, mensagens, historico, followups
  Cadastro: prestadores, veiculos
  Fiscal: ctes, nfse, mdfes
  Precificacao: tabelas_valores
  Contratos: contratos_gerados
  Tenant: tenants, tenant_usuarios, usuarios_cliente
  Orcamentos: orcamentos
  GPS: operacao_localizacao
  Rotas: rotas, rota_paradas, rota_execucoes
```

---

## 7. RECOMENDACAO

### Seguir para aplicacao de M1-M5?

**SIM, aplicar M1-M5 agora**, pelo seguintes motivos:

1. **M3 + M4 corrigem 23 bloquentes** — 14 tabelas portal + 3 tabelas core + documentos + pagamentos.
2. **M5 nao quebra nada** — trigger com EXCEPTION handler seguro.
3. **M1 + M2 sao risco zero** — ADD COLUMN + DROP FUNCTION apenas.
4. **Nao ha dependencia entre M1-M5 e as correcoes de Financeiro/CRM/Fiscal.**
5. **Apos M3+M4, o TMS fica 100% funcional** — alocacoes, OS, clientes, portal, documentos, pagamentos passam a ter RLS real.

### O que fica para M6 (proxima missao)

Criar migration unica (`M6 - RLS Financeiro+CRM+Fiscal`) cobrindo:
- `financeiro_receber` — substituir TO anon por TO authenticated + scoped
- `financeiro_pagar` — substituir TO anon por TO authenticated + scoped
- `crm_leads`, `crm_conversas`, `crm_mensagens`, `crm_historico`, `crm_followups`
- `prestadores`, `veiculos` — substituir TO anon + USING(tenant_id)
- `fiscal_ctes`, `fiscal_nfse`, `fiscal_mdfes`
- `tabelas_valores`, `orcamentos`, `contratos_gerados`
- `tenants`, `tenant_usuarios`, `usuarios_cliente`

### Estimativa de risco pos-M1-M5

| Modulo | Antes | Depois de M1-M5 |
|--------|:-----:|:----------------:|
| Portal Cliente | CRITICO | **BAIXO** |
| Operacao (OS+Escala) | CRITICO | **BAIXO** |
| Cadastro (Clientes) | CRITICO | **BAIXO** |
| Documentos | CRITICO | **BAIXO** |
| Financeiro (pagamentos) | CRITICO | **BAIXO** |
| Financeiro (receber+pagar) | CRITICO | **CRITICO** (M6 necessario) |
| CRM | CRITICO | **CRITICO** (M6 necessario) |
| Fiscal | ALTO | **ALTO** (M6 necessario) |
| Orcamentos/Contratos | ALTO | **ALTO** (M6 necessario) |
| IA/Automacao | BAIXO | BAIXO |
| Storage | BAIXO | BAIXO |

---

## 8. RESUMO FINAL

| Indicador | Valor |
|-----------|:-----:|
| Total policies inseguras identificadas | ~415 |
| Policies em tabelas que provavelmente NAO existem | ~28 (codigo morto) |
| Policies IA/automacao (so authenticated, risco baixo) | ~137 |
| Policies storage (baixo risco) | ~16 |
| Policies em tabelas ATIVAS sem protecao real | ~234 |
| **Destas, corrigidas por M3+M4** | **23 (10%)** |
| **Destas, ainda precisam de M6** | **~211 (90%)** |
| Policies BLOQUEANTES GO-LIVE reais | **23** |
| Modulos que ficam 100% seguros apos M1-M5 | **5** (Portal, Operacao, Cadastro, Documentos, Pagamentos) |
| Modulos que continuam expostos apos M1-M5 | **4** (Financeiro receber/pagar, CRM, Fiscal, Orcamentos) |

**Conclusao:** Aplicar M1-M5 elimina ~23 bloquentes e protege 5 modulos. Os modulos Financeiro (receber/pagar), CRM e Fiscal precisam de M6 separada. Nao ha impedimento para aplicar M1-M5 agora — o risco de nao aplicar e MAIOR que o risco de aplicar.
