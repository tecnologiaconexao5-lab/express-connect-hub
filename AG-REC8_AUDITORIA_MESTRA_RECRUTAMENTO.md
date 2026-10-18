# AG-REC.8 — AUDITORIA MESTRA DO MÓDULO RECRUTAMENTO V2

**Data:** 2026-08-31
**Ambiente:** TMS — express-connect-hub
**Escopo:** Audit-only. Nenhuma migration, INSERT, UPDATE ou DELETE executado.

---

## 1 — MAPA COMPLETO DAS TELAS DO RECRUTAMENTO

### 1.1 Rotas e Componentes

| Rota | Componente | Fonte Dados | Status |
|------|-----------|-------------|--------|
| `/recrutamento` | `RecrutamentoModule` (14 seções via tabs) | Híbrido | PARCIAL |
| `/recrutamento/whatsapp-crm` | `WhatsAppCRMLayout` (9 sub-componentes) | **100% localStorage** | MOCK |
| `/recrutamento/banco-talentos` | `BancoTalentosLayout` (8 sub-componentes) | **100% Zustand in-memory** | MOCK |
| `/robo-recrutamento-monitor` | `RoboRecrutamentoMonitor` | Supabase `automacoes_logs` + `ia_logs` | REAL |

### 1.2 Seções do Módulo Principal (`/recrutamento`)

| # | Seção | Componente | Fonte | Real/Mock |
|---|-------|-----------|-------|-----------|
| 1 | Dashboard | `DashboardRecrutamento` | Supabase (queries count) | **REAL** (parcial — 3/6 KPIs mockados) |
| 2 | Pipeline | `EnterpriseKanbanBoard` | Supabase `recrutamento_candidatos` | **REAL** |
| 3 | Operações | `PaginaOperacoes` | Supabase `recrutamento_operacoes` | **REAL** |
| 4 | Prestadores | `PaginaPrestadores` | Supabase `recrutamento_prestadores` + localStorage fallback | **PARCIAL** |
| 5 | Banco de Talentos | `BancoTalentos` (module) | Supabase `recrutamento_candidatos` | **REAL** |
| 6 | Operacionais | `PrestadoresAptos` | Supabase `recrutamento_candidatos` (stage=ativo) | **REAL** |
| 7 | CRM | `CrmLogistico` | Supabase `crm_interacoes_prestadores` | **REAL** |
| 8 | Documentos | `CentralDocumentos` | **localStorage** (`documentosService`) | **MOCK** |
| 9 | IA Operacional | `IAOperacional` | Supabase queries + `proxy-ia` Edge Function | **PARCIAL** |
| 10 | Automações | `AutomacoesList` | **localStorage** (`automacoesService`) | **MOCK** |
| 11 | Portal do Prestador | `PortalPrestadorPreview` | Hardcoded preview | **DEMO** |
| 12 | Score | ScoreMeter grid | localStorage (prestadores[].score.geral) | **MOCK** |
| 13 | Onboarding | `OnboardingWizard` | localStorage (Zustand store) | **DEMO** |

### 1.3 Componentes Legados Não-Roteados (`src/components/recrutamento/`)

| Componente | Status | Notas |
|-----------|--------|-------|
| `WhatsAppIAPrestadores` | LEGACY | 852 linhas, superseded por `/whatsapp-crm` |
| `TriagemIA` | MOCK | Candidato hardcoded "Rafael Almeida", setTimeout mock |
| `Homologacao` | PARCIAL | Queries `candidatos` + `homologacoes` via Supabase |
| `Captacao` | DEMO | Static link + form, sem DB |
| `BancoMotoristas` | ORPHAN | Não importado por nenhuma rota |
| `BancoReservas` | ORPHAN | Não importado por nenhuma rota |
| `DisparosWhatsApp` | ORPHAN | Não importado |
| `AcompanhamentoDocs` | ORPHAN | Não importado |
| `IndicadoresRI` | MOCK | Dados hardcoded |
| `RecrutamentoAnalytics` | MOCK | `Math.random()` para métricas |

### 1.4 Services Layer

| Service | Arquivo | DB Access | Status |
|---------|---------|-----------|--------|
| `operacoesService` | `modules/.../services/operacoesService.ts` | Supabase `recrutamento_operacoes` | REAL |
| `prestadoresService` | `modules/.../services/prestadoresService.ts` | Supabase + localStorage fallback | PARCIAL |
| `documentosService` | `modules/.../services/documentosService.ts` | **localStorage only** | MOCK |
| `automacoesService` | `modules/.../services/automacoesService.ts` | **localStorage only** | MOCK |
| `crmService` | `modules/.../services/crmService.ts` | Supabase `crm_interacoes_prestadores` | REAL |
| `iaService` | `modules/.../services/iaService.ts` | Mock (random scores) | MOCK |
| `scoreService` | `modules/.../services/scoreService.ts` | Computed (no DB) | PARCIAL |
| `conversaoCandidatoService` | `modules/.../services/conversaoCandidatoService.ts` | Supabase `recrutamento_candidatos` + `prestadores` | REAL |
| `enterpriseKanbanService` | `components/enterprise-kanban/enterpriseKanbanService.ts` | Supabase `recrutamento_candidatos` | REAL |
| `recrutamentoScoreService` | `src/services/recrutamento/recrutamentoScoreService.ts` | **Hardcoded** (retorna 50) | STUB |
| `roboRecrutamentoService` | `src/services/centralIa/roboRecrutamentoService.ts` | Supabase `automacoes_robos` + `automacoes_logs` | REAL |

### 1.5 Hooks

| Hook | Fonte | Status |
|------|-------|--------|
| `useDashboardRecrutamento` | Supabase (count queries) | REAL |
| `useMetricasRecrutamento` | Supabase via enterpriseKanbanService | REAL |
| `useOperacoes` | Supabase via operacoesService | REAL |
| `usePrestadores` | Supabase + localStorage | PARCIAL |
| `useKanbanRealtime` | Supabase Realtime `recrutamento_candidatos` | REAL |
| `useRecrutamentoRealtime` | Supabase Realtime `recrutamento_prestadores` | REAL |
| `usePrestadoresAptosRecrutamento` | Supabase via enterpriseKanbanService | REAL |

### 1.6 Resumo: REAL vs MOCK

| Categoria | Componentes | Real DB | Mock/Local | Híbrido |
|-----------|------------|---------|------------|---------|
| Seções módulo principal | 14 | 7 (50%) | 4 (29%) | 3 (21%) |
| WhatsApp CRM (rota) | 9 | 0 | 9 | 0 |
| Banco Talentos (rota) | 8 | 0 | 8 | 0 |
| Enterprise Kanban | 14 | 6 | 0 | 0 |
| Legacy não-roteados | 10 | 1 | 2 | 0 |
| **TOTAL** | **~55** | **~14 (25%)** | **~23 (42%)** | **~3 (5%)** |

---

## 2 — MAPA DE ENTIDADES

### 2.1 Tabelas do Módulo Recrutamento

| Tabela | Propósito | Registros estimados |
|--------|----------|---------------------|
| `prestadores` | **FONTES MESTRA** — prestadores aprovados/ativos | Real |
| `recrutamento_candidatos` | Pipeline Enterprise (16 estágios) | Real |
| `recrutamento_prestadores` | Dados de recrutamento (scoring, onboarding) | Real |
| `recrutamento_operacoes` | Vagas/operações de recrutamento | Real |
| `candidatos` | **LEGACY** — cadastro via link direto | Real |
| `documentos_prestadores` | Documentos vinculados | Real |
| `provider_documents` | **DUPLICATA** de documentos_prestadores | Real |
| `crm_interacoes_prestadores` | Interações CRM por prestador | Real |
| `crm_leads` | Pipeline comercial (clientes) | Real |
| `crm_historico` | Histórico CRM | Real |
| `crm_followups` | Follow-ups CRM | Real |
| `crm_conversas` / `crm_mensagens` | Mensagens CRM | Real |
| `homologacoes` | Registros de homologação | Real |
| `operacoes` | **DUPLICATA** de recrutamento_operacoes | Real |
| `fluxo_recrutamento` | Etapas do fluxo (Biblioteca) | Real |
| `reservas_banco` | Reservas do banco de talentos | **SEM MIGRATION** |
| `rede_oportunidades` | Oportunidades da rede enterprise | Real |
| `rede_visualizacoes` | Visualizações de oportunidades | Real |

