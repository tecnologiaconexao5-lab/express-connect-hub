# Seguranca Go-Live — Express Connect Hub / TMS

> **Missao:** 06 | **Data:** 2026-06-26

---

## 1. Verificacao de Secrets

- [x] Nenhuma chave real versionada no Git (`.env` no `.gitignore`)
- [x] `.env.production.example` criado sem valores reais
- [x] `SUPABASE_SERVICE_ROLE_KEY` documentado como variavel de servidor apenas
- [x] `VITE_*` keys sao publicas por natureza (esperado)

---

## 2. RLS — Row Level Security (Missao 01)

- [x] 96 tabelas com RLS habilitado
- [x] SELECT permitido para `anon` (leitura publica)
- [x] INSERT/UPDATE/DELETE restrito para `authenticated`
- [x] `GRANT ALL TO anon` revogado
- [x] 17 funcoes SECURITY DEFINER com `search_path = ''`
- [ ] **Pendente:** Supabase Auth (`signInWithPassword`) — sem login, politicas `authenticated` nao tem efeito real no momento. Planejar implementacao antes de abrir para clientes externos.

---

## 3. IA — Dupla Barreira (Missao 01)

- [x] `governancaService` default: `precisa_aprovacao: true`
- [x] `executarAcaoReal()` re-verifica governanca antes de cada execucao
- [x] Acoes nao configuradas exigem aprovacao

---

## 4. Storage Buckets

- [x] `biblioteca-global` — SELECT publico, INSERT/UPDATE/DELETE authenticated
- [x] `documentos` — SELECT publico, INSERT/UPDATE/DELETE authenticated
- [x] `contratos` — SELECT publico, INSERT authenticated/service_role

---

## 5. Nginx Security Headers (Missao 05)

- [x] `X-Frame-Options: SAMEORIGIN`
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] Arquivos ocultos (`/\.`) bloqueados

---

## 6. Frontend

- [x] Nenhum `console.log` com dados sensiveis identificado
- [x] `catch {}` silenciosos corrigidos nos locais criticos
- [x] Botoes "em desenvolvimento" desabilitados (nao enganam usuario)
- [ ] **Pendente:** 10 `window.confirm()` restantes (P2 — sem risco operacional)
- [ ] **Pendente:** API keys em `localStorage` — 7 servicos com `"anthropic_api_key"` (P0 — corrigir antes de clientes externos)

---

## 7. Veredito de Seguranca

**APTO para uso interno controlado (ate ~100 OS/dia).**

**NAO APTO para clientes externos (portal cliente/prestador)** sem:
1. Implementar Supabase Auth
2. Remover API keys de localStorage
3. Substituir `window.confirm()` por AlertDialog

---

*Documento gerado para Missao 06 — OpenCode Go Pro*
