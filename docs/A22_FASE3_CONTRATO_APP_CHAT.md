# Contrato de Dados — Chat Operacional App Prestador ↔ Torre de Controle (FASE 3)

**Missão:** A22 — FASE 2 (backend + TMS/Torre) ✅ | **FASE 3** (integração App Flutter) — contrato de integração
**Data:** 2026-08-13
**Backend:** Migration `supabase/migrations/20260812_a22_chat_operacional.sql` aplicada em PRODUÇÃO
**App:** Flutter PWA externo (`prestador.conexaoexpress.com.br`) — a integração abaixo deve ser implementada pelo time Flutter

---

## Visão Geral

A FASE 2 (concluída) entregou no backend e no TMS/Torre:

1. Tabela `operacao_mensagens` (chat bidirecional por operação/alocação).
2. RPCs SECURITY DEFINER (escrita **somente via RPC**, nunca INSERT direto do cliente).
3. RLS: prestador lê **somente as próprias operações**; Torre lê todas.
4. Realtime: `operacao_mensagens` na publication `supabase_realtime`.
5. Notificação real para o App via `f_registrar_notificacao_app` quando a Torre responde.
6. Badge real de não-lidas na Topbar do TMS/Torre.

A FASE 3 consiste em o **App Prestador (Flutter)** consumir este contrato para:

- Listar mensagens da operação.
- Enviar mensagem para a Torre.
- Marcar como lidas as mensagens da Torre.
- Receber novas mensagens em tempo real (Realtime).
- Receber notificação quando a Torre responder.

---

## Autenticação

O App usa o mesmo Supabase Auth do TMS (`auth.uid()` identifica o usuário).
O backend resolve o prestador via `prestadores.auth_user_id = auth.uid()`.

**Importante:** o App **nunca** envia `prestador_id` como confiança — o backend resolve internamente.
Isso impede que um prestador grave mensagens em operação de outro.

---

## 1. Listar Mensagens da Operação

| Item | Valor |
|------|-------|
| Método | `supabase.from('operacao_mensagens').select('*')` |
| Filtro | `.eq('alocacao_id', <alocacao_id>)` |
| Ordenação | `.order('created_at', { ascending: true })` |
| Permissão | RLS `operacao_mensagens_select_prestador` — somente operações do próprio prestador |

### Campos retornados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID da mensagem |
| `alocacao_id` | UUID | Operação (alocação) vinculada |
| `os_id` | UUID \| null | OS vinculada |
| `prestador_id` | UUID \| null | Prestador da operação |
| `sender_type` | TEXT | `prestador` (App) ou `torre` (TMS) |
| `sender_user_id` | UUID \| null | Auth user que enviou |
| `mensagem` | TEXT | Conteúdo da mensagem (máx. 2000) |
| `status` | TEXT | `enviada` ou `lida` |
| `read_at` | TIMESTAMPTZ \| null | Quando foi lida |
| `idempotency_key` | TEXT \| null | Chave de idempotência |
| `metadata` | JSONB | Metadados extras (`{}` por padrão) |
| `created_at` | TIMESTAMPTZ | Data/hora do envio |

---

## 2. Enviar Mensagem do App → Torre

| Item | Valor |
|------|-------|
| Método | `supabase.rpc('f_enviar_mensagem_torre', {...})` |
| Função | `f_enviar_mensagem_torre(p_alocacao_id uuid, p_mensagem text, p_idempotency_key text DEFAULT NULL)` |
| Retorno | JSONB |

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `p_alocacao_id` | UUID | SIM | Operação (alocação) de destino |
| `p_mensagem` | TEXT | SIM | Conteúdo (1–2000 caracteres) |
| `p_idempotency_key` | TEXT | RECOMENDADO | Evita mensagem duplicada em re-tentativa |

### Retorno (JSONB)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `success` | BOOLEAN | `true` em sucesso |
| `mensagem_id` | UUID | ID da mensagem criada (ou duplicada) |
| `duplicada` | BOOLEAN | `true` se `idempotency_key` já existia |
| `created_at` | TIMESTAMPTZ | Data/hora do envio |
| `error` | TEXT | Código do erro quando `success=false` |

### Códigos de erro

| Código | Significado |
|--------|-------------|
| `USUARIO_NAO_AUTENTICADO` | Sem sessão |
| `PRESTADOR_NAO_VINCULADO` | auth.uid() não resolve prestador ativo/liberado |
| `ALOCACAO_NAO_ENCONTRADA` | Alocação inexistente |
| `ALOCACAO_OUTRO_PRESTADOR` | Operação não pertence ao prestador |
| `ALOCACAO_INATIVA` | Operação cancelada/recusada |
| `MENSAGEM_VAZIA` | Mensagem em branco |
| `MENSAGEM_MUITO_LONGA` | Acima de 2000 caracteres |

