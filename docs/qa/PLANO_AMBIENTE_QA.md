# Plano de Ambiente QA — Express Connect Hub TMS

**Data:** 23/07/2026
**Responsável:** Equipe de Tecnologia / DevOps
**Versão:** 1.0
**Status:** ⏳ Pendente de execução

---

## Sumário

1. [Banco — Projeto Supabase QA Separado](#1-banco--projeto-supabase-qa-separado)
2. [Autenticação](#2-autenticação)
3. [Storage](#3-storage)
4. [Edge Functions](#4-edge-functions)
5. [RLS — Row Level Security](#5-rls--row-level-security)
6. [Migrations](#6-migrations)
7. [Secrets](#7-secrets)
8. [Usuários QA](#8-usuários-qa)
9. [Tenant QA](#9-tenant-qa)
10. [Bloqueio Fiscal](#10-bloqueio-fiscal)
11. [Bloqueio de E-mail](#11-bloqueio-de-e-mail)
12. [Bloqueio de WhatsApp](#12-bloqueio-de-whatsapp)
13. [Bloqueio de Cobrança](#13-bloqueio-de-cobrança)
14. [Mapas e Serviços Externos](#14-mapas-e-serviços-externos)
15. [Estratégia de Seed](#15-estratégia-de-seed)
16. [Estratégia de Limpeza](#16-estratégia-de-limpeza)
17. [Backup](#17-backup)
18. [Rollback](#18-rollback)
19. [Plano de Execução](#19-plano-de-execução)

---

## 1. Banco — Projeto Supabase QA Separado

### 1.1 Nome do Projeto

**`tms-qa`** — Projeto Supabase exclusivo para Quality Assurance.

### 1.2 Tier

**Pro (USD 25/mês).** Justificativa:
- Necessário para testar Edge Functions (proibido no Free tier)
- Connection pooling incluso
- Até 8 GB de banco (suficiente para dados de seed)
- 50 MB de storage (suficiente para comprovantes de teste)
- 50k monthly active users (MAU)

### 1.3 Região

**South America (São Paulo) — `sa-south-1`.** Mesma região da produção (`aws-1-sa-east-1` no pooler) para consistência de latência e evitar diferenças de comportamento.

### 1.4 Senha do Banco

Gerar senha aleatória de 24 caracteres via:
```bash
openssl rand -base64 18 | tr -d '/+' | cut -c1-24
```
Registrar no gerenciador de senhas corporativo (Bitwarden / 1Password) sob a chave `Supabase QA Database Password`.

### 1.5 Connection Pooling

Ativar **Supabase Pooler** (`aws-1-sa-east-1.pooler.supabase.com`) no projeto QA:
- Configurar `DATABASE_URL` no `.env.qa` apontando para o pooler
- Transaction mode (porta 5432) — compatível com triggers e propagação financeira
- Session mode (porta 5433) — para scripts longos de seed
- Pool size recomendado: 15 conexões (suficiente para testes + Playwright simultâneos)

### 1.6 Project ID e URLs

| Item | Valor (preencher após criação) |
|------|--------------------------------|
| Project ID | `xxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Supabase URL | `https://xxxxxxxxxxxxxxxxxxxx.supabase.co` |
| Pooler URL | `postgresql://postgres.xxxxxxxx:senha@aws-1-sa-east-1.pooler.supabase.com:5432/postgres` |
| Anon Key | `eyJ...` |
| Service Role Key | `sb_secret_...` |

### 1.7 Criação via Supabase CLI

```bash
# Login no Supabase (caso ainda não esteja)
npx supabase login

# Criar projeto via CLI (requer --org-id e --project-name)
npx supabase projects create tms-qa --org-id <org_id> --db-password <senha_gerada> --region sa-south-1

# Alternativa: criar manualmente via https://supabase.com/dashboard/new
```

---

## 2. Autenticação

### 2.1 Configuração do Supabase Auth no QA

No Dashboard do Supabase QA:
1. **Authentication > Settings > Site URL:** `http://localhost:8800` (dev) ou `https://qa.tms.conexaoexpress.com.br` (se houver)
2. **Authentication > Settings > Redirect URLs:** 
   - `http://localhost:8800/**`
   - `https://qa.tms.conexaoexpress.com.br/**`
   - `https://xxxxxxxxxxxxxxxxxxxx.supabase.co/auth/v1/callback`
3. **Authentication > Providers > Email:** Habilitar "Confirm email" = false (para testes, evitar fluxo de confirmação)
4. **Authentication > Settings > Security:** Desabilitar CAPTCHA (para Playwright)
5. **Authentication > Email Templates:** Personalizar template de reset para apontar para `http://localhost:8800/reset-password`

### 2.2 Migração de Usuários

**Não migrar usuários de produção.** Criar usuários novos específicos para QA (ver seção 8).

Motivos:
- Senhas de produção são placeholders (`__CONEXAO2026_TAMIRIS__`) — inúteis copiar
- Evitar risco de vazamento de dados reais
- Evitar confusão entre ambientes

### 2.3 Configurações Adicionais

- **Session duration:** 3600 segundos (1 hora) — igual produção
- **Refresh token rotation:** ativado
- **Rate limiting:** desabilitar ou elevar limite para testes bulk

---

## 3. Storage

### 3.1 Buckets a Criar

| Bucket | Finalidade | Público | TTL |
|--------|-----------|---------|-----|
| `comprovantes-entrega` | Fotos de POD, assinaturas, canhotos | Não | 30 dias |
| `documentos-clientes` | Documentos fiscais e contratos | Não | 90 dias |
| `documentos-prestadores` | CNH, CRLV, certificados | Não | 90 dias |
| `relatorios-exportados` | PDFs/Excel gerados | Não | 7 dias |
| `biblioteca-global` | Manuais e documentos corporativos | Sim | — |
| `treinamento-ia` | Arquivos de treinamento de IA | Não | — |

### 3.2 Policies

Copiar as mesmas políticas de produção. As migrations de storage estão em:
- `202606200005_f25f7a_candidatos.sql`
- `202606200006_f25fa3_treinamento_arquivos_ia.sql`
- `202606200007_usuarios_cliente_seguranca.sql`
- `20260630000002_m44b_storage_buckets.sql`
- `20260703_m54e6_bucket_relatorios.sql`

As policies de storage são recriadas automaticamente ao aplicar as migrations contendo `storage.objects` policies.

### 3.3 Validação

Após aplicar migrations, verificar:
```sql
SELECT bucked_id, name, public FROM storage.buckets;
SELECT COUNT(*) FROM storage.policies;
```

Testar upload/download via Playwright:
- Fazer upload de um arquivo PNG de 1 KB
- Verificar se a URL pública/assinada é gerada
- Verificar que usuário não autenticado não consegue acessar buckets privados

---

## 4. Edge Functions

### 4.1 Funções Existentes

Lista de Edge Functions no projeto:
- `proxy-ia` — Proxy para provedores de IA (Groq, Gemini, OpenAI, Anthropic) com validação JWT
- `criar-alocacao-escala` — Cria alocação na escala via API (legado)

### 4.2 Deploy no QA

```bash
# Configurar link com projeto QA
npx supabase link --project-ref <qa-project-ref>

# Fazer deploy de todas as funções
npx supabase functions deploy proxy-ia
npx supabase functions deploy criar-alocacao-escala
```

### 4.3 Secrets para QA

```bash
# Secrets de IA — usar chaves de homologação ou deixar vazio
npx supabase secrets set GROQ_API_KEY="" --project-ref <qa-project-ref>
npx supabase secrets set GEMINI_API_KEY="" --project-ref <qa-project-ref>
npx supabase secrets set OPENAI_API_KEY="" --project-ref <qa-project-ref>
npx supabase secrets set ANTHROPIC_API_KEY="" --project-ref <qa-project-ref>
npx supabase secrets set OPENROUTER_API_KEY="" --project-ref <qa-project-ref>
```

Chaves vazias farão o `proxy-ia` retornar erro controlado (401 Unauthorized) — comportamento aceitável para QA. Se necessário testar IA, configurar chaves de homologação sem custo (ex: Groq free tier).

### 4.4 Validação

Testar `proxy-ia` com:
```bash
curl -X POST https://<qa-project-ref>.supabase.co/functions/v1/proxy-ia \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"groq","model":"llama3-8b-8192","prompt":"Diga ola em portugues"}'
```

---

## 5. RLS — Row Level Security

### 5.1 Estratégia

**Manter exatamente as mesmas policies de produção.** O RLS é parte fundamental do sistema multi-tenant. Alterar policies no QA invalidaria os testes.

As policies são definidas nas migrations SQL e aplicadas automaticamente via `supabase db push`.

### 5.2 Policies Críticas a Verificar

| Tabela | Policy | Função de Apoio |
|--------|--------|-----------------|
| `clientes` | `clientes_insert_own`, `clientes_select_own`, `clientes_update_own`, `clientes_delete_own` | `current_tenant_id_safe()`, `f_usuario_pode_acessar_cliente()` |
| `prestadores` | `prestadores_select_tenant`, `prestadores_insert_tenant` | `current_tenant_id_safe()` |
| `alocacoes_escala` | `alocacoes_select_tenant`, `alocacoes_insert_tenant` | `current_tenant_id_safe()` |
| `financeiro_receber` | `financeiro_receber_select_tenant` | `current_tenant_id_safe()` |
| `financeiro_pagar` | `financeiro_pagar_select_tenant` | `current_tenant_id_safe()` |
| `tenant_usuarios` | `tenant_usuarios_select_own`, `tenant_usuarios_admin_all` | `f_obter_tenant_admin_status()` |

### 5.3 Validação de RLS no QA

Script de validação (executar via `psql` ou `node-pg`):

```sql
-- 1. Verificar que todas as tabelas têm RLS ativo
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relrowsecurity = false 
  AND relname NOT LIKE 'pg_%' 
  AND relname NOT LIKE '_prisma%'
  AND relkind = 'r';

-- 2. Listar todas as policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
ORDER BY tablename, policyname;

-- 3. Testar acesso como usuário QA autenticado
-- (executar via RPC ou aplicação)
SELECT * FROM clientes LIMIT 1;
-- Deve retornar apenas registros do tenant QA (0 ou mais)
```

### 5.4 Funções RLS a Validar

As funções auxiliares são criadas via migration:
- `current_tenant_id_safe()` — retorna UUID do tenant do usuário atual
- `f_usuario_pode_acessar_cliente()` — verifica permissão por cliente
- `f_obter_tenant_admin_status()` — verifica se é admin do tenant
- `set_tenant_context()` — define contexto de tenant (usada em triggers)

Validar que todas existem:
```sql
SELECT proname, pronargs, prorettype::regtype 
FROM pg_proc 
WHERE proname IN ('current_tenant_id_safe', 'f_usuario_pode_acessar_cliente', 'f_obter_tenant_admin_status', 'set_tenant_context');
```

---

## 6. Migrations

### 6.1 Estratégia de Aplicação

**Opção A (recomendada): `supabase db push`**

```bash
# Vincular ao projeto QA
npx supabase link --project-ref <qa-project-ref>

# Aplicar todas as migrations pendentes
npx supabase db push --include-all

# Verificar status
npx supabase db status
```

**Opção B (fallback): pg client**

Se `supabase db push` falhar por divergência de schema:

```bash
# Listar migrations em ordem alfabética
ls supabase/migrations/*.sql | sort

# Aplicar uma a uma via psql
PGPASSWORD=<senha> psql -h <qa-project-ref>.supabase.co -p 5432 -U postgres -d postgres -f supabase/migrations/20260511_prestadores_financeiro_contrato.sql
```

### 6.2 Ordens de Aplicação

As migrations devem ser aplicadas em ordem alfabética. As principais e suas dependências:

| Ordem | Migration | Depende de |
|-------|-----------|------------|
| 1 | `20260511_prestadores_financeiro_contrato.sql` | — |
| 2 | `20260517000001_correcao_3_crm_real.sql` | 1 |
| ... | (ordem crescente) | — |
| N | `20260728000052_missao50_auth_real_hotfix.sql` | M50 |
| N+1 | `20260729_f2d_credenciais_zoho.sql` | M50 |
| N+2 | `20260729000053_missao53_controle_patio.sql` | — |
| N+3 | `20260730_fix_assinatura_legivel.sql` | — |
| N+4 | `20260731_p0_propagacao_financeira_trigger.sql` | M80 |
| N+5 | `20260801_m31_custos_ia.sql` | — |
| N+6 | `20260801_p3_idempotency_key.sql` | — |
| N+7 | `20260802_m36_comercial_hunter.sql` | — |
| N+8 | `20260803_m36_strategy_config.sql` | — |
| N+9 | `20260804_m37_providers_reais.sql` | — |
| N+10 | `20260805_m129c_reembolsos_prestador_oficial.sql` | — |
| N+11 | `20260805_m129c2_derivar_reembolso_backend.sql` | M80 |

Total: **158 migrations** no diretório `supabase/migrations/`.

### 6.3 Migrations que Podem Falhar

| Migration | Risco | Motivo |
|-----------|-------|--------|
| `20260630000004_m44d_normalizacao_os_uuid.sql` | Médio | Altera colunas de TEXT para UUID |
| `20260710_m108a_fix_set_tenant_context_rpc.sql` | Médio | DROP/CREATE de função |
| `20260722_m133d2_rollback.sql` | Alto | Rollback explícito — verificar se aplicável ao QA |
| `20260728000052_missao50_auth_real_hotfix.sql` | Médio | Altera tabelas de auth |

Para estas, aplicar manualmente com validação entre cada passo.

### 6.4 Verificação Pós-Migration

```bash
# Verificar que todas as migrations foram aplicadas
npx supabase db status

# Listar tabelas criadas
npx supabase db dump --schema-only | grep "CREATE TABLE"

# Verificar triggers
npx supabase db dump --schema-only | grep "CREATE TRIGGER"
```

---

## 7. Secrets

### 7.1 Secrets a Copiar (com ofuscação)

| Secret | Valor em QA | Observação |
|--------|-------------|------------|
| `VITE_SUPABASE_URL` | `https://<qa-project-ref>.supabase.co` | URL do projeto QA |
| `VITE_SUPABASE_ANON_KEY` | Anon key do projeto QA | Copiar do Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do projeto QA | Copiar do Dashboard |
| `VITE_APP_URL` | `http://localhost:8800` | Para reset de senha |
| `VITE_TMS_EDGE_INTERNAL_TOKEN` | `tms-qa-token-seguro` | Novo token para QA |

### 7.2 Secrets a Deixar em Branco (integrações externas)

| Secret | Motivo |
|--------|--------|
| `VITE_GROQ_API_KEY` | Não testar IA real em QA |
| `VITE_GEMINI_API_KEY` | Não testar IA real em QA |
| `VITE_OPENAI_API_KEY` | Não testar IA real em QA |
| `VITE_OPENROUTER_API_KEY` | Não testar IA real em QA |
| `VITE_ANTHROPIC_API_KEY` | Não testar IA real em QA |
| `VITE_MAPBOX_ACCESS_TOKEN` | Usar token público de dev (seção 14) |
| `VITE_EVOLUTION_API_URL` | Não conectar WhatsApp real |
| `VITE_EVOLUTION_API_KEY` | Não conectar WhatsApp real |
| `VITE_ZOHO_CLIENT_ID` | Não conectar Zoho real |
| `VITE_ZOHO_CLIENT_SECRET` | Não conectar Zoho real |
| `VITE_ZOHO_REFRESH_TOKEN` | Não conectar Zoho real |
| `VITE_ZOHO_EMAIL_FROM` | Não conectar Zoho real |
| `VITE_N8N_API_URL` | Não conectar n8n real |

### 7.3 Modo dos Conectores

```bash
# Forçar HOMOLOGACAO em QA
VITE_ZOHO_MODE=homologacao
VITE_WHATSAPP_MODE=homologacao
VITE_COMUNICACAO_PRODUCAO_ASSISTIDA=false
```

---

## 8. Usuários QA

### 8.1 Usuários a Criar no Supabase Auth QA

| Email | Papel | Nome | Senha |
|-------|-------|------|-------|
| `qa.admin@conexaoexpress.com.br` | `super_admin` | Admin QA | Gerada via Supabase Auth (não documentar no código) |
| `qa.operador@conexaoexpress.com.br` | `operador` | Operador QA | Gerada via Supabase Auth |
| `qa.financeiro@conexaoexpress.com.br` | `financeiro` | Financeiro QA | Gerada via Supabase Auth |
| `qa.comercial@conexaoexpress.com.br` | `comercial` | Comercial QA | Gerada via Supabase Auth |

### 8.2 Senhas

As senhas devem ser:
1. Geradas automaticamente pelo Supabase Auth ("Generate password")
2. **NUNCA** documentadas no código, nem como placeholder
3. Armazenadas no gerenciador de senhas corporativo sob a chave `Supabase QA Users`
4. Configuradas no GitHub Actions (ou CI) como secrets:
   - `PLAYWRIGHT_QA_ADMIN_PASSWORD`
   - `PLAYWRIGHT_QA_OPERADOR_PASSWORD`
   - `PLAYWRIGHT_QA_FINANCEIRO_PASSWORD`
   - `PLAYWRIGHT_QA_COMERCIAL_PASSWORD`

### 8.3 Vínculo ao Tenant QA

Após criar os usuários no Auth, vincular ao tenant QA:

```sql
-- Obter UUID do usuário recém-criado
-- (copiar do Supabase Auth > Users)
INSERT INTO tenant_usuarios (id, tenant_id, user_id, papel, nome, email)
VALUES 
  (gen_random_uuid(), '<tenant_qa_id>', '<auth_user_id_admin>', 'super_admin', 'Admin QA', 'qa.admin@conexaoexpress.com.br'),
  (gen_random_uuid(), '<tenant_qa_id>', '<auth_user_id_operador>', 'operador', 'Operador QA', 'qa.operador@conexaoexpress.com.br'),
  (gen_random_uuid(), '<tenant_qa_id>', '<auth_user_id_financeiro>', 'financeiro', 'Financeiro QA', 'qa.financeiro@conexaoexpress.com.br'),
  (gen_random_uuid(), '<tenant_qa_id>', '<auth_user_id_comercial>', 'comercial', 'Comercial QA', 'qa.comercial@conexaoexpress.com.br');
```

### 8.4 Usuário para Playwright

O usuário `qa.admin@conexaoexpress.com.br` será usado pelos testes E2E do Playwright.

Configurar em `playwright.config.ts`:
```ts
process.env.PLAYWRIGHT_QA_ADMIN_EMAIL = 'qa.admin@conexaoexpress.com.br';
process.env.PLAYWRIGHT_QA_ADMIN_PASSWORD = process.env.PLAYWRIGHT_QA_ADMIN_PASSWORD;
```

Os testes existentes em `tests/e2e/helpers/auth.ts` precisarão de um perfil `qa` adicional, ou substituir os perfis atuais quando apontados para QA.

---

## 9. Tenant QA

### 9.1 Criar Tenant Separado

```sql
INSERT INTO tenants (id, nome, slug, ativo, created_at)
VALUES (
  gen_random_uuid(),
  'QA - Ambiente de Testes',
  'qa-teste',
  true,
  now()
)
RETURNING id;
```

Anotar o `id` retornado como `<tenant_qa_id>` para uso nos passos seguintes.

### 9.2 Configurações do Tenant QA

Inserir configurações padrão:
```sql
INSERT INTO configuracoes_sistema (tenant_id, chave, valor, tipo)
VALUES 
  ('<tenant_qa_id>', 'razao_social', '"QA Testes Ltda"', 'texto'),
  ('<tenant_qa_id>', 'nome_fantasia', '"QA Express"', 'texto'),
  ('<tenant_qa_id>', 'cnpj', '"00.000.000/0001-00"', 'texto'),
  ('<tenant_qa_id>', 'inscricao_estadual', '"000.000.000.000"', 'texto'),
  ('<tenant_qa_id>', 'cidade', '"São Paulo"', 'texto'),
  ('<tenant_qa_id>', 'uf', '"SP"', 'texto'),
  ('<tenant_qa_id>', 'ambiente_qa', '"true"', 'booleano');
```

A chave `ambiente_qa = true` poderá ser usada por componentes no frontend para exibir um banner "AMBIENTE QA" e desabilitar ações fiscais/de cobrança.

### 9.3 Isolamento Multi-Tenant

O RLS garante que usuários do tenant QA:
- **NÃO** vejam dados de produção (RLS filtra por `tenant_id`)
- **NÃO** sejam vistos por usuários de produção
- **NÃO** propaguem dados para fora do tenant

Validar isolamento:
```sql
-- Logado como usuário QA
SELECT COUNT(*) FROM clientes; -- Deve retornar 0 ou apenas clientes QA
SELECT COUNT(*) FROM ordens_servico; -- Deve retornar 0 ou apenas OS QA
```

---

## 10. Bloqueio Fiscal

### 10.1 Riscos

QA jamais deve:
- Emitir CT-e (Conhecimento de Transporte Eletrônico)
- Emitir NFSe (Nota Fiscal de Serviço)
- Emitir MDF-e (Manifesto de Documentos Fiscais)
- Transmitir qualquer XML à SEFAZ
- Gerar DANFE, DACTE ou DAMDFE

### 10.2 Estratégia

**Camada 1 — Código:** As funções de emissão fiscal (`emissorCteService.ts`, `emissorNfseService.ts`, `emissorMdfeService.ts`) devem verificar `configuracoes_sistema.ambiente_qa` antes de transmitir.

Em cada função de emissão:
```ts
const config = await buscarConfiguracao(tenantId, 'ambiente_qa');
if (config?.valor === 'true') {
  return { sucesso: false, erro: 'Ambiente QA: emissão fiscal bloqueada' };
}
```

**Camada 2 — Env Var:** Adicionar verificação no `.env.qa`:
```
VITE_BLOQUEIO_FISCAL=true
```

**Camada 3 — Configuração no banco:** A chave `ambiente_qa` já está prevista na seção 9.2. As funções de backend devem lê-la.

### 10.3 Fluxo de Teste Fiscal em QA

Para testar o módulo fiscal sem emitir documentos reais:
1. Criar rascunhos de CT-e/NFSe/MDF-e na tabela `fiscal_documentos` com status `rascunho`
2. Validar que o botão "Transmitir" exibe "Ambiente QA: ação bloqueada"
3. Validar que dados fiscais (tomador, remetente, destinatário) são salvos corretamente
4. Validar que XML de teste é gerado mas **não enviado**

### 10.4 Migrations Fiscais no QA

As seguintes migrations criam a estrutura fiscal e **não devem ser modificadas** para QA:
- `20260602100000_municipios_ibge.sql` — dados de IBGE (pode ser seed reduzido)
- `20260602100001_regras_fiscais_nfse.sql`
- `20260602100002_veiculos_campos_fiscais.sql`
- `20260602100003_configuracoes_fiscais.sql`
- `20260602100004_regras_fiscais_cte.sql`
- `20260602100005_certificados_fiscais.sql`
- `20260602100006_fiscal_documentos_vinculados.sql`

---

## 11. Bloqueio de E-mail

### 11.1 Riscos

QA jamais deve:
- Disparar e-mails reais via Zoho Mail
- Enviar notificações para clientes reais
- Enviar recovery emails para usuários reais

### 11.2 Estratégia

**Camada 1 — Env Var:**
```bash
VITE_ZOHO_MODE=homologacao
VITE_COMUNICACAO_PRODUCAO_ASSISTIDA=false
```

**Camada 2 — Código:** O `communicationHubService.ts` já possui `simulationMode` que lê `VITE_COMUNICACAO_PRODUCAO_ASSISTIDA`. Em QA, todas as chamadas a `enviarEmail()` retornam simulação.

**Camada 3 — Zoho OAuth2:** Sem as credenciais configuradas (`VITE_ZOHO_CLIENT_ID`, `VITE_ZOHO_CLIENT_SECRET`, `VITE_ZOHO_REFRESH_TOKEN`), o provider ZohoMail tentará autenticar e falhará com erro controlado. Nenhum email é enviado.

### 11.3 Supabase Auth — Recovery Emails

O Supabase Auth do QA está configurado (seção 2.1) com "Confirm email" = false. Isso significa que:
- Usuários são criados já confirmados
- Recovery emails NÃO são enviados automaticamente
- Reset de senha pode ser feito via Dashboard > Authentication > Users > [user] > "Force password reset"

**Importante:** Desabilitar os templates de email do Supabase Auth no QA ou apontá-los para um webhook de log em vez de SMTP real.

---

## 12. Bloqueio de WhatsApp

### 12.1 Riscos

QA jamais deve:
- Enviar mensagens reais via Evolution API
- Disparar notificações WhatsApp para prestadores
- Conectar instância Evolution real

### 12.2 Estratégia

**Camada 1 — Env Var:**
```bash
VITE_WHATSAPP_MODE=homologacao
VITE_WHATSAPP_PRODUCAO_ENABLED=false
VITE_EVOLUTION_API_URL=
VITE_EVOLUTION_API_KEY=
```

**Camada 2 — Provider:** O `WhatsAppProvider.ts` verifica o modo do conector. Em `HOMOLOGACAO`, retorna simulação.

**Camada 3 — Conectores no banco:** Os conectores seed em `ia_conectores` com tipo `evolution_whatsapp` devem permanecer em modo `HOMOLOGACAO` no QA:
```sql
UPDATE ia_conectores SET modo = 'HOMOLOGACAO' WHERE tipo = 'evolution_whatsapp';
```

### 12.3 Teste de WhatsApp em QA

Para testar a interface de WhatsApp sem enviar mensagens reais:
1. Validar que o componente `PortalWhatsApp.tsx` carrega (modo leitura de `crm_conversas`)
2. Validar que o botão "Enviar" exibe "Modo homologação — mensagem não enviada"
3. Validar que o log de execução do conector aparece em `ia_execucoes_conectores` como simulado

---

## 13. Bloqueio de Cobrança

### 13.1 Riscos

QA jamais deve:
- Gerar boletos registrados
- Enviar cobranças para clientes reais
- Atualizar status de pagamento em sistemas externos
- Disparar notificações de cobrança

### 13.2 Estratégia

**Camada 1 — Código:** Funções de geração de boleto (`gerarBoletoService.ts`, `boletosService.ts`) devem verificar `configuracoes_sistema.ambiente_qa`:

```ts
const config = await buscarConfiguracao(tenantId, 'ambiente_qa');
if (config?.valor === 'true') {
  return { sucesso: false, erro: 'Ambiente QA: geração de cobrança bloqueada' };
}
```

**Camada 2 — Financeiro:** Os registros de `financeiro_receber` e `financeiro_pagar` em QA:
- Valores devem ser simbólicos (ex: R$ 1,00 a R$ 100,00)
- Status devem ficar em `pendente` ou `rascunho`
- NUNCA devem ser marcados como `cobranca_enviada` ou `protestado`

**Camada 3 — Integração externa:** Sem chaves de gateway de pagamento configuradas, provedores de boleto/cobrança falham com erro controlado.

---

## 14. Mapas e Serviços Externos

### 14.1 Mapbox

| Ambiente | Token | Comportamento |
|----------|-------|---------------|
| Produção | `pk.xxxxxxxxxxxxxxx` (token real) | Mapa funcional, geocoding, rotas |
| QA | Token **público de dev** ou token de trial | Mesmo token pode ser usado (Mapbox não diferencia) |

**Recomendação:** Criar um token Mapbox separado para QA com restrição de URL (`localhost`, `qa.tms.conexaoexpress.com.br`). Se não houver, usar o mesmo token de produção (Mapbox cobra por requisição, não por projeto).

### 14.2 APIs de CEP

ViaCEP (público): `https://viacep.com.br/ws/{cep}/json/` — gratuito, usar direto, sem token.
APIs de CEP não precisam de bloqueio em QA.

### 14.3 APIs de CNPJ

- ReceitaWS: `https://receitaws.com.br/v1/cnpj/{cnpj}` — público, limitado a 3 req/min
- Para testes, usar CNPJs fictícios (ex: `00.000.000/0001-00`) que retornarão erro "CNPJ inválido"
- Considerar mock de resposta no service layer

### 14.4 Validação em QA

Para o módulo de tracking:
- Mapa carrega mesmo sem coordenadas reais (fallback visual)
- Geocoding de endereços usa ViaCEP (público, sem token)
- Rotas (Mapbox Directions) não serão testadas em QA — usar dados mock

---

## 15. Estratégia de Seed

### 15.1 Abordagem Minimalista

Semear **apenas o necessário** para executar os 97 cenários de teste da Matriz QA. Sem bulk de 50 veículos ou 10 clientes.

### 15.2 Ordem de Seed

```sql
-- 1. Já executado (seção 9): Tenant QA + tenant_usuarios

-- 2. Cliente QA (1)
INSERT INTO clientes (id, tenant_id, razao_social, nome_fantasia, cnpj, status, email, telefone)
VALUES (
  gen_random_uuid(), '<tenant_qa_id>',
  'QA Testes Logística Ltda', 'QA Express Logística',
  '11.111.111/0001-01', 'ativo',
  'qa-cliente@conexaoexpress.com.br', '(11) 90000-0001'
);

-- 3. Prestador QA (1)
INSERT INTO prestadores (id, tenant_id, nome, cpf_cnpj, status, email, telefone)
VALUES (
  gen_random_uuid(), '<tenant_qa_id>',
  'QA Motorista Exemplar', '111.111.111-11', 'ativo',
  'qa-prestador@conexaoexpress.com.br', '(11) 90000-0002'
);

-- 4. Veículo QA (1)
INSERT INTO veiculos (id, tenant_id, placa, renavam, marca, modelo, ano_fabricacao, prestador_vinculado)
VALUES (
  gen_random_uuid(), '<tenant_qa_id>',
  'QA0T01', '000000001', 'VW', 'Delivery 11.180', 2024,
  (SELECT id FROM prestadores WHERE nome = 'QA Motorista Exemplar' LIMIT 1)
);

-- 5. OS QA (1)
INSERT INTO ordens_servico (id, tenant_id, cliente, status, descricao, valor_total)
VALUES (
  gen_random_uuid(), '<tenant_qa_id>',
  (SELECT id FROM clientes WHERE nome_fantasia = 'QA Express Logística' LIMIT 1),
  'pendente', 'QA - Transporte de materiais de teste', 150.00
);

-- 6. Alocação QA (1)
INSERT INTO alocacoes_escala (
  id, tenant_id, os_id, prestador_id, veiculo_id, cliente_id,
  status, data_inicio, data_fim, valor_cliente, valor_prestador,
  origem, destino, observacao
)
VALUES (
  gen_random_uuid(), '<tenant_qa_id>',
  (SELECT id FROM ordens_servico LIMIT 1),
  (SELECT id FROM prestadores LIMIT 1),
  (SELECT id FROM veiculos LIMIT 1),
  (SELECT id FROM clientes LIMIT 1),
  'pendente', now(), now() + interval '1 day',
  150.00, 100.00,
  '{"cidade": "São Paulo", "uf": "SP"}',
  '{"cidade": "Guarulhos", "uf": "SP"}',
  'QA - Alocação de teste'
);

-- 7. Financeiro gerado automaticamente pelo trigger M66
-- (alocação pendente cria financeiro_receber + financeiro_pagar + pagamentos_prestadores)
```

### 15.3 Script de Seed Automatizado

Criar `scripts/seed-qa.mjs` (node + pg client) com:
1. Conexão ao banco QA
2. Criação do tenant QA (se não existir)
3. Criação dos usuários QA (se não existirem)
4. Criação dos registros de seed
5. Log de cada etapa com UUIDs gerados
6. Verificação pós-seed (SELECT COUNT de cada tabela)

### 15.4 Prefixo Obrigatório

Todos os registros QA devem conter o prefixo `QA` em campos identificáveis:
- `clientes.nome_fantasia`: `QA Express Logística`
- `prestadores.nome`: `QA Motorista Exemplar`
- `veiculos.placa`: `QA0T01`
- `alocacoes_escala.observacao`: `QA - ...`
- `ordens_servico.descricao`: `QA - ...`

Isso permite limpeza fácil (seção 16).

---

## 16. Estratégia de Limpeza

### 16.1 Script de Limpeza

Criar `scripts/cleanup-qa.mjs` com:

```sql
BEGIN;

-- Remover em ordem inversa (evitar FK violations)
DELETE FROM pagamentos_prestadores WHERE observacao LIKE 'QA -%';
DELETE FROM financeiro_pagar WHERE observacao LIKE 'QA -%';
DELETE FROM financeiro_receber WHERE observacao LIKE 'QA -%';
DELETE FROM composicao_financeira_os WHERE observacao LIKE 'QA -%';
DELETE FROM alocacoes_escala WHERE observacao LIKE 'QA -%';
DELETE FROM historico_alocacoes_escala WHERE observacao LIKE 'QA -%';
DELETE FROM ordens_servico WHERE descricao LIKE 'QA -%';
DELETE FROM entregas_protocolo WHERE observacao LIKE 'QA -%';
DELETE FROM veiculos WHERE placa LIKE 'QA%';
DELETE FROM prestadores WHERE nome LIKE 'QA %';
DELETE FROM clientes WHERE nome_fantasia LIKE 'QA %';

-- Limpar dados de portal_cliente
DELETE FROM portal_pedidos WHERE observacao LIKE 'QA -%';
DELETE FROM portal_ocorrencias WHERE descricao LIKE 'QA -%';
DELETE FROM portal_avaliacoes WHERE comentario LIKE 'QA -%';

-- Limpar dados de IA (se houver)
DELETE FROM memoria_entidades WHERE nome LIKE 'QA %';
DELETE FROM ia_execucoes_ferramentas WHERE observacao LIKE 'QA -%';
DELETE FROM ia_logs WHERE mensagem LIKE 'QA -%';

COMMIT;
```

### 16.2 Frequência

- **Antes de cada seed:** Executar limpeza completa (garantir estado inicial)
- **Após cada bateria de testes Playwright:** Executar limpeza dos dados criados pelos testes
- **Semanalmente:** Limpeza completa + reseed

### 16.3 Modo de Uso

```bash
node scripts/cleanup-qa.mjs
# Confirma: "Isso removerá todos os dados QA. Continuar? (s/N)"
```

### 16.4 Proteção Contra Execução em Produção

O script deve verificar o tenant_id ou o nome do banco:
```js
const res = await client.query("SELECT current_database()");
if (res.rows[0].current_database !== 'tms-qa') {
  console.error('ERRO: Script só pode ser executado no banco QA');
  process.exit(1);
}
```

---

## 17. Backup

### 17.1 Frequência

| Tipo | Frequência | Retenção |
|------|------------|----------|
| Automático (Supabase) | Diário | 7 dias |
| Manual pré-seed | Antes de cada seed | Até próxima seed |
| Manual pré-migration | Antes de cada `db push` | 24h após validação |

### 17.2 Backup Manual

```bash
# Backup via pg_dump
PGPASSWORD=<senha> pg_dump \
  -h <qa-project-ref>.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -F c \
  -f "backups/qa-pre-seed-$(date +%Y%m%d_%H%M%S).dump"

# Backup via Supabase CLI
npx supabase db dump --linked --file "backups/qa-pre-seed-$(date +%Y%m%d_%H%M%S).sql"
```

### 17.3 Restauração

```bash
# Restaurar backup
PGPASSWORD=<senha> pg_restore \
  -h <qa-project-ref>.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  --clean \
  "backups/qa-pre-seed-20260723_140000.dump"

# Ou via arquivo SQL
PGPASSWORD=<senha> psql \
  -h <qa-project-ref>.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f "backups/qa-pre-seed-20260723_140000.sql"
```

### 17.4 Diretório de Backups

```bash
mkdir -p backups/qa
```

Adicionar `backups/qa/*.dump` e `backups/qa/*.sql` ao `.gitignore`.

---

## 18. Rollback

### 18.1 Rollback de Migration

Se `supabase db push` aplicar uma migration que cause problemas:

**Cenário 1 — A migration ainda não foi commitada no git:**
```bash
# Reverter via Supabase CLI (se disponível)
npx supabase db pull # baixa schema atual
npx supabase db diff --from-local # mostra diferenças

# Reverter manualmente
# Editar a migration problemática e executar o inverso
```

**Cenário 2 — A migration já está no banco e precisa ser desfeita:**
```sql
-- Exemplo: reverter ADD COLUMN
ALTER TABLE clientes DROP COLUMN IF EXISTS coluna_problematica;

-- Exemplo: reverter DROP COLUMN (requer recriar)
ALTER TABLE clientes ADD COLUMN coluna_original tipo_dado;

-- Exemplo: reverter CREATE TABLE
DROP TABLE IF EXISTS tabela_problematica CASCADE;

-- Exemplo: reverter CREATE FUNCTION
DROP FUNCTION IF EXISTS funcao_problematica CASCADE;
```

**Cenário 3 — Rollback completo (pior caso):**
```bash
# 1. Fazer restore do backup pré-migration
# 2. Aplicar migrations manualmente até a anterior à problemática
# 3. Pular a migration problemática e continuar

# Restaurar
PGPASSWORD=<senha> pg_restore ... backups/qa-pre-migration-20260723.dump

# Aplicar migrations manualmente (exceto a problemática)
ls supabase/migrations/*.sql | sort | while read f; do
  if [ "$f" != "supabase/migrations/202608XX_migration_problematica.sql" ]; then
    PGPASSWORD=<senha> psql ... -f "$f"
  fi
done
```

### 18.2 Registro de Migrations

O Supabase CLI mantém um registro em `supabase/migrations/` — cada arquivo é aplicado uma vez. Se uma migration falhar:

```bash
# Verificar quais migrations foram aplicadas
npx supabase db status

# Remover migration do registro (se aplicada parcialmente)
# ATENÇÃO: operação manual no banco
DELETE FROM supabase_migrations.schema_migrations 
WHERE name = '202608XX_migration_problematica.sql';
```

### 18.3 Rollback de Seed

Para reverter o seed, executar o script de limpeza (seção 16) e re-aplicar o seed limpo.

### 18.4 Rollback de Configurações

As configurações de `.env.qa` são versionadas no git. Rollback de configuração = `git checkout` do arquivo anterior + restart do dev server.

---

## 19. Plano de Execução

### 19.1 Pré-requisitos

- [ ] Conta Supabase com permissão para criar projeto
- [ ] Supabase CLI instalado (`npm install -g supabase`)
- [ ] Acesso ao gerenciador de senhas corporativo
- [ ] PostgreSQL client (`psql`) ou `node-pg` installado
- [ ] Scripts de seed e limpeza escritos

### 19.2 Passo a Passo

| Fase | Atividade | Duração estimada |
|------|-----------|------------------|
| 1 | Criar projeto Supabase `tms-qa` + anotar URLs/keys | 15 min |
| 2 | Configurar Auth (URLs, providers, templates) | 10 min |
| 3 | Criar bucket Storage | 5 min |
| 4 | Aplicar migrations via `supabase db push` | 30 min |
| 5 | Verificar migrations + triggers + RLS | 15 min |
| 6 | Fazer deploy das Edge Functions + secrets | 10 min |
| 7 | Criar usuários QA no Supabase Auth | 10 min |
| 8 | Executar seed (tenant + dados) | 5 min |
| 9 | Configurar `.env.qa` no projeto frontend | 5 min |
| 10 | Testar login com usuário QA | 5 min |
| 11 | Executar testes Playwright contra QA | 30 min |
| **Total** | | **~2h** |

### 19.3 Arquivos a Criar

| Arquivo | Finalidade |
|---------|------------|
| `scripts/seed-qa.mjs` | Seed automatizado |
| `scripts/cleanup-qa.mjs` | Limpeza de dados QA |
| `.env.qa` | Variáveis de ambiente para QA |
| `playwright.qa.config.ts` | Config Playwright para QA (opcional) |
| `backups/qa/.gitkeep` | Diretório de backups |

### 19.4 Verificação Final

Após a execução, rodar a checklist em `AMBIENTE_QA_CHECKLIST.json` e marcar cada item como `ok` ou `falha`.
