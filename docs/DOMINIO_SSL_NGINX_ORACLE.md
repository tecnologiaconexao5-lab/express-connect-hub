# Configuração de Domínio, SSL e Nginx — Oracle Cloud

## 1. DNS

Registrar registro A apontando o domínio para o IP público da VM Oracle:

```
tms.conexaoexpress.com.br  A  <IP_PUBLICO_ORACLE>
```

Verificar propagação:
```bash
nslookup tms.conexaoexpress.com.br
```

## 2. SSL com Let's Encrypt (Certbot)

```bash
# Instalar certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d tms.conexaoexpress.com.br

# Verificar renovação automática
sudo certbot renew --dry-run
```

O certbot modifica o `/etc/nginx/conf.d/default.conf` automaticamente para:
- Adicionar `listen 443 ssl;`
- Adicionar `ssl_certificate` e `ssl_certificate_key`
- Redirecionar HTTP → HTTPS (opcional)

## 3. Nginx Config Final (HTTPS)

Após certbot, o nginx.conf no container Docker atende na porta 80.
O certbot configura um proxy reverso ou o nginx do host para fazer SSL termination.

Estrutura recomendada:
```
Host Oracle (porta 443 SSL) → Nginx do host → Container Docker (porta 80)
```

Config do host:
```nginx
server {
    listen 443 ssl http2;
    server_name tms.conexaoexpress.com.br;

    ssl_certificate /etc/letsencrypt/live/tms.conexaoexpress.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tms.conexaoexpress.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name tms.conexaoexpress.com.br;
    return 301 https://$server_name$request_uri;
}
```

## 4. Headers de Segurança (já no nginx.conf do container)

| Header | Valor |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Content-Security-Policy` | Restritivo (ver nginx.conf) |

## 5. Health Check

```bash
curl https://tms.conexaoexpress.com.br/health
# Retorno esperado: "OK"
```

## 6. Troubleshooting

```bash
# Verificar status nginx
sudo systemctl status nginx

# Verificar logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Testar configuração
sudo nginx -t

# Renovar certificado manualmente
sudo certbot renew --manual --preferred-challenges http
```
