# Missao 01 — Plano de Impacto — Seguranca Enterprise

> **Data:** 2026-06-26 | **Missao:** 1 de 10 | **Foco:** Seguranca RLS, Grants, SECURITY DEFINER, IA

---

## 1. Inventario do Estado Atual

### 1.1 Politicas RLS (470+ politicas em ~96 tabelas)

| Categoria | Tabelas | Politicas | Risco |
|-----------|---------|-----------|-------|
| A — FULLY OPEN `USING(true) WITH CHECK(true)` para anon | 12 | ~20 | P0 |
| B — OPEN leitura anon, escrita public | 2 | 2 | P0 |
| C — IA F30-F40 com 4 politicas `USING(true)` cada | 60+ | 240+ | P0 |
| D — Portal/Contratos com `USING(true)` | 16 | ~50 | P0 |
| E — `auth.role()='authenticated'` | 20+ | 80+ | P1 |
| F — Row-level `auth.uid()` | 2 | 5 | OK |

### 1.2 Grants Perigosos

| Grant | Tabelas | Risco |
|-------|---------|-------|
| `GRANT ALL TO anon` | 4 (automacoes_robos, instrucoes, gatilhos, gatilhos_execucao) | P0 |
| `GRANT SELECT/INSERT/UPDATE/DELETE TO anon` | 20+ | P0 |
| `GRANT SELECT TO anon` em views | 7 | P1 |
| `GRANT EXECUTE TO anon` em funcao | 1 (obter_cliente_id_do_usuario) | P1 |

### 1.3 SECURITY DEFINER (17 funcoes)

| Status | Quantidade |
|--------|-----------|
| Com `search_path = ''` | 9 |
| Sem `search_path = ''` | 8 |
| Usam auth.uid() | 1 (obter_cliente_id_do_usuario) |

### 1.4 Revogacoes Conflitantes

- `20260626_enterprise_hardening.sql` REVOGA `GRANT ALL` de `ia_credenciais`, `ia_identidades`, `ia_sessoes_operacionais`
- `20260720_f36_identidade_sessoes_credenciais.sql` RE-CONCEDE `GRANT SELECT,INSERT,UPDATE,DELETE TO anon`
- **Conflito ativo:** F36 anula o hardening

---

## 2. Tabelas Afetadas por Fase

### FASE 2 — RLS (96 tabelas impactadas)

**Alteracao segura (sem quebrar leitura):**
- SELECT: manter `USING (true)` para compatibilidade (app ainda usa anon key)
- INSERT/UPDATE/DELETE: alterar para `auth.role() = 'authenticated'`

**Tabelas que NAO podem perder acesso anon (quebraria o app):**
- `crm_leads`, `crm_historico`, `crm_followups` — usados pelo CRM publico
- `orcamentos` — criacao de orcamento pelo comercial
- `portal_*` — portal do cliente (ainda sem auth)
- `alocacoes_escala` — usado por toda a operacao
- `ordens_servico` — usado por toda a operacao
- `clientes`, `prestadores`, `veiculos` — cadastros base

**Estrategia:** Manter SELECT aberto (anon) em todas as tabelas. Restringir INSERT/UPDATE/DELETE para `authenticated`. Criar funcao Edge para operacoes que precisam de escrita anon (portal cliente, app prestador).

### FASE 3 — Grants (24 tabelas impactadas)

**Revogar:**
- 4 `GRANT ALL TO anon` → `GRANT SELECT TO anon`
- 20+ `GRANT SELECT,INSERT,UPDATE,DELETE TO anon` → `GRANT SELECT TO anon`

**Manter (essenciais para o app funcionar):**
- `GRANT SELECT TO anon` em views do portal
- `GRANT SELECT TO anon` em tabelas de cadastro

### FASE 4 — SECURITY DEFINER (17 funcoes)

**Adicionar `search_path = ''`:**
- 8 funcoes sem protecao

**Adicionar `auth.uid()` validation:**
- DreamFlow RPCs (aceitar_viagem, recusar_viagem, etc.) — validar token contra `motorista_app_sessoes`

### FASE 5 — IA (1 service, 2 metodos)

**Arquivos:**
- `src/services/ia/actionEngineService.ts` — `executarAcaoReal()` (linha 648-1057)
- `src/services/ia/governancaService.ts` — `avaliarAcao()` (linha 192-313)

