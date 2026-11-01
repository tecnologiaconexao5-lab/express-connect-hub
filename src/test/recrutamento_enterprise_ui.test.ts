// ============================================================
// TALENT INTELLIGENCE ENTERPRISE — identidade nas abas
// Dashboard preservado; demais abas com Roxo + Laranja.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const layout = readSrc("src/modules/recrutamento/layouts/RecrutamentoLayout.tsx");
const operacoes = readSrc("src/modules/recrutamento/pages/PaginaOperacoes.tsx");
const prestadores = readSrc("src/modules/recrutamento/pages/PaginaPrestadores.tsx");
const prestadorCard = readSrc(
  "src/modules/recrutamento/components/prestadores/PrestadorCard.tsx",
);
const dashboard = readSrc("src/modules/recrutamento/pages/DashboardRecrutamento.tsx");

describe("A) Shell Enterprise nas abas (exceto Dashboard)", () => {
  it("A.1 marca Talent Intelligence com Roxo + Laranja", () => {
    expect(layout).toContain("Talent Intelligence Enterprise");
    expect(layout).toContain("bg-[#2E1065]");
    expect(layout).toContain("border-orange-500");
    expect(layout).toContain("--primary");
  });

  it("A.2 aplica identidade somente fora do Dashboard", () => {
    expect(layout).toContain("currentSection !== 'dashboard'");
    expect(layout).toContain("enterprise &&");
    expect(layout).toContain("Recrutamento Inteligente");
  });

  it("A.3 Dashboard permanece com o componente original", () => {
    expect(dashboard).toContain("DashboardRecrutamento");
    expect(dashboard).not.toContain("Talent Intelligence Enterprise");
  });
});

describe("B) Aba Operações — cards de veículo e funil", () => {
  it("B.1 exibe veículo detalhado limpo e ações rápidas", () => {
    expect(operacoes).toContain("Veículo / Operação");
    expect(operacoes).toContain("logistica?.tipoVeiculoDetalhado");
    expect(operacoes).toContain("Refrigerada");
    expect(operacoes).toContain("onStatusChange");
    expect(operacoes).toContain("onDuplicar");
  });

  it("B.2 mostra indicador de funil integrado", () => {
    expect(operacoes).toContain("Funil de preenchimento");
    expect(operacoes).toContain("from-[#2E1065] via-violet-500 to-orange-500");
  });
});

describe("C) Prestadores — selo de performance", () => {
  it("C.1 cards exibem Diamante/Ouro/Prata/Bronze", () => {
    expect(prestadores).toContain("calcularCategoriaPerformance");
    expect(prestadores).toContain("PERFORMANCE_CORES[performance.categoria]");
    expect(prestadorCard).toContain("calcularCategoriaPerformance");
    expect(prestadorCard).toContain("PERFORMANCE_CORES[performance.categoria]");
  });
});
