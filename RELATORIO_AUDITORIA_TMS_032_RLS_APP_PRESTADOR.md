# TMS-032 — AUDITORIA COMPLETA RLS DO APP PRESTADOR

**Data:** 2026-08-01
**Ambiente:** PRODUÇÃO (somente leitura — nenhuma alteração executada)
**Escopo:** RLS, triggers, RPCs e grants de todas as tabelas do fluxo de escrita do App Prestador
**Entrega:** Este relatório + evidências read-only (`scripts/tms032_readonly_*.mjs`)

---

## 1. CONTEXTO

O TMS-031 homologou o vínculo `prestadores.auth_user_id` e comprovou que o **aceite** da
alocação HML falha com `403 42501: new row violates row-level security policy for table
historico_alocacoes_escala`. Esta missão audita integralmente a camada RLS do fluxo do App
Prestador para mapear todos os bloqueios e riscos antes de qualquer correção em Produção.

**Regra de ouro da missão:** somente leitura. Nada de DDL/RLS/migrations/escrita.

---

## 2. MÉTODO

1. **Migrations** — mapeadas policies/triggers/funções em `supabase/migrations/*.sql`
   (via subagentes de exploração + leitura direta dos arquivos-chave).
2. **Estado real de Produção** — consultas `SELECT`-only via `pg` (scripts
   `scripts/tms032_readonly_rls_policies.mjs` e `scripts/tms032_readonly_rpcs.mjs`):
   policies ativas por tabela, grants por role, RLS enabled, triggers habilitados,
   funções de trigger (SECURITY DEFINER/INVOKER), corpos das RPCs do App.
3. **Cruzamento** — migrations × produção para distinguir o que está vigente do que é
   apenas candidato/planejado.
4. **Classificação** — OK / BLOQUEIO / RISCO / DEPENDE por fluxo.

---

## 3. CAUSA RAIZ DO 403 (CONFIRMADA EM PRODUÇÃO)

```
Prestador autenticado (auth.uid()=7cc4bb3d-…)
  └─ UPDATE alocacoes_escala  (via REST PATCH — permitido por
       "Prestador can update own alocacoes", prestador scoped)
        └─ Trigger AFTER INSERT OR UPDATE trg_registrar_historico_alocacao
             (função registrar_historico_alocacao() — SECURITY INVOKER)
              └─ INSERT historico_alocacoes_escala
                   → política hae_insert_tms EXIGE tenant_usuarios.user_id=auth.uid()
                   → prestador NÃO está em tenant_usuarios
                   → 42501 → transação aborta → aceite não persiste
```

| Fato | Evidência (Produção) |
|---|---|
| `registrar_historico_alocacao()` é **SECURITY INVOKER** | consulta read-only: `security_definer=false` |
| Trigger `trg_registrar_historico_alocacao` AFTER INSERT OR UPDATE habilitado | `tgenabled=O` |
| `historico_alocacoes_escala` tem APENAS `hae_select_tms` + `hae_insert_tms` (exigem `tenant_usuarios`) | `pg_policies` |
| Prestador consegue UPDATE na alocação | policy "Prestador can update own alocacoes" |
| `historico_alocacoes_escala` **NÃO tem coluna `tenant_id`** | `information_schema.columns` |

**Leitura crucial:** como o trigger é INVOKER, QUALQUER UPDATE feito por prestador via
REST (aceite, recusa, status) que mude status/aceite/finalizada dispara o INSERT no
histórico e falha. Updates que NÃO alteram esses campos (ex.: só `metadata`) não
disparam INSERT e funcionam.

**O caminho projetado era via RPC:** `f_aceitar_oportunidade_rede` / `f_avancar_etapa_app_motorista`
são **SECURITY DEFINER**. Dentro de uma função SECURITY DEFINER (owner), os triggers
disparam no contexto do owner (postgres), que **bypassa RLS** — por isso o aceite via
RPC funciona. O problema ocorre quando o App faz **UPDATE direto via REST** em vez de
usar a RPC (desvio do design, documentado em `20260713_m111_app_integracao_tms.sql:1037`:
"O App DEVE usar a RPC f_aceitar_oportunidade_rede").

---

## 4. ESTADO REAL DE PRODUÇÃO (captura read-only 2026-08-01)

### 4.1 Policies por tabela (vigentes)