### 2.2 Diagrama de Relacionamento

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUXO APP MOTORISTA                         │
│                                                                     │
│  App Flutter ──signUp()──► auth.users                               │
│       │                                                              │
│       ├──app_s6_cpf_cnpj_ja_cadastrado()──► prestadores (dedup)    │
│       │                                                              │
│       └──app_s6_criar_prestador()──► INSERT prestadores             │
│            (status=em_analise, liberado_app=false)                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ENTERPRISE KANBAN (BRIDGE)                     │
│                                                                     │
│  enterpriseKanbanService.buscarECadastrarAppPrestadores()          │
│       │                                                              │
│       ├── Busca prestadores WHERE origem='app_motorista'            │
│       │   E NÃO existem em recrutamento_candidatos                  │
│       │                                                              │
│       └── INSERT recrutamento_candidatos (stage=novo_cadastro)      │
│            (tags=['app_motorista'], score=65, mock data)            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PIPELINE ENTERPRISE (16 ESTÁGIOS)                │
│                                                                     │
│  novo_cadastro → pre_triagem → interesse_confirmado → em_analise   │
│  → documentacao_pendente → em_validacao → entrevista                │
│  → em_treinamento → homologacao → confirmacao_inicio               │
│  → aprovado → prestador_apto → ativo → operacao_ativa              │
│                                                                     │
│  Terminais: bloqueado, reprovado                                    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼ (quando stage=aprovado/ativo)
┌─────────────────────────────────────────────────────────────────────┐
│                     CONVERSÃO → PRESTADOR REAL                     │
│                                                                     │
│  conversaoCandidatoService.converterCandidatoParaPrestador()       │
│       │                                                              │
│       ├── Gate documental: statusDocumental === 'completo'          │
│       ├── Dedup: busca por telefone/email em recrutamento_prestadores│
│       ├── INSERT/UPDATE prestadores (status=ativo)                  │
│       ├── UPDATE liberado_app = true                                │
│       └── UPDATE recrutamento_candidatos (stage=ativo, prestador_id)│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     TABELAS PARALELAS (REDUNDÂNCIA)                │
│                                                                     │
│  candidatos (LEGACY) ◄──NÃO SINCRONIZA──► recrutamento_candidatos  │
│                                                                     │
│  recrutamento_operacoes ◄──DUPLICATA──► operacoes                   │
│                                                                     │
│  documentos_prestadores ◄──DUPLICATA──► provider_documents          │
│                                                                     │
│  crm_leads (COMERCIAL) ◄──DOMINIO DIFERENTE──► recrutamento_*      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Respostas às Perguntas-Chave

| Pergunta | Resposta |
|----------|----------|
| **Qual entidade representa o candidato?** | `recrutamento_candidatos` (Enterprise) + `candidatos` (Legacy) — duas fontes sem sincronização |
| **Qual representa o prestador?** | `prestadores` (tabela operacional canônica) + `recrutamento_prestadores` (dados de workflow) |
| **Quando deixa de ser candidato?** | Quando `stage` atinge `aprovado`/`ativo` e `conversaoCandidatoService` executa |
| **Quando passa a ser prestador?** | Ao converter: INSERT em `prestadores` com `status=ativo` |
| **O APP cria prestador antes da aprovação?** | SIM — `app_s6_criar_prestador()` cria com `status=em_analise, liberado_app=false` |
| **Como evitar duplicação?** | `conversaoCandidatoService.buscarDuplicata()` busca por telefone/email. Sem UNIQUE constraint no banco |
| **Existe representação dupla?** | SIM — `prestadores` (operacional) + `recrutamento_prestadores` (workflow) + `recrutamento_candidatos` (pipeline) = 3 tabelas para a mesma pessoa |
| **Fonte mestre antes da aprovação?** | `recrutamento_candidatos` |
| **Fonte mestre depois da aprovação?** | `prestadores` |
| **Constraints de duplicidade?** | **NENHUMA** — sem UNIQUE em auth_user_id, cpf_cnpj, email ou telefone |

---

## 3 — AUDITORIA DO CADASTRO DO APP

### 3.1 Fluxo Real em Produção

```
App Flutter (PWA)
    │
    ├── 1. supabase.auth.signUp() → auth.users (email + password)
    │
    ├── 2. app_s6_cpf_cnpj_ja_cadastrado(p_cpf_cnpj) → BOOLEAN
    │      Normaliza (só dígitos), busca em prestadores
    │
    ├── 3. app_s6_criar_prestador(p_nome, p_cpf, p_tel, p_email, ...)
    │      │
    │      ├── SECURITY DEFINER, auth.uid() obrigatório
    │      ├── Idempotente: retorna prestador existente se auth_user_id já vinculado
    │      ├── Hardcoded: status='em_analise', liberado_app=false
    │      ├── Ignora p_liberado_app (parâmetro aceito mas descartado)
    │      └── Returns: { prestador_id: UUID }
    │
    ├── 4. Prestador criado em `prestadores`
    │      (origem_cadastro='app_motorista', auth_user_id=auth.uid())
    │
    └── 5. Documentos uploadados separadamente (App → Storage → documentos_prestadores)

Bridge (TMS-side):
    │
    ├── enterpriseKanbanService.buscarECadastrarAppPrestadores()
    │      │
    │      ├── Executa ao ABRIR a tela Pipeline (polling, não event-driven)
    │      ├── Busca: prestadores WHERE origem='app_motorista'
    │      ├── Filtra: NÃO existem em recrutamento_candidatos
    │      ├── Para cada um: INSERT recrutamento_candidatos
    │      │   (stage=novo_cadastro, tags=['app_motorista'], score=65)
    │      └── Dados: NOME MOCKADO, CIDADE ALEATÓRIA, VEÍCULO ALEATÓRIO
    │
    └── Candidato aparece no Kanban com dados mockados (não reais do App)
```

### 3.2 Contrato Real da RPC `app_s6_criar_prestador`

```sql
-- Fonte: 20260829_ag07j18_4_rpc_cadastro_app.sql
CREATE OR REPLACE FUNCTION app_s6_criar_prestador(
  p_nome_completo TEXT, p_cpf_cnpj TEXT, p_data_nascimento TEXT,
  p_telefone TEXT, p_email TEXT, p_auth_email TEXT, p_senha TEXT,
  p_status TEXT, p_origem TEXT, p_liberado_app BOOLEAN, p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Executa com permissões do owner
SET search_path = public
AS $$
  -- auth.uid() obrigatório
  -- Normaliza CPF/CNPJ (só dígitos)
  -- Verifica se auth_user_id já vinculado → retorna existente
  -- INSERT: status='em_analise', liberado_app=FALSE (hardcoded)
  -- origem_cadastro='app_motorista' (hardcoded)
  -- p_liberado_app é ACEITO mas IGNORADO
$$;

-- Grants: REVOKE PUBLIC, REVOKE anon, GRANT authenticated
```

### 3.3 Idempotência e Segurança

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| Idempotência | ✅ | Retorna prestador existente se auth_user já vinculado |
| Anti-spoof liberado_app | ✅ | Hardcoded `false`, ignora parâmetro |
| auth.uid() obrigatório | ✅ | SECURITY DEFINER + check |
| Dedup por CPF/CNPJ | ✅ | Normaliza e verifica antes de INSERT |
| Retry/fallback | ❌ | Sem retry em caso de falha |
| Usuário órfão | ⚠️ | Se signUp OK mas RPC falha, auth.user existe sem prestador |
| Dados reais no Bridge | ❌ | Bridge gera NOME/CIDADE/VEÍCULO mockados |

### 3.4 Problemas do Fluxo

