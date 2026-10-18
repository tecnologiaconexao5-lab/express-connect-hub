# Checklist Oracle — Go Live

## 1. VM

- [ ] Oracle Cloud Ampere A1 ativa (4 OCPU, 24GB RAM)
- [ ] Ubuntu 22.04+ instalado
- [ ] SSH funcional (`ssh -i ~/.ssh/oracle_key opc@<IP>`)
- [ ] Portas 8080, 5678, 6379 liberadas no Security List
- [ ] Disco ≥ 100GB (para volumes + logs)

## 2. Docker

- [ ] Docker Engine v24+ instalado
- [ ] Docker Compose v2.20+ instalado
- [ ] `docker ps` funcional (sem sudo?)
- [ ] Repositório clonado em `/opt/tms`

## 3. Docker Compose

- [ ] `docker-compose.production.yml` presente
- [ ] `.env` configurado com todas as variáveis
- [ ] `docker compose up -d` sem erros
- [ ] Todos os containers com status "Up" e "healthy"

## 4. Evolution API

- [ ] Container `evolution_api` rodando
- [ ] Healthcheck: `curl http://localhost:8080/manager` → 200
- [ ] Banco evolution-postgres saudável
- [ ] Redis evolution-redis saudável
- [ ] QR Code gerado (se necessário escanear)
- [ ] Log sem erros críticos (`docker logs evolution_api --tail 50`)

## 5. Redis

- [ ] Container `oracle_redis` rodando
- [ ] `redis-cli ping` → PONG
- [ ] Persistência AOF ativa
- [ ] Log sem warnings

## 6. n8n

- [ ] Container `n8n` rodando
- [ ] Healthcheck: `curl http://localhost:5678/healthz` → `{"status":"ok"}`
- [ ] Workflows importados (se houver)
- [ ] Credenciais configuradas no n8n
- [ ] Webhooks expostos (se necessário)

## 7. Watchtower

- [ ] Container `watchtower` rodando
- [ ] Schedule configurado: `0 0 4 * * *` (04:00 BRT)
- [ ] Cleanup ativo
- [ ] Logs sem erros

## 8. Healthchecks

- [ ] Script de healthcheck `5min` implementado
- [ ] Alerta Slack configurado (webhook)
- [ ] Healthchecks.io configurado (recomendado)
- [ ] Disco monitorado (< 85%)
- [ ] Memória monitorada (< 85%)
- [ ] CPU monitorada (< 80%)

## 9. Backup

- [ ] Backup diário dos volumes configurado
- [ ] Retenção de 7-14 dias
- [ ] Script de restore validado

## 10. Verificação Final

```bash
docker ps
docker compose -f docker-compose.production.yml logs --tail=20
curl http://localhost:8080/manager
curl http://localhost:5678/healthz
redis-cli ping
df -h /
free -m
```