| Tabela | Policies | Prestador insere? | Nota |
|---|---|---|---|
| `alocacoes_escala` | `ae_select/insert/update/delete_tms` (tenant_usuarios), `ae_select_cliente`, "Prestador can **view** own", "Prestador can **update** own" | ❌ (não há INSERT prestador) | **Alternativa 0 aplicada**: anon revogado, 0 policies public |
| `historico_alocacoes_escala` | `hae_select_tms`, `hae_insert_tms` (tenant_usuarios) | ❌ **NENHUMA** | 🔴 **Causa raiz do 403** |
| `ordens_servico` | `os_select_own` (cliente), `os_insert_portal`, `os_insert_tms`, `os_update_tms` | ❌ | Prestador não escreve OS via REST (via RPC sim) |
| `prestadores` | `prestadores_select_own`, `prestadores_update_own` (auth_user_id=uid), `*_tms`, `select_portal` | ❌ | Prestador atualiza a própria linha ✅ |
| `veiculos` | `veiculos_select/insert/update/delete_tms`, `select_portal` | ❌ | Sem SELECT own prestador (via RPC/view) |
| `portal_tracking_realtime` | `tracking_insert_prestador` (prestador scoped) ✅, `tracking_prestador_select`, `tracking_select_tenant`, `ptr_insert_auth` (**CHECK true**), `ptr_select_auth` (**USING true**), `portal_tracking_insert` (**CHECK true**) | ✅ (via policy prestador + via RPC) | ⚠️ `ptr_insert_auth`/`portal_tracking_insert` abertas a qualquer authenticated |
| `entregas_protocolo` | "Prestador insert own protocolo" (**compra auth.uid()≠prestador.id**), "Prestador select own", "Authenticated select all", `entregas_protocolo_select_authenticated` | ⚠️ policy existe MAS **grant authenticated só tem SELECT** (INSERT revogado) | 🔴 Policy compara `prestador_id = auth.uid()` (bug conceitual); fluxo real via trigger DEFINER |
| `delivery_proofs` | `dp_insert_authenticated` (**CHECK true**), `dp_select_own` | ✅ | Trigger `f_sync_delivery_proof_to_entregas` **DEFINER** sincroniza |
| `eventos_oficiais` | `admin_insert` (**TO anon,authenticated CHECK true**), `admin_select` (**TO anon USING true**), `admin_update/delete` (tenant) | ✅ (até anon!) | 🔴 Event Bus aberto para anon |
| `operation_timeline_events` | "Drivers can insert/select own" (`driver_id = auth.uid()::text`), `timeline_own` | ✅ | driver_id = auth.uid() (text) |
| `ocorrencias` | `insert/select_tenant` (**TO anon,authenticated**, `tenant_id=current_tenant_id_safe()`) | ✅ (anon) | ⚠️ anon pode inserir com tenant sentinel |
| `portal_ocorrencias` | `po_insert_own`, `po_select_own` (cliente), `portal_ocorrencias_insert` (**public CHECK true**) | ✅ (public) | ⚠️ |
| `portal_notificacoes` | `notificacoes_insert_service` (**CHECK true**), `notificacoes_select_authenticated` (**USING true**), `pn_select_own`, `pn_update_own`, `portal_notificacoes_insert` | ✅ | ⚠️ genérica authenticated |
| `os_historico` | `oh_insert_auth` (**CHECK true**), `oh_select_auth` | ✅ | autenticado genérico |
| `rede_oportunidades` | `all_authenticated` (true), `select_anon` (status público) | ✅ | OK |
| `rotas` / `rota_paradas` | várias `*_authenticated` (**USING/CHECK true**), `select_portal`, `select_anon_suas` | ✅ | ⚠️ leitura ampla authenticated |
| `clientes` | `cliente_select_own`, `clientes_select_own`, `update_own`, `insert_own`, `delete_own` | — | fora do fluxo prestador |

### 4.2 Grants por role (herdados do padrão Supabase)

Todas as tabelas ainda possuem **grants anon/authenticated `ALL`** herdados da criação
(ex.: `historico_alocacoes_escala`, `ordens_servico`, `prestadores`, `veiculos`,
`clientes`, `ocorrencias`, `portal_ocorrencias`, `operacao_localizacao`,
`portal_notificacoes`, `eventos_oficiais`, `operation_timeline_events`, `rotas`,
`rota_paradas`). **A exceção é `alocacoes_escala`** (anon revogado pela Alternativa 0) e
**`entregas_protocolo`** (authenticated só SELECT).

