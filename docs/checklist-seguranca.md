# Checklist Seguranca — Express Connect Hub / TMS

> **Missao:** 01 | **Data:** 2026-06-26

---

## RLS — Row Level Security

- [x] P0 — Politicas `USING(true)` substituidas por SELECT anon + INSERT/UPDATE/DELETE authenticated (96 tabelas)
- [x] P0 — Tabelas sem RLS habilitadas (`escala_operacional`, `motorista_app_sessoes`, `motorista_checkins`)
- [ ] P1 — Adicionar `auth.uid()` row-level isolation por `cliente_id` (portal cliente)
- [ ] P1 — Adicionar `auth.uid()` row-level isolation por `prestador_id` (app prestador)
- [ ] P2 — Criar politicas por perfil (admin, financeiro, operacional, comercial, cliente, prestador)

## Grants e Chaves

- [x] P0 — `GRANT ALL TO anon` revogado (4 tabelas)
- [x] P0 — `INSERT, UPDATE, DELETE TO anon` revogado (20+ tabelas)
- [x] P0 — SELECT mantido para anon (compatibilidade)
- [ ] P0 — `SUPABASE_SERVICE_ROLE_KEY` configurado no `.env`
- [ ] P1 — API keys removidas de localStorage (7 services)
- [ ] P2 — `VITE_*` keys revisadas (nenhuma secreta no frontend)

## SECURITY DEFINER

- [x] P0 — `search_path = ''` em todas as 17 funcoes
- [ ] P1 — Adicionar `auth.uid()` validation nas DreamFlow RPCs
- [ ] P2 — Auditar se todas realmente precisam ser SECURITY DEFINER

## IA — Governanca

- [x] P0 — Default `precisa_aprovacao: true` para acoes nao configuradas
- [x] P0 — Dupla barreira: `executarAcaoReal()` re-verifica governanca
- [ ] P1 — Rate limiting por segundo/minuto
- [ ] P1 — `risco_operacional` usado em autorizacao
- [ ] P1 — Whitelist de status em `COM_ATUALIZAR_STATUS`

## Storage Buckets

- [x] P0 — `biblioteca-global` upload restrito para authenticated
- [x] P0 — `biblioteca-global` SELECT mantido publico
- [ ] P1 — Auditar bucket `documentos`
- [ ] P1 — Auditar bucket `contratos`

## Auditoria

- [x] P1 — Tabela `security_violation_log` criada
- [x] P1 — Trigger `trg_audit_financeiro_receber` existente
- [ ] P2 — Auditoria append-only (imutavel)
- [ ] P2 — Log de acesso por IP/user-agent

## Autenticacao

- [ ] P0 — Implementar Supabase Auth (`signInWithPassword`)
- [ ] P1 — Criar fluxo de registro de usuario
- [ ] P1 — Criar pagina de perfil/usuario
- [ ] P2 — MFA/2FA

---

## Progresso

| Prioridade | Total | Concluido | Pendente |
|-----------|-------|-----------|----------|
| P0 | 10 | 7 | 3 |
| P1 | 12 | 2 | 10 |
| P2 | 8 | 0 | 8 |
| **Total** | **30** | **9** | **21** |

---

*Documento gerado para Missao 01 — OpenCode Go Pro*
