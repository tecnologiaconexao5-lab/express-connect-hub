# TMS-021 — Sequência de Conclusão do App Motorista (10 Missões)

**Data:** 2026-07-29
**Contexto:** Bloqueadores P0 auditados (TMS-021). Plano para execução sequencial segura.

---

## Missão TMS-022 — Unificação do POD

**Objetivo:** Aplicar migration M108C1 para que o trigger `trg_sync_delivery_proof_to_entregas` sincronize `delivery_proofs` → `entregas_protocolo`.

**Dependências:** Nenhuma
**Arquivos:** `supabase/migrations/20260710_m108c1_pod_unico_entregas_protocolo.sql`
**Tabelas:** `delivery_proofs`, `entregas_protocolo`, `alocacoes_escala`
**Riscos:** Baixo. Trigger idempotente com `ON CONFLICT DO NOTHING`.
**Exige escrita em produção?** ✅ Sim (migration SQL)
**Exige autorização?** ✅ Sim
**Critérios de aceite:**
- INSERT em `delivery_proofs` → `entregas_protocolo` populado automaticamente
- TMS `buscarPOD()` retorna dados do app
- Portal Cliente exibe POD do app
**Testes app:** Fazer POD → verificar `entregas_protocolo` no banco
**Testes TMS:** Ver relatório de entrega
**Rollback:** `DROP TRIGGER trg_sync_delivery_proof_to_entregas` + `DROP FUNCTION f_sync_delivery_proof_to_entregas`

---

## Missão TMS-023 — Tracking Integrado ao TMS e Portal

**Objetivo:** Garantir que GPS enviado pelo App Motorista via RPC `registrar_posicao_motorista` seja visível no TMS e Portal Cliente.

**Dependências:** Nenhuma
**Arquivos:** `supabase/migrations/20260709_m106_tracking_real_go_live.sql`, `supabase/migrations/20260731_fix_registrar_posicao_motorista.sql`
**Tabelas:** `portal_tracking_realtime`, `alocacoes_escala`, `prestadores`
**Riscos:** Baixo. RPCs já testadas em M106.
**Exige escrita em produção?** ✅ Sim (verificar/aplicar migrations)
**Exige autorização?** ✅ Sim
**Critérios de aceite:**
- App envia GPS → `portal_tracking_realtime` populado
- RPC retorna sucesso (não erro de RLS/permission)
- PortalTrackingMap exibe marcador no mapa
**Testes app:** Iniciar tracking → verificar registros em `portal_tracking_realtime`
**Testes TMS:** Abrir Portal Cliente → ver posição no mapa
**Rollback:** Remover RLS policies e RPC

---

## Missão TMS-024 — Diagnóstico e Correção do Offline

**Objetivo:** Inspecionar as 7 pendências offline no celular do PRESTADOR TESTE APP e implementar fila offline para RPCs.

**Dependências:** TMS-022 (POD) — para testar offline de POD
**Arquivos:** `C:\src\conexao_prestador\lib\core\services\offline_upload_queue.dart`
**Tabelas:** `pending_uploads`
**Riscos:** Médio — RPCs fora de ordem podem causar inconsistência
**Exige escrita em produção?** ⚠️ Diagnóstico = leitura. RPC offline = app (sem produção)
**Exige autorização?** ✅ Sim (diagnóstico via SQL)
**Critérios de aceite:**
- Identificar tipo de cada pendência
- App aceita/avança/finaliza operação offline → sincroniza quando online
**Testes app:** Modo avião → aceitar operação → online → verificar status

---

## Missão TMS-025 — Correção Financeira TEXT × UUID

**Objetivo:** Corrigir `FinancialRepository.fetchSummary()` para usar `fornecedor_id` (UUID) quando disponível.

**Dependências:** Nenhuma
**Arquivos:** `C:\src\conexao_prestador\lib\core\repositories\financial_repository.dart`
**Tabelas:** `financeiro_pagar`, `pagamentos_prestadores`
**Riscos:** Baixo (código Flutter local)
**Exige escrita em produção?** ❌ Não (código Flutter)
**Exige autorização?** ❌ Não
**Critérios de aceite:** App exibe valores financeiros corretos do prestador
**Testes app:** Abrir aba Ganhos → valores condizentes com banco
**Rollback:** Reverter commit do Flutter

---

## Missão TMS-026 — Formalização dos Três Tipos de Operação

**Objetivo:** Alinhar os tipos de operação entre app (5 modos) e banco (3 modos). Definir oficialmente os 3 tipos.

**Dependências:** TMS-022, TMS-023 (POD + Tracking — tipos afetam ambos)
**Arquivos:** `C:\src\conexao_prestador\lib\core\utils\operation_type.dart`
**Tabelas:** `alocacoes_escala.operation_mode`, `rotas.operation_mode`
**Riscos:** Médio — alteração de enum impacta app, banco e TMS
**Exige escrita em produção?** ⚠️ Migration para sync de enums
**Exige autorização?** ✅ Sim
**Critérios de aceite:** App exibe label correto para cada tipo de operação
**Testes:** Criar operação de cada tipo → ver label no app

---

## Missão TMS-027 — Coleta Reversa, Devolução e Assinatura

**Objetivo:** Integrar coleta reversa ao TMS (entidade, tela, trigger).