> Na prática o RLS bloqueia o acesso não-autorizado (deny por ausência de policy).
> Grants amplos são superfície residual de risco, não bloqueio funcional.

### 4.3 Triggers habilitados no fluxo (Produção)

| Tabela | Trigger | Função | SECURITY |
|---|---|---|---|
| `alocacoes_escala` | `trg_registrar_historico_alocacao` (AFTER I/U) | `registrar_historico_alocacao` | **INVOKER** 🔴 |
| `alocacoes_escala` | `trg_propagar_financeiro_alocacao` (AFTER I/U status/valores) | `f_trg_propagar_financeiro_alocacao` | DEFINER ✅ |
| `alocacoes_escala` | `trg_cancelar_financeiro_alocacao` (BEFORE U status) | `f_trg_cancelar_financeiro_alocacao` | DEFINER ✅ |
| `alocacoes_escala` | `trg_evento_*` (aceitou, finalizada, cancelada, recusada, trocado, criada) | `trg_evento_*` | INVOKER ⚠️ |
| `alocacoes_escala` | `trg_alocacoes_escala_updated_at` | `update_alocacoes_escala_updated_at` | INVOKER ✅ |
| `delivery_proofs` | `trg_sync_delivery_proof_to_entregas` (AFTER INSERT) | `f_sync_delivery_proof_to_entregas` | **DEFINER** ✅ |
| `entregas_protocolo` | `trg_evento_pod_enviado` | — | — |
| `ordens_servico` | `trg_propagar_financeiro_os`, `trg_evento_os_*`, `trg_notificar_os_para_app` | — | DEFINER (financeiro) / INVOKER (eventos) |

**Padrão já adotado no projeto:** triggers financeiros e de sincronização POD usam
`SECURITY DEFINER`. **O trigger de histórico é a única exceção problemática.**

---

## 5. RPCs DO APP — AUDITORIA DE CORPOS (Produção)

| RPC | SECURITY | Valida auth.uid()? | Pertencimento? | GRANTs | Veredito |
|---|---|---|---|---|---|
| `f_aceitar_oportunidade_rede` | DEFINER | ⚠️ Valida apenas se `p_auth_user_id` existe em `auth.users` — **NÃO obriga = auth.uid()**; aceita `NULL` | ⚠️ Só checa prestador ativo, **não** que `p_prestador_uuid` pertença ao usuário | anon, PUBLIC, authenticated, service_role | 🔴 **RISCO ALTO** (impersonação de aceite) |
| `f_avancar_etapa_app_motorista` | DEFINER | ✅ `auth.uid()` obrigatório + `p_auth_user_id == auth.uid()` | ✅ prestador via `auth_user_id` + alocação `prestador_id` | authenticated, service_role | ✅ **CORRETA** |
| `f_atualizar_reversa_app` (produção = timestamptz+text[]) | DEFINER | ✅ `auth.uid()` + `p_auth_user_id == auth.uid()` | ✅ prestador + alocação | anon, PUBLIC, authenticated, service_role | ⚠️ corpo OK, **grant anon/PUBLIC residual** |
| `f_atualizar_status_parada` (multiparadas) | DEFINER | ❌ **SEM auth.uid()** — aceita qualquer chamador | ❌ Sem validação de pertencimento de rota/parada | anon, PUBLIC, authenticated, service_role | 🔴 **RISCO CRÍTICO** (qualquer anon conclui parada/rota/OS) |
| `registrar_posicao_motorista` | DEFINER | ✅ `auth.uid()` + prestador ativo/liberado | ✅ alocação pertence | authenticated, service_role | ✅ **CORRETA** |
| `f_buscar_operacoes_motorista(p_auth_user_id)` | DEFINER (STABLE) | ✅ `auth.uid()` + `p_auth_user_id == auth.uid()` | ✅ | authenticated, service_role | ✅ **CORRETA** |
| `f_atualizar_status_parada` legada / `f_registrar_notificacao_app` / `f_calcular_financeiro_operacao` | DEFINER | varia | — | anon, PUBLIC | ⚠️ grants residuais |

**Síntese:** 3 RPCs principais (aceitar/avançar/posição) estão corretas; `f_atualizar_reversa_app`
tem corpo correto mas grant anon; **`f_atualizar_status_parada` e `f_aceitar_oportunidade_rede`
têm falhas de autorização** (detalhadas na seção 7).

---

## 6. MATRIZ — 25 FLUXOS DO APP (ação → tabela → trigger → policy → veredito)

