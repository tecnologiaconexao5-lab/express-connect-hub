# TMS-018 — Checklist de Verificação Pré-Produção

**Seed:** TMS013-SEED-v2
**Data:** 2026-07-29
**Marcador:** HML-APP-20260729

---

## A. Código

- [x] `SEED_VERSION` definido como string fixa
- [x] `TOTAL_CENARIOS` = 6
- [x] `CHECKPOINT_TABLE` = `public._hml_seed_checkpoint`
- [x] `MARKER` com fallback = `HML-APP-20260729`
- [x] `TENANT_ID` = `00000000-0000-0000-0000-000000000001`
- [x] Advisory lock: `pg_try_advisory_lock(20260729, 0)` — non-blocking
- [x] Per-scenario lock: `pg_try_advisory_lock(20260729, 100+N)`
- [x] Lock liberado em `finally` com try/catch próprio
- [x] Lock liberado mesmo em erro
- [x] Lock é de sessão (PostgreSQL libera em disconnect)
- [x] `ensureCheckpointTable()` aborta se tabela não existe
- [x] `readCheckpoint()` carrega estado por marcador
- [x] `writeCheckpoint()` upsert por (marcador, cenario)
- [x] Transação `BEGIN`/`COMMIT` por cenário
- [x] `ROLLBACK` explícito em `catch`
- [x] `writeCheckpoint('pendente')` antes de `BEGIN`
- [x] `writeCheckpoint('concluido')` após `COMMIT` (risco documentado)
- [x] `writeCheckpoint('falhou')` após `ROLLBACK`
- [x] SAVEPOINT: `sp_fotos_protocolo` (cenário 5)
- [x] SAVEPOINT: `sp_followups` (cenário 6)
- [x] `ROLLBACK TO SAVEPOINT` tratado com registro
- [x] ON CONFLICT em `auth.users(email)` — DO NOTHING
- [x] ON CONFLICT em `tenant_usuarios(tenant_id, user_id)` — DO UPDATE
- [x] ON CONFLICT em `agentes_ia_internos(codigo)` — DO UPDATE
- [x] ON CONFLICT em `perfis_permissoes(tenant_id, papel, modulo)` — DO NOTHING
- [x] ON CONFLICT em `financeiro_receber(os_id)` — DO NOTHING
- [x] ON CONFLICT em `financeiro_pagar(os_id)` — DO NOTHING
- [x] ON CONFLICT em `pagamentos_prestadores(os_id)` — DO NOTHING
- [x] ON CONFLICT em `entregas_protocolo(alocacao_id)` — DO NOTHING
- [x] COUNT(*) prévio em cenários 1, 3, 4, 5, 6
- [x] SQL parametrizado (100% $1, $2)
- [x] Sem interpolação insegura de variáveis em SQL
- [x] Manifesto gerado ao final
- [x] Flush atômico: `.tmp.json` → `.json`
- [x] Código de erro no exit (1=DATABASE_URL, 2=falha seed, 3=fatal)
- [x] `seed_file_hash` computado e registrado
- [x] Retomada: skip concluídos
- [x] Retomada: retry falhos
- [x] Retomada: executa pendentes/novos
- [x] Nenhum INSERT antes da validação de DATABASE_URL
- [x] Nenhum INSERT antes da verificação de checkpoint
- [x] Nenhum INSERT antes do lock

## B. Checkpoint SQL

- [x] `CREATE TABLE IF NOT EXISTS public._hml_seed_checkpoint`
- [x] `marcador TEXT NOT NULL`
- [x] `cenario INT NOT NULL CHECK (1..6)`
- [x] `seed_version TEXT NOT NULL`
- [x] `status TEXT CHECK ('pendente', 'concluido', 'falhou')`
- [x] `tentativas INT NOT NULL DEFAULT 0`
- [x] `erro TEXT` — nullable
- [x] `iniciado_em TIMESTAMPTZ` — nullable
- [x] `concluido_em TIMESTAMPTZ` — nullable
- [x] `duracao_ms INT` — nullable
- [x] `executado_por TEXT` — nullable
- [x] `created_at TIMESTAMPTZ DEFAULT now()`
- [x] `updated_at TIMESTAMPTZ DEFAULT now()`
- [x] PRIMARY KEY (marcador, cenario)
- [x] Índice `idx_hml_cp_marcador` ON (marcador)
- [x] Índice `idx_hml_cp_status` ON (status)
- [x] Trigger `trg_hml_cp_updated_at` (BEFORE UPDATE)
- [x] RLS desabilitado
- [x] GRANT para postgres + service_role

## C. Cleanup

- [x] Constante `HML_TENANT_ID`
- [x] PASSO 0: COUNT antes do DELETE
- [x] PASSO 0: requer descomentar PROCEED
- [x] Transação BEGIN/COMMIT
- [x] 13 tabelas em ordem de dependência
- [x] Checkpoint removido primeiro
- [x] Filhos removidos antes dos pais (crm_followups → crm_leads)
- [x] Proteção: `tenant_id + LIKE '%HML%'` em tabelas financeiras
- [x] Proteção: `tenant_id + LIKE '%(HML)%'` em tenant_usuarios
- [x] Proteção: `codigo IN (...)` em agentes_ia_internos
- [x] Proteção: `email LIKE 'lead%.hml@email.com'` em leads
- [x] GET DIAGNOSTICS após cada DELETE
- [x] Resumo ao final
- [x] Verificação pós-limpeza (comentada)

## D. Testes (80)

- [x] 37 testes estruturais (string presence)
- [x] 43 testes comportamentais (ordem startup, flush real, commit order)
- [x] Ordem de startup verificada (9 passos)
- [x] Nenhum INSERT antes das validações
- [x] Checkpoint vs COMMIT order verificada
- [x] Flush atômico testado (write → rename)
- [x] SAVEPOINT nomes verificados
- [x] ON CONFLICT contagem e targets
- [x] SQL paramétrico verificado
- [x] Interpolação insegura verificada
- [x] Catch blocks verificados
- [x] Lock em finally verificado
- [x] `node --check` nos 3 scripts

## E. Pendências para Execução

- [ ] **Autorização humana** para executar o seed
- [ ] **Criar tabela `_hml_seed_checkpoint`** em produção
- [ ] **Verificar grants** do usuário DATABASE_URL na tabela
- [ ] **Validar schema** das 13 tabelas alvo (SELECT-only)
- [ ] **Revisar triggers** que podem propagar dados HML
- [ ] **Configurar DATABASE_URL** no .env ou ambiente
- [ ] **Agendar horário** fora de pico
- [ ] **Preparar monitor** para abortar se necessário
- [ ] **Ter cleanup pronto** para rollback imediato

---

*Checklist gerado em 2026-07-29. TMS-018 — Auditoria Pré-Produção.*
