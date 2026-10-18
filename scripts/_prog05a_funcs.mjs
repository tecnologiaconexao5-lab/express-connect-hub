// TMS-FIN-PROG-05A — READ-ONLY. Definições reais de M66/M80 + triggers.
import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const fns = ["f_trg_propagar_financeiro_alocacao", "f_trg_propagar_financeiro_os"];
for (const fn of fns) {
  const r = await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1`, [fn]);
  const def = r[0]?.def || "(NAO ENCONTRADO)";
  const sha = crypto.createHash("sha256").update(def).digest("hex").slice(0, 16);
  console.log(`\n===== ${fn} (sha256:${sha}, chars:${def.length}) =====`);
  console.log(def);
}

console.log("\n===== TRIGGERS reais (alocacoes_escala / ordens_servico) =====");
const trg = await q(`
  select c.relname tabela, t.tgname, pg_get_triggerdef(t.oid) def, t.tgenabled
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
    and c.relname in ('alocacoes_escala','ordens_servico')
  order by 1,2`);
for (const t of trg) console.log(`${t.tabela} | enabled=${t.tgenabled} | ${t.tgname}\n   ${t.def}`);
await p.end();
