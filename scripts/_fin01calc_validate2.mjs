/**
 * FIN-01-CALC v2 — Validacao da CONSISTENCIA INTERNA do que os triggers
 * de producao gravaram em composicao_financeira_os e nas tabelas financeiras.
 * SOMENTE LEITURA.
 *
 * Formula canonica de producao (f_trg_propagar_financeiro_alocacao / _os):
 *   outros_custos = adicional + ajudante - desconto
 *   valor_liquido = valor_prestador + pedagio + outros_custos
 *   margem_bruta  = valor_cliente - valor_prestador - pedagio - outros_custos
 *   imposto       = valor_cliente * 4.5%
 *   seguro        = valor_cliente * 1%
 *   margem_liquida= margem_bruta - imposto - seguro
 * Saida: scripts/_fin01calc_validate2.json
 */
import fs from "node:fs";
import { Client } from "pg";

const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const N = (n) => Number(n ?? 0);
const eq = (a, b, tol = 0.02) => Math.abs(N(a) - N(b)) <= tol;

const rows = await c.query(
  `select os_id, origem_calculo,
          valor_cliente, valor_prestador, imposto_percentual, imposto_valor, seguro_valor,
          pedagio_valor, outros_custos, adicional_valor, ajudante_valor, desconto_valor,
          margem_bruta, margem_liquida,
          percentual_margem_bruta, percentual_margem_liquida
     from composicao_financeira_os`
);

const AR = await c.query(`select os_id, valor from financeiro_receber`).catch(() => ({ rows: [] }));
const AP = await c.query(`select os_id, valor from financeiro_pagar`).catch(() => ({ rows: [] }));
const PP = await c.query(`select os_id, valor_servicos, valor_liquido from pagamentos_prestadores`).catch(() => ({ rows: [] }));
const OS = await c.query(`select id, valor_cliente, custo_prestador from ordens_servico`).catch(() => ({ rows: [] }));
const map = (r) => new Map(r.rows.map((x) => [String(x.os_id), x]));
const arM = map(AR), apM = map(AP), ppM = map(PP), osM = new Map(OS.rows.map((x) => [String(x.id), x]));

const out = { ts: new Date().toISOString(), total_composicoes: rows.rows.length, por_origem: {}, falhas: [], drift: [], exemplos_ok: [] };

for (const o of rows.rows) {
  const vc = N(o.valor_cliente), vp = N(o.valor_prestador);
  const ped = N(o.pedagio_valor);
  const adic = N(o.adicional_valor), aj = N(o.ajudante_valor), desc = N(o.desconto_valor);
  const outrosEsp = r2(adic + aj - desc);
  const impEsp = r2(vc * 4.5 / 100);
  const segEsp = r2(vc * 1 / 100);
  const mbEsp = r2(vc - vp - ped - outrosEsp);
  const mlEsp = r2(mbEsp - impEsp - segEsp);
  const pctBEsp = vc > 0 ? r2(mbEsp / vc * 100) : 0;
  const pctLEsp = vc > 0 ? r2(mlEsp / vc * 100) : 0;
  const liqEsp = r2(vp + ped + outrosEsp);

  const fails = [];
  const chk = (n, ok, det) => { if (!ok) fails.push({ name: n, detail: det }); };

  chk("outros_custos", eq(o.outros_custos, outrosEsp), `gravado=${o.outros_custos} esp=${outrosEsp}`);
  chk("imposto", eq(o.imposto_valor, impEsp) && eq(o.imposto_percentual, 4.5), `gravado=${o.imposto_valor}/${o.imposto_percentual} esp=${impEsp}/4.5`);
  chk("seguro", eq(o.seguro_valor, segEsp), `gravado=${o.seguro_valor} esp=${segEsp}`);
  chk("margem_bruta", eq(o.margem_bruta, mbEsp), `gravado=${o.margem_bruta} esp=${mbEsp}`);
  chk("margem_liquida", eq(o.margem_liquida, mlEsp), `gravado=${o.margem_liquida} esp=${mlEsp}`);
  chk("pct_bruta", eq(o.percentual_margem_bruta, pctBEsp), `gravado=${o.percentual_margem_bruta} esp=${pctBEsp}`);
  chk("pct_liquida", eq(o.percentual_margem_liquida, pctLEsp), `gravado=${o.percentual_margem_liquida} esp=${pctLEsp}`);

  const ap = apM.get(String(o.os_id));
  const pp = ppM.get(String(o.os_id));
  if (ap) chk("AP=valor_liquido", eq(ap.valor, liqEsp), `AP=${ap.valor} esp=${liqEsp}`);
  if (pp) {
    chk("PP.valor_servicos=repasse", eq(pp.valor_servicos, vp), `PP.serv=${pp.valor_servicos} esp=${vp}`);
    chk("PP.valor_liquido", eq(pp.valor_liquido, liqEsp), `PP.liq=${pp.valor_liquido} esp=${liqEsp}`);
  }

  const origem = o.origem_calculo || "?";
  out.por_origem[origem] = out.por_origem[origem] || { total: 0, falhas: 0 };
  out.por_origem[origem].total++;
  if (fails.length) { out.por_origem[origem].falhas++; out.falhas.push({ os_id: o.os_id, origem, fails }); }
  else if (out.exemplos_ok.length < 5) out.exemplos_ok.push({ os_id: o.os_id, origem, vc, vp, margem_liquida: o.margem_liquida });

  // data drift: OS row divergente da composicao (edicao pos-encerramento)
  const os = osM.get(String(o.os_id));
  if (os && (!eq(os.valor_cliente, vc) || !eq(os.custo_prestador, vp))) {
    out.drift.push({ os_id: o.os_id, os_vc: N(os.valor_cliente), comp_vc: vc, os_cp: N(os.custo_prestador), comp_vp: vp });
  }
}

await c.end();
fs.writeFileSync("scripts/_fin01calc_validate2.json", JSON.stringify(out, null, 2));

const totalFalhas = out.falhas.length;
console.log("composicoes analisadas:", out.total_composicoes);
console.log("por origem:", JSON.stringify(out.por_origem));
console.log("composicoes 100% consistentes:", out.total_composicoes - totalFalhas);
console.log("composicoes com falha:", totalFalhas);
console.log("registros com drift OS<->composicao:", out.drift.length);
console.log("\nExemplos consistentes:", JSON.stringify(out.exemplos_ok, null, 2));
if (totalFalhas) {
  console.log("\nFalhas (detalhe por OS):");
  for (const f of out.falhas) console.log(" ", f.os_id.slice(0, 8), f.origem, "->", f.fails.map((x) => x.name).join(","));
}
console.log("\nEVIDENCIA: scripts/_fin01calc_validate2.json");
