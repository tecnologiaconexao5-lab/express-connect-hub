import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// TMS-S04C.1 — HOTFIX do crash "Cannot access 'primeiroDiaMes' before
// initialization" no RelatorioFaturamentoCliente.
// Causa: referência a const antes da declaração (Temporal Dead Zone).
// ============================================================================

// Builder genérico do Supabase (todas as consultas do relatório retornam vazio).
const makeBuilder = (): any => {
  const b: any = {};
  b.select = () => b;
  b.eq = () => b;
  b.in = () => b;
  b.neq = () => b;
  b.gte = () => b;
  b.lte = () => b;
  b.or = () => b;
  b.ilike = () => b;
  b.order = () => b;
  b.limit = () => b;
  b.maybeSingle = async () => ({ data: null, error: null });
  b.single = async () => ({ data: null, error: null });
  b.then = (resolve: any) => resolve({ data: [], error: null });
  return b;
};

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => makeBuilder() },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Recharts não renderiza em jsdom (ResizeObserver) — neutralizado para o mount.
vi.mock("recharts", () => {
  const Null = () => null;
  return {
    ResponsiveContainer: Null,
    BarChart: Null,
    ComposedChart: Null,
    Bar: Null,
    Line: Null,
    XAxis: Null,
    YAxis: Null,
    CartesianGrid: Null,
    Tooltip: Null,
    Legend: Null,
    Cell: Null,
    Pie: Null,
    PieChart: Null,
  };
});

import RelatorioFaturamentoCliente from "@/components/financeiro/relatorios/RelatorioFaturamentoCliente";

const SRC = fs.readFileSync(
  path.resolve(process.cwd(), "src", "components", "financeiro", "relatorios", "RelatorioFaturamentoCliente.tsx"),
  "utf8"
);

afterEach(cleanup);

describe("TMS-S04C.1 — Ordem de declaração (sem Temporal Dead Zone)", () => {
  it("primeiroDiaMes e hoje são declarados ANTES do primeiro uso", () => {
    const declHoje = SRC.indexOf("const hoje = new Date();");
    const declPrim = SRC.indexOf("const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);");
    const usoPrim = SRC.indexOf("obterDataLocalFormatada(primeiroDiaMes)");
    const usoHoje = SRC.indexOf("obterDataLocalFormatada(hoje)");
    expect(declHoje).toBeGreaterThan(-1);
    expect(declPrim).toBeGreaterThan(declHoje);
    expect(usoPrim).toBeGreaterThan(declPrim);
    expect(usoHoje).toBeGreaterThan(declHoje);
  });

  it("as duas subtelas estão presentes no componente", () => {
    expect(SRC).toContain('value="consolidada"');
    expect(SRC).toContain('value="individual"');
    expect(SRC).toContain("Visão Consolidada");
    expect(SRC).toContain("Relatório Individual do Cliente");
  });
});

describe("TMS-S04C.1 — Montagem do componente (sem ReferenceError)", () => {
  it("A) componente monta sem ReferenceError e período inicial é preenchido", () => {
    expect(() => render(<RelatorioFaturamentoCliente />)).not.toThrow();
    // período inicial (Data inicial / Data final) preenchido
    const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    for (const d of dateInputs.slice(0, 2)) {
      expect((d as HTMLInputElement).value).not.toBe("");
    }
  });

  it("B) Visão Consolidada disponível e C) Relatório Individual disponível", async () => {
    render(<RelatorioFaturamentoCliente />);
    expect(screen.getByText("Visão Consolidada")).toBeTruthy();
    expect(screen.getByText("Relatório Individual do Cliente")).toBeTruthy();
  });

  it("C) Relatório Individual do Cliente continua disponível (estrutura completa)", () => {
    // A visão individual está íntegra no componente: seletor de cliente,
    // filtros de período, ações (Aplicar filtros / PDF / Imprimir) e tabela.
    expect(SRC).toContain("Cliente (obrigatório)");
    expect(SRC).toContain("Aplicar filtros");
    expect(SRC).toContain("Data inicial");
    expect(SRC).toContain("Data final");
    expect(SRC).toContain("Romaneio / OC");
    expect(SRC).toContain("Veículo / Placa");
    expect(SRC).toContain("Valor Base");
    expect(SRC).toContain("Valor Total");
    expect(SRC).toContain("TOTAL FATURADO");
    expect(SRC).toContain("gerarPDFRelatorioFaturamentoIndividual");
  });
});
