╔══════════════════════════════════════════════════════════════╗
║       RELATORIO — MISSAO 133-D.3                            ║
║       Revalidacao das RPCs do App e Grants                  ║
║       Data: 2026-07-27                                      ║
╚══════════════════════════════════════════════════════════════╝

1. RESUMO EXECUTIVO
────────────────────────────────────────────────────────────────

CORRECAO UUID x TEXT CONFIRMADA — FLUXOS DE ESCRITA AINDA NAO
HOMOLOGADOS

| Funcao                          | UUIDxTEXT | Auth      | Grants   | Volatility | Score |
|----------------------------------|-----------|-----------|----------|------------|-------|
| f_buscar_operacoes_motorista    | ✅ Ok     | auth.uid  | PUBLIC   | STABLE Ok  | 85%   |
| f_avancar_etapa_app_motorista   | ✅ Ok     | auth.uid  | PUBLIC   | ❌ STABLE  | 40%   |
|                                 |           |           | + anon   | + write    |       |
| f_atualizar_reversa_app         | ❌ N/A    | auth.users| PUBLIC   | VOLATILE   | 30%   |
|                                 | (versao   | lookup    | + anon   | Ok         |       |
|                                 | diferente)| (sem uid) |          |            |       |

PERCENTUAL GERAL OFICIAL: 41%
Percentual correcao UUIDxTEXT: 66% (2/3 corrigidas, 1 com versao diferente)
Percentual funcional (leitura): 60% (buscar_operacoes testada c/ dados reais)
Percentual funcional (escrita): 25% (funcoes com anomalias nao testadas)
Percentual integracao App:      0% (App Motorista = Flutter externo)
Percentual seguranca grants:   40% (PUBLIC + anon em todas, 2/3 write)

2. FASE 1 — ESTADO REMOTO CONFIRMADO
────────────────────────────────────────────────────────────────

2.1 f_buscar_operacoes_motorista
─────────────────────────────────
  Parametros:      p_auth_user_id uuid DEFAULT NULL
  Signature:       1 overload
  Volatility:      STABLE ✅ (somente SELECT)
  Security:        SECURITY DEFINER
  search_path:     public
  Auth:            auth.uid() -> prestadores.auth_user_id ✅
  UUIDxTEXT:       NENHUM ::text encontrado ✅
  Grants:          anon, authenticated, postgres, service_role, PUBLIC
  Write ops:       NAO (read-only) ✅
  Owner:           postgres
  Definicao remota: Confere com a migration 133-D.2 ✅
  Status:          CORRIGIDA E CONFIRMADA

2.2 f_avancar_etapa_app_motorista
─────────────────────────────────
  Parametros:      p_alocacao_id uuid, p_etapa text,
                   p_payload jsonb DEFAULT '{}',
                   p_idempotency_key text DEFAULT NULL,
                   p_auth_user_id uuid DEFAULT NULL
  Signature:       1 overload
  Volatility:      STABLE ❌ MAS CONTEM UPDATE/INSERT
  Security:        SECURITY DEFINER
  search_path:     public
  Auth:            auth.uid() -> prestadores.auth_user_id ✅
  UUIDxTEXT:       auth_user_id = v_authenticated_uid (UUID = UUID) ✅
  Grants:          anon, authenticated, postgres, service_role, PUBLIC
  Write ops:       SIM (UPDATE alocacoes_escala, INSERT eventos_oficiais,
                   INSERT operation_timeline_events)
  Owner:           postgres
  Definicao remota: Confere c/ hotfix 133-D.2 no conteudo, mas VOLATILITY
                    esta incorreta (STABLE em funcao que escreve)
  Status:          CONTEUDO CORRIGIDO — VOLATILITY INCORRETA ⚠️
  Risco:           PostgreSQL pode rejeitar UPDATE/INSERT em STABLE em
                    versoes futuras ou em replicas de leitura

