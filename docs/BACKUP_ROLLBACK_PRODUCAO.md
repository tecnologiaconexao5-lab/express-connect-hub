# Backup e Rollback — Produção (Supabase + Docker)

## 1. Backup do Supabase

### Via Dashboard (Recomendado)
1. Acessar https://supabase.com/dashboard → Project → Database → Backups
2. Clicar "Create Backup"
3. O backup inclui: schema, dados, functions, triggers, RLS policies
4. **Fazer sempre ANTES de rodar migrations**

### Via CLI
```bash
npx supabase db dump --local > backup_$(date +%Y%m%d_%H%M).sql
```

### Via SQL Editor
```sql
-- Backup de tabelas críticas
SELECT * FROM tenants;
SELECT * FROM tenant_usuarios;
SELECT * FROM ia_conectores;
```

## 2. Backup do .env

```bash
cp .env .env.backup.$(date +%Y%m%d)
# Armazenar em local seguro (cofre de senhas, não no repositório)
```

## 3. Rollback do App (Docker)

```bash
# 1. Parar container atual
docker stop tms

# 2. Iniciar versão anterior (última imagem estável)
docker run -d --name tms --restart always -p 80:80 express-connect-hub:anterior

# 3. Ou rebuildar a partir de tag git anterior
git checkout v1.0.0
docker build -t express-connect-hub:rollback .
docker stop tms && docker rm tms
docker run -d --name tms --restart always -p 80:80 express-connect-hub:rollback
```

### Tags Docker recomendadas
```bash
docker build -t express-connect-hub:latest .
docker tag express-connect-hub:latest express-connect-hub:$(date +%Y%m%d)
```

## 4. Rollback de Migrations Supabase

### Identificar migration problemática
```sql
-- Ver migrations aplicadas recentemente
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
```

### Reverter migration específica
```sql
-- Exemplo: reverter idempotency_key
ALTER TABLE ia_execucoes_conectores DROP COLUMN IF EXISTS idempotency_key;
DROP INDEX IF EXISTS idx_ia_execucoes_conectores_idempotency;
```

### Restaurar dump completo
```bash
# Se tudo falhar, restaurar backup completo
psql "$SUPABASE_DATABASE_URL" < backup_20260727.sql
```

## 5. Plano de Contingência

| Problema | Ação | Tempo Estimado |
|----------|------|---------------|
| Build quebrado | `git revert HEAD` + rebuild | 15min |
| Migration falhou | Reverter SQL manualmente | 10min |
| SSL expirado | `sudo certbot renew` | 5min |
| Container crashou | `docker restart tms` | 2min |
| Dados corrompidos | Restaurar backup Supabase | 30min |
| VM Oracle offline | Recriar VM + deploy | 2h |

## 6. Comandos Rápidos

```bash
# Backup Supabase via dashboard (link direto)
# https://supabase.com/dashboard/project/uwrvzsjtpgaifkktpepn/database/backups

# Rebuild + deploy rápido
git pull
docker build -t express-connect-hub .
docker stop tms && docker rm tms
docker run -d --name tms --restart always -p 80:80 express-connect-hub

# Logs do container
docker logs -f tms --tail 100

# Health check
curl http://localhost/health

# Testar nginx
docker exec tms nginx -t
```
