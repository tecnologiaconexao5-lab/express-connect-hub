/* TMS-COM-CARGA-01 — Prova save→reload com cubagem/peso cubado/recomendação.
   DB em transação + ROLLBACK (nada persiste). Gera PDF do caso controlado. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { calcularDerivadosCarga, FATOR_CUBAGEM_RODOVIARIO_KG_M3 } from "../src/components/comercial/cargaCalculo";
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

const NUMERO = "ORC-202609-9401";
const carga = {
  tipo: "geral", descricao: "Carga fracionada controlada", volumes: 12, peso: 1000, cubagem: 0, pallets: 4, valorDeclarado: 0,
  refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "",
  dimensoes: [
    { quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 }, // 0.60 m³
    { quantidade: 2, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 }, // 0.96 m³
  ],
};

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (c: boolean, l: string, x?: string) => { console.log(`${c ? "PASS" : "FAIL"} — ${l}${x ? " :: " + x : ""}`); if (!c) falhas++; };

  const d = calcularDerivadosCarga(carga as any);
  console.log("derivados:", JSON.stringify({ cubagem: d.cubagem, pesoCubado: d.pesoCubado, pesoConsiderado: d.pesoConsiderado, rec: d.recomendacao }));
  check(d.cubagem === 1.56, "cubagem 1,56 m³");
  check(d.pesoCubado === 468, "peso cubado 468 kg (1,56 × 300)");
  check(d.pesoConsiderado === 1000, "peso considerado = real 1000 (real > cubado)", String(d.pesoConsiderado));
  check(d.recomendacao.disponivel && d.recomendacao.tipo === "kombi", "recomendação = menor veículo que comporta (Kombi 1100kg/4m³ ≥ 1000kg/1,56m³)", String(d.recomendacao.tipo));

  const veiculo = { tipo: "vuc", subcategoria: "pesado", carroceria: "sider", recomendado: d.recomendacao.tipo || undefined, recomendacaoDisponivel: d.recomendacao.disponivel, recomendacaoMotivos: d.recomendacao.motivos };
  const orc = {
    id: "", numero: NUMERO, cliente: "CLIENTE CONTROLADO CARGA-01", clienteCnpj: "11.222.333/0001-81",
    unidade: "Matriz", centroCusto: "COMERCIAL", responsavel: "Validação CARGA-01",
    dataEmissao: "2026-09-26", validade: "2026-10-26", tipoOperacao: "Fracionado", modalidade: "esporadico", prioridade: "normal",
    pedidoInterno: "", observacoesGerais: "Prova de cubagem/capacidade.", status: "rascunho",
    enderecos: [
      { tipo: "coleta", sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João", telefone: "", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
      { tipo: "entrega", sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria", telefone: "", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
    ],
    carga: { ...carga, cubagem: d.cubagem, pesoCubado: d.pesoCubado, fatorCubagem: FATOR_CUBAGEM_RODOVIARIO_KG_M3, pesoConsiderado: d.pesoConsiderado },
    veiculo,
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
  } catch (e: any) { falhas++; console.error("ERRO DB:", e.message); }
  finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); console.log("ROLLBACK — nada persistido."); }

  check(!!reloaded, "reload retornou registro");
  if (reloaded) {
    check(reloaded.carga.dimensoes?.length === 2, "reload: 2 grupos de dimensões");
    check(Number(reloaded.carga.pesoCubado) === 468, "reload: pesoCubado 468", String(reloaded.carga.pesoCubado));
    check(Number(reloaded.carga.fatorCubagem) === FATOR_CUBAGEM_RODOVIARIO_KG_M3, "reload: fator 300");
    check(Number(reloaded.carga.pesoConsiderado) === 1000, "reload: pesoConsiderado 1000");
    check(reloaded.veiculo.recomendado === "kombi", "reload: veículo recomendado = kombi", String(reloaded.veiculo.recomendado));
    check(reloaded.veiculo.tipo === "vuc", "reload: seleção humana preservada (vuc)");
    check(Number(reloaded.valores.valorFinal) === 2200, "regressão ORC-02: valorFinal 2200");
  }

  const doc = await construirPdfOrcamento((reloaded || orc) as any);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  const outDir = path.join(process.cwd(), "test-results", "com-carga-01");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${NUMERO}_Orcamento_Comercial.pdf`);
  fs.writeFileSync(outFile, buf);
  const latin = buf.toString("latin1");
  check(doc.getNumberOfPages() >= 1, "PDF gerado", `${doc.getNumberOfPages()} pág`);
  check(latin.includes("Carga fracionada controlada"), "PDF: descrição da carga");
  check(latin.includes("Caminhão Truck") || latin.includes("Van") || latin.includes("recomendado para a"), "PDF: veículo recomendado exibido");
  check(!latin.includes("undefined") && !latin.includes("NaN"), "PDF sem undefined/NaN");

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
