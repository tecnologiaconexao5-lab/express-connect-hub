# MISSÃO 133-D.7 — Preparação Segura dos Testes de Escrita das RPCs do App Motorista

**Data:** 2026-07-27  
**Status:** ✅ Concluída (FASES 1–10)  
**Percentual oficial:** 41% (não alterado — apenas planejamento, sem execução de DML)

## Resumo Executivo

Migration `20260722_m133d4_fix_rpc_app_security.sql` aplicada em produção em 2026-07-27T17:04:22 (0.3s) durante a M133-D.6. Três anomalias corrigidas (A01, A02, A03). Esta missão prepara o plano controlado e reversível para testar as RPCs de escrita (`f_avancar_etapa_app_motorista` e `f_atualizar_reversa_app`) sem tocar em dados comerciais reais.

**Resultado da preparação:** Estratégia A+ recomendada (ROLLBACK em transação única). Plano completo documentado. Autorização NÃO solicitada — pendente de GO/NO-GO (FASE 9).

---

## FASE 1 — Busca por Registros de Homologação

### Critério de busca
Padrões pesquisados em 11 tabelas: HML, TESTE, TEST, QA, DEMO, AUDITORIA, PLAYWRIGHT, E2E, MISSAO, HOMOLOG.

### Resultados por tabela

| Tabela | Registros HML | Destaques |
|--------|:-------------:|-----------|
| `ordens_servico` | 20+ | `OS-TESTE-*`, `M86-TEST-*`, `TESTE-001`, `OS_AUDITORIA_*`, `OS-GO-LIVE-*` |
| `alocacoes_escala` | 20+ | `ROTA TESTE CRÍTICO`, `OS-HML-ESCALA-001`, `OPERACAO DE HOMOLOGACAO - Missao 124`, `ALOCACAO DE TESTE - SPRINT 1` |
| `prestadores` | 14 | `PRESTADOR TESTE APP` (auth_user_id=YES) + 13 `Motorista Teste` (auth:NO) |
| `financeiro_receber` | 20+ | Vinculado a OS de teste |
| `eventos_oficiais` | 0 | Nenhum encontrado via padrão |
| `veiculos`, `clientes` | — | Sem padrões HML |

### Conclusão
Existem registros de homologação/teste isolados para teste controlado. O prestador `PRESTADOR TESTE APP` (`e6646799-...`) é o único com `auth_user_id` vinculado e pode autenticar via `auth.uid()`.

---

## FASE 2 — Auditoria do Prestador com auth_user_id

### Dados do prestador
| Campo | Valor |
|-------|-------|
| ID | `e6646799-fbac-453e-a3ef-afdfc01a7085` |
| Nome | PRESTADOR TESTE APP |
| Status | ativo |
| auth_user_id | `a5e51631-5ed8-430d-9041-4b185c03d821` |
| Email | `teste@conexao.com` |
| CPF | `12345678900` |
| Telefone | `11999999999` |
| Criado em | 2026-06-09 |

### Auth user details
| Campo | Valor |
|-------|-------|
| ID | `a5e51631-5ed8-430d-9041-4b185c03d821` |
| Email | `teste@conexao.com` |
| metadata | `{"nome": "Prestador Teste", "origem": "app_prestador", "nome_completo": "PRESTADOR TESTE APP", "email_verified": true}` |

### Alocações do prestador: 47 total

| Status | Quantidade | Detalhes |
|--------|:----------:|----------|
| `aguardando_aceite` | 46 | Várias sem OS, etapa_atual variada |
| `aceita` | 1 | `4473d537-...` — etapa_atual=`viagem_aceita`, sem OS |

### Candidatos a teste selecionados

| ID (resumido) | Status | etapa_atual | OS | Rota | Indicado para |
|:-------------:|--------|:-----------:|:--:|------|:-------------:|
| `76af8e4a` | aguardando_aceite | (empty) | NULL | ROTA TESTE | **Avanço viagem_aceita** |
| `c616675e` | aguardando_aceite | cheguei_coleta | NULL | 88001 TESTE COMPLETO SPRINT 1.3 | **Avanço intermediário** |
| `4473d537` | aceita | viagem_aceita | NULL | OS-HML-ESCALA-001 | **Avanço cheguei_coleta** |

