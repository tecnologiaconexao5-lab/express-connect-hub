import { describe, it, expect } from "vitest";

// ============================================================================
// A31C — NFs em lote no dossiê fiscal da Central Financeira.
// Regra: separador é vírgula, ponto-e-vírgula, espaço ou quebra de linha;
// apenas o Número é obrigatório; trim; vazios removidos; sem duplicados.
// (Mesma lógica do handleAdicionarNFsEmLote em ConferenciaFinanceira.tsx)
// ============================================================================

function parseLoteNF(texto: string): string[] {
  return Array.from(
    new Set(
      texto
        .split(/[\s,;]+/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
    )
  );
}

describe("A31C — NFs em lote (parseLoteNF)", () => {
  it("separa por vírgula", () => {
    expect(parseLoteNF("123, 456, 789")).toEqual(["123", "456", "789"]);
  });

  it("separa por ponto e vírgula", () => {
    expect(parseLoteNF("123;456;789")).toEqual(["123", "456", "789"]);
  });

  it("separa por espaço e quebra de linha", () => {
    expect(parseLoteNF("123 456\n789")).toEqual(["123", "456", "789"]);
  });

  it("remove vazios e trims", () => {
    expect(parseLoteNF("  123 ,  , 456 ,, 789  ")).toEqual(["123", "456", "789"]);
  });

  it("remove duplicados", () => {
    expect(parseLoteNF("123, 456, 123, 456, 123")).toEqual(["123", "456"]);
  });

  it("vazio retorna lista vazia", () => {
    expect(parseLoteNF("   ,; ,\n  ")).toEqual([]);
  });

  it("lote misto vírgula+espaço+quebra+duplicado", () => {
    expect(parseLoteNF("A-1 B-2\nA-1;C-3 B-2")).toEqual(["A-1", "B-2", "C-3"]);
  });
});