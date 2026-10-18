# TMS-018 — Auditoria Pré-Produção do Seed de Homologação

**Data:** 2026-07-29
**Auditoria:** Pré-produção da implementação TMS-017 (Idempotência C)
**Seed:** `scripts/tms013_seed_hml.mjs` — v2 (TMS013-SEED-v2)
**Marcador:** HML-APP-20260729
**Hash:** `6B45AE882362B9B579858F4C247FF07D7FAFB19CEC043965F2A3E6CDE825E398`

---

## 1. Classificação Final

### **C — Aprovada para preparação controlada**

O código está estruturalmente correto e a arquitetura de idempotência está implementada conforme a TMS-016. Porém, **não está autorizado para execução em produção** sem:
1. Criação manual e autorizada da tabela `_hml_seed_checkpoint`
2. Validação read-only do schema real (verificar grants da checkpoint table)
3. Preparação de plano de rollback específico
4. Autorização humana separada

---

## 2. Arquivos Auditados

| Arquivo | Linhas | SHA256 | Última alteração |
|---------|-------:|--------|-----------------|
| `scripts/tms013_seed_hml.mjs` | 891 | `6B45AE882362B9B579858F4C247FF07D7FAFB19CEC043965F2A3E6CDE825E398` | TMS-017 |
| `supabase/scripts/create_hml_seed_checkpoint.sql` | 94 | `55F7CCC19925115D2622229F45B7F81AD8AAB891230FBD9E60A09C54013F7327` | TMS-017 |
| `supabase/scripts/cleanup_hml_app_20260729.sql` | 281 | `585B1587098EE9DD41D2C8CE3BB6E76C2BB27227256ACFD18EBDA1F4AC71EDE5` | TMS-017 |
| `scripts/tms017_test_logico_local.mjs` | 205 | `37A2EA9D23F1B9EFB3A66CB1224C9E56F51815CDE313EF345EC602DE6135F0EB` | TMS-017 |
| `scripts/tms017_test_ordem_startup.mjs` | 325 | — | TMS-018 |
| `docs/auditoria/relatorios/2026-07-29_tms017_implementacao_idempotencia_c.md` | 247 | — | TMS-017 |
| `docs/auditoria/AUDITORIA_MASTER.md` | ~2000 | — | TMS-017 |

---

## 3. Aderência à Arquitetura TMS-016

| Componente | Status | Detalhes |
|-----------|:------:|----------|
| `SEED_VERSION` | ✅ Comprovado | `TMS013-SEED-v2` na linha 24 |
| `TOTAL_CENARIOS` | ✅ Comprovado | `6` na linha 25 |
| `CHECKPOINT_TABLE` | ✅ Comprovado | `public._hml_seed_checkpoint` na linha 26 |
| Transação por cenário | ✅ Comprovado | `BEGIN/COMMIT` em cada iteração (linhas 768-778) |
| `pg_try_advisory_lock` | ✅ Comprovado | Linhas 81-84 (non-blocking, sessão) |
| Tabela `_hml_seed_checkpoint` | ✅ Comprovado | SQL em `create_hml_seed_checkpoint.sql` |
| SAVEPOINT | ✅ Comprovado | `sp_fotos_protocolo` (C5), `sp_followups` (C6) |
| ON CONFLICT | ✅ Comprovado | 7 cláusulas em 6 tabelas diferentes |
| Manifesto incremental | ✅ Comprovado | Array `manifestEntries` agregado |
| Flush atômico (.tmp → .json) | ✅ Comprovado | `renameSync` testado comportamentalmente |
| Retomada automática | ✅ Comprovado | Skip concluídos, retry falhos, executa novos |
| SQL parametrizado | ✅ Comprovado | 100% das queries usam `$1, $2...` |
| Cleanup com guard | ✅ Comprovado | COUNT + tenant + marcador antes do DELETE |

---

## 4. Falhas Encontradas

### 4.1 Verificação de Testes (Etapa 15)

**Gravidade: Média**

Os 37 testes originais são 100% **estruturais** (busca de strings no código). Nenhum testa comportamento real.

| Aspecto | Resultado |
|---------|:---------:|
| Importam funções reais? | ❌ Não (0/37) |
| Executam lógica? | ❌ Não (0/37) |
| Simulam pg.Client? | ❌ Não |
| Simulam transações? | ❌ Não |
| Simulam falhas? | ❌ Não |
| Validam ordem de queries? | ❌ Não |
| Validam rollback? | ❌ Não |
| Validam lock? | ❌ Parcial (só string check) |
| Validam manifesto? | ❌ Parcial (só string check) |

**Mitigação:** Testes adicionais criados nesta auditoria (TMS-018) — 43 testes comportamentais, incluindo:
- Ordem real de startup (9 passos sequenciais)
- Flush atômico com writeFileSync + renameSync real
- Verificação de checkpoint vs COMMIT order
- Verificação de segurança SQL (interpolação)
- Verificação de catch blocks vazios

