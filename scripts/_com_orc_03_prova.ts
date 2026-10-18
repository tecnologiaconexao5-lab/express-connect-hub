/* TMS-COM-ORC-03 — Prova controlada: cálculo → banco → reload → PDF.
   DB em transação + ROLLBACK (nada persiste). PDF real gravado em disco. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { montarPayloadOrcamento, calcularValorFinal } from "../src/components/comercial/orcamentoCalculo";
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

const NUMERO = "ORC-202609-9303"; // caso controlado desta missão
const zeros = { tabelaVinculada: "", valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 0, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 };

const orcamentoBase = {
  id: "",
  numero: NUMERO,
  cliente: "CLIENTE CONTROLADO ORC-03",
  clienteCnpj: "11.222.333/0001-81",
  unidade: "Matriz",
  centroCusto: "COMERCIAL",
  responsavel: "Validação ORC-03",
  dataEmissao: "2026-09-26",
  validade: "2026-10-26",
  tipoOperacao: "Carga fechada",
  modalidade: "esporadico" as const,
  prioridade: "normal" as const,
  pedidoInterno: "",
  observacoesGerais: "Proposta gerada em ambiente controlado para validação visual. Valores e condições conforme tabela vigente.",
  status: "rascunho" as const,
  enderecos: [
    { tipo: "coleta" as const, sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João Coleta", telefone: "(11) 99999-0001", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
    { tipo: "entrega" as const, sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria Entrega", telefone: "(11) 99999-0002", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
  ],
  carga: { tipo: "geral", descricao: "Carga geral paletizada", volumes: 10, peso: 500, cubagem: 2.5, pallets: 5, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "" },
  veiculo: { tipo: "truck", subcategoria: "pesado", carroceria: "sider" },
  valores: { ...zeros } as any,
  distancia_rota: { distancia_km: 350, duracao_min: 360, distancia_texto: "350 km", duracao_texto: "6h 00min", maps_provider: "mapbox" as const },
  historico: [] as { data: string; acao: string; usuario: string }[],
};

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (cond: boolean, label: string, extra?: string) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${label}${extra ? " :: " + extra : ""}`);
    if (!cond) falhas++;
  };

  // 1) Cálculo síncrono (payload já com valorFinal) — base 2200 => final 2200
  const payloadDom = montarPayloadOrcamento(orcamentoBase as any) as any;
  console.log("valorFinal canônico:", payloadDom.valores.valorFinal);
  check(calcularValorFinal(payloadDom.valores) === 2200, "cálculo: base 2200 => final 2200");
  check(payloadDom.valores.valorFinal === 2200, "payload de save contém valorFinal=2200 (sem state stale)");

  // 2) Banco (transação) + reload
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let reloaded: any = null;
  try {
    await client.query("BEGIN");
    const insertPayload = toOrcamentoInsert(payloadDom as any);
    if (!insertPayload.id) insertPayload.id = crypto.randomUUID();
    const cols = Object.keys(insertPayload);
    // pg: objetos/arrays precisam de JSON.stringify para colunas json/jsonb.
    const vals = cols.map((c) => {
      const v = (insertPayload as any)[c];
      return v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;
    });
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const ins = await client.query(
      `INSERT INTO public.orcamentos (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
      vals
    );
    const row = ins.rows[0];
    console.log("DB row: numero=%s valor_base=%s valor_final=%s data_emissao=%s validade=%s",
      row.numero, row.valor_base, row.valor_final, row.data_emissao, row.validade);

    check(Number(row.valor_base) === 2200, "banco: valor_base = 2200");
    check(Number(row.valor_final) === 2200, "banco: valor_final = 2200 (ZERO situação)");
    check(Number(row.valores?.valorBase) === 2200 && Number(row.valores?.valorFinal) === 2200, "banco: JSONB valores coerente");

    // reload via consulta real (mesma query da listagem)
    const sel = await client.query("SELECT * FROM public.orcamentos WHERE numero = $1", [NUMERO]);
    reloaded = toOrcamentoDomain(sel.rows[0]);
    const dem = reloaded.dataEmissao instanceof Date ? reloaded.dataEmissao.toISOString().slice(0, 10) : String(reloaded.dataEmissao).slice(0, 10);
    const val = reloaded.validade instanceof Date ? reloaded.validade.toISOString().slice(0, 10) : String(reloaded.validade).slice(0, 10);
    check(Number(reloaded.valorFinal) === 2200, "reload: toOrcamentoDomain valorFinal = 2200", String(reloaded.valorFinal));
    check(dem === "2026-09-26", "reload: data de emissão preservada", dem);
    check(!!val && val >= dem, "datas: validade >= emissão", `${dem} -> ${val}`);
    check(Array.isArray(reloaded.enderecos) && reloaded.enderecos.length === 2, "reload: pontos preservados");
  } catch (e: any) {
    falhas++;
    console.error("ERRO DB:", e.message);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    console.log("ROLLBACK executado — nenhum orçamento persistido.");
    await client.end();
  }

  // 3) PDF a partir do registro RELOAD (fallback: payload em memória)
  const orcParaPdf = reloaded || payloadDom;
  const doc = await construirPdfOrcamento(orcParaPdf as any);
  const paginas = doc.getNumberOfPages();
  const outDir = path.join(process.cwd(), "test-results", "com-orc-03");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${NUMERO}_Orcamento_Comercial.pdf`);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  fs.writeFileSync(outFile, buf);
  console.log("PDF gerado:", outFile, `(${buf.length} bytes, ${paginas} página(s))`);
  check(paginas >= 1 && paginas <= 2, "PDF: 1 a 2 páginas (sem páginas vazias)", `${paginas} página(s)`);
  check(buf.length > 8000, "PDF: arquivo não vazio", `${buf.length} bytes`);

  // 4) Auditoria de conteúdo/encoding no PDF
  const latin = buf.toString("latin1");
  check(!latin.includes("undefined"), "PDF sem 'undefined'");
  check(!latin.includes("NaN"), "PDF sem 'NaN'");
  check(!latin.includes("[object Object]"), "PDF sem '[object Object]'");
  // Mojibake = variantes DUPLA-CODIFICADAS das palavras impressas (texto, não bytes de imagem).
  const mojibake = ["ORÃ‡AMENTO", "INFORMAÃ‡Ã•ES", "VEÃCULO", "CONDIÃ‡Ã•ES", "DescriÃ§Ã£o", "EndereÃ§o", "Ã¡", "Ã©", "Ã£", "Ãµ"];
  const encontrados = mojibake.filter((m) => latin.includes(m));
  check(encontrados.length === 0, "PDF sem mojibake (texto)", encontrados.join(",") || "ok");
  // Verificação EXATA de acentos (Latin-1): Ç=0xC7, Õ=0xD5, Í=0xCD
  check(latin.includes("OR\u00C7AMENTO COMERCIAL"), "PDF 'ORÇAMENTO COMERCIAL' (Ç)");
  check(latin.includes("INFORMA\u00C7\u00D5ES DA CARGA"), "PDF 'INFORMAÇÕES DA CARGA' (Ç,Õ)");
  check(latin.includes("VE\u00CDCULO"), "PDF 'VEÍCULO' (Í)");
  check(latin.includes("CONDI\u00C7\u00D5ES COMERCIAIS"), "PDF 'CONDIÇÕES COMERCIAIS' (Ç,Õ)");
  check(latin.includes("CLIENTE CONTROLADO ORC-03"), "PDF contém dados do cliente");

  // nome do arquivo
  const filename = `${orcParaPdf.numero || "ORC"}_Orcamento_Comercial.pdf`;
  check(/^ORC-\d{6}-\d+_Orcamento_Comercial\.pdf$/.test(filename), "filename profissional .pdf", filename);
  check(!/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(filename), "filename sem UUID bruto");

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
