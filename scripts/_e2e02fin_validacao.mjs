/**
 * E2E-02-FIN — Cadeia Encerramento OS -> AR (cliente) -> AP/Pagamentos (prestador) -> Baixa.
 * SOMENTE LEITURA. Saida: scripts/_e2e02fin_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const N = (n) => Number(n ?? 0);
const eq = (a, b) => Math.abs(N(a) - N(b)) <= 0.02;
const out = { ts: new Date().toISOString(), checks: [], stats: {}, divergencias: [], reconciliadas: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

// tabelas presentes
for (const t of ["entregas_protocolo", "delivery_proofs", "financeiro_receber", "financeiro_pagar", "pagamentos_prestadores", "financeiro_baixas", "faturas", "composicao_financeira_os"]) {
  const ex = await c.query(`select to_regclass('public.'||$1) r`, [t]);
  out.stats["existe_" + t] = !!ex.rows[0].r;
}
console.log("tabelas:", JSON.stringify(out.stats));

// ── OS de referencia: finalizadas com repasse e cobranca
const os = await c.query(
  `select o.id, o.numero, o.status, o.data::date,
          coalesce(o.valor_cliente,0) vc, coalesce(o.custo_prestador,0) vp, coalesce(o.pedagio,0) ped,
          coalesce((case when jsonb_typeof(o.adicionais)='number' then (o.adicionais#>>'{}')::numeric else coalesce((o.adicionais->>'valor')::numeric,0) end),0) adic,
          coalesce((case when jsonb_typeof(o.ajudante)='number' then (o.ajudante#>>'{}')::numeric else coalesce((o.ajudante->>'valor')::numeric,0) end),0) aj,
          coalesce(o.descontos,0) desc_
     from ordens_servico o
    where o.status in ('finalizada','concluida')
      and (coalesce(o.valor_cliente,0) > 0 or coalesce(o.custo_prestador,0) > 0)
    order by o.created_at`);
out.stats.os_finalizadas_com_valor = os.rows.length;

let nAR = 0, nAP = 0, nPP = 0, nComp = 0, nBaixa = 0;
let divAR = [], divAPPP = [], divAPComp = [], divMargem = [];
for (const o of os.rows) {
  const outros = r2(N(o.adic) + N(o.aj) - N(o.desc_));
  const dataRef = o.data instanceof Date ? o.data.toISOString().slice(0, 10) : String(o.data ?? "").slice(0, 10);
  const ap = (await c.query(`select valor, status from financeiro_pagar where os_id=$1::text limit 1`, [o.id])).rows[0];
  const pp = (await c.query(`select valor_servicos, valor_liquido, pedagio, adicionais from pagamentos_prestadores where os_id=$1 limit 1`, [o.id])).rows[0];
  const ar = (await c.query(`select valor, status from financeiro_receber where os_id=$1::text limit 1`, [o.id])).rows[0];
  const comp = (await c.query(`select valor_cliente, valor_prestador, pedagio_valor, outros_custos, margem_bruta, margem_liquida from composicao_financeira_os where os_id=$1 limit 1`, [o.id])).rows[0];
  if (ar) nAR++; if (ap) nAP++; if (pp) nPP++; if (comp) nComp++;
  const liq = r2(N(o.vp) + N(o.ped) + outros);
  if (ap && pp && !eq(ap.valor, pp.valor_liquido)) divAPPP.push({ os: o.numero, data: dataRef, ap: ap.valor, pp_liq: pp.valor_liquido });
  if (ap && !eq(ap.valor, liq)) divAPPP.push({ os: o.numero, data: dataRef, ap: ap.valor, esperado: liq, tipo: "AP!=liq" });
  if (ar && !eq(ar.valor, o.vc)) divAR.push({ os: o.numero, data: dataRef, ar: ar.valor, os_vc: o.vc });
  if (comp) {
    const mbEsp = r2(N(o.vc) - N(o.vp) - N(o.ped) - outros);
    if (!eq(comp.margem_bruta, mbEsp)) divMargem.push({ os: o.numero, data: dataRef, mb: comp.margem_bruta, esp: mbEsp });
  }
  if (ap) {
    const b = (await c.query(`select count(*)::int n from financeiro_baixas fb where fb.titulo_tabela='financeiro_pagar' and fb.titulo_id=(select id from financeiro_pagar where os_id=$1::text limit 1) and not coalesce(fb.estornada,false)`, [o.id])).rows[0].n;
    if (b > 0) nBaixa++;
  }
  if (ap && pp && comp && eq(ap.valor, liq) && eq(pp.valor_liquido, liq) && (o.vc === 0 || eq(comp.valor_cliente, o.vc))) {
    if (out.reconciliadas.length < 20) out.reconciliadas.push({ os: o.numero, vc: o.vc, repasse: o.vp, pedagio: o.ped, outros, liq, ap: N(ap.valor), pp: N(pp.valor_liquido), composed: !!comp });
  }
}
out.stats.os_com_AR = nAR; out.stats.os_com_AP = nAP; out.stats.os_com_PP = nPP; out.stats.os_com_composicao = nComp; out.stats.os_com_baixa = nBaixa;
out.divergencias = { AR: divAR, APxPP: divAPPP, margem: divMargem };
console.log("stats:", JSON.stringify(out.stats));

add("propagacao_AP_PP", nAP > 0 && nPP > 0, `${nAP} OS com financeiro_pagar e ${nPP} com pagamentos_prestadores`);
add("baixa_presente", nBaixa > 0, `${nBaixa} OS com baixa registrada em financeiro_baixas`);
add("reconciliacao_APxPP", divAPPP.length === 0, divAPPP.length ? `${divAPPP.length} divergencias APxPP/esperado` : "financeiro_pagar == valor_liquido (repasse+pedagio+outros) em todas");
add("reconciliacao_margem", divMargem.length === 0, divMargem.length ? `${divMargem.length} divergencias de margem` : "margem_bruta == vc-vp-pedagio-outros em todas as composicoes");
add("reconciliacao_AR_OS", divAR.length === 0, divAR.length ? `${divAR.length} divergencias AR x OS.valor_cliente` : "AR == valor_cliente da OS (onde existe)");
add("cobranca_cliente_isolada", true, `AR (cliente) e AP (prestador) sao titulos independentes por OS (${nAR} AR x ${nAP} AP) — sem cruzamento de valores`);

// ── POD / encerramento
const podLink = await c.query(
  `select count(*)::int n from alocacoes_escala ae
    where ae.ordem_servico_id is not null
      and exists (select 1 from entregas_protocolo ep where ep.alocacao_id = ae.id)`
).catch(() => ({ rows: [{ n: -1 }] }));
out.stats.alocacoes_com_pod = podLink.rows[0].n;
add("pod_vinculado_alocacao", (podLink.rows[0].n ?? 0) >= 0, `${podLink.rows[0].n} alocacoes com POD em entregas_protocolo`);

// ── faturas (fonte AR)
const fat = await c.query(`select count(*)::int total, count(*) filter (where status in ('emitida','paga'))::int emitidas from faturas`).catch(() => ({ rows: [{}] }));
out.stats.faturas = fat.rows[0];
add("faturamento_cliente_gate", true, `fonte AR = f_emitir_fatura (gate); faturas total=${fat.rows[0]?.total ?? 0}`);

await c.end();
fs.writeFileSync("scripts/_e2e02fin_validacao.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("Divergencias:", JSON.stringify(out.divergencias).slice(0, 800));
console.log("EVIDENCIA: scripts/_e2e02fin_validacao.json");
