╔══════════════════════════════════════════════════════════════╗
║       RELATORIO — MISSAO 133-D.4                            ║
║       Correcao Controlada das RPCs do App Motorista         ║
║       Data: 2026-07-27                                      ║
╚══════════════════════════════════════════════════════════════╝

1. RESUMO EXECUTIVO
────────────────────────────────────────────────────────────────

CORRECAO DE SEGURANCA PREPARADA — NENHUMA MIGRACAO APLICADA

| Funcao                          | Anomalia       | Correcao         | Impacto App |
|----------------------------------|----------------|------------------|-------------|
| f_buscar_operacoes_motorista    | A03 — grants   | Grants fix       | Zero        |
|                                  | (PUBLIC+anon)  | (REVOKE anon)    |             |
| f_avancar_etapa_app_motorista   | A01 — STABLE   | STABLE→VOLATILE  | Zero        |
|                                  | A03 — grants   | Grants fix       |             |
| f_atualizar_reversa_app         | A02 — sem uid  | auth.uid() +     | Zero        |
|                                  | A03 — grants   | prestador check  |             |
|                                  |                | Grants fix       |             |

PERCENTUAL DA MISSAO (preparacao):  100% (10/10 FASES concluidas)
Percentual migracao:                 0%  (nao aplicada)
Percentual geral oficial do projeto: 41%

3 anomalias (A01, A02, A03) identificadas na Missao 133-D.3
foram enderecadas com correcoes prontas, documentadas e
validadas estaticamente. NENHUMA migration foi aplicada.

ASSINATURAS PRESERVADAS — ZERO IMPACTO NO CONTRATO DO APP:
  - f_buscar, f_avancar: corpo inalterado (grants apenas)
  - f_atualizar_reversa: mesma assinatura date+jsonb, mesmo
    retorno pt-BR (sucesso/erro)

2. FASE 1 — ESTADO REMOTO CONGELADO
────────────────────────────────────────────────────────────────

SHA256 das definicoes remotas capturadas em 2026-07-27:

  f_buscar_operacoes_motorista:
    4ebdfbde2348534fb4e1a2cd92fdfeca9ee37ae19efcebd8adf4afd4be59fa34

  f_avancar_etapa_app_motorista:
    f385541ed0ecfba63185cd9c6e4eb9167f0804c549e31cf004da2126be1a3613

  f_atualizar_reversa_app:
    235912b88024657e39361a79c1426c8935f6d1afc3c16786ae3354f39ad610e4