### Reversa candidates: 0
Nenhuma alocação do prestador de teste possui `tipo_reversa != 'sem_reversa'`. Teste de reversa requer criação de cenário (não aprovado nesta missão).

---

## FASE 3 — Cadeia de Efeitos: f_avancar_etapa_app_motorista

### Assinatura
```sql
f_avancar_etapa_app_motorista(
  p_alocacao_id UUID,
  p_etapa TEXT,
  p_payload JSONB DEFAULT '{}',
  p_idempotency_key TEXT DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL
) RETURNS JSONB
```

### Máquina de estados (15 transições válidas)
```
"" → viagem_aceita → cheguei_coleta → carregamento_iniciado → carregamento_finalizado
  → romaneio_informado | foto_romaneio | km_inicial_informado | saiu_em_rota
  → chegou_entrega → descarregamento_iniciado → descarga_finalizada
  → km_final_informado → assinatura_capturada → pod_registrado → servico_finalizado
```

### Side effects no UPDATE da alocação
| Condição | Coluna alterada | Valor |
|----------|----------------|-------|
| Sempre | `metadata` | JSON atualizado com app_motorista.etapa_atual |
| `p_etapa = 'viagem_aceita'` | `status` | `'aceita'` |
| `p_etapa = 'viagem_aceita'` | `aceite_prestador` | `true` |
| `p_etapa = 'viagem_aceita'` | `data_aceite` | `NOW()` |
| `p_etapa = 'cheguei_coleta'` | `status` | `'em_rota'` |
| `p_etapa = 'cheguei_coleta'` | `horario_inicio_real` | `NOW()` |
| `p_etapa = 'servico_finalizado'` | `status` | `'concluida'` |
| `p_etapa = 'servico_finalizado'` | `finalizada` | `true` |
| `p_etapa = 'servico_finalizado'` | `data_finalizacao` | `NOW()` |
| `p_etapa = 'servico_finalizado'` | `horario_fim_real` | `NOW()` |
| Sempre | `updated_at` | `NOW()` |

### Eventos inseridos
| Tabela | Sempre? | Colunas |
|--------|:-------:|---------|
| `eventos_oficiais` | ✅ Sim | event_type, entity_type, entity_id, source, payload, metadata |
| `operation_timeline_events` | ✅ Sim | operation_id, driver_id, type, title, metadata |

### Triggers que disparam
| Trigger | Timing | Quando |
|---------|:------:|--------|
| `trg_alocacoes_escala_updated_at` | BEFORE | Sempre (updated_at) |
| `trg_cancelar_financeiro_alocacao` | BEFORE | Apenas se status = 'cancelada' |
| `trg_evento_prestador_aceitou` | AFTER | Apenas se aceite_prestador mudou para true |
| `trg_evento_operacao_finalizada` | AFTER | Apenas se status mudou para 'concluida' |
| `trg_propagar_financeiro_alocacao` | AFTER | Sempre (propaga para financeiro_receber/pagar) |
| `trg_registrar_historico_alocacao` | AFTER | Sempre (historico_alocacoes_escala) |

### Riscos identificados
| Risco | Gravidade | Descrição |
|-------|:---------:|-----------|
| Dupla propagação financeira | Média | RPC não atualiza financeiro diretamente, mas trigger `trg_propagar_financeiro_alocacao` pode disparar se houver OS vinculada |
| Eventos órfãos em ROLLBACK | Baixa | ROLLBACK reverte eventos + timeline + histórico |
| Idempotência funcional | Baixa | Chave `p_idempotency_key` evita duplicatas |

---

## FASE 4 — Cadeia de Efeitos: f_atualizar_reversa_app

### Assinatura
```sql
f_atualizar_reversa_app(
  p_alocacao_id UUID,
  p_reversa_status TEXT DEFAULT NULL,
  p_reversa_qtd_coletada INTEGER DEFAULT NULL,
  p_reversa_motivo_divergencia TEXT DEFAULT NULL,
  p_reversa_responsavel TEXT DEFAULT NULL,
  p_reversa_telefone TEXT DEFAULT NULL,
  p_reversa_data_realizada DATE DEFAULT NULL,
  p_reversa_fotos JSONB DEFAULT NULL,
  p_reversa_assinatura_url TEXT DEFAULT NULL,
  p_reversa_latitude NUMERIC DEFAULT NULL,
  p_reversa_longitude NUMERIC DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL
) RETURNS JSONB
```

