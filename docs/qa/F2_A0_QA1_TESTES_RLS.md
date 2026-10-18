# TESTES RLS — F2-A0-QA1

**Status:** 🔶 NÃO EXECUTADOS — aguardando ambiente QA provisionado  
**Migration F2-A1:** `20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql`

---

## Matriz de perfis × cenários

| Perfil | SELECT por ID | SELECT LIMIT | COUNT | Cliente válido | Registro legado | Acesso entre tenants | INSERT | UPDATE | DELETE |
|--------|:-------------:|:------------:|:-----:|:--------------:|:---------------:|:-------------------:|:------:|:------:|:------:|
| anon | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq |
| super_admin | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK (filtrado) | ❌ Bloq | ✅ OK | ✅ OK | ✅ OK |
| admin | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK (filtrado) | ❌ Bloq | ✅ OK | ✅ OK | ✅ OK |
| operador | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK (filtrado) | ❌ Bloq | ✅ OK | ✅ OK | ✅ OK |
| financeiro | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK (filtrado) | ❌ Bloq | ✅ OK | ✅ OK | ✅ OK |
| comercial | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK (filtrado) | ❌ Bloq | ✅ OK | ✅ OK | ✅ OK |
| cliente A | ✅ Só OS do A | ✅ Só OS do A | ✅ Só OS do A | ✅ Só OS do A | ✅ OK (filtrado) | ❌ Bloq | N/A | N/A | N/A |
| cliente B | ❌ Bloq | ❌ Bloq | ❌ Bloq | ❌ Bloq | ✅ OK (filtrado) | ❌ Bloq | N/A | N/A | N/A |

Legenda:
- ✅ OK = deve funcionar (acesso permitido)
- ❌ Bloq = deve ser bloqueado (0 rows ou erro 403)
- ✅ OK (filtrado) = SELECT funciona mas registros legados com tenant_id inválido ficam invisíveis

## Pré-requisitos para execução

1. ✅ Migration F2-A1 aplicada no QA
2. ❌ Baseline do schema aplicado
3. ❌ Seed mínimo executado (2 tenants, perfis, clientes, OS)
4. ❌ Playwright apontado para QA
5. ❌ Senhas dos usuários QA conhecidas

## Bloqueios

- Sem ambiente QA rodando → testes não podem ser executados
- Sem baseline → schema não reproduzível do zero
- Sem seed → não há dados para testar perfis
