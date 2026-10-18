/**
 * FIN-01-CALC — Inspecao SOMENTE LEITURA dos triggers/funcoes financeiras
 * de producao (ordens_servico / alocacoes_escala).
 * Saida: scripts/_fin01calc_triggers.json
 */
import fs from "node:fs";
import { Client } from "pg";

const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = { ts: new Date().toISOString() };

async function fnDef(nome) {
  const r = await c.query(`select pg_get_functiondef($1::regprocedure) as def`, [nome]).catch(async () => {
    return c.query(`select p.oid::regprocedure::text as def from pg_proc p where p.proname=$1`, [nome]);
  });
  return r.rows;
}

console.log("=== funcoes candidatas (frete/baixa/propagacao) ===");
const procs = await c.query(
  `select p.proname, pg_get_function_arguments(p.oid) as args, p.provolatile, p.prosecdef
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (p.proname ilike '%frete%' or p.proname ilike '%tarifa%'
           or p.proname ilike '%calcular%' or p.proname ilike '%propagar%'
           or p.proname ilike '%baixa%')
    order by p.proname`
);
out.funcoes = procs.rows;
for (const r of procs.rows) console.log(`  ${r.proname}(${r.args}) vol=${r.provolatile} definer=${r.prosecdef}`);

console.log("\n=== triggers em ordens_servico / alocacoes_escala ===");
const tg = await c.query(
  `select c.relname as tabela, t.tgname, p.proname as funcao, t.tgenabled
     from pg_trigger t
     join pg_class c on c.oid=t.tgrelid
     join pg_proc p on p.oid=t.tgfoid
    where c.relname in ('ordens_servico','alocacoes_escala')
      and not t.tgisinternal
    order by c.relname, t.tgname`
);
out.triggers = tg.rows;
for (const r of tg.rows) console.log(`  ${r.tabela}.${r.tgname} -> ${r.funcao} (${r.tgenabled})`);

// Def de f_trg_propagar_financeiro_alocacao
const defs = {};
for (const nome of ["f_trg_propagar_financeiro_alocacao()", "f_trg_propagar_financeiro_os()"]) {
  try {
    const r = await c.query(`select pg_get_functiondef($1::regprocedure) as def`, [nome]);
    defs[nome] = r.rows[0]?.def || null;
  } catch (e) {
    defs[nome] = "ERRO: " + e.message;
  }
  const d = defs[nome] || "";
  const bloco = d.match(/financeiro_pagar[\s\S]{0,400}/i);
  console.log(`\n--- ${nome} : trecho financeiro_pagar ---`);
  console.log(bloco ? bloco[0].slice(0, 400) : "(nao encontrado)");
}
out.function_defs = defs;

await c.end();
fs.writeFileSync("scripts/_fin01calc_triggers.json", JSON.stringify(out, null, 2));
console.log("\nEVIDENCIA: scripts/_fin01calc_triggers.json");
