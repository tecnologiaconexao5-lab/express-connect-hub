# TMS-020 — Plano de Conclusão do App Motorista

**Data:** 2026-07-29
**Contexto:** Auditoria TMS-020 concluída. App Motorista em prontidão geral de 34%.
**Próximo passo pós-plano:** Executar GATE 2 (seed de homologação) para validar fluxos com dados reais.

---

## Missão 1 — Correção POD / Entregas Protocolo

**Objetivo:** Unificar o registro de POD para que app e TMS usem a mesma tabela (`entregas_protocolo`).

**Arquivos:**
- `C:\src\conexao_prestador\lib\core\repositories\delivery_proof_repository.dart`
- `C:\src\conexao_prestador\lib\core\services\storage_upload_service.dart`
- `src/services/podService.ts` (TMS)
- `src/services/portalCliente/portalClienteService.ts` (TMS)

**Tabelas:** `entregas_protocolo`, `delivery_proofs`

**Abordagem (2 opções):**
- **Opção A (recomendada):** Trigger SQL em `delivery_proofs` → `entregas_protocolo`. Toda inserção em `delivery_proofs` replica para `entregas_protocolo`. App continua escrevendo onde já escreve. TMS lê de onde já lê. Zero alteração no app.
- **Opção B:** App passa a escrever diretamente em `entregas_protocolo`. Requer refatoração do `DeliveryProofRepository`.

**Dependências:** Nenhuma
**Riscos:** Trigger pode falhar se schema divergir. Testar em banco antes.
**Critério de aceite:** App faz POD → dados visíveis no TMS e Portal Cliente em < 5s
**Testes:** Inserir delivery_proof → verificar entregas_protocolo criado
**Exige escrita em produção?** ✅ Sim (trigger SQL)
**Exige autorização humana?** ✅ Sim

---

## Missão 2 — Conectar Tracking ao Portal

**Objetivo:** Pontos GPS enviados pelo App Motorista devem ser visíveis no Portal Cliente e TMS.

**Arquivos:**
- `C:\src\conexao_prestador\lib\core\services\real_tracking_service.dart`
- `C:\src\conexao_prestador\lib\core\repositories\tracking_repository.dart`
- `src/services/rastreamento/trackingService.ts` (TMS)
- `src/components/portal-cliente/PortalTrackingMap.tsx` (TMS)

**Tabelas:** `tracking_points`, `portal_tracking_realtime`

**Abordagem:** Fazer o `TrackingRepository` do app escrever também em `portal_tracking_realtime` (ou criar trigger). TMS já tem subscription Realtime para essa tabela.

**Dependências:** Missão 1 (POD)
**Riscos:** App precisa de permissão INSERT em `portal_tracking_realtime` (RLS)
**Critério de aceite:** GPS do app visível no Portal Cliente em tempo real
**Testes:** App envia GPS → verificar `portal_tracking_realtime` → verificar PortalTrackingMap
**Exige escrita em produção?** ✅ Sim (RLS + trigger)
**Exige autorização humana?** ✅ Sim

---

## Missão 3 — Seed de Homologação (GATE 2)

**Objetivo:** Executar seed TMS013-SEED-v2 para criar dados controlados do PRESTADOR TESTE APP.

**Arquivos:**
- `scripts/tms013_seed_hml.mjs`
- `supabase/scripts/create_hml_seed_checkpoint.sql`
- `supabase/scripts/cleanup_hml_app_20260729.sql`