| # | Problema | Gravidade |
|---|----------|-----------|
| 1 | Bridge usa polling (só roda ao abrir Pipeline), não event-driven | ALTA |
| 2 | Bridge gera dados MOCKADOS (nome, cidade, veículo) em vez de ler do prestador real | ALTA |
| 3 | Sem trigger automático no INSERT de prestadores para criar candidato no pipeline | ALTA |
| 4 | Usuário órfão possível (auth.user sem prestador) | MÉDIA |
| 5 | RPC não cria veículo nem documentos | MÉDIA |
| 6 | Sem Edge Function de sincronização | MÉDIA |

---

## 4 — AUDITORIA DO BRIDGE APP → RECRUTAMENTO

### 4.1 `enterpriseKanbanService.buscarECadastrarAppPrestadores()`

**Arquivo:** `src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts`

| Pergunta | Resposta |
|----------|----------|
| **O bridge ainda é necessário?** | SIM — é o único caminho que conecta App ao Pipeline |
| **Por que não existe criação atômica?** | Porque o App cria em `prestadores` e o Pipeline lê de `recrutamento_candidatos` — tabelas diferentes sem FK |
| **Quem chama o bridge?** | `useEnterpriseKanban` hook → executado ao montar `EnterpriseKanbanBoard` |
| **Quando roda?** | Ao abrir a aba Pipeline (polling por abertura de tela) |
| **Depende de abrir Pipeline?** | SIM — se ninguém abrir a tela, candidatos do App ficam órfãos |
| **Existe catch silencioso?** | SIM — `catch {}` vazio em várias partes |
| **Risco de perder cadastro?** | BAIXO — dados ficam em `prestadores`, mas sem pipeline |
| **Risco de duplicar candidato?** | MÉDIO — verificação por `origem='app_motorista'` mas sem UNIQUE |
| **Existe trigger?** | NÃO |
| **Existe realtime?** | NÃO (para este fluxo específico) |
| **Existe cron/scheduler?** | NÃO |
| **Existe Edge Function?** | NÃO |

### 4.2 Classificação: **FRÁGIL**

O bridge funciona quando alguém abre o Pipeline, mas:
- Não é event-driven (depende de ação humana)
- Gera dados mockados em vez de ler dados reais do App
- Não tem fallback se falhar
- Não cria documentos nem veículos

---

## 5 — PIPELINE PROFISSIONAL (16 ESTÁGIOS)

### 5.1 Definição dos 16 Estágios

| # | Stage ID | Título | Significado | Condição Saída | Gate Documental | Pode Voltar? |
|---|----------|--------|-------------|----------------|-----------------|--------------|
| 1 | `novo_cadastro` | Novo Lead | Cadastro recém-chegado (App/manual/link) | Movido manualmente ou por automação | Não | SIM → pre_triagem, em_analise |
| 2 | `pre_triagem` | Pré-Triagem | Verificação inicial de perfil | Contato inicial realizado | Não | SIM → interesse_confirmado, em_analise |
| 3 | `interesse_confirmado` | Interesse Confirmado | Candidato confirmou interesse na vaga | Encaminhado para documentação | Não | SIM → documentacao_pendente, em_analise |
| 4 | `em_analise` | Em Análise | Análise detalhada do perfil | Decisão tomada | Não | SIM → documentacao_pendente, pre_triagem, entrevista |
| 5 | `documentacao_pendente` | Documentação | Aguardando envio/validação de docs | Docs completos | **SIM** — CNH, CRLV, Comprovante | SIM → em_validacao, em_treinamento |
| 6 | `em_validacao` | Em Validação | Verificação documental e operacional | Validação aprovada | **SIM** | SIM → entrevista, aprovado |
| 7 | `entrevista` | Entrevista | Entrevista presencial/telefônica | Entrevista concluída | Não | SIM → em_treinamento, aprovado |
| 8 | `em_treinamento` | Treinamento | capacitação operacional (MOPP, etc.) | Treinamento concluído | Não | SIM → homologacao, aprovado |
| 9 | `homologacao` | Homologação | Validação final de elegibilidade | Homologação aprovada | **SIM** | SIM → confirmacao_inicio |
| 10 | `confirmacao_inicio` | Conf. de Início | Confirmação de data e condições | Candidato confirma | Não | SIM → prestador_apto |
| 11 | `aprovado` | Aprovado | Aprovado para operação | Conversão para prestador | **SIM** | SIM → prestador_apto, ativo |
| 12 | `prestador_apto` | Prestador Apto | Pronto para receber operações | Primeira alocação | Não | SIM → operacao_ativa |
| 13 | `ativo` | Ativo | Operando normalmente | Operação em andamento | Não | SIM → operacao_ativa |
| 14 | `operacao_ativa` | Operação Ativa | Em operação com OS vinculada | Continuidade | Não | NÃO |
| 15 | `bloqueado` | Bloqueado | Temporariamente indisponível | Desbloqueio manual | Não | SIM → em_analise, pre_triagem |
| 16 | `reprovado` | Reprovado | Não aprovado definitivamente | Nenhum | NÃO | **NÃO** (terminal) |

### 5.2 Transições Permitidas (`STAGE_TRANSITIONS`)

```
novo_cadastro     → pre_triagem, em_analise, bloqueado, reprovado
pre_triagem       → interesse_confirmado, em_analise, bloqueado, reprovado
interesse_confirm → documentacao_pendente, em_analise, bloqueado, reprovado
em_analise        → documentacao_pendente, pre_triagem, entrevista, bloqueado, reprovado
documentacao_pend → em_validacao, em_treinamento, bloqueado, reprovado
em_validacao      → entrevista, aprovado, reprovado
entrevista        → em_treinamento, aprovado, reprovado
em_treinamento    → homologacao, aprovado, reprovado
homologacao       → confirmacao_inicio, bloqueado
confirmacao_inicio → prestador_apto, bloqueado
aprovado          → prestador_apto, ativo, bloqueado
prestador_apto    → operacao_ativa, bloqueado
ativo             → operacao_ativa, bloqueado, reprovado
operacao_ativa    → bloqueado, reprovado
bloqueado         → em_analise, pre_triagem, reprovado
reprovado         → (vazio — terminal)
```

### 5.3 Problemas do Pipeline

| # | Problema | Gravidade |
|---|----------|-----------|
| 1 | **16 estágios é excessivo** — `em_validacao` vs `documentacao_pendente` vs `homologacao` vs `confirmacao_inicio` são etapas sobrepostas | ALTA |
| 2 | **Sem gates automáticos** — movimento entre estágios é 100% manual (drag-and-drop) | ALTA |
| 3 | **Sem dados obrigatórios por estágio** — não exige telefone,CPF,veículo para avançar | ALTA |
| 4 | **`aprovado` ≠ `ativo` ≠ `prestador_apto`** — 3 estágios para "pessoa pronta" é confuso | MÉDIA |
| 5 | **`operacao_ativa`** depende de OS vinculada, mas não há trigger automático | MÉDIA |
| 6 | **Sem motivo obrigatório** ao reprovar/bloquear | MÉDIA |
| 7 | **Score computado mas não exibido** no Kanban de forma proeminente | BAIXA |

---

## 6 — PENTE FINO / COMPROMETIMENTO

### 6.1 Campos de Disponibilidade/Comprometimento (EnterpriseCandidate)

| Campo | Tipo | Fonte | Status |
|-------|------|-------|--------|
| `disponibilidadeTipo` | `imediata\|parcial\|indisponivel` | EnterpriseCandidate | ✅ Definido |
| `regioesAtuacao` | `string[]` | EnterpriseCandidate | ✅ Definido |
| `horariosDisponiveis` | `string` | EnterpriseCandidate | ✅ Definido |
| `diasDisponiveis` | `string[]` | EnterpriseCandidate | ✅ Definido |
| `scoreComprometimento` | `number` | EnterpriseCandidate | ⚠️ **STUB** (retorna 50) |
| `classificacaoComprometimento` | `string` | EnterpriseCandidate | ⚠️ **STUB** (retorna "Regular") |
| `riscoDesistencia` | `string` | EnterpriseCandidate | ✅ Implementado |
| `tempoMedioRespostaHoras` | `number\|null` | EnterpriseCandidate | ✅ Definido |
| `quantidadeCobrancas` | `number` | EnterpriseCandidate | ✅ Definido |
| `confirmouInteresse` | `boolean` | EnterpriseCandidate | ✅ Definido |
| `confirmouPreInicio` | `boolean` | EnterpriseCandidate | ✅ Definido |
| `compareceuPrimeiroDia` | `boolean` | EnterpriseCandidate | ✅ Definido |
| `completou30Dias` | `boolean` | EnterpriseCandidate | ✅ Definido |
| `quantidadeReclamacoes` | `number` | EnterpriseCandidate | ✅ Definido |
| `historicoDesistencias` | `number` | EnterpriseCandidate | ✅ Definido |
| `possuiOutraOperacaoFixa` | `boolean` | EnterpriseCandidate | ✅ Definido |
| `questionarioRespostas` | `Record\|null` | EnterpriseCandidate | ✅ Definido |

