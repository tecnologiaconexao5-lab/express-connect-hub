# TMS-022 — Plano de Implementação do POD Unificado

**Data:** 2026-07-29

---

## Etapas de Implementação

### Etapa 1 — Diagnóstico (read-only)
**Arquivo:** `supabase/scripts/TMS-022_DIAGNOSTICO_READ_ONLY_POD.sql`
**Ação:** Executar no SQL Editor do Supabase
**Verifica:** 17 itens (função, trigger, tabelas, colunas, registros, duplicatas, policies, grants)
**Resultado esperado:** Confirmar se M108C1 já foi aplicada

### Etapa 2 — Aplicar POD Unificado
**Arquivo:** `supabase/scripts/TMS-022_POD_UNIFICADO_CONTROLADO.sql`
**Pré-requisito:** Diagnóstico confirma M108C1 NÃO aplicada
**Ação:** Executar no SQL Editor do Supabase
**Cria:**
- Colunas: `receiver_relationship`, `gps_accuracy` em `entregas_protocolo`
- Colunas: `foto_canhoto_url`, `tenant_id` em `delivery_proofs`
- Função: `f_sync_delivery_proof_to_entregas()`
- Trigger: `trg_sync_delivery_proof_to_entregas`
- Policies + Grants

### Etapa 3 — Validar
**Ação:** Inserir registro manual em `delivery_proofs` e verificar `entregas_protocolo`
**Comando:**
```sql
-- Teste manual (após trigger aplicado)
INSERT INTO public.delivery_proofs (id, stop_id, operation_id, driver_id, receiver_name, status, delivered_at)
VALUES (gen_random_uuid(), 'teste-stop', '<UUID_ALOCACAO_EXISTENTE>', '<AUTH_UID>', 'Teste', 'delivered', NOW());
SELECT * FROM public.entregas_protocolo WHERE alocacao_id = '<UUID_ALOCACAO_EXISTENTE>'::uuid;
```

### Etapa 4 — Roteiro de Homologação Completo

| # | Passo | Como testar |
|:-:|:------|:------------|
| 1 | Criar operação no TMS | Tela Escala → Nova alocação |
| 2 | Atribuir ao PRESTADOR TESTE APP | Selecionar prestador |
| 3 | App recebe operação | Abrir app → ver na lista |
| 4 | Aceitar operação | Botão "Aceitar" |
| 5 | Avançar etapas até finalizar | Navegar pelos estágios |
| 6 | Coletar assinatura | Tela de assinatura |
| 7 | Tirar foto | Câmera do app |
| 8 | Registrar nome do recebedor | Input na tela |
| 9 | Finalizar entrega | Botão "Finalizar" |
| 10 | Verificar `delivery_proofs` | SQL: SELECT \* FROM delivery_proofs ORDER BY created_at DESC |
| 11 | Verificar `entregas_protocolo` | SQL: SELECT \* FROM entregas_protocolo ORDER BY created_at DESC |
| 12 | Verificar no TMS | Tela da OS → ver POD |
| 13 | Verificar no Portal | Portal Cliente → Comprovantes |
| 14 | Testar idempotência | Reenviar mesmo POD → sem duplicata |
| 15 | Testar offline | Modo avião → fazer POD → online → verificar |

### Etapa 5 — Rollback (se necessário)
**Arquivo:** `supabase/scripts/TMS-022_POD_ROLLBACK.sql`
**Ação:** Executar no SQL Editor
**Efeito:** Remove trigger e função. Preserva dados.

---

## Critérios de Aceite

1. ✅ Trigger `trg_sync_delivery_proof_to_entregas` existe e está ativo
2. ✅ INSERT em `delivery_proofs` → dados copiados para `entregas_protocolo`
3. ✅ TMS `buscarPOD()` retorna dados do app
4. ✅ Portal Cliente exibe POD (assinatura, foto, recebedor)
5. ✅ Reenvio não gera duplicata
6. ✅ Rollback reversível sem perda de dados

---

## Arquivos da Missão

| Arquivo | Finalidade |
|:--------|:-----------|
| `supabase/scripts/TMS-022_DIAGNOSTICO_READ_ONLY_POD.sql` | Diagnóstico pré-execução |
| `supabase/scripts/TMS-022_POD_UNIFICADO_CONTROLADO.sql` | Implementação controlada |
| `supabase/scripts/TMS-022_POD_ROLLBACK.sql` | Rollback seguro |
| `docs/auditorias/TMS-022_UNIFICACAO_POD.md` | Relatório de auditoria |
| `docs/planos/TMS-022_IMPLEMENTACAO_POD.md` | Plano de implementação |

---

*Fim — TMS-022 Plano de Implementação POD*
