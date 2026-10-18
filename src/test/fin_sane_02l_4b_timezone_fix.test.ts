import { describe, it, expect } from "vitest";

// ============================================================================
// FIN-SANE-02L.4B — Teste do helper fmtDateLocal
//
// Corrige bug de timezone: new Date("2026-09-18") interpreta como
// UTC midnight e no Brasil (UTC-3) vira 17/09.
//
// O helper usa Date(y, m-1, d) para strings DATE puras (10 chars),
// que interpreta como data civil local sem offset.
// ============================================================================

/**
 * Helper replicado de PagamentoPrestadores.tsx para teste isolado.
 * Em produção, o componente importa de seu próprio escopo.
 */
function fmtDateLocal(s?: string | null): string {
  if (!s) return "—";
  if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  }
  return new Date(s).toLocaleDateString("pt-BR");
}

describe("fmtDateLocal — FIN-SANE-02L.4B", () => {
  it("2026-09-18 → 18/09/2026 (bug anterior: mostrava 17/09)", () => {
    expect(fmtDateLocal("2026-09-18")).toBe("18/09/2026");
  });

  it("2026-09-13 → 13/09/2026 (bug anterior: mostrava 12/09)", () => {
    expect(fmtDateLocal("2026-09-13")).toBe("13/09/2026");
  });

  it("DATE puro sem bug de timezone", () => {
    expect(fmtDateLocal("2026-01-01")).toBe("01/01/2026");
    expect(fmtDateLocal("2026-12-31")).toBe("31/12/2026");
    expect(fmtDateLocal("2026-06-15")).toBe("15/06/2026");
  });

  it("Timestamp completo preservado corretamente", () => {
    // Timestamp com T e Z — Date(iso) interpreta como UTC, mas
    // toLocaleDateString converte para BRT corretamente.
    const r = fmtDateLocal("2026-09-18T13:20:00.000Z");
    expect(r).toBe("18/09/2026");
  });

  it("Timestamp sem Z (local) também funciona", () => {
    const r = fmtDateLocal("2026-09-18T12:00:00");
    expect(r).toBe("18/09/2026");
  });

  it("null e undefined retornam —", () => {
    expect(fmtDateLocal(null)).toBe("—");
    expect(fmtDateLocal(undefined)).toBe("—");
  });

  it("string vazia retorna —", () => {
    expect(fmtDateLocal("")).toBe("—");
  });

  it("não concatena T12:00:00 em timestamps completos", () => {
    // Se o código concatenasse T12:00:00 em timestamp,
    // resultaria em algo como "2026-09-18T13:20:00.000ZT12:00:00"
    // que daria NaN ou data errada.
    const r = fmtDateLocal("2026-09-18T08:00:00.000Z");
    expect(r).not.toBe("Invalid Date");
    expect(r).not.toBe("—");
    // Deve ser 18/09 (08:00 UTC = 05:00 BRT = mesmo dia)
    expect(r).toBe("18/09/2026");
  });

  it("DATE com dia 01 funciona corretamente", () => {
    expect(fmtDateLocal("2026-03-01")).toBe("01/03/2026");
  });

  it("DATE com dia 28/29/30 funciona corretamente", () => {
    expect(fmtDateLocal("2026-02-28")).toBe("28/02/2026");
    expect(fmtDateLocal("2024-02-29")).toBe("29/02/2024");
    expect(fmtDateLocal("2026-04-30")).toBe("30/04/2026");
  });
});
