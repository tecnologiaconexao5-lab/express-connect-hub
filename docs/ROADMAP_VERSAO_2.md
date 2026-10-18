# Roadmap — Express Connect Hub / TMS

> **Data:** 2026-06-26 | **Versao Atual:** 1.0 (Enterprise Ready)

---

## Versao 2.0 — Multi-Tenant & Comercial (Q3 2026)

### Objetivo: Permitir comercializar para 10+ transportadoras

| Feature | Prioridade |
|---------|-----------|
| Multi-tenant (empresa_id em todas as tabelas) | P0 |
| Isolamento RLS por tenant (`auth.jwt() -> empresa_id`) | P0 |
| White Label basico (logo, nome, cor por empresa) | P0 |
| Gestao de usuarios por empresa (admin, operador, financeiro) | P0 |
| Supabase Auth completo (MFA, perfil, sessoes) | P0 |
| PWA do motorista publicado | P0 |
| Kanban CRM para comercial | P1 |
| Paginacao em todas as listas | P1 |
| React Query hooks (useClientes, useOS, useFinanceiro) | P1 |
| Exportacao PDF/Excel real | P1 |
| Otimizacao de logos (SVG/WebP) | P1 |
| Remocao de codigo morto | P1 |
| Refatoracao centralIaService | P2 |

---

## Versao 2.5 — Operacao Avancada (Q4 2026)

### Objetivo: Suportar 100+ OS/dia, GPS em tempo real

| Feature | Prioridade |
|---------|-----------|
| Tracking GPS em tempo real (PWA motorista → Supabase Realtime) | P0 |
| Multi-stop na escala (tabela de paradas) | P0 |
| Logistica reversa / entrega parcial | P0 |
| Gestao de frota completa (manutencao, reserva, combustivel) | P0 |
| Conciliação bancaria real (integração API bancaria) | P1 |
| Boleto / fatura comercial automatico | P1 |
| DRE consolidado multi-empresa | P1 |
| Alertas inteligentes (IA detecta anomalias operacionais) | P1 |
| SLA tracking automatico | P2 |
| App mobile nativo (React Native) para motorista | P2 |

---

## Versao 3.0 — Plataforma & API (2027)

### Objetivo: Escalar para 100+ transportadoras, API publica

| Feature | Prioridade |
|---------|-----------|
| API REST publica documentada (Swagger/OpenAPI) | P0 |
| Microservicos (separar IA, Financeiro, Operacao) | P0 |
| CDN global para assets estaticos | P0 |
| Filas de processamento (Redis/RabbitMQ) para jobs pesados | P0 |
| Marketplace de integracoes (conectores plug-and-play) | P1 |
| SDK para parceiros | P1 |
| Infra multi-region (Oracle Cloud + AWS) | P1 |
| AI/ML para previsao de demanda e otimizacao de rota | P2 |
| Blockchain para auditoria imutavel de entregas | P2 |
| Portal do cliente White Label completo | P2 |

---

## Linha do Tempo

```
Q3 2026  ████████████████  v2.0 — Multi-Tenant & Comercial
Q4 2026  ████████████████  v2.5 — Operacao Avancada
2027+    ████████████████  v3.0 — Plataforma & API
```

---

*Documento gerado para Roadmap v2 — OpenCode Go Pro*
