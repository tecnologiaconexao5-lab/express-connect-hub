# Deploy Oracle Cloud — Express Connect Hub / TMS

> **Data:** 2026-06-26 | **Missao:** 05

---

## 1. Pre-requisitos

- Oracle Cloud VM (Ampere A1 ou E2.1) com Ubuntu 22.04+
- Node.js 22 (via nvm)
- Docker (opcional, recomendado)
- Git

---

## 2. Deploy com Docker (Recomendado)

```bash
# Clonar repositorio
git clone <repo-url> express-connect-hub
cd express-connect-hub

# Criar .env a partir do template
cp .env.production.example .env
# Editar .env com valores reais
nano .env

# Build da imagem
docker build -t express-connect-hub .

# Rodar container
docker run -d --name tms --restart always -p 80:80 express-connect-hub

# Ver logs
docker logs -f tms

# Reiniciar
docker restart tms

# Atualizar
git pull
docker build -t express-connect-hub .
docker stop tms && docker rm tms
docker run -d --name tms --restart always -p 80:80 express-connect-hub
```

---

## 3. Deploy com PM2 (Alternativa)

```bash
# Instalar dependencias
npm ci --omit=dev

# Build
npm run build

# Instalar PM2
npm install -g pm2

# Iniciar com serve
pm2 serve dist 80 --name tms --spa
pm2 save
pm2 startup

# Logs
pm2 logs tms

# Reiniciar
pm2 restart tms
```

---

## 4. Deploy com Nginx + PM2

```bash
# Build
npm ci --omit=dev
npm run build

# Copiar dist para o diretorio do Nginx
sudo cp -r dist/* /var/www/tms/

# Copiar config do Nginx
sudo cp nginx.conf /etc/nginx/sites-available/tms
sudo ln -s /etc/nginx/sites-available/tms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Variaveis de Ambiente Obrigatorias

| Variavel | Onde obter |
|----------|-----------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox Dashboard → Tokens |

---

## 6. Health Check

```bash
# Verificar se o servidor responde
curl -I http://localhost/

# Verificar health endpoint
curl http://localhost/health
# Deve retornar: OK
```

---

## 7. Rollback

```bash
# Docker
docker stop tms
docker run -d --name tms --restart always -p 80:80 express-connect-hub:previous

# PM2
pm2 restart tms --update-env
```

---

## 8. Monitoramento

```bash
# Docker stats
docker stats tms

# PM2 status
pm2 status
pm2 monit

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log
```

---

*Documento gerado para Missao 05 — OpenCode Go Pro*
