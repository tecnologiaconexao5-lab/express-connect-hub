# Relatório de Auditoria — RLS `alocacoes_escala`

**Data:** 2026-07-27
**Branch:** `auditoria-final-integracao`
**Database:** Produção (`uwrvzsjtpgaifkktpepn.supabase.co`)
**Duração da auditoria:** Sessão única

---

## Resumo Executivo

### Descobertas

| ID | Severidade | Descrição | Status |
|:--:|:----------:|-----------|:------:|
| D01 | **P0** | 4 policies com role `{public}` e `USING(true)` em `alocacoes_escala` — qualquer pessoa com a chave anon pública lê, insere e altera QUALQUER registro | ✅ Migration criada |
| D02 | **P1** | `current_tenant_id_safe()` tem 3 versões conflitantes. M44A/M46 leem `app.current_tenant_id` (nunca setado), enquanto frontend seta `app.tenant_id`. RLS baseada nesta função quebra para TMS users | ⚠️ Pendente |
| D03 | **P1** | `f_aceitar_oportunidade_rede` NÃO TEM GRANT EXECUTE em nenhuma migration — App Motorista nunca conseguiu chamar esta RPC | ⚠️ Pendente |
| D04 | **P2** | Policy `"Prestador can update own alocacoes"` permite UPDATE direto via REST (sem RPC). 8 funções TS dependem dela | ⚠️ Risco residual |
| D05 | **P2** | `f_aceitar_oportunidade_rede` (M111) não valida `auth.uid()` contra `prestador_id` — qualquer authenticated pode aceitar para qualquer prestador | ⚠️ Pendente |

### P0 — Corrigido (Migration preparada)

**Vulnerabilidade:** `anon` podia executar SELECT/INSERT/UPDATE/DELETE em `alocacoes_escala` com a chave anônima pública do frontend.

**Prova:** Teste prático via REST anon key retornou 3 linhas de dados reais (alocações com status `cancelada`, dados de 2026-06-02).

**Solução:** Alternativa 0 — migration DDL pura que:
1. DROP das 4 policies inseguras
2. REVOKE ALL de `anon`
3. 4 novas policies TMS via subquery `tenant_usuarios` (sem `current_tenant_id_safe`)
4. 1 policy SELECT para Portal Cliente
5. Preserva as 2 policies do prestador

**Arquivos:**
- `supabase/migrations/20260807_alternativa0_minimo_p0_alocacoes_escala.sql`
- `supabase/migrations/20260807_alternativa0_rollback.sql`
- `docs/auditoria/ALTERNATIVA0_ENTREGA_COMPLETA.md`

**Não aplicado em Produção.**

### P1 — Pendentes (Migration separada)

1. **`current_tenant_id_safe()` bug:** A função foi sobrescrita por M44A/M46 para ler `app.current_tenant_id` (parâmetro errado). Correção: `CREATE OR REPLACE` para ler `app.tenant_id` OU substituir todas as chamadas por subquery direta (centenas de policies impactadas — escopo grande).

2. **`f_aceitar_oportunidade_rede` sem GRANT:** Nenhuma das 4 versões (M84, M108E, M108F, M111) inclui `GRANT EXECUTE`. Além disso, a M111 não valida `auth.uid()` contra o prestador — vulnerabilidade de autenticação.

### P2 — Risco residual documentado

**Policy `"Prestador can update own alocacoes"`:** Mantida intencionalmente. 8 funções em `escalaService.ts` e `portalPrestadorService.ts` fazem UPDATE direto via REST. Nenhuma altera colunas financeiras ou administrativas. Correção futura proposta em:
- `docs/auditoria/PROPOSTAS_UPDATE_PRESTADOR_ALOCACOES.md` (Proposta 1 e 2)

### Arquivos criados

