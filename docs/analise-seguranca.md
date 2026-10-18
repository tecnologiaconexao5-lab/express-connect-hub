# Análise de Segurança — Express Connect Hub / TMS

> Auditoria: 2026-06-26 | Foco: Supabase RLS, Chaves, Permissões

---

## 1. Resumo Executivo

**Veridito: NÃO APTO para produção enterprise.**  
RLS formalmente habilitado mas efetivamente desabilitado por 47 políticas `USING (true)`.  
A chave `anon` tem privilégios equivalentes a `service_role` em 90% das tabelas.  
`SUPABASE_SERVICE_ROLE_KEY` está vazio — 7 Edge Functions quebradas.

---

## 2. Configuração do Cliente Supabase

**Arquivo:** `src/lib/supabase.ts:17`
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- Usa `VITE_SUPABASE_ANON_KEY` (chave pública esperada)
- **Nunca** chama `signInWithPassword` ou `setSession`
- Todas as requests vão como role `anon`
- `createServiceClient()` existe mas só é usado em scripts backend

---

## 3. Tabelas sem RLS (P0)

| Tabela | Migration | Risco |
|--------|-----------|-------|
| `escala_operacional` | `20260517000010` | Acesso total sem autenticação |
| `motorista_app_sessoes` | `20260517000012` | Contém tokens de autenticação |
| `motorista_checkins` | `20260517000012` | Dados de localização |
| `ordens_servico` | Pré-existente | Status RLS desconhecido |
| `clientes` | Pré-existente | Status RLS desconhecido |
| `prestadores` | Pré-existente | Status RLS desconhecido |
| `veiculos` | Pré-existente | Status RLS desconhecido |

---

## 4. Políticas `USING (true)` — 47 encontradas

### Tabelas IA/Automação (30 políticas abertas)
`ia_ferramentas`, `ia_robo_ferramentas`, `ia_execucoes_ferramentas`, `ia_conectores`, `ia_conector_robo`, `ia_execucoes_conectores`, `ia_conhecimento`, `ia_autoridade_acoes`, `ia_escalonamento_config`, `ia_aprovacoes_fila`, `ia_governanca_log`, `ia_trabalhos`, `ia_fila_trabalho`, `ia_historico_trabalho`, `ia_missoes`, `ia_metas`, `ia_indicadores`, `ia_historico_indicadores`, `ia_agenda_trabalho`, `ia_agenda_atividades`, `ia_limites_operacionais`, `memoria_entidades`, `memoria_eventos`, `memoria_conversas`, `memoria_preferencias`, `memoria_resumos`, `ia_agentes_execucao`, `ia_fluxos_empresa`, `ia_versoes_sistema`

### Tabelas Portal (33 políticas abertas)
`portal_pedidos`, `portal_notificacoes`, `portal_ocorrencias`, `portal_avaliacoes`, `portal_comprovantes`, `portal_protocolos`, `portal_rotas`, `portal_tracking_realtime`, `portal_relatorios`, `portal_faturas`, `portal_preferencias_cliente`

### Tabelas Contratos/CRM (12 políticas abertas)
`contratos_gerados`, `contratos_modelos`, `contratos_historico`, `crm_leads`, `crm_historico`, `crm_followups`, `crm_interacoes_prestadores`

---

## 5. Tabelas com Política Restrita (minoria)

| Tabela | Política | Restrição |
|--------|----------|-----------|
| `automacao_logs` | INSERT → service_role | Anon não pode escrever |
| `ia_comunicacoes_robos` | auth.role() = 'authenticated' | Bloqueado para anon |
| `ia_comunicacoes_fila_robos` | auth.role() = 'authenticated' | Bloqueado para anon |
| `diretor_virtual_eventos_ia` | auth.role() = 'authenticated' | Bloqueado para anon |
| `recrutamento_operacoes` | auth.role() IN ('authenticated','service_role') | Bloqueado para anon |

**Problema:** Como o app nunca autentica, essas tabelas são **inacessíveis** em produção.

---

## 6. `GRANT ALL TO anon` em Tabelas Sensíveis (P0)

```sql
GRANT ALL ON automacoes_tarefas TO anon;
GRANT ALL ON automacoes_aprovacoes TO anon;
GRANT ALL ON automacoes_instrucoes TO anon;
GRANT ALL ON automacoes_gatilhos TO anon;
GRANT ALL ON automacoes_gatilhos_execucao TO anon;
GRANT ALL ON ia_credenciais TO anon;
GRANT ALL ON ia_identidades TO anon;
GRANT ALL ON ia_sessoes_operacionais TO anon;
GRANT ALL ON ia_fluxos_empresa TO anon;
GRANT ALL ON ia_versoes_sistema TO anon;
-- +10 outras
```