### 6.2 O Que Falta (não mapeado no schema)

| Campo Necessário | Status | Justificativa |
|-----------------|--------|---------------|
| `frequenciaPretendida` | ❌ Ausente | Fixo vs esporádico vs recorrente |
| `valorMinimoAceitavel` | ❌ Ausente | Piso salarial do prestador |
| `historicoNoShow` | ❌ Ausente | Quantas vezes faltou sem aviso |
| `historicoCancelamentos` | ❌ Ausente | Cancelamentos pós-aceite |
| `pontualidade` | ❌ Ausente | Score de pontualidade |
| `ocorrencias` | ❌ Ausente | Ocorrências operacionais |
| `respostaContatos` | ❌ Ausente | Taxa de resposta a ligações/WhatsApp |
| `tipoOperacaoPreferida` | ❌ Ausente |urbano/rodoviario/misto |
| `raioAtuacao` | ❌ Ausente | Distância máxima em km |

### 6.3 Score de Comprometimento — Estado Atual

**`recrutamentoScoreService.ts`** — O score é um **STUB**:

```typescript
export function calcularScoreComprometimento(_candidato: CandidatoScoreInput): number {
  return 50;  // SEMPRE retorna 50
}

export function classificarComprometimento(_score: number): string {
  return "Regular";  // SEMPRE retorna "Regular"
}
```

**O score NÃO é calculado.** Todos os candidatos recebem 50/Regular.

### 6.4 Proposta de Score de Comprometimento (Eventos Objetivos)

| Evento | Peso | Efeito | Fonte de Dados |
|--------|------|--------|----------------|
| Confirmou interesse na vaga | +10 | positivo | `confirmouInteresse` |
| Confirmou pré-início | +10 | positivo | `confirmouPreInicio` |
| Compareceu ao primeiro dia | +15 | positivo | `compareceuPrimeiroDia` |
| Completou 30 dias | +20 | positivo | `completou30Dias` |
| Documentação completa | +10 | positivo | `statusDocumental === 'completo'` |
| Tempo resposta ≤24h | +5 | positivo | `tempoMedioRespostaHoras` |
| Disponibilidade integral | +5 | positivo | `disponibilidadeRecrutamento` |
| Histórico de desistências >0 | -15 | negativo | `historicoDesistencias` |
| Reclamações >0 | -10 | negativo | `quantidadeReclamacoes` |
| Tempo resposta >72h | -10 | negativo | `tempoMedioRespostaHoras` |
| Não confirmou interesse | -20 | negativo | `!confirmouInteresse` |
| Possui outra operação fixa | -5 | negativo | `possuiOutraOperacaoFixa` |

**Classificação:**
- 80-100: Excelente
- 60-79: Bom
- 40-59: Regular
- 20-39: Baixo
- 0-19: Crítico

**Critérios EXCLUÍDOS (discriminatórios):** idade, gênero, raça, religião, estado civil, aparência.

---

## 7 — LIBERAÇÃO DO APP (`liberado_app`)

### 7.1 Mapeamento Completo

**Tabela:** `prestadores.liberado_app` (BOOL, default false)

### 7.2 Onde É Lido (Hard Gates)

| Local | Arquivo | Condição | Impacto |
|-------|---------|----------|---------|
| Elegibilidade operacional | `eligibilidadeOperacionalService.ts:107` | `if (p.liberado_app !== true)` → bloqueia alocação | **BLOQUEIA ESCALA** |
| Registro GPS | `20260731_fix_registrar_posicao_motorista.sql:52` | `AND liberado_app = true` | **BLOQUEIA RASTREAMENTO** |
| Chat operacional | `20260812_a22_chat_operacional.sql:134` | `AND liberado_app = true` | **BLOQUEIA CHAT** |
| Gate elegibilidade RPC | `20260822_ag07f_gate_elegibilidade_operacional.sql:40` | `liberado_app = true` | **BLOQUEIA ALOCAÇÃO** |
| Aceitar rede | `20260825_j13_fix_aceitar_rede_bypass.sql:88` | `liberado_app = true` | **BLOQUEIA REDE** |

### 7.3 Onde É Alterado (Writers)

| # | Arquivo | Trigger | Valor |
|---|---------|---------|-------|
| W1 | `prestadoresService.ts:389` | Sync operacional | Derivado de status |
| W2 | `prestadoresService.ts:432` | Remoção kanban | `false` |
| W3 | `prestadoresService.ts:577-640` | Correção divergência | Derivado de status |
| W4 | `conversaoCandidatoService.ts:305` | Conversão (update) | `statusOperacional === 'ativo'` |
| W5 | `conversaoCandidatoService.ts:331` | Conversão (insert) | `statusOperacional === 'ativo'` |
| W6 | `recrutamentoIntegracao.ts:221` | Conversão inteligente | **`true` hardcoded** |
| W7 | `PrestadorDetalhe.tsx:729-734` | Toggle manual admin | Manual (Switch) |
| W8 | `dbMappers.ts:289-457` | Form save | Via form data |
| W9 | RPC `app_s6_criar_prestador` | Cadastro App | **`false` hardcoded** |

### 7.4 Problemas Críticos

| # | Problema | Gravidade |
||----------|----------|-----------|
| 1 | **Sem trilha de auditoria** — mudança de `liberado_app` não é logada | **P0** |
| 2 | **Sem auto-bloqueio por vencimento de documento** — CNH vencida não reverte `liberado_app` | **P0** |
| 3 | **`agregado` mapeia para `ativo`** → `liberado_app=true` sem ser aprovado | **P1** |
| 4 | **W6 hardcodes `true`** — bypass do pipeline de aprovação | **P1** |
| 5 | **Gate é fail-open** — se schema indisponível, permite operar | **P1** |
| 6 | **Nenhum cron/trigger** verifica vencimento de documentos | **P0** |

### 7.5 Proposta: Bloco "ACESSO AO APLICATIVO"

```
┌─────────────────────────────────────────────────────┐
│              ACESSO AO APLICATIVO                    │
├─────────────────────────────────────────────────────┤
│ Estado: [ BLOQUEADO ] (default)                     │
│                                                     │
│ Estados possíveis:                                  │
│   BLOQUEADO → EM ANÁLISE → DOCUMENTAÇÃO PENDENTE   │
│   → VALIDAÇÃO OPERACIONAL → APTO PARA LIBERAÇÃO    │
│   → LIBERADO → SUSPENSO                            │
│                                                     │
│ Trilha obrigatória:                                 │
│   - quem liberou (user_id)                          │
│   - quando (timestamp)                              │
│   - motivo (text)                                   │
│   - estado anterior → estado novo                   │
│                                                     │
│ Gates automáticos:                                  │
│   - Documento vencido → SUSPENSO                    │
│   - Bloqueio manual → BLOQUEADO                     │
│   - Reativação → EM ANÁLISE (não automático)        │
└─────────────────────────────────────────────────────┘
```

---

## 8 — DOCUMENTOS

### 8.1 Fonte Documental Canônica

| Tabela | Propósito | Status |
|--------|----------|--------|
| `documentos_prestadores` | **CANÔNICA** para checks de elegibilidade | Real (4 colunas DDL) |
| `provider_documents` | **DUPLICATA** — usada por `AnaliseLote.tsx` | Real (7 colunas DDL) |
| `recrutamento_prestadores.documentos` | JSONB no registro de workflow | Real |
| `prestadores.cnh_validade` | Legado — checado como fallback | Real |
| `documentosService` (recrutamento module) | **localStorage only** | MOCK |