**Dependências:** TMS-022 (POD — reversa gera POD)
**Arquivos:** `src/services/operacao/` (novo service TMS), trigger SQL
**Tabelas:** Nova tabela ou coluna `tipo_operacao = 'reverse_logistics'` em `alocacoes_escala`
**Riscos:** Alto — funcionalidade nova no TMS
**Exige escrita em produção?** ✅ Sim (migration + código TMS)
**Exige autorização?** ✅ Sim
**Critérios de aceite:** TMS cria reversa → app executa → retorno visível no TMS

---

## Missão TMS-028 — Ajustes de Layout e Estados da Home

**Objetivo:** Corrigir espaço branco, logo, sobreposição, skeleton loading e estado vazio.

**Dependências:** Nenhuma
**Arquivos:** `C:\src\conexao_prestador\lib\features\home\` (5 arquivos widgets)
**Riscos:** Baixo (código Flutter)
**Exige escrita em produção?** ❌ Não
**Exige autorização?** ❌ Não
**Critérios de aceite:** Layout consistente em 3 resoluções. Skeleton loading visível.

---

## Missão TMS-029 — Revisão Final do Seed

**Objetivo:** Revisar seed TMS013-SEED-v2 após correções dos bloqueadores P0.

**Dependências:** TMS-022, TMS-023, TMS-025
**Arquivos:** `scripts/tms013_seed_hml.mjs`
**Tabelas:** Todas do seed
**Riscos:** Baixo (seed já revisado em TMS-017/018/019)
**Exige escrita em produção?** ❌ Não (revisão apenas)
**Exige autorização?** ❌ Não
**Critérios de aceite:** Seed ainda compatível com schema atual após correções

---

## Missão TMS-030 — Execução Controlada do Seed (GATE 2)

**Objetivo:** Executar seed TMS013-SEED-v2 com checkpoint e rollback planejado.

**Dependências:** TMS-029 (revisão), GATE 1 concluído
**Arquivos:** `scripts/tms013_seed_hml.mjs`, `supabase/scripts/create_hml_seed_checkpoint.sql`
**Tabelas:** `_hml_seed_checkpoint` + 10 tabelas de negócio
**Riscos:** Moderado — escreve em produção com proteções (ON CONFLICT, SAVEPOINT)
**Exige escrita em produção?** ✅ Sim
**Exige autorização?** ✅ Sim (GATE 2)
**Critérios de aceite:** 6/6 cenários concluídos. App mostra operações.
**Rollback:** `supabase/scripts/cleanup_hml_app_20260729.sql`

---

## Missão TMS-031 — Homologação Completa no Celular

**Objetivo:** Validar 12 cenários no celular do PRESTADOR TESTE APP.

**Dependências:** TMS-030 (seed executado), TMS-022/023/025/028
**Riscos:** Baixo (validação manual)
**Exige escrita em produção?** ❌ Não
**Exige autorização?** ❌ Não
**Critérios de aceite:** 10/12 cenários aprovados

**Cenários:**
1. ✅ Login com teste@conexao.com
2. ✅ Header com nome, saudação, toggle
3. ✅ Operações aparecem na lista (aguardando aceite)
4. ✅ Aceitar operação
5. ✅ Avançar etapas (coleta → rota → entrega)
6. ✅ POD com foto + assinatura
7. ✅ Finalizar operação
8. ✅ Ver financeiro (Ganhos)
9. ✅ Ver comunicados
10. ⚠️ Tracking no mapa
11. ⚠️ Offline (modo avião)
12. ❌ Coleta reversa (se implementada)

---

## Ordem de Execução Recomendada

```
TMS-022 (POD) ──────────────┐
TMS-023 (Tracking) ─────────┤
TMS-025 (Financeiro) ───────┤ (podem ser paralelos)
TMS-028 (Layout) ───────────┘
         │
         ▼
TMS-024 (Offline) ────────── (depende de TMS-022)
         │
         ▼
TMS-026 (Tipos Operação) ─── (depende de TMS-022 + TMS-023)
TMS-027 (Coleta Reversa) ─── (depende de TMS-022)
         │
         ▼
TMS-029 (Revisão Seed) ───── (revisar após correções)
         │
         ▼
TMS-030 (Executar Seed) ──── (GATE 2)
         │
         ▼
TMS-031 (Homologação) ────── (validação no celular)
```

---

## Resumo de Dependências

| Missão | Bloqueia | É bloqueada por | Exige escrita produção |
|:-------|:--------:|:---------------:|:---------------------:|
| TMS-022 | TMS-024, 026, 027 | — | ✅ |
| TMS-023 | TMS-026 | — | ✅ |
| TMS-024 | — | TMS-022 | ❌ (app) |
| TMS-025 | — | — | ❌ (app) |
| TMS-026 | — | TMS-022, 023 | ⚠️ |
| TMS-027 | — | TMS-022 | ✅ |
| TMS-028 | — | — | ❌ (app) |
| TMS-029 | TMS-030 | TMS-022, 023, 025 | ❌ |
| TMS-030 | TMS-031 | TMS-029 | ✅ |
| TMS-031 | — | TMS-030 | ❌ |

---

*Fim — TMS-021 Sequência de Conclusão*
