# Go Live — Produção Oracle + Supabase

## Pré-requisitos

- [ ] Domínio configurado (DNS A record → IP Oracle)
- [ ] SSL ativo (Let's Encrypt via certbot)
- [ ] Supabase projeto online e migrations aplicadas
- [ ] Docker instalado na VM Oracle
- [ ] .env preenchido no servidor

---

## Passo 1: Preparar Servidor

```bash
# 1. SSH na VM
ssh ubuntu@<IP_ORACLE>

# 2. Instalar dependências
sudo apt update
sudo apt install -y docker.io nginx certbot python3-certbot-nginx

# 3. Clonar repositório
git clone https://github.com/tecnologiaconexao5-lab/express-connect-hub.git
cd express-connect-hub

# 4. Criar .env
cp .env.production .env
nano .env  # Preencher chaves reais
```

---

## Passo 2: Build Docker

```bash
docker build -t express-connect-hub .
docker run -d --name tms --restart always -p 80:80 express-connect-hub
```

---

## Passo 3: SSL + Nginx

```bash
sudo certbot --nginx -d tms.conexaoexpress.com.br
sudo nginx -t
sudo systemctl reload nginx
```

Verificar:
```bash
curl https://tms.conexaoexpress.com.br/health
curl -I https://tms.conexaoexpress.com.br  # headers de segurança
```

---

## Passo 4: Supabase — Migrations Pendentes

```bash
npx supabase db push --include-all
```

Ou aplicar manualmente no SQL Editor:
1. `20260801_p3_idempotency_key.sql` (anti-duplicidade)

---

## Passo 5: Supabase — RPCs

Verificar:
```sql
SELECT proname FROM pg_proc WHERE proname IN ('set_tenant_context', 'consumir_convite', 'buscar_usuario_por_email');
```

Se alguma faltar, executar a migration correspondente.

---

## Passo 6: Supabase — Super Admin

Seguir `docs/CRIAR_SUPER_ADMIN.md`:

```sql
-- 1. Encontrar user_id
SELECT id, email FROM auth.users WHERE email = 'admin@conexaoexpress.com.br';

-- 2. Inserir super_admin
INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status)
SELECT id, '<user_id>', 'super_admin', 'ativo'
FROM tenants WHERE slug = 'conexao-express';
```

---

## Passo 7: Teste Ponta a Ponta

- [ ] Login real em https://tms.conexaoexpress.com.br
- [ ] Super admin consegue acessar /admin/tenants
- [ ] Criar novo tenant
- [ ] Convidar usuário por email
- [ ] Aceitar convite (AcceptInvite)
- [ ] Trocar tenant ativo
- [ ] Criar cliente
- [ ] Criar OS
- [ ] Tracking público funciona
- [ ] Portal cliente carrega
- [ ] Dashboard conectores em /admin/conectores
- [ ] Modo assistido Zoho/WhatsApp testado
- [ ] Reprocessamento de execução FALHOU
- [ ] Anti-duplicidade (mesma ação não duplica)

---

## Passo 8: Validar Logs

```bash
docker logs -f tms --tail 50
sudo tail -f /var/log/nginx/access.log
```

---

## Passo 9: Backup Inicial

- [ ] Backup Supabase via dashboard
- [ ] .env copiado para cofre
- [ ] docker tag da imagem

---

## Passo 10: Go Live

- [ ] DNS propagado
- [ ] HTTPS funcionando
- [ ] Login real OK
- [ ] Multi-tenant OK
- [ ] Conectores modo assistido OK
- [ ] Playwright tests OK
- [ ] Build OK (tsc + build)
- [ ] Docker health check OK

---

## Contatos de Emergência

| Responsável | Contato |
|-------------|---------|
| DevOps / Infra | tecnologia@conexaoexpress.com.br |
| Supabase | https://supabase.com/dashboard |
| Oracle Cloud | https://cloud.oracle.com |
| Registro.br (domínio) | https://registro.br |
