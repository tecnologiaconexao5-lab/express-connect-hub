# Manual Técnico Enterprise — Express Connect Hub / TMS

> **Versão:** 3.0 | **Data:** 2026-06-26 | **Público:** Equipe Técnica

---

## 1. Arquitetura do Sistema

### Stack
```
Frontend:  React 18 + Vite 5 + TypeScript 5.8 + Tailwind 3 + shadcn/ui
Backend:   Supabase (PostgreSQL 15 + Edge Functions)
IA:        Multi-provider (Groq, Gemini, OpenAI, Anthropic, OpenRouter)
Mapas:     Mapbox GL JS 3.20
PDF:       jsPDF + jspdf-autotable
Testes:    Vitest (unit) + Playwright 1.57 (E2E)
Runtime:   Node.js 22 + PM2 (Zoho OAuth server)
```

### Estrutura de Diretórios
```
src/
├── components/     # 200+ componentes React
│   ├── ui/         # 50+ componentes shadcn/ui
│   ├── ia/         # 13 abas do Central IA
│   ├── operacao/   # OS, Escala, POD, Roteirização
│   ├── financeiro/ # 27 componentes financeiros
│   ├── fiscal/     # 23 componentes fiscais (CT-e, MDF-e, NFS-e)
│   ├── comercial/  # CRM, Orçamentos, Propostas
│   └── ...
├── services/       # ~130 serviços
│   ├── ia/         # 34 serviços de IA (action engine, governance, etc.)
│   │   └── providers/  # ZohoMail, WhatsApp, Vagas, SocialMedia, GoogleAds
│   ├── fiscal/     # 14 serviços fiscais
│   ├── financeiro/ # Cálculo, composição, inadimplência, auditoria
│   ├── escala/     # Escala, mapper, adapters
│   └── ...
├── pages/          # 42 rotas
├── hooks/          # 11 hooks (useEscala, useEscalaRealtime, etc.)
├── lib/            # supabase client, auth, permissoes, pdf
├── types/          # Tipos compartilhados
├── helpers/        # 12 funções auxiliares
└── stores/         # 3 stores Zustand
```

---

## 2. Banco de Dados

### Tabelas Core (~100 tabelas)

| Schema | Principais Tabelas |
|--------|-------------------|
| **CRM** | `crm_leads`, `crm_historico`, `crm_followups`, `crm_interacoes_prestadores` |
| **Cadastros** | `clientes`, `prestadores`, `veiculos`, `filiais` |
| **Operação** | `ordens_servico`, `alocacoes_escala`, `historico_alocacoes_escala`, `entregas_protocolo` |
| **Financeiro** | `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os`, `contas_financeiras` |
| **Fiscal** | `fiscal_ctes`, `fiscal_nfse`, `fiscal_mdfes`, `fiscal_historico_status`, `regras_fiscais_cte`, `regras_fiscais_nfse` |
| **Portal** | `portal_pedidos`, `portal_ocorrencias`, `portal_faturas`, `portal_tracking_realtime` |
| **Contratos** | `contratos_gerados`, `contratos_modelos`, `contratos_historico` |
| **IA** | `automacoes_robos`, `ia_ferramentas`, `ia_execucoes_ferramentas`, `ia_conectores`, `ia_missoes`, `ia_metas`, `ia_trabalhos`, `memoria_entidades`, etc. (40+ tabelas) |

### Relacionamento Principal
```
clientes ──→ ordens_servico ──→ alocacoes_escala ──→ historico_alocacoes_escala
                │                      │
                ├──→ financeiro_receber│
                ├──→ pagamentos_prestadores
                ├──→ composicao_financeira_os
                ├──→ fiscal_ctes
                └──→ fiscal_nfse

prestadores ──→ alocacoes_escala
                └──→ pagamentos_prestadores
```

---

## 3. Fluxos Principais

### 3.1 Criação de OS
```
Orcamento aprovado OU Form direto
  → verificarInadimplenciaCliente()
  → INSERT ordens_servico
  → sincronizarComEscala() → INSERT alocacoes_escala
  → sincronizarFinanceiroOS() → INSERT financeiro_receber + pagamentos_prestadores + composicao_financeira_os
```

### 3.2 Ciclo de Vida da Escala
```
planejada → aguardando_aceite → aceita → em_rota → concluida
                ↓                            ↓
            recusada                     ocorrencia
                
Qualquer estado → cancelada
```

### 3.3 Fechamento Financeiro
```
Alocação concluída + finalizada=true
  → Trigger SQL: f_trg_propagar_financeiro_alocacao()
  → TypeScript: sincronizarFinanceiroOSAlocacao()
  → Ambos escrevem em: financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os
```

