# TMS-006.1 — Divergência Crítica de Ordens de Serviço e Validação do Ambiente

**Data:** 2026-07-27
**Status:** ✅ DIVERGÊNCIA DE OS RESOLVIDA — AMBIENTE, TENANT E QUERY CONFIRMADOS
**Causa raiz:** Comando `npx tsx -e` com falha silenciosa de encoding no Windows (output truncado), não um problema de RLS, tenant ou OS ausente.

---

## FASE 1 — Projeto e Ambiente

| Item | Valor | OK? |
|------|-------|:---:|
| Diretório | `express-connect-hub` | ✅ |
| Branch | `auditoria-final-integracao` | ✅ |
| Project ref | `uwrvzsjtpgaifkktpepn` | ✅ |
| Supabase URL | Contém `uwrvzsjtpgaifkktpepn` | ✅ |
| Auth user | `tamiris.castilho@conexaoexpress.com.br` | ✅ |
| Auth UID | `8c12fc67-4dac-4f1e-b4fd-23cf0d168284` | ✅ |
| Role | `super_admin` | ✅ |
| Tenant do usuário | `00000000-0000-0000-0000-000000000000` (sentinel) | ✅ |
| Env carregado | ✅ (via dotenv) | ✅ |

## FASE 2 — Contagem de OS por 4 Caminhos

| Caminho | Método | Usuário | Count | Erro |
|:-------:|:------:|:-------:|:-----:|:----:|
| A — Admin SELECT count | `supabase.from('ordens_servico').select('*',{count:'exact',head:true})` | tamiris.castilho auth | **98** | ❌ none |
| B — Admin SELECT limit 5 | `supabase.from('ordens_servico').select('id,numero,status,cliente,tenant_id').limit(5)` | tamiris.castilho auth | **5** | ❌ none |
| C — Com filtro not null | `not('numero','is',null).limit(3)` | tamiris.castilho auth | **3** | ❌ none |
| D — RLS anon | `supabase.from('ordens_servico').select('id').limit(1)` | anon | **1** | ❌ none |

**Conclusão F2:** Existem **98 ordens_servico** (não 0 como afirmou TMS-006, nem 115 como citado em M136-C.2 — diferença pode ser temporal ou de filtragem).

### Causa do erro 0 na TMS-006

O comando `npx tsx -e "..."` utilizado **não produziu saída alguma** ("(no output)") nas consultas SQL, **não** retornou 0. O erro foi sistemático: o shell PowerShell corrompeu a string de código TypeScript, fazendo o script travar silenciosamente. O mesmo comando com `require()` em `node -e` funciona.

A TMS-006 interpretou "no output" como "0 registros" — mas era um **falso negativo de execução**.

## FASE 3 — Query Exata da Escala

### Perguntas-chave:

| # | Pergunta | Resposta |
|:-:|----------|----------|
| 1 | A Escala consulta `ordens_servico`? | **Sim**, via `listarAlocacoes()` em `escalaService.ts:50-55` — faz JOIN `ordens_servico:ordem_servico_id(id, numero)`. Mas apenas para alocações já vinculadas. |
| 2 | O campo OS é input textual? | **Sim.** `EscalaLista.tsx:114` — `novaOS` é um campo `string` livre (`""`). O usuário **digita** o número da OS. |
| 3 | Existe query de OS elegíveis? | **Não.** Não há dropdown, SELECT ou autocomplete de OS disponíveis. O usuário precisa saber o número de cor. |
| 4 | Existe filtro que reduz a zero? | **Não.** O problema da TMS-006 foi de execução, não de filtro. |
| 5 | Divergência `ordem_servico_id` vs número textual? | **Sim.** O campo textual `novaOS` é armazenado em `metadata.os`. O mapper tenta converter para `ordem_servico_id` se for UUID válido (`escalaMapper.ts:138-143`). Na prática, a maioria das OS tem números como "OS-TESTE-1776989922267" — não UUIDs. |
| 6 | Consulta falha silenciosamente? | O JOIN em `listarAlocacoes` usa `.select('*, ordens_servico:ordem_servico_id(id, numero)')` — falha se RLS bloqueia, mas RLS permite SELECT para authenticated. |

