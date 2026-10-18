/* TMS-COM-CARGA-02 — Prova controlada: cálculo → banco → reload → PDF.
   Caso: 10 volumes 1,20×0,80×0,60 m (5,76 m³), peso 2.000 kg, 5 pallets.
   DB em transação + ROLLBACK (nada persiste). Read-only fora da transação. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import {
  calcularCubagemM3,
  calcularDerivadosCarga,
  recomendarVeiculo,
  avaliarCompatibilidadeVeiculo,
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

// Shim p/ PDF: fetch relativo -> public/; FileReader mínimo.
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

const NUMERO = "ORC-202609-9502";
// Caso UI CARGA-02B: 3 grupos de tamanhos diferentes.
const dims = [
  { quantidade: 5, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }, // 2.88
  { quantidade: 3, comprimentoCm: 60, larguraCm: 40, alturaCm: 40 },  // 0.288
  { quantidade: 2, comprimentoCm: 200, larguraCm: 50, alturaCm: 50 }, // 1.00
];
const cargaBase = {
  tipo: "geral", descricao: "Carga controlada CARGA-02B", volumes: 10, peso: 2000, cubagem: 0, pallets: 5, valorDeclarado: 0,
  refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "",
  dimensoes: dims,
};

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (c: boolean, l: string, x?: string) => { console.log(`${c ? "PASS" : "FAIL"} — ${l}${x ? " :: " + x : ""}`); if (!c) falhas++; };

  // A) Cálculo
  check(calcularCubagemM3(dims) === 4.168, "A) cubagem = 4,168 m³ (3 grupos)");
  const dSem = calcularDerivadosCarga(cargaBase as any);
  check(dSem.volumesGrupos === 10, "A) quantidade total = soma dos grupos = 10", String(dSem.volumesGrupos));
  check(dSem.fatorDisponivel === false && dSem.pesoCubado === 0 && dSem.pesoConsiderado === 2000, "A) sem fator: peso cubado não calculado; considerado = 2.000");
  const dCom = calcularDerivadosCarga(cargaBase as any, 250);
  check(dCom.pesoCubado === 1042 && dCom.pesoConsiderado === 2000, "A) com fator 250: peso cubado 1.042; considerado 2.000");

  // D/E) Recomendação e compatibilidade
  const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 4.168, dimensoes: dims, pallets: 5 });
  check(rec.disponivel && rec.tipo === "vuc", "E) veículo compatível recomendado (VUC)", String(rec.tipo));
  check(!avaliarCompatibilidadeVeiculo("van", { pesoConsideradoKg: 2000, cubagemM3: 4.168 }).ok, "D) veículo de 1.300kg é INCOMPATÍVEL (não recomendado)");
  check(avaliarCompatibilidadeVeiculo("vuc", { pesoConsideradoKg: 2000, cubagemM3: 4.168 }).ok, "E) VUC compatível");

  // F) Alterar dimensões recalcula
  const dims2 = [...dims, { quantidade: 2, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 }];
  check(calcularCubagemM3(dims2) === 5.128, "F) alterar dimensões recalcula (5,128 m³)", String(calcularCubagemM3(dims2)));

  // B/C) Persistência + reload (transação + rollback)
  const cargaPersist = {
    ...cargaBase,
    cubagem: dSem.cubagem,
    pesoCubado: dCom.pesoCubado,
    fatorCubagem: 250,
    pesoConsiderado: dCom.pesoConsiderado,
    pesoCubadoDisponivel: true,
  };
  const veiculo = { tipo: "vuc", subcategoria: "pesado", carroceria: "grade baixa", recomendado: rec.tipo || undefined, recomendacaoDisponivel: true, recomendacaoMotivos: rec.motivos };
  const orc = {
    id: "", numero: NUMERO, cliente: "CLIENTE CONTROLADO CARGA-02", clienteCnpj: "11.222.333/0001-81",
    unidade: "Matriz", centroCusto: "COMERCIAL", responsavel: "Validação CARGA-02",
    dataEmissao: "2026-09-26", validade: "2026-10-26", tipoOperacao: "Fracionado", modalidade: "esporadico", prioridade: "normal",
    pedidoInterno: "", observacoesGerais: "Prova de dimensões/cubagem/capacidade.", status: "rascunho",
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
    check(reloaded.carga.dimensoes?.length === 3 && Number(reloaded.carga.cubagem) === 4.168, "B) banco persistiu 3 grupos + cubagem 4,168");
  } catch (e: any) { falhas++; console.error("ERRO DB:", e.message); }
  finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
    console.log("ROLLBACK — nada persistido.");
  }

  if (reloaded) {
    check(reloaded.carga.dimensoes?.[0]?.comprimentoCm === 120 && reloaded.carga.dimensoes?.length === 3, "C) reload preserva 3 grupos");
    check(Number(reloaded.carga.pesoCubado) === 1042, "C) reload preserva peso cubado", String(reloaded.carga.pesoCubado));
    check(Number(reloaded.carga.pesoConsiderado) === 2000, "C) reload preserva peso considerado");
    check(reloaded.veiculo.recomendado === "vuc", "C) reload preserva veículo recomendado");
  }

  // G) PDF recebe os dados
  const doc = await construirPdfOrcamento((reloaded || orc) as any);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  const latin = buf.toString("latin1");
  const outDir = path.join(process.cwd(), "test-results", "com-carga-02");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${NUMERO}_Orcamento_Comercial.pdf`);
  fs.writeFileSync(outFile, buf);
  check(latin.includes("4,168"), "G) PDF exibe cubagem 4,168 m³");
  check(latin.includes("2.000"), "G) PDF exibe peso real 2.000 kg");
  check(latin.includes("Carga controlada CARGA-02B"), "G) PDF exibe descrição da carga");
  check(!latin.includes("undefined") && !latin.includes("NaN"), "G) PDF sem undefined/NaN");

  // H) Nenhum orçamento de teste persistido
  const cli2 = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await cli2.connect();
  const leftovers = (await cli2.query("SELECT count(*)::int q FROM public.orcamentos WHERE numero = $1", [NUMERO])).rows[0].q;
  await cli2.end();
  check(leftovers === 0, "H) nenhum orçamento de teste persistido", `q=${leftovers}`);

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
