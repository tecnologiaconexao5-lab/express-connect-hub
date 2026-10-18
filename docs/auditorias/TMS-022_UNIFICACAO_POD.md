# TMS-022 — Unificação do POD entre App, TMS e Portal

**Data:** 2026-07-29

---

## 1. Migration M108C1 — Auditoria Completa

### Estado: ✅ APLICADA (confirmado por diagnóstico TMS-022 em produção)
- Função `public.f_sync_delivery_proof_to_entregas` — **EXISTE**
- Trigger `trg_sync_delivery_proof_to_entregas` — **EXISTE** (AFTER INSERT ON delivery_proofs)
- Coluna `receiver_relationship` em `entregas_protocolo` — **EXISTE**
- Coluna `gps_accuracy` em `entregas_protocolo` — **EXISTE**
- Tabela `delivery_proofs` — **EXISTE** (2 registros)
- Tabela `entregas_protocolo` — **EXISTE** (44 registros)
- 0 delivery_proofs sem correspondência em entregas_protocolo

### Conclusão: Scripts NÃO DEVEM SER EXECUTADOS
- ❌ `TMS-022_POD_UNIFICADO_CONTROLADO.sql` — **NÃO EXECUTAR** (já aplicado)
- ❌ `TMS-022_POD_ROLLBACK.sql` — **NÃO EXECUTAR** (preservar trigger existente)
- ❌ Migration M108C1 original — **NÃO REAPLICAR**
- Qualquer correção futura deve ser incremental, nunca reaplicando a migration.

### Objetos Criados pela Migration M108C1

| Objeto | Tipo | Risco |
|:-------|:-----|:------|
| `entregas_protocolo.receiver_relationship` | Coluna (TEXT) | Baixo — coluna adicional, NULL permitido |
| `entregas_protocolo.gps_accuracy` | Coluna (NUMERIC) | Baixo — coluna adicional, NULL permitido |
| `delivery_proofs.foto_canhoto_url` | Coluna (TEXT) | Baixo — coluna adicional, NULL permitido |
| `delivery_proofs.tenant_id` | Coluna (UUID) | Baixo — DEFAULT current_tenant_id_safe() |
| `idx_delivery_proofs_operation_id` | Índice | Baixo — B-tree em tabela pequena |
| `idx_entregas_protocolo_alocacao_id_tenant` | Índice | Baixo — B-tree |
| `f_sync_delivery_proof_to_entregas()` | Função (SECURITY DEFINER) | Médio — ver análise abaixo |
| `trg_sync_delivery_proof_to_entregas` | Trigger (AFTER INSERT) | Médio — ver análise abaixo |
| Policies RLS (2) | Policy | Baixo |
| Grants (4) | Grant | Baixo |
| `delivery_proofs` CREATE TABLE IF NOT EXISTS | Tabela | Baixo (já existe) |

### Análise de Risco por Comando

**`CREATE OR REPLACE FUNCTION f_sync_delivery_proof_to_entregas()`**
- Risco de sobrescrever: MÉDIO. Se outra função com mesmo nome existir, será substituída.
- Na versão controlada (TMS-022), removemos `OR REPLACE` com pré-validação.

**`DROP TRIGGER IF EXISTS trg_sync_delivery_proof_to_entregas`**
- Risco: BAIXO se trigger não existir. Se existir (já aplicado), remove sem aviso.
- Na versão controlada, pré-validamos e abortamos.

**`SECURITY DEFINER` na função**
- Risco: MÉDIO. Função executa como owner (postgres). Mas só acessa `alocacoes_escala` (SELECT) e `entregas_protocolo` (INSERT).
- Mitigação: `SET search_path = public` evita search_path hijacking.

**`ON CONFLICT DO NOTHING` no INSERT**
- Risco: BAIXO. Se `entregas_protocolo` não tiver unique constraint em `alocacao_id`, o `ON CONFLICT DO NOTHING` não faz nada (silencia).
- Correção na versão controlada: usamos `IF EXISTS (SELECT ...)` antes de inserir (idempotência explícita).

**Trigger `AFTER INSERT ON delivery_proofs`**
- Risco de loop infinito: BAIXO. O trigger insere em `entregas_protocolo`, não em `delivery_proofs`. Sem recursão.
- Risco de falha no INSERT no trigger: BAIXO. Trigger é AFTER INSERT — falha no trigger reverte a transação principal (app recebe erro).

**`ALTER TABLE ADD COLUMN IF NOT EXISTS`**
- Risco: MÍNIMO. Adiciona colunas NULLable. Não afeta registros existentes.

### Compatibilidade

| Sistema | Compatível? | Observação |
|:--------|:-----------:|:-----------|
| App Flutter atual | ✅ | Continua escrevendo em `delivery_proofs` |
| TMS (`podService.ts`) | ✅ | Lê de `entregas_protocolo` (já faz) |
| Portal Cliente | ✅ | Lê de `entregas_protocolo` (já faz) |
| Schema produção | ⚠️ | Requer diagnóstico para confirmar |

