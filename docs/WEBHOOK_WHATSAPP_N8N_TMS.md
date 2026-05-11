# Webhook WhatsApp — Arquitetura TMS Conexão Express

## Visão Geral

O TMS Conexão Express é um frontend Vite/React e **não pode receber webhooks HTTP diretamente**.
O Evolution API precisa de um endpoint HTTP para enviar eventos de mensagem.

Existem duas opções de arquitetura seguras:

---

## Opção A — Evolution → n8n → Supabase (RECOMENDADA agora)

```
WhatsApp ──► Evolution API (Docker :8080)
                  │
                  │ POST /webhook (evento de mensagem)
                  ▼
             n8n (:5678)
                  │
                  │ Upsert conversa + Insert mensagem
                  ▼
            Supabase (PostgreSQL)
                  │
                  │ Leitura via supabase-js
                  ▼
             TMS Frontend (React)
```

**Vantagens:**
- Sem backend adicional
- n8n já está rodando localmente
- Supabase como fonte de verdade
- TMS lê direto do Supabase em tempo real (ou com polling)

**Configuração no Evolution API:**
```
Server URL: http://127.0.0.1:8080
Webhook URL: http://localhost:5678/webhook/recrutamento-whatsapp
Events: MESSAGES_UPSERT, CONNECTION_UPDATE
```

---

## Opção B — Evolution → Backend Futuro → Supabase

```
WhatsApp ──► Evolution API (Docker :8080)
                  │
                  │ POST /webhook
                  ▼
           Backend (Node/Express/FastAPI)
                  │ Valida, trata, salva
                  ▼
            Supabase (PostgreSQL)
                  │
                  ▼
             TMS Frontend (React)
```

**Quando usar:** quando n8n não estiver disponível ou precisar de lógica complexa.

---

## Modelo de Payload — Evolution API (MESSAGES_UPSERT)

```json
{
  "event": "messages.upsert",
  "instance": "recrutamento-conexao-express",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "ABCD1234567890"
    },
    "message": {
      "conversation": "Olá, quero me cadastrar como motorista"
    },
    "messageType": "conversation",
    "messageTimestamp": 1746123456,
    "pushName": "João Silva"
  }
}
```

---

## Payload que o n8n deve inserir no Supabase

### 1. Upsert em `whatsapp_conversas`

```sql
INSERT INTO whatsapp_conversas (telefone, nome_contato, tipo_origem, status, ultima_mensagem, ultima_interacao)
VALUES ('5511999999999', 'João Silva', 'recrutamento', 'aberta', 'Olá, quero me cadastrar', now())
ON CONFLICT (telefone) DO UPDATE SET
  ultima_mensagem = EXCLUDED.ultima_mensagem,
  ultima_interacao = EXCLUDED.ultima_interacao,
  nome_contato = COALESCE(EXCLUDED.nome_contato, whatsapp_conversas.nome_contato);
```

> **Atenção:** para usar `ON CONFLICT (telefone)` adicione constraint única:
> `ALTER TABLE whatsapp_conversas ADD CONSTRAINT uq_wc_telefone UNIQUE (telefone);`

### 2. Insert em `whatsapp_mensagens`

```json
{
  "conversa_id": "<uuid da conversa acima>",
  "telefone": "5511999999999",
  "direcao": "recebida",
  "mensagem": "Olá, quero me cadastrar como motorista",
  "tipo_mensagem": "text",
  "raw_payload": { "...payload completo do Evolution..." },
  "status": "recebida"
}
```

---

## Configuração no n8n (Workflow Manual)

1. **Webhook Node** — POST `/recrutamento-whatsapp`
2. **Set Node** — extrair: `telefone`, `nome`, `mensagem`, `tipo`, `timestamp`
3. **Supabase Node ou HTTP Request** — upsert conversa
4. **Supabase Node ou HTTP Request** — insert mensagem
5. **Respond to Webhook** — HTTP 200 `{"ok": true}`

Veja o arquivo `docs/n8n_recrutamento_whatsapp_workflow_exemplo.json` para importar direto no n8n.

---

## Variáveis de Ambiente Necessárias

```bash
# .env (TMS Frontend)
VITE_EVOLUTION_SERVER_URL=http://127.0.0.1:8080
VITE_EVOLUTION_INSTANCE=recrutamento-conexao-express
VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/recrutamento-whatsapp
VITE_GROQ_API_KEY=gsk_...
VITE_GEMINI_API_KEY=AIza...
```

---

## Telas no TMS

| Rota                    | Descrição                                    |
|-------------------------|----------------------------------------------|
| `/integracoes`          | Configuração e teste de todas as integrações |
| `/mensagens-whatsapp`   | Lista e resposta de conversas WhatsApp       |
| `/configuracoes?tab=central-integracoes` | Central de integrações existente |

---

## Status das Tabelas Supabase

Execute `sql/integracoes_whatsapp_ia.sql` no Supabase SQL Editor:
- `integracoes_config` — config das integrações
- `whatsapp_instancias` — instâncias Evolution
- `whatsapp_conversas` — conversas ativas
- `whatsapp_mensagens` — histórico de mensagens
- `ia_logs` — logs de chamadas IA
