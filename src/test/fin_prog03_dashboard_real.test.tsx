import { describe, it, expect, vi, afterEach, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// ============================================================================
// TMS-FIN-PROG-03 — DASHBOARD REAL
// Prova que o DashboardFinanceiroEnterprise consome dados financeiros reais
// (fixture capturada READ-ONLY do Supabase) e exibe os mesmos totais que a
// camada de servico/SQL calcula, deixando de mostrar "Dados insuficientes".
//
// Fonte: temp/fin_prog03_dashboard_fixture.json (gerada por
// scripts/_fin_prog03_fixture.mjs). Regenere antes de rodar se necessario.
// ============================================================================

vi.mock("@/lib/supabase", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const fixture = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "temp", "fin_prog03_dashboard_fixture.json"), "utf8")
  );
  let osIdx = 0;
  const dataFor = (table: string, i: number): any[] => {
    switch (table) {
      case "ordens_servico":
        return i === 0 ? fixture.osMes : i === 1 ? fixture.osAnt : fixture.os6;
      case "financeiro_pagar":
        return fixture.pgr;
      case "pagamentos_prestadores":
        return fixture.ppg;
      case "financeiro_receber":
        return fixture.rcv;
      case "clientes":
        return fixture.cli;
      case "prestadores":
        return fixture.pre;
      default:
        return [];
    }
  };
  const makeBuilder = (table: string): any => {
    const i = table === "ordens_servico" ? osIdx++ % 3 : -1;
    const b: any = {};
    for (const m of ["select", "eq", "in", "neq", "gte", "lte", "lt", "or", "ilike", "order", "limit", "not", "is"]) {
      b[m] = () => b;
    }
    b.maybeSingle = async () => ({ data: null, error: null });
    b.single = async () => ({ data: null, error: null });
    b.then = (resolve: any) => resolve({ data: dataFor(table, i), error: null });
    return b;
  };
  return { supabase: { from: (t: string) => makeBuilder(t) } };
});

vi.mock("recharts", () => {
  const Null = () => null;
  return {
    ResponsiveContainer: Null, BarChart: Null, ComposedChart: Null, Bar: Null,
    Line: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null, Tooltip: Null,
    Legend: Null, Cell: Null, Pie: Null, PieChart: Null, AreaChart: Null, Area: Null,
  };
});

import DashboardFinanceiroEnterprise from "@/components/financeiro/DashboardFinanceiroEnterprise";

afterEach(cleanup);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T15:00:00-03:00"));
});
afterAll(() => vi.useRealTimers());

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.replace(/\u00a0/g, " ");

async function renderDashboard() {
  render(<DashboardFinanceiroEnterprise />);
  await waitFor(() => expect(screen.getByText("Dashboard Financeiro")).toBeTruthy());
  // sai do estado de carregamento
  await waitFor(() =>
    expect(screen.queryByText("Carregando dashboard financeiro...")).toBeNull()
  );
}

describe("TMS-FIN-PROG-03 — Dashboard consome titulos reais", () => {
  it("nao exibe mais o estado vazio 'Dados insuficientes'/'Nenhum dado disponivel' principal", async () => {
    await renderDashboard();
    // subtitulo do estado vazio principal ausente
    expect(
      screen.queryByText(/Dados insuficientes — finalize OS e cadastre despesas/i)
    ).toBeNull();
    // cards principais presentes
    expect(screen.getByText("Receita do Mês")).toBeTruthy();
    expect(screen.getByText("Repasses Prestadores")).toBeTruthy();
    expect(screen.getByText("Inadimplência")).toBeTruthy();
  });

  it("exibe exatamente os totais calculados da base real", async () => {
    await renderDashboard();
    const body = norm(document.body.textContent || "");
    expect(body).toContain(norm(brl(58243.22))); // Repasses Prestadores
    expect(body).toContain(norm(brl(129280.75))); // Inadimplencia
    expect(body).toContain(norm(brl(2120))); // A Receber (7 dias)
    expect(body).toContain(norm(brl(302.63))); // A Pagar Geral (7 dias)
    expect(body).toContain(norm(brl(500.72))); // Custos Operacionais
  });
});
