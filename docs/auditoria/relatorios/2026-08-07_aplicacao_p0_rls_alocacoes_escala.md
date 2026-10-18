# RELATÓRIO DE APLICAÇÃO — Alternativa 0 (P0 RLS)
## alocacoes_escala — Correção Mínima de Segurança

**Data da aplicação:** 2026-08-07T04:57:36Z
**Projeto:** uwrvzsjtpgaifkktpepn (Produção)
**Migration:** `20260807_alternativa0_minimo_p0_alocacoes_escala.sql`
**Hash SHA-256:** `A1B3137DF49B159A80417EFA8ED385D1EF9285BE5C80266917A9BBE5D1F7AC77`
**Rollback:** `20260807_alternativa0_rollback.sql`
**Hash rollback:** `1AD7498DDA38C4E068D5D751EE5D8B298E20F5098BBAE7CE1DFD5ED8D7DE9971`

---

## COMPARAÇÃO ANTES/DEPOIS

| Evidência | Antes | Depois | Esperado | Resultado |
|---|---|---|---|---|
| Policies public inseguras | 4 | **0** | 0 | ✅ |
| Grants anon SELECT | sim | **não** | não | ✅ |
| Grants anon INSERT | sim | **não** | não | ✅ |
| Grants anon UPDATE | sim | **não** | não | ✅ |
| Grants anon DELETE | sim | **não** | não | ✅ |
| Policies TO authenticated (any) | 2 (prestador) | **7** (4 TMS + 1 cliente + 2 prestador) | 7 | ✅ |
| RLS habilitada | true | **true** | true | ✅ |
| Total alocações | 176 | **176** | igual | ✅ |
| aceita | 6 | **6** | igual | ✅ |
| aguardando_aceite | 66 | **66** | igual | ✅ |
| cancelada | 4 | **4** | igual | ✅ |
| concluida | 53 | **53** | igual | ✅ |
| em_rota | 11 | **11** | igual | ✅ |
| planejada | 34 | **34** | igual | ✅ |
| recusada | 2 | **2** | igual | ✅ |
| Anon SELECT (REST API) | retornava dados (200) | **bloqueado (401)** | bloqueado | ✅ |
| FORCE RLS | false | **false** | inalterado | ✅ |

---

## POLICIES — ANTES vs DEPOIS

### Antes (6 policies, 4 vulneráveis)
| Policy | Role | Qual | Risco |
|--------|------|------|-------|
| `alocacoes_escala_select_anon` | **public** | **true** | 🔴 P0 |
| `alocacoes_escala_insert_anon` | **public** | **true** | 🔴 P0 |
| `alocacoes_escala_update_anon` | **public** | **true** | 🔴 P0 |
| `alocacoes_escala_update_authenticated` | **public** | `auth.role() = 'authenticated'` | 🔴 (role public) |
| `Prestador can view own alocacoes` | authenticated | prestador | ✅ |
| `Prestador can update own alocacoes` | authenticated | prestador | ✅ |

### Depois (7 policies, 0 vulneráveis)
| Policy | Role | Qual | Finalidade |
|--------|------|------|------------|
| `ae_select_tms` | **authenticated** | subquery `tenant_usuarios` | TMS lista |
| `ae_insert_tms` | **authenticated** | subquery `tenant_usuarios` | TMS insere |
| `ae_update_tms` | **authenticated** | subquery `tenant_usuarios` | TMS edita |
| `ae_delete_tms` | **authenticated** | subquery `tenant_usuarios` | TMS exclui |
| `ae_select_cliente` | **authenticated** | `f_obter_cliente_id_do_usuario()` | Portal Cliente lê |
| `Prestador can view own alocacoes` | **authenticated** | prestador | Prestador lê própria |
| `Prestador can update own alocacoes` | **authenticated** | prestador | Prestador atualiza própria |

---

## GRANTS — ANTES vs DEPOIS

| Role | Antes | Depois |
|------|-------|--------|
| **anon** | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | **0** (zero) |
| **authenticated** | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER |
| **service_role** | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER |

---

## LOG DE APLICAÇÃO

```
INICIO: 2026-07-27T04:57:36.547Z
Migration: 20260807_alternativa0_minimo_p0_alocacoes_escala.sql
Comandos: 4 DROP POLICY + 1 REVOKE + 5 CREATE POLICY + 1 DO (validacao)
Zero DML: confirmado
Conectado.
Transacao iniciada.
Transacao commitada.
Migration executada com sucesso.
FIM: 2026-07-27T04:57:36.764Z
CODIGO_SAIDA: 0
```

**Duração:** 217ms

**Correção necessária:** 1 erro de digitação corrigido (parêntese extra na linha 234 → `RAISE WARNING`). ROLLBACK executado, hash recalculado (`43EBD6` → `A1B3137`), reaplicado com sucesso.

---

## RISCOS RESIDUAIS (pós-aplicação)

| ID | Risco | Severidade | Status |
|----|-------|-----------|--------|
| D04 | `Prestador can update own alocacoes` mantida — 8 funções TS dependem | Baixa | **ACEITO** — não é P0. Correção futura (Propostas 1 ou 2) |
| D02 | `current_tenant_id_safe()` com bug de session parameter | Média | **FORA DE ESCOPO** — Alternativa 0 não usa |
| D03 | `f_aceitar_oportunidade_rede` sem GRANT EXECUTE explícito | Média | **FORA DE ESCOPO** — Alternativa 0 não altera RPCs |
| Rollback | Não restaura TRIGGER/TRUNCATE/REFERENCES para anon | Muito baixa | **ACEITO** |

---

## CONCLUSÃO

```
P0 RLS CORRIGIDO E VALIDADO — PRODUÇÃO ESTÁVEL
```

- **Vulnerabilidade P0 eliminada:** anon não pode mais SELECT/INSERT/UPDATE/DELETE em `alocacoes_escala`
- **0 dados alterados:** 176 registros, mesma distribuição por status
- **0 regressão de funcionalidade:** TMS policies criadas, Portal Cliente mantido, Prestador preservado
- **Rollback disponível:** `20260807_alternativa0_rollback.sql` (hash verificado)
- **Tempo total de aplicação:** 217ms (DDL puro)
- **Próximas correções recomendadas:** D04 (prestador UPDATE), D02 (tenant context), D03 (RPC grant)
