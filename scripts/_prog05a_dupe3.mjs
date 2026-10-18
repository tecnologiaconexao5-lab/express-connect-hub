import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

console.log("== faturas cujo item.alocacao_id tem AR por os_id (agrupado por status) ==");
console.log(JSON.stringify(await q(`
  select f.status, count(distinct f.id)::int faturas,
         count(distinct i.alocacao_id)::int alocacoes,
         coalesce(sum(distinct_by_ar.valor),0) total_ar_os
  from faturas f
  join fatura_itens i on i.fatura_id=f.id
  join financeiro_receber ar on ar.os_id = i.alocacao_id::text
  join lateral (select ar.valor) distinct_by_ar on true
  where i.alocacao_id is not null
  group by f.status`), null, 2));

console.log("\n== exemplo FAT-2026-000001 (duplicidade concreta) ==");
console.log(JSON.stringify(await q(`
  select 'AR por fatura_id' via, r.id, r.valor, r.status, r.fatura_id::text ref
  from financeiro_receber r where r.fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb'
  union all
  select 'AR por os_id (M66)', r.id, r.valor, r.status, r.os_id
  from financeiro_receber r where r.os_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'
  union all
  select 'item da fatura', i.id, i.valor_total, i.status, coalesce(i.os_id::text,i.alocacao_id::text)
  from fatura_itens i where i.fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb'`), null, 2));

console.log("\n== soma potencial de duplicidade: AR por os_id de alocacoes que estao em faturas com AR ==");
console.log(JSON.stringify(await q(`
  select count(distinct r.id)::int ar_rows, coalesce(sum(distinct r.valor),0) total
  from financeiro_receber r
  where r.fatura_id is null and r.os_id is not null
    and exists (
      select 1 from fatura_itens i join faturas f on f.id=i.fatura_id
      where i.alocacao_id::text = r.os_id and f.conta_receber_id is not null)`), null, 2));

console.log("\n== OS finalizadas: com AR por os_id e em alguma fatura ==");
console.log(JSON.stringify(await q(`
  select count(distinct o.id)::int n from ordens_servico o
  where o.status in ('finalizada','encerrada')
    and exists (select 1 from financeiro_receber r where r.os_id=o.id::text)
    and exists (select 1 from fatura_itens i where i.os_id=o.id)`), null, 2));
await p.end();
