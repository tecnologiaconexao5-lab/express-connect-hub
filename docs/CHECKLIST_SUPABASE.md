# Checklist Supabase — Go Live

## 1. Migrations

- [ ] Total: **99 migrations** aplicadas no Supabase remoto
- [ ] Última migration: `20260801_p3_idempotency_key.sql`
- [ ] Nenhuma migration pendente (`supabase db diff` vazio)
- [ ] Todas as tabelas de negócio criadas:
  - [ ] `crm_leads`, `crm_followups`, `crm_historico`
  - [ ] `alocacoes_escala`
  - [ ] `financeiro_receber`
  - [ ] `fiscal_ctes`, `fiscal_nfse`
  - [ ] `portal_pedidos`, `portal_ocorrencias`
  - [ ] `prestadores`, `candidatos`
  - [ ] `automacoes_robos`, `automacoes_tarefas`, `ia_*`
  - [ ] `tenants`, `tenant_usuarios`
  - [ ] `memoria_*`, `ia_*` (ecossistema IA)
- [ ] ENUMs criados (periodicidade, status, prioridade, tipo, etc.)

## 2. RPCs / Stored Functions

- [ ] ~40 funções criadas (auditoria, notificação, trigger, etc.)
- [ ] `set_tenant_context()` funcional
- [ ] `current_tenant_id_safe()` funcional
- [ ] `consumir_convite()` funcional
- [ ] `notificar_xml_recebido()` funcional
- [ ] Funções de trigger operacional ativas

## 3. Edge Functions

- [ ] **7 functions** implantadas:
  - [ ] `criar-alocacao-escala`
  - [ ] `fiscal-documento-url`
  - [ ] `fiscal-email-documentos`
  - [ ] `focus-consulta`
  - [ ] `focus-documentos`
  - [ ] `focus-emissao`
  - [ ] `whatsapp-recrutamento-webhook`
- [ ] Secrets das functions configuradas no Supabase
- [ ] Functions não apresentam erro em execução

## 4. RLS (Row Level Security)

- [ ] Multi-Tenant RLS implementado (4 migrations dedicadas)
- [ ] `tenant_id` presente em todas as tabelas de negócio
- [ ] RLS policies para IA (F35 fix)
- [ ] RLS para recrutamento candidatos
- [ ] Políticas de Super Admin funcionais
- [ ] `bypass_rls` configurado para service_role

## 5. Super Admin

- [ ] `AdminTenantsPage` funcional na UI
- [ ] Super Admin consegue ver todos os tenants
- [ ] Super Admin consegue gerenciar usuários
- [ ] Função `user_can_manage_tenants()` ativa

## 6. Auth

- [ ] Supabase Auth ativo (não demo)
- [ ] `VITE_AUTH_DEMO_MODE=false` no .env.production
- [ ] Login real via `supabase.auth.signInWithPassword()`
- [ ] Reset de senha funcional
- [ ] Convite de usuários funcional
- [ ] Roles: `super_admin`, `admin`, `operador`, `financeiro`, `comercial`, `cliente`, `prestador`

## 7. Projeto no Supabase Dashboard

- [ ] Projeto: `uwrvzsjtpgaifkktpepn`
- [ ] Plano ativo (não em pausa)
- [ ] Storage buckets configurados (se houver)
- [ ] Auth providers configurados (email/password + opcionais)
- [ ] Rate limiting configurado

## 8. Segurança

- [ ] Service Role Key guardada (não exposta no frontend)
- [ ] Anon Key restrita (RLS obrigatório)
- [ ] Nenhuma policy `USING (true)` sem tenant filter
- [ ] Backup automático ativo (diário)
- [ ] Point-in-time recovery disponível (plano Pro+)