2.3 f_atualizar_reversa_app
─────────────────────────────────
  Parametros:      p_alocacao_id uuid, p_reversa_status text,
                   p_reversa_qtd_coletada integer,
                   p_reversa_motivo_divergencia text,
                   p_reversa_responsavel text, p_reversa_telefone text,
                   p_reversa_data_realizada date,         ← DIFERENTE
                   p_reversa_fotos jsonb,                  ← DIFERENTE
                   p_reversa_assinatura_url text,
                   p_reversa_latitude numeric,
                   p_reversa_longitude numeric,
                   p_auth_user_id uuid DEFAULT NULL
  Signature:       1 overload ✅ (nao ha mais duplicatas)
  Volatility:      VOLATILE ✅ (correto para write)
  Security:        SECURITY DEFINER
  search_path:     public
  Auth:            NAO usa auth.uid()
                   Usa: IF p_auth_user_id IS NOT NULL THEN
                        IF NOT EXISTS (SELECT 1 FROM auth.users
                                       WHERE id = p_auth_user_id)
                   ❌ NAO cruza com prestadores.auth_user_id
  UUIDxTEXT:       NAO se aplica (versao diferente da migration)
  Grants:          anon, authenticated, postgres, service_role, PUBLIC
  Write ops:       SIM (UPDATE alocacoes_escala)
  Owner:           postgres
  Definicao remota: DIFERENTE da migration 133-D.2.
                    p_reversa_data_realizada = DATE (era TIMESTAMPTZ)
                    p_reversa_fotos = jsonb (era text[])
                    Auth usa lookup direto em auth.users
                    Provavelmente sobrescrita por migration M119 posterior
  Status:          VERSAO DIFERENTE EM PRODUCAO — NAO CORRESPONDE
                    A MIGRATION 133-D.2 ⚠️
  Risco:           Autenticacao mais fraca (confia em p_auth_user_id
                    sem cruzar com prestador vinculado)

3. FASE 2 — VALIDACAO DE GRANTS
────────────────────────────────────────────────────────────────

┌──────────────────────────────┬──────────┬───────────────┬──────────┬───────────────┐
│ RPC                          │ anon     │ authenticated │ public   │ service_role  │
├──────────────────────────────┼──────────┼───────────────┼──────────┼───────────────┤
│ f_buscar_operacoes_motorista │ ✅ tem   │ ✅ tem        │ ✅ tem   │ ✅ tem        │
│ f_avancar_etapa_app_motorista│ ✅ tem   │ ✅ tem        │ ✅ tem   │ ✅ tem        │
│ f_atualizar_reversa_app      │ ✅ tem   │ ✅ tem        │ ✅ tem   │ ✅ tem        │
└──────────────────────────────┴──────────┴───────────────┴──────────┴───────────────┘

NECESSIDADE REAL:
┌──────────────────────────────┬──────────┬───────────────┬──────────┬───────────────┐
│ RPC                          │ anon     │ authenticated │ public   │ service_role  │
├──────────────────────────────┼──────────┼───────────────┼──────────┼───────────────┤
│ f_buscar_operacoes_motorista │ ❌ nao   │ ✅ sim        │ ❌ nao   │ ✅ sim        │
│ f_avancar_etapa_app_motorista│ ❌ nao   │ ✅ sim        │ ❌ nao   │ ✅ sim        │
│ f_atualizar_reversa_app      │ ❌ nao   │ ✅ sim        │ ❌ nao   │ ✅ sim        │
└──────────────────────────────┴──────────┴───────────────┴──────────┴───────────────┘

ANALISE:
- Todas as 3 RPCs internamente chamam auth.uid() (ou verificam auth.users)
  para autenticar o usuario. A anon key passa, mas auth.uid() retorna NULL
  para requisicoes nao autenticadas.
- As RPCs retornam USUARIO_NAO_AUTENTICADO quando auth.uid() e NULL.
- Mesmo COM grants para anon, a funcao bloqueia internamente.
- Entretanto, revogar anon/PUBLIC e boa pratica: defesa em profundidade.
- Riscos reais:
  - anon + SECURITY DEFINER + funcao com bug futuro = porta aberta
  - PUBLIC inclui qualquer funcao de banco sem autenticacao

PROPOSTA (nao aplicar):
  Para f_buscar_operacoes_motorista:
    REVOKE ALL ON FUNCTION FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION TO authenticated, service_role;

  Para f_avancar_etapa_app_motorista:
    REVOKE ALL ON FUNCTION FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION TO authenticated, service_role;

  Para f_atualizar_reversa_app:
    REVOKE ALL ON FUNCTION FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION TO authenticated, service_role;

4. FASE 3 — CALLERS REAIS
────────────────────────────────────────────────────────────────

4.1 Callers no TMS (src/):
    NENHUM — Zero imports ou chamadas diretas a estas 3 RPCs
    no codigo TypeScript do TMS.

    Referencia encontrada:
    - src/components/operacao/EscalaLista.tsx:3054 — apenas comentario
      documentando que o App Motorista gera eventos via RPC

4.2 Callers no Supabase (triggers, functions):
    NENHUM — Nenhuma funcao ou trigger no banco chama estas RPCs.

4.3 Callers no App Motorista (Flutter PWA):
    NAO MAPEADO — Projeto Flutter e externo a este repositorio.
    Documentacao esperada em missao propria do Flutter.