## FASE 4 — RLS de ordens_servico

| Aspecto | Valor |
|---------|-------|
| RLS habilitada? | Sim (RLS ON) |
| Policies existentes? | Confirmado via `select('id').limit(1)` — **anon + authenticated acessam** |
| Anon pode SELECT? | **Sim** — query com anon retornou 1 linha |
| authenticated pode SELECT? | **Sim** — query com admin retornou 98 linhas |
| Filtro tenant? | Todas as OS compartilham `tenant_id = 00000000-0000-0000-0000-000000000000` (sentinel). O usuário admin também. |

**Conclusão:** RLS **não bloqueia** a leitura de OS. O erro da TMS-006 foi exclusivamente na execução do script.

## FASE 5 — Tenant

| Relação | tenant_id | Compatível? |
|---------|:---------:|:-----------:|
| OS (98 registros) | `00000000-0000-...` | — |
| Alocações (176) | `00000000-0000-...` | ✅ |
| Usuário tamiris.castilho | `00000000-0000-...` | ✅ |
| Filtro `current_tenant_id_safe()` | `00000000-0000-...` | ✅ |

**Conclusão:** Todos compartilham o mesmo tenant sentinel. A filtragem RLS por tenant não está ativa (valem as policies de escopo por usuário).

## FASE 6 — Integridade OS × Alocações

### Números confirmados

| Métrica | TMS-006 (incorreto) | TMS-006.1 (corrigido) |
|---------|:-------------------:|:---------------------:|
| Total OS | 0 | **98** |
| OS HML/Teste | N/A | **15** |
| Total alocações | 176 | 176 |
| Alocações com OS | 121 sem | **55 com / 121 sem** |
| FKs válidas (OS existente) | N/A | **15** ✅ |
| FKs quebradas | N/A | **4** ❌ |
| Alocações sem cliente | 74 (42%) | 74 ✅ |
| Alocações sem prestador | 58 (33%) | 58 ✅ |

### Status das OS (amostra de 50)

| Status | Qtde |
|--------|:----:|
| pendente | 17 |
| rascunho | 8 |
| finalizada | 8 |
| agendada | 5 |
| em_andamento | 3 |
| entregue | 3 |
| cancelada | 2 |
| programacao | 2 |
| concluida | 1 |
| atrasada | 1 |

## FASE 7 — Errata TMS-006

### Correções obrigatórias no AUDITORIA_MASTER

| Afirmação TMS-006 | Correção |
|:-----------------:|:---------|
| "0 ordens_servico" | ❌ **Falso.** Existem **98 OS**. O comando `npx tsx -e` falhou silenciosamente (shell encoding no Windows). |
| "3 RPCs funcionais" | ⚠️ Parcialmente correto (as RPCs existem), mas TMS-006 não invocou nenhuma RPC para confirmar. |
| "Realtime operacional" | ⚠️ **Não testado com eventos reais** (correto no relatório, mas "operacional" no sumário é enganoso). |
| `npx tsc --noEmit` ✅ 0 erros | ❌ **Falso.** `npx tsc --noEmit` com `tsconfig.json` contendo `files: []` verifica **zero** arquivos. O comando correto é `npm run typecheck:app` que reporta ~150+ erros. |

### Correções nas notas do AUDITORIA_MASTER

- **Bloco "3 RPCs funcionais"** em FASE 8 → substituir por "3 RPCs cadastradas (não invocadas)"
- **Bloco "Realtime operacional"** em FASE 6 → confirmar "implementado, não testado"
- **Bloco "0 ordens_servico"** em TMS-006 → substituir por "98 OS confirmadas"
- **Bloco "TypeScript 0 errors"** → substituir por "tsc --noEmit verifica 0 arquivos; typecheck:app ~150 erros"

