# RELATÓRIO FINAL — F2-A1 Correção RLS ordens_servico

**Missão:** 136-C.2-F2-A1  
**Data:** 2026-07-23  
**Status:** 🔶 Diagnóstico, migration e testes preparados. Aplicação pendente de aprovação humana.

---

## MATRIZ ANTES vs DEPOIS (PROPOSTA)

| Item | Antes | Proposta | Evidência |
|------|-------|----------|-----------|
| **Anon** | Acessa OS via policy `os_select_tenant` TO anon | **Bloqueado** — sem policy para anon, RLS bloqueia por padrão | Script `f2a1_etapas1_2_3.ts`: anon conseguiu SELECT via policy |
| **Super admin** | Vê OS do tenant (erro UUID em 6 registros) | Vê OS do tenant + cliente (safe cast, sem erro) | `qa04_debug_os.ts`: 43/49 OK, 6 erro UUID |
| **Admin** | Vê OS do tenant (erro UUID) | Vê OS do tenant (safe cast) | Mesmo que super_admin |
| **Operador** | Vê OS do tenant (erro UUID) | Vê OS do tenant (safe cast) | `f2a1_etapas1_2_3.ts`: operacional falhou com UUID error |
| **Financeiro** | Vê OS do tenant (erro UUID) | Vê OS do tenant (safe cast) | `f2a1_etapas1_2_3.ts`: financeiro falhou com UUID error |
| **Comercial** | Vê OS do tenant (erro UUID) | Vê OS do tenant (safe cast) | Login não confirmado (senha incorreta) |
| **Cliente correto** | Apenas por tenant_id | Por tenant_id OU cliente_id via `f_usuario_pode_acessar_cliente()` | Migration `20260722_m136a_fix2_clientes_rls.sql` |
| **Outro cliente** | Inacessível (tenant filter) | Inacessível (tenant + cliente filter) | Mantido |
| **Outro tenant** | Inacessível (tenant filter) | Inacessível (tenant filter) | Mantido |
| **Registro legado** | Causa `invalid input syntax for type uuid` | **Filtrado** — regex retorna false, linha invisível | `qa04_debug_os.ts`: 6 registros com tenant_id=texto não-UUID |

---

## RESPOSTAS ÀS 24 PERGUNTAS

### 1-7: Policies
**1.** Policy defeituosa: **`os_select_tenant`** — `USING (tenant_id = current_tenant_id_safe())` com `TO anon, authenticated`.
**2.** Causa raiz real: **`tenant_id` é TEXT, `current_tenant_id_safe()` retorna UUID**. Comparação causa cast implícito TEXT→UUID que falha para 6 registros com valores não-UUID.
**3.** Existia cast TEXT→UUID? **Sim** — o cast é implícito na comparação `tenant_id = current_tenant_id_safe()`.
**4.** Coluna correta para a policy: **`tenant_id` — mas com safe-cast via regex UUID**. Alternativa: `cliente_id` (UUID nativo) para clientes do Portal.
**5.** Policies analisadas: **4** (`os_select_tenant`, `os_insert_tenant`, `os_update_tenant`, `os_delete_tenant`).
**6.** Policies removidas: **1** (`os_select_tenant` — substituída por `os_select_authenticated`).
**7.** Policies criadas: **1** (`os_select_authenticated`). As outras 3 foram recriadas com safe cast (mesmo nome).

### 8-14: Impacto por perfil
**8.** Anon bloqueado? **Sim** — nova policy não inclui anon. RLS bloqueia por padrão.
**9.** Outro tenant bloqueado? **Sim** — mantido via `current_tenant_id_safe()`.
**10.** Cliente vê somente suas OS? **Sim** — via `f_usuario_pode_acessar_cliente(cliente_id)`.
**11.** Registros legados deixam de quebrar consultas? **Sim** — regex filtra, linha invisível, sem erro.
**12.** INSERT alterado? **Sim — recriado com safe cast**. Comportamento funcional idêntico (mesmo CHECK), apenas com proteção contra cast inseguro.
**13.** UPDATE alterado? **Sim — recriado com safe cast**. Comportamento funcional idêntico.
**14.** DELETE alterado? **Sim — recriado com safe cast**. Comportamento funcional idêntico.

### 15-19: Consumidores e modificações
**15.** Consumidores auditados: **8** (TMS via `ordemServicoService`, Portal Cliente via `portalClienteService`, Financeiro via `composicaoFinanceiraService`, Fiscal via `cteService`, Torre de Controle, Relatórios, Robôs IA, App Prestador via `escalaService`).
**16.** Algum consumidor depende de acesso anon? **Não encontrado.** Todos os consumidores autenticam via JWT do Supabase.
**17.** Migration criada? **Sim** — `supabase/migrations/20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql`.
**18.** Migration aplicada? **NÃO** — aguardando aprovação humana.
**19.** Produção foi modificada? **NÃO** — nenhuma alteração executada.

### 20-24: Testes e conclusão
**20.** Testes preparados: **Sim** — 8 testes Playwright + 10 testes SQL conceituais.
**21.** Rollback documentado: **Sim** — `docs/qa/F2_A1_RLS_ORDENS_SERVICO_ROLLBACK.md`.
**22.** É seguro solicitar aprovação para aplicar? **Sim** — risco baixo, rollback rápido, sem alteração de dados.
**23.** A Missão F2-A1 está concluída? **SIM — como "Diagnóstico, migration e testes preparados; aplicação pendente de aprovação".**
**24.** A Missão 136-C.2 está concluída? **NÃO** — múltiplas sub-missões (QA0, QA0.2, QA0.3, QA0.4-R1, F2-A1) foram concluídas, mas a missão 136-C.2 como um todo requer correções reais em produção, ambiente QA e testes operacionais.

---

## ARQUIVOS GERADOS NESTA MISSÃO

| Arquivo | Tipo |
|---------|------|
| `supabase/migrations/20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql` | Migration |
| `tests/e2e/m136c2-f2-a1-rls-ordens-servico.spec.ts` | Teste Playwright (8) |
| `tests/database/m136c2-f2-a1-rls-ordens-servico.sql` | Teste SQL conceitual (10) |
| `docs/qa/F2_A1_RLS_ORDENS_SERVICO_DIAGNOSTICO.md` | Diagnóstico |
| `docs/qa/F2_A1_RLS_ORDENS_SERVICO_PLANO_TESTES.md` | Plano de testes |
| `docs/qa/F2_A1_RLS_ORDENS_SERVICO_ROLLBACK.md` | Rollback |
| `docs/qa/F2_A1_RLS_ORDENS_SERVICO_RELATORIO.md` | Gate / Relatório |
| `scripts/f2a1_etapas1_2_3.ts` | Script de diagnóstico |
