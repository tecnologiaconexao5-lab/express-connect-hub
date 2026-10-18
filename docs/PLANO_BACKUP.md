# Plano de Backup — Produção

## Frequência

| Dado | Frequência | Método | Retenção | Resp. |
|------|-----------|--------|----------|-------|
| Supabase (banco) | Diária 03:00 BRT | pg_dump remoto | 7 dias | Automático |
| Supabase (storage) | Semanal | Supabase CLI | 30 dias | Manual |
| Oracle (containers) | Semanal | docker commit/export | 14 dias | Manual |
| Oracle (volumes) | Semanal | tar.gz + Oracle Backup | 14 dias | Automático |
| Vercel (build) | Por deploy | Git (histórico) | Indeterminado | Git |
| Secrets (.env) | A cada mudança | Vault/cofre | Sempre | Gestor |

## Script de Backup Supabase

Arquivo: `scripts/backup_producao.sh`
```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/supabase"
DATE=$(date +%Y%m%d_%H%M)
DB_URL="$SUPABASE_DB_URL"

# Backup completo
pg_dump "$DB_URL" \
  --file="$BACKUP_DIR/full_$DATE.sql" \
  --format=custom \
  --verbose \
  --no-owner

# Backup dados (sem schema)
pg_dump "$DB_URL" \
  --file="$BACKUP_DIR/data_$DATE.sql" \
  --data-only \
  --verbose

# Comprimir
gzip "$BACKUP_DIR/full_$DATE.sql"
gzip "$BACKUP_DIR/data_$DATE.sql"

# Limpar backups > 7 dias
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completo: $DATE"
```

## Script de Backup Oracle

```bash
#!/bin/bash
BACKUP_DIR="/backups/oracle"
DATE=$(date +%Y%m%d_%H%M)

mkdir -p "$BACKUP_DIR"

# Export volumes Docker
docker run --rm -v oracle_network:/data \
  -v "$BACKUP_DIR:/backup" alpine \
  tar czf "/backup/volumes_$DATE.tar.gz" -C /data .

# Export docker-compose config
cp /opt/tms/docker-compose.production.yml "$BACKUP_DIR/"

# Comprimir
gzip "$BACKUP_DIR/volumes_$DATE.tar.gz"

# Limpar > 14 dias
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +14 -delete

echo "Backup Oracle: $DATE"
```

## Restauração

### Supabase

```bash
# Restaurar full backup
pg_restore \
  --db-url "$SUPABASE_DB_URL" \
  --clean \
  --if-exists \
  "backup_supabase_20260727.dump"

# Restaurar apenas dados
psql "$SUPABASE_DB_URL" < backup_data_20260727.sql
```

### Oracle Volumes
```bash
# Parar containers
docker compose -f docker-compose.production.yml down

# Restaurar volumes
docker run --rm \
  -v oracle_network:/data \
  -v /backups:/backup alpine \
  tar xzf "/backup/volumes_20260727.tar.gz" -C /data

# Subir containers
docker compose -f docker-compose.production.yml up -d
```

### Vercel Rollback
```bash
# Git revert
git revert HEAD --no-edit
git push origin main
# Vercel deploy automático
```

## Monitoramento de Backups

| Alerta | Quando | Ação |
|--------|--------|------|
| Backup não executou | 04:00 BRT | Verificar cron + script |
| Backup muito pequeno | < 1MB | Verificar pg_dump |
| Disco cheio | > 90% | Limpar backups antigos |
| Restore não testado | > 30 dias | Fazer restore test |
