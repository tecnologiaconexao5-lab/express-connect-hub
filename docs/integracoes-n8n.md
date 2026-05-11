# Documentação: Integrações TMS via N8N

Esta documentação descreve o padrão arquitetural de integração entre o **TMS Express Connect Hub** e serviços externos, utilizando o **N8N** como middleware de segurança.

## Princípio de Segurança (Zero Secrets no Frontend)
Por ser uma aplicação baseada em PWA e SPA (React/Vite), o código-fonte executado no navegador **não deve** conter tokens sensíveis como:
- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `EVOLUTION_API_KEY`
- `ZOHO_CLIENT_SECRET`

**Toda comunicação com APIs sensíveis deve ser feita via N8N.** O frontend chamará apenas Webhooks públicos configurados no N8N.

### Onde colocar as chaves (API Keys)
- As chaves como a **Evolution API Key** ou **Groq API Key** devem ser colocadas **EXCLUSIVAMENTE nos "Credentials" (ou Headers dos nós HTTP) dentro do N8N**.
- O frontend (TMS) fará requests apenas para a URL pública do seu Webhook N8N sem enviar secrets no corpo.

## Ambiente de Hospedagem
- **Momento Atual:** O N8N será rodado localmente (`http://localhost:5678`) para homologação e desenvolvimento dos fluxos.
- **Momento Futuro:** O N8N será hospedado em VPS/Cloud (ex: HostGator) ou via N8N Cloud, passando a responder em domínio HTTPS (ex: `https://n8n.expressconnect.com.br/webhook/...`).

## Fluxos Mapeados no TMS

### 1. WhatsApp Recrutamento
A comunicação entre o prestador no WhatsApp e a IA do TMS é 100% intermediada pelo N8N.

#### WORKFLOW 1: Mensagem Recebida do WhatsApp (Evolution → N8N → Supabase Edge Function)
1. O prestador envia mensagem no WhatsApp.
2. A Evolution API dispara um webhook para o N8N.
3. O N8N recebe a requisição e faz um **HTTP Request (POST)** para a Edge Function do Supabase.
   - **URL da Edge Function:** `https://[PROJECT_REF].supabase.co/functions/v1/whatsapp-recrutamento-webhook`
   - **Cabeçalho (Header):** Incluir no N8N o cabeçalho `Authorization: Bearer [SUPABASE_ANON_KEY]` (se a função exigir JWT) ou liberar CORS.
4. **Exemplo de Payload de ENTRADA (n8n → Edge Function):**
   ```json
   {
     "telefone": "5511999999999",
     "nome": "João Silva",
     "mensagem": "Quero me cadastrar, qual o valor da rota?",
     "origem": "whatsapp"
   }
   ```
5. A Edge Function processa a mensagem, verifica bloqueios com `SUPABASE_SERVICE_ROLE_KEY` e devolve a resposta final via JSON.
6. **Exemplo de Payload de SAÍDA (Edge Function → n8n):**
   ```json
   {
     "ok": true,
     "resposta": "Seu cadastro ainda está em análise. Assim que for aprovado, nossa equipe avisará sobre as oportunidades disponíveis.",
     "conversa_id": "uuid...",
     "assumir_manual": false
   }
   ```

#### WORKFLOW 2: Envio de Resposta ao WhatsApp (Edge Function → N8N → Evolution)
1. O N8N recebe a resposta final da Edge Function do Supabase.
2. O N8N formata a resposta no padrão exigido pela Evolution API (ex: `{"number": "5511999999999", "text": "..."}`).
3. O N8N dispara um HTTP Request POST para a Evolution API. Neste nó HTTP do N8N, a `apikey` da Evolution deve ser inserida no Header.

### 2. Automação Comercial CRM
Responsável por reagir quando um Lead avança ou retrocede no funil.
- **TMS chama:** `VITE_N8N_WEBHOOK_COMERCIAL_AUTOMACAO`
- **N8N Processa:** Envia alertas no Slack/Teams ou atualiza um CRM externo.
- **Payload Base:**
  ```json
  {
    "leadId": "uuid-aqui",
    "acao": "mudanca_etapa",
    "dadosAdicionais": { "etapa": "Em Negociação" }
  }
  ```

### 3. Zoho Email
Responsável pelo envio seguro de e-mails transacionais (ex: Aprovação de OS, Boas-vindas Prestador).
- **TMS chama:** `VITE_N8N_WEBHOOK_ZOHO_EMAIL`
- **N8N Processa:** Autentica com o Zoho Mail API (`ZOHO_CLIENT_SECRET`) e dispara a mensagem.
- **Payload Base:**
  ```json
  {
    "to": "cliente@email.com",
    "subject": "Sua OS foi aprovada",
    "body": "Corpo do e-mail"
  }
  ```

## Serviço `n8nClient.ts`
Toda chamada que SAIA do TMS para o N8N deve importar as funções do `src/services/n8nClient.ts`.
Este arquivo possui regras de:
1. Validação de formato de URL.
2. Controle de tempo-limite (timeout de 15 segundos).
3. Catch genérico para problemas de CORS.
4. Retorno padronizado no formato `N8NResponse` `{ ok, status, data, error }`.

*Não utilize a API nativa `fetch()` diretamente nas telas para chamadas aos webhooks.*
