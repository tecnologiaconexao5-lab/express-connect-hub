# DOCUMENTAÇÃO N8N — ENVIO DE DOCUMENTOS FISCAIS CT-e

## 1. Webhook

**URL configurada no Supabase Secret:** `FISCAL_EMAIL_WEBHOOK`

**Método:** POST
**Content-Type:** application/json

## 2. Payload recebido pelo n8n

```json
{
  "to": ["cliente@exemplo.com"],
  "cc": [],
  "subject": "Documentos fiscais CT-e — Romaneio 294929 — Calvo",
  "body": "Prezados, segue em anexo...",
  "romaneio": "294929",
  "lote_id": "LOTE-...",
  "modulo": "fiscal",
  "cte_ids": ["uuid1", "uuid2"],
  "total_ctes": 2,
  "anexos": [
    {
      "nome_arquivo": "CTe-3526....xml",
      "tipo": "xml",
      "content_type": "application/xml",
      "storage_path": "cte/homologacao/2026/06/{id}/xml-{chave}.xml",
      "signed_url": "https://.../signed-url...",
      "signed_url_temporaria": true,
      "expires_in": 600,
      "cte_id": "uuid1",
      "chave_acesso": "3526...."
    },
    {
      "nome_arquivo": "DACTE-3526....pdf",
      "tipo": "dacte",
      "content_type": "application/pdf",
      "storage_path": "cte/homologacao/2026/06/{id}/dacte-{chave}.pdf",
      "signed_url": "https://.../signed-url...",
      "signed_url_temporaria": true,
      "expires_in": 600,
      "cte_id": "uuid1",
      "chave_acesso": "3526...."
    }
  ],
  "instrucao": "Use as signed_urls ABAIXO para baixar os arquivos e anexa-los ao e-mail. NAO encaminhe as URLs ao cliente. As URLs expiram em 10 minutos."
}
```

## 3. Fluxo n8n recomendado

### Passo 1: Webhook (Trigger)
- Tipo: Webhook
- Método: POST
- Response Mode: Last Node

### Passo 2: Para cada anexo (Loop)
- SplitInBatches ou Item Lists
- Para cada `item` em `anexos`:

### Passo 3: HTTP Request — Baixar arquivo
- Método: GET
- URL: `{{ $json.signed_url }}`
- Response Format: File
- Options: Binary Data (activate)

### Passo 4: Montar anexo
- Agregar os arquivos baixados em um array de attachments
- Formato SendGrid/Resend ou SMTP nativo

### Passo 5: Enviar e-mail
- Provedor: Zoho / SMTP / SendGrid / Resend
- To: `{{ $('Webhook').item.json.body.to }}`
- Subject: `{{ $('Webhook').item.json.body.subject }}`
- Body: `{{ $('Webhook').item.json.body.body }}`
- Attachments: array montado no passo anterior

### Passo 6: Response ao TMS
```json
{
  "ok": true,
  "provider": "zoho",
  "message_id": "msg_abc123",
  "enviados_para": ["cliente@exemplo.com"],
  "anexos_enviados": [
    { "nome_arquivo": "CTe-3526....xml", "tipo": "xml", "cte_id": "uuid1" },
    { "nome_arquivo": "DACTE-3526....pdf", "tipo": "dacte", "cte_id": "uuid1" }
  ]
}
```

## 4. Regras críticas

1. **NUNCA encaminhar signed_url ao cliente** — as URLs expiram em 10 minutos
2. **Sempre baixar o arquivo** via HTTP Request no n8n antes de anexar
3. **Sempre anexar XML e PDF** como arquivos binários no e-mail
4. **Responder ao TMS** com o formato acima para que o sistema registre o envio
5. **Se falhar:** retornar `{ ok: false, error: "mensagem" }`

## 5. Tratamento de erro no n8n

Se o download de algum anexo falhar:
- Não enviar o e-mail
- Retornar erro ao TMS
- Opcional: notificar administrador

## 6. Secrets no Supabase

| Secret | Descrição |
|--------|-----------|
| `FISCAL_EMAIL_WEBHOOK` | URL do webhook n8n |
| `FISCAL_EMAIL_FROM` | Remetente do e-mail (opcional) |

## 7. Credenciais no n8n

Configuradas diretamente no n8n (nunca no Supabase Secrets):
- SMTP host/port/user/pass
- SendGrid API key
- Zoho credentials
- Resend API key
