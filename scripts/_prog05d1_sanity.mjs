import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const out = {};
out.contagens = {
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
};
out.fat16 = await q(`select id, numero, numero_cliente, status, valor_total, conta_receber_id from faturas where numero='FAT-2026-000016'`);
out.rascunhos_com_ar = (await q(`select count(*)::int n from faturas f where f.status='rascunho' and exists (select 1 from financeiro_receber r where r.fatura_id=f.id)`))[0].n;
out.emitidas_com_ar = (await q(`select count(*)::int n from faturas f where f.status='emitida' and exists (select 1 from financeiro_receber r where r.fatura_id=f.id)`))[0].n;
console.log(JSON.stringify(out, null, 2));
await p.end();
