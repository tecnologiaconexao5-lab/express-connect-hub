// TMS-FIN-PROG-04C.1 — AUDITORIA READ-ONLY (SOMENTE SELECT). Plano do legado.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const snapshot = async () => ({
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
  emitidas: (await q(`select count(*)::int n from faturas where status='emitida'`))[0].n,
  emitidas_sem_ar: (await q(`select count(*)::int n from faturas where status='emitida' and conta_receber_id is null`))[0].n,
  rascunhos: (await q(`select count(*)::int n from faturas where status='rascunho'`))[0].n,
  ar_com_fatura_id: (await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`))[0].n,
  ar_orfaos_fatura_texto: (await q(`select count(*)::int n from financeiro_receber where fatura_id is null and fatura is not null and fatura <> ''`))[0].n,
  contadores: (await q(`select count(*)::int n from fatura_contadores_cliente`))[0].n,
  seq_fatura_2026: (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value ?? null,
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
});

const before = await snapshot();

const F14 = await q(`
  select f.id, f.numero, f.numero_cliente, f.status, f.cliente_id,
         coalesce(c.nome_fantasia, c.razao_social) cliente,
         f.data_emissao::text data_emissao, f.vencimento::text vencimento,
         f.valor_total, f.conta_receber_id, f.metadata->>'numeroManual' numero_manual,
         f.metadata->>'origem' origem, f.criado_em::text criado_em,
         (select count(*)::int from fatura_itens i where i.fatura_id=f.id) n_itens,
         (select count(*)::int from fatura_itens i where i.fatura_id=f.id and i.os_id is not null) n_itens_os
  from faturas f left join clientes c on c.id=f.cliente_id
  where f.status='emitida' and f.conta_receber_id is null
  order by f.criado_em`);

for (const f of F14) {
  f.candidatos_ar = await q(`
    select r.id, r.fatura, r.numero, r.valor, r.status, r.data_vencimento::text data_vencimento,
           r.data_pagamento::text data_pagamento, r.cliente_id, r.descricao
    from financeiro_receber r
    where r.fatura_id is null
      and ( r.cliente_id = $1 )
      and ( r.valor = $2 or r.data_vencimento = $3
            or upper(coalesce(r.fatura,'')) like '%'||upper($4)||'%' )
    order by r.created_at`, [f.cliente_id, f.valor_total, f.vencimento, f.numero_manual || f.numero || ""]);
  const ids = f.candidatos_ar.map((r) => r.id);
  f.baixas = ids.length ? await q(`select titulo_id, valor_baixado, data_baixa::text, estornada from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id = any($1)`, [ids]) : [];
  f.tem_pagamento = f.candidatos_ar.some((r) => r.data_pagamento || ["pago", "parcial", "recebido"].includes((r.status || "").toLowerCase()));
}

// Fatura 41 e 42 detalhes
const detalhe = async (num) => {
  const [f] = await q(`select f.*, f.data_emissao::text de, f.vencimento::text vc from faturas f where f.metadata->>'numeroManual' = $1`, [num]);
  if (!f) return null;
  const itens = await q(`select id, os_id, descricao, valor_base, valor_total, status from fatura_itens where fatura_id=$1`, [f.id]);
  const arFaturaId = await q(`select id, valor, status from financeiro_receber where fatura_id=$1`, [f.id]);
  const orfaos = await q(`select id, fatura, numero, valor, status, data_vencimento::text dv, data_pagamento::text dp, cliente_id, descricao from financeiro_receber where fatura_id is null and (fatura = $1 or numero = $1)`, [num]);
  return {
    id: f.id, numero: f.numero, numero_cliente: f.numero_cliente, status: f.status,
    cliente_id: f.cliente_id, cliente: (await q(`select coalesce(nome_fantasia,razao_social) c from clientes where id=$1`, [f.cliente_id]))[0]?.c,
    data_emissao: f.de, vencimento: f.vc, valor_total: Number(f.valor_total),
    conta_receber_id: f.conta_receber_id, metadata: f.metadata, criado_em: f.criado_em,
    itens: itens.map((i) => ({ ...i, valor_base: Number(i.valor_base), valor_total: Number(i.valor_total) })),
    ar_por_fatura_id: arFaturaId, ar_orfaos_texto: orfaos,
  };
};

// Historico por cliente (ordem para backfill Nº Cliente)
const histClientes = await q(`
  select f.cliente_id, coalesce(c.nome_fantasia,c.razao_social) cliente,
         count(*)::int n,
         count(*) filter (where f.status='emitida')::int emitidas,
         count(*) filter (where f.metadata->>'origem'='manual')::int manuais
  from faturas f left join clientes c on c.id=f.cliente_id
  group by 1,2 order by n desc`);
for (const hc of histClientes) {
  hc.faturas = await q(`
    select id, coalesce(numero, metadata->>'numeroManual') ref, numero, numero_cliente, status,
           metadata->>'origem' origem, data_emissao::text de, criado_em::text ce, valor_total
    from faturas where cliente_id=$1 order by criado_em`, [hc.cliente_id]);
}

// ARs orfaos que casam por cliente+valor de ALGUMA das 14 (visao ampla)
const clientes14 = [...new Set(F14.map((f) => f.cliente_id))];
const arOrfaosClientes = await q(`
  select r.id, r.fatura, r.numero, r.valor, r.status, r.data_vencimento::text dv,
         r.data_pagamento::text dp, r.cliente_id, r.descricao
  from financeiro_receber r
  where r.fatura_id is null and r.cliente_id = any($1) order by r.created_at`, [clientes14]);

const after = await snapshot();
console.log(JSON.stringify({ before, F14, fatura41: await detalhe("41"), fatura42: await detalhe("42"), histClientes, arOrfaosClientes, after, INALTERADO: JSON.stringify(before) === JSON.stringify(after) }, null, 2));
await p.end();
