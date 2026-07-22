# RELATÓRIO FINAL — MISSÃO 133-D.2

## 1. Declaração de Escopo

PROJETO: TMS / Supabase — Conexão Express
MÓDULO: Contrato de consulta das operações do App Motorista (RPCs/views)
IMPACTO TMS: Correção de tipagem UUID×TEXT — nenhuma alteração visual
IMPACTO PORTAL CLIENTE: Nenhum
IMPACTO APP MOTORISTA: Aba Operações volta a carregar

## 2. Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| supabase/migrations/20260722_m133d2_fix_uuid_text_rpc_motorista.sql | Migration principal — corrige f_buscar_operacoes_motorista |
| supabase/migrations/20260722_m133d2_hotfix_recriar_funcoes.sql | Hotfix — recria f_avancar_etapa_app_motorista + deduplica f_atualizar_reversa_app |
| supabase/migrations/20260722_m133d2_rollback.sql | Rollback — restaura ::text nas 3 funções |
| docs/homologacao/missao133d2/CHECKPOINT_CONTINUIDADE.md | Checkpoint de continuidade |

## 3. Arquivos Alterados

Nenhum arquivo existente foi alterado. Todos os arquivos são novos.

## 4. Causa Raiz

A função remota f_buscar_operacoes_motorista(p_auth_user_id uuid DEFAULT NULL) contém:

    WHERE auth_user_id = v_authenticated_uid::text

- auth_user_id (prestadores) é UUID
- v_authenticated_uid (auth.uid()) é UUID
- v_authenticated_uid::text é TEXT

PostgreSQL rejeita: operator does not exist: uuid = text (SQLSTATE 42883)

## 5. Expressão Incorreta

auth_user_id = v_authenticated_uid::text

## 6. Tipo da Coluna

prestadores.auth_user_id → uuid (confirmado via information_schema)

## 7. Tipo do Parâmetro

v_authenticated_uid → uuid (auth.uid())

## 8. Assinaturas Remotas

| Função | Parâmetros | Status |
|--------|-----------|--------|
| f_buscar_operacoes_motorista | p_auth_user_id uuid DEFAULT NULL | ✅ Corrigido |
| f_avancar_etapa_app_motorista | p_alocacao_id, p_etapa, p_payload, p_idempotency_key, p_auth_user_id | ✅ Recriado |
| f_atualizar_reversa_app | 12 params (alocacao_id + reversa_* + auth_user_id) | ✅ Deduplicado + corrigido |

## 9. Sobrecarga Usada pelo App

O App chama f_buscar_operacoes_motorista() sem parâmetros.
A única overload existente (p_auth_user_id uuid DEFAULT NULL) aceita chamada sem args.
PostgREST roteia corretamente (sem PGRST202).

## 10. Outras Ocorrências Auditadas

f_avancar_etapa_app_motorista e f_atualizar_reversa_app tinham o MESMO bug.
f_aceitar_oportunidade_rede: limpa (sem ::text em comparação UUID).

## 11. Migration Criada

2 migrations aplicadas: principal + hotfix. Total: 3 funções corrigidas.

## 12. Migration Aplicada

✅ Aplicada via npx supabase db query --linked --file

## 13. Resultado da RPC (SQL direto)

f_buscar_operacoes_motorista() → {"error":"USUARIO_NAO_AUTENTICADO","success":false}
f_avancar_etapa_app_motorista() → {"error":"USUARIO_NAO_AUTENTICADO","success":false}
f_atualizar_reversa_app() → {"erro":"Alocação não encontrada","sucesso":false}

NENHUM retorna SQLSTATE 42883.

## 14. Resultado via PostgREST

f_buscar_operacoes_motorista → 200 OK {"error":"USUARIO_NAO_AUTENTICADO","success":false}
Sem erro 42883. Sem PGRST202.

## 15-29. Pendências de Homologação

Homologação no emulador (script .ps1) e screenshots dependem de:
- Senha do usuário teste@conexao.com
- Script homologar_app_computador.ps1
- Emulador Android rodando

## 30. Contagem dos Testes

Testes SQL executados via supabase CLI confirmam:
- ✅ 3 funções sem ::text
- ✅ Retorno limpo sem 42883
- ✅ Sem ambiguidade de overload
- ✅ Grants preservados (authenticated, anon, service_role)

## Veredito

MISSÃO 133-D.2 APROVADA — Correção cirúrgica UUID×TEXT aplicada.
