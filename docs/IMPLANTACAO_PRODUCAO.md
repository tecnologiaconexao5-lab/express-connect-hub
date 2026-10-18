# Implantação em Produção — Passo a Passo

> Tempo estimado: **30min** (com labuta e DNS)

## Pré-implantação

```bash
# 1. Backups obrigatórios
npx supabase db dump --data-only --file supabase/backup_pre_producao.sql
pg_dump -h localhost -U postgres tms > backup_local_pre_producao.sql

# 2. Typecheck + Build
npm run typecheck        # 0 erros
npm run build            # Build limpo
ls -la dist/             # Diretório com index.html, assets/

# 3. Ensaio local
npm run preview          # Acessar http://localhost:8800 (configurado na Vite)
```

## Deploy Vercel

```bash
# Opção A — Git Push (recomendado)
git checkout main
git add -A
git commit -m "deploy: produção v1.0.0"
git push origin main
# → Vercel detecta e deploy automático

# Opção B — Vercel CLI
npx vercel --prod
```

## Pós-implantação

```bash
# 4. Verificar build no domínio
curl -sI https://tms.conexaoexpress.com.br
curl -s https://tms.conexaoexpress.com.br | head -5

# 5. Verificar JS/CSS carregam
# Chrome DevTools → Network → reload → 200 OK

# 6. Verificar console
# F12 → Console → 0 erros (exceto favicon 404 se não configurado)

# 7. Testar login
# Acessar /auth → login com credenciais reais

# 8. Testar rota SPA
# Acessar /central-ia-ferramentas → 200 (não 404)

# 9. Verificar variáveis de ambiente
# F12 → Sources → procurar "VITE_" no bundle
# Deve mostrar apenas as variáveis Grupo A + B

# 10. Verificar performance
# Lighthouse → Desktop → pelo menos 80+ em todas as categorias
# Performance mobile → pelo menos 60+
```

## Ativação Oracle

```bash
# 11. Acessar Oracle Cloud VM
ssh -i ~/.ssh/oracle_key opc@<IP_ORACLE>

# 12. Clonar/atualizar repositório
git clone https://github.com/tecnologiaconexao5-lab/express-connect-hub.git
# Ou: git pull

# 13. Subir containers
docker compose -f docker-compose.production.yml up -d

# 14. Verificar healthchecks
docker ps                       # Todos "Up" e "healthy"
docker compose -f docker-compose.production.yml logs --tail=20

# 15. Testar Evolution API
curl http://localhost:8080/manager

# 16. Testar n8n
curl http://localhost:5678/healthz

# 17. Testar Redis
redis-cli ping                  # PONG
```

## Checklist Final

| Item | Verificado? |
|------|-------------|
| Typecheck 0 erros | □ |
| Build sem warnings | □ |
| Vercel deploy sucesso | □ |
| Domínio acessível | □ |
| SSL ativo | □ |
| Proxy Cloudflare laranja | □ |
| Login funcional | □ |
| Rotas SPA funcionam | □ |
| Variáveis de ambiente | □ |
| Oracle containers up | □ |
| Evolution API saudável | □ |
| n8n saudável | □ |
| Redis saudável | □ |
| Sem erros console | □ |
| Performance ok | □ |
| Backups feitos | □ |

## Rollback

Se algo der errado, seguir `docs/ROLLBACK.md`.
