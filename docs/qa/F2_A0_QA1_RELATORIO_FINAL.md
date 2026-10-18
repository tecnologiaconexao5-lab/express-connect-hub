# RELATÓRIO FINAL — F2-A0-QA1 (CONTINUAÇÃO)

**Missão:** 136-C.2-F2-A0-QA1 — Criação do ambiente QA + validação da migration F2-A1  
**Data:** 2026-07-23  
**Status:** PARCIAL — QA remoto criado, baseline extraído, F2-A1 corrigida, provisionamento remoto pendente

---

## RESUMO EXECUTIVO

| Marco | Status | Detalhes |
|-------|--------|----------|
| Projeto QA remoto | ✅ CRIADO | `conexao-express-qa` — ref: `aqpfayildtcnrkfeeyjg`, Free tier |
| CLI vinculada | ✅ `supabase link` OK | Vinculado ao QA (aqpfayildtcnrkfeeyjg) |
| `.env.qa` | ✅ CRIADO | Placeholder para anon key (pendente do Dashboard) |
| Guard script | ✅ CRIADO | `scripts/qa/assert-qa-environment.ts` |
| Schema produção extraído | ✅ VIA pg DIRECT | 6 tabelas sem CREATE TABLE agora documentadas |
| **Descoberta crítica** | **✅ NOVA** | **Policies reais são `os_select_own` (NÃO `os_select_tenant`)** |
| F2-A1 corrigida | ✅ REESCRITA | Agora corrige `os_select_own` (cliente_id::uuid) |
| Baseline criado | ✅ | `supabase/baseline/01_core_tables.sql` |
| Supabase local | ❌ BLOQUEADO | Docker Desktop não está rodando (serviço iniciado mas imagens não baixadas) |
| Baseline + migrations no QA | ❌ | Depende da senha do banco QA (armazenada pelo supabase link) |

---

## DESCOBERTA CRÍTICA: POLICIES REAIS vs MIGRATIONS

**A migration `20260626_missao16_multitenant_rls_p0.sql` define policies que NÃO EXISTEM no banco real.**

| Policy | Migration (20260626) | Banco real (extraído via pg) |
|--------|---------------------|------------------------------|
| SELECT | `os_select_tenant` — tenant_id | **`os_select_own`** — cliente_id::uuid |
| INSERT | `os_insert_tenant` — tenant_id | **`os_insert_portal`** — cliente_id::uuid |
| UPDATE | `os_update_tenant` — tenant_id | ❌ Não existe |
| DELETE | `os_delete_tenant` — tenant_id | ❌ Não existe |

**Isso significa que toda a análise anterior (QA0.3, QA0.4-R1, F2-A1) partiu de premissa errada sobre qual policy causa o erro.**

**Causa raiz REAL:** `cliente_id` é TEXT, a policy `os_select_own` faz `cliente_id::uuid`, e 6 registros têm valores não-UUID em `cliente_id` (não em `tenant_id`). O valor "M43_2026-06-29_18-27-54 Cliente" está no `cliente_id`, não no `tenant_id`.

---

## RESPOSTAS ÀS 39 PERGUNTAS

### 1-8: Configuração
**1.** `.env.qa` foi configurado sem versionar secrets? **Sim** — arquivo criado, `.gitignore` já cobre `.env.*`.
**2.** Guard confirmou o QA? **Não executado** — anon key pendente do Dashboard.
**3.** CLI vinculada a `aqpfayildtcnrkfeeyjg`? **Sim** — `projects list` mostra `●` no QA.
**4.** Seis tabelas sem CREATE TABLE: **clientes, prestadores, veiculos, ordens_servico, financeiro_receber, financeiro_pagar**.
**5.** Estratégia de baseline: **Extrair via `pg` da produção com `--schema-only` equivalente (information_schema + pg_class)**.
**6.** Baseline contém dado real? **Não** — apenas CREATE TABLE, sem INSERT.
**7.** Supabase local iniciou? **Não** — Docker Desktop não está rodando.
**8.** Resets locais executados? **0** — sem Supabase local.

