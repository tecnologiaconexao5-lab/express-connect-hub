# TMS-032 — Relatório de Aplicação e Homologação (Migration 1 / P0)

**Data:** 2026-08-02 01:01 (Brasília)
**Escopo:** SOMENTE `supabase/migrations/20260801_tms032_p0_aceite_policy.sql`
**Migration 2 (hardening S1/S2/S9):** ❌ **NÃO aplicada** (sem autorização)

---

## 1. Migration aplicada

| Item | Resultado |
|------|-----------|
| Arquivo | `supabase/migrations/20260801_tms032_p0_aceite_policy.sql` |
| Horário da aplicação | 01:00:XX (0.17s via transação `BEGIN/COMMIT`) |
| Conteúdo | Somente `DROP POLICY IF EXISTS` + `CREATE POLICY hae_insert_prestador` |
| Nenhuma função/trigger alterada | ✅ (sem `CREATE OR REPLACE FUNCTION`) |
| Nenhum REVOKE/GRANT | ✅ |
| Nenhuma outra tabela alterada | ✅ |

## 2. Confirmação da policy (pré e pós)

**Pré-aplicação (read-only em `pg_policies`):** `hae_insert_prestador` **NÃO existia** (só `hae_insert_tms` + `hae_select_tms`).

**Pós-aplicação (confirmação em `pg_policies`):**

| Policy | Cmd | Roles | WITH CHECK |
|--------|-----|-------|-----------|
| `hae_insert_prestador` | INSERT | authenticated | `EXISTS (SELECT 1 FROM alocacoes_escala ae JOIN prestadores p ON p.id = ae.prestador_id WHERE ae.id = historico_alocacoes_escala.alocacao_id AND p.auth_user_id = auth.uid())` |
| `hae_insert_tms` | INSERT | authenticated | `EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())` |
| `hae_select_tms` | SELECT | authenticated | (null) |

Confirmação exata da condição (lida do banco, não do arquivo) bate com a migration: JOIN por `alocacao_id` + `prestadores.auth_user_id = auth.uid()`. Nenhuma policy existente foi removida.

## 3. Homologação do aceite (PWA App Prestador)

**Credencial:** `infraestruturaconexao@gmail.com` (PWA `https://prestador-app.pages.dev`)
**Alocação HML:** `01fc1dce-a7b2-4b4d-a78a-06a267d02afd` — `OS-202608-981024` — origem Praça Carlos Corrêa Penteado / destino Av. Paulista.

| Verificação | Resultado |
|-------------|-----------|
| PATCH em `alocacoes_escala` | ✅ **200** — `PATCH /rest/v1/alocacoes_escala?id=eq.01fc1dce...&prestador_id=eq.e6646799...&select=id,status,metadata` |
| Sem 403 / sem 42501 | ✅ 0 erros 4xx/5xx na sessão |
| Histórico criado (`historico_alocacoes_escala`) | ✅ 2 registros via trigger: `mudanca_status aguardando_aceite → aceita` + `aceite_prestador` |
| Status da alocação | ✅ `aguardando_aceite` → **`aceita`**, `aceite_prestador=true`, `data_aceite=2026-08-01T22:00:57.925Z` |
| Sem rollback | ✅ transação do trigger confirmada |
| Timeline | ✅ evento `operation_accepted` — "Serviço Aceito" — `driver_id=7cc4bb3d...` (via `POST /rest/v1/operation_timeline_events` → 201) |
| Torre / KPIs | ✅ refletem via Realtime (`alocacoes_escala` postgres_changes + Event Bus) e `operation_timeline_events` |

**Causa raiz resolvida:** o trigger INVOKER `registrar_historico_alocacao()` (que grava `alocacao_id = NEW.id`) agora tem policy de INSERT para o prestador autenticado — o 403 do TMS-031 no aceite está eliminado.

## 4. Próximo passo da homologação (NÃO concluído — estado do App)

Após o aceite, a PWA foi reaberta para avançar etapas (GPS → etapas → evidências → fotos → assinatura → canhoto → POD → ocorrência → finalização).

**Observação:** ao reabrir, o App exibiu novamente o diálogo "Aceitar serviço" para uma **outra** operação antiga em `aguardando_aceite` (`ecaedf20-9112-4195-b163-86b17e21a7d5`, de 29/07) — o seletor de card por destino da HML (Av. Paulista) não navegou para a operação correta na nova sessão. Nenhuma escrita nova ocorreu (0 chamadas), portanto **nenhum erro RLS/RPC/trigger/função** foi produzido neste passo.

**Bloqueio atual (não é RLS):** a PWA mantém estado local defasado (lista de operações cacheada) e o avanço de etapas depende de navegar para a operação HML correta dentro do fluxo do App. Avanço de etapas **não foi executado** nesta rodada.

## 5. Confirmações obrigatórias

| Confirmação | Status |
|-------------|--------|
| Migration aplicada | ✅ `20260801_tms032_p0_aceite_policy.sql` |
| Horário | ✅ 2026-08-02 01:00 |
| Confirmação da policy (lida do banco) | ✅ `hae_insert_prestador` INSERT authenticated com JOIN por alocação |
| Resultado do aceite | ✅ PATCH 200, sem 403 |
| Histórico gerado | ✅ 2 registros (`mudanca_status` + `aceite_prestador`) |
| Status da alocação | ✅ `aceita` + `aceite_prestador=true` + `data_aceite` |
| Timeline | ✅ `operation_accepted` ("Serviço Aceito") |
| Torre | ✅ via Realtime `alocacoes_escala` + `operation_timeline_events` |
| Próximo bloqueio | ⏳ Avanço de etapas na PWA (navegação para a operação HML correta; estado local do App) |
| **Migration 2 (S1/S2/S9) aplicada** | ❌ **NÃO aplicada** |

## 6. Risco remanescente (não tratado)

- S1: `f_avancar_etapa_app_motorista` STABLE com UPDATE/INSERT e sem `auth.uid()`
- S2: `f_aceitar_oportunidade_rede` sem `auth.uid()` / pertencimento
- S9: grants `anon`/`PUBLIC` residuais nas 3 RPCs do App

Todos continuam **EM PRODUÇÃO** e exigem a Migration 2 + autorização explícita. Nenhum deles foi alterado.

## 7. Evidências

- `test-results/tms032/homologacao/pos-aceite.png` + `pos-aceite.json`
- `test-results/tms032/homologacao/rede.json` (rede do aceite)
- `test-results/tms032/homologacao/rede-sessao-etapas.json` (rede da sessão de etapas)
- Scripts: `scripts/tms032_homologacao_aceite.mjs`, `scripts/tms032_homologacao_etapas.mjs`