---

## 4. Comandos de Manutenção

### TypeScript
```bash
npx tsc --noEmit          # Verificar tipos
npm run build             # Build produção
npm run dev               # Dev server (porta 8800)
```

### Testes
```bash
npx vitest run            # Testes unitários
npx playwright test       # Testes E2E (350+ specs)
npx playwright test --headed  # Com browser visível
```

### Supabase
```bash
npx supabase db push --include-all   # Aplicar migrations
npx supabase db diff                 # Gerar migration de mudanças
```

### Scripts de Auditoria
```bash
npx tsx scripts/f_p0_test_ativacao.ts
npx tsx scripts/f_p1_test_execucao_real.ts
npx tsx scripts/auditoria-financeiro-final.ts
npx tsx scripts/auditoria-fluxo-operacional-final.ts
```

---

## 5. Variáveis de Ambiente (.env)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service_role (secreta) |
| `VITE_MAPBOX_ACCESS_TOKEN` | Sim | Token Mapbox |
| `VITE_TMS_EDGE_INTERNAL_TOKEN` | Sim | Token interno TMS |
| `VITE_EVOLUTION_API_URL` | Não* | URL Evolution API (WhatsApp) |
| `VITE_EVOLUTION_API_KEY` | Não* | Chave Evolution API |
| `VITE_ZOHO_CLIENT_ID` | Não* | Zoho OAuth Client ID |
| `VITE_ZOHO_CLIENT_SECRET` | Não* | Zoho OAuth Client Secret |
| `VITE_GROQ_API_KEY` | Não* | Groq API (LLM) |
| `VITE_GEMINI_API_KEY` | Não* | Gemini API (LLM) |

*Necessário apenas para funcionalidades específicas (WhatsApp, Email, IA)

---

## 6. Troubleshooting

### Build quebrado
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Erro de tipo TypeScript
```bash
npx tsc --noEmit --pretty
# Verificar arquivo e linha do erro
```

### Supabase RLS bloqueando
```sql
-- Verificar políticas de uma tabela
SELECT tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'nome_da_tabela';

-- Desabilitar RLS temporariamente (APENAS DEV)
ALTER TABLE nome_da_tabela DISABLE ROW LEVEL SECURITY;
```

### Trigger vs TypeScript conflito
Se houver duplicatas em tabelas financeiras:
```sql
-- Verificar duplicatas
SELECT os_id, COUNT(*) FROM financeiro_receber GROUP BY os_id HAVING COUNT(*) > 1;

-- Remover duplicatas (mantém a mais recente)
DELETE FROM financeiro_receber a
USING financeiro_receber b
WHERE a.created_at < b.created_at AND a.os_id = b.os_id;
```

### Playwright timeout
```bash
# Aumentar timeout
npx playwright test --timeout=120000

# Rodar specs específicas
npx playwright test -g "Fluxo completo"
```

---

## 7. Deployment

### Produção (Vercel)
```bash
npm run build
# Deploy da pasta dist/
```

### Supabase Edge Functions
```bash
cd supabase/functions/nome-da-funcao
npm install
# Deploy via Supabase Dashboard ou CLI
npx supabase functions deploy nome-da-funcao
```

### PM2 (Zoho OAuth Server)
```bash
npm run zoho:start     # Iniciar
npm run zoho:stop      # Parar
npm run zoho:restart   # Reiniciar
npm run zoho:logs      # Ver logs
```

---

## 8. Monitoramento

### Health Check
- Build: `npm run build` (deve passar)
- TypeScript: `npx tsc --noEmit` (0 erros)
- Playwright: `npx playwright test` (sem regressões)
- Supabase: Verificar conexão no dashboard

### Logs
- `ia_logs`: Logs de ações da IA
- `ia_governanca_log`: Decisões de governança
- `ia_execucoes_ferramentas`: Execuções de ferramentas
- `ia_execucoes_conectores`: Execuções de conectores externos
- `financeiro_receber_audit`: Alterações em registros financeiros

---

## 9. Pontos de Atenção

### RLS (SEGURANÇA CRÍTICA)
Após qualquer migration, verificar:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;
```

### Margem Financeira
A margem no dashboard considera apenas `valor_cliente - valor_prestador - pedagio`. Custos como combustível e ajudantes NÃO são deduzidos na `composicao_financeira_os`. Usar `engineFinanceira.ts` para margem real.

### Dupla Escrita Trigger vs TypeScript
Qualquer alteração em `alocacoes_escala` com `status='concluida' AND finalizada=true` dispara DOIS caminhos de escrita financeira. Verificar duplicatas regularmente.

---

*Documento gerado para equipe técnica — OpenCode Go Pro*