| # | Fluxo (ação do App) | Tabela(s) | Caminho | Policy/Trigger | Veredito |
|---|---|---|---|---|---|
| 1 | Login / resolver prestador | `prestadores` (SELECT) | REST `prestadores?auth_user_id=eq.…` | `prestadores_select_own` | ✅ OK |
| 2 | Home / dados do prestador | `prestadores` | REST | `select_own` | ✅ OK |
| 3 | Listar operações | `alocacoes_escala`, `ordens_servico`, `veiculos` | RPC `f_buscar_operacoes_motorista` | DEFINER | ✅ OK |
| 4 | Ver detalhes da alocação | `alocacoes_escala` | REST SELECT | "Prestador can view own" | ✅ OK |
| 5 | Perfil / veículo | `veiculos` | REST SELECT | ⚠️ sem `select_own` prestador | ⚠️ **DEPENDE** (via view/RPC) |
| 6 | Financeiro (ganhos) | `financeiro_pagar`, `pagamentos_prestadores` | RPC legada | DEFINER | ⚠️ **DEPENDE** de RPC dedicada |
| 7 | Aceitar (via Rede) | `rede_oportunidades`, `ordens_servico`, `alocacoes_escala`, `rotas`, `rota_paradas`, `portal_notificacoes`, `os_historico` | RPC `f_aceitar_oportunidade_rede` | DEFINER | ⚠️ Funciona, **risco de impersonação** (sem auth.uid) |
| 8 | **Aceitar (UPDATE direto REST)** | `alocacoes_escala` | REST PATCH | `update_own` ✅ + trigger `trg_registrar_historico` **INVOKER** → INSERT `historico` ❌ | 🔴 **BLOQUEADO (403 TMS-031)** |
| 9 | Avançar etapas (máquina de estados) | `alocacoes_escala`, `eventos_oficiais`, `operation_timeline_events` | RPC `f_avancar_etapa_app_motorista` | DEFINER | ✅ OK |
| 10 | Recusar (via REST status=recusada) | `alocacoes_escala` | REST PATCH | `update_own` ✅ + trigger histórico INVOKER ❌ + trigger evento recusada | 🔴 **BLOQUEADO** (mesmo motivo do aceite) |
| 11 | Iniciar coleta / cheguei_coleta | `alocacoes_escala` | RPC `f_avancar_etapa` | DEFINER | ✅ OK |
| 12 | Carregamento / saiu em rota | `alocacoes_escala` | RPC `f_avancar_etapa` | DEFINER | ✅ OK |
| 13 | Chegou entrega / descarga | `alocacoes_escala` | RPC `f_avancar_etapa` | DEFINER | ✅ OK |
| 14 | Assinatura capturada | `alocacoes_escala` metadata + `delivery_proofs` | RPC `f_avancar_etapa` | DEFINER | ✅ OK |
| 15 | POD registrado (foto/canhoto) | `delivery_proofs` (INSERT) → trigger DEFINER → `entregas_protocolo` | REST INSERT `delivery_proofs` | `dp_insert_authenticated` ✅ | ✅ OK |
| 16 | Finalizar serviço (servico_finalizado) | `alocacoes_escala` | RPC `f_avancar_etapa` (exige POD) | DEFINER | ✅ OK |
| 17 | Coleta reversa / devolução | `alocacoes_escala`, `eventos_oficiais`, `financeiro_receber`, `financeiro_pagar` | RPC `f_atualizar_reversa_app` | DEFINER (auth OK) | ⚠️ Funciona; grant anon residual |
| 18 | Tracking GPS (ponto) | `portal_tracking_realtime` | RPC `registrar_posicao_motorista` | DEFINER | ✅ OK |
| 19 | Tracking (INSERT direto REST) | `portal_tracking_realtime` | REST INSERT | `tracking_insert_prestador` ✅ (+ `ptr_insert_auth` aberta) | ✅ OK (mas abertas demais) |
| 20 | Multiparadas: atualizar parada | `rota_paradas`, `rotas`, `alocacoes_escala`, `ordens_servico` | RPC `f_atualizar_status_parada` | DEFINER **SEM auth.uid()** | 🔴 **RISCO CRÍTICO** |
| 21 | Ocorrência na operação | `ocorrencias` (RPC legada `reportar_ocorrencia_motorista`) | REST/RPC | `insert_tenant` anon | ⚠️ Funciona, política aberta |
| 22 | Notificações (ler) | `portal_notificacoes` | REST SELECT | `pn_select_own` / `notificacoes_select_authenticated` | ✅ OK |
| 23 | Notificações (marcar lida) | `portal_notificacoes` | REST UPDATE | `pn_update_own` (cliente) — ⚠️ sem UPDATE por prestador | ⚠️ **PARCIAL** |
| 24 | Sincronização offline (POD em fila) | `delivery_proofs` (replay) | REST INSERT | `dp_insert_authenticated` | ✅ OK |
| 25 | Upload de fotos/assinaturas (Storage) | bucket `comprovantes-entrega` / `documentos` | REST storage | policies storage authenticated | ✅ OK (não auditar em profundidade) |