---

## 2. Mapa de Campos — delivery_proofs × entregas_protocolo

| Campo delivery_proofs | Tipo | Obrigatório | Campo entregas_protocolo | Tipo | Transformação | Risco |
|:----------------------|:---:|:-----------:|:-------------------------|:---:|:--------------|:-----:|
| `id` | UUID | ✅ | `id` | UUID | Direto | Nenhum |
| `stop_id` | TEXT | ❌ | — | — | Sem destino | **Perda** |
| `operation_id` | TEXT | ✅ | `alocacao_id` | UUID | CAST(op AS UUID) | **Médio** (se não for UUID) |
| `driver_id` | TEXT | ✅ | `prestador_id` | UUID | Busca via alocação | Médio |
| `rota_id` | TEXT | ❌ | — | — | Sem destino | Perda |
| `os_id` | TEXT | ❌ | `ordem_servico_id` | UUID | Busca via alocação | Baixo |
| `cliente_id` | TEXT | ❌ | — | — | Sem destino | Perda |
| `tenant_id` | UUID | ❌ | `tenant_id` | UUID | Direto | Nenhum |
| `receiver_name` | TEXT | ✅ | `nome_recebedor` | TEXT | Direto | Nenhum |
| `receiver_document` | TEXT | ❌ | `documento_recebedor` | TEXT | Direto | Nenhum |
| `receiver_relationship` | TEXT | ❌ | `receiver_relationship` | TEXT | Direto | Nenhum |
| `status` | TEXT | ✅ | `status` | TEXT | Mapping (ver trigger) | Baixo |
| `photo_url` | TEXT | ❌ | `foto_entrega_url` | TEXT | Direto | Nenhum |
| `signature_url` | TEXT | ❌ | `assinatura_url` | TEXT | Direto | Nenhum |
| `foto_canhoto_url` | TEXT | ❌ | `foto_canhoto_url` | TEXT | Direto | Nenhum |
| `latitude` | DOUBLE | ❌ | `latitude` | NUMERIC | Direto | Nenhum |
| `longitude` | DOUBLE | ❌ | `longitude` | NUMERIC | Direto | Nenhum |
| `gps_accuracy` | DOUBLE | ❌ | `gps_accuracy` | NUMERIC | Direto | Nenhum |
| `observation` | TEXT | ❌ | `observacao` | TEXT | Direto | Nenhum |
| `delivered_at` | TIMESTAMPTZ | ❌ | `data_hora_entrega` | TIMESTAMPTZ | Direto | Nenhum |
| `created_at` | TIMESTAMPTZ | ✅ | `created_at` | TIMESTAMPTZ | Direto | Nenhum |
| `idempotency_key` | TEXT | ❌ | — | — | Sem destino | Perda |
| `parada_id` | TEXT | ❌ | — | — | Sem destino | Perda |

### Campos sem destino em `entregas_protocolo`

| Campo | Motivo | Impacto |
|:------|:-------|:--------|
| `stop_id` | Modelo de entregas não usa paradas | Baixo — usado apenas internamente no app |
| `rota_id` | Não existe em entregas_protocolo | Baixo |
| `cliente_id` | Pode ser obtido via alocacao_id | Nenhum |
| `idempotency_key` | Trigger usa alocacao_id como chave | **Médio** — se app reenviar mesmo POD, trigger ignora |

---

## 3. Regra de Idempotência

**Chave definida: `alocacao_id`**

Justificativa:
- Uma alocação/operação só pode ter UM POD
- `alocacao_id` é UUID, estável, imutável
- App já vincula POD a `operationId` (que contém o UUID da alocação)
- Trigger usa `IF EXISTS (SELECT 1 FROM entregas_protocolo WHERE alocacao_id = X)` para evitar duplicatas
- `ON CONFLICT DO NOTHING` como fallback adicional

### Cenários de Idempotência

| Cenário | Comportamento |
|:--------|:-------------|
| App reenvia mesmo POD (offline retry) | Trigger vê que alocacao_id já existe → RETURN NEW (ignora) |
| App reenvia com dados atualizados | Trigger ignora (não atualiza) — POD é imutável |
| App fecha durante upload | pending_uploads retenta → trigger idempotente |
| App envia POD de outra operação | operation_id diferente → trigger insere normalmente |
| App envia POD sem operation_id | CAST falha → RETURN NEW (ignora) |
| App envia POD 2x manualmente | Trigger bloqueia na segunda tentativa |

---

## 4. Estratégia Escolhida

### Opção A — Trigger unidirecional (RECOMENDADA)

**Trigger `AFTER INSERT ON delivery_proofs` → copia para `entregas_protocolo`**

