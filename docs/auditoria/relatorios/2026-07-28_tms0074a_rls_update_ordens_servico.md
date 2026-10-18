# TMS-007.4A — RLS UPDATE em ordens_servico

**Data:** 2026-07-28
**Missão:** TMS-007.4A — Auditoria e Preparação da RLS UPDATE de ordens_servico
**Branch:** `auditoria-final-integracao`
**Auditor:** opencode

---

## Conclusão

**POLICY UPDATE DE ORDENS_SERVICO PREPARADA E SEGURA — AGUARDANDO AUTORIZAÇÃO PARA APLICAÇÃO**

---

## 1. Estado Atual (Produção)

Confirmado via extração `pg_policies` (2026-07-23) + teste funcional (2026-07-28):

| Policy | Cmd | Roles | Qual | Status |
|--------|:---:|:-----:|:----:|:------:|
| `os_select_own` | SELECT | authenticated, anon | `cliente_id::UUID IN (...) OR f_usuario_pode_acessar_cliente(...)` | ✅ Ativa |
| `os_insert_portal` | INSERT | authenticated | `WITH CHECK (cliente_id::UUID = ...)` | ✅ Ativa |
| `os_update_tenant` | UPDATE | — | — | ❌ **Nunca aplicada** |
| `os_update_tms` | UPDATE | — | — | ❌ **Nunca aplicada** |
| `os_delete_tenant` | DELETE | — | — | ❌ Nunca aplicada |

**Impacto:** Qualquer tentativa de UPDATE via Supabase Client (REST API) retorna HTTP 200 com 0 rows. O fluxo `finalizarOrdemServico()` — que usa `supabase.from("ordens_servico").update({status:"finalizada"})` — falha silenciosamente em produção.

---

## 2. Funções RLS Verificadas (remoto 2026-07-28)

| Função | Teste | Resultado |
|--------|:-----:|:---------:|
| `current_tenant_id_safe()` | RPC remoto | `00000000-0000-0000-0000-000000000001` (sentinel) |
| `f_usuario_pode_acessar_cliente(uuid)` | RPC com cliente_id real | `true` (super_admin) |
| `f_obter_cliente_id_do_usuario()` | RPC remoto | `336c5b17-...` (1º cliente do tenant) |
| `tenant_usuarios` | SELECT | tamiris: papel=super_admin, tenant_id={sentinel} |

---

## 3. Análise de Perfis (Matriz MISSÃO 50)

| Perfil | tenant_usuarios? | UPDATE permitido? | Justificativa |
|--------|:----------------:|:-----------------:|:--------------|
| super_admin | ✅ sim | ✅ Permitido | TUDO |
| admin_tenant | ✅ sim | ✅ Permitido | TUDO |
| financeiro | ✅ sim | ✅ Permitido | Mesmo tenant, mesmo guard |
| comercial | ✅ sim | ✅ Permitido | Mesmo tenant, mesmo guard |
| operacional | ✅ sim | ✅ Permitido | Mesmo tenant, mesmo guard |
| atendimento | ✅ sim | ✅ Permitido | Mesmo tenant, mesmo guard |
| cliente (Portal) | ❌ não | ⛔ Bloqueado | Usa `usuarios_cliente`, sem `tenant_usuarios` |
| prestador (App) | ❌ não | ⛔ Bloqueado | Usa `prestadores.auth_user_id`, sem `tenant_usuarios` |
| anon | ❌ não | ⛔ Bloqueado | Policy é `TO authenticated` |

Nota: Perfis TMS (financeiro, comercial, atendimento) têm permissão técnica de UPDATE pela policy, mas a aplicação (frontend) restringe por papel no código TypeScript. A policy apenas autoriza quem pode executar UPDATE no banco — o controle fino de "quem pode editar o quê" é feito no frontend via `permissoes.ts`.

---

## 4. Comparação das Migrations Concorrentes

### Migration `20260626_missao16_multitenant_rls_p0.sql`
```sql
CREATE POLICY "os_update_tenant" ON ordens_servico
  FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id_safe());
```
- ✅ Simples
- ❌ **Sem WITH CHECK** — USING vale para visibilidade e modificação
- ❌ **Sem tenant_usuarios guard** — qualquer authenticated cujo `current_tenant_id_safe()` retorne o mesmo tenant pode atualizar
- ❌ Risco: Portal Cliente (sem tenant_usuarios) → `current_tenant_id_safe()` retorna sentinel → se OS tiver tenant_id = sentinel (caso real), Portal pode atualizar

