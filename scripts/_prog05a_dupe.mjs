import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

console.log("== fatura_itens das faturas com AR (por fatura_id) ==");
console.log(JSON.stringify(await q(`
  select f.numero, f.numero_cliente, i.os_id, i.alocacao_id, i.valor_total, i.descricao
  from faturas f join fatura_itens i on i.fatura_id=f.id
  where f.conta_receber_id is not null order by f.numero_cliente nulls last`), null, 2));

console.log("\n== itens de fatura com os_id != null e a respectiva OS ja tem AR por os_id ==");
console.log(JSON.stringify(await q(`
  select f.numero, f.numero_cliente, i.os_id, r.id ar_os, r.valor ar_valor, r.status ar_status
  from faturas f
  join fatura_itens i on i.fatura_id=f.id
  left join financeiro_receber r on r.os_id = i.os_id::text
  where i.os_id is not null
  order by f.numero_cliente nulls last limit 20`), null, 2));

console.log("\n== financeiro_receber por OS: os_ids que também aparecem em fatura_itens ==");
console.log(JSON.stringify(await q(`
  select count(distinct i.os_id)::int os_em_faturas,
         count(*) filter (where r.id is not null)::int ar_existente_por_os
  from fatura_itens i
  left join financeiro_receber r on r.os_id = i.os_id::text
  where i.os_id is not null`), null, 2));

console.log("\n== total fatura_itens: com os_id vs null ==");
console.log(JSON.stringify(await q(`
  select count(*)::int total, count(os_id)::int com_os, count(alocacao_id)::int com_aloc
  from fatura_itens`), null, 2));

console.log("\n== OS finalizadas sem AR por os_id ==");
console.log(JSON.stringify(await q(`
  select count(*)::int n from ordens_servico o
  where o.status in ('finalizada','encerrada')
    and not exists (select 1 from financeiro_receber r where r.os_id = o.id::text)`), null, 2));
await p.end();
