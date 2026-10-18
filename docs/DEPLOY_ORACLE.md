# Deploy Oracle — Serviços 24h

## Pré-requisitos

| Item | Requisito |
|------|-----------|
| VM | Oracle Cloud (Ampere A1, Ubuntu 22.04+, 4 OCPU, 24GB RAM) |
| Docker | v24+ instalado |
| Docker Compose | v2.20+ instalado |
| Portas liberadas | 8080, 5678, 6379 |
| Git | clonado do repo |

## Setup Inicial

```bash
# 1. Acessar VM
ssh -i ~/.ssh/oracle_key opc@<IP_ORACLE>

# 2. Instalar dependências
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git curl jq

# 3. Clonar repositório
git clone https://github.com/tecnologiaconexao5-lab/express-connect-hub.git /opt/tms
cd /opt/tms

# 4. Configurar .env
cp .env.example .env
nano .env
# Preencher: EVOLUTION_API_KEY, N8N_ENCRYPTION_KEY, etc.

# 5. Subir serviços
docker compose -f docker-compose.production.yml up -d

# 6. Verificar
docker ps
docker compose -f docker-compose.production.yml logs --tail=20
```

## Variáveis de Ambiente Obrigatórias (.env)

| Variável | Exemplo | Obrigatória? |
|----------|---------|-------------|
| `EVOLUTION_API_KEY` | `minha-chave-secreta` | ✅ |
| `EVOLUTION_DB_PASSWORD` | `evolution_pass` | ✅ |
| `N8N_ENCRYPTION_KEY` | `chave-32-caracteres-aqui` | ✅ |
| `N8N_HOST` | `api.conexaoexpress.com.br` | ❌ (default) |
| `CORS_ORIGIN` | `https://tms.conexaoexpress.com.br` | ❌ (default *) |

## Healthchecks

```bash
# Todos os serviços
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Evolution API
curl http://localhost:8080/manager
# Esperado: {"status":"OK"} (ou JSON similar)

# n8n
curl http://localhost:5678/healthz
# Esperado: {"status":"ok"}

# Redis
redis-cli ping
# Esperado: PONG
```

## Scripts Úteis

### Restart limpo
```bash
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs --tail=30 -f
```

### Logs
```bash
docker logs evolution_api --tail 50
docker logs n8n --tail 50
docker logs oracle_redis --tail 20
```

### Limpeza
```bash
# Remover containers parados
docker container prune -f

# Remover imagens não usadas
docker image prune -a -f

# Remover logs antigos
sudo journalctl --vacuum-time=7d
```

## Troubleshooting

| Problema | Sintoma | Solução |
|----------|---------|---------|
| Evolution nao sobe | `healthcheck` falha | Verificar postgres (DATABASE_CONNECTION_URI), aguardar 60s |
| n8n nao sobe | `wget` timeout | Aguardar 60s (start_period), verificar volume |
| Redis erro | `redis-cli ping` timeout | `docker restart oracle_redis` |
| Porta ocupada | `address already in use` | `netstat -tulpn \| grep 8080` |
| Watchtower loop | Containers reiniciando | Verificar `WATCHTOWER_SCHEDULE` |
| Evolution lenta | QR Code demora | Verificar internet + CPU da VM |
| n8n db corrompido | Erro SQLite | Parar, remover volume, subir de novo |

## Manutenção

### Atualização manual (sem Watchtower)
```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

### Backup manual
```bash
tar czf "backup_containers_$(date +%Y%m%d).tar.gz" \
  -C /var/lib/docker volumes/
```