| Critério | Avaliação |
|:---------|:----------|
| Operação transacional única | ✅ Trigger roda na mesma transação do INSERT |
| Idempotência | ✅ `IF EXISTS` + `ON CONFLICT DO NOTHING` |
| Menor exposição de tabelas | ✅ App só conhece `delivery_proofs` |
| Compatibilidade offline | ✅ App não muda — trigger só dispara quando há conexão |
| Auditoria | ✅ Ambos os registros existem |
| Rollback | ✅ DROP TRIGGER + DROP FUNCTION (sem perder dados) |
| Menor acoplamento | ✅ App e TMS/Portal não compartilham schema |

### Opções Rejeitadas

**Opção B (App gravar direto em `entregas_protocolo`):**
- Exige alteração no Flutter (código compilado, deploy na loja)
- Rompe compatibilidade offline (app precisaria de permissão INSERT direto)
- Duplica lógica de mapeamento de campos

**Opção C (RPC única):**
- Ponto único de falha
- App precisaria mudar de `supabase.from(delivery_proofs).insert()` para `supabase.rpc()`
- Exige alteração no Flutter

**Opção D (Híbrida temporária):**
- Complexidade desnecessária
- Trigger resolve o problema sem alteração no app

---

## 5. Causa Exata do POD Não Aparecer no TMS

**O App Motorista escreve POD em `delivery_proofs`. O TMS lê de `entregas_protocolo`.** Sem o trigger `trg_sync_delivery_proof_to_entregas`, os dados do app nunca chegam à tabela que o TMS consulta.

### Fluxo Atual (Quebrado)
```
App → delivery_proofs (INSERT) ✗ nunca chega a entregas_protocolo
TMS → entregas_protocolo (SELECT) ✗ vazio para PODs do app
```

### Fluxo Correto (Com Trigger)
```
App → delivery_proofs (INSERT) → trigger → entregas_protocolo (INSERT)
                                                          ↓
                                              TMS (SELECT) → OK
                                              Portal (SELECT) → OK
```

---

## 6. Alterações Necessárias

### App Flutter (C:\src\conexao_prestador\)

| Arquivo | Alteração | Exigida? |
|:--------|:----------|:--------:|
| `delivery_proof_repository.dart` | Garantir que `operation_id` contenha UUID válido da alocação | ✅ Já faz |
| `delivery_proof_entity.dart` | Adicionar campo `foto_canhoto_url` | ✅ Já existe no model |
| `operation_detail_screen.dart` (linha 1297-1314) | Garantir que `DeliveryProofEntity` inclua `foto_canhoto_url` e `receiver_relationship` | ⚠️ Opcional |

**Conclusão: App NÃO precisa ser alterado** para o fluxo básico funcionar. O trigger aceita os campos atuais.

### TMS (express-connect-hub)

| Arquivo | Alteração | Exigida? |
|:--------|:----------|:--------:|
| `podService.ts` (linha 167-205) | Já lê de `entregas_protocolo` | ✅ Nenhuma |
| `buscarPOD()` (linha 185-202) | Já usa `entregas_protocolo` como fallback | ✅ Nenhuma |

**Conclusão: TMS NÃO precisa ser alterado.**

### Portal Cliente (express-connect-hub)

| Arquivo | Alteração | Exigida? |
|:--------|:----------|:--------:|
| `portalClienteService.ts` (linha 606) | Já lê de `entregas_protocolo` | ✅ Nenhuma |
| `PortalComprovantesPremium.tsx` | Já exibe `nome_recebedor`, `foto_entrega_url`, `assinatura_url` | ✅ Nenhuma |
| `PortalDrawerPOD.tsx` | Já exibe assinatura, fotos, canhoto | ✅ Nenhuma |
| `PortalComparacaoEntregas.tsx` | Já exibe indicadores de POD | ✅ Nenhuma |

**Conclusão: Portal NÃO precisa ser alterado.**

---

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|:------|:-------------:|:-------:|:----------|
| Falha de CAST de operation_id (TEXT) para UUID | Média | Baixo (ignora) | TRY/CATCH no trigger retorna NEW |
| Trigger falha e app recebe erro | Baixa | Alto | App já trata erro de INSERT em delivery_proofs |
| Duplicidade de POD | Baixa | Médio | Idempotência por alocacao_id |
| Trigger executa sobre registros históricos | Zero | — | Trigger é AFTER INSERT — só executa em novos INSERTs |
| SECURITY DEFINER executa com privilégios elevados | Baixo | Baixo | SET search_path = public |
| Colunas sem correspondência perdem dados | Médio | Baixo | stop_id, rota_id, cliente_id — não críticos |

---

## 8. Rollback

Arquivo: `supabase/scripts/TMS-022_POD_ROLLBACK.sql`

Sequência:
1. `DROP TRIGGER trg_sync_delivery_proof_to_entregas` — para sincronização
2. `DROP FUNCTION f_sync_delivery_proof_to_entregas()` — remove função
3. Dados existentes em ambas as tabelas são PRESERVADOS

---

*Fim — TMS-022 Unificação POD*
