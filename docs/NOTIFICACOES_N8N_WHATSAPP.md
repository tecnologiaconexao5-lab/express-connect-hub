# Notificacoes Cliente — n8n + WhatsApp/Email

> **Missao:** 10 | **Data:** 2026-06-26

---

## 1. Como a Fila Funciona

1. Quando uma OS muda de status, o trigger `trg_notificar_status_os` cria automaticamente um registro em `portal_notificacoes` com `status_envio = 'pendente'`
2. A view `vw_notificacoes_pendentes` expoe todas as notificacoes aguardando envio
3. O n8n (ou outro worker) consulta a view periodicamente e envia as notificacoes
4. Apos envio, atualiza `status_envio` para `'enviado'` ou `'erro'`

---

## 2. Workflow n8n (Exemplo)

### Trigger: Schedule (a cada 2 minutos)
```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "rule": { "interval": [{ "field": "minutes", "minutesInterval": 2 }] }
}
```

### Step 1: Buscar Pendentes (Supabase Query)
```sql
SELECT * FROM vw_notificacoes_pendentes LIMIT 10
```

### Step 2: Para cada notificacao — Enviar Email
- Se `canal = 'email'` e `cliente_email` existe → enviar via SMTP/Zoho
- Atualizar status:
```sql
UPDATE portal_notificacoes 
SET status_envio = 'enviado', enviado_em = now(), tentativas = tentativas + 1
WHERE id = '{{id}}'
```

### Step 3: Para cada notificacao — Enviar WhatsApp
- Se `canal = 'whatsapp'` e `cliente_telefone` existe → enviar via Evolution API
- Evolution API endpoint: `POST /message/sendText`
```json
{
  "number": "{{cliente_telefone}}",
  "text": "{{titulo}}\n\n{{mensagem}}"
}
```
- Atualizar status (mesmo SQL do Step 2)

### Step 4: Tratar Erros
Se envio falhar (3+ tentativas):
```sql
UPDATE portal_notificacoes 
SET status_envio = 'erro', erro_envio = 'Falha apos 3 tentativas', tentativas = tentativas + 1
WHERE id = '{{id}}'
```

---

## 3. Como Configurar Evolution API

```env
VITE_EVOLUTION_API_URL=https://seu-server.evolution.com
VITE_EVOLUTION_API_KEY=sua-chave-api
VITE_WHATSAPP_PRODUCAO_ENABLED=true
```

---

## 4. Como Testar

1. Criar/atualizar uma OS com status diferente
2. Verificar `portal_notificacoes` — deve ter registro com `status_envio = 'pendente'`
3. Rodar workflow n8n manualmente
4. Verificar se status mudou para `'enviado'`

---

## 5. Seguranca

- View `vw_notificacoes_pendentes` expoe apenas dados necessarios
- Service role key usada APENAS no n8n (backend), nunca no frontend
- Cliente so ve notificacoes do proprio `cliente_id` (RLS)
- Mensagens nao incluem dados financeiros ou internos

---

*Documento gerado para Missao 10 — OpenCode Go Pro*
