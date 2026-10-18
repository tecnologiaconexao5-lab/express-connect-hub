# TMS-031 — HOMOLOGAÇÃO APP ⇄ TMS (Relatório de Entrega)

**Data:** 2026-08-01
**Ambiente:** PRODUÇÃO (sem alterações de banco além do vínculo autorizado)
**Vínculo:** `prestadores.auth_user_id` atualizado → `7cc4bb3d-225b-4169-911b-0fff8439efca`

## Resultado da Homologação

| Item | Resultado | Evidência |
|------|:---------:|-----------|
| Login (`infraestruturaconexao@gmail.com`) | ✅ **OK** | Home carregada com nome do prestador |
| Prestador reconhecido | ✅ **OK** | App resolveu `prestadores?auth_user_id=eq.7cc4bb3d-…` → `e6646799-…` (PRESTADOR TESTE APP) |
| Home carregada | ✅ **OK** | "Boa noite, PRESTADOR TESTE APP", status Online |
| Perfil | ⚠️ Parcial | Aba "Meu Perfil" abre; conteúdo de veículo não renderizou no dump (Flutter canvas) |
| Veículo | ⚠️ Parcial | Não confirmado no dump do Perfil |
| Sincronização | ✅ OK | Dados carregados via REST (`prestadores`, `alocacoes_escala` status 200) |
| Operações encontradas | ✅ 3 pendentes | Rotas em validação (incl. HML Guarulhos→São Paulo) |
| Aceite | ❌ **NOK (RLS)** | Ver diagnóstico abaixo |
| Torre | ⏸️ Não executado | Bloqueado pelo aceite |
| Timeline | ⏸️ Não executado | Bloqueado pelo aceite |
| GPS | ⏸️ Não executado | Bloqueado pelo aceite |
| Evidências | ⏸️ Não executado | Bloqueado pelo aceite |
| POD | ⏸️ Não executado | Bloqueado pelo aceite |
| Finalização | ⏸️ Não executado | Bloqueado pelo aceite |

## Diagnóstico do Aceite (Erro 403 RLS)

Ao confirmar o aceite no App, o fluxo disparou:

```
PATCH /rest/v1/alocacoes_escala?id=eq.01fc1dce-…&prestador_id=eq.e6646799-…
  → 403 42501: "new row violates row-level security policy for table historico_alocacoes_escala"
```

**Cadeia do problema:**
1. App autentica como `7cc4bb3d-…` e faz UPDATE em `alocacoes_escala` (permitido pela policy "Prestador can update own alocacoes" — `prestadores.auth_user_id`).
2. O trigger `trg_registrar_historico_alocacao` (função `registrar_historico_alocacao()`, **SECURITY INVOKER** — padrão) dispara `INSERT INTO historico_alocacoes_escala`.
3. A tabela `historico_alocacoes_escala` possui APENAS policy `hae_insert_tms` (migration `20260801_m06_rls_remaining_tables.sql:916`), que exige `tenant_usuarios.user_id = auth.uid()`.
4. O usuário do App é prestador (está em `prestadores.auth_user_id`), **não** em `tenant_usuarios` → INSERT negado → transação rollback → status permanece `aguardando_aceite`.

**Não é erro de `driver_profiles`.** O vínculo `prestadores.auth_user_id` está funcionando corretamente (o App resolveu o prestador e o UPDATE passou).

**Causa raiz:** `historico_alocacoes_escala` não possui policy INSERT para prestadores (apenas TMS via `tenant_usuarios`). Em contraste, `alocacoes_escala` tem "Prestador can update own alocacoes".

## Ações executadas
- Nenhuma escrita fora do vínculo autorizado.
- `driver_profiles` **não alterado**.
- Nenhuma migration, RPC, trigger ou RLS alterados.

## Próxima ação recomendada
1. **Aguardar autorização** para criar migration RLS adicionando policy INSERT em `historico_alocacoes_escala` para prestadores autenticados:
   ```sql
   CREATE POLICY "hae_insert_prestador" ON public.historico_alocacoes_escala
     FOR INSERT TO authenticated
     WITH CHECK (
       EXISTS (SELECT 1 FROM prestadores WHERE auth_user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
     );
   ```
2. Após aplicação, repetir a homologação: aceite → Timeline → Torre → GPS → evidências → POD → finalização.

## Arquivos de evidência (não versados)
- `test-results/tms031/homologacao/*.json` e `*.png`
- `test-results/tms031/homologacao/rede-aceite.json` (rede do aceite, sem tokens)
