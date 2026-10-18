# PROVISIONAMENTO QA — F2-A0-QA1

## Status
**Ambiente QA remoto:** ❌ NÃO CRIADO  
**Supabase local:** 🔶 INICIADO (config.toml criado, Docker disponível, não iniciado)  
**Schema reproduzível do zero:** ❌ NÃO  

---

## AÇÃO MANUAL NECESSÁRIA — Supabase Dashboard

Para criar o ambiente QA remoto, a pessoa responsável deve:

### Passo 1 — Criar projeto no Supabase Dashboard
1. Acessar https://supabase.com/dashboard/projects
2. Clicar "New project"
3. Preencher:
   - **Name:** `tms-qa` (ou `conexao-express-qa`)
   - **Database Password:** gerar senha forte de 24 caracteres, armazenar no gerenciador de senhas
   - **Region:** `South America (São Paulo)` — `sa-south-1`
   - **Pricing Plan:** Pro (USD 25/mês) — necessário para Edge Functions
4. Aguardar provisionamento (~2 minutos)
5. Anotar:
   - **Project Ref** (ex: `abcdefghijklmnopqrst`)
   - **Anon Key**
   - **Service Role Key** (apenas para infraestrutura, nunca no frontend)
   - **Database URL** (connection string)

### Passo 2 — Configurar projeto QA no Dashboard
1. **Authentication > Settings:**
   - Site URL: `http://localhost:8800`
   - Redirect URLs: `http://localhost:8800/**`, `http://localhost:3000/**`
   - Email Confirm: desabilitado (para testes)
   - Sessions: expiração 3600s
2. **Database > Connection pooling:**
   - Porta transaction mode: 5432
   - Porta session mode: 5433
3. **API settings:**
   - Anon key (registrar para .env.qa)
   - Service role key (registrar para scripts de preparação)

### Passo 3 — Configurar integrações
Todas bloqueadas (ver `F2_A0_QA1_INTEGRACOES_BLOQUEADAS.md`)

### Passo 4 — Aplicar baseline
Ver `F2_A0_QA1_BASELINE.md`

---

## Alternativa — Supabase Local

Se o projeto remoto não for viável imediatamente, usar Supabase local:

```bash
cd C:\...\express-connect-hub
supabase start
```

**Requisitos:**
- Docker Desktop rodando (✅ disponível)
- ~5 GB de download de imagens Docker
- Baseline das tabelas centrais (ver plano de baseline)

**Limitações:**
- Edge Functions não funcionam em local (apenas em Pro)
- Storage limitado
- Não acessível externamente (apenas localhost)
- Sem backup automático
- Seed manual necessário

---

## Matriz produção vs QA

| Item | Produção | QA (remoto — não criado) | QA (local — configurado) |
|------|----------|--------------------------|--------------------------|
| Project ref | `uwrvzsjtpgaifkktpepn` | `<preencher>` | `express-connect-hub` |
| URL | `https://uwrvzsjtpgaifkktpepn.supabase.co` | `https://<ref>.supabase.co` | `http://127.0.0.1:54321` |
| Banco | PostgreSQL 17 | PostgreSQL 17 | PostgreSQL 15 |
| Auth | Supabase Auth real | Supabase Auth separado | Supabase Auth local |
| Storage | Buckets reais | Buckets vazios | Buckets locais |
| Edge Functions | 8 ativas | 8 (precisa deploy separado) | ❌ Não disponível |
| Dados reais | ✅ 176 alocações, 85 financeiro | ❌ Nenhum | ❌ Nenhum |
| Usuários | 7 tenant_usuarios | Seed manual | Seed manual |
