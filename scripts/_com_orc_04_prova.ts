/* TMS-COM-ORC-04 — Prova: compactação final (1 página) + paginação de caso grande.
   DB em transação + ROLLBACK (nada persiste). PDF compacto gravado em disco. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { montarPayloadOrcamento } from "../src/components/comercial/orcamentoCalculo";
import { construirPdfOrcamento } from "../src/components/comercial/orcamentoPdf";
import { toOrcamentoInsert, toOrcamentoDomain } from "../src/lib/dbMappers";

function loadEnv(): Record<string, string> {
  const p = path.join(process.cwd(), ".env");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const NUMERO = "ORC-202609-9303";
const zeros = { tabelaVinculada: "", valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 0, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 };

const enderecoBase = (i: number, tipo: "coleta" | "entrega") => ({
  tipo, sequencia: i, endereco: `${tipo === "coleta" ? "Av. das Nações Unidas" : "Rod. Anhanguera"}, ${1000 + i}`, cidade: tipo === "coleta" ? "São Paulo" : "Jundiaí", uf: "SP",
  cep: "04578-000", contato: tipo === "coleta" ? "João Coleta" : "Maria Entrega", telefone: "(11) 99999-0000", instrucoes: "", janelaInicio: "08:00", janelaFim: "18:00",
});

const orcamentoBase: any = {
  id: "", numero: NUMERO, cliente: "CLIENTE CONTROLADO ORC-03", clienteCnpj: "11.222.333/0001-81",
  unidade: "Matriz", centroCusto: "COMERCIAL", responsavel: "Validação ORC-03",
  dataEmissao: "2026-09-26", validade: "2026-10-26", tipoOperacao: "Carga fechada",
  modalidade: "esporadico", prioridade: "normal", pedidoInterno: "",
  observacoesGerais: "Proposta controlada para validação visual. Valores e condições conforme tabela vigente.",
  status: "rascunho",
  enderecos: [enderecoBase(1, "coleta"), enderecoBase(2, "entrega")],
  carga: { tipo: "geral", descricao: "Carga geral paletizada", volumes: 10, peso: 500, cubagem: 2.5, pallets: 5, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "" },
  veiculo: { tipo: "truck", subcategoria: "pesado", carroceria: "sider" },
  valores: { ...zeros },
  distancia_rota: { distancia_km: 350, duracao_min: 360, distancia_texto: "350 km", duracao_texto: "6h 00min", maps_provider: "mapbox" },
  historico: [],
};

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (cond: boolean, label: string, extra?: string) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${label}${extra ? " :: " + extra : ""}`);
    if (!cond) falhas++;
  };

  const payloadDom = montarPayloadOrcamento(orcamentoBase) as any;
  check(payloadDom.valores.valorFinal === 2200, "cálculo: base 2200 => final 2200");

  // Banco + reload (transação + rollback)
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let reloaded: any = null;
  try {
    await client.query("BEGIN");
    const insertPayload = toOrcamentoInsert(payloadDom as any);
    if (!insertPayload.id) insertPayload.id = crypto.randomUUID();
    const cols = Object.keys(insertPayload);
    const vals = cols.map((c) => {
      const v = (insertPayload as any)[c];
      return v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;
    });
    await client.query(`INSERT INTO public.orcamentos (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`, vals);
    const sel = await client.query("SELECT * FROM public.orcamentos WHERE numero = $1", [NUMERO]);
    reloaded = toOrcamentoDomain(sel.rows[0]);
    check(Number(reloaded.valorFinal) === 2200, "banco/reload: valorFinal = 2200");
  } catch (e: any) {
    falhas++; console.error("ERRO DB:", e.message);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
    console.log("ROLLBACK — nada persistido.");
  }

  const orcParaPdf = reloaded || payloadDom;
  const doc = await construirPdfOrcamento(orcParaPdf as any);
  const paginas = doc.getNumberOfPages();
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  const outDir = path.join(process.cwd(), "test-results", "com-orc-04");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${NUMERO}_Orcamento_Comercial.pdf`);
  fs.writeFileSync(outFile, buf);
  const latin = buf.toString("latin1");

  console.log(`PDF compacto: ${outFile} (${buf.length} bytes, ${paginas} página(s))`);
  check(paginas === 1, "caso ORC-202609-9303 => 1 PÁGINA", `${paginas}`);
  check(latin.includes("Página 1 de 1"), "rodapé 'Página 1 de 1'");
  check(/R\$\s2\.200,00/.test(latin), "VALOR FINAL R$ 2.200,00 presente");
  check(!latin.includes("undefined") && !latin.includes("NaN") && !latin.includes("[object Object]"), "sem undefined/null/NaN/[object Object]");
  for (const m of ["ORÃ‡AMENTO", "INFORMAÃ‡Ã•ES", "VEÃCULO", "CONDIÃ‡Ã•ES"]) check(!latin.includes(m), `sem mojibake '${m}'`);
  check(latin.includes("OR\u00C7AMENTO COMERCIAL"), "acento ORÇAMENTO ok");
  check(latin.includes("Caminhão Truck"), "veículo normalizado (Caminhão Truck)");
  check(latin.includes("Pesado"), "subcategoria normalizada (Pesado)");
  check(latin.includes("Sider"), "carroceria normalizada (Sider)");
  check(latin.includes("Normal"), "prioridade normalizada (Normal)");
  check(latin.includes("recomendado para a") && latin.includes("pera"), "rótulo veículo profissional");
  check(!latin.includes("sugerido pela IA"), "sem 'sugerido pela IA'");

  // Caso GRANDE sintético (somente em memória) — paginação automática sem corte
  const muitosPontos = Array.from({ length: 14 }, (_, i) => enderecoBase(i + 1, i % 2 === 0 ? "coleta" : "entrega"));
  const orcGrande: any = {
    ...orcamentoBase,
    numero: "ORC-202609-9999",
    observacoesGerais: Array.from({ length: 6 }, () => "Observação longa para exercitar a paginação automática do documento comercial.").join(" "),
    enderecos: muitosPontos,
    carga: { ...orcamentoBase.carga, descricao: "Carga fracionada com múltiplos volumes e diversos pontos de coleta e entrega ao longo da rota." },
    valores: { ...zeros, adicionais: 250, pedagio: 180, kmExcedente: 90, ajudante: 120, descontos: 60, valorFinal: 2780 },
  };
  const docG = await construirPdfOrcamento(orcGrande as any);
  const paginasG = docG.getNumberOfPages();
  const latinG = Buffer.from(docG.output("arraybuffer") as ArrayBuffer).toString("latin1");
  console.log(`PDF grande (memória): ${paginasG} página(s)`);
  check(paginasG >= 2, "caso grande => paginação automática (>= 2 páginas)", `${paginasG}`);
  check(latinG.includes("Página 1 de " + paginasG), "rodapé consistente no caso grande");
  check(latinG.includes("Av. das Na"), "1º ponto preservado");
  check(latinG.includes("Anhanguera, 1014"), "último ponto preservado (sem corte)");
  check(latinG.includes("Conectando negócios com excelência logística"), "rodapé presente no caso grande");
  check(!latinG.includes("undefined") && !latinG.includes("NaN") && !latinG.includes("[object Object]"), "caso grande sem undefined/null/NaN");

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
