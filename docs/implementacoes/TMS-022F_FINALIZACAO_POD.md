# TMS-022F — Finalização do POD

**Data:** 2026-07-29

---

## 1. Sincronização Comprovada

**App → Supabase → TMS está funcional.** O trigger `trg_sync_delivery_proof_to_entregas` copia corretamente dados de `delivery_proofs` para `entregas_protocolo`.

### Evidências
- 2 registros em `delivery_proofs` com mesmo `operation_id` → apenas 1 registro em `entregas_protocolo` (idempotência OK)
- 0 delivery_proofs sem correspondência
- Campos mapeados corretamente (receiver_name → nome_recebedor, photo_url → foto_entrega_url, etc.)

### Status mapping
| App (delivery_proofs) | TMS/Portal (entregas_protocolo) | Status |
|:----------------------|:-------------------------------|:-------|
| `delivered` | `entregue` | ✅ Mapeamento correto (trigger faz tradução) |
| `delivered_with_note` | `entregue_ressalva` | ✅ |
| `not_delivered` | `nao_entregue` | ✅ |

---

## 2. Retry Atual e Idempotência

### Problema Original
App gerava `id: Uuid().v4()` a cada chamada de `savePod()`. Se houvesse retry (falha de rede), um novo UUID era gerado, criando novo INSERT em `delivery_proofs`. O trigger bloqueava o segundo (por `IF EXISTS em alocacao_id`), mas a origem ficava com registro órfão.

### Correção Aplicada (Flutter)
**Arquivo:** `operation_detail_screen.dart:1300`
```dart
// Antes: id: const Uuid().v4()  → novo UUID a cada chamada
// Depois: id: const Uuid().v5(Uuid.NAMESPACE_DNS, 'pod_$opId') → UUID determinístico
```

**Efeito:** O mesmo `operation_id` sempre gera o mesmo UUID v5. Retries reutilizam o mesmo ID. O `ON CONFLICT DO NOTHING` no trigger impede duplicatas.

**`idempotencyKey:`** também populado com `'pod_$opId'` para rastreamento.

### Correção Aplicada (TMS podService.ts)
**Arquivo:** `src/services/podService.ts:130-165`

Antes: INSERT direto com risco de duplicata em corrida com trigger.

Depois: Dupla verificação:
1. SELECT-check antes de INSERT
2. Se INSERT falhar com erro `duplicate`, trata como sucesso

---

## 3. Duplicidade Histórica

**alocacao_id:** `02c85042-6176-4f49-bdaf-ba74b2296425`
**Quantidade:** 3 registros em `entregas_protocolo`
**Data:** 18/06/2026
**Origem:** Testes E2E antigos (pré-existência do trigger)
**Ação:** **Preservados.** Não apagar. Não criar UNIQUE agora.

---

## 4. Riscos de Segurança (Diagnosticados)

| Risco | Severidade | Ação Corretiva |
|:------|:----------:|:---------------|
| `anon` pode INSERT em `delivery_proofs` | **Alta** | REVOKE ALL FROM anon + policy INSERT only for authenticated |
| `anon` pode INSERT/UPDATE/DELETE em `entregas_protocolo` | **Alta** | REVOKE ALL FROM anon |
| `authenticated` pode DELETE em `delivery_proofs` | Média | REVOKE DELETE FROM authenticated |
| `authenticated` pode UPDATE/DELETE em `entregas_protocolo` | Média | REVOKE UPDATE, DELETE FROM authenticated |
| Policy "Anon insert protocolo" com WITH CHECK true | **Alta** | Remover policy |
| Zero policies em `delivery_proofs` (RLS ON mas sem filtro) | **Alta** | Criar policies INSERT + SELECT |

### SQL de Correção (pendente de autorização)
`supabase/scripts/TMS-022F_SEGURANCA_POD_INCREMENTAL.sql`

### Rollback
`supabase/scripts/TMS-022F_SEGURANCA_POD_ROLLBACK.sql`

---

## 5. Policies que Serão Removidas

| Policy | Tabela | Motivo |
|:-------|:-------|:-------|
| `Anon insert protocolo` | `entregas_protocolo` | anon não deve inserir POD |

## 6. Policies que Serão Criadas

| Policy | Tabela | Função |
|:-------|:-------|:-------|
| `dp_insert_authenticated` | `delivery_proofs` | Permitir INSERT de authenticated |
| `dp_select_own` | `delivery_proofs` | SELECT apenas dos próprios registros (por driver_id) |

## 7. Privilégios Revogados

| Role | Tabela | Privilégio |
|:-----|:-------|:-----------|
| anon | `delivery_proofs` | ALL |
| anon | `entregas_protocolo` | ALL |
| authenticated | `delivery_proofs` | UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER |
| authenticated | `entregas_protocolo` | UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER |

---

## 8. Cardinalidade

**Atual:** 1 alocação = 1 POD
**Futura (multi-stop):** 1 alocação + 1 parada = 1 POD por parada → chave `(alocacao_id, stop_id)`

---

## 9. Critérios de Homologação

1. ✅ App envia POD → `delivery_proofs` populado
2. ✅ Trigger copia para `entregas_protocolo`
3. ✅ TMS `buscarPOD()` retorna dados
4. ✅ Portal Cliente exibe assinatura, foto, recebedor
5. ✅ Idempotência: reenvio não duplica
6. ⚠️ Segurança: SQL pendente de autorização
7. ⚠️ UNIQUE(alocacao_id): não criado (preservar dados históricos)

---

## 10. Riscos Restantes

| Risco | Probabilidade | Impacto |
|:------|:-------------:|:-------:|
| Race condition trigger × TMS (mesmo alocacao_id) | Muito baixa | Duplicata evitada (ambos têm proteção) |
| UNIQUE(alocacao_id) ausente permite duplicatas futuras | Baixa | Mitigado por IF EXISTS em trigger + TMS |
| anon com INSERT em delivery_proofs (até SQL ser aplicado) | **Alta** | SQL de segurança pronto |
| 3 registros históricos duplicados | Zero (preservados) | Nenhum |

---

## 11. Prontidão para Homologação

**TMS-022 está pronta para homologação controlada** após aplicação do SQL de segurança e execução do seed (GATE 2).

---

*Fim — TMS-022F Finalização POD*