### Side effects
| Tabela | Operação | Condição |
|--------|:--------:|----------|
| `alocacoes_escala` | UPDATE (14 campos) | Sempre |
| `eventos_oficiais` | INSERT (1 evento) | Sempre |
| `financeiro_receber` | UPDATE (valor + descricao) | Se `v_os_id IS NOT NULL` |
| `financeiro_pagar` | UPDATE (valor + descricao) | Se `v_os_id IS NOT NULL` |

### Riscos identificados
| Risco | Gravidade | Descrição |
|-------|:---------:|-----------|
| Dupla atualização financeiro | **Alta** | RPC atualiza `financeiro_receber`/`financeiro_pagar` diretamente via UPDATE com `WHERE os_id`. Se trigger `trg_propagar_financeiro_alocacao` também disparar, pode haver conflito. |
| Ausência de UNIQUE(os_id) em `financeiro_pagar` | Média | Permite duplicatas em race condition |
| Cálculo de divergência complexo | Baixa | Lógica de `v_divergencia` e `v_qtd_faturar` com múltiplos COALESCE aninhados |

### Observação crítica
O teste de reversa é **bloqueado** por não haver alocações com `tipo_reversa != 'sem_reversa'` para o prestador de teste. Qualquer teste de reversa exigiria:
1. Criar alocação com dados de reversa (não autorizado)
2. OU usar alocação de outro prestador (não autenticável)

---

## FASE 5 — Estratégias de Teste (A/B/C)

### Strategy A+ — ROLLBACK em transação única (RECOMENDADA)
**Descrição:** Executar RPC dentro de `BEGIN/ROLLBACK` com `SET LOCAL "request.jwt.claim.sub"` para simular autenticação. Todas as escritas são revertidas.

**Prós:**
- Testa SQL real (auth, validações, transições, triggers)
- Zero persistência (ROLLBACK reverte tudo)
- Mecanismo `SET LOCAL` validado (FASE 5)
- Pode ser executado múltiplas vezes no mesmo candidato
- Baixíssimo risco (`candidate sem OS` elimina financeiro)

**Contras:**
- Não testa persistência跨 transações
- `SET LOCAL` via superuser difere do fluxo real (JWT)

**Risco:** 1/10

### Strategy B — Pre-flight checks + idempotência
**Descrição:** Testar apenas validações negativas (auth inválido, transição inválida) e idempotência com chave repetida. Sem DML.

**Prós:**
- Zero risco de escrita
- Valida auth, state machine, idempotency

**Contras:**
- Não testa a execução real do UPDATE
- Não testa triggers, eventos, timeline
- Cobertura ~40%

**Risco:** 0/10

### Strategy C — Nenhum teste (documentar apenas)
**Descrição:** Não executar nenhuma RPC. Apenas documentar o plano.

**Prós:**
- Risco zero
- Plano pronto para execução futura

**Contras:**
- Nenhuma validação real
- Percentual 41% permanece congelado

**Risco:** 0/10

### Recomendação: Strategy A+ para avanço, Strategy C para reversa

| Teste | Estratégia | Candidato | Risco |
|-------|:----------:|:----------:|:----:|
| Avanço `"" → viagem_aceita` | A+ ROLLBACK | `76af8e4a-...` | 1/10 |
| Avanço `viagem_aceita → cheguei_coleta` | A+ ROLLBACK | `4473d537-...` | 1/10 |
| Avanço `cheguei_coleta → carregamento_iniciado` | A+ ROLLBACK | `c616675e-...` | 1/10 |
| Negativa — auth inválido | A+ ROLLBACK | Qualquer | 0/10 |
| Negativa — transição inválida | A+ ROLLBACK | `4473d537-...` | 0/10 |
| Negativa — operação cancelada | A+ ROLLBACK | Cancelada | 0/10 |
| Reversa | C | N/A | Bloqueado |

---

## FASE 6 — Plano de Teste: f_avancar_etapa_app_motorista

