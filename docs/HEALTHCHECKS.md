# Healthchecks — Monitoramento

## Endpoints de Saúde

### Frontend (Vercel)
| Check | URL | Expectativa |
|-------|-----|-------------|
| Página carrega | `https://tms.conexaoexpress.com.br` | HTTP 200 |
| Assets JS | `https://tms.conexaoexpress.com.br/assets/index-*.js` | HTTP 200 |
| SPA Route | `https://tms.conexaoexpress.com.br/central-ia` | HTTP 200 (index.html) |

### Oracle Containers

| Check | Comando | OK |
|-------|---------|----|
| Docker geral | `docker ps --format "{{.Names}} {{.Status}}"` | Todos "Up" / "healthy" |
| Redis | `redis-cli ping` | PONG |
| Evolution API | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/manager` | 200 |
| n8n | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz` | 200 |
| Disco | `df -h / \| tail -1` | < 80% |
| Memória | `free -m \| awk '/Mem/{print $3/$2 * 100}'` | < 85% |
| CPU | `top -bn1 \| grep "Cpu(s)"` | < 80% |

## Script de Monitoramento

Arquivo sugerido: `/opt/tms/scripts/healthcheck.sh`
```bash
#!/bin/bash

# Config
WEBHOOK_SLACK="<SLACK_WEBHOOK_URL>"   # Se tiver
ALERT_EMAIL="ti@conexaoexpress.com.br"
LOG_FILE="/var/log/tms_healthcheck.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() {
  echo "[$DATE] $1" >> "$LOG_FILE"
}

alert() {
  local msg="$1"
  log "ALERTA: $msg"
  # Slack (se configurado)
  if [ -n "$WEBHOOK_SLACK" ]; then
    curl -s -X POST -H "Content-type: application/json" \
      -d "{\"text\":\"🚨 TMS: $msg\"}" "$WEBHOOK_SLACK" > /dev/null
  fi
}

# 1. Docker
if ! docker ps --format "{{.Names}}" > /dev/null 2>&1; then
  alert "Docker não está rodando"
  exit 1
fi

# 2. Evolution API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/manager 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  alert "Evolution API retornou $HTTP_CODE"
  docker restart evolution_api
fi

# 3. n8n
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  alert "n8n retornou $HTTP_CODE"
  docker restart n8n
fi

# 4. Redis
if ! redis-cli ping > /dev/null 2>&1; then
  alert "Redis não respondeu ping"
  docker restart oracle_redis
fi

# 5. Disco
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
  alert "Disco em $DISK_USAGE% — limpeza necessária"
fi

# 6. Frontend Vercel
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://tms.conexaoexpress.com.br 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  alert "Frontend TMS retornou $HTTP_CODE (Vercel)"
fi

log "Healthcheck OK"
```

## Automatização (cron)

```cron
# /etc/cron.d/tms_healthcheck
# Executar a cada 5 minutos
*/5 * * * * root /opt/tms/scripts/healthcheck.sh

# Backup diário 03:00
0 3 * * * root /opt/tms/scripts/backup_producao.sh
```

## Dashboard de Saúde

Sugestão para UI do TMS (future):
- Card "Status Oracle" (verde/vermelho)
- Card "Vercel Deploy" (último deploy + status)
- Card "Supabase" (conexão + tamanho banco)
- Card "Evolution API" (conexões ativas)
- Último healthcheck: timestamp
- Próximo backup: timestamp

## Healthchecks.io (recomendado)

Criar conta em https://healthchecks.io e configurar:

| Check | Intervalo | Grace | Método |
|-------|-----------|-------|--------|
| Oracle VM | 5min | 15min | `curl https://hc-ping.com/<UUID>` no cron |
| Vercel | 10min | 30min | Incoming webhook |
| Supabase | Diário 03:00 | 6h | `curl` após backup |
