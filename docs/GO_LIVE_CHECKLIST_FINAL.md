# GO LIVE CHECKLIST FINAL

> Projeto: Express Connect Hub / TMS
> Data: 2026-07-27
> Responsável: Gestor de TI / DevOps

---

## Sumário

1. [PRÉ-REQUISITOS (antes do dia do go-live)](#1-pré-requisitos)
2. [DIA DO GO-LIVE — MANHÃ](#2-dia-do-go-live--manhã)
3. [DIA DO GO-LIVE — VERIFICAÇÃO](#3-dia-do-go-live--verificação)
4. [PÓS-GO-LIVE (24h)](#4-pós-go-live-24h)
5. [PÓS-GO-LIVE (7 dias)](#5-pós-go-live-7-dias)
6. [CHECKLIST POR CAMADA](#6-checklist-por-camada)

---

## 1. PRÉ-REQUISITOS

### Código Fonte

- [ ] Repositório `express-connect-hub` clonado localmente
- [ ] Branch `main` com último código estável
- [ ] `npx tsc --noEmit` → **0 erros**
- [ ] `npm run build` → **build ok**
- [ ] `npm run test` → **testes passando** (vitest)
- [ ] Último commit revisado

### Backups

- [ ] Backup completo do Supabase remoto (pg_dump)
- [ ] Backup das migrations (git tag)
- [ ] Backup dos arquivos `.env` (offline)
- [ ] Script de restore validado

### Credenciais e Acessos

- [ ] Acesso ao Vercel Dashboard
- [ ] Acesso ao Cloudflare Dashboard
- [ ] Acesso ao Supabase Dashboard
- [ ] Acesso à Oracle Cloud (SSH)
- [ ] Acesso ao GitHub (push)
- [ ] Chaves de API todas renovadas/rotacionadas

### Notificações

- [ ] Equipe avisada sobre o go-live
- [ ] Suporte de standby
- [ ] Playbook de rollback impresso

---

## 2. DIA DO GO-LIVE — MANHÃ

### Passo 1 — Oracle VM

```bash
# Acessar VM
ssh -i ~/.ssh/oracle_key opc@<IP_ORACLE>

# Atualizar SO
sudo apt update && sudo apt upgrade -y

# Clonar/atualizar repositório
cd /opt/tms
git pull origin main

# Verificar docker-compose
docker compose -f docker-compose.production.yml config

# Subir containers
docker compose -f docker-compose.production.yml up -d

# Aguardar healthchecks (2min)
sleep 120
docker ps
```
- [ ] Oracle VM acessível
- [ ] Repositório atualizado
- [ ] Containers UP
- [ ] Evolution API saudável (curl :8080/manager)
- [ ] n8n saudável (curl :5678/healthz)
- [ ] Redis saudável (redis-cli ping)

### Passo 2 — Vercel Deploy

```bash
git checkout main
git add -A
git commit -m "go-live: produção v1.0.0"
git push origin main
```
- [ ] Push feito
- [ ] Vercel detectou o push
- [ ] Build passou no Vercel
- [ ] Deploy production ativo

### Passo 3 — Cloudflare DNS

- [ ] DNS propagation verificada
- [ ] Proxy laranja ativo
- [ ] SSL Full Strict ativo
- [ ] WAF Rules ativas

### Passo 4 — Supabase

- [ ] Supabase projeto ativo
- [ ] Nenhuma migration pendente
- [ ] Edge functions implantadas
- [ ] Auth real ativo

---

## 3. DIA DO GO-LIVE — VERIFICAÇÃO

### Testes de Aceitação

- [ ] **Login:** Acessar `https://tms.conexaoexpress.com.br/auth` → login com email real
- [ ] **Dashboard:** Página inicial carrega sem erros de console
- [ ] **Rotas SPA:** Navegar para qualquer URL direta (ex: `/central-ia`) → 200
- [ ] **Multi-Tenant:** Usuário vê apenas seus dados
- [ ] **Central IA:** Abas carregam (Ferramentas, Conectores, Rotinas, Trabalho, Missões)
- [ ] **WhatsApp:** Testar envio de mensagem (modo homologação)
- [ ] **E-mail:** Testar envio de e-mail (modo homologação)
- [ ] **Financeiro:** Abrir tela financeira sem erros
- [ ] **Fiscal:** Abrir tela fiscal sem erros
- [ ] **Operação:** Abrir tela de operação (escala, tracking)

### Testes de Performance

- [ ] Lighthouse Desktop ≥ 80
- [ ] Lighthouse Mobile ≥ 60
- [ ] First Contentful Paint < 2s
- [ ] Tempo de login < 3s

### Testes de Segurança

- [ ] Console sem erros de CORS
- [ ] Nenhuma variável sensível no bundle (verificar Sources)
- [ ] WAF Cloudflare não bloqueia tráfego legítimo
- [ ] Rate limiting não afeta usuários reais

---

## 4. PÓS-GO-LIVE (24h)

### Monitoramento

- [ ] Healthcheck a cada 5min rodando
- [ ] Logs sem erros críticos
- [ ] Nenhum downtime
- [ ] CPU Oracle < 80%
- [ ] Disco Oracle < 85%
- [ ] Memória Oracle < 85%

### Backup

- [ ] Backup automático da noite executou
- [ ] Backup verificado (tamanho > 1MB)

### Suporte

- [ ] Usuários reportando sem problemas
- [ ] WhatsApp funcional
- [ ] E-mail funcional

---

## 5. PÓS-GO-LIVE (7 dias)

- [ ] Nenhum incidente crítico
- [ ] Performance estável
- [ ] Rollback não foi necessário
- [ ] Watchtower atualizou containers sem quebrar
- [ ] Backup diário consistentes
- [ ] Análise de logs concluída
- [ ] Relatório pós-go-live gerado

---

## 6. CHECKLIST POR CAMADA

### Vercel

- [ ] Build passa (npm run build)
- [ ] Typecheck passa (npx tsc --noEmit)
- [ ] SPA rewrite configurado (vercel.json)
- [ ] Vars de ambiente configuradas (Dashboard Vercel)
- [ ] Domínio customizado apontado
- [ ] SSL automático ativo
- [ ] Deploy automático por git push
- [ ] Rollback testado (Promote to Production)

### Cloudflare

- [ ] DNS registros configurados
- [ ] Proxy laranja ativo
- [ ] SSL Full (strict)
- [ ] Always Use HTTPS
- [ ] WAF ativo (Bot Fight Mode)
- [ ] Rate Limiting configurado
- [ ] Cache Rules para assets (7 dias)
- [ ] Cache Bypass para API
- [ ] Rocket Loader OFF
- [ ] Mirage OFF

### Oracle

- [ ] Docker v24+ instalado
- [ ] Docker Compose v2+ instalado
- [ ] evolution-api rodando (porta 8080)
- [ ] n8n rodando (porta 5678)
- [ ] Redis rodando (porta 6379)
- [ ] Watchtower rodando
- [ ] Todos healthchecks passando
- [ ] Backup configurado
- [ ] Monitoramento configurado
- [ ] Portas liberadas no Security List

### Supabase

- [ ] 99 migrations aplicadas
- [ ] 7 edge functions implantadas
- [ ] RLS policies ativas (multi-tenant)
- [ ] Auth real (não demo)
- [ ] Backup diário ativo
- [ ] Super Admin funcional
- [ ] Rate limiting configurado

### Segurança

- [ ] Service Role Key não exposta no frontend
- [ ] Chaves de API rotacionadas
- [ ] VITE_AUTH_DEMO_MODE=false
- [ ] Nenhuma secret no git
- [ ] Cloudflare protegendo IP Oracle
- [ ] Rate limiting no login

---

## OBSERVAÇÕES

- **Ordem de ativação:** Oracle → Vercel → Cloudflare → Supabase → Testes
- **Tempo estimado:** 2-4 horas (com validações)
- **Rollback:** Ver `docs/ROLLBACK.md` a qualquer momento
- **Suporte:** TI disponível via WhatsApp durante go-live
