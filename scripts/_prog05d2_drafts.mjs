import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const drafts = await q(`
  select f.id, coalesce(c.nome_fantasia,c.razao_social) cliente, f.cliente_id,
         f.valor_total, f.vencimento::text venc, f.metadata->>'numeroManual' num_manual,
         (select count(*)::int from fatura_itens i where i.fatura_id=f.id) n_itens,
         (select count(*)::int from financeiro_receber r where r.fatura_id=f.id) ar_fatura
  from faturas f left join clientes c on c.id=f.cliente_id
  where f.status='rascunho' order by f.criado_em`);

for (const d of drafts) {
  d.itens_sem_ar_legado = (await q(`
    select count(*)::int n
    from fatura_itens i
    where i.fatura_id=$1
      and not exists (select 1 from financeiro_receber r where r.os_id = coalesce(i.os_id::text, i.alocacao_id::text))
  `, [d.id]))[0].n;
  d.itens_com_aloc = (await q(`select count(*)::int n from fatura_itens where fatura_id=$1 and alocacao_id is not null`, [d.id]))[0].n;
}

console.log(JSON.stringify(drafts.map((d) => ({
  id: d.id, cliente: d.cliente, valor: d.valor_total, venc: d.venc, num_manual: d.num_manual,
  n_itens: d.n_itens, ar_fatura: d.ar_fatura, itens_sem_ar_legado: d.itens_sem_ar_legado, itens_com_aloc: d.itens_com_aloc,
})), null, 2));
await p.end();