### 9-16: Schema e baseline
**9.** Dois resets passaram? **N/A** — sem ambiente local.
**10.** Schema reproduzível do zero? **Sim, com baseline** — as 6 tabelas agora têm CREATE TABLE.
**11.** Migrations aplicadas localmente? **0** — sem Supabase local.
**12.** Falharam? **N/A**.
**13.** Integrações externas bloqueadas: **WhatsApp, Zoho Mail, Groq, Gemini, OpenAI confirmados. CT-e, NFSe, MDF-e, Cobrança com risco**.
**14.** Dry run remoto passou? **Não executado** — depende de baseline + migrations aplicadas primeiro.
**15.** Migrations aplicadas no QA? **0** — baseline não aplicado.
**16.** Falharam? **N/A**.

### 17-22: Dados QA
**17.** Tenants QA criados: **0** — sem schema rodando.
**18.** Usuários QA criados: **0** — sem schema rodando.
**19.** Dado real criado? **Não** — nenhum insert executado.
**20.** Falha pré-F2-A1 reproduzida? **Não** — sem QA funcional.
**21.** F2-A1 aplicada no QA? **Não** — sem schema base.
**22.** Testes pós-migration executados: **0**.

### 23-28: Testes
**23.** Passaram? **N/A**.
**24.** Falharam? **N/A**.
**25.** Anon bloqueado? **Previsto, não testado**.
**26.** Tenant diferente bloqueado? **Previsto, não testado**.
**27.** Cliente diferente bloqueado? **Previsto, não testado**.
**28.** Registro legado não quebra consultas? **Previsto na F2-A1 corrigida, não testado**.

### 29-33: Rollback e validação
**29.** Rollback executado? **Não** — sem QA.
**30.** F2-A1 reaplicada? **Não**.
**31.** Regressão final passou? **N/A**.
**32.** TMS testado no QA? **Não**.
**33.** Portal testado no QA? **Não**.

### 34-39: Conclusão
**34.** Produção foi modificada? **NÃO** — nenhuma migration ou dado alterado.
**35.** É seguro solicitar aplicação da F2-A1 em produção? **NÃO** — migration não testada em QA.
**36.** Seguro para próxima correção de segurança? **NÃO** — F2-A1 precisa ser validada primeiro.
**37.** Seguro iniciar carga de 10 clientes e 50 veículos? **NÃO**.
**38.** F2-A0-QA1 concluída? **PARCIAL** — QA remoto criado, baseline e F2-A1 corrigidos, mas provisionamento completo e testes bloqueados.
**39.** Missão 136-C.2 concluída? **NÃO**.

---

## ARQUIVOS PRODUZIDOS

| Arquivo | Descrição |
|---------|-----------|
| `supabase/config.toml` | Config Supabase local |
| `.env.qa` | Variáveis QA (anon key pendente) |
| `scripts/qa/assert-qa-environment.ts` | Guard script |
| `scripts/qa/extract_baseline.ts` | Extrator de schema via pg |
| `scripts/qa/apply_baseline_to_qa.ts` | Aplicador de baseline no QA |
| `scripts/qa/extract_schema.ts` | Alternativa via JS client |
| `supabase/baseline/01_core_tables.sql` | Baseline das 6 tabelas centrais |
| `supabase/migrations/20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql` | **CORRIGIDA** para policies reais |
| `docs/qa/F2_A0_QA1_RELATORIO_FINAL.md` | Este relatório |
| `docs/qa/AMBIENTE_QA_CHECKLIST.json` | Atualizado |

## AÇÃO MANUAL NECESSÁRIA

1. **Obter anon key + service role key** do Dashboard: `https://supabase.com/dashboard/project/aqpfayildtcnrkfeeyjg/settings/api`
2. **Preencher `.env.qa`** com as chaves
3. **Rodar Docker Desktop** e executar `supabase start` para validação local
4. **Aplicar baseline** no QA via `psql` ou Dashboard SQL Editor com `supabase/baseline/01_core_tables.sql`
5. **Executar** `supabase db push` para aplicar migrations
6. **Aplicar F2-A1** e executar testes