### Idempotência

- Se `idempotency_key` for fornecida e já existir uma mensagem `prestador` com ela,
  a RPC **não duplica**: retorna `{success: true, duplicada: true, mensagem_id: <id>}`.
- Gere a chave no App como `<timestamp>-<uuid>` (mesmo padrão do TMS).

---

## 3. Marcar Mensagens da Torre como Lidas (App)

| Item | Valor |
|------|-------|
| Método | `supabase.rpc('f_marcar_mensagens_lidas_app', {...})` |
| Função | `f_marcar_mensagens_lidas_app(p_alocacao_id uuid)` |
| Retorno | `{"success":true,"atualizadas":N}` |

- Marca como `lida` todas as mensagens `sender_type='torre'` e `status='enviada'` da operação.
- Somente o prestador da operação pode executar.

---

## 4. Realtime — Receber Novas Mensagens

```dart
// Supabase Realtime (semelhante ao TMS):
supabase
  .channel('operacao-mensagens-<alocacao_id>')
  .onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'operacao_mensagens',
    filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'alocacao_id', value: '<alocacao_id>'),
    callback: (payload) => onNovaMensagem(payload.newRecord),
  )
  .subscribe();
```

- Evento `INSERT` em `operacao_mensagens` filtrado por `alocacao_id`.
- O App deve atualizar a thread de conversa em tempo real.
- O payload é um registro completo (mesmos campos da seção 1).

---

## 5. Notificação quando a Torre Responder

A RPC `f_responder_mensagem_torre` (executada pelo TMS/Torre) gera automaticamente
uma notificação real para o App via `f_registrar_notificacao_app(...)`:

- `titulo`: "Nova mensagem da Torre"
- `corpo`: primeiros 120 caracteres da mensagem
- `tipo`: `operacao_mensagem`
- `referencia`: `alocacao_id`

O App consome a notificação pela mesma infraestrutura de `portal_notificacoes`
que já usa hoje (RLS `pn_select_own` corrigida na migration A22, escopada ao prestador real).

---

## 6. Contador de Não Lidas (opcional para o App)

| Item | Valor |
|------|-------|
| Método | `supabase.rpc('f_contar_mensagens_nao_lidas_torre')` |
| Observação | **Exclusivo da Torre/TMS** (retorna 0 para prestador/anon). Para o App, compute localmente as mensagens `torre` com `status='enviada'` via consulta RLS (seção 1) + Realtime. |

---

## 7. Restrições de Segurança

- **Escrita somente via RPC** SECURITY DEFINER. Não há políticas INSERT/UPDATE/DELETE em `operacao_mensagens`.
- **RLS SELECT**:
  - Prestador: `EXISTS (SELECT 1 FROM prestadores p WHERE p.auth_user_id = auth.uid() AND p.id = prestador_id)`.
  - Torre: `EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())`.
- **Sem `USING(true)`** em `operacao_mensagens` (isolamento real entre prestadores).
- Nenhum INSERT direto com `prestador_id` arbitrário é permitido.
- A migration A22 também corrigiu o isolamento de `portal_notificacoes` (policies SELECT-true removidas).

---

## 8. Migration e Referências

| Item | Arquivo |
|------|---------|
| Migration aplicada | `supabase/migrations/20260812_a22_chat_operacional.sql` |
| Rollback | `supabase/migrations/20260812_a22_chat_operacional_rollback.sql` |
| Service TMS (referência) | `src/services/operacaoChatService.ts` |
| Aba Mensagens (Torre) | `src/components/torre-controle/ChatOperacaoPanel.tsx` |
| Badge Topbar | `src/components/AppTopbar.tsx` |

---

## 9. Checklist de Implementação (App Flutter — FASE 3)

- [ ] Listar mensagens da operação (`supabase.from('operacao_mensagens')` + RLS).
- [ ] Enviar mensagem (`f_enviar_mensagem_torre`) com `idempotency_key` em re-tentativas.
- [ ] Marcar como lidas (`f_marcar_mensagens_lidas_app`).
- [ ] Realtime `INSERT` filtrado por `alocacao_id`.
- [ ] Consumir notificação `operacao_mensagem` via `portal_notificacoes`.
- [ ] Exibir autor da mensagem pelo `sender_type` (`prestador` = "Você", `torre` = "Torre").
- [ ] Indicador de não lidas (mensagens `torre` com `status='enviada'`).
- [ ] Tratar códigos de erro da RPC (`ALOCACAO_OUTRO_PRESTADOR`, etc.).
- [ ] Nunca enviar `prestador_id` como confiança; usar apenas sessão autenticada.
- [ ] Validar contra PRODUÇÃO apenas em homologação com dados de teste marcados HML.