**Tabelas:** `_hml_seed_checkpoint`, `alocacoes_escala`, `entregas_protocolo`, `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `crm_leads`, `crm_followups`, `agentes_ia_internos`, `perfis_permissoes`, `tenant_usuarios`

**Cenários do seed:**
1. Usuário super_admin + tenant_usuarios + perfis_permissoes
2. 5 Agentes IA Internos
3. Financeiro (receber + pagar + pagamentos_prestadores)
4. Alocações de Escala (2 para PRESTADOR TESTE APP — status `aguardando_aceite`)
5. Entregas Protocolo (POD) com SAVEPOINT
6. CRM (Leads + Follow-ups) com SAVEPOINT

**Dependências:** GATE 1 concluído (checkpoint criado)
**Riscos:** Seed escreve em produção. ON CONFLICT protege duplicatas. SAVEPOINT protege falhas parciais.
**Critério de aceite:** Seed executa 6/6 cenários sem falhas. App Motorista mostra operações.
**Testes:** Executar seed → verificar checkpoint → abrir app → ver operações
**Exige escrita em produção?** ✅ Sim
**Exige autorização humana?** ✅ Sim (GATE 2 pendente)

---

## Missão 4 — Correção Financeiro App

**Objetivo:** Resumo financeiro no app deve refletir valores corretos do prestador.

**Arquivos:**
- `C:\src\conexao_prestador\lib\core\repositories\financial_repository.dart`
- `C:\src\conexao_prestador\lib\core\repositories\driver_operations_repository.dart` (fetchFinancialSummary)

**Tabelas:** `financeiro_pagar`, `pagamentos_prestadores`, `alocacoes_escala`

**Problema:** `FinancialRepository.fetchSummary()` usa `.eq('prestador', driverId)` — `prestador` é TEXT, `driverId` é UUID. Comparação falha.

**Correção:** Mudar para `.eq('prestador_id', prestadorUuid)` consultando primeiro `prestadores.auth_user_id`.

**Dependências:** Nenhuma
**Riscos:** Baixo (código local do app, não afeta TMS)
**Critério de aceite:** App exibe valores financeiros reais do prestador
**Testes:** Mock financeiro_pagar → ver extrato no app
**Exige escrita em produção?** ❌ Não (código Flutter)
**Exige autorização humana?** ❌ Não

---

## Missão 5 — Coleta Reversa no TMS

**Objetivo:** Implementar entidade, tela e trigger de coleta reversa no TMS.

**Arquivos:**
- `src/services/operacao/coletaReversaService.ts` (novo)
- Tela de coleta reversa no TMS
- Trigger para propagar reversa para `entregas_protocolo`

**Tabelas:** `alocacoes_escala` (nova coluna `tipo_operacao`), ou nova tabela `coleta_reversa`

**Dependências:** Missão 1 (POD)
**Riscos:** Médio — novidade no TMS
**Critério de aceite:** TMS pode criar e gerenciar coleta reversa. App executa. Retorno visível no TMS.
**Testes:** Criar reversa no TMS → aparece no app → executar → retorna ao TMS
**Exige escrita em produção?** ✅ Sim (migration + código)
**Exige autorização humana?** ✅ Sim

---

## Missão 6 — Correção de Layout

**Objetivo:** Ajustar espaço branco, logo, sobreposição e consistência visual.

**Arquivos:**
- `C:\src\conexao_prestador\lib\features\home\home_screen.dart`
- `C:\src\conexao_prestador\lib\features\home\widgets\operational_home_header.dart`
- `C:\src\conexao_prestador\lib\features\home\widgets\active_operation_card.dart`

**Alterações:**
1. Remover espaço branco: substituir `SliverToBoxAdapter + Column` por `SliverList`
2. Aumentar logo para 72-80px no expanded state
3. Garantir que `SliverAppBar.bottom` evite sobreposição
4. Skeleton loading enquanto dados carregam
5. Estado vazio consistente quando não há operação

**Dependências:** Nenhuma
**Riscos:** Baixo (código Flutter, não afeta banco)
**Critério de aceite:** Layout consistente em 3 resoluções (360, 390, 428dp)
**Testes:** Testar em diferentes tamanhos de tela
**Exige escrita em produção?** ❌ Não
**Exige autorização humana?** ❌ Não

---

## Missão 7 — Correção de Comunicados

**Objetivo:** Comunicados devem exibir título e mensagem.

**Arquivos:**
- `C:\src\conexao_prestador\lib\core\services\notification_service.dart`
- `C:\src\conexao_prestador\lib\core\models\pending_upload.dart`
- `C:\src\conexao_prestador\lib\features\home\widgets\communications_list.dart`

**Alterações:**
1. `OfficialEvent.fromJson()` aceitar `title`/`titulo` e `message`/`mensagem` como fallback
2. Adicionar null safety e fallback visual ("Sem conteúdo disponível")

**Dependências:** Nenhuma
**Riscos:** Baixo
**Critério de aceite:** Comunicados com título e mensagem aparecem no app
**Testes:** Inserir em `eventos_oficiais` → ver no app
**Exige escrita em produção?** ❌ Não
**Exige autorização humana?** ❌ Não

---

## Missão 8 — Offline para RPCs

**Objetivo:** Aceitar, avançar etapa e finalizar operação devem funcionar offline.

**Arquivos:**
- `C:\src\conexao_prestador\lib\core\services\offline_upload_queue.dart`
- `C:\src\conexao_prestador\lib\core\repositories\driver_operations_repository.dart`

**Alterações:**
1. Estender `PendingUpload.type` para suportar `rpc` (não apenas upload)
2. `avancarEtapa()` em caso de erro de rede → enfileirar RPC
3. Reprocessar RPCs offline na mesma fila que uploads

**Dependências:** Nenhuma
**Riscos:** Médio — RPCs fora de ordem podem causar inconsistência. Usar idempotency key.
**Critério de aceite:** App aceita operação offline → sincroniza quando online → TMS reflete
**Testes:** Modo avião → aceitar operação → desligar avião → verificar status no banco
**Exige escrita em produção?** ❌ Não (código Flutter)
**Exige autorização humana?** ❌ Não

---

## Missão 9 — Homologação Mobile Completa

**Objetivo:** Validar todos os 6 cenários do seed no celular.

**Dependências:** Missão 3 (seed executado), Missão 1-2 (POD + tracking), Missão 4 (financeiro)

**Cenários de teste no celular:**
1. ✅ Login com teste@conexao.com
2. ✅ Home carrega com nome do prestador
3. ✅ Operações aparecem na lista (aguardando aceite)
4. ✅ Aceitar operação
5. ✅ Avançar etapas (coleta → rota → entrega → POD)
6. ✅ Finalizar operação
7. ⚠️ POD com foto + assinatura
8. ⚠️ Ver financeiro
9. ⚠️ Ver comunicados
10. ⚠️ Ver tracking
11. ⚠️ Testar offline (modo avião)
12. ❌ Coleta reversa (se implementada)

**Critério de aceite:** 10/12 cenários aprovados no celular
**Exige escrita em produção?** ✅ Sim (seed já executa)
**Exige autorização humana?** ✅ Sim (GATE 2 + testes no celular)

---

## Missão 10 — Correção de Permissões do Checkpoint

**Objetivo:** Remover acesso de anon/authenticated à tabela _hml_seed_checkpoint.

**SQL corretivo (idempotente):**
```sql
REVOKE ALL ON TABLE public._hml_seed_checkpoint FROM anon;
REVOKE ALL ON TABLE public._hml_seed_checkpoint FROM authenticated;
```

**Dependências:** Nenhuma
**Riscos:** Nenhum
**Critério de aceite:** `has_table_privilege('anon', ...)` retorna false
**Exige escrita em produção?** ✅ Sim
**Exige autorização humana?** ✅ Sim

---

## Missão 11 — Limpeza de Pendências Offline

**Objetivo:** Diagnosticar e limpar as 7 pendências offline no celular do PRESTADOR TESTE APP.

**Tabelas:** `pending_uploads`

**SQL de diagnóstico:**
```sql
SELECT id, type, status, attempts, last_error, created_at
FROM public.pending_uploads
WHERE driver_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
ORDER BY created_at DESC;
```

**SQL de limpeza (se necessário):**
```sql
DELETE FROM public.pending_uploads
WHERE driver_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
  AND status IN ('pending', 'failed');