4.4 Tabelas impactadas pelas RPCs:
┌────────────────────────────────┬────────────────────┬──────────┐
│ Tabela                         │ RPC                │ Operacao │
├────────────────────────────────┼────────────────────┼──────────┤
│ alocacoes_escala               │ f_buscar (leitura) │ SELECT   │
│                                │ f_avancar_etapa    │ UPDATE   │
│                                │ f_atualizar_reversa│ UPDATE   │
├────────────────────────────────┼────────────────────┼──────────┤
│ rota_paradas                   │ f_buscar (leitura) │ SELECT   │
├────────────────────────────────┼────────────────────┼──────────┤
│ prestadores                    │ f_buscar (leitura) │ SELECT   │
│                                │ f_avancar_etapa    │ SELECT   │
├────────────────────────────────┼────────────────────┼──────────┤
│ eventos_oficiais               │ f_avancar_etapa    │ INSERT   │
├────────────────────────────────┼────────────────────┼──────────┤
│ operation_timeline_events      │ f_avancar_etapa    │ INSERT   │
└────────────────────────────────┴────────────────────┴──────────┘

5. FASE 4 — TESTES FUNCIONAIS CONTROLADOS
────────────────────────────────────────────────────────────────

5.1 Teste A — buscar_operacoes (leitura, seguro)
    - Query: SELECT * FROM f_buscar_operacoes_motorista(NULL::uuid)
    - Deve retornar USUARIO_NAO_AUTENTICADO (sem auth.uid())
    - Ja executado na missao 133-D.2 via PostgREST autenticado
    - Resultado: 31 operacoes, dados reais ✅
    - PENDENTE: verificar isolamento entre prestadores (prestador A
      nao ve operacoes do prestador B)

5.2 Teste B — avancar_etapa (escrita, requer autorizacao)
    - Query: SELECT * FROM f_avancar_etapa_app_motorista(
        'uuid-da-alocacao', 'viagem_aceita', '{}', NULL, NULL)
    - Riscos:
      a. Volatility STABLE + write — pode falhar em runtime
      b. Modifica dados reais de producao
      c. Insere em 2 tabelas de eventos
    - REQUER AUTORIZACAO EXPRESSA DE ESCRITA
    - Tabelas que seriam afetadas: alocacoes_escala (UPDATE),
      eventos_oficiais (INSERT), operation_timeline_events (INSERT)

5.3 Teste C — atualizar_reversa (escrita, requer autorizacao)
    - Query: SELECT * FROM f_atualizar_reversa_app(
        'uuid-da-alocacao')
    - Riscos:
      a. Versao diferente da migration 133-D.2
      b. Auth nao cruza com prestadores.auth_user_id
      c. p_reversa_data_realizada e DATE (nao TIMESTAMPTZ)
      d. Modifica dados reais
    - REQUER AUTORIZACAO EXPRESSA DE ESCRITA
    - Tabela afetada: alocacoes_escala (UPDATE)

NOTA: Nenhum teste de escrita foi executado nesta missao.
      Aguardam autorizacao para FASE 4.B e 4.C.

6. FASE 5 — RECLASSIFICACAO DA MISSAO 133-D.2
────────────────────────────────────────────────────────────────

┌─────────────────────────────────────┬─────────────────────────┬──────────┐
│ Item                                │ Classificacao anterior  │ Novo     │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Correcao UUIDxTEXT                  │ ✅ Confirmado          │ 95%      │
│ f_buscar_operacoes_motorista        │                         │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Correcao UUIDxTEXT                  │ ⚠️ Confirmado          │ 80%      │
│ f_avancar_etapa_app_motorista       │ (volatility incorreta) │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Correcao UUIDxTEXT                  │ ❌ Nao se aplica       │ 0%       │
│ f_atualizar_reversa_app             │ (versao diferente      │          │
│                                     │  em producao)          │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Testado sem autenticacao            │ ✅ Confirmado          │ 100%     │
│ (retorno USUARIO_NAO_AUTENTICADO)   │ (3/3 RPCs)             │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Testado autenticado (leitura)       │ ✅ Confirmado          │ 100%     │
│                                     │ (f_buscar apenas)      │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Testado com escrita controlada      │ ❌ NAO EXECUTADO       │ 0%       │
│                                     │ (requer autorizacao)   │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Homologado ponta a ponta            │ ❌ NAO COMPROVADO      │ 0%       │
│ (App Motorista + TMS + Supabase)    │                         │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Logs sem 42883                      │ ✅ Confirmado          │ 100%     │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ Security grants corretos            │ ⚠️ Melhoravel         │ 40%      │
│ (anon/PUBLIC revogaveis)            │ (PUBLIC + anon)        │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ PERCENTUAL DA CORRECAO UUIDxTEXT    │ 92% (relatorio 133-D.2)│ 58%      │
│ (3 RPCs, ponderado)                 │                         │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ PERCENTUAL FUNCIONAL DAS RPCs       │ NAO DECLARADO          │ 35%      │
│ (leitura + escrita + grants)        │                         │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ PERCENTUAL DO APP PRESTADOR         │ NAO DECLARADO          │ 0%       │
│ (Flutter externo)                   │                         │          │
├─────────────────────────────────────┼─────────────────────────┼──────────┤
│ PERCENTUAL GERAL DO PROJETO         │ DIVERGENTE             │ 41%      │
│                                     92% (incorreto)          │ OFICIAL  │
└─────────────────────────────────────┴─────────────────────────┴──────────┘

