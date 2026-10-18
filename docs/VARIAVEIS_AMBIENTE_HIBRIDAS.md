# Variáveis de Ambiente — Ambientes Múltiplos

## Projetos Supabase

| Ambiente | Project Ref | URL |
|----------|-------------|-----|
| Produção | `uwrvzsjtpgaifkktpepn` | `https://uwrvzsjtpgaifkktpepn.supabase.co` |
| QA | `aqpfayildtcnrkfeeyjg` | `https://aqpfayildtcnrkfeeyjg.supabase.co` |
| Desenvolvimento | _(mesmo da produção)_ | `https://uwrvzsjtpgaifkktpepn.supabase.co` |

## Como o Vite carrega os arquivos .env

Vite carrega arquivos `.env` automaticamente baseado no **mode**:

1. `.env` — **sempre** carregado (base, menor prioridade)
2. `.env.local` — **sempre** carregado (sobrescreve .env)
3. `.env.[mode]` — carregado quando `--mode [mode]` é passado
4. `.env.[mode].local` — carregado quando `--mode [mode]` é passado (maior prioridade)

## Scripts disponíveis

| Comando | Mode | .env carregado | Ambiente |
|---------|------|----------------|----------|
| `npm run dev` | `development` | .env + .env.development | Desenvolvimento |
| `npm run dev:qa` | `qa` | .env + .env.qa | QA |
| `npm run dev:production` | `production` | .env + .env.production | Produção |
| `npm run build` | `production` | .env + .env.production | Produção |
| `npm run build:qa` | `qa` | .env + .env.qa | QA |
| `npm run build:dev` | `development` | .env + .env.development | Desenvolvimento |

## Como iniciar

### Produção (produção atual - inalterada)
```bash
npm run dev
# ou
npm run build
# ou
npm run dev:production
```

### QA
```bash
npm run dev:qa
# ou
npm run build:qa
```

### Desenvolvimento
```bash
npm run dev
# mode=development carrega .env.development
```

## Guard rails

Antes de qualquer script, execute a verificação de ambiente:

```bash
npm run check:env
```

Para Playwright em QA:
```bash
npm run playwright:qa
```

## Variáveis de ambiente por ambiente

| Variável | Produção | QA | Desenvolvimento |
|----------|:--------:|:--:|:---------------:|
| `ENVIRONMENT` | production | qa | development |
| `VITE_SUPABASE_URL` | `uwrvzsjtpgaifkktpepn` | `aqpfayildtcnrkfeeyjg` | _(mesmo produção)_ |
| `VITE_WHATSAPP_PRODUCAO_ENABLED` | true | false | false |
| `VITE_COMUNICACAO_PRODUCAO_ASSISTIDA` | true | false | false |
