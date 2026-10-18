// TMS-FIN-PROG-05A — inventário quantitativo READ-ONLY.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const out = {};

out.receber = {
  total: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber`))[0],
  por_os_id: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where os_id is not null`))[0],
  por_fatura_id: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where fatura_id is not null`))[0],
  sem_ambos: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where os_id is null and fatura_id is null`))[0],
  is_teste: (await q(`select count(*)::int n from financeiro_receber where is_teste`))[0],
  por_status: await q(`select status, count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber group by status order by n desc`),
};

// Duplicidade econômica: AR por os_id cujo os_id também aparece em fatura_itens de fatura com AR (fatura_id)
out.receber_duplicidade = await q(`
  select count(distinct r.id)::int n_ar_por_os,
         count(distinct f.id)::int n_faturas
  from financeiro_receber r
  join fatura_itens i on i.os_id::text = r.os_id
  join faturas f on f.id = i.fatura_id
  where r.fatura_id is null and r.os_id is not null and f.conta_receber_id is not null`);

// Exemplos concretos: AR por os_id (M66/M80) dos últimos
out.receber_por_os_exemplos = await q(`
  select id, os_id, cliente_id, valor, status, data_vencimento::text dv, is_teste
  from financeiro_receber where os_id is not null order by created_at desc limit 8`);
out.receber_por_fatura_exemplos = await q(`
  select r.id, r.fatura_id, f.numero, f.numero_cliente, r.valor, r.status
  from financeiro_receber r join faturas f on f.id = r.fatura_id order by f.numero_cliente nulls last`);

out.pagar = {
  total: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_pagar`))[0],
  por_os_id: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_pagar where os_id is not null`))[0],
  sem_os: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_pagar where os_id is null`))[0],
  com_fornecedor: (await q(`select count(*)::int n from financeiro_pagar where fornecedor_id is not null or prestador is not null`))[0],
  is_teste: (await q(`select count(*)::int n from financeiro_pagar where is_teste`))[0],
  por_status: await q(`select status, count(*)::int n, coalesce(sum(valor),0) total from financeiro_pagar group by status order by n desc`),
};

out.pag_prest = {
  total: (await q(`select count(*)::int n, coalesce(sum(valor_liquido),0) total from pagamentos_prestadores`))[0],
  por_os_id: (await q(`select count(*)::int n, coalesce(sum(valor_liquido),0) total from pagamentos_prestadores where os_id is not null`))[0],
  is_teste: (await q(`select count(*)::int n from pagamentos_prestadores where is_teste`))[0],
  por_status_pagamento: await q(`select status_pagamento, count(*)::int n, coalesce(sum(valor_liquido),0) total from pagamentos_prestadores group by status_pagamento order by n desc`),
  por_status_conferencia: await q(`select status_conferencia, count(*)::int n from pagamentos_prestadores group by status_conferencia order by n desc`),
  por_origem: await q(`select origem_lancamento, count(*)::int n, coalesce(sum(valor_liquido),0) total from pagamentos_prestadores group by origem_lancamento order by n desc`),
};

out.composicao = {
  total: (await q(`select count(*)::int n from composicao_financeira_os`))[0],
  cobertura_os: (await q(`select count(distinct os_id)::int n from composicao_financeira_os`))[0],
  por_origem: await q(`select origem_calculo, count(*)::int n from composicao_financeira_os group by origem_calculo order by n desc`),
};

// OS/alocacoes concluidas: quantas tem AR os_id vs nao
out.os_concluidas = await q(`select count(*)::int n from ordens_servico where status in ('finalizada','encerrada')`);
out.aloc_concluidas = await q(`select count(*)::int n from alocacoes_escala where status='concluida' and finalizada=true`);

// PROG-04B/04C baseline
out.baseline = {
  f_emitir_fatura_existe: (await q(`select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_emitir_fatura'`)).length === 1,
  uq_receber_fatura_id: (await q(`select indexname from pg_indexes where schemaname='public' and indexname='uq_receber_fatura_id'`)).length === 1,
  numero_cliente_col: (await q(`select 1 from information_schema.columns where table_schema='public' and table_name='faturas' and column_name='numero_cliente'`)).length === 1,
  saneadas: await q(`select metadata->>'numeroManual' ref, numero, numero_cliente, status, conta_receber_id is not null tem_ar
                     from faturas where metadata->>'numeroManual' in ('38','39','40.','41','42') order by numero_cliente`),
  f_trg_propagar_financeiro_alocacao: (await q(`select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_trg_propagar_financeiro_alocacao'`)).length === 1,
  f_trg_propagar_financeiro_os: (await q(`select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_trg_propagar_financeiro_os'`)).length === 1,
};

console.log(JSON.stringify(out, null, 2));
await p.end();