### Pré-requisitos
- Conexão DATABASE_URL com privilégios de superuser (disponível)
- `SET LOCAL "request.jwt.claim.sub"` (validado ✅)
- Candidato `76af8e4a-a3bc-492a-897d-4556574cc5d1` (sem OS, sem financeiro)

### Teste 1 — Avanço básico (empty → viagem_aceita)
```sql
BEGIN;
SET LOCAL "request.jwt.claim.sub" = 'a5e51631-5ed8-430d-9041-4b185c03d821';

SELECT f_avancar_etapa_app_motorista(
  '76af8e4a-a3bc-492a-897d-4556574cc5d1'::uuid,
  'viagem_aceita'::text,
  '{}'::jsonb,
  'test-m133d7-advance-001'::text,
  'a5e51631-5ed8-430d-9041-4b185c03d821'::uuid
);

-- Verificar resultado
SELECT status, aceite_prestador, data_aceite,
       metadata->'app_motorista'->>'etapa_atual' AS etapa
FROM alocacoes_escala WHERE id = '76af8e4a-a3bc-492a-897d-4556574cc5d1'::uuid;

ROLLBACK;
```

**Verificações esperadas:**
- `result.success = true`
- `result.etapa = 'viagem_aceita'`
- `result.status = 'aceita'`
- `status = 'aceita'`, `aceite_prestador = true`, `data_aceite IS NOT NULL`
- `etapa_atual = 'viagem_aceita'`

### Teste 2 — Avanço intermediário (viagem_aceita → cheguei_coleta)
Mesmo padrão com candidato `4473d537-e266-41a5-b174-14bcc7d07cf4` e etapa `cheguei_coleta`.

### Teste 3 — Idempotência
Chamar mesma RPC duas vezes com mesma `p_idempotency_key`. Segunda chamada deve retornar `idempotent: true`.

### Teste 4 — Transição inválida
Tentar avançar de `viagem_aceita` para `servico_finalizado` (pula 13 etapas). Deve retornar `TRANSICAO_INVALIDA`.

### Teste 5 — Auth inválido
Chamar com `p_auth_user_id` diferente de `auth.uid()`. Deve retornar `AUTH_USER_ID_INVALIDO`.

---

## FASE 7 — Plano de Teste: f_atualizar_reversa_app

### Status: BLOQUEADO
Não há alocações com `tipo_reversa != 'sem_reversa'` para o prestador de teste. As opções são:

| Opção | Descrição | Requer autorização? |
|:-----:|-----------|:-------------------:|
| A | Criar alocação HML com dados de reversa | ✅ Sim (DML) |
| B | Usar alocação de outro prestador com reversa | ❌ Não autenticável |
| C | Ignorar teste de reversa | N/A |

### Recomendação: Opção C
Teste de reversa postergado para quando houver alocação HML com reversa disponível. O SQL da RPC já foi inspecionado e validado (M133-D.4/5/6).

---

## FASE 8 — Plano de Rollback e Cleanup

### Rollback via transação (método primário)
```sql
BEGIN;
-- executar RPC
ROLLBACK;  -- Reverte TUDO: alocacao, eventos, timeline, histórico
```

### Rollback manual (emergencial, se ROLLBACK não for possível)
```sql
-- Reverter alocação
UPDATE alocacoes_escala SET
  status = 'aguardando_aceite',
  aceite_prestador = false,
  data_aceite = NULL,
  horario_inicio_real = NULL,
  horario_fim_real = NULL,
  finalizada = false,
  data_finalizacao = NULL,
  metadata = jsonb_set(metadata, '{app_motorista, etapa_atual}', to_jsonb('')),
  updated_at = NOW()
WHERE id = '<alocacao_id>';

-- Remover eventos
DELETE FROM eventos_oficiais
WHERE entity_id = '<alocacao_id>'
  AND entity_type = 'alocacao'
  AND source = 'app_motorista';

-- Remover timeline
DELETE FROM operation_timeline_events
WHERE operation_id = '<alocacao_id>';

-- Remover histórico (se criado por trigger)
DELETE FROM historico_alocacoes_escala
WHERE alocacao_id = '<alocacao_id>';
```

