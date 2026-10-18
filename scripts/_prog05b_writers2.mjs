import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await p.query(s)).rows;
const fns = await q(`select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`);
const withRef = fns.filter((f) => /financeiro_receber/i.test(f.def));
const out = { funcoes_que_referenciam_financeiro_receber: [] };
for (const f of withRef) {
  const d = f.def;
  out.funcoes_que_referenciam_financeiro_receber.push({
    funcao: f.proname,
    insert: /INSERT\s+INTO\s+(public\.)?financeiro_receber/i.test(d),
    update: /UPDATE\s+(public\.)?financeiro_receber/i.test(d),
    delete: /DELETE\s+FROM\s+(public\.)?financeiro_receber/i.test(d),
    select: /FROM\s+(public\.)?financeiro_receber/i.test(d),
  });
}
console.log(JSON.stringify(out, null, 2));
await p.end();
