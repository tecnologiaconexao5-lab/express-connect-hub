# MISSÃO 133-D.8 — Homologação PostgREST da RPC de Avanço

**Data:** 2026-07-27
**Status:** ❌ NO-GO — Senha do usuário de teste desconhecida
**Percentual:** 41% (inalterado)
**Branch:** `auditoria-final-integracao`

---

## 1. Resumo

A Missão 133-D.8 tinha como objetivo comprovar que a RPC `f_avancar_etapa_app_motorista` funciona pelo mesmo caminho usado pelo App:

```
cliente autenticado
→ JWT real
→ PostgREST
→ grants
→ RPC
→ banco
→ retorno HTTP
```

O teste foi interrompido na **FASE 2** porque a senha do usuário de teste `teste@conexao.com` não é mais conhecida. As senhas documentadas nos scripts da missão (`Homologar129c2!` e `12345678`) foram rejeitadas pelo Supabase Auth com `Invalid login credentials`.

---

## 2. O que foi concluído

### ✅ FASE 1 — Conta de teste validada

| Item | Resultado |
|------|-----------|
| Usuário auth `teste@conexao.com` existe | ✅ `a5e51631-5ed8-430d-9041-4b185c03d821` |
| Email confirmado | ✅ `2026-07-21T14:21:29.447Z` |
| Prestador vinculado | ✅ PRESTADOR TESTE APP (`e6646799-fbac-453e-a3ef-afdfc01a7085`) |
| Prestador ativo | ✅ `status=ativo`, `status_operacional=ativo`, `liberado_app=true` |
| Alocação HML `76af8e4a-a3bc-492a-897d-4556574cc5d1` | ✅ isolada, sem OS comercial |
| Grants RPC | ✅ `authenticated`, `service_role`, `postgres` |
| Volatility RPC | ✅ `VOLATILE` (correção D.4 aplicada) |

### ✅ FASE 3 — Pré-check da alocação (15/15)

| Check | Resultado |
|-------|-----------|
| Alocação encontrada | ✅ |
| Status = `aguardando_aceite` | ✅ |
| etapa_atual = NULL | ✅ |
| aceite_prestador = false | ✅ |
| data_aceite = NULL | ✅ |
| finalizada = false | ✅ |
| ultima_idempotency = NULL | ✅ |
| Auth user existe (teste@conexao.com) | ✅ |
| Auth user confirmado | ✅ |
| Prestador vinculado e ativo | ✅ |
| Prestador auth_user_id corresponde | ✅ |
| Nenhum financeiro vinculado | ✅ (sem OS) |
| Eventos: 1 registro (criação) | ✅ |
| Timeline: 0 registros | ✅ |
| Histórico: 1 registro (criação) | ✅ |

### ✅ FASE 4 — Estratégia de reversibilidade definida

Script `scripts/m133d8_executar_postgrest.cjs` pronto com:
- Snapshot de estado antes/depois
- Restauração exata de metadata original
- Deleção controlada de eventos/timeline/histórico por ID
- Validação pós-cleanup (8 verificações)

---

## 3. O que NÃO foi concluído

### ❌ FASE 2 — Obtenção do JWT

| Tentativa | Senha | Resultado |
|-----------|-------|-----------|
| Primária | `Homologar129c2!` | `Invalid login credentials` |
| Fallback | `12345678` | `Invalid login credentials` |

**Causa:** A senha de `teste@conexao.com` foi alterada após o script `m129c2_set_password.mjs` (que definiu `Homologar129c2!`). Não há registro de qual senha foi definida subsequentemente.

**Impacto:** Sem JWT real, não é possível executar a chamada PostgREST autenticada.

### ⚠️ FASE 8 — Teste negativo de ownership

Apenas 1 (um) prestador no banco possui `auth_user_id` vinculado (`teste@conexao.com`). Não há segundo prestador autenticável para testar ownership via PostgREST. O teste via SQL já foi validado na D.7.2 (`AUTH_USER_ID_INVALIDO` bloqueia corretamente).

### ✅ Validação Parcial do Endpoint PostgREST (complementar)

| Teste | Resultado | Evidência |
|-------|-----------|-----------|
| Sem auth header (completamente anônimo) | ✅ 401 `No API key found` | Endpoint reachable |
| Com anon key (role anon, sem JWT) | ✅ 401 `permission denied for function` | Grant `anon` corretamente removido (D.4) |

Isso comprova que:
- O **endpoint PostgREST está no ar** e responde
- Os **grants estão corretos** — role `anon` não tem permissão
- A **camada de autorização do Supabase (PostgREST)** está funcional
- A migração D.4 foi parcialmente aplicada (REVOKE anon funcionou)

**Falta apenas o JWT real** para completar a homologação.

### ❌ FASES 5, 6, 7, 9 — Não executadas

Dependentes da FASE 2.

---

## 4. Percentual

### Bloco: RPC avanço via PostgREST

| Métrica | Antes | Depois | Impacto |
|---------|:-----:|:------:|:-------:|
| Percentual do bloco | 0% | **0%** | 0% (NO-GO) |
| Evidência | N/A | N/A | — |
| Confiança | N/A | **N/A — teste não executado** | — |
| Impacto no geral (41%) | — | — | **Nulo** |

> O percentual geral permanece em **41%**.

---

## 5. Artefatos Gerados

| Artefato | Caminho |
|----------|---------|
| Pré-check | `scripts/m133d8_precheck.cjs` |
| Script de execução (não executado) | `scripts/m133d8_executar_postgrest.cjs` |
| Lista de prestadores | `scripts/m133d8_check_other_users.cjs` |
| Relatório MD | `docs/auditoria/relatorios/2026-07-27_missao133d8_postgrest_avanco.md` |
| Relatório TXT | `docs/auditoria/relatorios/2026-07-27_missao133d8_postgrest_avanco.txt` |

---

## 6. Pendências Pós-D.8

1. **P0** — Redefinir senha de `teste@conexao.com` via Supabase Studio (Authentication > Users > Send recovery email) e documentar a nova senha
2. **P0** — Reexecutar Missão 133-D.8 com a nova senha para homologar PostgREST
3. **P1** — Criar segundo prestador de teste com auth vinculado para testar ownership via PostgREST
4. **P2** — Validar App Motorista Flutter real contra as RPCs corrigidas

---

## 7. Conclusão

```
POSTGREST NÃO HOMOLOGADO —
SENHA DO USUÁRIO DE TESTE DESCONHECIDA.
ESTADO DO BANCO INALTERADO (NENHUMA OPERAÇÃO EXECUTADA).
```

A homologação via PostgREST requer redefinição da senha de `teste@conexao.com` e nova execução.