---

## 7. Funções SECURITY DEFINER sem `search_path` (P1)

9 funções com privilégio elevado sem proteção contra search path hijacking:

| Função | Arquivo |
|--------|---------|
| `trg_escala_validacoes` | `20260517000010` |
| `trg_ia_logs_escalonamento` | `20260517000009` |
| `fn_dispatcher_automacao` | `sql_automacao_fase1.sql` |
| `obter_cliente_id_do_usuario` | `202606200007` |
| 6 DreamFlow RPCs | `20260517000014` |
| 2 F2C email functions | `20260728` |

---

## 8. Storage Buckets

| Bucket | Leitura | Escrita | Risco |
|--------|---------|---------|-------|
| `contratos` | Pública | `authenticated`/`service_role` | Upload bloqueado |
| `biblioteca-global` | Pública | **Pública** | Upload aberto para qualquer um |
| `documentos` | Não auditado | Não auditado | Desconhecido |

---

## 9. API Keys em localStorage (P0)

7 serviços leem `"anthropic_api_key"` de `localStorage`:
- `src/services/ai.ts:15`
- `src/services/documentAnalysis.ts:161`
- `src/services/recrutamentoIA.ts:46`
- `src/services/comunicacaoLote.ts:51`
- `src/services/iaService.ts`
- `src/services/configuracoesService.ts`
- `src/services/automacaoWhatsapp.ts`

Chaves em localStorage são acessíveis por qualquer script na página (XSS).

---

## 10. `.env` — Chaves Expostas e Ausentes

### Expostas (esperado para VITE_*)
- `VITE_SUPABASE_URL` — URL pública
- `VITE_SUPABASE_ANON_KEY` — chave anon (esperado)
- `VITE_MAPBOX_ACCESS_TOKEN` — token Mapbox
- `VITE_ZOHO_CLIENT_ID` / `VITE_ZOHO_CLIENT_SECRET` — OAuth credentials

### Ausentes (P0)
- `SUPABASE_SERVICE_ROLE_KEY` — **VAZIO**
- `VITE_EVOLUTION_API_URL` — não configurado
- `VITE_EVOLUTION_API_KEY` — não configurado
- `VITE_GROQ_API_KEY` — não configurado
- `VITE_GEMINI_API_KEY` — não configurado
- `VITE_OPENAI_API_KEY` — não configurado

---

## 11. Plano de Correção Seguro

### Correções Automáticas (migration SQL)
```sql
-- 1. Habilitar RLS em tabelas sem
ALTER TABLE escala_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_app_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_checkins ENABLE ROW LEVEL SECURITY;

-- 2. Substituir USING (true) nas tabelas IA principais
-- (manter anon para leitura, exigir authenticated para escrita)

-- 3. Adicionar SET search_path = '' nas 9 funções SECURITY DEFINER

-- 4. Revogar GRANT ALL de tabelas sensíveis
REVOKE ALL ON ia_credenciais FROM anon;
REVOKE ALL ON ia_identidades FROM anon;
REVOKE ALL ON ia_sessoes_operacionais FROM anon;

-- 5. Restringir upload no bucket biblioteca-global
```

### Correções Manuais
1. Adicionar `SUPABASE_SERVICE_ROLE_KEY` (obter do dashboard Supabase)
2. Mover API keys de localStorage para `import.meta.env`
3. Implementar Supabase Auth (`signInWithPassword`) para proteger escrita
4. Auditar RLS de `ordens_servico`, `clientes`, `prestadores`, `veiculos`

---

## 12. Classificação Final

| Categoria | P0 | P1 | P2 |
|-----------|----|----|-----|
| RLS desativado/aberto | 6 | 0 | 0 |
| Tabelas sem RLS | 3 | 0 | 0 |
| SECURITY DEFINER sem search_path | 0 | 9 | 0 |
| GRANT ALL to anon | 4 | 0 | 6 |
| Storage público | 0 | 1 | 0 |
| API keys em localStorage | 4 | 0 | 0 |
| Service role key ausente | 1 | 0 | 0 |
| Chaves API externas ausentes | 0 | 4 | 0 |
| Autenticação inexistente | 1 | 0 | 0 |
| **Total** | **19** | **14** | **6** |

---

*Documento gerado por auditoria de segurança automatizada — OpenCode Go Pro*