**Alteracao:** Adicionar chamada a `governancaService.avaliarAcao()` no inicio de `executarAcaoReal()`.

---

## 3. Services Afetados

| Service | Impacto | Acao |
|---------|---------|------|
| `src/lib/supabase.ts` | Inicializacao do client | Sem alteracao (anon key continua) |
| `src/services/ia/governancaService.ts` | Avaliacao de acoes | JA CORRIGIDO (default `precisa_aprovacao: true`) |
| `src/services/ia/actionEngineService.ts` | Execucao de acoes | ADICIONAR re-verificacao em `executarAcaoReal()` |
| `src/services/ia/conectoresService.ts` | Execucao de conectores | Sem alteracao necessaria |
| `src/lib/auth.ts` | Autenticacao | Sem alteracao (ainda sem auth) |
| 80+ componentes | Acesso direto ao Supabase | Sem alteracao (SELECT mantido aberto) |

---

## 4. Componentes Afetados

**NENHUM componente precisa ser alterado** se a estrategia de manter SELECT aberto for adotada.

**Se restringirmos totalmente o anon (incluindo SELECT):**
- 80+ componentes que usam `supabase.from().select()` diretamente quebrariam
- Seria necessario implementar Supabase Auth em todos os componentes
- **Risco: MUITO ALTO** — nao aplicar nesta missao

---

## 5. Riscos de Quebrar Funcionalidades

| Funcionalidade | Risco | Mitigacao |
|---------------|-------|-----------|
| Login | BAIXO | Auth nao implementado ainda — sem impacto |
| Portal Cliente | ALTO se restringir SELECT | Manter SELECT aberto para anon |
| Portal Prestador | ALTO se restringir SELECT | Manter SELECT aberto para anon |
| App Prestador (mobile) | ALTO se restringir SELECT | Manter SELECT aberto para anon |
| Dashboard | BAIXO | Dashboard le dados, nao escreve |
| Financeiro | BAIXO | Financeiro usa servicos que escrevem |
| IA / Central IA | MEDIO | IA escreve via `executarAcaoReal()` |
| Operacao (OS/Escala) | MEDIO | Criacao de OS/escala via form |
| Fiscal | BAIXO | Usa `auth.role()='authenticated'` |
| CRM | BAIXO | SELECT mantido aberto |

---

## 6. Ordem de Aplicacao (Plano de Voo)

### Passo 1 — Criar migration SQL unificada
- `20260626_missao01_seguranca_enterprise.sql`
- Conteudo: FASE 2 + FASE 3 + FASE 4

### Passo 2 — Corrigir SECURITY DEFINER (FASE 4)
- `search_path = ''` nas 8 funcoes restantes
- Bloco PL/pgSQL dinamico

### Passo 3 — Corrigir Grants (FASE 3)
- Revogar excessos do anon
- Manter SELECT para compatibilidade

### Passo 4 — Corrigir RLS (FASE 2)
- Criar politicas dual: SELECT para anon, INSERT/UPDATE/DELETE para authenticated
- ~60 tabelas IA + 16 portal/contratos + 12 CRM/operacao

### Passo 5 — Dupla barreira IA (FASE 5)
- Adicionar `governancaService.avaliarAcao()` em `executarAcaoReal()`
- Verificar permissao ANTES de cada execucao real

### Passo 6 — Auditoria (FASE 6)
- Trigger de log para acoes criticas

### Passo 7 — Testes (FASE 7)
- 10 cenarios de seguranca

### Passo 8 — Documentacao (FASE 8)
- 6 documentos

### Passo 9 — Validacao (FASE 9)
- TypeScript + Build + Playwright

---

## 7. O Que NAO Fazer Nesta Missao

- NAO implementar autenticacao completa (Supabase Auth)
- NAO alterar componentes frontend
- NAO alterar servicos (exceto actionEngineService.ts)
- NAO mexer em financeiro, UX ou operacao
- NAO criar perfis de usuario (admin, financeiro, etc.) — apenas preparar RLS para suporta-los
- NAO restringir SELECT do anon (quebraria o app)

---

*Documento gerado para Missao 01 — OpenCode Go Pro*
