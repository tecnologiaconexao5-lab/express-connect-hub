# Integração WhatsApp — Evolution API + n8n

## Arquitetura

```
┌──────────────┐    HTTP 8080    ┌──────────────────┐    WebSocket    ┌───────────┐
│   Manager    │ ──────────────► │  Evolution API   │ ◄────────────── │ WhatsApp  │
│  (Frontend)  │                 │   v2.3.7 (Baileys)│                 │  (Baileys)│
└──────────────┘                 └────────┬─────────┘                 └───────────┘
                                          │
                                    Webhook POST
                                          ▼
                                  ┌──────────────────┐
                                  │       n8n        │
                                  │  (automações)    │
                                  └──────────────────┘
```

## Stack

| Serviço          | Imagem                           | Porta  | Banco       |
|------------------|----------------------------------|--------|-------------|
| **Evolution API**| `evoapicloud/evolution-api:v2.3.7`| `8080` | PostgreSQL  |
| **n8n**          | `n8nio/n8n`                      | `5679` | PostgreSQL  |
| **PostgreSQL**   | `postgres:16-alpine`             | `5432` | —           |
| **Redis**        | `redis:7-alpine`                 | `6379` | —           |

## Pré-requisitos

- Docker Desktop instalado e rodando
- PowerShell 5.1+
- Windows (scripts .ps1)
- Celular com WhatsApp para escanear o QR Code

## Inicialização Rápida

### 1. Limpar dados antigos e subir tudo do zero

```powershell
cd docker/evolution-api
.\cleanup.ps1 -Force   # remove containers, volumes, sessions
.\start.ps1            # sobe tudo e cria instância "tms"
```

### 2. Escanear o QR Code

Após o script `start.ps1`, abra o arquivo `qr-tms.html` (raiz do projeto) no navegador e escaneie o QR Code com o WhatsApp do celular:

```
Configurações do WhatsApp > Aparelhos conectados > Conectar um aparelho
```

### 3. (Alternativa) Fazer manualmente

```powershell
# Sobe os containers
docker-compose -f docker-compose.yml up -d

# Aguarda saudável
docker logs tms_evolution -f

# Cria instância
curl -X POST http://localhost:8080/instance/create `
  -H "apikey: 123456" `
  -H "Content-Type: application/json" `
  -d '{"instanceName":"tms","integration":"WHATSAPP-BAILEYS"}'

# Conecta (gera QR Code)
curl http://localhost:8080/instance/connect/tms -H "apikey: 123456"
```

### 4. Verificar status

```powershell
curl http://localhost:8080/instance/connectionState/tms -H "apikey: 123456"
# Esperado: {"instance":{"instanceName":"tms","state":"open"}}
```

## IMPORTANTE: O Problema do v2.2.3 e a Correção

**Problema original:** A Evolution API v2.2.3 (`atendai/evolution-api:latest`) tinha um bug no endpoint `/instance/connect/{name}`, que SEMPRE retornava `{"count":0}` mesmo com a instância criada corretamente. O endpoint `/instance/qrcode/{name}` também retornava `404`.

Este bug é confirmado na issue oficial [#2380](https://github.com/evolution-foundation/evolution-api/issues/2380) do repositório Evolution API.

**Solução:** Trocar para `evoapicloud/evolution-api:v2.3.7`, que corrigiu o bug do QR Code. Esta imagem é mantida oficialmente pela Evolution Foundation.

## Variáveis de Ambiente Críticas

| Variável                          | Valor                    | Obrigatória | Motivo                                  |
|-----------------------------------|--------------------------|-------------|-----------------------------------------|
| `SERVER_TYPE`                     | `http`                   | **SIM**     | Habilita o servidor HTTP + QR Code      |
| `CONFIG_SESSION_PHONE_CLIENT`     | `Chrome`                 | **SIM**     | Identifica o browser para o Baileys     |
| `CONFIG_SESSION_PHONE_NAME`       | `Chrome`                 | **SIM**     | Nome do dispositivo no Baileys          |
| `QRCODE_LIMIT`                    | `30`                     | **SIM**     | Limite de tentativas de QR Code         |
| `DATABASE_SAVE_DATA_INSTANCE`     | `true`                   | **SIM**     | Persiste estado da instância no banco   |
| `CORS_ORIGIN`                     | `*`                      | **SIM**     | Permite chamadas do frontend            |
| `DEL_INSTANCE`                    | `true`                   | Não         | Permite deletar instância via API       |
| `WEBHOOK_GLOBAL_ENABLED`          | `true`                   | Não         | Envia mensagens recebidas para o n8n    |
| `WEBHOOK_GLOBAL_URL`              | `http://n8n:5678/...`    | Não         | URL do webhook do n8n                   |

