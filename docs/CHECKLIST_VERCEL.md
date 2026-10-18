# Checklist Vercel — Go Live

## 1. Variáveis de Ambiente

- [ ] `VITE_SUPABASE_URL` configurada
- [ ] `VITE_SUPABASE_ANON_KEY` configurada
- [ ] `VITE_MAPBOX_ACCESS_TOKEN` configurado
- [ ] `VITE_MAPBOX_TOKEN` configurado
- [ ] `VITE_APP_URL` apontando para `https://tms.conexaoexpress.com.br`
- [ ] `VITE_AUTH_DEMO_MODE=false`
- [ ] `VITE_WHATSAPP_PRODUCAO_ENABLED=false` (ou true se configurado)
- [ ] `VITE_WHATSAPP_MODE` definido
- [ ] `VITE_ZOHO_MODE` definido
- [ ] `VITE_AI_PROVIDER` definido
- [ ] Chaves IA (`VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY`, etc.) configuradas
- [ ] `VITE_EVOLUTION_API_KEY` configurada
- [ ] `VITE_TMS_EDGE_INTERNAL_TOKEN` configurado

## 2. Deploy

- [ ] `git push origin main` dispara deploy automático
- [ ] Build passa (0 erros)
- [ ] Output `dist/` gerado corretamente
- [ ] Página carrega no domínio Vercel (`*.vercel.app`)
- [ ] Rotas SPA funcionam (navegação direta não dá 404)
- [ ] Assets JS/CSS carregam (HTTP 200)
- [ ] `vercel.json` com SPA rewrite presente

## 3. Rollback

- [ ] Dashboard Vercel acessível
- [ ] Deployments visíveis no histórico
- [ ] Função "Promote to Production" disponível
- [ ] `git revert` documentado em `docs/ROLLBACK.md`

## 4. Verificação do Domínio

- [ ] Domínio `tms.conexaoexpress.com.br` adicionado no Vercel
- [ ] SSL automático ativo
- [ ] CNAME apontado no Cloudflare
- [ ] Proxy Cloudflare laranja (☁️) ativo

## 5. Cache

- [ ] Vercel Edge Cache padrão ativo
- [ ] Cache rules no Cloudflare para assets (7 dias)
- [ ] Cache bypass para API
- [ ] Headers de cache adequados (Vercel gerencia automaticamente)

## 6. Segurança

- [ ] `VITE_AUTH_DEMO_MODE=false` (desabilita modo demo)
- [ ] Variáveis sensíveis marcadas como secret no Vercel
- [ ] Logs de deploy sem expor secrets

## 7. Pós-deploy

- [ ] Console sem erros (F12)
- [ ] Login real funcional
- [ ] Navegação entre todas as abas sem erro
- [ ] Performance Lighthouse ≥ 80 desktop