O percentual de 92% atribuido na missao 133-D.2 referia-se APENAS
a correcao UUIDxTEXT de 2 das 3 funcoes, considerando apenas a
migration local, sem validacao remota completa.

O percentual geral oficial do projeto permanece 41%, conforme
documentado em auditorias anteriores (M003-M008, M136-C.2/QA0.2).

7. ANOMALIAS ENCONTRADAS
────────────────────────────────────────────────────────────────

┌──────┬────────────────────────────────────────────────┬──────────┐
│ ID   │ Descricao                                      │ Gravidade│
├──────┼────────────────────────────────────────────────┼──────────┤
│ A01  │ f_avancar_etapa_app_motorista marcada STABLE   │ Alta     │
│      │ mas contem UPDATE e INSERT. PostgreSQL pode    │          │
│      │ rejeitar execucao em versoes futuras, replicas  │          │
│      │ de leitura ou ambientes com regras restritivas. │          │
├──────┼────────────────────────────────────────────────┼──────────┤
│ A02  │ f_atualizar_reversa_app tem versao DIFERENTE   │ Alta     │
│      │ em producao. Autenticacao por auth.users em     │          │
│      │ vez de auth.uid(). p_reversa_fotos = jsonb      │          │
│      │ (era text[]). p_reversa_data_realizada = date   │          │
│      │ (era timestamptz). Provavel sobrescrita por      │          │
│      │ migration M119.                                 │          │
├──────┼────────────────────────────────────────────────┼──────────┤
│ A03  │ PUBLIC + anon tem EXECUTE em todas as 3 RPCs,   │ Media    │
│      │ inclusive nas 2 de escrita. Embora auth.uid()    │          │
│      │ interne bloqueie, a exposicao e desnecessaria.   │          │
├──────┼────────────────────────────────────────────────┼──────────┤
│ A04  │ Nenhum script de teste automatizado de escrita   │ Media    │
│      │ existe no repositorio TMS. Os scripts existentes │          │
│      │ sao apenas leitura ou validacao de schema.       │          │
├──────┼────────────────────────────────────────────────┼──────────┤
│ A05  │ f_buscar_operacoes_motorista tem grants PUBLIC   │ Baixa    │
│      │ mas e read-only e bloqueia internamente. Risco   │          │
│      │ baixo, mas defesa em profundidade recomenda      │          │
│      │ remocao.                                         │          │
└──────┴────────────────────────────────────────────────┴──────────┘

8. PROXIMOS PASSOS RECOMENDADOS
────────────────────────────────────────────────────────────────

Prioridade | Acao                                          | Missao
P0         | Corrigir volatility de f_avancar_etapa_app_    | 133-D.4
           | motorista: STABLE -> VOLATILE                  |
P0         | Alinhar f_atualizar_reversa_app remota com     | 133-D.4
           | a versao corrigida (auth.uid(), timestamptz,   |
           | text[])                                        |
P1         | REVOKE PUBLIC + anon EXECUTE das 3 RPCs        | 133-D.4
P2         | Testar isolamento entre prestadores em         | 133-D.5
           | f_buscar_operacoes_motorista                   |
P3         | Executar teste de escrita controlada em        | 133-D.6
           | ambiente homologado (nao producao)             |
P4         | Mapear callers Flutter (em missao propria      | Flutter
           | do App Motorista)                              |

9. CONCLUSAO
────────────────────────────────────────────────────────────────

CORRECAO UUID x TEXT CONFIRMADA — FLUXOS DE ESCRITA AINDA NAO
HOMOLOGADOS

A correcao UUIDxTEXT foi confirmada remotamente em 2 das 3 RPCs
(f_buscar_operacoes_motorista e f_avancar_etapa_app_motorista).

A terceira RPC (f_atualizar_reversa_app) esta em versao diferente
em producao, sobrescrita por migracao posterior.

Duas anomalias serias foram identificadas:
  1. Volatility STABLE em funcao com UPDATE/INSERT (A01)
  2. Versao divergente com autenticacao mais fraca (A02)

Grants de seguranca estao permissivos demais (PUBLIC + anon).

Nenhum teste de escrita foi executado. Nenhuma migracao foi aplicada.
Nenhum dado foi modificado.

Percentual geral oficial do projeto: 41%