### Matriz de reversibilidade
| Efeito | Reversível via ROLLBACK? | Reversível manualmente? |
|--------|:------------------------:|:-----------------------:|
| UPDATE alocacao | ✅ Sim | ✅ Sim |
| INSERT eventos_oficiais | ✅ Sim | ✅ Sim (DELETE) |
| INSERT operation_timeline_events | ✅ Sim | ✅ Sim (DELETE) |
| INSERT historico_alocacoes_escala | ✅ Sim | ✅ Sim (DELETE) |
| UPDATE financeiro_receber | ✅ Sim | ✅ Sim |
| UPDATE financeiro_pagar | ✅ Sim | ✅ Sim |

---

## FASE 9 — Critérios de Autorização (GO/NO-GO)

### Para avançar (GO), TODOS os critérios abaixo devem ser atendidos:
- [ ] ✅ Migration M133-D.4 aplicada (validado em M133-D.6)
- [ ] ✅ Grants restritos (authenticated/service_role apenas — validado em M133-D.6)
- [ ] ✅ Candidato HML isolado identificado (sem OS, sem financeiro)
- [ ] ✅ SET LOCAL auth.uid() validado (FASE 5)
- [ ] ❌ Reversa candidate disponível (bloqueado)
- [ ] ❌ Teste de escrita autorizado pelo usuário (pendente)
- [ ] ❌ Horário comercial fora de pago (recomendado: 22h-06h ou domingo)
- [ ] ❌ Script de rollback preparado e verificado
- [ ] ❌ Alguém disponível para monitorar durante execução

### Matriz de Decisão
| Condição | Avanço (A+) | Reversa |
|:--------:|:-----------:|:-------:|
| Risco estimado | 1/10 | N/A |
| GO sem aprovação? | ❌ Não | N/A |
| GO com aprovação? | ✅ Sim | ❌ Bloqueado |
| Requer janela especial? | ❌ Não (ROLLBACK protege) | N/A |

### Veredito
**Avanço:** Aguardando autorização explícita do usuário para executar Strategy A+.
**Reversa:** Bloqueado — sem candidato de teste disponível.

---

## FASE 10 — Evidências e Relatórios

### Scripts criados durante a missão
| Script | Finalidade | Status |
|--------|-----------|:------:|
| `scripts/m133d7_fase1b_search_hml.cjs` | Busca HML (v1 — coluna errada) | ❌ |
| `scripts/m133d7_fase1c_cols_os.cjs` | Descoberta de colunas | ✅ |
| `scripts/m133d7_fase1d_final.cjs` | Busca HML (v2 — colunas corretas) | ✅ |
| `scripts/m133d7_fase2_find_prestador.cjs` | Encontrar prestador com auth_user_id | ✅ |
| `scripts/m133d7_fase2_audit_prestador.cjs` | Auditoria completa do prestador | ✅ |
| `scripts/m133d7_fase2_check_schema.cjs` | Schema alocacoes_escala | ✅ |
| `scripts/m133d7_fase3_rpc_defs.cjs` | Definições RPC remotas | ✅ |
| `scripts/m133d7_fase3_candidates_v2.cjs` | Mapa candidatos + metadata | ✅ |
| `scripts/m133d7_fase5_auth_only.cjs` | Validação auth.uid() SET LOCAL | ✅ |

### SHA256 de definições pós-aplicação
Arquivos em `docs/auditoria/02_evidencias/sql/`:
- `f-buscar-operacoes-motorista_remota_pos.sql` 
- `f-avancar-etapa-app-motorista_remota_pos.sql`
- `f-atualizar-reversa-app_remota_pos.sql`

### Pendências pós-M133-D.7
| Item | Prioridade | Descrição |
|------|:----------:|-----------|
| 1 | P0 | Obter autorização do usuário para executar teste de avanço (Strategy A+) |
| 2 | P1 | Criar alocação HML com reversa para testar f_atualizar_reversa_app |
| 3 | P2 | Validar que App Motorista Flutter real consegue autenticar e chamar RPCs |
| 4 | P3 | Agendar teste controlado em janela de baixo movimento |

### Percentual oficial do projeto: 41%
- Segurança RPC validada: 100%
- Escrita RPC homologada: 0% (pendente de autorização)
- Integração Flutter auditada: 0% (App Motorista é projeto externo)
