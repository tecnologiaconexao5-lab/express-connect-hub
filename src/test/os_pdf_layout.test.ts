// ============================================================
// PDFs da OS — emissor institucional + paginação da página 1
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const cliente = readSrc("src/lib/pdf/clientReport.ts");
const prestador = readSrc("src/lib/pdf/prestadorReport.ts");

describe("A) Emissor institucional", () => {
  it("A.1 não imprime nome pessoal de funcionário", () => {
    expect(cliente.toLowerCase()).not.toContain("diego");
    expect(cliente.toLowerCase()).not.toContain("balbino");
    expect(prestador.toLowerCase()).not.toContain("diego");
    expect(prestador.toLowerCase()).not.toContain("balbino");
  });

  it("A.2 cliente usa Conexão Express como emissor", () => {
    expect(cliente).toContain('{ label: "Emissor", value: "Conexão Express Transportes LTDA" }');
    expect(cliente).not.toContain("data.responsavel");
  });
});

describe("B) Paginação da primeira página", () => {
  it("B.1 conteúdo começa abaixo do cabeçalho institucional (y=84)", () => {
    expect(cliente).toContain("let y = 84;");
    expect(prestador).toContain("let y = 84;");
  });

  it("B.2 não força addPage logo após a capa", () => {
    const trechoCliente = cliente.slice(
      cliente.indexOf("drawCoverPage"),
      cliente.indexOf("// --- DADOS DO CLIENTE ---"),
    );
    const trechoPrestador = prestador.slice(
      prestador.indexOf("drawCoverPage"),
      prestador.indexOf("// --- DADOS DO PRESTADOR ---"),
    );
    expect(trechoCliente).not.toContain("doc.addPage()");
    expect(trechoPrestador).not.toContain("doc.addPage()");
  });

  it("B.3 páginas seguintes começam abaixo do header compacto (y=35)", () => {
    expect(cliente).toContain("y = 35;");
    expect(prestador).toContain("y = 35;");
  });
});
