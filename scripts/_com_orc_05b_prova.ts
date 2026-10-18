/* TMS-COM-ORC-05B — Prova: PDF REAL ORC-202609-8659 com logo CLARA corrigida.
   Read-only no banco. Shim de fetch/FileReader resolve "/..." para public/,
   exercitando o caminho real de carregamento da logo. Nada persiste. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { construirPdfOrcamento } from "../src/components/comercial/orcamentoPdf";
import { toOrcamentoDomain } from "../src/lib/dbMappers";

function loadEnv(): Record<string, string> {
  const p = path.join(process.cwd(), ".env");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// Shim: fetch relativo -> arquivo de public/; FileReader mínimo para Node.
const fetched: string[] = [];
const origFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: any) => {
  if (typeof url === "string" && url.startsWith("/")) {
    fetched.push(url);
    const p = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    if (fs.existsSync(p)) {
      const blob = new Blob([fs.readFileSync(p)], { type: "image/png" });
      return { ok: true, blob: async () => blob };
    }
    return { ok: false };
  }
  return origFetch ? origFetch(url) : { ok: false };
};
(globalThis as any).FileReader = class {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: any) {
    blob.arrayBuffer().then((ab: ArrayBuffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(ab).toString("base64")}`;
      this.onloadend && this.onloadend();
    }).catch(() => this.onerror && this.onerror());
  }
};

const NUMERO = "ORC-202609-8659";

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (c: boolean, l: string, x?: string) => { console.log(`${c ? "PASS" : "FAIL"} — ${l}${x ? " :: " + x : ""}`); if (!c) falhas++; };

  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const row = (await client.query("SELECT * FROM public.orcamentos WHERE numero = $1 LIMIT 1", [NUMERO])).rows[0];
  await client.end();
  check(!!row, "registro real encontrado no banco (read-only)");

  const orc = toOrcamentoDomain(row);
  const doc = await construirPdfOrcamento(orc);
  const paginas = doc.getNumberOfPages();
  const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  const latin = buf.toString("latin1");

  const outDir = path.join(process.cwd(), "test-results", "com-orc-05b");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${NUMERO}_Orcamento_Comercial.pdf`);
  fs.writeFileSync(outFile, buf);

  console.log(`PDF real: ${outFile} (${buf.length} bytes, ${paginas} página(s))`);
  check(fetched.includes("/logos/logo-conexao-oficial.png"), "loader buscou a variante CLARA /logos/logo-conexao-oficial.png", fetched.join(", "));
  check(!fetched.includes("/logo-oficial-conexao.png"), "loader NÃO buscou o arquivo escuro antigo");
  const logoSha = crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), "public", "logos", "logo-conexao-oficial.png"))).digest("hex").slice(0, 16);
  check(logoSha === "162e7a020d4973ef", "asset carregado é a variante CLARA (sha 162e7a02, 0% escuros)", logoSha);
  check(buf.length > 0, "PDF gerado com conteúdo", `${buf.length} bytes`);
  check(paginas <= 2, "paginação ok", `${paginas} página(s)`);
  check(latin.includes("Cydak do Brasil"), "cliente real exibido (Cydak do Brasil LTDA)");
  check(latin.includes("OR") && latin.includes("AMENTO COMERCIAL"), "'ORÇAMENTO COMERCIAL' presente");
  check(/R\$\s2\.200,00/.test(latin), "Valor do Transporte R$ 2.200,00 preservado");
  check(!latin.includes("undefined") && !latin.includes("NaN"), "sem undefined/NaN");
  for (const m of ["ORÃ‡AMENTO", "VEÃCULO", "CONDIÃ‡Ã•ES"]) check(!latin.includes(m), `sem mojibake '${m}'`);

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  console.log("ARQUIVO_PDF=" + outFile);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