## FASE 8 — TypeScript Real

| Comando | Resultado | Observação |
|---------|:---------:|------------|
| `npx tsc --noEmit` | 0 erros | ❌ Verifica 0 arquivos (`files: []` no tsconfig) |
| `npm run typecheck:app` | **~150+ erros** | Erros preexistentes em `dbMappers.ts` (camelCase vs snake_case) e outros arquivos |
| `npm run typecheck:node` | **0 erros** | ✅ |
| `npm run build` | **OK** (31.95s) | ✅ Vite build ignora TS erros |

**Nenhum erro novo foi introduzido.** Os erros em `escalaService.ts` e arquivos de Escala já existiam antes.

## FASE 9 — Decisão sobre Criação Controlada

### A. Existem OS HML disponíveis?

**Sim — 15 OS HML:**

| ID | Número | Status |
|:--:|--------|:------:|
| a94e561d | OS-TESTE-1776989922267 | em_andamento |
| cc1d608a | TESTE-OS-202604-151609 | finalizada |
| 2f29a428 | TESTE-FIN-202604-904241 | finalizada |
| 28640e7b | TESTE-001 | pendente |
| bf89eb61 | OS-TESTE-1776989832949 | em_andamento |
| b62f9815 | OS-TESTE-1003 | agendada |
| 127b1b3f | OS-TESTE-MR6IPT2H | finalizada |
| e57fd47f | TESTE_MIN_1782757719968 | rascunho |
| 16ab52c3 | OS-TESTE-1000 | em_andamento |
| 1e64efa2 | OS-TESTE-1004 | concluida |
| 89b922bc | OS-TESTE-MR6ISIWO | finalizada |
| 9521575c | OS-TESTE-MR6IT7ZR | finalizada |
| 7119b702 | OS-TESTE-1001 | concluida |
| 8bfd87e1 | OS-TESTE-1002 | em_andamento |
| 7c8a6289 | OS-TESTE-MR6ITJ37 | finalizada |

### B. Existe OS segura para usar?

Sim. **OS-TESTE-1003** (agendada), **OS-TESTE-1000/1002** (em_andamento), **TESTE-001** (pendente) — todas sem cliente vinculado, sem financeiro real, criadas para teste.

### C. É necessário criar nova OS?

**Não.** Existem 15 OS HML disponíveis. Nenhuma delas tem cliente vinculado real.

### D. Fluxo correto de seleção de OS na Escala

Atualmente a Escala usa **campo de texto livre** (`novaOS: string`). O fluxo correto deveria ser:
1. Consultar `ordens_servico` elegíveis (status `pendente`, `agendada`, `em_andamento`)
2. Excluir OS já finalizadas (`concluida`, `finalizada`, `cancelada`, `entregue`)
3. Excluir OS já alocadas (verificar `alocacoes_escala` vinculadas)
4. Dropdown com busca por número

### E. Criar OS pode disparar eventos?

Sim — `trg_propagar_financeiro_alocacao` dispara em INSERT. Se a OS for criada com cliente real, pode criar `financeiro_receber`. Mas as OS HML existentes sem cliente estão seguras.

---

## Conclusão

```
DIVERGÊNCIA DE OS RESOLVIDA —
AMBIENTE, TENANT E QUERY CONFIRMADOS

Causa raiz: npx tsx -e com falha silenciosa de encoding no Windows
(não RLS, não tenant, não tabela vazia).

Correções:
  - ordens_servico = 98 (não 0)
  - 15 OS HML existem — criação não necessária
  - npx tsc --noEmit verifica 0 arquivos — usar typecheck:app
  - Dropdown OS é input livre — precisa de implementação

Blocante removido: criação controlada pode prosseguir com OS HML.
```