| Arquivo | Linhas | Tamanho |
|---------|:------:|:-------:|
| `supabase/migrations/20260807_alternativa0_minimo_p0_alocacoes_escala.sql` | ~140 | ~5 KB |
| `supabase/migrations/20260807_alternativa0_rollback.sql` | ~50 | ~2 KB |
| `docs/auditoria/ALTERNATIVA0_ENTREGA_COMPLETA.md` | ~350 | ~15 KB |
| `docs/auditoria/PROPOSTAS_UPDATE_PRESTADOR_ALOCACOES.md` | ~450 | ~20 KB |
| **Total** | **~990** | **~42 KB** |

### Próximos passos

1. **Aplicar Alternativa 0 em Produção** (após autorização)
2. **Corrigir `current_tenant_id_safe()`** — migration separada para ler `app.tenant_id`
3. **Corrigir `f_aceitar_oportunidade_rede`** — adicionar GRANT EXECUTE + validação `auth.uid()`
4. **Avaliar remoção da policy UPDATE prestador** — propostas 1 ou 2 em migration futura
5. **Auditar outras tabelas** — `ordens_servico`, `clientes`, `financeiro_receber`, etc. têm policies anon similares

---

## Detalhamento

### 1. Escopo da auditoria

- Tabela: `alocacoes_escala` (172 registros em Produção)
- Policies RLS: 6 ativas (4 inseguras, 2 corretas)
- Grants: `anon` com ALL privileges
- Consumidores: ~110 arquivos, ~460 referências, 12 triggers, 10+ RPCs
- Frontend: `TenantContext.tsx` → `set_tenant_context({ p_tenant_id })` → seta `app.tenant_id`

### 2. Metodologia

1. Catalogação de policies via `pg_policies`
2. Teste prático anônimo via REST (chave anon pública)
3. Mapeamento de consumidores (grep em `src/` por `alocacoes_escala`)
4. Análise das RPCs do prestador (grants, validação, callers)
5. Análise do bug `current_tenant_id_safe()` (3 versões, 2 parâmetros diferentes)
6. Revisão 12-pontos da migration v1
7. Elaboração de matriz das 8 funções de UPDATE
8. Propostas de correção (3 alternativas)
9. Escolha da Alternativa 0 (mínima, segurança máxima, zero refatoração)

### 3. Policies — estado final proposto

| Policy | Role | Operação | Estado |
|--------|:----:|:--------:|:------:|
| `ae_select_tms` | authenticated | SELECT | ✅ Criada |
| `ae_insert_tms` | authenticated | INSERT | ✅ Criada |
| `ae_update_tms` | authenticated | UPDATE | ✅ Criada |
| `ae_delete_tms` | authenticated | DELETE | ✅ Criada |
| `ae_select_cliente` | authenticated | SELECT | ✅ Criada |
| `Prestador can view own alocacoes` | authenticated | SELECT | ✅ Preservada |
| `Prestador can update own alocacoes` | authenticated | UPDATE | ✅ Preservada |
| `alocacoes_escala_select_anon` | public | SELECT | ❌ Removida |
| `alocacoes_escala_insert_anon` | public | INSERT | ❌ Removida |
| `alocacoes_escala_update_anon` | public | UPDATE | ❌ Removida |
| `alocacoes_escala_update_authenticated` | public | UPDATE | ❌ Removida |

**Total: 7 policies** (5 novas + 2 preservadas)

### 4. Grants — antes vs depois

| Role | Antes | Depois |
|:----:|:-----:|:------:|
| `anon` | SELECT, INSERT, UPDATE, DELETE | **NENHUM** |
| `authenticated` | via RLS | via RLS (7 policies) |

### 5. Bug `current_tenant_id_safe()` — detalhe técnico

A função foi criada 3 vezes com CREATE OR REPLACE:

| Migration | Lê `app.tenant_id` | Lê `app.current_tenant_id` |
|-----------|:------------------:|:--------------------------:|
| M16 (2026-06-26) | ✅ Correto | ❌ |
| M44A (2026-06-30) | ❌ | ✅ **Bug** |
| M46 (2026-06-30) | ❌ | ✅ **Bug** |

