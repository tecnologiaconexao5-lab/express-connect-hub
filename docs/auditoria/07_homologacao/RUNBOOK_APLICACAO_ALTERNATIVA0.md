# Runbook de Aplicação — Alternativa 0 (P0 RLS)
**Migration:** `20260807_alternativa0_minimo_p0_alocacoes_escala.sql`
**Rollback:** `20260807_alternativa0_rollback.sql`
**Data:** 2026-08-07 | **Escopo:** `alocacoes_escala` apenas

---

## Pré-requisitos

- Acesso a um dos:
  - Supabase Dashboard → SQL Editor (recomendado)
  - `psql` com `DATABASE_URL`
  - Node.js com `pg` module e `SUPABASE_SERVICE_ROLE_KEY`
- Leitura do migration SQL antes de executar
- Horário comercial ou fora — irrelevante (DDL puro, < 1s)

## Passo 1 — Aplicar Migration

```sql
-- Opção A: Supabase Studio → SQL Editor
-- Abrir `supabase/migrations/20260807_alternativa0_minimo_p0_alocacoes_escala.sql`
-- Copiar todo o conteúdo → Executar

-- Opção B: psql
psql "$DATABASE_URL" -f supabase/migrations/20260807_alternativa0_minimo_p0_alocacoes_escala.sql
```

## Passo 2 — Validar Aplicação

A própria migration já inclui bloco `DO $$ ... $$` (SEÇÃO 6) que valida:

- **7 policies** no total (4 TMS + 1 cliente + 2 prestador)
- **0 policies** com role `public`
- **0 grants** para `anon`
- **2 policies prestador** preservadas
- **4 policies TMS** criadas
- **1 policy cliente** criada

Se aparecer `ALTERNATIVA 0 APLICADA COM SUCESSO` → ✅

## Passo 3 — Testar Navegação no TMS

| Módulo | O que testar | Critério |
|--------|-------------|----------|
| Escala | Carregar lista de alocações | ✅ Dados aparecem |
| Escala | Criar nova alocação | ✅ INSERT funciona |
| Escala | Editar alocação existente | ✅ UPDATE funciona |
| Escala | Excluir alocação | ✅ DELETE funciona |
| OS | Vinculação com alocações | ✅ Sem erro |
| Financeiro | Cálculo de valores por alocação | ✅ Sem erro |
| Tracking | Mapa com alocações | ✅ Sem erro |
| Portal Prestador | Ver próprias alocações | ✅ (policy preservada) |

## Passo 4 — Testar Portal Cliente

| Aba | Critério |
|-----|----------|
| Comprovantes | Dados carregam |
| Escala/Operacional | Alocações do cliente aparecem |
| Tracking | Mapa funciona |

## Passo 5 — Rollback (se necessário)

```sql
-- Apenas se algo inesperado acontecer
psql "$DATABASE_URL" -f supabase/migrations/20260807_alternativa0_rollback.sql
```

O rollback:
1. Remove as 5 novas policies (4 TMS + 1 cliente)
2. Restaura `GRANT SELECT, INSERT, UPDATE, DELETE TO anon`
3. Recria as 4 policies inseguras originais (`USING(true)`)
4. Valida com bloco `DO $$`

## Duração estimada

| Etapa | Tempo |
|-------|-------|
| Aplicação | < 1 segundo |
| Validação (bloco DO) | < 100ms |
| Teste TMS | 5 minutos |
| Teste Portal Cliente | 3 minutos |
| Rollback (se necessário) | < 1 segundo |
| **Total com testes** | **~10 minutos** |