### Env var que NÃO pode faltar (v2.2+):
```
SERVER_TYPE=http
```
Sem ela, a Evolution API não inicializa o servidor HTTP corretamente e o QR Code nunca é gerado.

## API — Endpoints Principais

### Criar instância (OBRIGATÓRIO incluir `integration`)
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: 123456" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"tms","integration":"WHATSAPP-BAILEYS"}'
```
> **Nota:** Em v2.2+, o campo `integration` é obrigatório. Sem ele, a API retorna `400 Invalid integration`.

### Conectar (gerar QR Code)
```bash
curl http://localhost:8080/instance/connect/tms -H "apikey: 123456"
```
Retorna o QR Code em base64 PNG no campo `base64`.

### Status da instância
```bash
curl http://localhost:8080/instance/connectionState/tms -H "apikey: 123456"
```
- `"state":"connecting"` — aguardando escanear QR Code
- `"state":"open"` — conectado (pronto para usar)
- `"state":"close"` — desconectado

### Listar instâncias
```bash
curl http://localhost:8080/instance/fetchInstances -H "apikey: 123456"
```

### Enviar mensagem de texto
```bash
curl -X POST http://localhost:8080/message/sendText/tms \
  -H "apikey: 123456" \
  -H "Content-Type: application/json" \
  -d '{"number":"5511912133010","text":"Teste Evolution TMS"}'
```

### Deletar instância
```bash
curl -X DELETE http://localhost:8080/instance/delete/tms -H "apikey: 123456"
```

## Solução de Problemas

### `GET /instance/connect/tms` retorna `{"count":0}`

**Causa:** Bug no Evolution API v2.2.3 (endpoint de conexão quebrado).

**Solução:** Use `evoapicloud/evolution-api:v2.3.7` em vez de `atendai/evolution-api:latest`.

### `POST /instance/create` retorna `400 Invalid integration`

**Causa:** Corpo da requisição sem o campo `integration`.

**Solução:** Adicione `"integration":"WHATSAPP-BAILEYS"` no JSON.

### Instância fica `state:"connecting"` para sempre

**Causa:** QR Code não foi escaneado.

**Solução:** Abra `qr-tms.html` no navegador e escaneie com o WhatsApp.

### Instância fica `state:"close"`

**Causas prováveis:**
1. QR Code expirou (escaneie novamente)
2. Sessão foi desconectada do WhatsApp
3. Celular perdeu conexão com a internet

**Solução:**
1. Delete: `DELETE /instance/delete/tms`
2. Recrie: `POST /instance/create`
3. Reconecte: `GET /instance/connect/tms`
4. Escaneie o QR Code novamente

### Container reinicia em loop

Verifique os logs:
```bash
docker logs tms_evolution --tail 100
```

Causas comuns:
- PostgreSQL não está saudável (`depends_on` mal configurado)
- `DATABASE_CONNECTION_URI` aponta para banco errado
- Porta `8080` já está em uso

## Comandos Úteis

```powershell
# Logs
docker logs tms_evolution -f
docker logs tms_n8n -f
docker logs tms_postgres -f

# Executar bash no container
docker exec -it tms_evolution sh

# Ver volumes
docker volume ls | findstr tms

# Parar tudo
docker-compose -f docker-compose.yml down

# Parar e remover volumes
docker-compose -f docker-compose.yml down -v
```

## Fluxo de Recuperação Total

Se tudo quebrar, execute:

```powershell
cd docker/evolution-api
.\cleanup.ps1 -Force
.\start.ps1
```

Isso remove **todos** os dados (banco, cache, sessões, instâncias) e sobe do zero.

## Histórico

| Data       | Versão | Descrição                                      |
|------------|--------|------------------------------------------------|
| 2026-05-12 | 2.0    | Correção: troca para v2.3.7, env vars críticas |
| 2026-05-12 | 1.0    | Documentação inicial                           |