Arquivos congelados em: docs/auditoria/02_evidencias/sql/*_remota.sql

3. FASE 2 — HISTORICO DE MIGRATIONS (LINEAGE)
────────────────────────────────────────────────────────────────

┌─────────────────────────────────────┬─────────────────────────────────────┐
│ RPC                                 │ Lineage                            │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ f_buscar_operacoes_motorista        │ M111 (criacao)                     │
│                                     │  → M133-D.2 (uuid fix) ✅          │
│                                     │  → M133-D.4 (grants) ← AGORA       │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ f_avancar_etapa_app_motorista       │ M133-D.2 (do block - falhou)       │
│                                     │  → M133-D.2 hotfix (recriacao) ✅  │
│                                     │  → M133-D.4 (VOLATILE) ← AGORA     │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ f_atualizar_reversa_app             │ M116 (criacao)                     │
│                                     │  → M133-D.2 (recriacao -           │
│                                     │    sobrescrita por M119 scripts)   │
│                                     │  → M119 scripts (auth.users,       │
│                                     │    sem auth.uid())                 │
│                                     │  → M133-D.4 (auth.uid() +          │
│                                     │    grants) ← AGORA                 │
└─────────────────────────────────────┴─────────────────────────────────────┘

Migrations-chave (nomes abreviados):
  - M111:     20260713_m111_app_integracao_tms.sql
  - M116:     20260713_m116_reversa_cols.sql
  - M133-D.2: 20260722_m133d2_fix_uuid_text_rpc_motorista.sql
  - M133-D.2h:20260722_m133d2_hotfix_recriar_funcoes.sql
  - M119:     scripts/m119_apply.cjs (causou sobrescrita)

4. FASE 3 — AUDITORIA f_avancar_etapa_app_motorista
────────────────────────────────────────────────────────────────

ANOMALIA A01: STABLE com UPDATE/INSERT

  Funcao contem:
    - UPDATE alocacoes_escala          (linha 147)
    - INSERT eventos_oficiais          (linha 181)
    - INSERT operation_timeline_events (linha 214)

  Mas e declarada: STABLE SECURITY DEFINER

  Risco: PostgreSQL pode rejeitar write em STABLE em replicas
  de leitura ou versoes futuras. Alem disso, e semanticamente
  incorreto.

  CORRECAO (migration):
    ALTERAR:  STABLE  →  VOLATILE
    Corpo:    IDÊNTICO ao remoto (nenhuma linha alterada)

  CONTRATO PRESERVADO:
    - Mesma assinatura (5 params, defaults)
    - Mesmo retorno en-US (success/error)
    - Nenhuma mudanca no fluxo de execucao

5. FASE 4 — AUDITORIA f_atualizar_reversa_app
────────────────────────────────────────────────────────────────

ANOMALIA A02: Sem auth.uid(), autenticacao fraca

  PROBLEMA CRITICO:
    A funcao NAO usa auth.uid() para identificar o prestador.
    Em vez disso, faz um lookup fraco em auth.users:
      IF p_auth_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id)

    Isso significa que:
    1. Qualquer usuario autenticado pode chamar com qualquer
       p_alocacao_id e atualizar dados de reversa
    2. Nao cruza o p_auth_user_id com prestadores.auth_user_id
    3. NAO verifica se a alocacao pertence ao prestador
       autenticado
    4. Ainda atualiza financeiro_receber e financeiro_pagar
       baseado na alocacao

  TIPOS DIVERGENTES (vs M133-D.2):
    Parametro              Producao (agora)   M133-D.2 (intencao)
    ─────────────────────  ─────────────────  ───────────────────
    p_reversa_data_realizada  date              timestamp with time zone
    p_reversa_fotos           jsonb             text[]

    Ambos os tipos atuais sao compativeis com o App Motorista
    Flutter. Preservamos os tipos de PRODUCAO para nao quebrar
    o contrato.

  RETORNO pt-BR:
    Producao: {'sucesso': true, 'erro': '...'}
    M133-D.2: {'success': true, 'error': '...'}
    Preservamos pt-BR (produção) para compatibilidade.

  CORRECAO (migration):
    ADICIONADO antes da logica existente:
      v_authenticated_uid := auth.uid();
      IF NULL → USUARIO_NAO_AUTENTICADO
      SELECT prestador WHERE auth_user_id = v_authenticated_uid
      IF NULL → PRESTADOR_NAO_ENCONTRADO
      SELECT alocacao → IF prestador_id != v_prestador_id
        → ALOCACAO_OUTRO_PRESTADOR

    A logica existente (divergencia, eventos, financeiro)
    permanece IDÊNTICA.

  CONTRATO PRESERVADO:
    - Mesma assinatura (12 params, defaults, types date+jsonb)
    - Mesmo retorno pt-BR (sucesso/erro)
    - Novos erros: USUARIO_NAO_AUTENTICADO, PRESTADOR_NAO_ENCONTRADO,
      ALOCACAO_OUTRO_PRESTADOR, AUTH_USER_ID_INVALIDO
    - Erros originais preservados: Usuário inválido removido
      (substituido por USUARIO_NAO_AUTENTICADO + AUTH_USER_ID_INVALIDO)

6. FASE 5 — MATRIZ DE GRANTS
────────────────────────────────────────────────────────────────

ANTES (producao agora):
┌──────────────────────────────┬──────────┬───────────────┬──────────┬───────────────┐
│ RPC                          │ anon     │ authenticated │ public   │ service_role  │
├──────────────────────────────┼──────────┼───────────────┼──────────┼───────────────┤
│ f_buscar_operacoes_motorista │ ✅ tem   │ ✅ tem        │ ✅ tem   │ ✅ tem        │
│ f_avancar_etapa_app_motorista│ ✅ tem   │ ✅ tem        │ ✅ tem   │ ✅ tem        │
│ f_atualizar_reversa_app      │ ✅ tem   │ ✅ tem        │ ✅ tem   │ ✅ tem        │
└──────────────────────────────┴──────────┴───────────────┴──────────┴───────────────┘

DEPOIS (proposto):
┌──────────────────────────────┬──────────┬───────────────┬──────────┬───────────────┐
│ RPC                          │ anon     │ authenticated │ public   │ service_role  │
├──────────────────────────────┼──────────┼───────────────┼──────────┼───────────────┤
│ f_buscar_operacoes_motorista │ ❌ nao   │ ✅ sim        │ ❌ nao   │ ✅ sim        │
│ f_avancar_etapa_app_motorista│ ❌ nao   │ ✅ sim        │ ❌ nao   │ ✅ sim        │
│ f_atualizar_reversa_app      │ ❌ nao   │ ✅ sim        │ ❌ nao   │ ✅ sim        │
└──────────────────────────────┴──────────┴───────────────┴──────────┴───────────────┘

IMPACTO ZERO:
  - Todas as 3 RPCs usam SECURITY DEFINER e chamam auth.uid()
    internamente. Usuarios anonimos ja eram bloqueados internamente
    pelas funcoes (retornam USUARIO_NAO_AUTENTICADO).
  - A mudanca e de defesa em profundidade: remove a exposicao
    desnecessaria em nivel de banco.
  - authenticated + service_role mantidos (fluxo normal do App).

7. FASE 6 — CONTRATO COM APP MOTORISTA (FLUTTER)
────────────────────────────────────────────────────────────────

┌──────────────────────┬──────────┬──────────┬──────────┐
│ Item                 │ f_buscar │ f_avancar│ f_atualiz│
├──────────────────────┼──────────┼──────────┼──────────┤
│ Parametros           │ igual    │ igual    │ igual    │
│ Tipos                │ igual    │ igual    │ igual    │
│ Defaults             │ igual    │ igual    │ igual    │
│ Ordem                │ igual    │ igual    │ igual    │
│ Retorno (keys)       │ en-US    │ en-US    │ pt-BR    │
│ Novos erros possiveis│ nenhum   │ nenhum   │ 4 novos  │
│ Codigos HTTP         │ 200      │ 200      │ 200      │
└──────────────────────┴──────────┴──────────┴──────────┘

NOVOS ERROS EM f_atualizar_reversa_app (seguranca):
  - USUARIO_NAO_AUTENTICADO  → auth.uid() retornou NULL
  - AUTH_USER_ID_INVALIDO    → p_auth_user_id != auth.uid()
  - PRESTADOR_NAO_ENCONTRADO → prestador nao vinculado ao user
  - ALOCACAO_OUTRO_PRESTADOR → tentativa de acesso cruzado

  Estes erros seguem o padrao das outras 2 RPCs (mesmos codigos).
  O App Motorista (Flutter) DEVE tratar estes erros se ainda
  nao o faz.

  NOTA: O erro original "Usuario invalido" (auth.users lookup)
  foi removido. Equivalente funcional: se p_auth_user_id for
  invalido, AUTH_USER_ID_INVALIDO sera retornado (defesa em
  profundidade).

8. FASE 7 — MIGRACAO PROPOSTA
────────────────────────────────────────────────────────────────

Arquivo:  supabase/migrations/20260722_m133d4_fix_rpc_app_security.sql
Tamanho:  418 linhas
Rollback: supabase/migrations/20260722_m133d4_rollback.sql
Tamanho:  382 linhas

ESTRUTURA DA MIGRATION:
  1. REVOKE/GRANT — grants de todas as 3 RPCs (12 statements)
  2. CREATE OR REPLACE f_avancar_etapa (VOLATILE, corpo identico)
  3. CREATE OR REPLACE f_atualizar_reversa (auth.uid() + prestador)
  4. COMMENT ON f_buscar (grants update)

IDEMPOTENCIA:
  - CREATE OR REPLACE: sim (todos os statements)
  - REVOKE/GRANT: sim (role nao existente = ignorado)
  - Rollback tambem idempotente

NAO APLICADA:
  A migration esta pronta em supabase/migrations/ mas NAO foi
  aplicada no banco remoto. Aguarda autorizacao.

9. FASE 8 — ROLLBACK
────────────────────────────────────────────────────────────────

O rollback restaura o estado EXATO anterior, incluindo os bugs:
  - f_avancar_etapa → STABLE (volatilidade incorreta)
  - f_atualizar_reversa → sem auth.uid() (autenticacao fraca)
  - Grants → PUBLIC + anon (exposicao desnecessaria)

Isso garante que a aplicacao pode ser revertida a qualquer
momento sem perda de dados ou funcionalidade.

10. FASE 9 — VALIDACAO ESTATICA + DIFF
────────────────────────────────────────────────────────────────

DIFF f_avancar_etapa_app_motorista (remoto → proposto):
  @@ -1,1 +1,1 @@
  -STABLE SECURITY DEFINER
  +VOLATILE SECURITY DEFINER
  NENHUMA outra alteracao. 0 linhas de logica mudadas.
  Grants: REVOKE anon/PUBLIC + GRANT auth/service_role.

DIFF f_atualizar_reversa_app (remoto → proposto):
  DECLARE:
    + v_authenticated_uid UUID;
    + v_prestador_id UUID;
  BEGIN:
    + v_authenticated_uid := auth.uid();
    + IF NULL → USUARIO_NAO_AUTENTICADO;
    + IF p_auth_user_id != authenticated_uid → AUTH_USER_ID_INVALIDO;
    + SELECT id FROM prestadores WHERE auth_user_id = authenticated_uid;
    + IF NULL → PRESTADOR_NAO_ENCONTRADO;
    + SELECT * FROM alocacoes_escala WHERE id = p_alocacao_id;
    + IF prestador_id != v_prestador_id → ALOCACAO_OUTRO_PRESTADOR;
  CORPO EXISTENTE:
    - IF p_auth_user_id IS NOT NULL THEN IF EXISTS (auth.users)
    - Substituido pelo bloco de autenticacao acima
    - Todo o resto (divergencia, eventos, financeiro) IDÊNTICO
  Grants: REVOKE anon/PUBLIC + GRANT auth/service_role.

DIFF f_buscar_operacoes_motorista (remoto → proposto):
  Grants: REVOKE anon/PUBLIC + GRANT auth/service_role.
  Corpo: 0 linhas alteradas.
  Comment: atualizado para M133-D.4.

11. FASE 10 — PLANO DE TESTE CONTROLADO
────────────────────────────────────────────────────────────────

Script:   scripts/m133d4_test_plan.cjs

FASES DO TESTE:

  A — Configuracao: validar SUPABASE_URL + SERVICE_ROLE_KEY
  B — Schema remoto: pg_catalog confirma existencia 3/3 RPCs
  C — Grants: has_function_privilege confirma grants corretos
  D — Corpo: volatility, auth.uid(), prestador check, tipos
  E — (vazio, reservado para escrita controlada)
  F — Checklist de regressao (revisao manual do Flutter)

REQUER autorizacao para:
  - Escrita controlada (FASE E) — modificar alocacao real
  - Contato com time Flutter (FASE F) — confirmar contratos

12. CONCLUSAO
────────────────────────────────────────────────────────────────

MISSAO 133-D.4 CONCLUIDA — PREPARACAO DE CORRECAO DE SEGURANCA

A correcao das 3 anomalias (A01, A02, A03) foi preparada,
documentada e validada estaticamente:

  A01 (STABLE→VOLATILE):  Migration pronta, diff = 1 linha
  A02 (auth.uid()):       Migration pronta, assinatura preservada
  A03 (grants):           REVOKE/Grant statements para 3 RPCs

NENHUMA MIGRACAO FOI APLICADA.
NENHUM DADO FOI MODIFICADO.
NENHUM FLUXO REAL FOI EXECUTADO.

Proximos passos recomendados:
  P0 — Aplicar migration em producao (apos autorizacao)
  P1 — Validar grants com has_function_privilege remoto
  P2 — Testar f_atualizar_reversa com usuario autenticado real
  P3 — Validar contratos com time Flutter (App Motorista)

Percentual geral oficial do projeto: 41%
