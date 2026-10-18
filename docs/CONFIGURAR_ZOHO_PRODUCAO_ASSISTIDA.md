# Configurar Zoho Mail — Modo Produção Assistida

## Visão Geral

O Zoho Mail é usado pelos funcionários digitais (robôs IA) para enviar e-mails automáticos:
- Follow-up comercial
- Notificações operacionais
- Boletos e cobranças
- Propostas e orçamentos

## Pré-requisitos

1. Conta Zoho Mail ativa (ex: `contato@conexaoexpress.com.br`)
2. Acesso ao Zoho API Console: https://api-console.zoho.com/
3. Acesso ao arquivo `.env` do servidor

## Passo 1: Obter Credenciais OAuth2

### 1.1 Criar Client no Zoho API Console

1. Acesse https://api-console.zoho.com/
2. Clique em **Add Client**
3. Escolha **Server-based Application**
4. Nome: `Conexao Express TMS`
5. Redirect URI: `https://tms.suaempresa.com.br/zoho/callback`
6. Anote o **Client ID** e **Client Secret**

### 1.2 Gerar Refresh Token

Use o script automático:

```bash
npx tsx scripts/zoho_setup_oauth.ts
```

Ou manualmente, gere um `authorization_code` via URL:

```
https://accounts.zoho.com/oauth/v2/auth?
  scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&
  client_id={CLIENT_ID}&
  response_type=code&
  access_type=offline&
  redirect_uri=https://tms.suaempresa.com.br/zoho/callback
```

Troque o `code` por `refresh_token`:

```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "code={AUTHORIZATION_CODE}" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "redirect_uri=https://tms.suaempresa.com.br/zoho/callback" \
  -d "grant_type=authorization_code"
```

### 1.3 Obter Account ID

```bash
curl -X GET https://mail.zoho.com/api/accounts \
  -H "Authorization: Zoho-oauthtoken {ACCESS_TOKEN}"
```

O `accountId` é um número (ex: `123456789`).

## Passo 2: Configurar .env

Adicione ao `.env`:

```env
# Modo: homologacao (simulado) | assistido | producao
VITE_ZOHO_MODE=homologacao

# OAuth2
VITE_ZOHO_CLIENT_ID=1000.xxxxx
VITE_ZOHO_CLIENT_SECRET=xxxxx
VITE_ZOHO_REFRESH_TOKEN=1000.xxxxx
VITE_ZOHO_ACCOUNT_ID=123456789
VITE_ZOHO_DATA_CENTER=mail.zoho.com
VITE_ZOHO_EMAIL_FROM=contato@conexaoexpress.com.br
```

## Passo 3: Testar Conexão

Pelo **Central IA > Conectores**:
1. Encontre `CON_ZOHO_EMAIL`
2. Clique em **Testar conexão real**
3. Deve retornar: "Conectado ao Zoho Mail (account {id})"

## Passo 4: Ativar Modo Assistido

```env
VITE_ZOHO_MODE=assistido
```

Em modo **assistido**:
- O sistema tenta enviar e-mail real via API Zoho
- Se falhar (rede, token inválido, etc.), marca como **pendente**
- A operação principal **não quebra**
- O erro é registrado em `ia_execucoes_conectores`

## Passo 5: Verificar Logs

Acesse **Central IA > Logs** para ver:
- `conector_concluido` — e-mail enviado com sucesso
- `conector_falhou` — erro no envio (com detalhes)
- No resultado: `pendente: true` se precisa de retentativa

## Fallback Manual

Se o Zoho falhar:
1. O e-mail fica marcado como `pendente` no log
2. O usuário pode copiar o conteúdo e enviar manualmente
3. Para reenviar, mude `VITE_ZOHO_MODE=producao` e tente novamente

## E-mails por Robô

Cada robô pode ter seu remetente configurado:

```sql
UPDATE automacoes_robos
SET config = jsonb_set(config, '{email,from}', '"comercial@conexaoexpress.com.br"')
WHERE nome LIKE '%Comercial%';
```

Ordem de resolução do remetente:
1. `payload.from` (chamada direta)
2. `automacoes_robos.config.email.from`
3. Credenciais do conector
4. `VITE_ZOHO_EMAIL_FROM`
5. `contato@conexaoexpress.com.br` (fallback final)

## Segurança

- **Tokens OAuth2 nunca são logados**
- `VITE_ZOHO_CLIENT_SECRET` e `VITE_ZOHO_REFRESH_TOKEN` ficam apenas no `.env`
- Access token é mantido apenas em memória cache (não persiste)
- Em modo `homologacao`, **nenhuma** chamada externa é feita

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `OAuth2 não configurado` | Credenciais ausentes | Preencher `.env` |
| `access_token não retornado` | Refresh token inválido | Regenerar OAuth2 |
| `401 Unauthorized` | Token expirou | O provider renova automaticamente |
| `403 Forbidden` | Sem permissão | Verificar escopos no Zoho API Console |
| Falha de rede | Zoho inacessível | Verificar firewall/proxy |
