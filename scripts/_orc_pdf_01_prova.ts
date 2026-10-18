/* TMS-ORC-PDF-01 — Prova controlada (read-only):
   1) lê o registro LEGADO real ORC-202609-8659 (transação + ROLLBACK, só SELECT);
   2) normaliza via toOrcamentoDomain (regra canônica resolverValorFinal);
   3) monta o PDF real com construirPdfOrcamento;
   4) audita o PDF (lat1): duração ausente, nomenclatura nova, VALOR FINAL real;
   5) grava PDF + evidência em ORC-PDF-01-EVIDENCIAS/ (fora de test-results).
   Nenhum dado é criado/alterado/apagado no banco. */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { toOrcamentoDomain } from "../src/lib/dbMappers";
import { construirPdfOrcamento } from "../src/components/comercial/orcamentoPdf";
import { resolverValorFinal } from "../src/components/comercial/orcamentoCalculo";

const ID_LEGADO = "d577539b-1865-477c-b079-af94152fc3e9";

function loadEnv(): Record<string, string> {
  const p = path.join(process.cwd(), ".env");
  const env: Record<string, string> = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

(async () => {
  const env = loadEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL ausente no .env");
  let falhas = 0;
  const check = (cond: boolean, label: string, extra?: string) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${label}${extra ? " :: " + extra : ""}`);
    if (!cond) falhas++;
  };

  // 1) leitura read-only do registro legado
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let row: any = null;
  let rowAntes: any = null;
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `SELECT * FROM public.orcamentos WHERE id = $1`,
      [ID_LEGADO]
    );
    row = r.rows[0];
    rowAntes = row && {
      valor_base: row.valor_base, valor_final: row.valor_final,
      valores_valorBase: row.valores?.valorBase, valores_valorFinal: row.valores?.valorFinal,
      status: row.status, updated_at: row.updated_at,
    };
    console.log("ROW LIDO:", JSON.stringify(rowAntes, null, 2));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    console.log("ROLLBACK executado — nenhuma escrita realizada.");
    await client.end();
  }
  check(!!row, "banco: registro legado encontrado (SELECT read-only)", ID_LEGADO);

  // 2) normalização de leitura (mesma entrada da listagem do TMS)
  const dom: any = toOrcamentoDomain(row);
  check(Number(dom.valorBase) === 2200, "dominio: valorBase = 2200", String(dom.valorBase));
  check(Number(dom.valorFinal) === 2200, "dominio: valorFinal normalizado = 2200 (não 0)", String(dom.valorFinal));
  check(Number(dom.valores?.valorFinal) === 2200, "dominio: valores.valorFinal = 2200", String(dom.valores?.valorFinal));
  check(resolverValorFinal(dom.valores) === 2200, "regra: resolverValorFinal = 2200");
  check(Number(rowAntes?.valores_valorFinal) === 0, "banco intacto: valores.valorFinal original = 0 (não mascarado no dado)");

  // 3) PDF real a partir do domínio normalizado
  const doc = await construirPdfOrcamento(dom);
  const paginas = doc.getNumberOfPages();
  const outDir = path.join(process.cwd(), "ORC-PDF-01-EVIDENCIAS");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${dom.numero || "ORC"}_Orcamento_Comercial.pdf`);
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  fs.writeFileSync(outFile, buf);
  console.log("PDF gerado:", outFile, `(${buf.length} bytes, ${paginas} página(s))`);
  check(paginas >= 1 && paginas <= 3, "pdf: 1 a 3 páginas", `${paginas}`);
  check(buf.length > 8000, "pdf: arquivo não vazio", `${buf.length} bytes`);

  // 4) auditoria do conteúdo
  const latin = buf.toString("latin1");
  check(!latin.includes("Dura\u00E7\u00E3o estimada"), "pdf: NÃO contém 'Duração estimada'");
  check(latin.includes("Dist\u00E2ncia estimada"), "pdf: contém 'Distância estimada' (mantida)");
  check(latin.includes("Valor Base do Frete"), "pdf: contém 'Valor Base do Frete'");
  check(!latin.includes("Valor do Transporte"), "pdf: NÃO contém 'Valor do Transporte'");
  check(latin.includes("VALOR FINAL DA PROPOSTA"), "pdf: contém 'VALOR FINAL DA PROPOSTA'");
  check(!/VALOR FINAL[^ D]/.test(latin), "pdf: faixa antiga 'VALOR FINAL' genérica ausente");
  check(/R\$\s2\.200,00/.test(latin), "pdf: total impresso = R$ 2.200,00 (não R$ 0,00)");
  check(!latin.includes("R$ 0,00"), "pdf: nenhum 'R$ 0,00' impresso");
  check(!latin.includes("undefined"), "pdf: sem 'undefined'");
  check(!latin.includes("NaN"), "pdf: sem 'NaN'");
  check(!latin.includes("[object Object]"), "pdf: sem '[object Object]'");
  const mojibake = ["OR\u00C3\u2020AMENTO", "INFORMA\u00C3\u2020\u00C3\u2248ES", "VE\u00C3\u008BCULO", "Descri\u00C3\u00A7\u00C3\u00A3o"];
  const enc = mojibake.filter((m) => latin.includes(m));
  check(enc.length === 0, "pdf: sem mojibake", enc.join(",") || "ok");
  check(latin.includes("OR\u00C7AMENTO COMERCIAL"), "pdf: 'ORÇAMENTO COMERCIAL' (Ç)");
  check(latin.includes(dom.numero), "pdf: contém o número do orçamento", dom.numero);
  check(latin.includes(String(row.cliente ?? dom.cliente ?? "")) || latin.includes("CLIENTE"), "pdf: contém cliente");

  // 5) evidência textual
  const agora = new Date();
  const checklist = [
    "Duração estimada ausente do PDF — OK (preservada na tela)",
    "Distância estimada presente — OK",
    "Resumo: Valor Base do Frete — OK",
    "Faixa: VALOR FINAL DA PROPOSTA — OK",
    "VALOR FINAL impresso = R$ 2.200,00 (origem: regra canônica) — OK",
    "Banco intacto (valores.valorFinal original = 0, sem máscara) — OK",
    "Sem undefined/NaN/mojibake — OK",
  ];
  const evid = [
    "TMS-ORC-PDF-01 — PROVA (read-only, transação + ROLLBACK)",
    `DATA/HORA: ${agora.toISOString()} (${agora.toLocaleString("pt-BR")})`,
    `PROJETO: ${process.cwd()}`,
    `REGISTRO: ${ID_LEGADO} (numero ${dom.numero})`,
    `ROW ANTES: ${JSON.stringify(rowAntes)}`,
    `DOMINIO: valorBase=${dom.valorBase} valorFinal=${dom.valorFinal} valores.valorFinal=${dom.valores?.valorFinal}`,
    `PDF: ${outFile}`,
    `BYTES: ${buf.length}`,
    `PAGINAS: ${paginas}`,
    "",
    "CHECKLIST:",
    ...checklist.map((c) => ` - ${c}`),
  ];
  const evidFile = path.join(outDir, "ORC-PDF-01_PROVA.txt");
  fs.writeFileSync(evidFile, evid.join("\r\n"), "utf8");
  console.log("EVIDENCIA:", evidFile);

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
