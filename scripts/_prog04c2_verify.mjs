import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const out = {};
const REFS5 = ["38", "39", "40.", "41", "42"];

out.saneadas = await q(`
  select f.metadata->>'numeroManual' ref, f.numero, f.numero_cliente, f.status, f.valor_total,
         f.vencimento::text venc, r.id ar_id, r.status ar_status, r.valor ar_valor,
         r.data_vencimento::text ar_venc, r.data_pagamento::text ar_pgto,
         (select count(*)::int from financeiro_receber r2 where r2.fatura_id=f.id) n_ar,
         (select coalesce(sum(valor_baixado),0) from financeiro_baixas b where b.titulo_tabela='financeiro_receber' and b.titulo_id=r.id and not b.estornada) baixa
  from faturas f left join financeiro_receber r on r.fatura_id=f.id
  where f.cliente_id='91b80fdb-6b87-4982-a550-f863f7f15866' and f.metadata->>'numeroManual' = any($1)
  order by f.numero_cliente`, [REFS5]);

// Proibidos / pendentes
out.fatura40_ambiguа = await q(`select metadata->>'numeroManual' ref, numero, numero_cliente, status, conta_receber_id, valor_total from faturas where id='8309a22b-9f13-4610-bdb7-ab4008d6fd81'`);
out.m43 = await q(`select f.numero, f.numero_cliente, f.status, f.cliente_id, (select count(*)::int from financeiro_receber r where r.fatura_id=f.id) n_ar from faturas f where f.id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb'`);
out.teste8 = await q(`select metadata->>'numeroManual' ref, numero, numero_cliente, conta_receber_id, status from faturas where id in ('27f7bb25-da0a-492c-b5dc-c82701e29cd6','dae9198f-a987-4dec-8b83-231959024b70','6f1afe5c-2024-45ae-b004-34fbf1783c38','dfd02445-56d0-44a3-b150-2e584ea7d94b','1154348c-9789-4faf-b58e-a7788fb55835','b48458bf-157a-4f07-a852-429a4596635d','fec71115-a73c-4add-b9c0-78329d11cb1c','a641c456-2415-4d02-a55e-282cf51b9dbb') order by criado_em`);

out.contadores = await q(`select tenant_id, cliente_id, ultimo_numero from fatura_contadores_cliente order by cliente_id`);
out.seq = (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value;
out.contagens = {
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
  emitidas: (await q(`select count(*)::int n from faturas where status='emitida'`))[0].n,
  emitidas_sem_ar: (await q(`select count(*)::int n from faturas where status='emitida' and conta_receber_id is null`))[0].n,
  rascunhos: (await q(`select count(*)::int n from faturas where status='rascunho'`))[0].n,
  ar_com_fatura_id: (await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`))[0].n,
  ar_orfaos_texto: (await q(`select count(*)::int n from financeiro_receber where fatura_id is null and fatura is not null and fatura <> ''`))[0].n,
};
// duplicidade de AR por fatura
out.ar_duplicado = await q(`select fatura_id, count(*)::int n from financeiro_receber where fatura_id is not null group by fatura_id having count(*) > 1`);

console.log(JSON.stringify(out, null, 2));
await p.end();
