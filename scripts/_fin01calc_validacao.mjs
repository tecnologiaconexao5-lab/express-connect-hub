/**
 * FIN-01-CALC — Validacao do calculo de frete / valor do prestador no
 * encerramento da OS. SOMENTE LEITURA (SELECT).
 *
 * Confere a formula oficial dos triggers M66 (escala) / M80b (OS direta):
 *   outros_custos = adicionais + ajudante - descontos
 *   margem_bruta  = valor_cliente - valor_prestador - pedagio - outros_custos
 *   imposto       = valor_cliente * 4.5%
 *   seguro        = valor_cliente * 1%
 *   margem_liquida= margem_bruta - imposto - seguro
 *
 * Saida: scripts/_fin01calc_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";

const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const out = { ts: new Date().toISOString(), checks: [], os: [], resumo: {} };
const add = (name, ok, detail) => {
  out.checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name} — ${detail}`);
};
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const eq = (a, b, tol = 0.01) => Math.abs(Number(a) - Number(b)) <= tol;

// --- 0. estrutura ----------------------------------------------------------
const cols = await c.query(
  `select column_name from information_schema.columns
    where table_name='ordens_servico'
      and column_name in ('valor_cliente','custo_prestador','pedagio','adicionais','ajudante','descontos','status')
    order by column_name`
);
out.colunas_ordens_servico = cols.rows.map((x) => x.column_name);
console.log("colunas financeiras em ordens_servico:", JSON.stringify(out.colunas_ordens_servico));

const hasOSValores = await c.query(
  `select to_regclass('public.os_valores') as t`
);
out.tem_os_valores = hasOSValores.rows[0].t;
console.log("tabela os_valores existe?:", out.tem_os_valores);

// --- 1. resumo geral -------------------------------------------------------
const tot = await c.query(
  `select count(*)::int as n,
          count(*) filter (where status='finalizada')::int as finalizadas,
          count(*) filter (where coalesce(valor_cliente,0)>0)::int as com_valor_cliente,
          count(*) filter (where coalesce(custo_prestador,0)>0)::int as com_custo_prestador
     from ordens_servico`
);
out.resumo.os = tot.rows[0];
console.log("resumo ordens_servico:", JSON.stringify(tot.rows[0]));

const compTot = await c.query(`select count(*)::int as n from composicao_financeira_os`).catch(() => ({ rows: [{ n: -1 }] }));
out.resumo.composicoes = compTot.rows[0].n;
console.log("composicoes financeiras:", out.resumo.composicoes);

// --- 2. candidatos ---------------------------------------------------------
// Prioriza OS finalizada com composicao financeira (encerramento real).
const cand = await c.query(
  `select o.id, o.numero, o.status, o.data,
          o.valor_cliente, o.custo_prestador, o.pedagio,
          o.adicionais, o.ajudante, o.descontos,
          o.cliente, o.cliente_id, o.prestador, o.prestador_id,
          comp.id as comp_id, comp.valor_cliente as comp_vc, comp.valor_prestador as comp_vp,
          comp.imposto_percentual, comp.imposto_valor, comp.seguro_valor,
          comp.pedagio_valor, comp.outros_custos,
          comp.margem_bruta, comp.margem_liquida,
          comp.percentual_margem_bruta as pct_bruta, comp.percentual_margem_liquida as pct_liquida,
          comp.origem_calculo
     from ordens_servico o
     left join composicao_financeira_os comp on comp.os_id = o.id
    where coalesce(o.valor_cliente,0) > 0 or coalesce(o.custo_prestador,0) > 0
    order by (comp.id is not null) desc, o.created_at desc
    limit 25`
);

if (!cand.rows.length) {
  add("0_sem_os_com_valor", false, "nenhuma OS com valor_cliente/custo_prestador cadastrado");
} else {
  add("0_os_com_valor_encontradas", true, `${cand.rows.length} OS com valores (limit 25)`);
}

const num = (jsonb) => {
  if (jsonb === null || jsonb === undefined) return 0;
  if (typeof jsonb === "number") return jsonb;
  if (typeof jsonb === "object") return Number(jsonb.valor ?? 0) || 0;
  const n = Number(jsonb);
  return isNaN(n) ? 0 : n;
};

let validados = 0;
for (const o of cand.rows) {
  const item = {
    id: o.id,
    numero: o.numero,
    status: o.status,
    valor_cliente: Number(o.valor_cliente ?? 0),
    custo_prestador: Number(o.custo_prestador ?? 0),
    pedagio: Number(o.pedagio ?? 0),
    adicionais: num(o.adicionais),
    ajudante: num(o.ajudante),
    descontos: Number(o.descontos ?? 0),
    origem_calculo: o.origem_calculo || null,
    checks: [],
  };
  const ic = (n, ok, det) => { item.checks.push({ name: n, ok: !!ok, detail: det }); };

  if (!o.comp_id) {
    ic("composicao_existe", false, "sem composicao_financeira_os (OS ainda nao encerrada / sem trigger)");
    out.os.push(item);
    continue;
  }

  validados++;
  const outros = r2(item.adicionais + item.ajudante - item.descontos);
  const impostoEsp = r2(item.valor_cliente * 4.5 / 100);
  const seguroEsp = r2(item.valor_cliente * 1 / 100);
  const brutaEsp = r2(item.valor_cliente - item.custo_prestador - item.pedagio - outros);
  const liquidaEsp = r2(brutaEsp - impostoEsp - seguroEsp);
  const pctBrutaEsp = item.valor_cliente > 0 ? r2(brutaEsp / item.valor_cliente * 100) : 0;
  const pctLiquidaEsp = item.valor_cliente > 0 ? r2(liquidaEsp / item.valor_cliente * 100) : 0;

  item.esperado = { outros_custos: outros, imposto: impostoEsp, seguro: seguroEsp, margem_bruta: brutaEsp, margem_liquida: liquidaEsp };
  item.composicao = {
    valor_cliente: Number(o.comp_vc ?? 0),
    valor_prestador: Number(o.comp_vp ?? 0),
    imposto_percentual: Number(o.imposto_percentual ?? 0),
    imposto_valor: Number(o.imposto_valor ?? 0),
    seguro_valor: Number(o.seguro_valor ?? 0),
    pedagio_valor: Number(o.pedagio_valor ?? 0),
    outros_custos: Number(o.outros_custos ?? 0),
    margem_bruta: Number(o.margem_bruta ?? 0),
    margem_liquida: Number(o.margem_liquida ?? 0),
    pct_bruta: Number(o.pct_bruta ?? 0),
    pct_liquida: Number(o.pct_liquida ?? 0),
    origem_calculo: o.origem_calculo,
  };

  ic("comp_valor_cliente", eq(o.comp_vc, item.valor_cliente), `comp=${o.comp_vc} os=${item.valor_cliente}`);
  ic("comp_valor_prestador", eq(o.comp_vp, item.custo_prestador), `comp=${o.comp_vp} os=${item.custo_prestador}`);
  ic("comp_outros_custos", eq(o.outros_custos, outros), `comp=${o.outros_custos} esp=${outros}`);
  ic("comp_imposto_4_5", eq(o.imposto_valor, impostoEsp) && eq(o.imposto_percentual, 4.5), `comp=${o.imposto_valor} esp=${impostoEsp} pct=${o.imposto_percentual}`);
  ic("comp_seguro_1", eq(o.seguro_valor, seguroEsp), `comp=${o.seguro_valor} esp=${seguroEsp}`);
  ic("comp_margem_bruta", eq(o.margem_bruta, brutaEsp), `comp=${o.margem_bruta} esp=${brutaEsp}`);
  ic("comp_margem_liquida", eq(o.margem_liquida, liquidaEsp), `comp=${o.margem_liquida} esp=${liquidaEsp}`);
  ic("comp_pct_bruta", eq(o.pct_bruta, pctBrutaEsp), `comp=${o.pct_bruta} esp=${pctBrutaEsp}`);
  ic("comp_pct_liquida", eq(o.pct_liquida, pctLiquidaEsp), `comp=${o.pct_liquida} esp=${pctLiquidaEsp}`);

  // financeiro_receber / financeiro_pagar
  const fr = await c.query(`select valor, status from financeiro_receber where os_id = $1::text limit 1`, [o.id]);
  const fp = await c.query(`select valor, status from financeiro_pagar where os_id = $1::text limit 1`, [o.id]);
  const pp = await c.query(
    `select valor_servicos, valor_liquido, pedagio, adicionais
       from pagamentos_prestadores where os_id = $1 limit 1`,
    [o.id]
  );
  item.financeiro = {
    receber: fr.rows[0] ? { valor: Number(fr.rows[0].valor), status: fr.rows[0].status } : null,
    pagar: fp.rows[0] ? { valor: Number(fp.rows[0].valor), status: fp.rows[0].status } : null,
    pagamento_prestador: pp.rows[0] || null,
  };
  if (fr.rows[0]) ic("receber_valor", eq(fr.rows[0].valor, item.valor_cliente), `AR=${fr.rows[0].valor} os=${item.valor_cliente}`);
  if (fp.rows[0]) ic("pagar_valor", eq(fp.rows[0].valor, item.custo_prestador), `AP=${fp.rows[0].valor} os=${item.custo_prestador}`);
  if (pp.rows[0]) {
    const liqEsp = r2(item.custo_prestador + item.pedagio + outros);
    ic("pagamento_prestador_servicos", eq(pp.rows[0].valor_servicos, item.custo_prestador), `serv=${pp.rows[0].valor_servicos} os=${item.custo_prestador}`);
    ic("pagamento_prestador_liquido", eq(pp.rows[0].valor_liquido, liqEsp), `liq=${pp.rows[0].valor_liquido} esp=${liqEsp}`);
  }

  out.os.push(item);
}

add("os_com_composicao_validadas", validados > 0, `${validados} OS encerradas validadas`);

// --- 3. sanidade dos precos vs cadastro/tabela -----------------------------
const tab = await c.query(`select count(*)::int as n from tabelas_valores`).catch(() => ({ rows: [{ n: -1 }] }));
const tp = await c.query(`select count(*)::int as n from tabela_prestador`).catch(() => ({ rows: [{ n: -1 }] }));
out.resumo.tabelas_valores = tab.rows[0].n;
out.resumo.tabela_prestador = tp.rows[0].n;
console.log("tabelas_valores:", tab.rows[0].n, "| tabela_prestador:", tp.rows[0].n);

const negativos = out.os.filter((x) => x.composicao && x.composicao.margem_liquida < 0).length;
out.resumo.margens_liquidas_negativas = negativos;

const falhas = out.checks.filter((x) => !x.ok).length;
// falhas em checks por-OS
const falhasOS = out.os.flatMap((x) => x.checks || []).filter((x) => !x.ok);
out.resumo.checks_gerais = out.checks.length;
out.resumo.checks_os = out.os.flatMap((x) => x.checks || []).length;
out.resumo.falhas_os = falhasOS.length;

await c.end();
fs.writeFileSync("scripts/_fin01calc_validacao.json", JSON.stringify(out, null, 2));
console.log(`\nOS validadas: ${validados} | checks gerais: ${out.checks.length} | checks OS: ${out.resumo.checks_os} | falhas OS: ${falhasOS.length}`);
console.log("EVIDENCIA: scripts/_fin01calc_validacao.json");
process.exit(falhas ? 1 : 0);
