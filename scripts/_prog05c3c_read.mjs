// TMS-FIN-PROG-05C.3C — FASE 1/2/3 READ-ONLY do caso Calvo.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const out = {};

out.fatura = (await q(`select id, tenant_id, cliente_id, status, valor_bruto, acrescimos, descontos, valor_total, vencimento::text, data_emissao::text, numero, numero_cliente, conta_receber_id, metadata, criado_em::text from faturas where id='e5318b9d-120a-4a2b-a077-bebcdf8cf34c'`))[0];
out.cliente = (await q(`select id, razao_social, nome_fantasia, cnpj from clientes where id=$1`, [out.fatura?.cliente_id]))[0];
out.itens = await q(`select id, os_id, alocacao_id, cliente_id, romaneio, descricao, data_servico::text, valor_base, valor_adicionais, valor_descontos, valor_total, status from fatura_itens where fatura_id='e5318b9d-120a-4a2b-a077-bebcdf8cf34c' order by criado_em`);

// Para cada item, alocação + AR legado (os_id = alocacao id) + baixas
out.itens_detalhe = [];
for (const it of out.itens) {
  const aloc = it.alocacao_id ? (await q(`select id, status, finalizada, valor_frete, valor_repasse, valor_adicional, valor_pedagio, cliente_id, prestador_id, ordem_servico_id::text, data_escala::text from alocacoes_escala where id=$1`, [it.alocacao_id]))[0] : null;
  const ars = it.alocacao_id
    ? await q(`select id, cliente_id, os_id, valor, data_vencimento::text, status, data_pagamento::text, fatura_id, descricao, is_teste, categoria from financeiro_receber where os_id=$1`, [it.alocacao_id])
    : [];
  const baixas = [];
  for (const a of ars) baixas.push(...(await q(`select titulo_id, valor_baixado, data_baixa::text, estornada from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [a.id])));
  out.itens_detalhe.push({ item: it, alocacao: aloc, ars_legados: ars, baixas, os_id_do_item: it.os_id });
}

out.contagens = {
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
  contador_cliente: await q(`select * from fatura_contadores_cliente where cliente_id=$1`, [out.fatura?.cliente_id]),
  seq: (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value,
};
console.log(JSON.stringify(out, null, 2));
await p.end();
