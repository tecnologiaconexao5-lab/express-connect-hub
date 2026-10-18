import { describe, it, expect } from "vitest";
import { calcularResumoLancamento, calcularKmDuasPernas } from "@/services/financeiro/centralFinanceiroVisao";

describe("A31-J1 — Resumo financeiro do lançamento manual (prévia da Central)", () => {
  it("Total Cliente = frete + ajudante + diárias + outros - desconto (desconto só do cliente)", () => {
    const r = calcularResumoLancamento({
      valor_frete: "1000",
      valor_ajudante: "100",
      diarias_adicionais: "2",
      valor_diaria: "150",
      valor_adicional: "50",
      valor_desconto: "100",
    });
    expect(r.valorClienteTotal).toBe(1000 + 100 + 300 + 50 - 100);
  });

  it("Total Prestador = repasse + pedágio + combustível + ajudante + diárias + reembolso - desconto_prestador (outros do cliente NÃO entram)", () => {
    const r = calcularResumoLancamento({
      valor_repasse: "600",
      valor_pedagio: "120",
      valor_combustivel: "200",
      valor_ajudante: "100",
      diarias_adicionais: "2",
      valor_diaria: "150",
      valor_reembolso_outros: "40",
      valor_adicional: "50",
      valor_desconto_prestador: "100",
    });
    // A31-J1.9 — valor_adicional é "outros cobrados" do CLIENTE; não alimenta o prestador.
    expect(r.valorPrestadorTotal).toBe(600 + 120 + 200 + 100 + 300 + 40 - 100);
  });

  it("Margem = Total Cliente - Total Prestador e Margem % = margem / totalCliente", () => {
    const r = calcularResumoLancamento({
      valor_frete: "1000",
      valor_repasse: "600",
      valor_pedagio: "100",
      valor_ajudante: "50",
      valor_adicional: "30",
      valor_desconto: "20",
      valor_desconto_prestador: "20",
    });
    expect(r.valorClienteTotal).toBe(1000 + 50 + 30 - 20); // 1060
    // A31-J1.9 — valor_adicional (30) é do cliente; prestador: 600 + pedágio + ajudante - desconto_prestador
    expect(r.valorPrestadorTotal).toBe(600 + 100 + 50 - 20); // 730
    expect(r.margem).toBe(1060 - 730); // 330
    expect(r.margemPct).toBeCloseTo((330 / 1060) * 100, 5);
  });

  it("sem valores financeiros, totais zeram e margem % é 0 (evita divisão por zero)", () => {
    const r = calcularResumoLancamento({});
    expect(r.valorClienteTotal).toBe(0);
    expect(r.valorPrestadorTotal).toBe(0);
    expect(r.margem).toBe(0);
    expect(r.margemPct).toBe(0);
  });

  it("valores vazios/undefined são tratados como 0 (campos opcionais)", () => {
    const r = calcularResumoLancamento({ valor_frete: "", valor_repasse: undefined });
    expect(r.valorClienteBase).toBe(0);
    expect(r.valorPrestadorTotal).toBe(0);
  });

  it("diárias alimentam cliente e prestador (mesma fonte — regra única)", () => {
    const r = calcularResumoLancamento({ diarias_adicionais: "3", valor_diaria: "200" });
    expect(r.diariasCliente).toBe(600);
    expect(r.valorClienteTotal).toBe(600);
    expect(r.valorPrestadorTotal).toBe(600);
  });
});

describe("A31-J1.4 — Regras cliente/prestador + KM (mesmas fontes da Escala)", () => {
  // Exemplo real: HR, franquia 140, R$1/km, km 159,6 → excedente 19,6 nas duas pernas.
  const ctx = {
    franquiaCliente: 140,
    valorKmExcCliente: 1,
    franquiaPrestador: 140,
    valorKmPrestador: 1,
  };

  it("KM acima da franquia calcula excedente cliente (159,6 → 19,6 km)", () => {
    const km = calcularKmDuasPernas(159.6, { franquiaCliente: 140, valorKmExcCliente: 1 });
    expect(km.excedenteCliente).toBeCloseTo(19.6, 5);
    expect(km.totalExcedenteCliente).toBeCloseTo(19.6, 5);
  });

  it("excedente prestador é calculado separadamente (franquia/preço próprios)", () => {
    const km = calcularKmDuasPernas(159.6, {
      franquiaPrestador: 140,
      valorKmPrestador: 1,
    });
    expect(km.excedentePrestador).toBeCloseTo(19.6, 5);
    expect(km.totalExcedentePrestador).toBeCloseTo(19.6, 5);
  });

  it("franquias/preços diferentes entre cliente e prestador são respeitados", () => {
    const km = calcularKmDuasPernas(200, {
      franquiaCliente: 140, valorKmExcCliente: 1,
      franquiaPrestador: 200, valorKmPrestador: 2.5,
    });
    expect(km.excedenteCliente).toBe(60);
    expect(km.totalExcedenteCliente).toBe(60);
    expect(km.excedentePrestador).toBe(0); // abaixo/na franquia
    expect(km.totalExcedentePrestador).toBe(0);
  });

  it("abaixo da franquia retorna zero nas duas pernas", () => {
    const km = calcularKmDuasPernas(100, ctx);
    expect(km.excedenteCliente).toBe(0);
    expect(km.excedentePrestador).toBe(0);
    expect(km.totalExcedenteCliente).toBe(0);
    expect(km.totalExcedentePrestador).toBe(0);
  });

  it("alteração do KM recalcula excedente e totais", () => {
    const base = { valor_frete: "600", valor_repasse: "520", tabela_km: ctx };
    const r1 = calcularResumoLancamento({ ...base, km_realizados: "100" });
    const r2 = calcularResumoLancamento({ ...base, km_realizados: "159.6" });
    expect(r1.totalExcedenteCliente).toBe(0);
    expect(r2.totalExcedenteCliente).toBeCloseTo(19.6, 5);
    expect(r2.totalExcedentePrestador).toBeCloseTo(19.6, 5);
    expect(r2.valorClienteTotal).toBeCloseTo(600 + 19.6, 5);
    expect(r2.valorPrestadorTotal).toBeCloseTo(520 + 19.6, 5);
  });

  it("Total Cliente inclui excedente cliente; Total Prestador inclui excedente prestador", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(r.valorClienteTotal).toBeCloseTo(600 + 19.6, 5);
    expect(r.valorPrestadorTotal).toBeCloseTo(520 + 19.6, 5);
    expect(r.margem).toBeCloseTo(80, 5);
  });

  it("desconto do cliente NÃO afeta Total Prestador", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_desconto: "100",
    });
    expect(r.valorClienteTotal).toBe(500);
    expect(r.valorPrestadorTotal).toBe(520);
  });

  it("desconto/ajuste do prestador NÃO afeta Total Cliente", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_desconto_prestador: "120",
    });
    expect(r.valorClienteTotal).toBe(600);
    expect(r.valorPrestadorTotal).toBe(400);
  });
});
