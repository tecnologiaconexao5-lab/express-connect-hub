# TMS-017 — Implementação da Idempotência C no Seed de Homologação

**Data:** 2026-07-29  
**Versão Seed:** TMS013-SEED-v2  
**Marcador:** HML-APP-20260729  
**Classificação Final:** C — Idempotência Completa com Retomada Automática

---

## Sumário

1. [Resumo Executivo](#1-resumo-executivo)
2. [Arquitetura Implementada](#2-arquitetura-implementada)
3. [Checklist de Idempotência](#3-checklist-de-idempotência)
4. [Arquivos Modificados/Criados](#4-arquivos-modificadoscriados)
5. [Validação](#5-validação)
6. [Segurança](#6-segurança)
7. [Instruções de Uso](#7-instruções-de-uso)
8. [Pendências](#8-pendências)

---

## 1. Resumo Executivo

O seed de homologação (`scripts/tms013_seed_hml.mjs`) foi elevado de classificação **B (Idempotência Parcial)** para **C (Idempotência Completa)** conforme arquitetura aprovada no TMS-016.

### O que mudou

| Característica | Antes (v1) | Depois (v2) |
|---------------|-----------|-------------|
| Versionamento | Nenhum | `TMS013-SEED-v2` + hash SHA256 |
| Controle de concorrência | Nenhum | `pg_try_advisory_lock` |
| Checkpoint por cenário | Gate único (tudo vs nada) | Tabela `_hml_seed_checkpoint` |
| Transação por cenário | 1 transação geral | 1 transação por cenário |
| Retomada automática | Não | Sim (skip concluídos, retry falhos) |
| SAVEPOINT para opcionais | Não | Sim (2 cenários) |
| ON CONFLICT | 3 tabelas financeiras | 3 tabelas financeiras (mantido) |
| Manifesto | Não | JSON atômico com rename |
| Cleanup | Script separado | Script atualizado para checkpoint |

---

## 2. Arquitetura Implementada

### Fluxo de Execução

```
main()
  │
  ├── 1. Verificar tabela _hml_seed_checkpoint (aborta se não existir)
  ├── 2. Adquirir pg_try_advisory_lock(20260729, 0) (aborta se ocupado)
  ├── 3. Ler checkpoint atual → Map<cenario, status>
  │
  ├── Para cada cenário 1..6:
  │   ├── Se concluído → pular
  │   ├── Se falhou/pendente/novo → executar
  │   │   ├── BEGIN
  │   │   ├── Adquirir lock por cenário (opcional)
  │   │   ├── Executar cenário
  │   │   ├── COMMIT ou ROLLBACK
  │   │   ├── Escrever checkpoint (concluido/falhou)
  │   │   └── Coletar manifesto
  │   └── Se falhou → abortar seed
  │
  ├── 4. Construir manifesto JSON
  ├── 5. Flush atômico (.tmp → .json)
  └── 6. Liberar lock (finally)
```

### Estrutura de Cenários

| # | Cenário | Tabelas | Criticidade |
|:-:|---------|---------|:-----------:|
| 1 | super_admin + tenant_usuarios + perfis_permissoes | `auth.users`, `tenant_usuarios`, `perfis_permissoes` | Essencial |
| 2 | Agentes IA Internos (5) | `agentes_ia_internos` | Essencial |
| 3 | Financeiro | `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores` | Essencial (ON CONFLICT) |
| 4 | Alocações de Escala | `alocacoes_escala` | Essencial |
| 5 | Entregas Protocolo | `entregas_protocolo`, `entregas_protocolo_fotos` | Essencial + SAVEPOINT |
| 6 | CRM | `crm_leads`, `crm_followups` | Essencial + SAVEPOINT |

### Mecanismos de Idempotência

| Mecanismo | Onde | Descrição |
|-----------|------|-----------|
| **Checkpoint** | Global | Tabela `_hml_seed_checkpoint` registra status por cenário |
| **Advisory Lock** | Global + por cenário | `pg_try_advisory_lock(20260729, N)` impede execução concorrente |
| **ON CONFLICT** | 3 tabelas financeiras | `ON CONFLICT (os_id) DO NOTHING` evita duplicatas |
| **SAVEPOINT** | Cenários 5 e 6 | Operações opcionais com `ROLLBACK TO SAVEPOINT` sem afetar o cenário |
| **COUNT prévio** | Todos os cenários | Verifica `COUNT(*)` antes de inserir; pula se já existir |
| **Retomada automática** | Orquestrador | Pula concluídos, retenta falhos, executa pendentes |
| **Flush atômico** | Manifesto | `.tmp.json` → `.json` (rename atômico) |

---

## 3. Checklist de Idempotência

### Critérios Gerais (TMS-014)

| # | Critério | Atendido | Evidência |
|:-:|----------|:--------:|-----------|
| 1 | Execução repetida não duplica dados | ✅ | ON CONFLICT + COUNT prévio |
| 2 | Retomada após falha parcial | ✅ | Checkpoint por cenário |
| 3 | Sinalização visual clara de reexecução | ✅ | "🔄 Retentativa #N" no console |
| 4 | Não bloqueia tabelas em produção | ✅ | Advisory lock (non-blocking try) |
| 5 | Não trava se outra execução estiver rodando | ✅ | `pg_try_advisory_lock` → aborta |
| 6 | Estado registrado antes de cada cenário | ✅ | `writeCheckpoint(..., 'pendente')` |
| 7 | Erro não corrompe execuções anteriores | ✅ | Transação por cenário + checkpoint |
| 8 | Manifesto final não é corrompido por crash | ✅ | Flush atômico (.tmp → .rename) |
| 9 | Login de homologação não interfere em produção | ✅ | Tenant isolado + marcador específico |
| 10 | Cleanup consegue remover dados precisamente | ✅ | Cleanup por tenant + marcador |

### Arquitetura TMS-016

| # | Componente | Status | Arquivo |
|:-:|------------|:------:|---------|
| 1 | `SEED_VERSION` | ✅ | `tms013_seed_hml.mjs:21` |
| 2 | `TOTAL_CENARIOS` | ✅ | `tms013_seed_hml.mjs:22` |
| 3 | `CHECKPOINT_TABLE` | ✅ | `tms013_seed_hml.mjs:23` |
| 4 | Transação por cenário | ✅ | `tms013_seed_hml.mjs:268-288` |
| 5 | `pg_try_advisory_lock` | ✅ | `tms013_seed_hml.mjs:55-62` |
| 6 | Tabela `_hml_seed_checkpoint` | ✅ | `create_hml_seed_checkpoint.sql` |
| 7 | SAVEPOINT opcionais (cenários 5 e 6) | ✅ | `tms013_seed_hml.mjs:208-226, 252-265` |
| 8 | ON CONFLICT (financeiro) | ✅ | `tms013_seed_hml.mjs:151, 166, 186` |
| 9 | Manifesto incremental | ✅ | `tms013_seed_hml.mjs:304-324` |
| 10 | Flush atômico (.tmp → .json) | ✅ | `tms013_seed_hml.mjs:96-102` |
| 11 | Retomada automática | ✅ | `tms013_seed_hml.mjs:276-282` |

---

## 4. Arquivos Modificados/Criados

| Arquivo | Ação | Descrição |
|---------|:----:|-----------|
| `scripts/tms013_seed_hml.mjs` | **MODIFICADO** | Seed refatorado — v2 com idempotência C |
| `supabase/scripts/create_hml_seed_checkpoint.sql` | **CRIADO** | SQL para criar tabela de checkpoint |
| `supabase/scripts/cleanup_hml_app_20260729.sql` | **MODIFICADO** | Cleanup atualizado para v2 + checkpoint |
| `scripts/tms017_test_logico_local.mjs` | **CRIADO** | Teste lógico local (37 cenários) |

---

## 5. Validação

### Testes Realizados

| Teste | Resultado |
|-------|:---------:|
| `node --check scripts/tms013_seed_hml.mjs` | ✅ Syntax OK |
| `npx tsc --noEmit` | ✅ 0 erros |
| Teste lógico local (37 cenários) | ✅ 37/37 passaram |
| Verify checkpoint SQL syntax | ✅ Validado manualmente |

### Cobertura dos Testes Locais

| Grupo | Testes | Status |
|-------|:------:|:------:|
| Arquivo do seed | 2 | ✅ |
| Versionamento | 5 | ✅ |
| Advisory Lock | 5 | ✅ |
| Cenários | 13 | ✅ |
| Checkpoint + Retomada | 7 | ✅ |
| Manifesto + Flush | 5 | ✅ |
| **Total** | **37** | **✅ 37/37** |

---

## 6. Segurança

### Análise de Riscos

| Risco | Gravidade | Mitigação |
|-------|:---------:|-----------|
| Execução concorrente do seed | Média | `pg_try_advisory_lock` — bloqueia non-blocking |
| Abortar no meio de um cenário | Alta | Checkpoint registra 'pendente' antes; retomada executa de novo |
| Tabela de checkpoint não existe | Média | Seed aborta com instruções claras |
| Vazamento de dados HML para produção | Alta | Tenant isolado (`00000000-...-000000000001`) + marcador único |
| Crash durante escrita do manifesto | Baixa | Flush atômico (tmp → rename) |

### Proteções

1. **Sem auto-criação de tabelas**: checkpoint table deve ser criada manualmente (revisão obrigatória)
2. **Lock non-blocking**: `pg_try_advisory_lock` em vez de `pg_advisory_lock`
3. **Rollback explícito**: `try/catch` com `ROLLBACK` em cenários
4. **Finally com cleanup**: lock liberado e pool fechado mesmo em erro
5. **Sem dados reais tocados**: todas as operações filtradas por TENANT_ID + marcador

---

## 7. Instruções de Uso

### Pré-requisitos

```bash
# 1. Criar tabela de checkpoint (executar manualmente, 1 vez apenas):
#    Supabase Dashboard > SQL Editor > cole supabase/scripts/create_hml_seed_checkpoint.sql

# 2. Configurar .env com DATABASE_URL

# 3. Executar seed:
DATABASE_URL=postgresql://... npx node scripts/tms013_seed_hml.mjs
```

### Saída Esperada

```
╔══════════════════════════════════════════════════════════════════╗
║  TMS013-SEED-v2                                                ║
║  Marcador: HML-APP-20260729                                     ║
╚══════════════════════════════════════════════════════════════════╝

[SEED] Hash: 79DEC84C1F8F8A69A38C0EAC866B10D590BAFE6826C2ABD73980585820E6B559
[CENÁRIO 1/6] ▶️  Executando: Usuário super_admin...
[CENÁRIO 1/6] ✅ Concluído (1234ms)
...
╔══════════════════════════════════════════════════════════════════╗
║  RESUMO — HML-APP-20260729                                     ║
║  Status: ✅ SUCESSO                                             ║
║  Cenários: 6/6 concluídos                                      ║
╚══════════════════════════════════════════════════════════════════╝
```

### Reexecução (Retomada)

```bash
# Se falhou no cenário 3, executar novamente:
DATABASE_URL=postgresql://... npx node scripts/tms013_seed_hml.mjs
# Saída: cenários 1-2 pulados, cenário 3 com "🔄 Retentativa #2"
```

### Cleanup

```bash
# Remover dados de homologação:
psql -f supabase/scripts/cleanup_hml_app_20260729.sql
```

---

## 8. Pendências

1. **Teste com banco real**: executar seed contra ambiente de homologação (requer `DATABASE_URL`)
2. **Validação de grants da checkpoint table**: verificar se service_role tem permissão
3. **Teste de concorrência real**: executar 2 seeds simultâneos (lock deve impedir o segundo)
4. **Teste de retomada real**: simular crash no cenário 3, verificar checkpoint

---

*Relatório gerado em 2026-07-29. Missão TMS-017.*