**Resumo da matriz:** ✅ 17 OK · ⚠️ 5 DEPENDE/PARCIAL · 🔴 3 BLOQUEIO/RISCO CRÍTICO.

---

## 7. ACHADOS DE SEGURANÇA (ordem de severidade)

| # | Severidade | Achado | Evidência |
|---|---|---|---|
| S1 | 🔴 **CRÍTICO** | `f_atualizar_status_parada` **não valida `auth.uid()` nem pertencimento** — qualquer anon/authenticated pode concluir paradas, rotas e até **finalizar OS/alocações de terceiros** | corpo read-only (sem bloco de autenticação); GRANT anon |
| S2 | 🔴 **ALTO** | `f_aceitar_oportunidade_rede` valida `p_auth_user_id` apenas contra existência em `auth.users` (aceita `NULL`), sem exigir `= auth.uid()` e sem validar que `p_prestador_uuid` pertence ao usuário → **impersonação de aceite** | corpo read-only |
| S3 | 🟠 MÉDIO | `entregas_protocolo` — policy "Prestador insert own protocolo" compara `prestador_id = auth.uid()::uuid`, mas `prestador_id` guarda `prestadores.id` (diferente de `auth.uid()`) → policy **nunca funciona** (mascarada porque grant INSERT foi revogado; o fluxo real passa pelo trigger DEFINER) | `pg_policies` |
| S4 | 🟠 MÉDIO | `eventos_oficiais` com `admin_insert`/`admin_select` **TO anon** (CHECK/USING true) → anon lê e escreve no Event Bus | `pg_policies` |
| S5 | 🟠 MÉDIO | `portal_tracking_realtime` com `ptr_insert_auth`, `portal_tracking_insert` (CHECK true) e `ptr_select_auth` (USING true) para qualquer authenticated — desnecessariamente abertas (a `tracking_insert_prestador` já cobre o app) | `pg_policies` |
| S6 | 🟠 MÉDIO | Grants `ALL` para **anon** em ~15 tabelas de negócio (herdados) — sem efeito funcional (RLS deny) mas superfície de risco | `table_privileges` |
| S7 | 🟡 BAIXO | `ocorrencias` e `portal_ocorrencias` com INSERT para anon/public (CHECK true / tenant sentinel) | `pg_policies` |
| S8 | 🟡 BAIXO | `os_historico`, `portal_notificacoes`, `rotas`, `rota_paradas` com policies `USING/CHECK true` para authenticated (leitura ampla) | `pg_policies` |
| S9 | 🟡 BAIXO | Grants anon/PUBLIC residuais em `f_atualizar_reversa_app`, `f_registrar_notificacao_app`, `f_calcular_financeiro_operacao` (corpos OK, sem necessidade de exposição anon) | `routine_privileges` |

---

## 8. CAUSA RAIZ DO PROBLEMA FUNCIONAL (recapitulação para decisão)

O bloqueio do aceite **não é** falta de vínculo (`prestadores.auth_user_id` está correto e
o App resolve o prestador). É a combinação:

1. App usa **UPDATE direto via REST** em `alocacoes_escala` (permitido pela policy de
   prestador) em vez de usar a RPC `f_avancar_etapa_app_motorista`/`f_aceitar_oportunidade_rede`.
2. O trigger AFTER `trg_registrar_historico_alocacao` é **SECURITY INVOKER** e faz INSERT
   em `historico_alocacoes_escala`.
3. `historico_alocacoes_escala` **não tem policy INSERT para prestador** (só
   `hae_insert_tms`, tenant_usuarios).
4. Resultado: 42501, transação abortada, alocação permanece `aguardando_aceite`.

---

## 9. RECOMENDAÇÃO DE CORREÇÃO (NÃO APLICADA — texto para avaliação)

