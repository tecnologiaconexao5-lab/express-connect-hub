# Backup e Rollback — Express Connect Hub / TMS

> **Missao:** 06 | **Data:** 2026-06-26

---

## 1. Backup do Supabase (Banco de Dados)

### Backup manual via Dashboard
1. Acessar Supabase Dashboard → Database → Backups
2. Clicar "Create Backup"
3. Aguardar conclusao
4. Fazer backup sempre ANTES de rodar migrations

### Backup via CLI
```bash
npx supabase db dump --local > backup_$(date +%Y%m%d).sql
```

---

## 2. Backup das Variaveis de Ambiente

```bash
# Copiar .env para local seguro
cp .env .env.backup.$(date +%Y%m%d)
```

Guardar em local separado (nao no repositorio Git).

---

## 3. Backup Antes de Migrations

```bash
# 1. Fazer dump do banco
npx supabase db dump > pre_migration_backup.sql

# 2. Rodar migration
npx supabase db push

# 3. Verificar
# Se algo quebrar, restaurar o dump
```

---

## 4. Rollback de Versao (Docker)

### Se deploy quebrar:
```bash
# Parar container atual
docker stop tms
docker rm tms

# Iniciar versao anterior
docker run -d --name tms --restart always -p 80:80 express-connect-hub:anterior
```

### Manter versao anterior sempre disponivel:
```bash
# Antes de fazer novo build, renomear imagem atual
docker tag express-connect-hub:latest express-connect-hub:anterior

# Fazer novo build
docker build -t express-connect-hub:latest .
```

---

## 5. Restaurar Banco de Dados

### Via Supabase Dashboard
1. Acessar Database → Backups
2. Selecionar backup desejado
3. Clicar "Restore"

### Via SQL (emergencia)
```bash
psql "$DATABASE_URL" < backup_20260626.sql
```

---

## 6. Procedimentos de Emergencia

| Problema | Acao Imediata |
|----------|--------------|
| Login falhou | Verificar se Supabase esta online. Verificar `.env` |
| Banco falhou | Restaurar backup mais recente. Verificar Supabase Dashboard |
| Nginx falhou | `docker restart tms` |
| Container nao sobe | `docker logs tms` → verificar erro. Rollback para versao anterior |
| Pagina em branco | F12 → Console. Verificar erros JavaScript. Verificar build |
| OS nao salva | Verificar RLS. Verificar logs do Supabase |
| Financeiro errado | Rodar `fn_conciliar_financeiro_os()`. Corrigir divergencias |

---

## 7. Frequencia de Backup

| Item | Frequencia |
|------|-----------|
| Supabase dump | Semanal (domingo) |
| .env backup | A cada alteracao |
| Antes de migration | Obrigatorio |
| Antes de deploy | Obrigatorio |

---

*Documento gerado para Missao 06 — OpenCode Go Pro*
