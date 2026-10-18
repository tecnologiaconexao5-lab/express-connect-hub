# Go-Live Checklist — Express Connect Hub / TMS

> **Para:** Empresario / Gestor nao-programador  
> **Data:** 2026-06-26  
> **Tempo estimado:** 2-4 horas

---

## ANTES DO DEPLOY

- [ ] Conferir se todos os acessos abaixo estao disponiveis:
  - [ ] Login do Supabase (banco de dados)
  - [ ] Login da Oracle Cloud (servidor)
  - [ ] Dominio configurado (ex: tms.suaempresa.com.br)
  - [ ] Acesso SSH ao servidor

---

## CONFIGURAR SUPABASE

- [ ] Acessar Supabase Dashboard → Project Settings → API
- [ ] Copiar `URL` e `anon key` (nao a `service_role`)
- [ ] Acessar Supabase Dashboard → SQL Editor
- [ ] Executar TODAS as migrations pendentes (via `npx supabase db push`)

---

## CONFIGURAR SERVIDOR ORACLE CLOUD

- [ ] Criar VM com Ubuntu 22.04 (Ampere A1 ou E2.1)
- [ ] Instalar Docker: `sudo apt update && sudo apt install docker.io -y`
- [ ] Instalar Git: `sudo apt install git -y`
- [ ] Liberar porta 80 e 443 no firewall da Oracle Cloud (Security List)

---

## CONFIGURAR DOMINIO E SSL

- [ ] Apontar dominio para o IP publico da VM (registro A)
- [ ] (Opcional) Configurar Certbot/SSL: `sudo apt install certbot python3-certbot-nginx -y`

---

## CONFIGURAR VARIAVEIS DE AMBIENTE

- [ ] Copiar `.env.production.example` para `.env`
- [ ] Preencher `.env` com os valores reais:
  - [ ] `VITE_SUPABASE_URL` — URL do Supabase
  - [ ] `VITE_SUPABASE_ANON_KEY` — chave anon do Supabase
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` — chave service_role (NUNCA exposta no frontend)
  - [ ] `VITE_MAPBOX_ACCESS_TOKEN` — token Mapbox
- [ ] Salvar `.env` em local seguro (fora do Git)

---

## BUILD E DEPLOY

- [ ] Clonar repositorio no servidor: `git clone <url>`
- [ ] Rodar build: `docker build -t express-connect-hub .`
  - [ ] Build concluiu sem erros?
- [ ] Iniciar container: `docker run -d --name tms --restart always -p 80:80 express-connect-hub`
- [ ] Verificar: `docker ps` (deve mostrar o container rodando)
- [ ] Verificar logs: `docker logs -f tms` (sem erros)

---

## PRIMEIRO ACESSO

- [ ] Acessar `http://IP-DO-SERVIDOR` (ou dominio)
- [ ] Ver se a tela de login aparece
- [ ] Fazer login
- [ ] Dashboard carrega?

---

## VALIDAR OPERACAO

- [ ] Criar um cliente de teste
- [ ] Criar uma OS de teste
- [ ] Alocar motorista
- [ ] Ver escala criada
- [ ] Finalizar OS
- [ ] Verificar se financeiro foi gerado
- [ ] Verificar dashboard (numeros batem?)

---

## VALIDAR FINANCEIRO

- [ ] Contas a Receber aparecem?
- [ ] Fazer uma baixa parcial
- [ ] Verificar saldo restante
- [ ] Cancelar uma OS de teste
- [ ] Verificar se financeiro foi estornado
- [ ] DRE mostra dados reais?

---

## VALIDAR LOGS

- [ ] Nenhum erro vermelho no console do navegador (F12)
- [ ] `docker logs tms` mostra apenas acessos normais
- [ ] Supabase Dashboard → Logs sem erros 500

---

## PLANO DE ROLLBACK (SE ALGO DER ERRADO)

- [ ] Parar container: `docker stop tms`
- [ ] Iniciar versao anterior: `docker run -d --name tms --restart always -p 80:80 express-connect-hub:anterior`
- [ ] Ou restaurar backup do Supabase se necessario

---

## CRITERIO: PODE ENTRAR NO AR?

- [ ] Build sem erros
- [ ] Login funciona
- [ ] Criar OS funciona
- [ ] Financeiro funciona
- [ ] Dashboard mostra numeros reais
- [ ] Logs limpos (sem erros)
- [ ] Rollback testado

**Se todos os itens acima estao marcados → APTO PARA PRODUCAO.**

---

*Documento gerado para Missao 06 — OpenCode Go Pro*
