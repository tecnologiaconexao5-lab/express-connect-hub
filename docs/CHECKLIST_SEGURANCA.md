# Checklist Segurança — Go Live

## Variáveis Sensíveis — Classificação

### ✅ Pode ficar no frontend (bundle público)

| Variável | Risco | Motivo |
|----------|-------|--------|
| `VITE_SUPABASE_URL` | Baixo | URL pública do projeto |
| `VITE_SUPABASE_ANON_KEY` | Baixo | Chave anônima (RLS protege) |
| `VITE_MAPBOX_ACCESS_TOKEN` | Baixo | Token público (domain-restricted) |
| `VITE_MAPBOX_TOKEN` | Baixo | Token público |
| `VITE_APP_URL` | Baixo | URL pública |
| `VITE_AUTH_DEMO_MODE` | Baixo | Flag booleana |
| `VITE_WHATSAPP_MODE` | Baixo | Flag de modo |
| `VITE_ZOHO_MODE` | Baixo | Flag de modo |
| `VITE_AI_PROVIDER` | Baixo | Nome do provider |
| `VITE_WHATSAPP_HOMOLOG_ENABLED` | Baixo | Flag booleana |
| `VITE_COMUNICACAO_PRODUCAO_ASSISTIDA` | Baixo | Flag booleana |
| `VITE_WHATSAPP_PRODUCAO_ENABLED` | Baixo | Flag booleana |
| `VITE_WHATSAPP_ALLOWED_SETORES` | Médio | Config de setores |
| `VITE_WHATSAPP_DAILY_LIMIT` | Baixo | Limite numérico |
| `VITE_WHATSAPP_ALLOWED_HOURS_START` | Baixo | Horário |
| `VITE_WHATSAPP_ALLOWED_HOURS_END` | Baixo | Horário |
| `VITE_EVOLUTION_INSTANCE_NAME` | Baixo | Nome da instância |
| `VITE_EVOLUTION_SERVER_URL` | Médio | URL do server |
| `VITE_EVOLUTION_INSTANCE` | Baixo | Nome instância |
| `VITE_ZOHO_ACCOUNT_ID` | Baixo | ID da conta |
| `VITE_ZOHO_DATA_CENTER` | Baixo | Data center |
| `VITE_ZOHO_EMAIL_FROM` | Baixo | Email remetente |
| `VITE_SUPABASE_PROJECT_ID` | Baixo | ID do projeto |
| `VITE_N8N_API_URL` | Médio | URL do n8n |
| `VITE_N8N_WEBHOOK_URL` | Médio | URL base webhooks |
| `VITE_EVOLUTION_API_URL` | Médio | URL da Evolution |

### ❌ Nunca deve ficar no frontend (apenas backend/ambiente)

| Variável | Risco | Motivo |
|----------|-------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Crítico** | Acesso total ao banco (bypass RLS) |
| `VITE_GROQ_API_KEY` | Alto | Chave de API Groq (rate limit, custo) |
| `VITE_GEMINI_API_KEY` | Alto | Chave de API Gemini |
| `VITE_OPENAI_API_KEY` | Alto | Chave de API OpenAI |
| `VITE_OPENROUTER_API_KEY` | Alto | Chave de API OpenRouter |
| `VITE_EVOLUTION_API_KEY` | Alto | Chave da Evolution (WhatsApp) |
| `VITE_ZOHO_CLIENT_ID` | Alto | OAuth2 client ID |
| `VITE_ZOHO_CLIENT_SECRET` | **Crítico** | OAuth2 client secret |
| `VITE_ZOHO_REFRESH_TOKEN` | **Crítico** | Refresh token Zoho (acesso email) |
| `VITE_N8N_ENCRYPTION_KEY` | **Crítico** | Chave de criptografia n8n |
| `VITE_ADMIN_DELETE_PASSWORD` | Alto | Senha de deleção |
| `VITE_TMS_EDGE_INTERNAL_TOKEN` | Alto | Token interno |
| `VITE_WHATSAPP_HOMOLOG_ALLOWLIST` | Médio | Lista de números permitidos |

## Estado Atual

| Item | Status | Observação |
|------|--------|------------|
| Service Role Key no .env | ⚠️ Presente | Apenas para scripts locais, não entra no bundle Vite |
| Chaves IA no .env.production | ⚠️ Presentes | Necessárias no bundle (usadas por VITE_) |
| Chave Evolution no .env.production | ⚠️ Presente | Necessária no bundle |
| Zoho secrets no .env.production | ⚠️ Presentes | Necessárias no bundle |
| `VITE_AUTH_DEMO_MODE` = `false` | ✅ | Desabilitado para produção |
| Frontend expõe apenas `VITE_*` | ✅ | Padrão Vite (não expõe `SUPABASE_*` não-VITE) |
| Service Role não tem `VITE_` prefix | ✅ | Correto — não entra no bundle |

## Recomendações

1. **Migrar chaves IA para backend** (n8n ou edge functions) para não expor no bundle — futuro P4
2. **Rotacionar chaves** antes do go-live (todas as chaves atuais estão no .env.production)
3. **Service Role Key** nunca versionar em git — já está em `.env` (gitignored) e `.env.production` (gitignored)
4. **Adicionar WAF Rule** no Cloudflare para bloquear acesso direto à Evolution API pelo IP
5. **Adicionar Rate Limiting** no login (10 req/60s)
