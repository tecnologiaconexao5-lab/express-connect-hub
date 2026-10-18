/* TMS-COM-CARGA-03 — Prova: capacidade parametrizável + caso real 24,144 m³.
   DB em transação + ROLLBACK (nada persiste). Read-only fora da transação. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import {
  calcularCubagemM3,
  calcularDerivadosCarga,
  recomendarVeiculo,
  totalVolumesGrupos,
  catalogoPadraoVeiculo,
} from "../src/components/comercial/cargaCalculo";
import { toOrcamentoInsert, toOrcamentoDomain } from "../src/lib/dbMappers";
import { construirPdfOrcamento } from "../src/components/comercial/orcamentoPdf";

function loadEnv(): Record<string, string> {
  const p = path.join(process.cwd(), ".env");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const fetched: string[] = [];
const origFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: any) => {
  if (typeof url === "string" && url.startsWith("/")) {
    fetched.push(url);
    const p = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    if (fs.existsSync(p)) return { ok: true, blob: async () => new Blob([fs.readFileSync(p)], { type: "image/png" }) };
    return { ok: false };
  }
  return origFetch ? origFetch(url) : { ok: false };
};
(globalThis as any).FileReader = class {
  result: string | null = null; onloadend: (() => void) | null = null; onerror: (() => void) | null = null;
  readAsDataURL(blob: any) {
    blob.arrayBuffer().then((ab: ArrayBuffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(ab).toString("base64")}`;
      this.onloadend && this.onloadend();
    }).catch(() => this.onerror && this.onerror());
  }
};

const NUMERO = "ORC-202609-9603";
// Caso real visual: 24,144 m³
const dims = [
  { quantidade: 1, comprimentoCm: 30, larguraCm: 60, alturaCm: 80 },
  { quantidade: 10, comprimentoCm: 160, larguraCm: 150, alturaCm: 100 },
];
const cargaBase = {
  tipo: "geral", descricao: "Carga real 24,144 m³", volumes: 11, peso: 2000, cubagem: 0, pallets: 0, valorDeclarado: 0,
  refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "",
  dimensoes: dims,
};

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (c: boolean, l: string, x?: string) => { console.log(`${c ? "PASS" : "FAIL"} — ${l}${x ? " :: " + x : ""}`); if (!c) falhas++; };

  // Cálculo
  check(calcularCubagemM3(dims) === 24.144, "cubagem = 24,144 m³");
  check(totalVolumesGrupos(dims) === 11, "volumes totais = 11");

  // Recomendação + avaliação de todos
  const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 24.144, dimensoes: dims });
  console.log("\nAvaliação do catálogo (carga 24,144 m³):");
  for (const a of rec.avaliacoes) {
    const falhaMotivo = a.motivos.find((m) => /excede|não cabe/.test(m)) || (a.compativel ? "compatível pelos parâmetros" : "");
    console.log(`  ${a.compativel ? "COMPATÍVEL " : "INCOMPATÍVEL"} | ${a.label} | ${falhaMotivo}`);
  }
  check(rec.disponivel && rec.tipo === "toco", "recomendado = Toco (menor que comporta 2.000 kg / 24,144 m³)", String(rec.tipo));
  const rej = rec.avaliacoes.find((a) => a.tipo === "tres_quartos");
  check(!!rej && !rej.compativel && rej.criterios.cubagem === "falha", "3/4 rejeitado por cubagem (24 < 24,144)");
  const van = rec.avaliacoes.find((a) => a.tipo === "van");
  check(!!van && !van.compativel, "Van rejeitada (cubagem/peso)");

  // Parametrização (override) — não inventa; valida que a config altera a decisão
  const padrao = catalogoPadraoVeiculo();
  const custom = padrao.map((v) => (v.tipo === "vuc" ? { ...v, cubagemUtilM3: 99, fonte: "Override teste" } : v));
  const vucCustom = custom.find((v) => v.tipo === "vuc");
  check(vucCustom?.cubagemUtilM3 === 99, "parametrização sobrescreve cubagem útil (config)");
  const recCustom = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 24.144, dimensoes: dims }, custom);
  check(recCustom.tipo === "vuc", "com override (vuc 2.500 kg / 99 m³), recomenda a config parametrizada (vuc)", String(recCustom.tipo));

  // Persistência + reload
  const d = calcularDerivadosCarga(cargaBase as any);
  const cargaPersist = { ...cargaBase, cubagem: d.cubagem, volumes: d.volumesGrupos };
  const veiculo = { tipo: "toco", subcategoria: "pesado", carroceria: "grade baixa", recomendado: rec.tipo || undefined, recomendacaoDisponivel: true, recomendacaoMotivos: rec.motivos };
  const orc = {
    id: "", numero: NUMERO, cliente: "CLIENTE CONTROLADO CARGA-03", clienteCnpj: "11.222.333/0001-81",
    unidade: "Matriz", centroCusto: "COMERCIAL", responsavel: "Validação CARGA-03",
    dataEmissao: "2026-09-26", validade: "2026-10-26", tipoOperacao: "Fracionado", modalidade: "esporadico", prioridade: "normal",
    pedidoInterno: "", observacoesGerais: "Prova capacidade 24,144 m³.", status: "rascunho",
    enderecos: [
      { tipo: "coleta", sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João", telefone: "", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
      { tipo: "entrega", sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria", telefone: "", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
    ],
    carga: cargaPersist, veiculo,
    valores: { tabelaVinculada: "", valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 2200, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 },
    distancia_rota: { distancia_km: 350, duracao_min: 360, distancia_texto: "350 km", duracao_texto: "6h 00min", maps_provider: "mapbox" },
    historico: [],
  };

  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let reloaded: any = null;
  try {
    await client.query("BEGIN");
    const ins = toOrcamentoInsert(orc as any);
    if (!ins.id) ins.id = crypto.randomUUID();
    const cols = Object.keys(ins);
    const vals = cols.map((c) => { const v = (ins as any)[c]; return v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v; });
    await client.query(`INSERT INTO public.orcamentos (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`, vals);
    const sel = await client.query("SELECT * FROM public.orcamentos WHERE numero = $1", [NUMERO]);
    reloaded = toOrcamentoDomain(sel.rows[0]);
    check(reloaded.carga.dimensoes?.length === 2 && Number(reloaded.carga.cubagem) === 24.144, "banco persistiu 2 grupos + cubagem 24,144");
  } catch (e: any) { falhas++; console.error("ERRO DB:", e.message); }
  finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); console.log("ROLLBACK — nada persistido."); }

  if (reloaded) {
    check(Number(reloaded.carga.volumes) === 11, "reload preserva volumes totais = 11", String(reloaded.carga.volumes));
    check(Number(reloaded.carga.cubagem) === 24.144, "reload preserva cubagem 24,144");
    check(reloaded.veiculo.recomendado === "toco", "reload preserva veículo recomendado (toco)");
  }

  // PDF
  const doc = await construirPdfOrcamento((reloaded || orc) as any);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  const latin = buf.toString("latin1");
  const outDir = path.join(process.cwd(), "test-results", "com-carga-03");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${NUMERO}_Orcamento_Comercial.pdf`);
  fs.writeFileSync(outFile, buf);
  check(latin.includes("24,144"), "PDF exibe cubagem 24,144 m³");
  check(latin.includes("Carga real 24,144"), "PDF exibe descrição da carga");
  check(!latin.includes("undefined") && !latin.includes("NaN"), "PDF sem undefined/NaN");

  // H) nenhum persistido
  const cli2 = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await cli2.connect();
  const leftovers = (await cli2.query("SELECT count(*)::int q FROM public.orcamentos WHERE numero = $1", [NUMERO])).rows[0].q;
  await cli2.end();
  check(leftovers === 0, "nenhum orçamento de teste persistido", `q=${leftovers}`);

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