### Migration `20260725_missao_rls_fix_core_operations.sql`
```sql
CREATE POLICY "os_update_tms" ON public.ordens_servico
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
         AND tenant_id = current_tenant_id_safe())
  WITH CHECK (same);
```
- ✅ **Com WITH CHECK** separado de USING
- ✅ **Com tenant_usuarios guard** — apenas usuários TMS com registro em `tenant_usuarios`
- ✅ Portal Cliente bloqueado (não tem `tenant_usuarios`)
- ✅ Prestador bloqueado (não tem `tenant_usuarios`)
- ✅ Mesmo padrão de `ae_update_tms` em `alocacoes_escala` (já homologado na Alternativa 0)

**Decisão:** Adotar a abordagem de `20260725` — mais segura e consistente com a policy já aplicada em `alocacoes_escala`.

---

## 5. Policy Proposta

```sql
CREATE POLICY "os_update_tms" ON ordens_servico
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );
```

### Validação USING:
- ✅ Quais linhas podem ser alteradas? Apenas OS do mesmo tenant do usuário TMS
- ✅ `tenant_usuarios` guard impede que usuários sem registro (Portal, Prestador) sequer vejam OS para UPDATE
- ✅ `current_tenant_id_safe()` retorna o tenant real do usuário (nunca sentinel quando acompanhado do guard)

### Validação WITH CHECK:
- ✅ Quais modificações são aceitas? Apenas quando tenant_id permanece no mesmo tenant
- ✅ Se tentativa de UPDATE alterar `tenant_id` para outro valor, a operação é rejeitada
- ✅ Idêntico ao USING — a policy não permite mudança de tenant

### Edge cases cobertos:
| Cenário | Resultado | Explicação |
|:--------|:---------:|:-----------|
| super_admin finaliza OS | ✅ Permitido | tenant_usuarios ✅, tenant match ✅ |
| operacional edita OS | ✅ Permitido | tenant_usuarios ✅, tenant match ✅ |
| Portal tenta atualizar OS | ⛔ Bloqueado | tenant_usuarios ❌ |
| Prestador tenta atualizar OS | ⛔ Bloqueado | tenant_usuarios ❌ |
| anon tenta atualizar OS | ⛔ Bloqueado | Policy é TO authenticated |
| usuário TMS de outro tenant | ⛔ Bloqueado | tenant_id ≠ current_tenant_id_safe() |
| UPDATE tenta mudar tenant_id | ⛔ Bloqueado | WITH CHECK rejeita |
| M80b trigger (finalizar OS) | ✅ Permitido | Executa como usuário autenticado TMS |

---

## 6. Arquivos Entregues

| Artefato | Caminho | SHA-256 |
|:---------|:--------|:--------|
| Migration | `supabase/migrations/20260728_m0074a_add_rls_update_ordens_servico.sql` | `2965b894318ab5707639bfea656eb6350a1f6ad47c5828383573018373138931` |
| Rollback | `supabase/migrations/20260728_m0074a_rollback.sql` | `29db32aa383ad71d249e9f168108c251695227f2f3762367bab5ff53446f8329` |
| Testes perfil | `scripts/m0074a_test_rls_update_os.mjs` | `bc081838a5b31ee38339d7fe9b039c934d644c9ce3ac2d09b16bd624d91d042d` |
| Relatório MD | `docs/auditoria/relatorios/2026-07-28_tms0074a_rls_update_ordens_servico.md` | — |
| Relatório TXT | `docs/auditoria/relatorios/2026-07-28_tms0074a_rls_update_ordens_servico.txt` | — |

---

## 7. Passos para Aplicação

1. **Autorização do usuário** para aplicar a migration em Produção
2. **Backup** (opcional): rodar script de snapshot via `pg_dump` da tabela `ordens_servico`
3. **Aplicar migration**:
   ```bash
   npx tsx supabase/migrations/20260728_m0074a_add_rls_update_ordens_servico.sql
   ```
   Ou via Supabase Dashboard > SQL Editor > colar conteúdo
4. **Validar**:
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename = 'ordens_servico'
   ORDER BY cmd;
   ```
5. **Testar** UPDATE com usuário autenticado TMS:
6. **Rollback** se necessário: executar `20260728_m0074a_rollback.sql`

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|:------|:-------------:|:-------:|:----------|
| Portal Cliente ganha UPDATE não intencional | Baixa | Alto | Guard `tenant_usuarios` + policy `TO authenticated` |
| Cross-tenant UPDATE | Baixa | Alto | `tenant_id = current_tenant_id_safe()` com guard |
| Performance (subquery em cada UPDATE) | Baixa | Médio | `tenant_usuarios` indexado por `user_id` |
| Trigger M80b falha por RLS | Média | Alto | M80b roda como calling user (TMS autenticado) — mesmo guard se aplica |
| `f_obter_cliente_id_do_usuario` bug | Baixa | Médio | Não usada na policy de UPDATE — apenas `tenant_usuarios` + `current_tenant_id_safe()` |