```

**Dependências:** Nenhuma
**Riscos:** Baixo (apenas dados do prestador de homologação)
**Exige escrita em produção?** ✅ Sim (DELETE)
**Exige autorização humana?** ✅ Sim

---

## Cronograma Estimado

| Missão | Esforço | Prioridade | Bloqueia? | Pode fazer sem seed? |
|:-------|:-------:|:----------:|:---------:|:--------------------:|
| 1 — POD | 1 dia | P0 | ✅ Sim | Sim (trigger) |
| 2 — Tracking | 1 dia | P0 | ✅ Sim | Sim (trigger) |
| 3 — Seed | 1 dia | P0 | ✅ Sim | **É o seed** |
| 4 — Financeiro | 0.5 dia | P1 | ❌ | Sim |
| 5 — Coleta Reversa | 3 dias | P1 | ❌ | Sim |
| 6 — Layout | 1 dia | P2 | ❌ | Sim |
| 7 — Comunicados | 0.5 dia | P2 | ❌ | Sim |
| 8 — Offline RPC | 2 dias | P2 | ❌ | Sim |
| 9 — Homologação | 2 dias | P0 | ✅ Sim | Não (precisa do seed) |
| 10 — Permissões | 0.5 dia | P3 | ❌ | Sim |
| 11 — Limpeza pendências | 0.5 dia | P2 | ❌ | Sim |

**Total estimado:** 12.5 dias de desenvolvimento (1 dev)

**Sequência recomendada:**
```
Missão 3 (Seed) → Missão 9 (Homologação)
                       ↓
Missão 1 + Missão 2 (POD + Tracking) em paralelo
                       ↓
Missão 4 + Missão 7 + Missão 10 + Missão 11 em paralelo
                       ↓
Missão 6 + Missão 8 em paralelo
                       ↓
Missão 5 (Coleta Reversa)
```

---

## Observações Finais

1. **GATE 2** (seed) deve ser executado o quanto antes para permitir testes no celular com dados reais
2. As Missões 1 e 2 (POD + Tracking) são os **verdadeiros bloqueadores** — sem elas, o app nunca terá fluxo completo
3. O app Flutter está bem escrito (código limpo, estado da arte, arquitetura sólida) — os problemas são de **integração**, não de qualidade de código
4. Nenhuma funcionalidade requer reescrita completa — apenas conexão entre sistemas

---

*Fim do plano — TMS-020 Plano de Conclusão do App Motorista*