### 4.2 Checkpoint Após COMMIT

**Gravidade: Baixa**

`writeCheckpoint('concluido')` ocorre **após** `COMMIT` (linha 789 depois da 778). Risco: crash entre COMMIT e checkpoint deixa metadado inconsistente.

**Recuperável:** Na retomada, o `COUNT(*)` detecta dados existentes e reescreve o checkpoint como `concluido`. Apenas o manifesto perde os registros originais.

### 4.3 Cleanup Remove Usuário Real

**Gravidade: Média**

O cleanup (`cleanup_hml_app_20260729.sql:242`) deleta de `auth.users WHERE email = 'tamiris.castilho@conexaoexpress.com.br'` — um usuário real de produção. Proteção: FK `auth.users` referenciada por `tenant_usuarios.user_id` impede a exclusão se houver vínculos. Mas se o seed tiver sido executado, o vínculo existe e o DELETE falharia. Se não existir vínculo (seed nunca executado), o usuário real seria deletado.

### 4.4 ON CONFLICT com os_id = NULL

**Gravidade: Baixa**

Os 3 `ON CONFLICT (os_id) DO NOTHING` no cenário financeiro têm `os_id` como parâmetro implícito NULL. PostgreSQL considera NULL != NULL, então múltiplos INSERTs com os_id=NULL não entram em conflito. A proteção real é o `COUNT(*)` prévio.

---

## 5. Validações Realizadas

| Validação | Resultado |
|-----------|:---------:|
| `node --check scripts/tms013_seed_hml.mjs` | ✅ Syntax OK |
| `node --check scripts/tms017_test_logico_local.mjs` | ✅ Syntax OK |
| `node --check scripts/tms017_test_ordem_startup.mjs` | ✅ Syntax OK |
| `npx tsc --noEmit` | ✅ 0 erros |
| Testes lógicos (37 estruturais) | ✅ 37/37 |
| Testes comportamentais (43 novos) | ✅ 43/43 |
| **Total de testes** | **✅ 80/80** |
| Nenhuma escrita em Produção | ✅ Confirmado |
| Nenhuma conexão com banco | ✅ Confirmado |
| Nenhuma migration executada | ✅ Confirmado |

---

## 6. Riscos Remanescentes

| Risco | Gravidade | Mitigação |
|-------|:---------:|-----------|
| **Tabela checkpoint não existe** | Alto | Seed aborta com instruções |
| **Permissão insuficiente (grants)** | Alto | Seed conecta via DATABASE_URL (usuário pode não ter grants na _hml_seed_checkpoint) |
| **Cleanup deleta usuário real** | Médio | FK protege, mas risco existe se não houver vínculo |
| **Lock não liberado (crash)** | Baixo | PostgreSQL libera automaticamente ao encerrar sessão |
| **Rede cai durante seed** | Médio | Transação por cenário protege consistência |
| **Schema divergente** | Alto | Nenhuma validação prévia de schema das tabelas alvo |
| **Trigger dispara efeitos colaterais** | Médio | Triggers existentes (financeiro, eventos) podem propagar dados HML |
| **ON CONFLICT não dispara (os_id=NULL)** | Baixo | COUNT(*) é a proteção real |
| **Manifesto em disco com permissão negada** | Baixo | seed não aborta, mas manifesto não é gerado |
| **Versão diferente do Node.js** | Baixo | ES modules requer Node ≥ 14+ |
| **Concorrência real não testada** | Médio | Lock testado estruturalmente, não comportamentalmente |
| **renameSync em rede Windows** | Baixo | renameSync pode falhar em partilha de rede |

---

## 7. Checklist Pré-Execução

- [ ] **Autorização humana** obtida para executar o seed
- [ ] **Tabela `_hml_seed_checkpoint`** criada (via Supabase Dashboard ou psql)
- [ ] **Grants verificados**: usuário DATABASE_URL tem INSERT/UPDATE/SELECT na tabela
- [ ] **Schema verificado**: todas as 13 tabelas alvo existem com colunas compatíveis
- [ ] **Triggers revisados**: nenhum trigger indesejado nos INSERTs
- [ ] **DATABASE_URL** configurada com string correta (não anon key)
- [ ] **Manifesto** — diretório `output/` tem permissão de escrita
- [ ] **Cleanup preparado** para rollback imediato se necessário
- [ ] **Horário agendado** fora de pico
- [ ] **Monitor disponível** para abortar se algo inesperado ocorrer

---

## 8. Próxima Missão Recomendada

**TMS-019 — Preparação e Execução Controlada do Seed**

Escopo sugerido:
1. Obter autorização humana para execução
2. Criar tabela `_hml_seed_checkpoint` em produção
3. Validar grants com SELECT-only
4. Executar seed com `DATABASE_URL` em modo controlado
5. Validar checkpoint + manifesto gerados
6. Executar cleanup se necessário
7. Documentar resultados

---

*Relatório gerado em 2026-07-29. TMS-018 — Auditoria Pré-Produção.*