### 8.2 Storage

| Aspecto | Status |
|---------|--------|
| Bucket | `documentos_prestadores` |
| Público | **SIM** — `public: true` |
| Tamanho máximo | 10 MB |
| MIME types | image/jpeg, image/png, image/gif, image/webp, application/pdf |
| Signed URLs | **NÃO** — URLs públicas via `getPublicUrl()` |
| Versionamento | **NÃO** — upload cria nova linha, não nova versão |
| Expiração automática | **NÃO** — `validade` existe mas não trigger |

### 8.3 Políticas Storage

| Policy | Ação | Quem |
|--------|------|------|
| Public select | SELECT | **Qualquer um** (bucket público) |
| Authenticated insert | INSERT | Usuários autenticados |
| Authenticated update | UPDATE | Usuários autenticados |
| Authenticated delete | DELETE | Usuários autenticados |

### 8.4 Documentos Mínimos Obrigatórios

**Fonte:** `eligibilidadeOperacionalService.ts:42`
```typescript
export const DOCS_OBRIGATORIOS = ["CNH", "Comprovante de Endereço", "Comprovante de Residência"]
```

**Adicionais (quando aplicável):**
- CRLV (se tem veículo)
- ANTT/RNTRC

### 8.5 Problemas Críticos

| # | Problema | Gravidade |
|---|----------|-----------|
| 1 | **Bucket público** — qualquer pessoa com URL baixa documentos pessoais | **P0** |
| 2 | **Aprovação no TMS NÃO propaga** para `documentos_prestadores.status` | **P0** |
| 3 | **Gate é fail-open** — 0 documentos = elegível | **P1** |
| 4 | **Sem versionamento** — re-upload cria duplicata | **P2** |
| 5 | **"Adicionar documento manual"** é apenas texto (sem upload real) | **P1** |
| 6 | **4 sistemas de documentos** não sincronizados | **P1** |
| 7 | **Sem auto-bloqueio** por vencimento | **P0** |

---

## 9 — LGPD / SEGURANÇA

### 9.1 Auditoria Técnica

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| **RLS em recrutamento_candidatos** | ⚠️ INSEGURO | `anon` tem SELECT/INSERT/UPDATE/DELETE completos |
| **RLS em recrutamento_prestadores** | ⚠️ INSEGURO | `anon` tem SELECT |
| **RLS em crm_interacoes_prestadores** | ⚠️ INSEGURO | `anon` tem INSERT/UPDATE/DELETE |
| **RLS em recrutamento_operacoes** | ⚠️ INSEGURO | `anon` tem SELECT |
| **Isolamento multi-tenant** | ❌ AUSENTE | Nenhuma tabela recrutamento tem `tenant_id` |
| **CPF exposto** | ⚠️ | Exibido em plaintext em 8+ componentes |
| **Telefone exposto** | ⚠️ | Exibido em lists sem mascaramento |
| **Storage público** | ⚠️ | Documentos pessoais baixáveis por qualquer um |
| **RBAC** | ❌ AUSENTE | Sem verificação de papel por seção |
| **Console.log com PII** | ⚠️ | `console.error` com dados de candidatos |
| **Auditoria de acesso** | ❌ AUSENTE | Sem log de quem acessou dados |
| **Retenção de dados** | ❌ AUSENTE | Sem política de exclusão |
| **Exportação** | ❌ AUSENTE | Sem controle do que pode ser exportado |

### 9.2 OBRIGAÇÃO TÉCNICA RECOMENDADA

| # | Ação | Prioridade |
|---|------|-----------|
| 1 | REVOKE anon de todas as tabelas recrutamento_* | P0 |
| 2 | Adicionar `tenant_id` + RLS tenant-scoped | P0 |
| 3 | Tornar bucket `documentos_prestadores` privado | P0 |
| 4 | Implementar signed URLs para documentos | P1 |
| 5 | Mascarar CPF em componentes UI | P1 |
| 6 | Adicionar RBAC por seção do recrutamento | P1 |
| 7 | Remover console.log com PII | P1 |
| 8 | Criar tabela de auditoria de acesso | P2 |
| 9 | Implementar retenção de dados | P2 |
| 10 | Controle de exportação | P2 |

### 9.3 PENDÊNCIA JURÍDICA/PROCESSUAL

| Item | Nota |
|------|------|
| Consentimento para coleta de dados | Revisão humana necessária — termos de uso do App |
| Direito ao esquecimento | Verificar se exclusão em cascata funciona (prestadores → documentos → storage) |
| Prazo de retenção | Definir com advogado — dados de motoristas podem ter exigência legal |
| Compartilhamento com clientes | Portal Cliente exige dados do prestador? Verificar necessidade |

---

## 10 — CADASTRO MANUAL

### 10.1 "+ Adicionar Candidato" (Pipeline Enterprise)

| Aspecto | Status |
|---------|--------|
| Componente | `CadastrarInteressadoModal.tsx` |
| Tabela escrita | `recrutamento_candidatos` |
| Cria auth.users? | **NÃO** |
| Handle documents? | **NÃO** |
| Respeita status/origem? | **SIM** — stage selecionável, tags incluem origem |
| Score default | 65 |
| Campos | Nome*, Telefone*, Cidade/UF*, Veículo, Placa, Origem, Etapa, Observações |

### 10.2 "+ Novo Prestador" (PaginaPrestadores)

| Aspecto | Status |
|---------|--------|
| Ação | **Navega para Pipeline** (não cria nada diretamente) |
| Antes navegava para `nova-operacao` (bug corrigido em P5) | ✅ Corrigido |

### 10.3 PrestadorDetalhe (Cadastro Direto)

| Aspecto | Status |
|---------|--------|
| Componente | `PrestadorDetalhe.tsx` (quando `isNew=true`) |
| Tabela escrita | `prestadores` (INSERT direto) |
| También escreve | `veiculos`, `documentos_prestadores`, Storage |
| Cria auth.users? | **NÃO** |
| Handle documents? | **SIM** — upload real via Supabase Storage |
| Respeita origem? | **NÃO** — não seta `origem_cadastro` |

### 10.4 Fluxo Oficial Para Cadastro Manual (Projetado)

```
1. Admin clica "+ Novo Prestador"
2. Modal com: Nome, CPF/CNPJ, Telefone, Email, Veículo, Placa, Região
3. Validação de duplicidade (CPF/CNPJ + telefone)
4. INSERT em recrutamento_candidatos (stage=novo_cadastro, origem=manual)
5. Opcional: criar auth.user para acesso ao App
6. Pipelinepadrao: pré-triagem → documentação → validação → aprovação
```

---

## 11 — BANCO DE TALENTOS

### 11.1 Duas Implementações

| Versão | Rota | Fonte | Status |
|--------|------|-------|--------|
| Module version | `/recrutamento?section=talentos` | Supabase `recrutamento_candidatos` | REAL |
| Route version | `/recrutamento/banco-talentos` | **Zustand in-memory** (8 componentes) | MOCK |

### 11.2 Duplicidades Visuais

O Banco de Talentos route (`/recrutamento/banco-talentos`) usa Zustand store com dados mockados. Múltiplos cards idênticos são gerados porque o store inicia vazio e o componente renderiza placeholders.

### 11.3 Papel Real do Banco de Talentos

**Definição:** "NÃO aprovado agora" não significa "descartado". O Banco de Talentos deveria ser:
- Repositório de candidatos que não avançaram no pipeline mas são potencialmente úteis
- Fonte para reativação quando surgir vaga compatível
- Histórico de contato e disponibilidade

**Estado atual:** O módulo real (Supabase) lista `recrutamento_candidatos` com qualquer stage ≠ `reprovado`. O módulo mock não tem dados reais.

---

## 12 — CRM

### 12.1 Tabela Real: `crm_interacoes_prestadores`

| Aspecto | Status |
|---------|--------|
| Tabela | `crm_interacoes_prestadores` |
| Service | `crmService.ts` (CRUD completo via Supabase) |
| UI | `CrmLogistico` component |
| Campos | prestador_id, tipo (ligacao/whatsapp/email/reuniao/visita/observacao/proposta/retorno), titulo, descricao, data, usuario, proxima_acao, data_proximo_contato, status, anexos |
| **Funcional?** | **SIM** — CRUD real funciona |

