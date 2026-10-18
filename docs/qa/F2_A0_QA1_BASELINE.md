# PLANO DE BASELINE — F2-A0-QA1

## Problema

O repositório contém 159 migrations, mas **não contém CREATE TABLE** para 5 tabelas centrais. Essas tabelas foram criadas antes da convenção de migrations (maio/2026) e existem apenas no banco de produção. Um banco vazio não pode ser reconstruído apenas com as migrations existentes.

## Tabelas sem CREATE TABLE no repositório

| Tabela | Contém dados (produção) | CREATE TABLE no repo | Como existe atualmente |
|--------|------------------------|---------------------|----------------------|
| `ordens_servico` | ✅ ~54 registos | ❌ NÃO | Criada manualmente antes da primeira migration |
| `clientes` | ✅ 24 registos | ❌ NÃO | Criada manualmente |
| `prestadores` | ⚠️ 0 registos | ❌ NÃO | Criada manualmente |
| `veiculos` | ⚠️ 0 registos | ❌ NÃO | Criada manualmente |
| `financeiro_receber` | ✅ 85 registos | ❌ NÃO | Criada manualmente |
| `financeiro_pagar` | ✅ 78 registos | ❌ NÃO | Criada manualmente |

## Estratégia de baseline

### Opção A (recomendada) — Extrair schema-only da produção
1. Conectar ao banco de produção com `psql` ou `supabase db dump`
2. Executar `pg_dump --schema-only --no-owner --no-acl` apenas para as tabelas sem CREATE TABLE
3. Criar `supabase/baseline/01_core_tables.sql`
4. Não incluir dados, sequences, ou grants

**Requisito:** Acesso `DATABASE_URL` (connection string) da produção + Service Role Key.

### Opção B — Reconstruir por engenharia reversa
1. Para cada tabela sem CREATE TABLE, examinar:
   - Migrations que a referenciam (ALTER TABLE, CREATE POLICY, etc.)
   - Tipos inferidos dos dados
   - FKs documentadas em migrations
2. Recriar a definição da tabela manualmente

### Opção C — Usar `supabase db dump --linked`
1. Vincular CLI ao projeto de produção com `supabase link --project-ref uwrvzsjtpgaifkktpepn`
2. Executar `supabase db dump --file supabase/baseline/01_core_tables.sql`
3. Remover dados sensíveis do arquivo gerado

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Baseline diferente do schema real | Migrations falham | Validar com `supabase db diff` |
| Incluir dados de produção no dump | Vazamento | Usar `--schema-only` / revisar arquivo |
| Service role exposta | Segurança | Usar connection string com ROLE diferente |

## Ações necessárias (bloqueadas)

1. Obter `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` da produção
2. Executar dump ou criar manualmente as definições
3. Validar baseline contra produção via `supabase db diff`
4. Aplicar baseline + migrations no QA
