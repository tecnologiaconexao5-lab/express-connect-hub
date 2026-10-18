import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const r = await p.query(`
  select f.metadata->>'numeroManual' num, f.valor_total, f.metadata->>'descricao' meta_desc,
         (select i.descricao from fatura_itens i where i.fatura_id=f.id limit 1) item_desc,
         (select i.valor_base from fatura_itens i where i.fatura_id=f.id limit 1) item_base
  from faturas f
  where f.status='emitida' and f.conta_receber_id is null
  order by f.criado_em`);
console.log(JSON.stringify(r.rows, null, 2));
await p.end();