### 12.2 O Que Falta Para CRM Profissional

| Funcionalidade | Status |
|---------------|--------|
| Registrar ligação | ✅ |
| Registrar WhatsApp | ✅ |
| Registrar mensagem | ✅ |
| Registrar entrevista | ✅ |
| Registrar observação | ✅ |
| Registrar proposta | ✅ |
| Agendar retorno | ✅ |
| Próximo contato | ✅ |
| Responsável | ✅ |
| **Vincular ao pipeline** | ❌ — CRM é isolado do Kanban |
| **Histórico visual** | ❌ — sem timeline |
| **Métricas de engajamento** | ❌ — sem taxa de resposta |
| **Automação de follow-up** | ❌ — sem triggers |

---

## 13 — IA OPERACIONAL

### 13.1 Motor Interno de Recomendação

| Aspecto | Status |
|---------|--------|
| Componente | `IAOperacional` |
| Fonte dados | Supabase (`prestadores`, `recrutamento_candidatos`, `recrutamento_operacoes`) |
| AI real | **SIM** — via `proxy-ia` Edge Function (Groq/LLaMA) |
| Matching engine | Determinístico (keywords × filtros) |
| Score | **Mock** — `recrutamentoScoreService` retorna 50 sempre |

### 13.2 Separação

| Categoria | Status |
|-----------|--------|
| **MOTOR INTERNO REAL** | Matching por região, veículo, disponibilidade, documentos |
| **MOCK/HARDCODE** | Score de comprometimento (50/Regular), parecer IA |
| **IA EXTERNA NÃO IMPLEMENTADA** | `proxy-ia` é chamado mas resposta não integra ao score |

### 13.3 Regra

> IA deve RECOMENDAR, nunca liberar prestador automaticamente. A decisão final é sempre humana.

---

## 14 — AUTOMAÇÕES

### 14.1 Inventário

| Automação | Implementada? | Backend | Trigger | Canal | Config Salva? |
|-----------|:-------------:|---------|---------|-------|:--------------:|
| Disparo de novas vagas | ❌ NÃO | — | — | — | localStorage |
| Coleta de documentos | ❌ NÃO | — | — | — | localStorage |
| Reativação de inativos | ❌ NÃO | — | — | — | localStorage |
| Alerta de CNH vencendo | ❌ NÃO | Calculado mas não disparado | — | — | localStorage |
| Qualquer outra | ❌ NÃO | — | — | — | localStorage |

### 14.2 Conclusão

**Todas as automações são UI-ONLY.** O `automacoesService` usa 100% `localStorage`. Nenhuma automação tem:
- Backend real (Supabase/Edge Function)
- Trigger (database)
- Canal de disparo (email/WhatsApp)
- Configuração persistida em banco

**"Pronto para integrar" = NÃO FUNCIONA.**

---

## 15 — OPERACIONAIS (PRESTADORES APTOS)

### 15.1 Gate de Elegibilidade

**Componente:** `PrestadoresAptos` → `enterpriseKanbanService.listarPrestadoresAptos()`

**Critérios para aparecer como "Apto":**

| Critério | Fonte | Obrigatório? |
|----------|-------|:------------:|
| `stage = 'ativo'` | `recrutamento_candidatos` | SIM |
| `liberado_app = true` | `prestadores` | SIM (via sync) |
| Documentação completa | `statusDocumental === 'completo'` | SIM |
| Veículo válido | `veiculos` | Recomendado |
| CNH válida | `validade_cnh !== 'vencida'` | SIM |
| Sem bloqueio ativo | `stage !== 'bloqueado'` | SIM |

### 15.2 Consistência

| Canal | Gate idêntico? | Problema |
|-------|:--------------:|----------|
| TMS (alocação) | ✅ | `eligibilidadeOperacionalService.ts` |
| App Motorista | ⚠️ | Depende de `liberado_app` (pode estar desatualizado) |
| Escala | ✅ | Usa mesma eligibility service |
| Rede | ✅ | RPC `f_aceitar_oportunidade_rede` verifica |

---

## 16 — DASHBOARD E MÉTRICAS

### 16.1 Auditoria de Métricas

| Métrica | Fonte | Query | Real/Mock | Consistente? |
|---------|-------|-------|-----------|:------------:|
| Total candidatos | `candidatos` (LEGACY) | `queryCount` | ⚠️ **TABELA LEGACY** | NÃO |
| Candidatos ativos | `candidatos WHERE status='ativo'` | `queryCountWithFilter` | ⚠️ **TABELA LEGACY** | NÃO |
| Aprovados | `candidatos WHERE status='homologado'` | `queryCountWithFilter` | ⚠️ **TABELA LEGACY** | NÃO |
| Pendentes | `candidatos WHERE status='pendente'` | `queryCountWithFilter` | ⚠️ **TABELA LEGACY** | NÃO |
| Total prestadores | `prestadores` | `queryCount` | ✅ REAL | SIM |
| Prestadores ativos | `prestadores WHERE status='ativo'` | `queryCountWithFilter` | ✅ REAL | SIM |
| Total veículos | `veiculos` | `queryCount` | ✅ REAL | SIM |
| Score médio | `prestadores.score_interno` | AVG | ✅ REAL | SIM |
| Retenção | `ativos / total * 100` | Calculado | ✅ REAL | SIM |
| Taxa conversão | `aprovados / total * 100` | Calculado | ⚠️ Usa tabela LEGACY | NÃO |
| Tempo médio aprovação | `homologacoes` | Diferença de datas | ✅ REAL | SIM |
| Regiões críticas | `operacoes - prestadores` por região | Calculado | ✅ REAL | SIM |
| Operações sem cobertura | `operacoes WHERE status='Ativo'` sem prestador | Calculado | ✅ REAL | SIM |
| **Evolução recrutamento** | `candidatos` (LEGACY) | Group by month | ⚠️ **TABELA LEGACY** | NÃO |
| **Aprovações** | `homologacoes` | Group by month | ✅ REAL | SIM |

### 16.2 Métricas Contraditórias

| Métrica | Tela A | Tela B | Divergência |
|---------|--------|--------|-------------|
| "Candidatos ativos" | Dashboard lê `candidatos` (LEGACY) | Pipeline lê `recrutamento_candidatos` | Tabelas diferentes, contagens diferentes |
| "Aprovados" | Dashboard: `candidatos WHERE status='homologado'` | Pipeline: `stage='aprovado'` em `recrutamento_candidatos` | Valores divergentes |
| Score | Dashboard: `prestadores.score_interno` | Score section: `prestadores[].score.geral` (localStorage) | Fontes diferentes |
| Documentos pendentes | Dashboard: `documento_analises` | Central Documentos: `documentosService` (localStorage) | Tabela vs localStorage |

---

## 17 — HISTÓRICO / AUDITORIA

### 17.1 O Que Existe

| Evento | Rastreado? | Onde | Como |
|--------|:----------:|------|------|
| Criação de candidato | ✅ | `recrutamento_candidatos.created_at` | Timestamp automático |
| Mudança de stage | ✅ | `enterpriseKanbanService.registrarEvento()` | JSONB `historico` no registro |
| Aprovação | ✅ | Evento `tipo: 'aprovado'` | No JSONB `historico` |
| Reprovação | ⚠️ | Evento `tipo: 'bloqueado'` | Sem motivo obrigatório |
| Conversão | ✅ | Evento `tipo: 'convertido'` | Com ID do prestador criado |
| Observação | ✅ | Evento `tipo: 'observacao_adicionada'` | Texto livre |
| Mudança liberado_app | ❌ | Nenhum | **SEM TRILHA** |
| Mudança de score | ❌ | Nenhum | **SEM TRILHA** |
| Upload de documento | ❌ | Nenhum | **SEM TRILHA** |
| Contato CRM | ✅ | `crm_interacoes_prestadores` | Tabela dedicada |
| Acesso a dados | ❌ | Nenhum | **SEM AUDITORIA** |

