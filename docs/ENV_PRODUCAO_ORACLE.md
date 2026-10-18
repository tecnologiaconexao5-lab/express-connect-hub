# Configuração .env.production — Oracle Cloud

## Arquivo

`.env.production` na raiz do projeto (copiar para `.env` no servidor).

## Variáveis Obrigatórias

| Variável | Descrição | Status |
|----------|-----------|--------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | ✅ Preenchida |
| `VITE_SUPABASE_ANON_KEY` | Anon key do Supabase | ✅ Preenchida |
| `VITE_MAPBOX_ACCESS_TOKEN` | Token Mapbox (público) | ✅ Preenchido |
| `VITE_MAPBOX_TOKEN` | Token Mapbox (público) | ✅ Preenchido |

## Variáveis que Exigem Configuração Manual

> **IMPORTANTE**: Nunca commitar secrets reais. Preencher no servidor via SSH.

| Variável | Onde Obter | Segurança |
|----------|-----------|-----------|
| `VITE_EVOLUTION_API_KEY` | Evolution API dashboard | Chave do servidor WhatsApp |
| `VITE_ZOHO_REFRESH_TOKEN` | `npx tsx scripts/zoho_setup_oauth.ts` | Rotacionar a cada 90d |
| `VITE_ZOHO_ACCOUNT_ID` | GET `/api/accounts` no Zoho API | ID público (numérico) |
| `VITE_GROQ_API_KEY` | https://console.groq.com | Rotacionar a cada 90d |
| `VITE_GEMINI_API_KEY` | https://aistudio.google.com | Rotacionar a cada 90d |
| `VITE_ADMIN_DELETE_PASSWORD` | Gerar senha forte aleatória | Manter em cofre |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | **NUNCA no frontend** |

## Modo dos Conectores

```env
VITE_ZOHO_MODE=assistido       # homologacao | assistido | producao
VITE_WHATSAPP_MODE=assistido   # homologacao | assistido | producao
```

- **homologacao**: simulado, nenhuma API externa chamada
- **assistido**: tenta real, fallback suave se falhar
- **producao**: real direto, erros são hard errors

## Demo Mode

```env
VITE_AUTH_DEMO_MODE=false
```

`false` em produção. Apenas `true` para desenvolvimento local sem Supabase Auth.

## Fluxo de Atualização

```bash
# 1. SSH no servidor
ssh usuario@oracle-vm

# 2. Editar .env
nano /opt/express-connect-hub/.env

# 3. Rebuild e restart
cd /opt/express-connect-hub
docker build -t express-connect-hub .
docker stop tms && docker rm tms
docker run -d --name tms --restart always -p 80:80 express-connect-hub
```
