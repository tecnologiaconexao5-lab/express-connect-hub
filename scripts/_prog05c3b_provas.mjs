import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const hoje = new Date().toISOString().split("T")[0];
const out = { hoje, PAGE_SIZE: 25 };

// Meses (is_teste=false) por vencimento — achar periodo com > 25
out.por_mes = await q(`
  select to_char(data_vencimento,'YYYY-MM') mes, count(*)::int n
  from financeiro_receber where is_teste=false and data_vencimento is not null
  group by 1 order by n desc limit 6`);

// Escolhe o mes com mais registros reais
const mes = out.por_mes[0]?.mes;
out.mes_analisado = mes;

const ativos = await q(`
  select id, data_vencimento::text dv, valor
  from financeiro_receber
  where is_teste=false and lower(status) not in ('cancelado','cancelada')
    and data_vencimento >= $1 and data_vencimento <= ($1::date + interval '1 month - 1 day')
  order by data_vencimento asc, id asc`, [`${mes}-01`]);
out.total_filtrado = ativos.length;
const page1 = ativos.slice(0, 25), page2 = ativos.slice(25, 50);
out.A_total_maior_que_page = ativos.length > 25;
out.B_page1 = page1.map((r) => r.id);
out.B_page2 = page2.map((r) => r.id);
out.C_sem_repeticao = page1.every((r) => !page2.some((x) => x.id === r.id));
out.D_ordenado = ativos.every((r, i) => i === 0 || ativos[i - 1].dv <= r.dv);
out.E_registro_fora_pagina1 = page2[0]
  ? (await q(`select count(*)::int n from financeiro_receber where id=$1 and is_teste=false`, [page2[0].id]))[0].n === 1
  : "n/a";

// Cards globais do mes (aprox statusEfetivo)
const g = await q(`
  select
   coalesce(sum(valor) filter (where data_vencimento >= $2),0) pendentes,
   coalesce(sum(valor) filter (where data_vencimento < $2 and data_pagamento is null),0) vencidos,
   coalesce(sum(valor) filter (where lower(status) in ('pago','parcial') or data_pagamento is not null),0) pagos,
   coalesce(sum(valor),0) total_ativos
  from financeiro_receber
  where is_teste=false and lower(status) not in ('cancelado','cancelada')
    and data_vencimento >= $1 and data_vencimento <= ($1::date + interval '1 month - 1 day')`, [`${mes}-01`, hoje]);
out.F_cards_globais = g[0];
const somaPagina1 = page1.reduce((a, r) => a + (Number(r.valor) || 0), 0);
out.F_soma_pagina1 = somaPagina1;
out.F_cards_diferem_da_pagina = Number(g[0].total_ativos) !== somaPagina1;

// G) teste excluido
out.G_teste_excluido = (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where is_teste=true`))[0];
// H) cancelado excluido dos ativos
out.H_cancelado = (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where lower(status) in ('cancelado','cancelada')`))[0];

// Busca global: pega um registro que NAO esta na pagina 1 e busca pelo cliente
const alvo = page2.find((x) => x) || ativos[25];
if (alvo) {
  const cli = (await q(`select cliente, cliente_nome from financeiro_receber where id=$1`, [alvo.id]))[0];
  const termo = (cli?.cliente_nome || cli?.cliente || "").split(" ")[0];
  const achou = termo
    ? (await q(`select id from financeiro_receber where id=$1 and (descricao ilike $2 or cliente ilike $2)`, [alvo.id, `%${termo}%`])).length === 1
    : false;
  out.E_busca_global = { id: alvo.id, termo, encontrado: achou };
}

// Banco inalterado
out.banco = {
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
};

console.log(JSON.stringify(out, null, 2));
await p.end();
