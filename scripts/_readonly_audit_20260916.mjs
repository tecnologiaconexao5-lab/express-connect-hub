// READ-ONLY audit queries — 2026-09-16
// ZERO mutations. ALL SELECT only.
import pg from "pg";

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error("DATABASE_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

const queries = [
  {
    name: "Query 1 — Migration History (2026091*)",
    sql: `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '2026091%' ORDER BY version;`
  },
  {
    name: "Query 2 — Schema Types (critical columns)",
    sql: `SELECT 
  table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (
    (table_name = 'composicao_financeira_os' AND column_name IN ('os_id', 'cliente_id', 'prestador_id'))
    OR (table_name = 'financeiro_pagar' AND column_name = 'os_id')
    OR (table_name = 'financeiro_receber' AND column_name = 'os_id')
    OR (table_name = 'pagamentos_prestadores' AND column_name = 'os_id')
    OR (table_name = 'ordens_servico' AND column_name IN ('id', 'cliente', 'prestador', 'cliente_id', 'prestador_id'))
  )
ORDER BY table_name, column_name;`
  },
  {
    name: "Query 3 — Triggers on M66/M80 tables",
    sql: `SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('alocacoes_escala', 'ordens_servico')
  AND t.tgname LIKE 'trg_%'
ORDER BY c.relname, t.tgname;`
  },
  {
    name: "Query 4 — RPC exists: f_confirmar_pagamento_fechamento",
    sql: `SELECT p.proname, p.prosecdef, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'f_confirmar_pagamento_fechamento';`
  },
  {
    name: "Query 5 — RPC grants",
    sql: `SELECT 
  r.rolname AS grantee,
  has_function_privilege(r.oid, 'public.f_confirmar_pagamento_fechamento(uuid,date)', 'EXECUTE') AS can_execute
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres');`
  },
  {
    name: "Query 6 — Snapshot table exists",
    sql: `SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'fin_sane_02b_snapshot'
) AS snapshot_exists;`
  },
  {
    name: "Query 7 — DRY-RUN: financeiro_pagar candidates",
    sql: `SELECT 
  fp.id,
  fp.os_id,
  fp.valor AS valor_atual,
  pp.valor_liquido AS valor_proposto,
  pp.valor_liquido - fp.valor AS diferenca,
  fp.status,
  fp.fornecedor_id
FROM financeiro_pagar fp
INNER JOIN pagamentos_prestadores pp 
  ON pp.os_id::TEXT = fp.os_id 
  AND pp.prestador_id = fp.fornecedor_id
WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
  AND fp.os_id IS NOT NULL
  AND fp.fornecedor_id IS NOT NULL
  AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
  AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2);`
  },
  {
    name: "Query 8 — Pagos sem baixa (titulo_tabela/titulo_id)",
    sql: `SELECT 
  fp.id,
  fp.os_id,
  fp.valor,
  fp.status,
  COUNT(fb.id) AS baixas_count
FROM financeiro_pagar fp
LEFT JOIN financeiro_baixas fb 
  ON fb.titulo_tabela = 'financeiro_pagar' 
  AND fb.titulo_id = fp.id
WHERE COALESCE(fp.status, '') IN ('pago', 'paga')
GROUP BY fp.id, fp.os_id, fp.valor, fp.status
HAVING COUNT(fb.id) = 0;`
  },
  {
    name: "Query 9 — Total financeiro_baixas",
    sql: `SELECT COUNT(*) AS total_baixas FROM financeiro_baixas;`
  },
  {
    name: "Query 10 — financeiro_baixas columns",
    sql: `SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'financeiro_baixas'
ORDER BY ordinal_position;`
  }
];

async function main() {
  try {
    await client.connect();
    console.log("Connected to Supabase production (READ-ONLY).\n");

    for (const q of queries) {
      console.log("=".repeat(80));
      console.log(q.name);
      console.log("=".repeat(80));
      try {
        const result = await client.query(q.sql);
        if (result.rows.length === 0) {
          console.log("(0 rows returned)\n");
        } else {
          console.table(result.rows);
          console.log(`(${result.rows.length} row${result.rows.length === 1 ? '' : 's'})\n`);
        }
      } catch (err) {
        console.error(`ERROR: ${err.message}\n`);
      }
    }
  } catch (err) {
    console.error("Connection error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