### 17.2 O Que Falta Para Rastreabilidade Completa

| Evento Necessário | Tipo | Prioridade |
|-------------------|------|-----------|
| Mudança de `liberado_app` | Audit log | P0 |
| Upload/aprovação/rejeição de documento | Audit log | P0 |
| Acesso a dados pessoais (CPF, docs) | Audit log | P1 |
| Exclusão de candidato | Audit log | P1 |
| Exportação de dados | Audit log | P2 |
| Login/logout no contexto recrutamento | Audit log | P2 |

---

## 18 — RELATÓRIO P0 / P1 / P2

### P0 — BLOQUEIA FLUXO, SEGURANÇA OU INTEGRIDADE

| ID | Severidade | Problema | Evidência | Arquivo | Tabela | Risco | Correção | TMS? | APP? | Migration? | Teste |
|----|:----------:|----------|-----------|---------|--------|-------|----------|:----:|:----:|:----------:|-------|
| P0-01 | CRÍTICO | RLS `anon` com acesso completo a `recrutamento_candidatos` | M601 migração adiciona anon | `20260601_recrutamento_candidatos_rls_anon.sql` | `recrutamento_candidatos` | Qualquer anon pode ler/modificar todos os candidatos | REVOKE anon, manter apenas authenticated | SIM | NÃO | SIM | Verificar RLS pós-migration |
| P0-02 | CRÍTICO | RLS `anon` com INSERT/UPDATE/DELETE em `crm_interacoes_prestadores` | Migração original | `202605200002_crm_interacoes_prestadores.sql` | `crm_interacoes_prestadores` | Qualquer anon pode criar/modificar interações CRM | REVOKE anon | SIM | NÃO | SIM | Verificar RLS |
| P0-03 | CRÍTICO | Bucket `documentos_prestadores` é público | `sql_correcao_documentos_prestadores.sql` | Storage | `documentos_prestadores` | Documentos pessoais (CNH, comprovante) baixáveis por qualquer um com URL | Tornar bucket privado + signed URLs | SIM | NÃO | SIM (bucket policy) | Testar download sem auth |
| P0-04 | CRÍTICO | Sem auto-bloqueio por vencimento de documento | Nenhum cron/trigger encontrado | — | `prestadores`, `documentos_prestadores` | Prestador com CNH vencida opera indefinidamente | Cron diário: verificar validade → setar liberado_app=false | SIM | NÃO | SIM (trigger ou pg_cron) | Testar com CNH vencida |
| P0-05 | CRÍTICO | `liberado_app` sem trilha de auditoria | Nenhum log de mudança | `prestadoresService.ts`, `conversaoCandidatoService.ts` | `prestadores` | Impossível rastrear quem liberou/bloqueou e quando | Trigger de auditoria em UPDATE de liberado_app | SIM | NÃO | SIM | Verificar logs pós-change |
| P0-06 | ALTO | Bridge gera dados MOCKADOS (nome, cidade, veículo) | `enterpriseKanbanService.ts:25-68` | `enterpriseKanbanService.ts` | `recrutamento_candidatos` | Candidatos do App aparecem com nomes fictícios no Pipeline | Ler dados reais do prestador em vez de gerar mock | SIM | NÃO | NÃO | Verificar dados reais no Kanban |
| P0-07 | ALTO | Aprovação de documento no TMS NÃO propaga para `documentos_prestadores.status` | `RELATORIO_AG07J2_DOCUMENTOS_APP_TMS_GATE.txt` | `CentralDocumentos.tsx` | `documentos_prestadores` | Documento "aprovado" na UI continua como "pendente" no gate | Propagar status via update no Supabase | SIM | NÃO | NÃO | Testar fluxo completo doc |

### P1 — NECESSÁRIO PARA MÓDULO PROFISSIONAL/HOMOLOGAÇÃO

| ID | Severidade | Problema | Correção | TMS? | APP? | Migration? |
|----|:----------:|----------|----------|:----:|:----:|:----------:|
| P1-01 | ALTO | Score de comprometimento é stub (retorna 50) | Implementar `calcularScoreComprometimento()` com eventos objetivos | SIM | NÃO | NÃO |
| P1-02 | ALTO | Automações 100% localStorage (nenhuma funcional) | Migrar para Supabase + Edge Functions | SIM | NÃO | SIM |
| P1-03 | ALTO | WhatsApp CRM 100% Zustand in-memory | Migrar para `crm_conversas`/`crm_mensagens` reais | SIM | NÃO | NÃO |
| P1-04 | ALTO | Banco de Talentos route 100% mock | Conectar a `recrutamento_candidatos` real | SIM | NÃO | NÃO |
| P1-05 | ALTO | Dashboard usa tabela LEGACY `candidatos` | Migrar queries para `recrutamento_candidatos` | SIM | NÃO | NÃO |
| P1-06 | ALTO | Sem gates automáticos entre estágios do Pipeline | Criar validações por estágio (docs obrigatórios, etc.) | SIM | NÃO | NÃO |
| P1-07 | MÉDIO | Gate documental é fail-open (0 docs = elegível) | Mudar para fail-closed com exceção para legacy | SIM | NÃO | NÃO |
| P1-08 | MÉDIO | `agregado` mapeia para `liberado_app=true` sem aprovação | Corrigir mapeamento em `prestadoresService` | SIM | NÃO | NÃO |
| P1-09 | MÉDIO | 4 sistemas de documentos não sincronizados | Consolidar em `documentos_prestadores` | SIM | NÃO | NÃO |
| P1-10 | MÉDIO | Sem `tenant_id` em tabelas recrutamento | Adicionar tenant_id + RLS tenant-scoped | SIM | NÃO | SIM |
| P1-11 | MÉDIO | CPF/telefone expostos em plaintext | Mascarar em componentes UI | SIM | NÃO | NÃO |
| P1-12 | MÉDIO | Sem motivo obrigatório ao reprovar/bloquear | Adicionar campo obrigatório no modal | SIM | NÃO | NÃO |
| P1-13 | MÉDIO | 16 estágios excessivos — sobreposições | Consolidar para 10-12 estágios claros | SIM | NÃO | NÃO |
| P1-14 | MÉDIO | "+ Adicionar Candidato" não aceita documentos | Adicionar upload de docs no modal | SIM | NÃO | NÃO |
| P1-15 | BAIXO | IAOperacional: parecer IA não integra ao score | Conectar proxy-ia ao score de comprometimento | SIM | NÃO | NÃO |

### P2 — MELHORIA POSTERIOR

| ID | Severidade | Problema | Correção |
|----|:----------:|----------|----------|
| P2-01 | BAIXO | Sem versionamento de documentos | Adicionar coluna `versao` + lógica de historico |
| P2-02 | BAIXO | "Adicionar documento manual" é apenas texto | Implementar upload real |
| P2-03 | BAIXO | Score exibido mas não computado | Implementar cálculo real |
| P2-04 | BAIXO | Sem métricas de engajamento CRM | Adicionar taxa de resposta, tempo medio |
| P2-05 | BAIXO | Sem retenção de dados | Definir política com advogado |
| P2-06 | BAIXO | Sem controle de exportação | Adicionar log de exports |
| P2-07 | BAIXO | IndicadoresRI/RecrutamentoAnalytics com Math.random() | Remover componentes mock ou conectar a dados reais |
| P2-08 | BAIXO | ~10 componentes legados não-roteados | Remover ou reabilitar |

---

## 19 — ROADMAP FECHADO (7 MISSÕES)

### Missão REC-01 — Fundação de Segurança e Integridade
**Objetivo:** Eliminar vulnerabilidades de segurança e garantir integridade referencial.

| Item | Escopo |
|------|--------|
| **Banco** | REVOKE anon de `recrutamento_candidatos`, `recrutamento_prestadores`, `recrutamento_operacoes`, `crm_interacoes_prestadores`; adicionar `tenant_id` + RLS tenant-scoped; trigger audit para `liberado_app`; UNIQUE em `prestadores.cpf_cnpj` |
| **TMS** | Mascarar CPF em UI; RBAC por seção; remover console.log com PII |
| **Testes** | Verificar RLS com anon; testar RBAC por papel |
| **Critério** | Anon não acessa nenhuma tabela recrutamento; CPF mascarado em todas as telas |
| **Risco** | Baixo — mudanças de segurança isoladas |
| **Dependências** | Nenhuma |

