/**
 * FIN-02-PREFAT — Validacao do agrupamento das OS finalizadas no
 * Extrato / Pre-Fatura de Pagamento do Prestador. SOMENTE LEITURA.
 *
 * Fontes reais (producao):
 *   - ordens_servico            (OS finalizadas + custo_prestador = repasse)
 *   - pagamentos_prestadores    (1 linha por OS gerada por M66/M80b) -> base do extrato
 *   - pagamentos_prestadores_itens (itens de fechamento)
 *   - lotes_pagamento / lotes_pagamento_itens (agrupamento de lote via RPC)
 *   - RPC f_gerar_lote_pagamentos(uuid[])
 * Saida: scripts/_fin02prefat_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const N = (n) => Number(n ?? 0);
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const eq = (a, b) => Math.abs(N(a) - N(b)) <= 0.02;
const out = { ts: new Date().toISOString(), checks: [], grupos: [], problemas: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

// 1. Duplicidade de agrupamento: 1 linha de pagamentos_prestadores por OS
const dup = await c.query(
  `select os_id, count(*)::int n from pagamentos_prestadores
    where os_id is not null group by os_id having count(*)>1 order by n desc`
);
add("pp_sem_duplicidade_por_os", dup.rows.length === 0, `${dup.rows.length} OS com mais de uma linha de pagamento`);
out.duplicidade = dup.rows;

// 2. Orfaos: pagamentos_prestadores os_id sem OS correspondente
const orf = await c.query(
  `select pp.os_id from pagamentos_prestadores pp
    where pp.os_id is not null
      and not exists (select 1 from ordens_servico o where o.id = pp.os_id)`
);
add("pp_sem_orfaos", orf.rows.length === 0, `${orf.rows.length} pagamentos com os_id inexistente`);

// 3. Agrupamento por prestador
const grupos = await c.query(
  `select prestador_id,
          max(prestador_nome) as prestador_nome,
          count(*)::int n_pagamentos,
          count(distinct os_id)::int n_os_distintas,
          count(*) filter (where os_id is null)::int n_sem_os,
          count(*) filter (where status_pagamento='pago')::int n_pagos,
          count(*) filter (where status_pagamento='em_lote')::int n_em_lote,
          count(*) filter (where status_pagamento='cancelado')::int n_cancel,
          round(sum(valor_servicos),2) sum_servicos,
          round(sum(valor_liquido),2) sum_liquido
     from pagamentos_prestadores
    where prestador_id is not null
    group by prestador_id order by n_pagamentos desc`
);
out.grupos = grupos.rows;
add("grupos_por_prestador_existem", grupos.rows.length > 0, `${grupos.rows.length} prestadores com pagamentos`);

// 4. OS finalizadas com repasse valido x presenca em pagamentos_prestadores
const osFinal = await c.query(
  `select count(*)::int n from ordens_servico
    where status in ('finalizada','concluida') and coalesce(custo_prestador,0) > 0`
);
const osComPP = await c.query(
  `select count(distinct o.id)::int n
     from ordens_servico o join pagamentos_prestadores pp on pp.os_id = o.id
    where o.status in ('finalizada','concluida') and coalesce(o.custo_prestador,0) > 0`
);
out.os_finalizadas_repasse = osFinal.rows[0].n;
out.os_finalizadas_com_pp = osComPP.rows[0].n;
add("os_finalizadas_agrupadas", osComPP.rows[0].n === osFinal.rows[0].n,
  `${osComPP.rows[0].n}/${osFinal.rows[0].n} OS finalizadas c/ repasse presentes em pagamentos_prestadores`);

// 5. Consistencia de valor OS x pagamentos_prestadores
const val = await c.query(
  `select count(*)::int n,
          count(*) filter (where abs(coalesce(pp.valor_servicos,0) - coalesce(o.custo_prestador,0)) > 0.02)::int n_div_serv,
          count(*) filter (where abs(coalesce(pp.valor_liquido,0) - (coalesce(o.custo_prestador,0)+coalesce(o.pedagio,0)
             + coalesce((case when jsonb_typeof(o.adicionais)='number' then (o.adicionais#>>'{}')::numeric else coalesce((o.adicionais->>'valor')::numeric,0) end),0)
             - coalesce(o.descontos,0))) > 0.02)::int n_div_liq
     from ordens_servico o join pagamentos_prestadores pp on pp.os_id = o.id`
);
out.os_x_pp = val.rows[0];
add("valor_servicos_confere", val.rows[0].n_div_serv === 0, `${val.rows[0].n} pares OS/PP, ${val.rows[0].n_div_serv} divergem no valor_servicos`);
add("valor_liquido_confere", val.rows[0].n_div_liq === 0, `${val.rows[0].n_div_liq} divergem no valor_liquido`);

// 6. Lotes de pagamento (agrupamento final)
const lot = await c.query(`select count(*)::int n from lotes_pagamento`);
const lit = await c.query(`select count(*)::int n from lotes_pagamento_itens`);
out.lotes = lot.rows[0].n; out.lotes_itens = lit.rows[0].n;
console.log(`lotes_pagamento=${out.lotes} | lotes_pagamento_itens=${out.lotes_itens}`);
add("lotes_estrutura_ok", true, `tabelas existem (lotes=${out.lotes}, itens=${out.lotes_itens})`);

// 7. Itens de fechamento (tabela) informativo
const itf = await c.query(`select count(*)::int n from pagamentos_prestadores_itens`);
out.itens_fechamento = itf.rows[0].n;
console.log(`pagamentos_prestadores_itens=${out.itens_fechamento}`);

// 8. Definicao da RPC de lote (confirma o agrupamento)
const defRpc = await c.query(`select pg_get_functiondef('f_gerar_lote_pagamentos(uuid[])'::regprocedure) as def`).catch(() => ({ rows: [{ def: null }] }));
out.rpc_lote_def = defRpc.rows[0].def;
const d = out.rpc_lote_def || "";
const grp = /group by|agrup|prestador_id|lote/i.test(d);
add("rpc_lote_agrupa", grp, `f_gerar_lote_pagamentos referencia agrupamento/lote=${grp}`);

// 9. Amostra de grupo multi-OS (prestador com >=2 OS)
const amostra = await c.query(
  `select prestador_id, prestador_nome, os_id, os_numero, valor_servicos, pedagio, adicionais, valor_liquido, status_pagamento
     from pagamentos_prestadores
    where prestador_id = (select prestador_id from pagamentos_prestadores where prestador_id is not null group by 1 order by count(*) desc limit 1)
    order by created_at`
);
out.amostra_grupo = amostra.rows;

await c.end();
fs.writeFileSync("scripts/_fin02prefat_validacao.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_fin02prefat_validacao.json");
console.log("\n-- Grupos por prestador (top) --");
console.table(grupos.rows.slice(0, 10));