Se M44A ou M46 foi a última aplicada, `current_tenant_id_safe()` retorna **sentinela** (`00000000-0000-0000-0000-000000000001`) e a comparação `tenant_id = current_tenant_id_safe()` falha para todas as linhas com tenant_id real.

**Impacto:** Toda policy RLS que usa `current_tenant_id_safe()` pode estar quebrada em Produção — incluindo `clientes`, `prestadores`, `veiculos`, `financeiro_receber`, `financeiro_pagar`, `ordens_servico`, etc. (dezenas de policies criadas por M16, M18, migrations posteriores).

### 6. `f_aceitar_oportunidade_rede` — detalhe técnico

| Migration | CREATE OR REPLACE | GRANT EXECUTE | auth.uid() validation |
|-----------|:-----------------:|:-------------:|:---------------------:|
| M84 | ✅ | ❌ | ❌ (nem existe parâmetro) |
| M108E | ✅ | ❌ | ❌ |
| M108F | ✅ | ❌ | ❌ |
| M111 | ✅ | ❌ | ❌ (p_auth_user_id opcional, só verifica existência) |

**Consequência:** Nenhum caller (App Motorista, Flutter, REST) consegue executar esta RPC. O fluxo de "Aceitar Oportunidade da Rede" pelo App nunca funcionou se dependia exclusivamente desta RPC.

### 7. Matriz das 8 funções de UPDATE direto

| # | Função | Arquivo | Perfil | Colunas | RPC alternativo | Risco |
|:-:|--------|---------|:------:|---------|:---------------:|:-----:|
| A1 | `aceitarAlocacao` | `escalaService.ts:496` | Prestador web | status, aceite, data | Parcial (f_avancar_etapa) | Alto |
| A2 | `recusarAlocacao` | `escalaService.ts:526` | Prestador web | status, aceite, motivo | ❌ Nenhum | Alto |
| A3 | `iniciarRota` | `escalaService.ts:567` | Prestador web | status, horario, km | ✅ f_avancar_etapa | Médio |
| A4 | `finalizarAlocacao` | `escalaService.ts:594` | Prestador web | status, finalizada, POD, fotos | Parcial (não cobre POD) | Crítico |
| B1 | `aceitarOperacao` | `portalPrestadorService.ts:390` | Prestador Portal | status, aceite, data | ❌ Mesmo A1 | Alto |
| B2 | `recusarOperacao` | `portalPrestadorService.ts:408` | Prestador Portal | status, aceite, motivo | ❌ Mesmo A2 | Alto |
| B3 | `iniciarOperacao` | `portalPrestadorService.ts:426` | Prestador Portal | status, horario, km | ✅ Mesmo A3 | Médio |
| B4 | `concluirOperacao` | `portalPrestadorService.ts:446` | Prestador Portal | status, finalizada, horario, km | Parcial Mesmo A4 | Médio |

**Grupo C (TMS admin, sem risco):** `trocarMotorista`, `trocarVeiculo`, `cancelarAlocacao` — todas em `escalaService.ts`, usam `ae_update_tms`.

Nenhuma função A/B altera colunas financeiras (`valor_frete`, `valor_repasse`) ou administrativas (`prestador_id`, `cliente_id`, `tenant_id`, `placa`).

---

## Arquivos de saída

| Arquivo | Caminho |
|---------|---------|
| Migration | `supabase/migrations/20260807_alternativa0_minimo_p0_alocacoes_escala.sql` |
| Rollback | `supabase/migrations/20260807_alternativa0_rollback.sql` |
| Análise completa | `docs/auditoria/ALTERNATIVA0_ENTREGA_COMPLETA.md` |
| Propostas UPDATE | `docs/auditoria/PROPOSTAS_UPDATE_PRESTADOR_ALOCACOES.md` |
| **Este relatório** | `docs/auditoria/relatorios/2026-07-27_0141_auditoria_rls_alocacoes_escala.md` |
