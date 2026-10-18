// TMS-FIN-PROG-05C.1 — classificação READ-ONLY dos 98 AR por os_id.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const snapshot = async () => ({
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  por_os: (await q(`select count(*)::int n from financeiro_receber where os_id is not null`))[0].n,
  por_fatura: (await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`))[0].n,
  pagar_total: (await q(`select count(*)::int n from financeiro_pagar`))[0].n,
  prestadores_total: (await q(`select count(*)::int n from pagamentos_prestadores`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
});
const before = await snapshot();

const ars = await q(`
  select r.id, r.os_id, r.cliente_id, r.valor, r.data_vencimento::text dv, r.status,
         r.data_pagamento::text dp, r.is_teste, r.descricao, r.fatura, r.numero,
         coalesce(c.nome_fantasia, c.razao_social) cliente
  from financeiro_receber r left join clientes c on c.id = r.cliente_id
  where r.os_id is not null order by r.created_at`);

const rows = [];
for (const r of ars) {
  const baixas = await q(`select valor_baixado, data_baixa::text, estornada from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [r.id]);
  const baixa = baixas.some((b) => !b.estornada);
  const os = (await q(`select id, numero, status from ordens_servico where id::text=$1`, [r.os_id]))[0] || null;
  const aloc = (await q(`select id, status, finalizada, ordem_servico_id from alocacoes_escala where id::text=$1`, [r.os_id]))[0] || null;
  const itens = await q(`
    select i.fatura_id, i.os_id, i.alocacao_id, i.valor_total,
           f.status fstatus, f.numero fnum, f.conta_receber_id far
    from fatura_itens i join faturas f on f.id=i.fatura_id
    where i.os_id::text=$1 or i.alocacao_id::text=$1`, [r.os_id]);
  const itensComFaturaAr = itens.filter((i) => i.far);
  const itensQualquerFatura = itens.filter((i) => i.fstatus);

  const sinais = [];
  if (r.is_teste === true) sinais.push("is_teste=true");
  if (/TESTE|HOMOLOG|DEMO|HML/i.test(r.cliente || "")) sinais.push("cliente-nome-test");
  if (/^\s*M\d+_\d{4}-\d{2}-\d{2}_/.test(r.cliente || "")) sinais.push("cliente-gerado-M##");
  if (/TESTE|HOMOLOG|INCOMPAT|MISS[AÃ]O 4\d/i.test(r.descricao || "")) sinais.push("descricao-test");
  if (/TESTE|HOMOLOG/i.test(r.fatura || "")) sinais.push("fatura_txt-test");
  if (os && /(TESTE|TEST|HOMOLOG|GO-LIVE|DEMO|HML)/i.test(os.numero || "")) sinais.push("os-numero-test:" + os.numero);
  const testSignal = sinais.length > 0;
  const semCliente = !r.cliente_id;
  const cancelado = ["cancelado", "cancelada"].includes((r.status || "").toLowerCase());
  const pago = ["pago", "parcial", "recebido"].includes((r.status || "").toLowerCase()) || !!r.dp || baixa;
  const operacaoReal = !!(os || aloc);
  const jaFaturadoComAr = itensComFaturaAr.length > 0;

  let cls, reason;
  if (cancelado) { cls = "E"; reason = "status cancelado"; }
  else if (testSignal) { cls = "D"; reason = "teste/HML: " + sinais.join("; "); }
  else if (pago) { cls = "C"; reason = "pago/baixado (preservar historico)"; }
  else if (semCliente) { cls = "F"; reason = "sem cliente vinculado (nao faturavel sem cadastro)"; }
  else if (jaFaturadoComAr) { cls = "B"; reason = "operacao ja tem fatura com AR oficial"; }
  else if (operacaoReal) { cls = "A"; reason = "operacao real ainda nao faturada oficialmente"; }
  else { cls = "F"; reason = "sem OS/alocacao e sem fatura"; }

  rows.push({
    id: r.id, os_id: r.os_id, cliente_id: r.cliente_id, cliente: r.cliente, valor: r.valor,
    dv: r.dv, status: r.status, dp: r.dp, baixa, is_teste: r.is_teste,
    descricao: r.descricao, fatura_txt: r.fatura,
    os: os ? { id: os.id, numero: os.numero, status: os.status } : null,
    aloc: aloc ? { id: aloc.id, status: aloc.status, finalizada: aloc.finalizada, os_vinculo: aloc.ordem_servico_id } : null,
    faturas_itens: itensQualquerFatura.map((i) => ({ fatura_id: i.fatura_id, fstatus: i.fstatus, fnum: i.fnum, tem_ar: !!i.far })),
    classe: cls, motivo: reason, sinais_teste: sinais,
  });
}

const classeCount = rows.reduce((a, r) => (a[r.classe] = (a[r.classe] || 0) + 1, a), {});
const somas = rows.reduce((a, r) => { a[r.classe] = (a[r.classe] || 0) + (Number(r.valor) || 0); return a; }, {});

const after = await snapshot();
console.log(JSON.stringify({ before, classeCount, somas, rows, after, INALTERADO: JSON.stringify(before) === JSON.stringify(after) }, null, 2));
await p.end();
