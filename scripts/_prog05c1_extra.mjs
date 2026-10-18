import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const out = {};

// 1) FAT-2026-000001
out.fat000001 = {
  fatura: await q(`select id, numero, status, cliente_id, valor_bruto, descontos, acrescimos, valor_total, vencimento::text, conta_receber_id from faturas where id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb'`),
  item: await q(`select id, os_id, alocacao_id, valor_base, valor_adicionais, valor_descontos, valor_total, km_excedente, pedagio_cliente, ajudante_cliente from fatura_itens where fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb'`),
  ar_fatura: await q(`select id, valor, status, data_vencimento::text, data_pagamento::text, fatura_id::text, os_id from financeiro_receber where fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb'`),
  ar_os: await q(`select id, valor, status, data_vencimento::text, data_pagamento::text, fatura_id::text, os_id from financeiro_receber where os_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`),
  alocacao: await q(`select id, status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador, reversa_valor_cliente, cliente_id, prestador_id, ordem_servico_id::text, data_escala::text from alocacoes_escala where id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`),
  composicao: await q(`select os_id, valor_cliente, valor_prestador, pedagio_valor, outros_custos, adicional_valor, ajudante_valor, desconto_valor, margem_bruta from composicao_financeira_os where os_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`),
  baixas: await q(`select titulo_id, valor_baixado, estornada from financeiro_baixas where titulo_id in ('346687cf-f35d-4cde-8a26-47bdcff46de1','75e0e5f0-c512-49b6-9542-716362705c08')`),
  os_aloc: await q(`select id, numero, status, valor_cliente, custo_prestador from ordens_servico where id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`),
};

// 2) Rascunhos com risco
out.rascunhos_risco = await q(`
  select f.id fatura_id, f.cliente_id, coalesce(c.nome_fantasia,c.razao_social) cliente,
         f.valor_total, f.status,
         count(distinct i.id)::int n_itens,
         count(distinct i.os_id)::int n_itens_com_os,
         count(distinct i.alocacao_id)::int n_itens_com_aloc,
         array_agg(distinct ar.os_id) filter (where ar.id is not null) ars_legados_os
  from faturas f
  left join clientes c on c.id=f.cliente_id
  join fatura_itens i on i.fatura_id=f.id
  left join financeiro_receber ar on (ar.os_id = i.os_id::text or ar.os_id = i.alocacao_id::text)
  where f.status='rascunho'
  group by f.id, f.cliente_id, c.nome_fantasia, c.razao_social, f.valor_total, f.status
  order by n_itens_com_aloc desc, f.criado_em`);
out.rascunhos_risco = out.rascunhos_risco.map((r) => ({
  ...r,
  risco: (r.ars_legados_os && r.ars_legados_os.length > 0) ? "DUPLICARIA_AO_EMITIR" : "SEM_AR_LEGADO",
}));

// 3) Anti-duplicidade: definicao
out.anti_dup = (await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_trg_fatura_itens_anti_duplicidade'`))[0]?.def;

// 4) Impacto
out.impacto = {
  receber_total_linhas: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber`))[0],
  ar_oficial_fatura: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where fatura_id is not null`))[0],
  ar_legado_os: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where os_id is not null`))[0],
  ar_sem_ambos: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where os_id is null and fatura_id is null`))[0],
  ar_pagos_ou_baixados: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where lower(status) in ('pago','recebido','parcial') or data_pagamento is not null`))[0],
  baixas_receber: (await q(`select count(*)::int n, coalesce(sum(valor_baixado),0) total from financeiro_baixas where titulo_tabela='financeiro_receber' and not estornada`))[0],
};

console.log(JSON.stringify(out, null, 2));
await p.end();
