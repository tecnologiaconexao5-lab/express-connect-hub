# Rollback — Plano de Contingência

## 1. Frontend (Vercel)

### Gatilho
Erro crítico identificado no deploy atual (build quebrado, rota 404, login falha).

### Procedimento

```bash
# Opção 1 — Dashboard Vercel (mais rápido)
Vercel Dashboard → Project → Deployments
→ Identificar último deploy estável
→ ⋮ → "Promote to Production" (≤ 30s)

# Opção 2 — Git revert
git log --oneline -5
git revert <hash_do_deploy_problema> --no-edit
git push origin main
# Aguardar Vercel detectar e fazer deploy (~2min)

# Opção 3 — Vercel CLI
npx vercel deploy --prod --force
```

### Verificação
```bash
curl -sI https://tms.conexaoexpress.com.br | head -5
# Deve retornar 200
```

## 2. Oracle Containers

### Gatilho
Container falhando, serviço indisponível após atualização.

### Procedimento

```bash
# Identificar versão anterior
docker images
docker ps -a

# Rollback Evolution API
docker stop evolution_api
docker rm evolution_api
docker run -d \
  --name evolution_api \
  --network oracle_network \
  -p 8080:8080 \
  --restart always \
  evoapicloud/evolution-api:<VERSAO_ANTERIOR>
# OU: docker compose -f docker-compose.production.yml down && git revert e docker compose up -d

# Rollback completo (parar + restaurar compose anterior)
git log --oneline -5
git revert HEAD --no-edit
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Verificação
```bash
docker ps                    # Todos "healthy"
docker logs evolution_api    # Sem erros
curl http://localhost:8080/manager
curl http://localhost:5678/healthz
redis-cli ping               # PONG
```

## 3. Supabase

### Gatilho
Migration causou perda de dados, quebra de RLS, erro em trigger.

### Procedimento

```bash
# Restaurar backup
pg_restore \
  --db-url "$SUPABASE_DB_URL" \
  --clean \
  --if-exists \
  "backup_supabase_pre_deploy.dump"

# OU: CLI
npx supabase db restore backup_supabase_pre_deploy.dump

# Remover migration problemática
npx supabase migration repair --status reverted <migration_name>
```

### Verificação
```bash
# Testar query
curl -X POST https://uwrvzsjtpgaifkktpepn.supabase.co/rest/v1/rpc/check_health
npx supabase db diff
```

## 4. Banco Local (se aplicável)

```bash
pg_restore \
  -h localhost \
  -U postgres \
  -d tms \
  --clean \
  --if-exists \
  backup_local_pre_producao.sql
```

## Matriz de Decisão

| Cenário | Tempo Rollback | Impacto | Ação |
|---------|---------------|---------|------|
| SPA/UI quebrada | 30s | Médio | Vercel Promote |
| API Oracle fora | 2min | Alto | Oracle git revert |
| Migration errada | 5min | Alto | Supabase restore |
| Chave API exposta | 1min | Crítico | Rotacionar + redeploy |
| Container loop | 3min | Médio | docker restart + logs |

## Quem Aciona

| Problema | Quem aciona | Contato |
|----------|------------|---------|
| Frontend quebrado | Gestor de TI | WhatsApp/Slack |
| Oracle indisponível | DevOps | SSH + WhatsApp |
| Supabase fora | Gestor de TI | Supabase Dashboard |
| WhatsApp parou | Suporte TMS | WhatsApp interno |
| Segurança | Diretor TI | Imediato |