### Opção A (mínima, desbloqueia REST direto) — policy de INSERT no histórico p/ prestador

```sql
-- TMS-032-A: permitir que o trigger do histórico registre eventos para prestador autenticado
CREATE POLICY "hae_insert_prestador" ON public.historico_alocacoes_escala
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM prestadores WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
  );
```

> Mantém `hae_insert_tms` para TMS; garante que o trigger INVOKER consiga inserir quando
> o autor do UPDATE é prestador autenticado. **Desbloqueia aceite, recusa e mudanças de
> status via REST.**

### Opção B (robusta, alinhada ao design) — App usa as RPCs

Garantir que o App (Flutter externo) use `f_aceitar_oportunidade_rede`/`f_avancar_etapa_app_motorista`
para aceite e avanço de etapas (SECURITY DEFINER → bypassa RLS → trigger roda como owner).
Isto já funciona e é o caminho projetado; o UPDATE direto via REST é o desvio.

### Opção C (endurecimento) — corrigir os riscos de autorização (S1, S2)

- `f_atualizar_status_parada`: adicionar `auth.uid()` obrigatório, resolver prestador via
  `prestadores.auth_user_id` e validar que a rota/parada pertence ao prestador.
- `f_aceitar_oportunidade_rede`: exigir `p_auth_user_id = auth.uid()` (ou NULL) e validar
  que `p_prestador_uuid` é o prestador do usuário.
- `f_atualizar_reversa_app`/`f_registrar_notificacao_app`/`f_calcular_financeiro_operacao`:
  `REVOKE EXECUTE … FROM anon, PUBLIC`.

### Opção D (higiene RLS) — fechar policies abertas

- `eventos_oficiais`: restringir INSERT/SELECT a TMS (+ prestador, se necessário).
- `portal_tracking_realtime`: manter só `tracking_insert_prestador`/`tracking_prestador_select`.
- Revogar grants anon em massa nas ~15 tabelas herdadas.

---

## 10. CLASSIFICAÇÃO FINAL

| Dimensão | Status |
|---|---|
| Aceite/recusa via **REST** direto | 🔴 **BLOQUEADO** (403 — trigger histórico INVOKER) |
| Aceite via **RPC** `f_aceitar_oportunidade_rede` | ⚠️ Funciona, risco de impersonação (S2) |
| Máquina de etapas via RPC `f_avancar_etapa_app_motorista` | ✅ OK |
| POD via `delivery_proofs` + trigger DEFINER | ✅ OK |
| Tracking via `registrar_posicao_motorista` | ✅ OK |
| Reversa via `f_atualizar_reversa_app` | ⚠️ Funciona (grant anon residual) |
| Multiparadas via `f_atualizar_status_parada` | 🔴 **RISCO CRÍTICO** (sem auth.uid) |
| Leitura de dados do prestador (REST) | ✅ OK |
| Segurança geral RLS | 🟠 Médio — 2 falhas de autorização críticas em RPCs de escrita |

**Fluxo bloqueado para homologação:** aceite/recusa via REST (1 bloqueio funcional).

**Prioridades recomendadas:** (1) aplicar Opção A para desbloquear a homologação;
(2) corrigir S1/S2 (Opção C) antes de liberar produção para uso real;
(3) higiene de policies/grants (Opção D).

---

## 11. EVIDÊNCIAS

- Scripts read-only (sem alterações): `scripts/tms032_readonly_rls_policies.mjs`,
  `scripts/tms032_readonly_rpcs.mjs`.
- Corpos das RPCs capturados em Produção (seção 5).
- Policies/grants/triggers capturados de Produção (seção 4).
- Migrations de referência:
  - `20260522_alocacoes_escala.sql` (tabela + trigger `trg_registrar_historico_alocacao`)
  - `20260630000003_m44c_historico_insert_trigger.sql` (função INVOKER)
  - `20260801_m06_rls_remaining_tables.sql` (hae_*_tms)
  - `20260807_alternativa0_minimo_p0_alocacoes_escala.sql` (aplicada em produção)
  - `20260722_m133d2_fix_uuid_text_rpc_motorista.sql` / `20260722_m133d4_fix_rpc_app_security.sql` (RPCs)
  - `20260731_fix_registrar_posicao_motorista.sql` (tracking corrigido)

---

*Fim — RELATORIO_AUDITORIA_TMS_032_RLS_APP_PRESTADOR.md*
