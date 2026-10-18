# Plano Oracle — Serviços 24h (VM Leve)

## Cenário Atual

- VM: VM.Standard.E2.1.Micro (sempre-free Oracle)
- RAM: 1 GB
- CPU: 1 OCPU (AMD EPYC)
- Armazenamento: 50 GB (boot volume + block volume opcional)
- SO: Ubuntu 22.04 LTS

> ⚠️ **Limitação:** 1 GB de RAM inviabiliza rodar TMS (Node + Vite) + n8n + Evolution + Redis simultaneamente. Decisão: Oracle NÃO hospeda o frontend TMS.

## Serviços que CABEM em 1 GB RAM

| Serviço | RAM Estimada | Porta | Docker? | Essencial? |
|---------|-------------|-------|---------|------------|
| n8n | 200-300 MB | 5678 | ✅ Sim | ✅ Automação |
| Evolution API | 150-250 MB | 8080 | ✅ Sim | ✅ WhatsApp |
| Redis | 30-50 MB | 6379 | ✅ Sim | ✅ Cache/Fila |
| Nginx (proxy reverso) | 20-30 MB | 80/443 | ✅ Sim | ⚠️ Opcional |
| Workers robôs (TS) | 100-200 MB | - | ❌ Não | ⚠️ Opcional |
| **Total estimado** | **~800 MB** | | | |

> Margem de ~200 MB livre para picos. Suficiente para operação estável.

## Docker Compose Consolidado

```yaml
# docker-compose.yml — Oracle VM
version: "3.8"
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_HOST=tms.conexaoexpress.com.br
      - DB_TYPE=sqlite
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n_data:/home/node/.n8n

  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution
    restart: always
    ports:
      - "8080:8080"
    environment:
      - API_KEY=${EVOLUTION_API_KEY}
      - DATABASE_ENABLED=true
      - DATABASE_CONNECTION_URI=sqlite:///evolution/evolution.db
    volumes:
      - evolution_data:/evolution

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data

volumes:
  n8n_data:
  evolution_data:
  redis_data:
```

## Deploy Passo a Passo

```bash
# 1. Instalar Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker && sudo systemctl start docker

# 2. Criar diretório
mkdir -p /opt/conexao-connect && cd /opt/conexao-connect

# 3. Criar .env
cat > .env << 'EOF'
N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
EVOLUTION_API_KEY=sua-api-key-aqui
EOF

# 4. Salvar docker-compose.yml (acima)
nano docker-compose.yml

# 5. Iniciar serviços
sudo docker compose up -d

# 6. Verificar
sudo docker compose ps
sudo docker compose logs --tail 20

# 7. Health check
curl http://localhost:5678/healthz
curl http://localhost:8080/manager
curl -s -o /dev/null -w "%{http_code}" http://localhost:6379
```

## Plano Futuro — Upgrade para A1.Flex

Quando a VM.Standard.A1.Flex estiver disponível na conta:
- 4 OCPUs + 24 GB RAM (gratuito)
- Permite rodar o TMS completo + todos os serviços + sobra
- Reavaliar se vale mover o frontend para Oracle ou manter Vercel

## Monitoramento

```bash
# Script simples de health check
cat > /opt/healthcheck.sh << 'SCRIPT'
#!/bin/bash
echo "$(date) - Health Check"
curl -s -o /dev/null -w "n8n: %{http_code}\n" http://localhost:5678/healthz
curl -s -o /dev/null -w "Evolution: %{http_code}\n" http://localhost:8080/manager
echo "---"
SCRIPT
chmod +x /opt/healthcheck.sh

# Cron a cada 5 minutos
crontab -e
*/5 * * * * /opt/healthcheck.sh >> /var/log/healthcheck.log 2>&1
```
