import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

for (const t of ["orcamentos", "orcamento_itens", "tabelas_valores", "tabela_prestador", "simulacoes_frete", "cotacoes"]) {
  const ex = await c.query(`select to_regclass('public.'||$1) r`, [t]);
  if (!ex.rows[0].r) { console.log(`TABELA ${t}: NAO EXISTE`); continue; }
  const cols = await c.query(`select column_name from information_schema.columns where table_name=$1 order by ordinal_position`, [t]);
  const cnt = await c.query(`select count(*)::int n from public.${t}`);
  console.log(`\nTABELA ${t}: ${cnt.rows[0].n} linhas`);
  console.log("  cols:", cols.rows.map(x => x.column_name).join(", "));
}

// funcoes de cotacao/precificacao
const procs = await c.query(
  `select p.proname, pg_get_function_arguments(p.oid) args
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname ilike '%precific%' or p.proname ilike '%cotac%'
      or p.proname ilike '%orcament%' or p.proname ilike '%tabela%' or p.proname ilike '%tarifa%')
    order by p.proname`);
console.log("\n=== FUNCOES precificacao/cotacao/orcamento ===");
for (const r of procs.rows) console.log(`  ${r.proname}(${r.args})`);

// amostra orcamentos
try {
  const orc = await c.query(`select * from orcamentos order by created_at desc limit 5`);
  console.log("\n=== ORCAMENTOS (5 mais recentes) ===");
  console.log(JSON.stringify(orc.rows, null, 2));
} catch (e) { console.log("orcamentos sample erro:", e.message); }

// tabelas_valores
const tv = await c.query(`select * from tabelas_valores order by created_at desc limit 20`).catch(e => ({ rows: [{ erro: e.message }] }));
console.log("\n=== TABELAS_VALORES ===");
console.log(JSON.stringify(tv.rows, null, 2));

await c.end();
