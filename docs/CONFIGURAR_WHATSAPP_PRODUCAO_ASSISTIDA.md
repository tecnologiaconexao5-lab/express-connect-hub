# Configurar WhatsApp — Modo Produção Assistida

## Visão Geral

O WhatsApp é usado pelos funcionários digitais (robôs IA) para:
- Notificações de OS (criada, em rota, entregue)
- Follow-up comercial com leads
- Comunicação com prestadores e motoristas
- Alertas operacionais

## Provedor: Evolution API

O sistema usa a **Evolution API** como gateway WhatsApp.
- Repositório: https://github.com/EvolutionAPI/evolution-api
- Documentação: https://doc.evolution-api.com/

## Pré-requisitos

1. Servidor Evolution API rodando (Docker ou cloud)
2. Instância criada no Evolution API
3. API Key configurada
4. QR Code escaneado (WhatsApp conectado)

## Passo 1: Instalar Evolution API

### Docker (recomendado)

```yaml
# docker-compose.yml
services:
  evolution:
    image: atendai/evolution-api:latest
    ports:
      - "8080:8080"
    environment:
      AUTHENTICATION_TYPE: "apikey"
      AUTHENTICATION_API_KEY: "sua-api-key-aqui"
    volumes:
      - evolution_data:/evolution/instances
```

```bash
docker-compose up -d
```

### Cloud (Evolution API gerenciado)

Altere `VITE_EVOLUTION_API_URL` para a URL fornecida pelo provedor.

## Passo 2: Criar Instância

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apiKey: sua-api-key" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "conexao-express"}'
```

## Passo 3: Conectar WhatsApp

### Opção 1 — Pelo sistema (buscar QR code)

Pelo **Central IA > Conectores > WhatsApp**, use a ação `buscar_qrcode`.

### Opção 2 — Pela API direta

```bash
curl -X GET "http://localhost:8080/instance/connect/conexao-express" \
  -H "apiKey: sua-api-key"
```

Escaneie o QR code com o WhatsApp do celular.

## Passo 4: Configurar .env

```env
# Modo: homologacao (simulado) | assistido | producao
VITE_WHATSAPP_MODE=homologacao

# Evolution API
VITE_EVOLUTION_API_URL=http://localhost:8080
VITE_EVOLUTION_API_KEY=sua-api-key
VITE_EVOLUTION_INSTANCE_NAME=conexao-express

# Limites de segurança (para modo assistido/producao)
VITE_WHATSAPP_ALLOWED_SETORES=operacional,comercial
VITE_WHATSAPP_DAILY_LIMIT=50
VITE_WHATSAPP_ALLOWED_HOURS_START=08:00
VITE_WHATSAPP_ALLOWED_HOURS_END=18:00
```

## Passo 5: Testar Conexão

Pelo **Central IA > Conectores**:
1. Encontre `CON_EVOLUTION_WHATSAPP`
2. Clique em **Testar conexão real**
3. Deve retornar: "Conectado à Evolution API. Instâncias: X"

Teste de envio simples:

```bash
curl -X POST "http://localhost:8080/message/sendText/conexao-express" \
  -H "apiKey: sua-api-key" \
  -H "Content-Type: application/json" \
  -d '{"number": "5511999999999", "text": "Teste de conexão TMS", "delay": 1200}'
```

## Passo 6: Ativar Modo Assistido

```env
VITE_WHATSAPP_MODE=assistido
```

Em modo **assistido**:
- O sistema tenta enviar mensagem real via Evolution API
- Valida setor permitido (`VITE_WHATSAPP_ALLOWED_SETORES`)
- Valida horário permitido (`VITE_WHATSAPP_ALLOWED_HOURS_START/END`)
- Valida limite diário (`VITE_WHATSAPP_DAILY_LIMIT`)
- Se falhar, marca como **pendente**
- A operação principal **não quebra**

## Fallback Manual

Se o WhatsApp falhar:

1. A mensagem fica marcada como `pendente` no log
2. O operador pode copiar o texto e enviar manualmente pelo WhatsApp
3. O log contém: destinatário, mensagem, motivo do erro

Para mensagens urgentes em modo assistido:
- O erro retorna o texto completo da mensagem
- Basta copiar e colar no WhatsApp Web

## Limites de Segurança

| Flag | Padrão | Descrição |
|------|--------|-----------|
| `VITE_WHATSAPP_ALLOWED_SETORES` | `operacional` | Setores que podem enviar WhatsApp |
| `VITE_WHATSAPP_DAILY_LIMIT` | `50` | Máximo de mensagens/dia |
| `VITE_WHATSAPP_ALLOWED_HOURS_START` | `08:00` | Horário inicial permitido |
| `VITE_WHATSAPP_ALLOWED_HOURS_END` | `18:00` | Horário final permitido |

## Segurança

- **API Key nunca é logada**
- Token fica apenas no `.env` ou em `credenciais` do conector
- Em modo `homologacao`, **nenhuma** chamada externa é feita
- Números não autorizados são bloqueados
- Conteúdo é validado (termos proibidos)

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `Falha de rede` | Evolution API offline | Verificar `docker ps` |
| `401` | API Key inválida | Verificar `VITE_EVOLUTION_API_KEY` |
| `404` | Instância não existe | Criar instância via API |
| QR code não aparece | Instância já conectada | Verificar `status_conexao` |
| Mensagem não enviada | WhatsApp desconectado | Escanear QR code novamente |
| `Fora do horário` | Horário não permitido | Aguardar ou ajustar `VITE_WHATSAPP_ALLOWED_HOURS` |
| `Limite diário` | Atingiu cota | Aguardar ou aumentar `VITE_WHATSAPP_DAILY_LIMIT` |
