# PLANO DE TESTES — F2-A1 RLS ordens_servico

**Arquivos de teste:**
- `tests/e2e/m136c2-f2-a1-rls-ordens-servico.spec.ts` (Playwright, 8 testes)
- `tests/database/m136c2-f2-a1-rls-ordens-servico.sql` (SQL, 10 testes conceituais)

---

## Testes Playwright (8)

| # | Teste | Perfil | Expectativa |
|---|-------|--------|-------------|
| 01 | Anon bloqueado | anon | 0 rows ou erro 401 |
| 02 | Anon sem UUID error | anon | Não lança "invalid input syntax for type uuid" |
| 03 | Super admin SELECT limit 5 | super_admin | 0-5 rows, sem erro |
| 04 | Super admin COUNT | super_admin | COUNT >= 0, sem UUID error |
| 05 | Financeiro SELECT limit 5 | financeiro | 0-5 rows, sem erro |
| 06 | SELECT por ID conhecido | super_admin | ID encontrado |
| 07 | SELECT amplo sem UUID error | super_admin | Sem erro mesmo com registros legados |
| 08 | Sessão expirada sem UUID error | anon | Não lança erro UUID |

## Testes SQL (10)

| # | Teste | Role | Expectativa |
|---|-------|------|-------------|
| 1 | Anon bloqueado | anon | COUNT = 0 |
| 2 | Usuário vê OS do tenant | authenticated | COUNT > 0 |
| 3 | Registro legado não quebra | authenticated | SELECT LIMIT 10 sem erro |
| 4 | Super admin vê OS | authenticated (super_admin) | COUNT > 0 |
| 5 | COUNT head | authenticated | Sem erro UUID |
| 6 | SELECT por ID | authenticated | ID encontrado |
| 7 | Outro tenant bloqueado | authenticated (outro tenant) | COUNT = 0 |
| 8 | INSERT preservado | authenticated | INSERT funciona |
| 9 | UPDATE preservado | authenticated | UPDATE funciona |
| 10 | DELETE preservado | authenticated | DELETE funciona |

## Bloqueios conhecidos

- Teste 7 (outro tenant): sem segundo tenant disponível em produção
- Testes 8-10 (DML): requerem dados controlados em ambiente QA
- Perfis comercial, operacional, atendimento, cliente: senhas não confirmadas para todos
