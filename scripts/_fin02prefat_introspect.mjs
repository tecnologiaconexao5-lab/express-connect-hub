import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const alvos = [
  "pagamentos_prestadores",
  "pagamentos_prestadores_itens",
  "lotes_pagamento",
  "lotes_pagamento_itens",
  "fechamentos_prestador",
  "extrato_prestador",
  "movimentos_conta_corrente_prestador",
  "itens_fechamento_prestador",
];
for (const t of alvos) {
  const ex = await c.query(`select to_regclass('public.'||$1) as r`, [t]);
  if (!ex.rows[0].r) {
    console.log(`TABELA ${t}: NAO EXISTE`);
    continue;
  }
  const cols = await c.query(
    `select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position`,
    [t]
  );
  const cnt = await c.query(`select count(*)::int n from public.${t}`);
  console.log(`\nTABELA ${t}: ${cnt.rows[0].n} linhas`);
  console.log("  cols:", cols.rows.map((x) => x.column_name).join(", "));
}

// funcoes relevantes
const procs = await c.query(
  `select p.proname, pg_get_function_arguments(p.oid) args, p.prosecdef definer
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (
      p.proname ilike '%lote%' or p.proname ilike '%extrato%'
      or p.proname ilike '%fechamento%' or p.proname ilike '%pagamento_prestador%')
    order by p.proname`
);
console.log("\n=== FUNCOES (lote/extrato/fechamento/pagamento_prestador) ===");
for (const r of procs.rows) console.log(`  ${r.proname}(${r.args}) definer=${r.definer}`);

await c.end();
