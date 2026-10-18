# CHECKLIST — Oracle Cloud Multi-Tenant Producao

## Pre-requisitos

- [ ] Acesso SSH a instancia Oracle Cloud
- [ ] Docker e Docker Compose instalados
- [ ] Supabase projeto configurado e migrations aplicadas
- [ ] `.env.production` preenchido com valores reais (sem secrets expostos)

---

## Passo 1: Preencher `.env.production`

Copiar `.env.production.example` para `.env.production`:

```bash
cp .env.production.example .env.production
```

Preencher todas as variaveis:

| Variavel | Obrigatorio | Descricao |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | SIM | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | SIM | Chave anonima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | NUNCA no frontend | Apenas para scripts backend |
| `VITE_APP_URL` | SIM | URL publica do sistema |
| `VITE_MAPBOX_ACCESS_TOKEN` | SIM | Token Mapbox |
| `VITE_TMS_EDGE_INTERNAL_TOKEN` | SIM | Token interno |

---

## Passo 2: Garantir `VITE_AUTH_DEMO_MODE=false`

```bash
grep VITE_AUTH_DEMO_MODE .env.production
```

**IMPORTANTE**: Deve retornar:

```
VITE_AUTH_DEMO_MODE=false
```

Valores incorretos:
- `true` → usuarios podem usar credenciais hardcoded de demo
- vazio → codigo interpreta como `true`
- ausente → codigo interpreta como `true`

- [ ] `VITE_AUTH_DEMO_MODE=false` confirmado

---

## Passo 3: Build Docker

```bash
docker build -t express-connect-hub:latest .
```

- [ ] Build conclui sem erros
- [ ] Imagem criada: `express-connect-hub:latest`

---

## Passo 4: Rodar Container

```bash
docker run -d \
  --name tms-web \
  -p 80:80 \
  --env-file .env.production \
  express-connect-hub:latest
```

- [ ] Container iniciado sem erros
- [ ] `docker ps` mostra container `tms-web` como `Up`

---

## Passo 5: Validar Health Check

```bash
curl -s http://localhost/health
```

- [ ] Retorna `OK`

---

## Passo 6: Validar Login Real

1. Acessar `https://seudominio.com.br/login`
2. Inserir email e senha de usuario real (criado no Supabase Auth)
3. Clicar em "Entrar"
4. Verificar se o dashboard carrega

**O que NAO deve acontecer:**
- [ ] Nao deve mostrar "Modo demo ativo"
- [ ] Nao deve aceitar credenciais de demo (admin123, oper123, cli123, prest123)

- [ ] Login real funciona
- [ ] Modo demo NAO esta disponivel

---

## Passo 7: Validar Tenant Ativo

- [ ] Usuario ve apenas dados do seu tenant
- [ ] Nao ha dados de outros tenants visiveis
- [ ] Navegacao funciona sem erros de RLS

---

## Passo 8: Validar Troca de Empresa

Se o usuario tiver acesso a multiplos tenants:

1. Clicar no seletor de empresa
2. Selecionar outro tenant
3. Verificar que os dados mudaram
4. Voltar para o tenant anterior
5. Verificar que os dados originais retornaram

- [ ] Troca de empresa funciona
- [ ] Dados sao isolados por tenant
- [ ] Cache e limpo ao trocar

---

## Passo 9: Validar Logs

```bash
docker logs -f tms-web
```

- [ ] Sem erros de conexao
- [ ] Sem erros de RLS
- [ ] Sem erros 500
- [ ] Requisicoes 404 sao tratadas pelo SPA fallback

---

## Passo 10: Rollback

### Voltar para versao anterior:

```bash
# Parar container atual
docker stop tms-web
docker rm tms-web

# Rodar versao anterior
docker run -d \
  --name tms-web \
  -p 80:80 \
  --env-file .env.production \
  express-connect-hub:<versao-anterior>
```

### Rollback de migration Supabase (se necessario):
```sql
-- Exemplo para remover M21 (set_tenant_context):
DROP FUNCTION IF EXISTS set_tenant_context(UUID);
```

- [ ] Procedimento de rollback documentado e testado

---

## Resumo Final

| Passo | Descricao | Status |
|-------|-----------|--------|
| 1 | .env.production preenchido | [ ] |
| 2 | VITE_AUTH_DEMO_MODE=false | [ ] |
| 3 | Build Docker OK | [ ] |
| 4 | Container rodando | [ ] |
| 5 | Health check OK | [ ] |
| 6 | Login real OK | [ ] |
| 7 | Tenant ativo OK | [ ] |
| 8 | Troca empresa OK | [ ] |
| 9 | Logs sem erros | [ ] |
| 10 | Rollback documentado | [ ] |

---

## Comandos Uteis

```bash
# Ver logs
docker logs -f tms-web

# Reiniciar
docker restart tms-web

# Rebuild sem cache
docker build --no-cache -t express-connect-hub:latest .

# Shell no container
docker exec -it tms-web sh

# Ver variaveis de ambiente
docker exec tms-web env | grep VITE_
```