### Missão REC-02 — Consolidação de Entidades
**Objetivo:** Eliminar duplicidades e estabelecer fonte mestra única.

| Item | Escopo |
|------|--------|
| **Banco** | Migrar dados de `candidatos` (LEGACY) para `recrutamento_candidatos`; DROP `candidatos`; DROP `operacoes` (duplicata); consolidar `documentos_prestadores` + `provider_documents` em tabela única |
| **TMS** | Atualizar `useDashboardRecrutamento` para ler de `recrutamento_candidatos`; remover imports de `candidatos`; atualizar `StatusDocumental.tsx` |
| **Testes** | Verificar que dashboard muestra dados corretos pós-migração |
| **Critério** | Uma única tabela por entidade; zero referências a `candidatos` LEGACY |
| **Risco** | Médio — migração de dados requer backup |
| **Dependências** | REC-01 |

### Missão REC-03 — Bridge Confiável e Cadastro Automático
**Objetivo:** Tornar a integração App → Pipeline idempotente e event-driven.

| Item | Escopo |
|------|--------|
| **Banco** | Trigger `f_trg_sync_prestador_para_pipeline()` em `prestadores` (INSERT/UPDATE) que cria/atualiza `recrutamento_candidatos` automaticamente; ler dados REAIS do prestador (nome, telefone, veículo) em vez de mock |
| **TMS** | Remover `buscarECadastrarAppPrestadores()` (polling); adicionar real-time listener para novos prestadores no Pipeline |
| **Testes** | Inserir prestador com origem='app_motorista' → verificar candidato criado no pipeline com dados reais |
| **Critério** | Todo cadastro App aparece no Pipeline em <5 segundos com dados reais |
| **Risco** | Médio — trigger em tabela critica |
| **Dependências** | REC-02 |

### Missão REC-04 — Pipeline Profissional
**Objetivo:** Tornar o pipeline 100% funcional com gates, validações e conversão automática.

| Item | Escopo |
|------|--------|
| **Banco** | Configurar validações por estágio (docs obrigatórios para avançar de documentacao_pendente); trigger de conversão automática quando stage=aprovado; trigger de liberação ao converter |
| **TMS** | Consolidar 16→12 estágios; adicionar modal de reprovação/bloqueio com motivo obrigatório; implementar gates visuais por estágio; fixar `conversaoCandidatoService` para não hardcodar `liberado_app=true` |
| **Testes** | Mover candidato durch pipeline completo; verificar que conversão cria prestador real; verificar que reprovação exige motivo |
| **Critério** | Pipeline funciona ponta a ponta: cadastro → aprovação → prestador com liberado_app=true |
| **Risco** | Alto — lógica de negócio central |
| **Dependências** | REC-03 |

### Missão REC-05 — Documentos e Elegibilidade
**Objetivo:** Sistema documental profissional com upload real, versionamento e auto-bloqueio.

| Item | Escopo |
|------|--------|
| **Banco** | Tornar bucket privado; implementar signed URLs; trigger de auto-bloqueio (CNH vencida → liberado_app=false); adicionar coluna `versao` a `documentos_prestadores`; consolidar schema (adicionar colunas `status`, `validade`, `nome_arquivo` se ausentes) |
| **TMS** | Conectar `CentralDocumentos` a Supabase (substituir localStorage); implementar upload real no modal "Adicionar documento"; propagar aprovação/rejeição para `documentos_prestadores.status`; implementar gate fail-closed |
| **Testes** | Upload de CNH → documento aparece na lista; CNH vencida → liberado_app revertido; 0 documentos → elegivel=false |
| **Critério** | Documento uploadado, aprovado e válido = prestador elegível; documento vencido = prestador bloqueado |
| **Risco** | Alto — afeta elegibilidade operacional |
| **Dependências** | REC-04 |

### Missão REC-06 — Automações, CRM e IA
**Objetivo:** Automações reais, CRM funcional, IA de recomendação conectada.

| Item | Escopo |
|------|--------|
| **Banco** | Migrar automações de localStorage para `automacoes_recrutamento` (Supabase); criar Edge Functions para disparo (email/WhatsApp); criar tabela `recrutamento_score_historico` para trilha de score |
| **TMS** | Implementar automações: (1) Alerta CNH vencendo, (2) Lembrete de documentação pendente, (3) Reativação de inativos; conectar CRM ao pipeline (visível no Kanban); implementar score real de comprometimento; conectar IA ao score; implementar métricas de engajamento |
| **Testes** | CNH vencendo em 30 dias → email disparado; follow-up agendado → notificação enviada; score calculado baseado em eventos reais |
| **Critério** | 3 automações funcionando; CRM visível no pipeline; score real calculado |
| **Risco** | Médio — automações são isolated |
| **Dependências** | REC-05 |

### Missão REC-07 — Dashboard, Métricas e Homologação
**Objetivo:** Dashboard 100% real, métricas consistentes, módulo pronto para homologação.

| Item | Escopo |
|------|--------|
| **Banco** | Views materializadas para métricas (se necessário) |
| **TMS** | Dashboard lendo de `recrutamento_candidatos`; métricas consistentes entre telas; remover todos os componentes mock/legacy; remover componentes não-roteados (~10 arquivos); implementar métricas de engajamento; implementar retenção de dados; implementar log de auditoria de acesso |
| **Testes** | Playwright completo do módulo recrutamento; verificar consistência de métricas entre Dashboard e Pipeline; testar RBAC |
| **Critério** | 0 mocks restantes; métricas consistentes; módulo auditável |
| **Risco** | Baixo — polish final |
| **Dependências** | REC-06 |

---

## 20 — VEREDITO

| Dimensão | Status | Nota |
|----------|--------|------|
| **ARQUITETURA ATUAL** | **PRECISA REESTRUTURAR** | 3 tabelas paralelas para mesma entidade; 4 sistemas de documentos; bridge frágil |
| **CADASTRO APP INTEGRADO** | **PARCIAL** | RPC funciona mas bridge gera dados mock; sem trigger automático |
| **PIPELINE CONFIÁVEL** | **NÃO** | 16 estágios sem gates; dados mockados; sem motivo obrigatório |
| **DOCUMENTOS PROFISSIONAIS** | **NÃO** | 4 sistemas não sincronizados; bucket público; aprovação não propaga |
| **LIBERAÇÃO APP GOVERNADA** | **NÃO** | Sem trilha; sem auto-bloqueio; gate fail-open |
| **BANCO DE TALENTOS CONFIÁVEL** | **NÃO** | Rota principal é 100% mock |
| **CRM FUNCIONAL** | **PARCIAL** | CRUD funciona mas isolado do pipeline |
| **AUTOMAÇÕES REAIS** | **NÃO** | 100% localStorage; nenhuma funcional |
| **LGPD TÉCNICA SUFICIENTE** | **NÃO** | RLS quebrado; bucket público; sem RBAC; sem auditoria |
| **PRONTO PARA HOMOLOGAÇÃO** | **NÃO** | ~40% funcional; gaps críticos de segurança |

### CONTAGEM REGRESSIVA

```
8 — Fundação de Segurança (RLS, audit, tenant)
7 — Consolidação de Entidades (merge tabelas duplicadas)
6 — Bridge Confiável (trigger automático, dados reais)
5 — Pipeline Profissional (gates, validações, conversão)
4 — Documentos e Elegibilidade (upload, signed URLs, auto-bloqueio)
3 — Automações, CRM e IA (3 automações reais, CRM integrado)
2 — Dashboard, Métricas e Homologação (0 mocks, métricas reais)
1 — QA/Playwright completo do módulo
0 — RECRUTAMENTO 100%
```

**Estimativa:** 5-7 semanas (1 dev full-time) para chegar a 0.

---

**FIM DA AUDITORIA — AG-REC.8**
**Nenhuma implementação foi realizada. Nenhuma migration foi executada. Nenhum dado foi modificado.**
