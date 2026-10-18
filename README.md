# Express Connect Hub — TMS

Sistema de Transporte e Logística com Funcionários Digitais Autônomos.

## Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Infra:** Vercel (frontend), Oracle Cloud (serviços), Cloudflare (CDN/WAF)
- **Automação:** n8n, Evolution API (WhatsApp), Agentes IA

## Documentos de Deploy

| Documento | Descrição |
|-----------|-----------|
| [`docs/DEPLOY_VERCEL_FINAL.md`](docs/DEPLOY_VERCEL_FINAL.md) | Deploy frontend no Vercel com variáveis de ambiente |
| [`docs/CLOUDFLARE_FINAL.md`](docs/CLOUDFLARE_FINAL.md) | Configuração DNS, SSL, WAF, cache, Workers |
| [`docs/DEPLOY_ORACLE.md`](docs/DEPLOY_ORACLE.md) | Deploy dos serviços Oracle (Evolution, n8n, Redis) |
| [`docs/IMPLANTACAO_PRODUCAO.md`](docs/IMPLANTACAO_PRODUCAO.md) | Passo a passo completo de implantação |
| [`docs/TOPOLOGIA_FINAL.md`](docs/TOPOLOGIA_FINAL.md) | Arquitetura final e fluxo de requisição |
| [`docs/PLANO_BACKUP.md`](docs/PLANO_BACKUP.md) | Backup e restauração de todos os componentes |
| [`docs/ROLLBACK.md`](docs/ROLLBACK.md) | Plano de contingência para cada camada |
| [`docs/HEALTHCHECKS.md`](docs/HEALTHCHECKS.md) | Monitoramento e scripts de healthcheck |

### Docker Production
- [`docker-compose.production.yml`](docker-compose.production.yml) — Orquestração dos serviços Oracle em produção

## Scripts

```bash
npm run dev              # Dev server :8800
npm run build            # Build produção
npm run typecheck        # TypeScript check
npm run test             # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run deploy:check     # typecheck + build
```

## Estrutura

```
src/
├── components/    # UI components (shadcn/ui)
├── pages/         # Rotas da aplicação
├── services/      # Lógica de negócio
│   └── ia/        # Serviços de IA e automação
├── hooks/         # React hooks
├── lib/           # Utilitários
└── types/         # Types
```
