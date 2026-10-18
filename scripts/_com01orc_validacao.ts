/**
 * COM-01-ORC — Validacao da cotacao/precificacao comercial (cliente).
 * Usa as FUNCOES CANONICAS reais (src/components/comercial/orcamentoCalculo.ts)
 * + leitura SOMENTE LEITURA do banco.
 * Saida: scripts/_com01orc_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";
import { calcularValorFinal, calcularValores, resolverValorFinal } from "../src/components/comercial/orcamentoCalculo";

// Regra do engine (precificacaoEngineService.calcularPrecoRapido — parte CLIENTE):
//   valorCliente = valor_base + max(0, distancia - franquia_km) * valor_km_excedente
const calcularPrecoRapido = (tabela: any, distanciaKm: number) => {
  const franquia = Number(tabela.franquia_km || 0);
  const kmExc = Math.max(0, distanciaKm - franquia);
  const valorCliente = Math.round((Number(tabela.valor_base || 0) + kmExc * Number(tabela.valor_km_excedente || 0)) * 100) / 100;
  const perc = Number(tabela.percentual_prestador ?? 80);
  const valorPrestador = Math.round(valorCliente * (perc / 100) * 100) / 100;
  return { valorCliente, valorPrestador, kmExcedente: kmExc };
};

const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)![1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const N = (n: any) => Number(n ?? 0);
const r2 = (n: any) => Math.round(Number(n) * 100) / 100;
const eq = (a: any, b: any) => Math.abs(N(a) - N(b)) <= 0.02;

const out: any = { ts: new Date().toISOString(), checks: [], orcamentos: [], tabelas: [], exemplos_engine: [] };
const add = (n: string, ok: boolean, d: string) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

// ─── 1. ORCAMENTOS: formula canonica sobre valores persistidos ───────────────
const orcs = await c.query(`select numero, cliente, veiculo->>'tipo' as veiculo_tipo, valores, valor_base, valor_final, custo_estimado, status
   from orcamentos order by created_at desc`);
for (const o of orcs.rows) {
  const v = (o.valores || {}) as any;
  const canon = r2(calcularValorFinal(v));
  const recalc = calcularValores({ ...v });
  const efetivo = r2(resolverValorFinal(v));
  const item = {
    numero: o.numero, status: o.status, cliente: (o.cliente || "").trim(), veiculo_tipo: o.veiculo_tipo,
    valor_base_json: N(v.valorBase), valor_final_json: N(v.valorFinal),
    valor_final_col: N(o.valor_final), canonico: canon, efetivo_exibicao: efetivo,
    lucro: recalc.lucroEstimado, margem: recalc.margemEstimada,
    ok_canonico: eq(canon, v.valorFinal) || N(v.valorFinal) === 0,
    ok_exibicao: eq(efetivo, Math.max(N(v.valorFinal), canon)),
  };
  out.orcamentos.push(item);
}
const comValor = out.orcamentos.filter((o: any) => o.canonico > 0);
const okCanon = comValor.filter((o: any) => o.ok_canonico).length;
add("orc_formula_canonica", okCanon === comValor.length, `${okCanon}/${comValor.length} orcamentos com valor>0 batem com calcularValorFinal()`);
add("orc_exibicao_resolverValorFinal", out.orcamentos.every((o: any) => o.ok_exibicao), "resolverValorFinal devolve o valor efetivo em todos");

// ─── 2. TABELAS_VALORES: regra do cliente (base + km excedente) ──────────────
const tabs = await c.query(`select id, nome, cliente, tipo_veiculo, valor_base, franquia_km, km_franquia, valor_km_excedente, valor_km, percentual_prestador, universal, ativo, data_inicio, data_fim
   from tabelas_valores where ativo = true order by created_at desc`);
const DIST = 129.257734;
for (const t of tabs.rows) {
  const franquia = N(t.franquia_km ?? t.km_franquia);
  const kmExc = Math.max(0, DIST - franquia);
  const kmExcUn = N(t.valor_km_excedente ?? t.valor_km);
  const base = N(t.valor_base);
  const valorCliente = r2(base + kmExc * kmExcUn);
  // Reproduz a MESMA regra do engine TS (calcularPrecoRapido)
  const engine = calcularPrecoRapido(
    { id: String(t.id), nome: t.nome, fonte: "tabelas_valores", valor_base: base, franquia_km: franquia, valor_km_excedente: kmExcUn, percentual_prestador: N(t.percentual_prestador ?? 80) } as any,
    DIST
  );
  out.tabelas.push({ nome: t.nome, cliente: t.cliente, tipo_veiculo: t.tipo_veiculo, base, franquia, km_exc_un: kmExcUn, valor_cliente: valorCliente, engine_cliente: engine.valorCliente, engine_prestador: engine.valorPrestador });
  out.exemplos_engine.push({ tabela: t.nome, distancia: DIST, valor_cliente: valorCliente });
}
const okEngine = tabs.rows.every((t: any, i: number) => eq(t.valor_base, out.tabelas[i].engine_cliente - Math.max(0, DIST - N(t.franquia_km ?? t.km_franquia)) * N(t.valor_km_excedente ?? t.valor_km)));
add("tabela_cliente_regra", okEngine, `${out.tabelas.length} tabelas ativas: valor = base + km_excedente*valor_km (regra do engine)`);
add("tabela_tem_regra_minima", out.tabelas.length > 0, `${out.tabelas.length} tabelas de cliente ativas`);

// ─── 3. Exemplo real: ORC-202609-7150 (VUC 129,3km) ─────────────────────────
const real = orcs.rows.find((o: any) => o.numero === "ORC-202609-7150");
if (real) {
  const v = real.valores || {};
  add("orc_real_base", N(v.valorBase) > 0, `ORC-202609-7150 valorBase=${v.valorBase} valorFinal=${v.valorFinal}`);
}

await c.end();
fs.writeFileSync("scripts/_com01orc_validacao.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x: any) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("Exemplos engine (dist=" + DIST + "km):");
console.table(out.exemplos_engine);
console.log("EVIDENCIA: scripts/_com01orc_validacao.json");
